import test from 'node:test';
import assert from 'node:assert/strict';

// Dynamic import makes the initial missing component an explicit RED assertion.
const output = await import('../src/terminal/output.mjs').catch(error => ({ missing: error.code }));
test('Terminal output component exports the specified pure interfaces', () => {
  assert.equal(typeof output.createOutputRing, 'function', 'createOutputRing is missing');
  assert.equal(typeof output.VtBudgetFilter, 'function', 'VtBudgetFilter is missing');
});
const requiresOutput = { skip: !output.createOutputRing };
const text = read => read.chunks.map(chunk => chunk.data).join('');

test('ring retains an exact 4 MiB tail of a 10 MiB line and reports exact cursor gap', requiresOutput, () => {
  const ring = output.createOutputRing();
  ring.append('a'.repeat(6 * 1024 * 1024) + 'b'.repeat(4 * 1024 * 1024));
  assert.equal(ring.stats().retainedUtf8Bytes, 4 * 1024 * 1024);
  assert.equal(ring.stats().droppedUtf8Bytes, 6 * 1024 * 1024);
  assert.equal(ring.stats().firstSequence, 6 * 1024 * 1024);
  const page = ring.read({ fromSequence: 0 });
  assert.equal(text(page), 'b'.repeat(32768));
  assert.deepEqual(page.gap, {
    fromSequence: 0, resumeSequence: 6291456, droppedUtf8Bytes: 6291456,
    marker: 'Terminal history omitted: 6291456 UTF-8 bytes.', resetParser: true,
  });
  assert.equal(page.nextSequence, 6291456 + 32768);
  assert.equal(page.endSequence, 10485760);
});

test('UTF-8 deliveries never cut a scalar and resume exactly from their byte cursor', requiresOutput, () => {
  const ring = output.createOutputRing({ maxBytes: 32 });
  ring.append('😀aé漢b');
  const first = ring.read({ fromSequence: 0, maxBytes: 5 });
  assert.equal(text(first), '😀a');
  assert.equal(first.nextSequence, 5);
  const second = ring.read({ fromSequence: first.nextSequence, maxBytes: 5 });
  assert.equal(text(second), 'é漢');
  assert.equal(second.nextSequence, 10);
  assert.equal(text(ring.read({ fromSequence: 10, maxBytes: 5 })), 'b');
  assert.throws(() => ring.read({ fromSequence: 1 }), { code: 'INVALID_UTF8_CURSOR' });
  assert.equal(ring.read({ fromSequence: 0, maxBytes: 3 }).requiredBytes, 4);
});

test('small writes pack into finite blocks and saturation preserves bounded metadata', requiresOutput, () => {
  const ring = output.createOutputRing({ maxBytes: 64 });
  for (let i = 0; i < 10000; i++) ring.append('x');
  assert.ok(ring.stats().retainedUtf8Bytes <= 64);
  assert.ok(ring.stats().blockCount <= 2);
  assert.ok(ring.stats().allocatedBytes <= 128);
  const stats = ring.stats();
  assert.equal(stats.retainedUtf8Bytes + stats.droppedUtf8Bytes, 10000);
  assert.equal(stats.nextSequence, 10000);
  assert.equal(text(ring.read({ fromSequence: stats.firstSequence })), 'x'.repeat(stats.retainedUtf8Bytes));
});

test('producer keeps appending without a consumer and clear preserves sequence/gap accounting', requiresOutput, () => {
  const ring = output.createOutputRing({ maxBytes: 8 });
  ring.append('abcd'); ring.append('é😀');
  const stats = ring.stats();
  assert.ok(stats.retainedUtf8Bytes <= 8);
  assert.equal(stats.retainedUtf8Bytes + stats.droppedUtf8Bytes, 10);
  ring.clear();
  assert.equal(ring.stats().nextSequence, 10);
  assert.equal(ring.stats().retainedUtf8Bytes, 0);
  ring.append('new');
  const page = ring.read({ fromSequence: 0 });
  assert.equal(text(page), 'new');
  assert.equal(page.gap.droppedUtf8Bytes, 10);
  assert.equal(page.nextSequence, 13);
});

test('invalid options, data and future cursors refuse without changing retained output', requiresOutput, () => {
  for (const maxBytes of [0, 3, 4194305, NaN, 4.5, '8']) assert.throws(() => output.createOutputRing({ maxBytes }), { code: 'INVALID_OUTPUT_BUDGET' });
  const ring = output.createOutputRing({ maxBytes: 32 }); ring.append('safe');
  for (const input of [null, Buffer.from('x'), '\uD800']) assert.throws(() => ring.append(input));
  for (const fromSequence of [-1, 99, 0.2, NaN, '0']) assert.throws(() => ring.read({ fromSequence }), { code: 'INVALID_OUTPUT_CURSOR' });
  for (const maxBytes of [0, 32769, NaN]) assert.throws(() => ring.read({ fromSequence: 0, maxBytes }), { code: 'INVALID_DELIVERY_BUDGET' });
  assert.equal(text(ring.read({ fromSequence: 0 })), 'safe');
  assert.equal(ring.stats().nextSequence, 4);
});

test('VT filter holds a split sequence until complete and preserves ordinary ANSI/Unicode', requiresOutput, () => {
  const filter = new output.VtBudgetFilter();
  assert.equal(filter.push('before\x1b[3').data, 'before');
  assert.equal(filter.stats().pendingUtf8Bytes, 3);
  assert.equal(filter.push('1mșir😀\x1b[0m').data, '\x1b[31mșir😀\x1b[0m');
  assert.equal(filter.stats().pendingUtf8Bytes, 0);
});

test('oversized OSC is omitted across pushes through a split ST without retaining payload', requiresOutput, () => {
  const filter = new output.VtBudgetFilter();
  const first = filter.push('\x1b]52;' + 'x'.repeat(4091));
  assert.equal(first.data, ''); assert.equal(filter.stats().pendingUtf8Bytes, 4096);
  const second = filter.push('😀' + 'y'.repeat(20000));
  assert.equal(second.data, ''); assert.equal(second.omittedUtf8Bytes, 24100);
  assert.equal(second.omittedSequences, 1);
  assert.equal(filter.stats().pendingUtf8Bytes, 0);
  assert.equal(filter.stats().discarding, true);
  assert.equal(filter.push('\x1b').omittedUtf8Bytes, 1);
  const tail = filter.push('\\after');
  assert.equal(tail.omittedUtf8Bytes, 1); assert.equal(tail.data, 'after');
  assert.equal(filter.stats().totalOmittedUtf8Bytes, 24102);
  assert.equal(filter.stats().discarding, false);
});

test('CSI and C1 DCS/SOS/PM/APC budgets recover after their actual terminators', requiresOutput, () => {
  for (const [prefix, terminator] of [['\x1b[', 'm'], ['\u0090', '\u009c'], ['\x1bX', '\x1b\\'], ['\x1b^', '\x1b\\'], ['\x1b_', '\x1b\\']]) {
    const filter = new output.VtBudgetFilter();
    const head = filter.push(prefix + '1'.repeat(5000));
    assert.equal(head.data, ''); assert.equal(head.omittedSequences, 1);
    const tail = filter.push(terminator + 'visible');
    assert.equal(tail.data, 'visible');
    assert.equal(filter.stats().pendingUtf8Bytes, 0);
    assert.equal(filter.stats().discarding, false);
    assert.equal(head.omittedUtf8Bytes + tail.omittedUtf8Bytes, Buffer.byteLength(prefix + '1'.repeat(5000) + terminator));
  }
});

test('CAN cancels discarded VT data and parser reset drops a bounded incomplete sequence', requiresOutput, () => {
  const filter = new output.VtBudgetFilter();
  filter.push('\x1bP' + 'x'.repeat(5000));
  assert.equal(filter.push('\x18OK').data, 'OK');
  filter.push('\x1b]title');
  const reset = filter.reset();
  assert.equal(reset.omittedUtf8Bytes, 7);
  assert.equal(filter.push('plain').data, 'plain');
  assert.equal(filter.stats().pendingUtf8Bytes, 0);
});

test('filter output deliveries are capped even when a pending sequence completes with a full input chunk', requiresOutput, () => {
  const filter = new output.VtBudgetFilter();
  filter.push('\x1b]' + 'x'.repeat(4093));
  const result = filter.push('\x07' + 'a'.repeat(32767));
  assert.equal(result.data, '\x1b]' + 'x'.repeat(4093) + '\x07' + 'a'.repeat(32767));
  assert.ok(result.chunks.every(chunk => Buffer.byteLength(chunk) <= 32768 && chunk.isWellFormed()));
  assert.equal(result.chunks.join(''), result.data);
  assert.throws(() => filter.push('a'.repeat(32769)), { code: 'INVALID_DELIVERY_BUDGET' });
  assert.equal(filter.stats().pendingUtf8Bytes, 0);
});
