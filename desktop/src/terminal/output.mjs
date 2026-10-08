// Pure data handling: no PTY, renderer, process, transport or input authority.
export const OUTPUT_RING_BYTES = 4 * 1024 * 1024;
export const OUTPUT_DELIVERY_BYTES = 32 * 1024;
export const VT_SEQUENCE_BYTES = 4 * 1024;
const encoder = new TextEncoder();
const fail = code => Object.assign(new Error(code), { code });
const validInteger = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
function validText(data) {
  if (typeof data !== 'string') throw fail('INVALID_OUTPUT_DATA');
  if (!data.isWellFormed()) throw fail('INVALID_UNICODE');
}
const continuation = byte => (byte & 0xc0) === 0x80;
const scalarBytes = byte => byte < 0x80 ? 1 : byte < 0xe0 ? 2 : byte < 0xf0 ? 3 : 4;

/** Sequence/ACK cursors are absolute UTF-8 byte offsets; nextSequence is exclusive. */
export function createOutputRing({ maxBytes = OUTPUT_RING_BYTES } = {}) {
  if (!validInteger(maxBytes, 4, OUTPUT_RING_BYTES)) throw fail('INVALID_OUTPUT_BUDGET');
  const blockBytes = Math.min(maxBytes, OUTPUT_DELIVERY_BYTES);
  const blocks = [];
  let nextSequence = 0; let retainedUtf8Bytes = 0; let droppedUtf8Bytes = 0;
  const firstSequence = () => blocks[0]?.sequence ?? nextSequence;
  const stats = () => ({
    firstSequence: firstSequence(), nextSequence, retainedUtf8Bytes, droppedUtf8Bytes,
    blockCount: blocks.length, allocatedBytes: blocks.length * blockBytes,
  });
  return Object.freeze({
    stats,
    append(data) {
      validText(data);
      if (!Number.isSafeInteger(nextSequence + Buffer.byteLength(data))) throw fail('OUTPUT_SEQUENCE_EXHAUSTED');
      let offset = 0;
      while (offset < data.length) {
        let tail = blocks.at(-1);
        const needed = data.codePointAt(offset) <= 0x7f ? 1 : data.codePointAt(offset) <= 0x7ff ? 2 : data.codePointAt(offset) <= 0xffff ? 3 : 4;
        if (!tail || blockBytes - tail.used < needed) {
          // Scalar alignment can leave1..3 unused bytes per block. Enforce
          // the physical allocation cap before allocating another block.
          while ((blocks.length + 1) * blockBytes > maxBytes) {
            const removed = blocks.shift();
            retainedUtf8Bytes -= removed.used; droppedUtf8Bytes += removed.used;
          }
          tail = { sequence: nextSequence, buffer: Buffer.allocUnsafe(blockBytes), used: 0 };
          blocks.push(tail);
        }
        // encodeInto consumes only a bounded destination; no full input UTF-8 copy.
        const { read, written } = encoder.encodeInto(data.slice(offset), tail.buffer.subarray(tail.used));
        offset += read; tail.used += written; nextSequence += written; retainedUtf8Bytes += written;
        while (retainedUtf8Bytes > maxBytes) {
          const removed = blocks.shift();
          retainedUtf8Bytes -= removed.used; droppedUtf8Bytes += removed.used;
        }
      }
      return stats();
    },
    read({ fromSequence = 0, maxBytes = OUTPUT_DELIVERY_BYTES } = {}) {
      if (!validInteger(fromSequence, 0, nextSequence)) throw fail('INVALID_OUTPUT_CURSOR');
      if (!validInteger(maxBytes, 1, OUTPUT_DELIVERY_BYTES)) throw fail('INVALID_DELIVERY_BUDGET');
      const first = firstSequence();
      const gap = fromSequence < first ? {
        fromSequence, resumeSequence: first, droppedUtf8Bytes: first - fromSequence,
        marker: `Terminal history omitted: ${first - fromSequence} UTF-8 bytes.`, resetParser: true,
      } : null;
      let cursor = Math.max(fromSequence, first); let remaining = maxBytes; let requiredBytes = null;
      const chunks = [];
      for (const block of blocks) {
        if (cursor >= block.sequence + block.used) continue;
        const start = cursor - block.sequence;
        if (continuation(block.buffer[start])) throw fail('INVALID_UTF8_CURSOR');
        let end = Math.min(block.used, start + remaining);
        while (end > start && end < block.used && continuation(block.buffer[end])) end--;
        if (end === start) { requiredBytes = scalarBytes(block.buffer[start]); break; }
        const utf8Bytes = end - start;
        chunks.push({ sequence: cursor, data: block.buffer.toString('utf8', start, end), utf8Bytes });
        cursor += utf8Bytes; remaining -= utf8Bytes;
        if (!remaining) break;
        if (end < block.used) { requiredBytes = scalarBytes(block.buffer[end]); break; }
      }
      return { chunks, nextSequence: cursor, endSequence: nextSequence, firstSequence: first, gap, requiredBytes };
    },
    clear() {
      droppedUtf8Bytes += retainedUtf8Bytes; retainedUtf8Bytes = 0; blocks.length = 0;
      return stats();
    },
  });
}

function deliveryChunks(data) {
  if (!data) return [];
  if (Buffer.byteLength(data) <= OUTPUT_DELIVERY_BYTES) return [data];
  const parts = []; let offset = 0;
  while (offset < data.length) {
    const bytes = Buffer.allocUnsafe(OUTPUT_DELIVERY_BYTES);
    const { read, written } = encoder.encodeInto(data.slice(offset), bytes);
    parts.push(bytes.toString('utf8', 0, written)); offset += read;
  }
  return parts;
}

/** Holds incomplete VT controls; drops oversized controls through their terminator. */
export class VtBudgetFilter {
  constructor({ maxSequenceBytes = VT_SEQUENCE_BYTES } = {}) {
    if (!validInteger(maxSequenceBytes, 2, VT_SEQUENCE_BYTES)) throw fail('INVALID_VT_BUDGET');
    this.maxSequenceBytes = maxSequenceBytes;
    this.mode = 'ground'; this.pending = ''; this.pendingBytes = 0;
    this.discarding = false; this.stringEscape = false;
    this.totalOmittedUtf8Bytes = 0; this.totalOmittedSequences = 0;
  }
  stats() {
    return { mode: this.mode, pendingUtf8Bytes: this.pendingBytes, discarding: this.discarding,
      totalOmittedUtf8Bytes: this.totalOmittedUtf8Bytes, totalOmittedSequences: this.totalOmittedSequences };
  }
  _ground() {
    this.mode = 'ground'; this.pending = ''; this.pendingBytes = 0;
    this.discarding = false; this.stringEscape = false;
  }
  _accept(char) {
    const bytes = Buffer.byteLength(char);
    if (this.discarding) { this.totalOmittedUtf8Bytes += bytes; return; }
    if (this.pendingBytes + bytes > this.maxSequenceBytes) {
      this.totalOmittedUtf8Bytes += this.pendingBytes + bytes; this.totalOmittedSequences++;
      this.pending = ''; this.pendingBytes = 0; this.discarding = true;
    } else { this.pending += char; this.pendingBytes += bytes; }
  }
  _complete(parts) {
    if (!this.discarding) parts.push(this.pending);
    this._ground();
  }
  _omitPending() {
    if (!this.discarding && this.pendingBytes) {
      this.totalOmittedUtf8Bytes += this.pendingBytes; this.totalOmittedSequences++;
    }
    this._ground();
  }
  _result(data, beforeBytes, beforeSequences) {
    const omittedUtf8Bytes = this.totalOmittedUtf8Bytes - beforeBytes;
    return { data, chunks: deliveryChunks(data), omittedUtf8Bytes,
      omittedSequences: this.totalOmittedSequences - beforeSequences,
      marker: omittedUtf8Bytes ? `Terminal control data omitted: ${omittedUtf8Bytes} UTF-8 bytes.` : null };
  }
  push(data) {
    validText(data);
    if (Buffer.byteLength(data) > OUTPUT_DELIVERY_BYTES) throw fail('INVALID_DELIVERY_BUDGET');
    const beforeBytes = this.totalOmittedUtf8Bytes; const beforeSequences = this.totalOmittedSequences;
    const parts = []; let plain = '';
    const flushPlain = () => { if (plain) { parts.push(plain); plain = ''; } };
    for (const char of data) {
      const code = char.codePointAt(0);
      if (this.mode === 'ground') {
        const mode = char === '\x1b' ? 'escape' : code === 0x9b ? 'csi' : code === 0x9d ? 'osc' : [0x90,0x98,0x9e,0x9f].includes(code) ? 'string' : null;
        if (!mode) { plain += char; continue; }
        flushPlain(); this.mode = mode; this._accept(char); continue;
      }
      // CAN/SUB cancel every control; never replay half a cancelled control.
      if (code === 0x18 || code === 0x1a) {
        this._accept(char); this._omitPending(); continue;
      }
      this._accept(char);
      if (this.mode === 'osc' || this.mode === 'string') {
        if (code === 0x9c || (this.mode === 'osc' && code === 7) || (this.stringEscape && char === '\\')) this._complete(parts);
        else this.stringEscape = char === '\x1b';
      } else if (this.mode === 'csi') {
        if (code >= 0x40 && code <= 0x7e) this._complete(parts);
        else if (char === '\x1b') this.mode = 'escape';
      } else if (this.mode === 'escape') {
        if (char === '[') this.mode = 'csi';
        else if (char === ']') this.mode = 'osc';
        else if (['P','X','^','_'].includes(char)) this.mode = 'string';
        else if (code >= 0x20 && code <= 0x2f) this.mode = 'escape-intermediate';
        else if (code >= 0x30 && code <= 0x7e) this._complete(parts);
        else if (code > 0x7f) this._omitPending();
      } else if (this.mode === 'escape-intermediate' && code >= 0x30 && code <= 0x7e) this._complete(parts);
    }
    flushPlain();
    return this._result(parts.join(''), beforeBytes, beforeSequences);
  }
  reset() {
    const beforeBytes = this.totalOmittedUtf8Bytes; const beforeSequences = this.totalOmittedSequences;
    this._omitPending();
    return this._result('', beforeBytes, beforeSequences);
  }
}
