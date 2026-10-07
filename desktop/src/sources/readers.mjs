const error = code => Object.assign(new Error(code), { code });
const fields = ['sourceId', 'version', 'sha256', 'utf8Bytes', 'utf16Units', 'lines', 'longestLineUnits', 'encoding', 'bom', 'newline'];

/** Trusted native read snapshots, not renderer capabilities or a disk cache.
 * At most two verified source models (32 MiB UTF-8 each) are retained by default.
 * This bounds retained sources/count, not RSS: model indexes have extra cost.
 * The native owner must share this pool across repositories and dispose it on
 * Lock/selection transitions; each request also rechecks its captured guard.
 */
export class SourceReaderPool {
  #slots = new Set();
  #maxReaders;
  #ttlMs;
  constructor({ maxReaders = 2, ttlMs = 60000 } = {}) {
    if (!Number.isSafeInteger(maxReaders) || maxReaders < 1 || maxReaders > 2 ||
        !Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > 300000) throw error('INVALID_READER_BUDGET');
    this.#maxReaders = maxReaders; this.#ttlMs = ttlMs;
  }
  dispose() { for (const close of this.#slots) close(); }
  async open({ load, guard }) {
    if (this.#slots.size >= this.#maxReaders) throw error('SOURCE_READER_BUDGET');
    let model = null, closed = false, opening = true;
    const close = () => {
      if (closed) return;
      closed = true; model = null; clearTimeout(timer);
      // A timeout/Lock fences pending work but cannot cancel its owned I/O.
      // Keep its reservation until that work settles to bound concurrent loads.
      if (!opening) this.#slots.delete(close);
    };
    const timer = setTimeout(close, this.#ttlMs); timer.unref();
    this.#slots.add(close); // Reserve before any await, including authorization.
    const assertOpen = () => { if (closed) throw error('SOURCE_READER_CLOSED'); };
    const check = async () => {
      assertOpen();
      try { await guard(); } catch (e) { close(); throw e; }
      assertOpen();
    };
    try {
      await check();
      assertOpen();
      const loaded = await load();
      assertOpen();
      await check();
      assertOpen();
      if (!loaded.model) throw error('UNSUPPORTED_ENCODING');
      model = loaded.model;
      const info = Object.freeze(Object.fromEntries(fields.map(key => [key, loaded.ref[key]])));
      return Object.freeze({ info, dispose: close, readChunk: async ({ start, maxUnits } = {}) => {
        await check();
        assertOpen();
        if (!Number.isSafeInteger(maxUnits) || maxUnits < 2 || maxUnits > 131072) throw error('INVALID_RANGE');
        // First validate start independently, including surrogate boundaries.
        model.readRange(info.version, start, start);
        let end = Math.min(model.metrics.utf16Units, start + maxUnits), text;
        try { text = model.readRange(info.version, start, end); }
        catch (e) {
          if (e.code !== 'INVALID_UNICODE') throw e;
          // Only the end can split a pair now. Keep the leading surrogate for
          // the next chunk; report the actual boundary rather than dropping it.
          end--; text = model.readRange(info.version, start, end);
        }
        await check();
        // Recheck in this outward continuation too: disposal can run between
        // the nested check's resolution and this exact publication boundary.
        assertOpen();
        return { sourceId: info.sourceId, version: info.version, start, end, text };
      } });
    } catch (e) { close(); throw e; }
    finally { opening = false; if (closed) this.#slots.delete(close); }
  }
}
