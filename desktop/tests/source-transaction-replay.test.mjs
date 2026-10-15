import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { TextModel } from '../src/sources/text-model.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const operation = (ref, operationId, start, end, insertedText) => ({ sourceId: ref.sourceId,
  expectedVersion: ref.version, operationId, start, end, insertedText });

async function fixture(t, Repository = SourceRepository, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'siren-transaction-replay-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const project = await new ProjectStore(root).createProject({ label: 'Replay proof', json: '{}' });
  return { root, projectId: project.project.id, repo: new Repository(root, options) };
}

// The linker instruments construction only; every constructor/apply/read uses
// the actual TextModel, real owned files, atomic writer and journal repository.
async function instrumentedRepository() {
  let constructions = 0;
  class CountedModel extends TextModel {
    constructor(options) { super(options); constructions++; }
  }
  const url = new URL('../src/sources/repository.mjs', import.meta.url);
  const context = createContext({ Buffer, Uint8Array, structuredClone });
  const module = new SourceTextModule(await readFile(url, 'utf8'), { context, identifier: url.href });
  await module.link(async specifier => {
    const exports = specifier === './text-model.mjs' ? { TextModel: CountedModel }
      : await import(specifier.startsWith('node:') ? specifier : new URL(specifier, url).href);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  return { Repository: module.namespace.SourceRepository, reset: () => { constructions = 0; },
    count: () => constructions };
}

test('an accepted edit constructs one actual model and rereads all 201 records after a 100-record prefix', async t => {
  const measured = await instrumentedRepository();
  const f = await fixture(t, measured.Repository);
  const original = '\ufeffa😀\r\nb\rc\n';
  let ref = await f.repo.importSource({ projectId: f.projectId, bytes: Buffer.from(original) });
  let expected = original;
  for (let index = 0; index < 99; index++) {
    const next = await f.repo.applyEdit({ projectId: f.projectId,
      edit: operation(ref, `prefix-${index}`, expected.length, expected.length, 'x') });
    assert.equal(next.ok, true); expected += 'x'; ref = { ...ref, version: next.version };
  }
  let reads = 0;
  const readRecord = f.repo.readRecord.bind(f.repo);
  f.repo.readRecord = async (...args) => { reads++; return readRecord(...args); };
  measured.reset();
  const result = await f.repo.applyEdit({ projectId: f.projectId,
    edit: operation(ref, 'measured-edit', 1, 2, 'Ș') });
  expected = expected.slice(0, 1) + 'Ș' + expected.slice(2);
  assert.equal(result.ok, true);
  assert.equal(result.version, 101);
  assert.equal(result.sha256, sha(Buffer.from(expected)));
  assert.equal(reads, 201, 'Fresh readback must retain every prior record read');
  assert.equal(measured.count(), 1, 'Only one full line model per accepted edit transaction');
  const fresh = new SourceRepository(f.root);
  assert.deepEqual(await fresh.exportSource({ projectId: f.projectId, sourceId: ref.sourceId, version: 101 }), Buffer.from(expected));
  assert.deepEqual(await fresh.exportSource({ projectId: f.projectId, sourceId: ref.sourceId, version: 1 }), Buffer.from(original));
});

for (const target of ['oldest-record', 'middle-record', 'original-blob', 'missing-record', 'missing-blob']) {
  test(`post-selection ${target} damage cannot be acknowledged from the retained model`, async t => {
    const f = await fixture(t);
    let ref = await f.repo.importSource({ projectId: f.projectId, bytes: Buffer.from('base😀\r\n') });
    const original = ref;
    for (let index = 0; index < 4; index++) {
      const result = await f.repo.applyEdit({ projectId: f.projectId, edit: operation(ref, `seed-${index}`, 0, 0, 'x') });
      assert.equal(result.ok, true); ref = { ...ref, version: result.version };
    }
    const loaded = await f.repo.load(f.projectId, ref.sourceId);
    const file = target.includes('blob') ? join(loaded.directory, 'blobs', `${original.sha256}.bin`)
      : join(loaded.directory, 'versions', loaded.records[target === 'middle-record' ? 2 : 4].descriptor.file);
    const owner = new SourceRepository(f.root);
    const select = owner.select.bind(owner);
    owner.select = async (...args) => {
      await select(...args); // Corrupt after atomic raw-pointer readback, before semantic readback.
      if (target.startsWith('missing')) await rm(file);
      else { const bytes = await readFile(file); bytes[0] ^= 1; await writeFile(file, bytes); }
    };
    const result = await owner.applyEdit({ projectId: f.projectId, edit: operation(ref, 'damage-boundary', 0, 0, 'z') });
    assert.equal(result.ok, false);
    assert.ok(['CORRUPT_SOURCE', 'ENOENT'].includes(result.code), result.code);
  });
}

for (const target of ['commit-head', 'substitute-operation']) {
  test(`post-selection valid-looking ${target} drift cannot stand in for the exact transaction`, async t => {
    const f = await fixture(t);
    const ref = await f.repo.importSource({ projectId: f.projectId, bytes: Buffer.from('base') });
    const directory = await f.repo.sourceDirectory(f.projectId, ref.sourceId);
    const owner = new SourceRepository(f.root);
    const select = owner.select.bind(owner);
    owner.select = async (...args) => {
      await select(...args);
      const path = join(directory, 'current.json');
      const pointer = JSON.parse(await readFile(path, 'utf8'));
      if (target === 'commit-head') {
        pointer.commitHead = { operationId: 'foreign-commit', file: 'c-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.json', sha256: 'f'.repeat(64) };
      } else {
        const journal = join(directory, 'versions', pointer.head.file);
        const record = JSON.parse(await readFile(journal, 'utf8'));
        record.edit.operationId = 'substitute-id';
        record.requestHash = sha(Buffer.from(JSON.stringify(record.edit)));
        const bytes = Buffer.from(JSON.stringify(record));
        await writeFile(journal, bytes); pointer.head.sha256 = sha(bytes);
      }
      await writeFile(path, JSON.stringify(pointer));
    };
    const result = await owner.applyEdit({ projectId: f.projectId, edit: operation(ref, 'exact-operation', 0, 4, 'next') });
    assert.equal(result.ok, false, 'Equal text/version alone must not accept a substitute transaction');
    assert.equal(result.code, 'SOURCE_READBACK_FAILED');
  });
}

test('incremental suffix, Unicode, duplicate identity and original version agree with fresh full replay', async t => {
  const f = await fixture(t);
  const original = '\ufeffa😀\r\nb\rc\n';
  let expected = original;
  let ref = await f.repo.importSource({ projectId: f.projectId, bytes: Buffer.from(original), provenance: { agentId: 'agent-one' } });
  const requests = [[1, 2, 'Ș'], [1, 1, '\n'], [3, 5, '😁'], [0, 0, 'prefix\r\n']];
  for (const [index, [start, end, insertedText]] of requests.entries()) {
    const request = { projectId: f.projectId, edit: operation(ref, `unicode-${index}`, start, end, insertedText) };
    const result = await f.repo.applyEdit(request);
    assert.equal(result.ok, true);
    expected = expected.slice(0, start) + insertedText + expected.slice(end);
    assert.equal(result.sha256, sha(Buffer.from(expected)));
    assert.deepEqual(await f.repo.applyEdit(request), result);
    ref = { ...ref, version: result.version };
    assert.deepEqual(await new SourceRepository(f.root).exportSource({ projectId: f.projectId, sourceId: ref.sourceId, version: ref.version }), Buffer.from(expected));
  }
  assert.deepEqual(await new SourceRepository(f.root).exportSource({ projectId: f.projectId, sourceId: ref.sourceId, version: 1 }), Buffer.from(original));
});
