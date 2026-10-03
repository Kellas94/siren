import { createHash } from 'node:crypto';
import { measureSource } from './metrics.mjs';

const count = node => node?.count ?? 0;
const units = node => node?.total ?? 0;
const maximum = node => node?.maximum ?? 0;
const failure = (code, operationId, version) => ({ ok: false, code, operationId, version, textChanged: false, inverse: null });
const error = code => Object.assign(new Error(code), { code });

function update(node) {
  node.count = count(node.left) + 1 + count(node.right);
  node.total = units(node.left) + node.span + units(node.right);
  node.maximum = Math.max(maximum(node.left), node.width, maximum(node.right));
  return node;
}

function merge(left, right) {
  if (!left) return right;
  if (!right) return left;
  if (left.priority < right.priority) {
    left.right = merge(left.right, right);
    return update(left);
  }
  right.left = merge(left, right.left);
  return update(right);
}

function split(node, lineCount) {
  if (!node) return [null, null];
  if (lineCount <= count(node.left)) {
    const [left, middle] = split(node.left, lineCount);
    node.left = middle;
    return [left, update(node)];
  }
  const [middle, right] = split(node.right, lineCount - count(node.left) - 1);
  node.right = middle;
  return [update(node), right];
}

function lineAt(node, offset, start = 0, index = 0) {
  const leftUnits = units(node.left);
  if (offset < leftUnits) return lineAt(node.left, offset, start, index);
  if (offset < leftUnits + node.span || !node.right) {
    return { start: start + leftUnits, width: node.width, span: node.span, index: index + count(node.left) };
  }
  return lineAt(node.right, offset - leftUnits - node.span,
    start + leftUnits + node.span, index + count(node.left) + 1);
}

function scanLines(text) {
  const lines = [];
  let start = 0;
  for (const match of text.matchAll(/\r\n|\r|\n/g)) {
    const width = match.index - start;
    lines.push({ width, span: width + match[0].length });
    start = match.index + match[0].length;
  }
  lines.push({ width: text.length - start, span: text.length - start });
  return lines;
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

/** Piece table with an augmented line treap and bounded operation-span history. */
export class TextModel {
  #pieces;
  #lines = null;
  #serial = 0;
  #version;
  #sourceId;
  #bytes;
  #historyBytes;
  #retainedBytes = 0;
  #undo = [];
  #redo = [];
  #operations = new Map();

  constructor({ text = '', version = 0, sourceId, historyBytes = 8 * 1024 * 1024 } = {}) {
    const metrics = measureSource(text);
    if (!Number.isSafeInteger(version) || version < 0) throw error('INVALID_VERSION');
    if (!Number.isSafeInteger(historyBytes) || historyBytes < 0) throw error('INVALID_HISTORY_BUDGET');
    if (sourceId !== undefined && (typeof sourceId !== 'string' || !sourceId)) throw error('INVALID_SOURCE_ID');
    this.#pieces = text.length ? [{ text, start: 0, end: text.length }] : [];
    this.#version = version;
    this.#sourceId = sourceId;
    this.#bytes = metrics.utf8Bytes;
    this.#historyBytes = historyBytes;
    this.#lines = this.#buildLines(scanLines(text));
  }

  get version() { return this.#version; }
  get text() { return this.#slice(0, units(this.#lines)); }
  get metrics() {
    return { utf8Bytes: this.#bytes, utf16Units: units(this.#lines),
      lines: count(this.#lines), longestLineUnits: maximum(this.#lines) };
  }

  #buildLines(lines) {
    let root = null;
    for (const line of lines) {
      // Deterministic mixed priorities keep sequentially inserted lines balanced.
      let priority = ++this.#serial;
      priority = Math.imul(priority ^ (priority >>> 16), 0x45d9f3b);
      priority = Math.imul(priority ^ (priority >>> 16), 0x45d9f3b);
      priority = (priority ^ (priority >>> 16)) >>> 0;
      root = merge(root, update({ ...line, priority, left: null, right: null }));
    }
    return root;
  }

  #rangePieces(start, end) {
    const result = [];
    let offset = 0;
    for (const piece of this.#pieces) {
      const length = piece.end - piece.start;
      if (end <= offset) break;
      if (start < offset + length && end > offset) result.push({ text: piece.text,
        start: piece.start + Math.max(0, start - offset),
        end: piece.start + Math.min(length, end - offset) });
      offset += length;
    }
    return result;
  }

  #slice(start, end) {
    return this.#rangePieces(start, end).map(piece => piece.text.slice(piece.start, piece.end)).join('');
  }

  #checkRange(start, end) {
    const length = units(this.#lines);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > length) return 'INVALID_RANGE';
    for (const offset of [start, end]) {
      if (offset > 0 && offset < length) {
        const pair = this.#slice(offset - 1, offset + 1);
        const before = pair.charCodeAt(0), after = pair.charCodeAt(1);
        if (before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff) return 'INVALID_UNICODE';
      }
    }
    return null;
  }

  readRange(version, start, end) {
    if (version !== this.#version) throw error('REVISION_CONFLICT');
    const code = this.#checkRange(start, end);
    if (code) throw error(code);
    return this.#slice(start, end);
  }

  #identity(edit) {
    return fingerprint(['edit', edit.sourceId, edit.expectedVersion, edit.start, edit.end, edit.insertedText]);
  }

  #duplicate(operationId, identity) {
    const previous = this.#operations.get(operationId);
    if (!previous) return null;
    if (previous.identity !== identity) return failure('OPERATION_ID_REUSE', operationId, this.#version);
    return this.#copyResult(previous.result);
  }

  #copyResult(result) {
    return { ...result, inverse: result.inverse ? { ...result.inverse } : null };
  }

  validate(edit) {
    const operationId = edit?.operationId;
    if (!edit || typeof operationId !== 'string' || !operationId || typeof edit.insertedText !== 'string') {
      return failure('INVALID_EDIT', operationId, this.#version);
    }
    if (edit.sourceId !== undefined && typeof edit.sourceId !== 'string') return failure('INVALID_EDIT', operationId, this.#version);
    if (!Number.isSafeInteger(edit.expectedVersion)) return failure('REVISION_CONFLICT', operationId, this.#version);
    if (!Number.isSafeInteger(edit.start) || !Number.isSafeInteger(edit.end)) return failure('INVALID_RANGE', operationId, this.#version);
    const duplicate = this.#duplicate(operationId, this.#identity(edit));
    if (duplicate) return duplicate;
    if (this.#sourceId !== undefined && edit.sourceId !== this.#sourceId) return failure('SOURCE_MISMATCH', operationId, this.#version);
    if (edit.expectedVersion !== this.#version) return failure('REVISION_CONFLICT', operationId, this.#version);
    const code = this.#checkRange(edit.start, edit.end);
    if (code) return failure(code, operationId, this.#version);
    if (!edit.insertedText.isWellFormed()) return failure('INVALID_UNICODE', operationId, this.#version);
    const removed = this.#slice(edit.start, edit.end);
    const textChanged = removed !== edit.insertedText;
    if (this.#version === Number.MAX_SAFE_INTEGER) return failure('VERSION_EXHAUSTED', operationId, this.#version);
    return { ok: true, operationId, version: this.#version + 1, textChanged,
      inverse: textChanged ? { start: edit.start, end: edit.start + edit.insertedText.length, insertedText: removed } : null };
  }

  apply(edit) {
    const result = this.validate(edit);
    if (!result.ok || this.#operations.has(edit.operationId)) return result;
    const identity = this.#identity(edit);
    if (result.textChanged) {
      this.#change(edit.start, edit.end, edit.insertedText);
      this.#version += 1;
      for (const entry of this.#redo) this.#release(entry);
      this.#redo = [];
      const entry = { forward: { start: edit.start, end: edit.end, insertedText: edit.insertedText },
        inverse: { ...result.inverse },
        bytes: Buffer.byteLength(edit.insertedText) + Buffer.byteLength(result.inverse.insertedText),
        receipts: [] };
      this.#undo.push(entry);
      this.#retainedBytes += entry.bytes;
      const stored = this.#copyResult(result);
      entry.receipts.push(stored);
      this.#operations.set(edit.operationId, { identity, result: stored });
      this.#trimHistory();
    } else {
      this.#version += 1;
      this.#operations.set(edit.operationId, { identity, result: { ...result } });
    }
    return result;
  }

  #change(start, end, insertedText) {
    const length = units(this.#lines);
    const extendedStart = Math.max(0, start - 1);
    const extendedEnd = Math.min(length, end + 1);
    const first = lineAt(this.#lines, extendedStart);
    const last = lineAt(this.#lines, extendedEnd);
    const removed = this.#slice(start, end);
    // Rescan the changed span plus its immediate newline neighbours only.
    // Unchanged boundary-line content is represented by its recorded width.
    const prefixWidth = Math.min(extendedStart - first.start, first.width);
    const prefixTerm = extendedStart > first.start + first.width
      ? this.#slice(first.start + first.width, extendedStart) : '';
    const suffixWidth = Math.max(0, last.start + last.width - extendedEnd);
    const suffixTerm = this.#slice(Math.max(extendedEnd, last.start + last.width), last.start + last.span);
    const middle = prefixTerm + this.#slice(extendedStart, start) + insertedText + this.#slice(end, extendedEnd);
    // One ordinary character stands in for a nonempty unchanged suffix. It
    // separates CR from LF exactly as that suffix does, without copying it.
    const replacementLines = scanLines(middle + (suffixWidth ? 'x' : '') + suffixTerm);
    replacementLines[0].width += prefixWidth;
    replacementLines[0].span += prefixWidth;
    if (suffixWidth) {
      let markerOffset = middle.length + prefixWidth;
      for (const line of replacementLines) {
        if (markerOffset < line.span) {
          line.width += suffixWidth - 1;
          line.span += suffixWidth - 1;
          break;
        }
        markerOffset -= line.span;
      }
    }
    // A nonfinal scanned region ends at the next unaffected line's start.
    if (last.index < count(this.#lines) - 1) replacementLines.pop();
    const [prefix, rest] = split(this.#lines, first.index);
    const [, suffix] = split(rest, last.index - first.index + 1);
    this.#lines = merge(merge(prefix, this.#buildLines(replacementLines)), suffix);
    const pieces = this.#rangePieces(0, start);
    if (insertedText.length) pieces.push({ text: insertedText, start: 0, end: insertedText.length });
    for (const piece of this.#rangePieces(end, length)) pieces.push(piece);
    const compact = [];
    for (const piece of pieces) {
      const previous = compact.at(-1);
      if (previous && previous.text === piece.text && previous.end === piece.start) previous.end = piece.end;
      else compact.push(piece);
    }
    this.#pieces = compact;
    this.#bytes += Buffer.byteLength(insertedText) - Buffer.byteLength(removed);
  }

  #release(entry) {
    this.#retainedBytes -= entry.bytes;
    // Idempotency keeps fingerprints/versions, never evicted span strings.
    for (const receipt of entry.receipts) receipt.inverse = null;
  }

  #trimHistory() {
    while (this.#retainedBytes > this.#historyBytes && this.#undo.length) this.#release(this.#undo.shift());
  }

  #historyAction(kind, operationId) {
    if (typeof operationId !== 'string' || !operationId) return failure('INVALID_EDIT', operationId, this.#version);
    const identity = fingerprint([kind]);
    const duplicate = this.#duplicate(operationId, identity);
    if (duplicate) return duplicate;
    const from = kind === 'undo' ? this.#undo : this.#redo;
    const to = kind === 'undo' ? this.#redo : this.#undo;
    if (!from.length) return failure(kind === 'undo' ? 'NOTHING_TO_UNDO' : 'NOTHING_TO_REDO', operationId, this.#version);
    if (this.#version === Number.MAX_SAFE_INTEGER) return failure('VERSION_EXHAUSTED', operationId, this.#version);
    const entry = from.pop();
    const operation = kind === 'undo' ? entry.inverse : entry.forward;
    const inverse = kind === 'undo' ? entry.forward : entry.inverse;
    this.#change(operation.start, operation.end, operation.insertedText);
    this.#version += 1;
    to.push(entry);
    const result = { ok: true, operationId, version: this.#version, textChanged: true, inverse: { ...inverse } };
    const stored = this.#copyResult(result);
    entry.receipts.push(stored);
    this.#operations.set(operationId, { identity, result: stored });
    return result;
  }

  undo(operationId) { return this.#historyAction('undo', operationId); }
  redo(operationId) { return this.#historyAction('redo', operationId); }
}
