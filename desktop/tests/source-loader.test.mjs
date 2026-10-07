import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SourceReaderPool } from '../src/sources/readers.mjs';
import { TextModel } from '../src/sources/text-model.mjs';

const module = await import('../src/ui/code/source-loader.js').catch(e => {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; return {};
});
const sha = value => createHash('sha256').update(Buffer.from(value)).digest('hex');
function fixture(t, original) {
  const model = new TextModel({ text: original, version: 1, sourceId: 'source-one' });
  const ref = { sourceId: 'source-one', version: 1, sha256: sha(original) };
  const info = { ...ref, ...model.metrics, encoding: 'utf8', bom: original.startsWith('\ufeff'), newline: 'mixed' };
  const pool = new SourceReaderPool(); let reader, closes = 0;
  t.after(() => pool.dispose());
  const bridge = {
    openRead: async () => { reader = await pool.open({ guard: () => {}, load: async () => ({ model, ref: info }) }); return { ok: true, readId: 'read-one', ...reader.info }; },
    readChunk: async request => ({ ok: true, readId: 'read-one', ...await reader.readChunk(request) }),
    closeRead: async request => { closes++; reader?.dispose(); return { ok: true, ...request }; }
  };
  const load = options => { assert.equal(typeof module.loadSource, 'function', 'verified incremental loader must exist'); return module.loadSource({ bridge, sourceRef: ref, ...options }); };
  return { load, bridge, ref, closes: () => closes };
}

// Converting mixed newlines or overlooking a shortened Unicode boundary fails
// the independent complete-text/hash oracle, even if every receipt says ok.
test('verified loader builds CodeMirror Text without normalizing BOM, CRLF, bare CR or Unicode', async t => {
  const original = '\ufeff' + 'a'.repeat(131070) + '😀\r\nȘ\rbare\n' + 'code\r\n'.repeat(20000);
  const f = fixture(t, original); const progress = [];
  const result = await f.load({ onProgress: value => progress.push(value) });
  assert.equal(result.ok, true); assert.equal(result.doc.toString('\n'), original);
  assert.equal(result.doc.length, original.length); assert.equal(result.sha256, sha(original));
  assert.equal(result.sourceId, f.ref.sourceId); assert.equal(result.version, 1); assert.equal(f.closes(), 1);
  assert.equal(progress.at(-1).loadedUnits, original.length);
});

test('loader detects equal-length text corruption against the independent full hash', async t => {
  const f = fixture(t, 'private'); const read = f.bridge.readChunk;
  f.bridge.readChunk = async request => ({ ...await read(request), text: 'wrong!!' });
  const result = await f.load(); assert.equal(result.ok, false); assert.equal(result.code, 'SOURCE_HASH_MISMATCH');
  assert.equal('doc' in result, false); assert.equal(f.closes(), 1);
});

test('cancel after a progress callback never exposes a partial document and closes the read', async t => {
  const f = fixture(t, 'x'.repeat(200000)); const controller = new AbortController();
  const result = await f.load({ signal: controller.signal, onProgress: () => controller.abort() });
  assert.equal(result.ok, false); assert.equal(result.code, 'SOURCE_LOAD_CANCELLED'); assert.equal('doc' in result, false);
  assert.equal(f.closes(), 1);
});

test('wrong reader/version/boundaries and stalled chunks refuse rather than append or loop', async t => {
  for (const changed of [{ readId: 'wrong' }, { version: 2 }, { start: 1 }, { end: 0, text: '' }, { text: '\ud800', end: 1 }]) {
    const f = fixture(t, 'private'); const read = f.bridge.readChunk;
    f.bridge.readChunk = async request => ({ ...await read(request), ...changed });
    const result = await f.load(); assert.equal(result.ok, false); assert.equal(result.code, 'INVALID_RECEIPT');
    assert.equal('doc' in result, false); assert.equal(f.closes(), 1);
  }
});

test('failure to close a successful read is reported rather than presenting a verified document', async t => {
  const f = fixture(t, 'private'); f.bridge.closeRead = async () => ({ ok: false, code: 'ACCESS_REFUSED' });
  const result = await f.load(); assert.equal(result.ok, false); assert.equal(result.code, 'SOURCE_READER_CLOSE_FAILED');
  assert.equal('doc' in result, false);
});

test('a read opened after cancellation is closed when its delayed native receipt arrives', async t => {
  const f = fixture(t, 'private'), controller = new AbortController(); const open = f.bridge.openRead;
  let release, entered; const gate = new Promise(resolve => { release = resolve; });
  const opening = new Promise(resolve => { entered = resolve; });
  f.bridge.openRead = async () => { entered(); await gate; return open(); };
  const loading = f.load({ signal: controller.signal }); await opening;
  controller.abort(); const result = await loading; assert.equal(result.code, 'SOURCE_LOAD_CANCELLED');
  release(); await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(f.closes(), 1, 'late native read still owns a slot after cancelled loader');
});

test('native read refusal remains an attributed error, without a partial document', async t => {
  const f = fixture(t, 'private'); f.bridge.openRead = async () => ({ ok: false, code: 'SOURCE_READER_BUDGET' });
  const result = await f.load(); assert.equal(result.ok, false); assert.equal(result.code, 'SOURCE_READER_BUDGET');
  assert.equal('doc' in result, false); assert.equal(f.closes(), 0);
});

test('the captured source identity cannot be changed by a bridge adapter', async t => {
  const f = fixture(t, 'private'), open = f.bridge.openRead, read = f.bridge.readChunk;
  f.bridge.openRead = async request => { request.sourceId = 'foreign'; return { ...await open(), sourceId: 'foreign' }; };
  f.bridge.readChunk = async request => ({ ...await read(request), sourceId: 'foreign' });
  const result = await f.load();
  assert.equal(result.ok, false); assert.equal('doc' in result, false);
  assert.equal(f.ref.sourceId, 'source-one');
});

test('a bridge cannot rewrite the expected close identity and acknowledge a different read', async t => {
  const f = fixture(t, 'private');
  f.bridge.closeRead = async request => {
    request.readId = 'foreign-read'; request.sourceId = 'foreign'; request.version = 2;
    return { ok: true, ...request };
  };
  const result = await f.load(); assert.equal(result.ok, false); assert.equal(result.code, 'SOURCE_READER_CLOSE_FAILED');
  assert.equal('doc' in result, false);
});
