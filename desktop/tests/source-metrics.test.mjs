import test from 'node:test';
import assert from 'node:assert/strict';
import { measureSource } from '../src/sources/metrics.mjs';

test('metrics distinguish UTF-8 bytes, UTF-16 offsets and CRLF line width', () => {
  assert.deepEqual(measureSource('\uFEFFa😀b\r\nc\ré\n'), {
    utf8Bytes: 16, utf16Units: 11, lines: 4, longestLineUnits: 5,
  });
});

test('empty and unterminated long lines count without adding terminator width', () => {
  assert.deepEqual(measureSource(''), { utf8Bytes: 0, utf16Units: 0, lines: 1, longestLineUnits: 0 });
  assert.deepEqual(measureSource('aa\r\nbbb'), { utf8Bytes: 7, utf16Units: 7, lines: 2, longestLineUnits: 3 });
});

test('metrics refuse unpaired surrogate input rather than replacement encoding', () => {
  for (const text of ['\uD800', '\uDC00', 'a\uD800b']) {
    assert.throws(() => measureSource(text), { code: 'INVALID_UNICODE' });
  }
});
