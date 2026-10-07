import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { migrateLegacySources, remapSourceReferences } from '../src/sources/migration.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
async function fixture(t, metadata) {
  const root = await mkdtemp(join(tmpdir(), 'siren-source-migration-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const projects = new ProjectStore(root);
  const snapshot = await projects.createProject({ label: 'Legacy synthetic', json: JSON.stringify(metadata) });
  const repository = new SourceRepository(root);
  return { root, projects, repository, snapshot };
}
const doc = (id, sourceId, content) => ({ id, agent: { agentId: 'agent-original', version: 'v7' }, blocks: [{ id: `block-${id}`, kind: 'knowledge', rows: [{ id: `row-${id}`, sourceId, name: 'exact.py', fileType: 'python', content }] }] });

test('migration writes a new schema 2 project and leaves every original project file byte-identical', async t => {
  const content = '\uFEFFdef é():\r\n    return "😀"\n';
  const metadata = { diagrams: [{ id: 'diagram-original', source: 'flowchart TD\nA-->B' }], workpapers: [doc('doc-a', 'original-source', content)], codeFiles: [{ id: 'unlinked-original', name: 'other.py', language: 'python', content: 'unlinked\rtext' }], codeWorkspace: { drafts: [{ id: 'draft-original', text: 'private 😀', base: 'original draft', ref: null }] } };
  const options = await fixture(t, metadata);
  const directory = await options.projects.directory(options.snapshot.project.id);
  const originalPointer = await readFile(join(directory, 'current.json'));
  const revisions = await readdir(join(directory, 'revisions'));
  const originalRevision = await readFile(join(directory, 'revisions', revisions[0]));
  const migrated = await migrateLegacySources(options);
  assert.equal(migrated.ok, true); assert.notEqual(migrated.newProjectId, options.snapshot.project.id);
  const reopened = await new ProjectStore(options.root).readProject(migrated.newProjectId);
  assert.equal(reopened.schema, 2);
  const parsed = JSON.parse(reopened.json);
  assert.equal(parsed.diagrams[0].source, metadata.diagrams[0].source);
  const row = parsed.workpapers[0].blocks[0].rows[0];
  assert.equal(row.id, 'row-doc-a'); assert.equal(row.sourceId, 'original-source'); assert.equal(row.content, undefined);
  assert.deepEqual(parsed.workpapers[0].agent, metadata.workpapers[0].agent);
  const actual = await options.repository.exportSource({ projectId: migrated.newProjectId, ...row.sourceRef });
  assert.deepEqual(actual, Buffer.from(content)); assert.equal(row.sourceRef.sha256, sha(Buffer.from(content)));
  assert.deepEqual(await readFile(join(directory, 'current.json')), originalPointer);
  assert.deepEqual(await readFile(join(directory, 'revisions', revisions[0])), originalRevision);
  assert.deepEqual(await readdir(directory), ['current.json','pending','revisions']);
  assert.equal(parsed.codeWorkspace.drafts[0].text, undefined); assert.equal(parsed.codeWorkspace.drafts[0].base, undefined);
  assert.deepEqual(await options.repository.exportSource({ projectId: migrated.newProjectId, ...parsed.codeWorkspace.drafts[0].sourceRef }), Buffer.from('private 😀'));
});

test('two Docs referencing one original source share a blob while distinct release identities stay separate', async t => {
  const first = doc('doc-a', 'same-original', 'shared code');
  first.releases = [{ id: 'release-a', version: 'A', snapshot: { agent: { agentId: 'agent-original' }, knowledge: [{ sourceId: 'same-original', name: 'exact.py', content: 'shared code' }] } }, { id: 'release-b', version: 'B', snapshot: { agent: { agentId: 'agent-original' }, knowledge: [{ sourceId: 'same-original', name: 'exact.py', content: 'shared code' }] } }];
  const options = await fixture(t, { workpapers: [first, doc('doc-b', 'same-original', 'shared code')] });
  const result = await migrateLegacySources(options);
  assert.equal(result.ok, true);
  const parsed = JSON.parse(result.snapshot.json);
  const a = parsed.workpapers[0].blocks[0].rows[0], b = parsed.workpapers[1].blocks[0].rows[0];
  assert.deepEqual(a.sourceRef, b.sourceRef);
  const releaseA = parsed.workpapers[0].releases[0].snapshot.knowledge[0].sourceRef;
  const releaseB = parsed.workpapers[0].releases[1].snapshot.knowledge[0].sourceRef;
  assert.notEqual(releaseA.sourceId, releaseB.sourceId); assert.notEqual(releaseA.sourceId, a.sourceRef.sourceId);
  assert.equal(result.sourceRefs.length, 3);
  assert.equal(result.sourceRefs.find(ref => ref.sourceId === releaseA.sourceId).provenance.releaseId, 'release-a');
});

test('actual desktop storage bag migrates linked files, release snapshots and private draft keys', async t => {
  const workspace = { workpapers: [doc('doc-a', 'source-original', 'print("one")\r\n')], codeFiles: [{ id: 'linked-file', name: 'exact.py', content: '', linkedRef: { kind: 'docs', docId: 'doc-a', blockId: 'block-doc-a', sourceId: 'source-original' } }] };
  const metadata = { kind: 'siren-desktop', schema: 1, storage: { 't-industries-siren-v23-state': JSON.stringify(workspace), 'siren-code-drafts-v1': JSON.stringify([{ id: 'private-draft', ref: workspace.codeFiles[0].linkedRef, base: 'print("one")\r\n', text: 'print("two")\r\n', generation: 8 }]), 'unrelated-library': 'exact unrelated bytes', 'unrelated-json': ' { "settings" : [1, 2] } ' } };
  const options = await fixture(t, metadata);
  const result = await migrateLegacySources(options);
  assert.equal(result.ok, true);
  const bag = JSON.parse(result.snapshot.json);
  assert.equal(bag.schema, 2); assert.equal(bag.storage['unrelated-library'], 'exact unrelated bytes');
  assert.equal(bag.storage['unrelated-json'], metadata.storage['unrelated-json']);
  const state = JSON.parse(bag.storage['t-industries-siren-v23-state']);
  const drafts = JSON.parse(bag.storage['siren-code-drafts-v1']);
  assert.deepEqual(state.codeFiles[0].sourceRef, state.workpapers[0].blocks[0].rows[0].sourceRef);
  assert.equal(state.codeFiles[0].content, undefined);
  assert.deepEqual(drafts[0].baseSourceRef, state.codeFiles[0].sourceRef);
  assert.equal(drafts[0].generation, 8);
  assert.deepEqual(await options.repository.exportSource({ projectId: result.newProjectId, ...drafts[0].sourceRef }), Buffer.from('print("two")\r\n'));
});

test('partial source import failure reports the retained new project without admitting migration', async t => {
  const options = await fixture(t, { workpapers: [doc('doc-a', 's-a', 'first'), doc('doc-b', 's-b', 'second')] });
  let imports = 0;
  options.repository.fault = async phase => { if (phase === 'source-blob-verified' && ++imports === 2) throw new Error('synthetic full disk'); };
  const result = await migrateLegacySources(options);
  assert.equal(result.ok, false); assert.equal(result.code, 'MIGRATION_INCOMPLETE'); assert.ok(result.newProjectId);
  assert.equal((await options.projects.readProject(options.snapshot.project.id)).json, options.snapshot.json);
  assert.equal((await options.projects.readProject(result.newProjectId)).schema, 1);
});

test('remapping updates only exact source pointers including JSON-valued storage without changing owner IDs', () => {
  const old = { sourceId: 'native-old', version: 4, sha256: 'a'.repeat(64) };
  const fresh = { sourceId: 'native-new', version: 1, sha256: 'b'.repeat(64) };
  const metadata = { storage: { state: JSON.stringify({ row: { sourceId: 'legacy-owner', sourceRef: old }, draft: { baseSourceRef: old } }) }, other: 'unchanged' };
  const transformed = remapSourceReferences(metadata, new Map([[`${old.sourceId}:${old.version}:${old.sha256}`, fresh]]));
  const state = JSON.parse(transformed.storage.state);
  assert.deepEqual(state.row.sourceRef, fresh); assert.deepEqual(state.draft.baseSourceRef, fresh);
  assert.equal(state.row.sourceId, 'legacy-owner'); assert.equal(transformed.other, 'unchanged');
  assert.deepEqual(JSON.parse(metadata.storage.state).row.sourceRef, old);
  assert.throws(() => remapSourceReferences(metadata, new Map()), { code: 'UNKNOWN_SOURCE_REFERENCE' });
});

test('migration keeps current linked files bound to current rows when a retained backup has older text', async t => {
  const linked = { id: 'file', name: 'source.py', content: '', linkedRef: { kind: 'docs', docId: 'doc-a', blockId: 'block-doc-a', sourceId: 'same-id' } };
  const current = { workpapers: [doc('doc-a', 'same-id', 'current')], codeFiles: [linked] };
  const backup = { workpapers: [doc('doc-a', 'same-id', 'older')], codeFiles: [linked] };
  const options = await fixture(t, { kind: 'siren-desktop', schema: 1, storage: {
    't-industries-siren-v23-state-backup': JSON.stringify(backup),
    't-industries-siren-v23-state': JSON.stringify(current),
    'siren-code-drafts-v1': JSON.stringify([{ id: 'private', ref: linked.linkedRef, base: 'current', text: 'edited' }]),
  } });
  const result = await migrateLegacySources(options);
  assert.equal(result.ok, true);
  const bag = JSON.parse(result.snapshot.json);
  const now = JSON.parse(bag.storage['t-industries-siren-v23-state']);
  const old = JSON.parse(bag.storage['t-industries-siren-v23-state-backup']);
  const drafts = JSON.parse(bag.storage['siren-code-drafts-v1']);
  assert.deepEqual(now.codeFiles[0].sourceRef, now.workpapers[0].blocks[0].rows[0].sourceRef);
  assert.deepEqual(old.codeFiles[0].sourceRef, old.workpapers[0].blocks[0].rows[0].sourceRef);
  assert.deepEqual(drafts[0].baseSourceRef, now.codeFiles[0].sourceRef);
  assert.deepEqual(await options.repository.exportSource({ projectId: result.newProjectId, ...old.codeFiles[0].sourceRef }), Buffer.from('older'));
});

test('source remapping preserves special JSON keys as data without prototype mutation', () => {
  const metadata = JSON.parse('{"__proto__":{"owner":"original"},"storage":{}}');
  Object.defineProperty(metadata.storage, '__proto__', { value: '{"name":"original"}', enumerable: true });
  metadata.storage.library = ' { "settings" : [1, 2] } ';
  const transformed = remapSourceReferences(metadata, new Map());
  assert.equal(JSON.stringify(transformed), JSON.stringify(metadata));
  assert.equal(Object.getPrototypeOf(transformed), Object.prototype);
});
