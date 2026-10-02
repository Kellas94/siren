import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { invokeDesktop } from '../src/ipc.mjs';

const context = { isMainFrame: true, senderUrl: 'siren://app/app.html' };

test('locked native session refuses project writes and reads even when the renderer knows an owned ID', async () => {
  const root = await mkdtemp(join(tmpdir(), 'siren-pin-ipc-'));
  const projects = new ProjectStore(root);
  const original = await projects.createProject({ label: 'Owned private project', json: '{"source":"private original"}' });
  const services = {
    saveProject: request => projects.saveProject(request),
    exportProject: id => projects.readProject(id),
  };
  const localAccess = { state: () => ({ unlocked: false }) };
  const save = await invokeDesktop({ method: 'saveProject', payload: { projectId: original.project.id, baseRevision: 1, purpose: 'workspace', json: '{"source":"attempted edit"}' }, context, services, localAccess });
  assert.equal(save.ok, false); assert.equal(save.code, 'PIN_REQUIRED');
  const read = await invokeDesktop({ method: 'exportProject', payload: original.project.id, context, services, localAccess });
  assert.equal(read.ok, false); assert.equal(read.code, 'PIN_REQUIRED');
  assert.equal((await projects.readProject(original.project.id)).json, original.json);
});

test('PIN requests validate exact numeric fields before reaching native access service', async () => {
  const services = { unlockPin: async () => ({ ok: true }) };
  for (const payload of [{ pin: '4826', extra: 'ignored' }, { pin: '' }, { pin: '4826127' }, { pin: 4826 }, { pin: 'abcd' }]) {
    const r = await invokeDesktop({ method: 'unlockPin', payload, context, services });
    assert.equal(r.code, 'REQUEST_REFUSED');
  }
  const valid = await invokeDesktop({ method: 'unlockPin', payload: { pin: '4826' }, context, services });
  assert.equal(valid.ok, true);
});

test('unlocked native session still applies owned project writer checks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'siren-pin-write-')); const projects = new ProjectStore(root);
  const original = await projects.createProject({ label: 'Unlocked fixture', json: '{}' });
  const services = { saveProject: request => projects.saveProject(request) };
  const localAccess = { state: () => ({ unlocked: true }) };
  const request = { projectId: original.project.id, baseRevision: 1, purpose: 'workspace', json: '{"source":"confirmed edit"}' };
  assert.equal((await invokeDesktop({ method: 'saveProject', payload: request, context, services, localAccess })).ok, true);
  assert.equal((await projects.readProject(original.project.id)).json, request.json);
  assert.equal((await invokeDesktop({ method: 'saveProject', payload: request, context, services, localAccess })).ok, false);
});
