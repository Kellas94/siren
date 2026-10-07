import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { SourceReaderPool } from '../src/sources/readers.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'siren-readers-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const projectId = (await new ProjectStore(root).createProject({ label: 'Readers', json: '{}' })).project.id;
  const repo = new SourceRepository(root, options);
  return { root, projectId, repo };
}

// Removing snapshot pinning or cutting UTF-16 at the cap loses/replaces bytes here.
test('bounded chunks preserve every BOM/newline/Unicode byte and the captured version after a later edit', async t => {
  const { projectId, repo } = await fixture(t);
  const original = '\ufeff' + 'a'.repeat(131070) + '😀\r\n' + 'ș😀\n'.repeat(3000);
  const ref = await repo.importSource({ projectId, bytes: Buffer.from(original) });
  assert.equal(typeof repo.openReader, 'function', 'repository needs an explicit verified read snapshot');
  const reader = await repo.openReader({ projectId, sourceId: ref.sourceId, version: 1 });
  t.after(() => reader.dispose());
  const edited = await repo.applyEdit({ projectId, edit: { sourceId: ref.sourceId, operationId: 'later-edit', expectedVersion: 1, start: 0, end: 0, insertedText: 'new' } });
  assert.equal(edited.ok, true);
  const pieces = []; let start = 0;
  while (start < reader.info.utf16Units) {
    const chunk = await reader.readChunk({ start, maxUnits: 131072 });
    assert.equal(chunk.sourceId, ref.sourceId); assert.equal(chunk.version, 1);
    assert.equal(chunk.start, start); assert.ok(chunk.end > start);
    assert.ok(chunk.end - start <= 131072); assert.equal(chunk.text.length, chunk.end - start);
    assert.equal(chunk.text.isWellFormed(), true);
    if (start === 0) assert.equal(chunk.end, 131071);
    pieces.push(chunk.text); start = chunk.end;
  }
  assert.equal(sha(Buffer.from(pieces.join(''))), sha(Buffer.from(original)));
  assert.equal(reader.info.sha256, sha(Buffer.from(original)));
  assert.equal(Object.isFrozen(reader.info), true);
  assert.equal('provenance' in reader.info, false);
  assert.equal((await repo.getMetrics({ projectId, sourceId: ref.sourceId })).version, 2);
});

// Re-reading current.json/blob for every chunk would fail after verified open.
// A subsequent fresh open MUST still discover the disk corruption.
test('snapshot reads stay immutable; subsequent readers verify disk integrity again', async t => {
  const { root, projectId, repo } = await fixture(t);
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('captured😀') });
  assert.equal(typeof repo.openReader, 'function');
  const reader = await repo.openReader({ projectId, sourceId: ref.sourceId, version: 1 });
  t.after(() => reader.dispose());
  const blob = join(root, 'Projects', projectId, 'sources', ref.sourceId, 'blobs', `${ref.sha256}.bin`);
  const originalBytes = await readFile(blob);
  await writeFile(blob, 'corrupted');
  assert.equal((await reader.readChunk({ start: 0, maxUnits: 100 })).text, 'captured😀');
  await assert.rejects(repo.openReader({ projectId, sourceId: ref.sourceId, version: 1 }), { code: 'CORRUPT_SOURCE' });
  await writeFile(blob, originalBytes);
  const fresh = await repo.openReader({ projectId, sourceId: ref.sourceId, version: 1 }); fresh.dispose();
});

test('Lock revokes snapshot reads and disposal closes access rather than returning retained text', async t => {
  let unlocked = true; const { projectId, repo } = await fixture(t, { canWrite: () => unlocked });
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('private') });
  assert.equal(typeof repo.openReader, 'function');
  const reader = await repo.openReader({ projectId, sourceId: ref.sourceId, version: 1 });
  unlocked = false;
  await assert.rejects(reader.readChunk({ start: 0, maxUnits: 10 }), { code: 'ACCESS_REFUSED' });
  unlocked = true;
  await assert.rejects(reader.readChunk({ start: 0, maxUnits: 10 }), { code: 'SOURCE_READER_CLOSED' });
  const fresh = await repo.openReader({ projectId, sourceId: ref.sourceId, version: 1 });
  fresh.dispose(); fresh.dispose();
  await assert.rejects(fresh.readChunk({ start: 0, maxUnits: 10 }), { code: 'SOURCE_READER_CLOSED' });
});

test('reader limits include pending opens; failure/disposal reclaim capacity without changing source bytes', async t => {
  const { projectId, repo } = await fixture(t);
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('a😀b') });
  assert.equal(typeof repo.openReader, 'function');
  const request = { projectId, sourceId: ref.sourceId, version: 1 };
  const [one, two] = await Promise.all([repo.openReader(request), repo.openReader(request)]);
  t.after(() => { one.dispose(); two.dispose(); });
  await assert.rejects(repo.openReader(request), { code: 'SOURCE_READER_BUDGET' });
  one.dispose();
  await assert.rejects(repo.openReader({ ...request, version: 99 }), { code: 'UNKNOWN_VERSION' });
  const three = await repo.openReader(request);
  for (const range of [{ start: 2, maxUnits: 2 }, { start: -1, maxUnits: 2 }, { start: 0, maxUnits: 1 }, { start: 0, maxUnits: 131073 }]) {
    await assert.rejects(three.readChunk(range));
  }
  assert.equal((await three.readChunk({ start: 1, maxUnits: 2 })).text, '😀');
  assert.deepEqual(await three.readChunk({ start: 4, maxUnits: 2 }), { sourceId: ref.sourceId, version: 1, start: 4, end: 4, text: '' });
  three.dispose();
  assert.equal(sha(await repo.exportSource({ projectId, sourceId: ref.sourceId, version: 1 })), ref.sha256);
});

test('unsupported UTF-8 cannot create a reader and does not consume its slots', async t => {
  const { projectId, repo } = await fixture(t);
  const bytes = Buffer.from([0xff, 0xfe]);
  const bad = await repo.importSource({ projectId, bytes });
  assert.equal(typeof repo.openReader, 'function');
  for (let i = 0; i < 3; i++) await assert.rejects(repo.openReader({ projectId, sourceId: bad.sourceId, version: 1 }), { code: 'UNSUPPORTED_ENCODING' });
  assert.deepEqual(await repo.exportSource({ projectId, sourceId: bad.sourceId, version: 1 }), bytes);
});

test('pool capacity cannot be expanded by overwriting exposed configuration', async t => {
  const readers = new SourceReaderPool();
  readers.maxReaders = 100;
  const { projectId, repo } = await fixture(t, { readers });
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('bounded') });
  const request = { projectId, sourceId: ref.sourceId, version: 1 };
  const [one, two] = await Promise.all([repo.openReader(request), repo.openReader(request)]);
  t.after(() => readers.dispose());
  await assert.rejects(repo.openReader(request), { code: 'SOURCE_READER_BUDGET' });
  one.dispose(); two.dispose();
});

test('an expired pending open keeps its capacity until the original I/O settles', async t => {
  const readers = new SourceReaderPool({ maxReaders: 1, ttlMs: 10 });
  t.after(() => readers.dispose());
  const { projectId, repo } = await fixture(t, { readers });
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('pending') });
  const request = { projectId, sourceId: ref.sourceId, version: 1 };
  // Native authorizer delayed across an epoch transition: genuine async guard,
  // not a stubbed repository/model. Pool must not launch additional loads.
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const guardEntered = new Promise(resolve => { entered = resolve; });
  // Only the expiry clock is controlled. Repository I/O/model/authorization
  // remain real, and the original 10-ms TTL is unchanged. A fresh post-settle
  // disk load need not beat an unrelated 10-ms wall-clock race on a busy runner.
  t.mock.timers.enable({ apis: ['setTimeout'] });
  repo.canWrite = async () => { entered(); await gate; return true; };
  const opening = repo.openReader(request);
  const rejection = assert.rejects(opening, { code: 'SOURCE_READER_CLOSED' });
  await guardEntered;
  t.mock.timers.tick(11);
  const second = repo.openReader(request).then(reader => { reader.dispose(); return 'ADMITTED'; }, e => e.code);
  // A budget refusal settles before the next native event-loop turn. If the
  // pending reservation was incorrectly released, the second guard stays gated.
  const outcome = await Promise.race([second, new Promise(resolve => setImmediate(() => resolve('ADMITTED_PENDING')))]);
  release(); await rejection; await second;
  assert.equal(outcome, 'SOURCE_READER_BUDGET');
  repo.canWrite = () => true;
  const fresh = await repo.openReader(request);
  assert.equal(fresh.info.sha256, ref.sha256);
  assert.equal((await fresh.readChunk({ start: 0, maxUnits: 10 })).text, 'pending');
  fresh.dispose();
});

test('dispose during the final read guard suppresses already computed private text', async t => {
  const readers = new SourceReaderPool(); const { projectId, repo } = await fixture(t, { readers });
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('private') });
  const reader = await repo.openReader({ projectId, sourceId: ref.sourceId, version: 1 });
  let release, entered; const finalGuard = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; }); let calls = 0;
  repo.canWrite = async () => { if (++calls === 2) { entered(); await gate; } return true; };
  const reading = reader.readChunk({ start: 0, maxUnits: 10 });
  const rejection = assert.rejects(reading, { code: 'SOURCE_READER_CLOSED' });
  await finalGuard; readers.dispose(); release(); await rejection;
});

test('pool expiry cannot be postponed by overwriting exposed configuration', async t => {
  const readers = new SourceReaderPool({ ttlMs: 2000 });
  readers.ttlMs = 86400000;
  const { projectId, repo } = await fixture(t, { readers });
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('expires') });
  const reader = await repo.openReader({ projectId, sourceId: ref.sourceId, version: 1 });
  t.after(() => readers.dispose());
  await new Promise(resolve => setTimeout(resolve, 2100));
  await assert.rejects(reader.readChunk({ start: 0, maxUnits: 10 }), { code: 'SOURCE_READER_CLOSED' });
});

test('microtask disposal immediately before read publication suppresses private text', async t => {
  const { projectId, repo } = await fixture(t);
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('private') });
  const reader = await repo.openReader({ projectId, sourceId: ref.sourceId, version: 1 });
  let calls = 0;
  const later = depth => queueMicrotask(() => depth > 1 ? later(depth - 1) : reader.dispose());
  // access -> check -> readChunk: disposal precedes the final outward resume.
  repo.canWrite = () => { if (++calls === 2) later(3); return true; };
  await assert.rejects(reader.readChunk({ start: 0, maxUnits: 10 }), { code: 'SOURCE_READER_CLOSED' });
});

test('microtask disposal immediately before open publication suppresses the reader grant', async t => {
  const readers = new SourceReaderPool(); const { projectId, repo } = await fixture(t, { readers });
  const ref = await repo.importSource({ projectId, bytes: Buffer.from('private') });
  let calls = 0;
  const later = depth => queueMicrotask(() => depth > 1 ? later(depth - 1) : readers.dispose());
  repo.canWrite = () => { if (++calls === 2) later(3); return true; };
  await assert.rejects(repo.openReader({ projectId, sourceId: ref.sourceId, version: 1 }), { code: 'SOURCE_READER_CLOSED' });
});
