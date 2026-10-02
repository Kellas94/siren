import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, open, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('owned reads refuse oversize files before allocating their body and preserve the original', async () => {
  const { readOwnedBytes } = await import('../src/projects/io.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'siren-bounded-')); const path = join(dir, 'oversize.json');
  const file = await open(path, 'wx'); await file.truncate(128 * 1024 * 1024); await file.close();
  await assert.rejects(readOwnedBytes(path, 1024), /limit|large/i);
  await writeFile(join(dir, 'valid.json'), 'Știință');
  assert.equal((await readOwnedBytes(join(dir, 'valid.json'), 100)).toString('utf8'), 'Știință');
});
