import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, readdir, mkdir, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const specimen = name => JSON.stringify({ diagrams: [{ id: 'diagram-fixed', source: `flowchart TD\n A[${name}] --> B` }], workpapers: [{ id: 'doc-fixed', agent: { agentId: 'agent-fixed', version: 'v2' }, blocks: [{ id: 'block-fixed', kind: 'knowledge', rows: [{ id: 'source-fixed', language: 'python', content: 'def calculate(x):\n    return x * 2\n', releaseId: 'release-fixed' }] }] }], codeWorkspace: { drafts: [{ id: 'draft-fixed', text: 'private unsaved code' }] } });
const root = async () => mkdtemp(join(tmpdir(), 'siren-project-'));

test('exact UTF-8 workspace import survives save and fresh store readback without rewriting identities', async () => {
  const { ProjectStore } = await import('../src/projects/store.mjs');
  const dir = await root(); const store = new ProjectStore(dir);
  const initial = await store.createProject({ label: 'Știință și agenți', json: specimen('Știință') });
  assert.equal(initial.revision, 1); assert.equal(initial.json, specimen('Știință'));
  const saved = await store.saveProject({ projectId: initial.project.id, baseRevision: 1, json: specimen('Updated'), purpose: 'workspace' });
  assert.equal(saved.ok, true); assert.equal(saved.revision, 2);
  const loaded = await new ProjectStore(dir).readProject(initial.project.id);
  assert.equal(loaded.json, specimen('Updated')); assert.equal(loaded.sha256, saved.sha256);
  assert.equal(JSON.parse(loaded.json).workpapers[0].blocks[0].rows[0].releaseId, 'release-fixed');
});

test('two writers at the same revision cannot both commit and stale data is retained for explicit recovery', async () => {
  const { ProjectStore } = await import('../src/projects/store.mjs');
  const dir = await root(); const a = new ProjectStore(dir); const b = new ProjectStore(dir);
  const first = await a.createProject({ label: 'Concurrency', json: specimen('original') });
  const attempts = await Promise.all([a, b].map((s, i) => s.saveProject({ projectId: first.project.id, baseRevision: 1, json: specimen(`writer-${i}`), purpose: 'workspace' })));
  assert.equal(attempts.filter(r => r.ok).length, 1);
  const current = await a.readProject(first.project.id);
  const stale = await b.saveProject({ projectId: first.project.id, baseRevision: 1, json: specimen('stale'), purpose: 'workspace' });
  assert.equal(stale.ok, false); assert.equal(stale.code, 'REVISION_CONFLICT');
  assert.equal((await a.readProject(first.project.id)).json, current.json);
  assert.ok((await a.listPending(first.project.id)).some(r => r.json === specimen('stale')));
});

test('failed flush or rename cannot claim save and keeps the exact previous revision', async () => {
  const { ProjectStore } = await import('../src/projects/store.mjs');
  for (const phase of ['before-flush', 'before-select']) {
    const dir = await root(); const normal = new ProjectStore(dir);
    const first = await normal.createProject({ label: 'Fault', json: specimen('old') });
    const broken = new ProjectStore(dir, { fault: async step => { if (step === phase) throw Object.assign(new Error('injected disk full'), { code: 'ENOSPC' }); } });
    const result = await broken.saveProject({ projectId: first.project.id, baseRevision: first.revision, json: specimen('new'), purpose: 'workspace' });
    assert.equal(result.ok, false); assert.equal((await normal.readProject(first.project.id)).json, first.json);
  }
});

test('path ids and junction replacement are rejected without reading unrelated bytes', async () => {
  const { ProjectStore } = await import('../src/projects/store.mjs');
  const dir = await root(); const store = new ProjectStore(dir);
  const first = await store.createProject({ label: '../untrusted label', json: specimen('owned') });
  await assert.rejects(store.readProject('../secret'), /refused/i);
  const dir2 = await root(); await mkdir(join(dir2, 'Projects'));
  await symlink(join(dir, 'Projects', first.project.id), join(dir2, 'Projects', first.project.id), 'junction');
  await assert.rejects(new ProjectStore(dir2).readProject(first.project.id), /refused/i);
});

test('corrupt selected revision refuses normal load and keeps damaged bytes unchanged', async () => {
  const { ProjectStore } = await import('../src/projects/store.mjs');
  const dir = await root(); const store = new ProjectStore(dir);
  const first = await store.createProject({ label: 'Corruption', json: specimen('owned') });
  const directory = join(dir, 'Projects', first.project.id);
  const selected = JSON.parse(await readFile(join(directory, 'current.json'), 'utf8'));
  const damaged = join(directory, 'revisions', selected.file);
  await writeFile(damaged, '{BROKEN');
  await assert.rejects(store.readProject(first.project.id), /corrupt|invalid/i);
  assert.equal(await readFile(damaged, 'utf8'), '{BROKEN');
});

test('only a specifically acknowledged pending copy is pruned; unacknowledged attempted work stays recoverable', async () => {
  const { ProjectStore } = await import('../src/projects/store.mjs');
  const dir = await root(); const store = new ProjectStore(dir);
  const first = await store.createProject({ label: 'Acknowledgment', json: specimen('old') });
  const saved = await store.saveProject({ projectId: first.project.id, baseRevision: 1, json: specimen('new'), purpose: 'workspace' });
  const stale = await store.saveProject({ projectId: first.project.id, baseRevision: 1, json: specimen('stale'), purpose: 'workspace' });
  assert.equal(stale.ok, false);
  await store.acknowledgePending(first.project.id, saved.pendingId);
  const remaining = await store.listPending(first.project.id);
  assert.equal(remaining.some(p => p.json === specimen('new')), false);
  assert.equal(remaining.some(p => p.json === specimen('stale')), true);
});

test('a crashed writer is reclaimed only after exact native identity proves it is no longer running', async () => {
  const { ProjectStore } = await import('../src/projects/store.mjs');
  const dir = await root(); const store = new ProjectStore(dir);
  const first = await store.createProject({ label: 'Owned process', json: specimen('old') });
  const lock = join(dir, 'Projects', first.project.id, 'writer.lock');
  const prior = { pid: 100, path: 'owned.exe', startedAt: 'prior-creation' };
  await writeFile(lock, JSON.stringify(prior));
  const ownerIdentity = { pid: 101, path: 'owned.exe', startedAt: 'new-creation' };
  const live = new ProjectStore(dir, { ownerIdentity, inspectProcess: async () => prior });
  const request = { projectId: first.project.id, baseRevision: 1, json: specimen('new'), purpose: 'workspace' };
  assert.equal((await live.saveProject(request)).code, 'WRITER_BUSY');
  const unknown = new ProjectStore(dir, { ownerIdentity, inspectProcess: async () => undefined });
  assert.equal((await unknown.saveProject(request)).code, 'WRITER_BUSY');
  const gone = new ProjectStore(dir, { ownerIdentity, inspectProcess: async () => null });
  assert.equal((await gone.saveProject(request)).ok, true);
});

test('asynchronous native permission denial is awaited before creating or committing a project', async () => {
  const { ProjectStore } = await import('../src/projects/store.mjs');
  const dir = await root(); const normal = new ProjectStore(dir);
  const first = await normal.createProject({ label: 'Owned', json: specimen('old') });
  const denied = new ProjectStore(dir, { canSave: async () => false });
  assert.equal((await denied.saveProject({ projectId: first.project.id, baseRevision: 1, json: specimen('denied'), purpose: 'workspace' })).ok, false);
  assert.equal((await normal.readProject(first.project.id)).json, specimen('old'));
  await assert.rejects(denied.createProject({ label: 'Denied', json: specimen('denied') }), /activation/i);
});

test('legacy portable import preserves reusable libraries and picture bytes in the desktop storage bag', async () => {
  const { parseLegacyImport } = await import('../src/projects/migration.mjs');
  const workspace = JSON.parse(specimen('Library import'));
  const payload = { type: 't-industries-siren-project', version: '1.131.0', state: workspace, libraries: { customTemplates: [{ id: 'template1', source: 'flowchart TD\n A-->B' }], brandPresets: { brand1: { color: '#abcdef' } }, subflows: { sub1: { source: 'flowchart TD\n X-->Y' } }, mapAssets: { asset1: { mime: 'image/png', data: 'TEST_PICTURE_BYTES' } } } };
  const bag = JSON.parse(parseLegacyImport(Buffer.from(JSON.stringify(payload))));
  assert.equal(bag.kind, 'siren-desktop');
  assert.deepEqual(JSON.parse(bag.storage['t-industries-siren-v23-state']), workspace);
  assert.ok(Object.values(bag.storage).some(s => s.includes('TEST_PICTURE_BYTES')));
  assert.ok(Object.values(bag.storage).some(s => s.includes('template1')));
});
