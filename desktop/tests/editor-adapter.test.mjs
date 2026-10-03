import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { history, undo, redo } from '@codemirror/commands';
import { Text } from '@codemirror/state';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { sourceClient } from '../src/ui/code/source-client.js';

const adapter = await import('../src/ui/code/editor-adapter.js').catch(e => {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e; return {};
});
test('Code editor persistence adapter exists', () => assert.equal(typeof adapter.createEditorAdapter, 'function'));
const check = (name, fn) => test(name, { skip: !adapter.createEditorAdapter }, fn);
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
async function fixture(t, text = '\ufeffa😀b\r\nc\nd\rbare', readonly = false) {
  const root = await mkdtemp(join(tmpdir(), 'siren-editor-adapter-')); t.after(() => rm(root, { recursive: true, force: true }));
  const projectId = (await new ProjectStore(root).createProject({ label: 'Editor', json: '{}' })).project.id;
  const repo = new SourceRepository(root), ref = await repo.importSource({ projectId, bytes: Buffer.from(text) }), readers = new Map();
  let beforeEdit = async () => {}, beforeOpen = async () => {}, commits = 0, edits = 0;
  const bridge = {
    getMetrics: async request => { const { provenance, ...info } = await repo.getMetrics({ projectId, ...request }); return { ok: true, ...info }; },
    readRange: async request => ({ ok: true, ...request, text: await repo.readRange({ projectId, ...request }) }),
    applyEdit: async request => { edits++; const refusal = await beforeEdit(request); return refusal || repo.applyEdit({ projectId, edit: request }); },
    commitSource: request => { commits++; return repo.commitSource({ projectId, ...request }); },
    openRead: async request => { await beforeOpen(); const readId = randomUUID(), reader = await repo.openReader({ projectId, ...request }); readers.set(readId, reader); return { ok: true, readId, ...reader.info }; },
    readChunk: async request => ({ ok: true, readId: request.readId, ...await readers.get(request.readId).readChunk(request) }),
    closeRead: async request => { readers.get(request.readId)?.dispose(); readers.delete(request.readId); return { ok: true, ...request }; }
  };
  const client = sourceClient({ bridge, sourceRef: ref }), editor = adapter.createEditorAdapter({ client, readonly, extensions: [history()] });
  t.after(() => { editor.dispose(); client.dispose(); for (const reader of readers.values()) reader.dispose(); });
  return { editor, client, repo, projectId, ref, text, edits: () => edits, commits: () => commits,
    delayEdit: fn => { beforeEdit = fn; }, delayOpen: fn => { beforeOpen = fn; },
    export: version => repo.exportSource({ projectId, sourceId: ref.sourceId, version }) };
}

check('verified CM document and LF transaction parsing preserve BOM, literal CR and source offsets', async t => {
  const f = await fixture(t); assert.equal((await f.editor.open(f.ref)).ok, true);
  assert.equal(f.editor.getState().doc.toString('\n'), f.text);
  assert.equal(f.editor.dispatch({ changes: { from: 6, to: 7, insert: 'X\r\nY' } }).ok, true);
  const expected = '\ufeffa😀b\rX\r\nYc\nd\rbare';
  assert.equal(f.editor.getState().doc.toString('\n'), expected);
  const saved = await f.editor.flush(); assert.equal(saved.ok, true); assert.equal(saved.durability, 'committed');
  assert.deepEqual(await f.export(saved.version), Buffer.from(expected));
});

check('one multi-range transaction persists shifted UTF16 offsets in order and advances each receipt', async t => {
  const f = await fixture(t, 'a😀b\ncdef'); await f.editor.open(f.ref);
  assert.equal(f.editor.dispatch({ changes: [{ from: 0, to: 1, insert: 'START' }, { from: 6, to: 8, insert: 'Ω' }] }).ok, true);
  const saved = await f.editor.flush(); assert.equal(saved.ok, true); assert.equal(saved.version, 3);
  assert.equal(f.editor.getState().doc.toString('\n'), 'START😀b\ncΩf');
  assert.deepEqual(await f.export(3), Buffer.from('START😀b\ncΩf'));
});

check('flush awaits actual in-flight durable edits, blocks new edits and coalesces callers', async t => {
  const f = await fixture(t, 'abc'); await f.editor.open(f.ref);
  const entered = deferred(), gate = deferred(); f.delayEdit(() => { entered.resolve(); return gate.promise; });
  f.editor.dispatch({ changes: { from: 3, insert: '!' } }); await entered.promise;
  const saving = f.editor.flush(); assert.equal(f.editor.flush(), saving);
  assert.equal(f.editor.dispatch({ changes: { from: 0, insert: '?' } }).code, 'EDITOR_SAVING');
  assert.equal(f.commits(), 0); gate.resolve();
  const saved = await saving; assert.equal(saved.ok, true); assert.equal(saved.version, 2);
  assert.deepEqual(await f.export(2), Buffer.from('abc!')); assert.equal(f.commits(), 1);
});

check('a native edit refusal retains every local edit, fences subsequent edits and never commits', async t => {
  const f = await fixture(t, 'abc'); await f.editor.open(f.ref);
  f.delayEdit(() => ({ ok: false, code: 'REVISION_CONFLICT' }));
  f.editor.dispatch({ changes: { from: 3, insert: '!' } });
  const receipt = await f.editor.flush(); assert.equal(receipt.code, 'REVISION_CONFLICT');
  assert.equal(f.editor.getState().doc.toString('\n'), 'abc!');
  assert.equal(f.editor.dispatch({ changes: { from: 0, insert: '?' } }).code, 'EDITOR_FENCED');
  assert.deepEqual(await f.export(1), Buffer.from('abc')); assert.equal(f.commits(), 0);
  assert.equal((await f.editor.open(f.ref)).code, 'EDITOR_DIRTY');
});

check('split emoji and malformed insert are refused before changing document or native source', async t => {
  const f = await fixture(t, 'a😀b'); await f.editor.open(f.ref);
  assert.equal(f.editor.dispatch({ changes: { from: 2, insert: 'X' } }).code, 'INVALID_UNICODE');
  assert.equal(f.editor.dispatch({ changes: { from: 0, insert: '\ud800' } }).code, 'INVALID_UNICODE');
  assert.equal(f.editor.getState().doc.toString('\n'), 'a😀b'); assert.equal(f.edits(), 0);
});

check('readonly state rejects changes but permits selection without durable writes', async t => {
  const f = await fixture(t, 'abc', true); await f.editor.open(f.ref);
  assert.equal(f.editor.dispatch({ changes: { from: 3, insert: '!' } }).code, 'EDITOR_READONLY');
  assert.equal(f.editor.dispatch({ selection: { anchor: 2 } }).ok, true);
  assert.equal(f.editor.getState().selection.main.anchor, 2); assert.equal(f.edits(), 0);
  assert.equal((await f.editor.flush()).code, 'EDITOR_READONLY');
});

check('native receipt after client reset cannot mark retained optimistic text as saved', async t => {
  const f = await fixture(t, 'abc'); await f.editor.open(f.ref);
  f.client.subscribeSource(event => { if (event.type === 'draft') f.client.reset(f.ref); });
  f.editor.dispatch({ changes: { from: 3, insert: '!' } });
  const saved = await f.editor.flush(); assert.equal(saved.ok, false); assert.equal(saved.code, 'EDITOR_IDENTITY_CHANGED');
  assert.equal(f.editor.getState().doc.toString('\n'), 'abc!'); assert.equal(f.commits(), 0);
});

check('disposal aborts in-flight open and cannot resurrect an editor document', async t => {
  const f = await fixture(t, 'abc'), entered = deferred(), gate = deferred();
  f.delayOpen(() => { entered.resolve(); return gate.promise; });
  const loading = f.editor.open(f.ref); await entered.promise; f.editor.dispose(); gate.resolve();
  const result = await loading; assert.equal(result.code, 'EDITOR_DISPOSED'); assert.equal(f.editor.getState(), null);
});

check('real history undo and redo persist the complete expected source through native receipts', async t => {
  const f = await fixture(t, 'abc'); await f.editor.open(f.ref);
  f.editor.dispatch({ changes: { from: 3, insert: '😀' } });
  const target = () => ({ state: f.editor.getState(), dispatch: transaction => f.editor.applyTransaction(transaction) });
  assert.equal(undo(target()), true); assert.equal(f.editor.getState().doc.toString('\n'), 'abc');
  assert.equal(redo(target()), true); assert.equal(f.editor.getState().doc.toString('\n'), 'abc😀');
  const saved = await f.editor.flush(); assert.equal(saved.ok, true); assert.equal(saved.version, 4);
  assert.deepEqual(await f.export(4), Buffer.from('abc😀'));
});

for (const action of ['reset', 'dispose']) {
  check(`open completion observer ${action} cannot publish an obsolete success`, async t => {
    const f = await fixture(t, 'abc');
    f.editor.subscribe(status => {
      if (status.ready && !status.opening) {
        if (action === 'dispose') f.editor.dispose();
        else f.client.reset({ ...f.ref, sha256: 'a'.repeat(64) });
      }
    });
    const opened = await f.editor.open(f.ref);
    assert.equal(opened.ok, false); assert.equal(opened.code, action === 'dispose' ? 'EDITOR_DISPOSED' : 'EDITOR_IDENTITY_CHANGED');
  });
  check(`flush completion observer ${action} preserves the commit but refuses obsolete UI success`, async t => {
    const f = await fixture(t, 'abc'); await f.editor.open(f.ref);
    f.editor.dispatch({ changes: { from: 3, insert: '!' } });
    f.editor.subscribe(status => {
      if (status.durability === 'committed' && !status.saving) {
        if (action === 'dispose') f.editor.dispose();
        else f.client.reset(f.ref);
      }
    });
    const saved = await f.editor.flush();
    assert.equal(saved.ok, false); assert.equal(saved.code, action === 'dispose' ? 'EDITOR_DISPOSED' : 'EDITOR_IDENTITY_CHANGED');
    assert.deepEqual(await f.export(2), Buffer.from('abc!'));
  });
}

check('a final-size-valid transaction refuses an over-budget intermediate native source before any prefix', async () => {
  const text = 'a'.repeat(32 * 1024 * 1024), doc = Text.of([text]); let writes = 0;
  const ref = { sourceId: 'capacity-source', version: 1, sha256: 'a'.repeat(64) };
  const client = {
    getState: () => ref,
    loadDocument: async () => ({ ok: true, ...ref, doc, metrics: { utf16Units: text.length, utf8Bytes: text.length } }),
    applyEdit: async () => { writes++; return { ok: false, code: 'SOURCE_BUDGET' }; },
    commitSource: async () => ({ ok: false, code: 'SOURCE_BUDGET' })
  };
  const editor = adapter.createEditorAdapter({ client }); await editor.open(ref);
  const result = editor.dispatch({ changes: [{ from: 0, insert: '!' }, { from: doc.length - 1, to: doc.length, insert: '' }] });
  await Promise.resolve(); assert.equal(result.code, 'SOURCE_TOO_LARGE'); assert.equal(writes, 0);
  assert.equal(editor.getState().doc, doc); editor.dispose();
});

check('client disposal by the first completed-status observer suppresses later ready notifications', async t => {
  const f = await fixture(t, 'abc'); let lateReady = 0;
  f.editor.subscribe(status => { if (status.ready && !status.opening && !status.fenced) f.client.dispose(); });
  f.editor.subscribe(status => { if (status.ready && !status.opening && !status.fenced) lateReady++; });
  const opened = await f.editor.open(f.ref);
  assert.equal(lateReady, 0); assert.equal(opened.code, 'EDITOR_IDENTITY_CHANGED');
});

check('failed source loading exposes its refusal status without falsely announcing a ready document', async t => {
  const f = await fixture(t, 'abc'); f.delayOpen(() => { throw new Error('Owned transport unavailable'); });
  const opened = await f.editor.open(f.ref);
  assert.equal(opened.ok, false); assert.equal(f.editor.getState(), null);
  assert.equal(f.editor.getStatus().ready, false); assert.equal(f.editor.getStatus().code, opened.code);
  assert.equal(f.edits(), 0); assert.equal(f.commits(), 0);
});
