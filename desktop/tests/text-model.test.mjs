import test from 'node:test';
import assert from 'node:assert/strict';
import { TextModel } from '../src/sources/text-model.mjs';

const edit = (operationId, expectedVersion, start, end, insertedText, sourceId = 's1') =>
  ({ operationId, sourceId, expectedVersion, start, end, insertedText });

test('beginning, middle and EOF edits preserve exact BOM, emoji and CRLF', () => {
  const model = new TextModel({ text: '\uFEFFa😀b\r\nc', version: 3, sourceId: 's1' });
  assert.equal(model.apply(edit('begin', 3, 1, 1, '!')).version, 4);
  const middle = model.apply(edit('middle', 4, 3, 5, 'é'));
  assert.equal(middle.ok, true);
  assert.deepEqual(middle.inverse, { start: 3, end: 4, insertedText: '😀' });
  assert.equal(model.apply(edit('end', 5, 8, 8, '\n')).version, 6);
  assert.equal(model.text, '\uFEFF!aéb\r\nc\n');
  assert.deepEqual(model.metrics, { utf8Bytes: 12, utf16Units: 9, lines: 3, longestLineUnits: 5 });
  assert.equal(model.readRange(6, 2, 5), 'aéb');
});

test('duplicate identity returns original result and changed payload refuses reuse', () => {
  const model = new TextModel({ text: 'abc', version: 0, sourceId: 's1' });
  const operation = edit('one', 0, 1, 2, 'X');
  const first = model.apply(operation);
  assert.deepEqual(model.apply({ ...operation }), first);
  assert.equal(model.text, 'aXc');
  assert.equal(model.apply({ ...operation, insertedText: 'Y' }).code, 'OPERATION_ID_REUSE');
  assert.equal(model.apply(edit('stale', 0, 0, 0, 'z')).code, 'REVISION_CONFLICT');
  assert.equal(model.version, 1);
});

test('invalid UTF-16 boundaries, unpaired insertions and invalid ranges leave state unchanged', () => {
  const model = new TextModel({ text: 'a😀b\r\nc', version: 1, sourceId: 's1' });
  for (const [id, start, end, text, code] of [
    ['split-start', 2, 3, '', 'INVALID_UNICODE'],
    ['split-end', 1, 2, '', 'INVALID_UNICODE'],
    ['unpaired', 0, 0, '\uD800', 'INVALID_UNICODE'],
    ['negative', -1, 0, '', 'INVALID_RANGE'],
    ['fraction', 0.5, 1, '', 'INVALID_RANGE'],
    ['past-end', 0, 9, '', 'INVALID_RANGE'],
    ['backwards', 3, 1, '', 'INVALID_RANGE'],
  ]) assert.equal(model.apply(edit(id, 1, start, end, text)).code, code);
  assert.equal(model.apply(edit('wrong-source', 1, 0, 0, '', 's2')).code, 'SOURCE_MISMATCH');
  assert.equal(model.text, 'a😀b\r\nc');
  assert.equal(model.version, 1);
  assert.throws(() => model.readRange(0, 0, 1), { code: 'REVISION_CONFLICT' });
  assert.throws(() => model.readRange(1, 1, 2), { code: 'INVALID_UNICODE' });
  assert.throws(() => new TextModel({ text: '\uDC00', version: 1 }), { code: 'INVALID_UNICODE' });
});

test('validate prepares an inverse without consuming operation identity or mutating state', () => {
  const model = new TextModel({ text: 'one\r\ntwo', version: 5, sourceId: 's1' });
  const operation = edit('preview', 5, 0, 3, '😀');
  const preview = model.validate(operation);
  assert.equal(preview.ok, true);
  assert.equal(preview.version, 6);
  assert.equal(model.text, 'one\r\ntwo');
  assert.equal(model.version, 5);
  assert.deepEqual(model.apply(operation), preview);
});

test('undo and redo use unique action IDs with monotonic versions and clear redo on branch', () => {
  const model = new TextModel({ text: 'a😀b\r\nc', version: 0, sourceId: 's1' });
  model.apply(edit('replace', 0, 1, 3, 'XY'));
  const undo = model.undo('undo-1');
  assert.equal(undo.version, 2);
  assert.equal(model.text, 'a😀b\r\nc');
  assert.deepEqual(model.undo('undo-1'), undo);
  assert.equal(model.redo('redo-1').version, 3);
  assert.equal(model.text, 'aXYb\r\nc');
  model.undo('undo-2');
  model.apply(edit('branch', 4, 0, 1, 'A'));
  assert.equal(model.redo('redo-after-branch').code, 'NOTHING_TO_REDO');
  assert.equal(model.undo('replace').code, 'OPERATION_ID_REUSE');
});

test('history budget retains recent operations and refuses undo once older entries are evicted', () => {
  const model = new TextModel({ text: 'x'.repeat(100000), version: 0, sourceId: 's1', historyBytes: 8 });
  model.apply(edit('a', 0, 0, 1, '😀'));
  model.apply(edit('b', 1, 2, 3, 'é'));
  assert.equal(model.undo('u1').ok, true);
  assert.equal(model.text.slice(0, 4), '😀xx');
  assert.equal(model.undo('u2').ok, true);
  assert.equal(model.text.slice(0, 3), 'xxx');
  assert.equal(model.undo('u3').code, 'NOTHING_TO_UNDO');
  const tiny = new TextModel({ text: 'abc', version: 0, sourceId: 's1', historyBytes: 2 });
  tiny.apply(edit('large', 0, 0, 3, 'def'));
  assert.equal(tiny.undo('cannot').code, 'NOTHING_TO_UNDO');
  assert.equal(tiny.text, 'def');
});

test('unique no-op edits advance journal versions without adding undo history', () => {
  const model = new TextModel({ text: 'abc', version: 2, sourceId: 's1' });
  const result = model.apply(edit('same', 2, 1, 2, 'b'));
  assert.equal(result.version, 3);
  assert.equal(result.textChanged, false);
  assert.deepEqual(model.apply(edit('same', 2, 1, 2, 'b')), result);
  assert.equal(model.undo('nothing').code, 'NOTHING_TO_UNDO');
});

test('returned inverses cannot mutate retained history', () => {
  const model = new TextModel({ text: 'abc', sourceId: 's1' });
  const result = model.apply(edit('replace', 0, 1, 2, 'X'));
  result.inverse.insertedText = 'corrupted';
  result.inverse.start = 0;
  model.undo('undo');
  assert.equal(model.text, 'abc');
});

test('malformed numeric and source payloads return typed refusal without throwing', () => {
  const model = new TextModel({ text: 'abc', sourceId: 's1' });
  for (const payload of [
    { ...edit('big-version', 0, 0, 0, ''), expectedVersion: 1n },
    { ...edit('big-offset', 0, 0, 0, ''), start: 1n },
    { ...edit('bad-source', 0, 0, 0, ''), sourceId: { circular: null } },
    { ...edit('no-id', 0, 0, 0, ''), operationId: '' },
  ]) assert.equal(model.apply(payload).ok, false);
  assert.equal(model.text, 'abc');
  assert.equal(model.version, 0);
});

test('line metrics update when edits join CRLF boundaries and remove longest lines', () => {
  const model = new TextModel({ text: 'ab\rX\nlongest\r\ntail', version: 0, sourceId: 's1' });
  model.apply(edit('join', 0, 3, 4, ''));
  assert.deepEqual(model.metrics, { utf8Bytes: 17, utf16Units: 17, lines: 3, longestLineUnits: 7 });
  model.apply(edit('shorten', 1, 4, 11, 'z'));
  assert.equal(model.text, 'ab\r\nz\r\ntail');
  assert.deepEqual(model.metrics, { utf8Bytes: 11, utf16Units: 11, lines: 3, longestLineUnits: 4 });
  model.undo('restore');
  assert.equal(model.metrics.longestLineUnits, 7);
});

test('all short newline boundary edits retain exact text and independently derived metrics', () => {
  const fixtures = ['', '\r', '\n', '\r\n', 'a\r\nb', '\r\r\n\n', 'a\n\rbc', '😀\r\n\uFEFFé'];
  const insertions = ['', 'z', '\r', '\n', '\r\n', '😀\nx'];
  let serial = 0;
  for (const text of fixtures) {
    for (let start = 0; start <= text.length; start += 1) {
      for (let end = start; end <= text.length; end += 1) {
        if (!text.slice(0, start).isWellFormed() || !text.slice(end).isWellFormed()) continue;
        for (const insertedText of insertions) {
          const model = new TextModel({ text, version: 0, sourceId: 's1' });
          const wanted = text.slice(0, start) + insertedText + text.slice(end);
          const lines = wanted.split(/\r\n|\r|\n/);
          assert.equal(model.apply(edit(`matrix-${++serial}`, 0, start, end, insertedText)).ok, true);
          assert.equal(model.text, wanted);
          assert.deepEqual(model.metrics, {
            utf8Bytes: Buffer.from(wanted, 'utf8').length, utf16Units: wanted.length,
            lines: lines.length, longestLineUnits: Math.max(...lines.map(line => line.length)),
          }, `fixture ${JSON.stringify(text)} range ${start}:${end} insertion ${JSON.stringify(insertedText)}`);
        }
      }
    }
  }
});

test('repeated long-line edits and undo preserve widths and bytes without snapshot histories', () => {
  const text = 'a'.repeat(2 * 1024 * 1024) + '\r\nend';
  const model = new TextModel({ text, version: 0, sourceId: 's1', historyBytes: 1024 });
  for (let i = 0; i < 100; i += 1) model.apply(edit(`long-${i}`, i, 100000 + i, 100001 + i, 'é'));
  assert.equal(model.metrics.utf8Bytes, 2097257);
  assert.equal(model.metrics.longestLineUnits, 2097152);
  assert.equal(model.readRange(100, 100000, 100100), 'é'.repeat(100));
  for (let i = 0; i < 100; i += 1) model.undo(`undo-long-${i}`);
  assert.equal(model.text, text);
  assert.equal(model.version, 200);
});

test('mixed repeated Unicode and newline edits match an independent string oracle', () => {
  const initial = '\uFEFFone😀\r\ntwo\nthree\rfour';
  const model = new TextModel({ text: initial, sourceId: 's1' });
  let wanted = initial;
  let seed = 421;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const insertions = ['z', '😀', '', '\r\n', '\n', '\r', 'é\nabc', '\uFEFF'];
  let changes = 0;
  for (let i = 0; i < 400; i += 1) {
    const boundaries = [0];
    for (const character of wanted) boundaries.push(boundaries.at(-1) + character.length);
    const first = next() % boundaries.length;
    const second = next() % boundaries.length;
    const start = boundaries[Math.min(first, second)], end = boundaries[Math.max(first, second)];
    const insertedText = insertions[next() % insertions.length];
    const replacement = wanted.slice(0, start) + insertedText + wanted.slice(end);
    if (replacement !== wanted) changes += 1;
    assert.equal(model.apply(edit(`random-${i}`, i, start, end, insertedText)).ok, true);
    wanted = replacement;
    const lines = wanted.split(/\r\n|\r|\n/);
    assert.equal(model.text, wanted);
    assert.deepEqual(model.metrics, { utf8Bytes: Buffer.from(wanted).length,
      utf16Units: wanted.length, lines: lines.length,
      longestLineUnits: Math.max(...lines.map(line => line.length)) });
  }
  for (let i = 0; i < changes; i += 1) assert.equal(model.undo(`random-undo-${i}`).ok, true);
  assert.equal(model.text, initial);
});

test('exhausted versions refuse changes and evicted history still remembers operation identity', () => {
  const exhausted = new TextModel({ text: 'abc', version: Number.MAX_SAFE_INTEGER, sourceId: 's1' });
  assert.equal(exhausted.apply(edit('overflow', Number.MAX_SAFE_INTEGER, 0, 0, 'x')).code, 'VERSION_EXHAUSTED');
  assert.equal(exhausted.text, 'abc');
  const model = new TextModel({ text: 'abc', sourceId: 's1', historyBytes: 0 });
  const operation = edit('not-retained', 0, 0, 1, 'X');
  const first = model.apply(operation);
  const duplicate = model.apply(operation);
  assert.equal(duplicate.version, first.version);
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.inverse, null);
  assert.equal(model.apply({ ...operation, expectedVersion: 1 }).code, 'OPERATION_ID_REUSE');
  assert.equal(model.text, 'Xbc');
});
