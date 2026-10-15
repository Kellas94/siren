import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Text, Transaction, EditorSelection, EditorState } from '@codemirror/state';
import { history } from '@codemirror/commands';
import { sourceUndo as undo, sourceRedo as redo } from '../src/ui/code/source-newlines.js';
import { SearchCursor, RegExpCursor } from '@codemirror/search';
import { TextModel } from '../src/sources/text-model.mjs';
import { SourceReaderPool } from '../src/sources/readers.mjs';
import { loadSource } from '../src/ui/code/source-loader.js';
import { createEditorAdapter } from '../src/ui/code/editor-adapter.js';

const sha = text => createHash('sha256').update(Buffer.from(text)).digest('hex');
const projected = text => text.replace(/\r(?!\n)/g, '\n');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
async function fixture(t, original) {
  const sourceId = 'newline-fixture', model = new TextModel({ text: original, version: 1, sourceId }), pool = new SourceReaderPool();
  let ref = { sourceId, version: 1, sha256: sha(original) }, reader, closes = 0, edits = [], commits = [], gate = async () => {};
  const initial = ref;
  const bridge = {
    openRead: async () => { reader = await pool.open({ guard: () => {}, load: async () => ({ model, ref: { ...ref, ...model.metrics, encoding: 'utf8', bom: original.startsWith('\ufeff'), newline: 'mixed' } }) }); return { ok: true, readId: 'newline-reader', ...reader.info }; },
    readChunk: async request => ({ ok: true, readId: 'newline-reader', ...await reader.readChunk(request) }),
    closeRead: async request => { reader.dispose(); closes++; return { ok: true, ...request }; }
  };
  const client = {
    getState: () => ({ ...ref, disposed: false, fenced: false }),
    loadDocument: options => loadSource({ bridge, sourceRef: ref, ...options }),
    applyEdit: async request => { await gate(); edits.push({ ...request }); const result = model.apply(request); assert.equal(result.ok, true, 'exact raw primitive must be admitted by the native TextModel'); ref = { sourceId, version: model.version, sha256: sha(model.text) }; return { ok: true, ...ref, operationId: request.operationId, durability: 'draft' }; },
    commitSource: async request => { commits.push({ ...request }); assert.equal(request.expectedVersion, model.version); return { ok: true, ...ref, operationId: request.operationId, durability: 'committed' }; }
  };
  const editor = createEditorAdapter({ client, extensions: [history(), EditorState.allowMultipleSelections.of(true)] });
  t.after(() => { editor.dispose(); pool.dispose(); });
  assert.equal((await editor.open(initial)).ok, true);
  return { editor, model, initial, edits, commits, closes: () => closes, gate: fn => { gate = fn; } };
}
function exact(f, expected) {
  assert.equal(f.editor.getSourceText().toString('\n'), expected, 'explicit raw source serialization');
  assert.equal(f.editor.getState().doc.toString('\n'), projected(expected), 'standard CM line projection');
  assert.equal(f.editor.getState().doc.length, expected.length);
  assert.equal(f.editor.getStatus().utf16Units, expected.length);
  assert.equal(f.editor.getStatus().utf8Bytes, Buffer.byteLength(expected));
  assert.equal(f.editor.getStatus().lines, expected.split(/\r\n|\r|\n/).length);
}
const target = editor => ({ state: editor.getState(), dispatch: transaction => { assert.equal(editor.applyTransaction(transaction).ok, true); } });

test('bare CR and mixed lines agree with native metrics at exact source offsets', async t => {
  for (const text of ['def first():\r    pass\rdef second():\r    pass', 'a\rb\nc\r\nd', '\ufeff😀\rȘ\nΩ\r\nx\r']) {
    const f = await fixture(t, text), doc = f.editor.getState().doc;
    assert.equal(doc.lines, text.split(/\r\n|\r|\n/).length, 'CodeMirror universal line count');
    exact(f, text); assert.equal(f.closes(), 1); assert.equal(f.editor.getStatus().sourceRef.sha256, sha(text));
    let line = 1; for (const match of text.matchAll(/\r\n|\r|\n/g)) { line++; assert.equal(doc.lineAt(match.index + match[0].length).number, line); }
  }
});

test('LF and CRLF retain the verified CM document identity and exact hash', async t => {
  for (const text of ['a\nb\n', 'a\r\nb\r\n']) { const f = await fixture(t, text); exact(f, text); assert.equal(f.editor.getSourceText(), f.editor.getState().doc); const saved = await f.editor.flush(); assert.equal(saved.sha256, sha(text)); }
});

test('bare CR and CRLF across the 131072-unit reader boundary retain exact bytes', async t => {
  for (const tail of ['\r\nb\rc', '\rb\r\nc']) { const text = '\ufeff' + 'a'.repeat(131070) + tail + '😀\rȘ', f = await fixture(t, text); exact(f, text); assert.equal(f.editor.getStatus().sourceRef.sha256, sha(text)); }
});

test('actual state.update/applyTransaction handles paste and IME newline insertions from LF source', async t => {
  const f = await fixture(t, 'start\nend'); let expected = 'start\nend';
  for (const [at, insert, event] of [[5, '\r😀\r\nȘ\n', 'input.paste'], [0, 'Ω\r', 'input.type.compose']]) {
    const transaction = f.editor.getState().update({ changes: { from: at, insert }, selection: EditorSelection.single(at + insert.length), annotations: Transaction.userEvent.of(event) });
    assert.equal(f.editor.applyTransaction(transaction).ok, true); expected = expected.slice(0, at) + insert + expected.slice(at); exact(f, expected);
  }
  const receipt = await f.editor.flush(); assert.equal(receipt.sha256, sha(expected)); assert.equal(f.model.text, expected);
});

test('newline boundary deletions and replacements preserve CRLF/raw primitives', async t => {
  const f = await fixture(t, 'a\r\nb\rc\nd'); let expected = 'a\r\nb\rc\nd';
  for (const edit of [{ from: 2, to: 3, insert: '' }, { from: 1, insert: '\n' }, { from: 2, to: 5, insert: '😀\r' }, { from: 0, to: 0, insert: '\r\n' }]) {
    assert.equal(f.editor.dispatch({ changes: edit }).ok, true); expected = expected.slice(0, edit.from) + edit.insert + expected.slice(edit.to ?? edit.from); exact(f, expected);
  }
  const receipt = await f.editor.flush(); assert.equal(f.model.text, expected); assert.equal(receipt.sha256, sha(expected));
});

test('multi-range edits and queued Save use exact raw UTF16 offsets and SHA receipts', async t => {
  const f = await fixture(t, 'a😀\rb\nc\r\nd'), entered = deferred(), release = deferred();
  f.gate(() => { entered.resolve(); return release.promise; });
  assert.equal(f.editor.dispatch({ changes: [{ from: 0, to: 1, insert: 'Ω\r' }, { from: 5, to: 6, insert: '\r\n' }] }).ok, true);
  const expected = 'Ω\r😀\rb\r\nc\r\nd'; exact(f, expected); await entered.promise;
  const saving = f.editor.flush(); assert.equal(f.editor.getStatus().sourceRef.version, 1); assert.equal(f.commits.length, 0); release.resolve();
  const receipt = await saving; assert.equal(receipt.ok, true); assert.equal(receipt.sha256, sha(expected)); assert.equal(f.model.text, expected);
  assert.deepEqual(f.edits.map(({ start, end, insertedText }) => ({ start, end, insertedText })), [{ start: 0, end: 1, insertedText: 'Ω\r' }, { start: 6, end: 7, insertedText: '\r\n' }]);
});

test('merged history restores raw newline kinds including visually identical CR to LF', async t => {
  for (const [original, changes] of [
    ['a\rb', [{ from: 1, to: 2, insert: '' }, { from: 1, insert: '\n' }]],
    ['a\rb', [{ from: 1, to: 2, insert: '\n' }]],
    ['b\n\n\r\ra', [{ from: 0, to: 4, insert: '\r' }, { from: 0, to: 3, insert: '' }, { from: 0, insert: 'a' }]],
    ['a\r\nb\rc', [{ from: 2, to: 3, insert: '' }, { from: 1, to: 2, insert: '\n' }]],
    ['a\rb\nc\r\nd', [{ from: 1, to: 6, insert: 'X\r\nY\rZ' }, { from: 2, to: 3, insert: '\n' }]]
  ]) { const f = await fixture(t, original); let expected = original;
    for (const edit of changes) { assert.equal(f.editor.dispatch({ changes: edit, annotations: Transaction.userEvent.of('input.type') }).ok, true); expected = expected.slice(0, edit.from) + edit.insert + expected.slice(edit.to ?? edit.from); exact(f, expected); }
    assert.equal(undo(target(f.editor)), true); exact(f, original); assert.equal(redo(target(f.editor)), true); exact(f, expected);
    const receipt = await f.editor.flush(); assert.equal(f.model.text, expected); assert.equal(receipt.sha256, sha(expected));
  }
});

test('history mapping retains an unrelated non-history raw edit', async t => {
  const f = await fixture(t, 'a\rb'); f.editor.dispatch({ changes: { from: 0, to: 1, insert: 'A' }, userEvent: 'input.type' });
  f.editor.dispatch({ changes: { from: 2, to: 3, insert: 'B' }, annotations: Transaction.addToHistory.of(false) });
  assert.equal(undo(target(f.editor)), true); exact(f, 'a\rB'); assert.equal(redo(target(f.editor)), true); exact(f, 'A\rB'); await f.editor.flush(); assert.equal(f.model.text, 'A\rB');
});

test('ordinary content search and cursor selections preserve raw source offsets', async t => {
  const text = '\ufeffa😀\rb\nc\r\nd', f = await fixture(t, text), doc = f.editor.getState().doc;
  for (const term of ['a😀', 'b', 'd']) { const cursor = new SearchCursor(doc, term); cursor.next(); assert.equal(cursor.value.from, text.indexOf(term)); assert.equal(cursor.value.to, text.indexOf(term) + term.length); f.editor.dispatch({ selection: { anchor: cursor.value.from, head: cursor.value.to } }); assert.equal(f.editor.getState().selection.main.from, text.indexOf(term)); }
  const rawCursor = new SearchCursor(f.editor.getSourceText(), 'c\r\nd'); rawCursor.next(); assert.equal(rawCursor.value.from, text.indexOf('c'));
  const regex = new RegExpCursor(doc, '^d$'); regex.next(); assert.equal(regex.value.from, text.indexOf('d')); exact(f, text);
  assert.deepEqual(Text.of(doc.toJSON()).toJSON(), doc.toJSON());
});

test('filter:false cannot persist unprojected CR input and malformed Unicode remains refused', async t => {
  const f = await fixture(t, 'a😀\rb');
  const before = f.editor.getState();
  assert.equal(f.editor.applyTransaction(before.update({ changes: { from: 0, insert: '\r' }, filter: false })).code, 'INVALID_TRANSACTION');
  assert.equal(f.editor.getState(), before); assert.equal(f.edits.length, 0);
  assert.equal(f.editor.dispatch({ changes: { from: 2, insert: 'X' } }).code, 'INVALID_UNICODE');
  assert.equal(f.editor.dispatch({ changes: { from: 0, insert: '\ud800' } }).code, 'INVALID_UNICODE');
  exact(f, 'a😀\rb'); assert.equal(f.edits.length, 0);
});

test('the configured clipboard output facet serializes selected raw CR bytes', async t => {
  const { EditorView } = await import('@codemirror/view');
  for (const text of ['a\rb\nc\r\nd', 'a\nb\nc\nd', 'a\r\nb\r\nc\r\nd']) {
    const f = await fixture(t, text); f.editor.dispatch({ selection: { anchor: 0, head: text.length } });
    const state = f.editor.getState(), input = state.sliceDoc(0, text.length);
    const output = state.facet(EditorView.clipboardOutputFilter).reduce((value, filter) => filter(value, state), input);
    assert.equal(output, text, 'clipboard selected source must use raw Text');
  }
  const f = await fixture(t, 'a\rb\nc\r\nd');
  const output = input => { const state = f.editor.getState(); return state.facet(EditorView.clipboardOutputFilter).reduce((value, filter) => filter(value, state), input); };
  f.editor.dispatch({ selection: EditorSelection.create([EditorSelection.range(0, 2), EditorSelection.range(4, 6)]) });
  assert.equal(f.editor.getState().selection.ranges.length, 2);
  assert.equal(output('a\n\nc\r'), 'a\r\nc\r', 'raw selected ranges retain the CM synthetic LF join');
  f.editor.dispatch({ selection: { anchor: 0, head: 2 } }); assert.equal(output('a\n'), 'a\r', 'explicit line selection includes raw terminator');
  f.editor.dispatch({ selection: { anchor: 0 } }); assert.equal(output('a'), 'a', 'empty selection retains CM linewise behavior');
  assert.equal(output('previous-filter-output'), 'previous-filter-output');
});

test('short-string edits/undo/redo exhaustively preserve raw newline kinds and standard CM projection', async () => {
  const { exactSourceExtensions, getSourceText, projectSourceLines } = await import('../src/ui/code/source-newlines.js');
  let cases = 0;
  const strings = ['']; for (let width = 1, level = ['']; width <= 3; width++) { level = level.flatMap(prefix => ['a', '\r', '\n'].map(char => prefix + char)); strings.push(...level); }
  for (const original of strings) for (let from = 0; from <= original.length; from++) for (let to = from; to <= original.length; to++) for (const inserted of ['', 'X', '\r', '\n', '\r\n', '\n\r', '😀']) {
    const raw = Text.of(original.split('\n')); let state = EditorState.create({ doc: projectSourceLines(raw), extensions: [history(), EditorState.lineSeparator.of('\n'), ...exactSourceExtensions(raw)] });
    const expected = original.slice(0, from) + inserted + original.slice(to), target = () => ({ state, dispatch: transaction => { state = transaction.state; } });
    state = state.update({ changes: { from, to, insert: inserted } }).state;
    assert.equal(getSourceText(state).toString(), expected); assert.equal(state.doc.toString(), projected(expected));
    assert.equal(state.doc.length, expected.length); assert.equal(state.doc.lines, expected.split(/\r\n|\r|\n/).length);
    if (undo(target())) { assert.equal(getSourceText(state).toString(), original); assert.equal(state.doc.toString(), projected(original)); assert.equal(redo(target()), true); assert.equal(getSourceText(state).toString(), expected); }
    cases++;
  }
  assert.equal(cases, 2338);
});
