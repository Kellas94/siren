import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import vm from 'node:vm';
import { ProjectStore } from '../src/projects/store.mjs';
import { RecoveryStore } from '../src/recovery/checkpoints.mjs';
import { failure } from '../src/ipc.mjs';
import { mkdtemp } from './fixtures/temporary.mjs';
import {installPrimaryOwner} from './fixtures/primary-owner-context.mjs';
const main = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const start = main.indexOf('  saveProject:'); const stop = main.indexOf('  exportProject:', start);
assert.ok(start >= 0 && stop > start);
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'siren-project-noop-')); const projects = new ProjectStore(root);
  const original = await projects.createProject({ label: 'Owned no-op boundary', json: JSON.stringify({ kind: 'siren-desktop', schema: 1, storage: { workspace: '{"source":"unchanged"}' } }) });
  const context = vm.createContext({ projects, recovery: new RecoveryStore(root), failure, writes: new Set(), grants: new Set([original.project.id]), selectedId: original.project.id, snapshot: original, mode:'normal',nativeReadonly:false,window:{webContents:{}},bootstrap: { snapshot: original, selectionGeneration: 0 } });
  vm.runInContext(`globalThis.services = {${main.slice(start, stop)}};`, context);
  installPrimaryOwner(context,{projects:()=>projects});
  return { root, projects, original, context };
}
test('a repeated exact acknowledged workspace save retains the complete selected revision and pointer bytes', async () => {
  const { root, projects, original, context } = await fixture();
  // Discover the actual pointer filename rather than assume project contents.
  const beforeNames = await readdir(join(root, 'Projects', original.project.id));
  const beforeFiles = new Map();
  for (const name of beforeNames.filter(name => name.endsWith('.json'))) beforeFiles.set(name, await readFile(join(root, 'Projects', original.project.id, name)));
  for (let index = 0; index < 2; index++) {
    const receipt = await context.services.saveProject({ projectId: original.project.id, baseRevision: original.revision, json: original.json, purpose: 'workspace' });
    assert.equal(receipt.ok, true); assert.equal(receipt.revision, original.revision); assert.equal(receipt.sha256, original.sha256);
    assert.deepEqual(await projects.readProject(original.project.id), original);
  }
  for (const [name, bytes] of beforeFiles) assert.deepEqual(await readFile(join(root, 'Projects', original.project.id, name)), bytes);
  assert.equal((await readdir(join(root, 'Projects', original.project.id, 'revisions'))).length, 1);
  assert.equal(context.writes.size, 0);
});
test('same text with stale CAS refuses and private recovery does not suppress a real workspace commit', async () => {
  const { projects, original, context } = await fixture();
  const request = { projectId: original.project.id, baseRevision: original.revision, json: original.json, purpose: 'workspace' };
  assert.equal((await context.services.saveProject({ ...request, baseRevision: 0 })).code, 'REVISION_CONFLICT');
  const edited = '{"source":"changed owned text"}';
  assert.equal((await context.services.saveProject({ ...request, purpose: 'recovery', json: edited })).ok, true);
  assert.deepEqual(await projects.readProject(original.project.id), original);
  const committed = await context.services.saveProject({ ...request, json: edited });
  assert.equal(committed.ok, true); assert.equal(committed.revision, original.revision + 1);
  assert.equal((await projects.readProject(original.project.id)).json, edited);
});
test('a no-op save still refuses a failed recovery checkpoint and does not advance the original revision',async()=>{
  const {projects,original,context}=await fixture();
  context.recovery.fault=async()=>{throw Object.assign(new Error('Owned checkpoint failure'),{code:'CHECKPOINT_FAILED'});};
  const result=await context.services.saveProject({projectId:original.project.id,baseRevision:original.revision,json:original.json,purpose:'workspace'});
  assert.equal(result.ok,false); assert.equal(result.code,'RECOVERY_DEGRADED'); assert.equal(result.workspaceCommitted,true); assert.equal(result.unchanged,true); assert.equal(result.committedRevision,original.revision); assert.equal(result.committedSha256,original.sha256);
  assert.deepEqual(await projects.readProject(original.project.id),original);
});
