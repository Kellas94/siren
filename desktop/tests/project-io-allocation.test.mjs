import test from 'node:test';
import assert from 'node:assert/strict';
import { open, readFile, writeFile, appendFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { mkdtemp } from './fixtures/temporary.mjs';
import { readOwnedBytes } from '../src/projects/io.mjs';

// Each real FileHandle case owns a fresh canonical temporary directory.
const pattern = length => Buffer.from(Array.from({ length }, (_, i) => (i * 31 + Math.floor(i / 65536) * 73) % 256));
async function fixture(t, bytes) {
  const root = await mkdtemp(join(tmpdir(), 'siren-project-io-allocation-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'bytes.bin');
  await writeFile(path, bytes);
  return path;
}

// Isolated linker instruments only Buffer.alloc and actual FileHandle operations.
// Paths, handle stat/read/close and retained bytes use the real implementation.
// Short reads / append-after-stat are controlled filesystem interleavings, not
// claims of atomic race protection or public production injection hooks.
async function measured({ shortRead, growAfterStat } = {}) {
  const allocations = [], reads = [];
  let closes = 0;
  const countedBuffer = new Proxy(Buffer, { get(target, key, receiver) {
    if (key === 'alloc') return size => { allocations.push(size); return Buffer.alloc(size); };
    return Reflect.get(target, key, receiver);
  } });
  const exports = { open: async (...args) => {
    const handle = await open(...args);
    return {
      stat: async () => {
        const info = await handle.stat();
        if (growAfterStat) await appendFile(args[0], growAfterStat);
        return info;
      },
      read: async (buffer, offset, length, position) => {
        const actualLength = shortRead ? Math.min(length, shortRead) : length;
        const result = await handle.read(buffer, offset, actualLength, position);
        reads.push({ requested: length, returned: result.bytesRead });
        return result;
      },
      close: async () => { closes++; await handle.close(); }
    };
  } };
  const url = new URL('../src/projects/io.mjs', import.meta.url);
  const context = createContext({ Buffer: countedBuffer });
  const module = new SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href });
  await module.link(async specifier => {
    const bindings = specifier === 'node:fs/promises' ? exports : await import(new URL(specifier, url).href);
    return new SyntheticModule(Object.keys(bindings), function () {
      for (const [key, value] of Object.entries(bindings)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  return { read: module.namespace.readOwnedBytes, allocations, reads, closes: () => closes };
}

test('actual owned file preserves distinct raw bytes across multiple chunks and a short tail', async t => {
  const bytes = pattern(3 * 65536 + 7);
  const path = await fixture(t, bytes);
  assert.deepEqual(await readOwnedBytes(path, bytes.length + 100), bytes);
});

test('conditional short reads retain exact independent copies and continue through EOF', async t => {
  const bytes = pattern(2 * 65536 + 19), path = await fixture(t, bytes);
  const m = await measured({ shortRead: 137 });
  assert.deepEqual(await m.read(path, bytes.length), bytes);
  assert.ok(m.reads.length > 900);
  assert.equal(m.reads.at(-1).returned, 0);
  assert.equal(m.reads.at(-2).returned, bytes.length % 137);
  assert.equal(m.closes(), 1);
});

test('zero limit on empty owned file still reads one sentinel byte through EOF and closes', async t => {
  const path = await fixture(t, Buffer.alloc(0)), m = await measured();
  assert.deepEqual(await m.read(path, 0), Buffer.alloc(0));
  assert.deepEqual(m.reads, [{ requested: 1, returned: 0 }]);
  assert.deepEqual(m.allocations, [1]);
  assert.equal(m.closes(), 1);
});

test('exact limit retains all bytes then performs the one-byte EOF sentinel read', async t => {
  const bytes = pattern(65536 + 11), path = await fixture(t, bytes), m = await measured();
  assert.deepEqual(await m.read(path, bytes.length), bytes);
  assert.deepEqual(m.reads, [{ requested: 65536, returned: 65536 }, { requested: 12, returned: 11 }, { requested: 1, returned: 0 }]);
  assert.equal(m.closes(), 1);
});

test('initial size refusal allocates no scratch and closes the actual handle', async t => {
  const path = await fixture(t, pattern(1)), m = await measured();
  await assert.rejects(m.read(path, 0), /File exceeds read limit/);
  assert.deepEqual(m.allocations, []);
  assert.deepEqual(m.reads, []);
  assert.equal(m.closes(), 1);
});

test('conditional append after actual handle stat is refused at limit plus one and closes', async t => {
  const bytes = pattern(65536 + 11), path = await fixture(t, bytes);
  const m = await measured({ growAfterStat: Buffer.from([21, 22, 23]) });
  await assert.rejects(m.read(path, bytes.length), /File grew beyond read limit/);
  assert.equal(m.reads.reduce((sum, row) => sum + row.returned, 0), bytes.length + 1);
  assert.equal(m.closes(), 1);
  assert.deepEqual(await readFile(path), Buffer.concat([bytes, Buffer.from([21, 22, 23])]));
});

test('invalid limits are refused without opening or allocating', async () => {
  const m = await measured();
  for (const limit of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(m.read('not-opened', limit), /Invalid file limit/);
  assert.deepEqual(m.allocations, []);
  assert.deepEqual(m.reads, []);
  assert.equal(m.closes(), 0);
});

test('one zero-filled scratch allocation per admitted read, including the final EOF read', async t => {
  const bytes = pattern(3 * 65536 + 7), path = await fixture(t, bytes), m = await measured();
  assert.deepEqual(await m.read(path, bytes.length), bytes);
  assert.equal(m.reads.length, 5);
  assert.equal(m.reads.at(-1).returned, 0);
  assert.equal(m.closes(), 1);
  assert.deepEqual(m.allocations, [65536], 'scratch allocation sizes; excludes retained-copy/output allocations and is not a heap or latency measurement');
});
