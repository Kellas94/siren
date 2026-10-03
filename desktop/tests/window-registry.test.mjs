import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WindowRegistry } from '../src/windows/registry.mjs';

// The adapter doubles only Electron's native boundary; registry decisions run unchanged.
class NativeWindow extends EventEmitter {
  constructor(id, url) {
    super();
    this.id = id;
    this.destroyed = false;
    this.minimized = false;
    this.focused = false;
    this.webContents = new EventEmitter();
    Object.assign(this.webContents, {
      id: id + 1000, destroyed: false, mainFrame: { url },
      getURL: () => this.webContents.mainFrame.url,
      isDestroyed: () => this.webContents.destroyed,
    });
  }
  isDestroyed() { return this.destroyed; }
  isMinimized() { return this.minimized; }
  restore() { this.minimized = false; this.emit('restore'); }
  focus() { this.focused = true; this.emit('focus'); }
  close() { this.destroy(); }
  destroy() {
    this.destroyed = true;
    this.webContents.destroyed = true;
    this.webContents.emit('destroyed');
    this.emit('closed');
  }
}

function setup(overrides = {}) {
  const windows = [];
  const creations = [];
  const native = { projectId: 'project_a', mode: 'normal', access: 'write', entityIds: ['doc_a', 'code_a', 'deck_a'] };
  const registry = new WindowRegistry({
    closeTimeoutMs: 15,
    authorize: overrides.authorize ?? (() => native),
    createWindow: overrides.createWindow ?? (options => {
      creations.push(options);
      const window = new NativeWindow(windows.length + 1, options.mainFrameUrl);
      windows.push(window);
      return window;
    }),
  });
  return { registry, windows, creations, native };
}

const eventFor = window => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
const refused = promise => assert.rejects(promise, error => error.code === 'REQUEST_REFUSED' || error.code === 'ACCESS_REFUSED');

test('native captured callers cannot be cloned and retire on frame epoch or permission changes',async()=>{
  const {registry,windows,native}=setup();await registry.openView({role:'code',entityId:'code_a'});
  const event=eventFor(windows[0]);assert.equal(typeof registry.capture,'function');
  const grant=registry.capture(event);assert.equal(registry.isCurrent(grant),true);assert.equal(registry.isCurrent({...grant}),false);
  assert.equal(registry.eventFor(grant).sender,event.sender);assert.equal(registry.eventFor({...grant}),null);
  event.senderFrame={url:event.senderFrame.url};assert.equal(registry.isCurrent(grant),true,'Mutating the source event cannot replace its captured actual frame');
  native.mode='readonly';native.access='read';assert.equal(registry.isCurrent(grant),false);assert.equal(registry.eventFor(grant),null);
});

test('captured same-URL frame is retired when native main frame identity changes',async()=>{
  const {registry,windows}=setup();await registry.openView({role:'code',entityId:'code_a'});
  const grant=registry.capture(eventFor(windows[0]));windows[0].webContents.mainFrame={url:windows[0].webContents.mainFrame.url};assert.equal(registry.isCurrent(grant),false);
  registry.invalidateEpoch();assert.equal(registry.eventFor(grant),null);
});

test('a pinned native workspace stays locked without a data grant and explicitly rebinds a new epoch after reload', async () => {
  const { registry, native } = setup(); const owner = new NativeWindow(99, 'siren://app/app.html');
  assert.equal(typeof registry.bindWorkspace, 'function');
  registry.bindWorkspace(owner); native.mode = 'locked';
  assert.equal(registry.caller(eventFor(owner)), null);
  assert.throws(() => registry.activateWorkspace(), e => e.code === 'ACCESS_REFUSED');
  native.mode = 'normal'; const first = registry.activateWorkspace();
  assert.equal(registry.caller(eventFor(owner)).windowId, first.windowId);
  const satellite = await registry.openView({ role: 'code', entityId: 'code_a' });
  owner.webContents.emit('did-start-navigation', { isMainFrame: true, url: owner.webContents.getURL() });
  assert.equal(owner.isDestroyed(), false); assert.equal(registry.caller(eventFor(owner)), null);
  assert.equal(registry.listViews().some(v => v.windowId === satellite.windowId), false);
  owner.webContents.mainFrame = { url: 'siren://app/app.html' };
  const next = registry.activateWorkspace();
  assert.ok(next.epoch > first.epoch); assert.notEqual(next.windowId, first.windowId);
  assert.equal(registry.caller(eventFor(owner)).epoch, next.epoch);
  assert.throws(() => registry.bindWorkspace(new NativeWindow(99, 'siren://app/app.html')), e => e.code === 'ACCESS_REFUSED');
});

test('workspace-preserving Lock revokes every grant and destroys minimized satellites before any new activation', async () => {
  const { registry, windows, native } = setup(); const owner = new NativeWindow(99, 'siren://app/app.html');
  assert.equal(typeof registry.bindWorkspace, 'function'); registry.bindWorkspace(owner); registry.activateWorkspace();
  await registry.openView({ role: 'docs', entityId: 'doc_a' }); windows[0].minimized = true;
  registry.invalidateEpoch({ preserveWorkspace: true }); native.mode = 'locked';
  assert.equal(owner.isDestroyed(), false); assert.equal(windows[0].isDestroyed(), true);
  assert.deepEqual(registry.listViews(), []); assert.equal(registry.caller(eventFor(owner)), null);
  assert.throws(() => registry.activateWorkspace(), e => e.code === 'ACCESS_REFUSED');
});

test('modern native navigation details revoke a satellite and trusted discard bypasses canceled close', async () => {
  const { registry, windows } = setup(); const first = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  windows[0].webContents.emit('did-start-navigation', { isMainFrame: true });
  assert.equal(registry.caller(eventFor(windows[0])), null); assert.equal(windows[0].isDestroyed(), true);
  const next = await registry.openView({ role: 'code', entityId: 'code_a' }); windows[1].close = () => windows[1].emit('close', { defaultPrevented: true });
  assert.equal(await registry.closeView(next.windowId), false);
  assert.equal(typeof registry.discardView, 'function'); assert.equal(registry.discardView(next.windowId), true);
  assert.equal(windows[1].isDestroyed(), true); assert.equal(registry.listViews().length, 0);
  assert.equal(registry.discardView(first.windowId), false);
});

test('an in-flight workspace factory cannot become a second owner after native binding', async () => {
  let finish; const { registry } = setup({ createWindow: options => new Promise(resolve => { finish = () => resolve(new NativeWindow(7, options.mainFrameUrl)); }) });
  const pending = registry.openView({ role: 'workspace', entityId: null });
  const owner = new NativeWindow(99, 'siren://app/app.html'); registry.bindWorkspace(owner); registry.activateWorkspace();
  finish(); await refused(pending); assert.equal(owner.isDestroyed(), false);
  assert.equal(registry.listViews().length, 1);
});

test('pinned inactive native owner identities cannot be reused by a factory or new binding', async () => {
  let candidate; const { registry } = setup({ createWindow: options => { candidate = new NativeWindow(99, options.mainFrameUrl); return candidate; } });
  const owner = new NativeWindow(99, 'siren://app/app.html'); registry.bindWorkspace(owner);
  await refused(registry.openView({ role: 'docs', entityId: 'doc_a' }));
  assert.equal(candidate.isDestroyed(), true); assert.equal(owner.isDestroyed(), false);
  const other = setup(); await other.registry.openView({ role: 'code', entityId: 'code_a' });
  assert.throws(() => other.registry.bindWorkspace(new NativeWindow(1, 'siren://app/app.html')), e => e.code === 'ACCESS_REFUSED');
  const another = setup(); await another.registry.openView({ role: 'workspace', entityId: null });
  assert.throws(() => another.registry.bindWorkspace(new NativeWindow(99, 'siren://app/app.html')), e => e.code === 'ACCESS_REFUSED');
});

test('workspace preservation cannot forgive a prior failed native destruction', () => {
  const { registry } = setup(); const owner = new NativeWindow(99, 'siren://app/app.html');
  registry.bindWorkspace(owner); registry.activateWorkspace(); const destroy = owner.destroy.bind(owner);
  owner.destroy = () => { throw new Error('Owned native destruction failure'); };
  assert.throws(() => registry.invalidateEpoch(), e => e.code === 'WINDOW_DESTROY_FAILED');
  assert.throws(() => registry.invalidateEpoch({ preserveWorkspace: true }), e => e.code === 'WINDOW_DESTROY_FAILED');
  assert.throws(() => registry.activateWorkspace(), e => e.code === 'ACCESS_REFUSED');
  owner.destroy = destroy; registry.invalidateEpoch({ preserveWorkspace: true }); assert.equal(owner.isDestroyed(), true);
  assert.throws(() => registry.activateWorkspace(), e => e.code === 'ACCESS_REFUSED');
});

test('opens distinct native views with trusted project scope and serializable records', async () => {
  const { registry, creations } = setup();
  const first = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  const second = await registry.openView({ role: 'code', entityId: 'code_a', version: 3 });
  assert.notEqual(first.windowId, second.windowId);
  assert.deepEqual({ ...first, windowId: 'generated' }, {
    windowId: 'generated', role: 'docs', projectId: 'project_a', epoch: 1, entityId: 'doc_a', state: 'active',
  });
  assert.equal(creations[1].version, 3);
  assert.equal(creations[0].modal, false);
  assert.equal(Object.hasOwn(creations[0], 'parent'), false);
  assert.match(creations[0].mainFrameUrl, /^siren:\/\/app\/windows\/docs\.html\?windowId=/);
  assert.notEqual(creations[0].mainFrameUrl, creations[1].mainFrameUrl);
  assert.deepEqual(JSON.parse(JSON.stringify(registry.listViews())), [first, second]);
  assert.equal(Object.hasOwn(first, 'webContents'), false);
});

test('refuses forged scope, unsupported roles and malformed versions before creating a window', async () => {
  const { registry, windows } = setup();
  for (const request of [
    { role: 'docs', entityId: 'doc_a', projectId: 'project_b' },
    { role: 'docs', entityId: 'doc_a', windowId: 'forged' },
    { role: 'docs', entityId: 'doc_a', epoch: 99 },
    { role: 'terminal', entityId: 'code_a' },
    { role: 'admin', entityId: 'doc_a' },
    { role: 'docs', entityId: 'doc_a', version: -1 },
    { role: 'docs', entityId: 'doc_a', version: 'latest' },
    { role: 'docs', entityId: '../other' },
    { role: 'docs', entityId: null },
  ]) await refused(registry.openView(request));
  assert.equal(windows.length, 0);
});

test('refuses cross-project entities and absent or malformed native authorization', async () => {
  const { registry, native, windows } = setup();
  await refused(registry.openView({ role: 'docs', entityId: 'doc_b' }));
  native.projectId = '';
  await refused(registry.openView({ role: 'docs', entityId: 'doc_a' }));
  assert.equal(windows.length, 0);
  for (const authorization of [null, { projectId: 'project_a', mode: 'unknown', access: 'write', entityIds: ['doc_a'] },
    { projectId: 'project_a', mode: 'normal', access: 'write', entityIds: ['doc_a', '../forged'] }]) {
    const denied = setup({ authorize: () => authorization });
    await refused(denied.registry.openView({ role: 'docs', entityId: 'doc_a' }));
    assert.equal(denied.windows.length, 0);
  }
});

test('locked and readonly write authorization cannot create data windows', async () => {
  const { registry, native, windows } = setup();
  native.mode = 'locked';
  await refused(registry.openView({ role: 'docs', entityId: 'doc_a' }));
  native.mode = 'readonly';
  await refused(registry.openView({ role: 'code', entityId: 'code_a' }));
  native.mode = 'recovery';
  await refused(registry.openView({ role: 'docs', entityId: 'doc_a' }));
  assert.equal(windows.length, 0);
});

test('readonly and recovery read authorization admits eligible views without overriding safety', async () => {
  const { registry, native } = setup();
  native.mode = 'readonly'; native.access = 'read';
  const docs = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  native.mode = 'recovery';
  const code = await registry.openView({ role: 'code', entityId: 'code_a' });
  assert.equal(docs.projectId, 'project_a');
  assert.equal(code.projectId, 'project_a');
  assert.equal(registry.listViews().length, 2);
});

test('workspace scope permits no entity while audience requires presentation authorization', async () => {
  const { registry, native, windows } = setup();
  await registry.openView({ role: 'workspace', entityId: null });
  assert.equal(windows[0].webContents.getURL(), 'siren://app/app.html');
  await refused(registry.openView({ role: 'audience', entityId: 'deck_a' }));
  native.access = 'presentation';
  const audience = await registry.openView({ role: 'audience', entityId: 'deck_a', version: 2 });
  assert.equal(audience.role, 'audience');
  assert.equal(windows.length, 2);
  await refused(registry.openView({ role: 'code', entityId: 'code_a' }));
});

test('caller derives its grant from registered native objects and ignores forged payload identity', async () => {
  const { registry, windows } = setup();
  const view = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  const event = { ...eventFor(windows[0]), role: 'workspace', windowId: 'forged', projectId: 'project_b', epoch: 99 };
  const grant = registry.caller(event);
  assert.deepEqual(grant, {
    webContentsId: 1001, mainFrameUrl: windows[0].webContents.getURL(), windowId: view.windowId,
    role: 'docs', projectId: 'project_a', epoch: 1, entityIds: ['doc_a'],
  });
});

test('same URL and numeric renderer ID never grant an unregistered sender native object', async () => {
  const { registry, windows } = setup();
  await registry.openView({ role: 'docs', entityId: 'doc_a' });
  const impostor = new NativeWindow(1, windows[0].webContents.getURL());
  assert.equal(registry.caller(eventFor(impostor)), null);
  assert.equal(registry.caller({ sender: { id: 1001 }, senderFrame: windows[0].webContents.mainFrame }), null);
  assert.equal(registry.caller(null), null);
});

test('subframes and role, query or fragment URL substitutions never authorize IPC', async () => {
  const { registry, windows } = setup();
  await registry.openView({ role: 'docs', entityId: 'doc_a' });
  const window = windows[0];
  const trusted = window.webContents.getURL();
  assert.equal(registry.caller({ sender: window.webContents, senderFrame: { url: trusted } }), null);
  for (const url of [trusted.replace('/docs.html', '/workspace.html'), trusted + '&role=workspace', trusted + '#docs', 'https://example.com']) {
    window.webContents.mainFrame.url = url;
    assert.equal(registry.caller(eventFor(window)), null);
  }
  window.webContents.mainFrame.url = trusted;
  assert.equal(registry.caller(eventFor(window)).role, 'docs');
  window.webContents.getURL = () => 'siren://app/app.html';
  assert.equal(registry.caller(eventFor(window)), null);
});

test('live caller authorization refuses closed, destroyed or native ID replacement', async () => {
  for (const mutation of [
    window => { window.destroyed = true; },
    window => { window.webContents.destroyed = true; },
    window => { window.webContents.id = 9000; },
    window => { window.id = 9000; },
    window => { window.webContents = new NativeWindow(1, window.webContents.getURL()).webContents; },
  ]) {
    const { registry, windows } = setup();
    await registry.openView({ role: 'docs', entityId: 'doc_a' });
    const originalEvent = eventFor(windows[0]);
    mutation(windows[0]);
    assert.equal(registry.caller(originalEvent), null);
    assert.equal(registry.caller(eventFor(windows[0])), null);
  }
});

test('caller revalidates trusted current project, entity ownership, mode and access', async () => {
  for (const change of [
    native => { native.projectId = 'project_b'; },
    native => { native.entityIds = ['doc_b']; },
    native => { native.mode = 'locked'; },
    native => { native.mode = 'readonly'; },
    native => { native.access = 'read'; },
  ]) {
    const { registry, windows, native } = setup();
    await registry.openView({ role: 'docs', entityId: 'doc_a' });
    assert.ok(registry.caller(eventFor(windows[0])));
    change(native);
    assert.equal(registry.caller(eventFor(windows[0])), null);
  }
});

test('entity grants are isolated immutable snapshots and audience receives no source IDs', async () => {
  const { registry, windows, native } = setup();
  await registry.openView({ role: 'workspace', entityId: null });
  const workspace = registry.caller(eventFor(windows[0]));
  assert.deepEqual(workspace.entityIds, ['doc_a', 'code_a', 'deck_a']);
  assert.throws(() => workspace.entityIds.push('forged'), TypeError);
  assert.throws(() => { workspace.role = 'audience'; }, TypeError);
  native.entityIds.push('doc_b');
  assert.deepEqual(registry.caller(eventFor(windows[0])).entityIds, ['doc_a', 'code_a', 'deck_a']);
  native.access = 'presentation';
  await registry.openView({ role: 'audience', entityId: 'deck_a' });
  assert.deepEqual(registry.caller(eventFor(windows[1])).entityIds, []);
});

test('authorization exceptions and asynchronous policy never grant renderer access', async () => {
  let throws = false;
  const { registry, windows } = setup({ authorize: () => {
    if (throws) throw new Error('native policy unavailable');
    return { projectId: 'project_a', mode: 'normal', access: 'read', entityIds: ['doc_a'] };
  } });
  await registry.openView({ role: 'docs', entityId: 'doc_a' });
  throws = true;
  assert.equal(registry.caller(eventFor(windows[0])), null);
  await refused(registry.openView({ role: 'docs', entityId: 'doc_a' }));
  const asyncPolicy = setup({ authorize: async () => ({ projectId: 'project_a', mode: 'normal', access: 'read', entityIds: ['doc_a'] }) });
  await refused(asyncPolicy.registry.openView({ role: 'docs', entityId: 'doc_a' }));
});

test('focus restores a minimized native view and closing one view preserves the others', async () => {
  const { registry, windows } = setup();
  const docs = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  const code = await registry.openView({ role: 'code', entityId: 'code_a' });
  windows[0].minimized = true; windows[0].emit('minimize');
  assert.equal(registry.listViews()[0].state, 'minimized');
  assert.equal(registry.focusView('forged'), false);
  assert.equal(registry.focusView(docs.windowId), true);
  assert.equal(windows[0].minimized, false);
  assert.equal(windows[0].focused, true);
  assert.equal(registry.listViews()[0].state, 'active');
  assert.equal(registry.closeView('forged'), false);
  assert.equal(registry.closeView(docs.windowId), true);
  assert.equal(registry.caller(eventFor(windows[0])), null);
  assert.deepEqual(registry.listViews(), [code]);
  assert.equal(registry.caller(eventFor(windows[1])).role, 'code');
});

test('cancelled native close retains the registered view and its grant', async () => {
  const { registry, windows } = setup();
  const docs = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  windows[0].close = () => { windows[0].emit('close', { defaultPrevented: true, preventDefault() {} }); };
  assert.equal(registry.closeView(docs.windowId), false);
  assert.equal(registry.listViews().length, 1);
  assert.equal(registry.caller(eventFor(windows[0])).windowId, docs.windowId);
});

test('native close waits for actual asynchronous destruction without revoking a retained grant early', async () => {
  const { registry, windows } = setup();
  const view = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  windows[0].close = () => windows[0].emit('close', { defaultPrevented: false });
  const pending = registry.closeView(view.windowId);
  assert.equal(typeof pending?.then, 'function');
  assert.equal(registry.caller(eventFor(windows[0])).windowId, view.windowId);
  let finished = false; Promise.resolve(pending).then(() => { finished = true; });
  await Promise.resolve(); assert.equal(finished, false);
  windows[0].destroy();
  assert.equal(await pending, true);
  assert.equal(registry.caller(eventFor(windows[0])), null);
  assert.equal(windows[0].listenerCount('close'), 0);
});

test('a pending close has a bounded deadline and keeps a canceled or unresponsive native view intact', async () => {
  const windows = [];
  const registry = new WindowRegistry({ closeTimeoutMs: 15,
    authorize: () => ({ projectId: 'project_a', mode: 'normal', access: 'read', entityIds: ['doc_a'] }),
    createWindow: options => { const window = new NativeWindow(1, options.mainFrameUrl); windows.push(window); return window; },
  });
  const view = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  windows[0].close = () => windows[0].emit('close', { defaultPrevented: false });
  const pending = registry.closeView(view.windowId);
  assert.equal(typeof pending?.then, 'function');
  const second = registry.closeView(view.windowId);
  await Promise.all([assert.rejects(pending, e => e.code === 'WINDOW_CLOSE_TIMEOUT'), assert.rejects(second, e => e.code === 'WINDOW_CLOSE_TIMEOUT')]);
  assert.equal(windows[0].isDestroyed(), false);
  assert.equal(registry.caller(eventFor(windows[0])).windowId, view.windowId);
  assert.equal(windows[0].listenerCount('close'), 0);
});

test('native destruction, crash and main navigation permanently revoke the renderer grant', async () => {
  for (const signal of [
    window => window.destroy(),
    window => window.webContents.emit('render-process-gone', {}, { reason: 'crashed' }),
    window => window.webContents.emit('will-navigate', {}, window.webContents.getURL()),
    window => window.webContents.emit('did-start-navigation', {}, window.webContents.getURL(), false, true),
  ]) {
    const { registry, windows } = setup();
    await registry.openView({ role: 'docs', entityId: 'doc_a' });
    const originalEvent = eventFor(windows[0]);
    signal(windows[0]);
    assert.equal(registry.caller(originalEvent), null);
    assert.deepEqual(registry.listViews(), []);
    // Returning to the exact same URL cannot resurrect a retired sender.
    assert.equal(registry.caller(eventFor(windows[0])), null);
  }
});

test('subframe navigation cannot revoke the unrelated main-frame view', async () => {
  const { registry, windows } = setup();
  const docs = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  windows[0].webContents.emit('did-start-navigation', {}, 'siren://app/child.html', false, false);
  assert.equal(registry.caller(eventFor(windows[0])).windowId, docs.windowId);
});

test('epoch invalidation destroys minimized and audience views and locked policy blocks new grants', async () => {
  const { registry, windows, native } = setup();
  const old = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  windows[0].minimized = true;
  native.access = 'presentation';
  await registry.openView({ role: 'audience', entityId: 'deck_a' });
  native.mode = 'locked';
  assert.equal(registry.invalidateEpoch(), 2);
  assert.deepEqual(registry.listViews(), []);
  assert.equal(windows.every(window => window.isDestroyed()), true);
  assert.equal(registry.caller(eventFor(windows[0])), null);
  await refused(registry.openView({ role: 'docs', entityId: 'doc_a' }));
  native.mode = 'readonly'; native.access = 'read';
  const next = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  assert.equal(next.epoch, 2);
  assert.notEqual(next.windowId, old.windowId);
});

test('pending creation cannot publish after epoch invalidation or a native policy change', async () => {
  for (const change of [
    (registry, native) => registry.invalidateEpoch(),
    (_registry, native) => { native.mode = 'locked'; },
    (_registry, native) => { native.projectId = 'project_b'; },
    (_registry, native) => { native.mode = 'readonly'; native.access = 'read'; },
    (_registry, native) => { native.entityIds = ['doc_b']; },
  ]) {
    let finish;
    const made = [];
    const { registry, native } = setup({ createWindow: options => new Promise(resolve => {
      finish = () => { const window = new NativeWindow(1, options.mainFrameUrl); made.push(window); resolve(window); };
    }) });
    const pending = registry.openView({ role: 'docs', entityId: 'doc_a' });
    const denied = refused(pending);
    change(registry, native);
    finish();
    await denied;
    assert.equal(made[0].isDestroyed(), true);
    assert.deepEqual(registry.listViews(), []);
    assert.equal(registry.caller(eventFor(made[0])), null);
  }
});

test('a destroyed or reused factory renderer cannot acquire a second view grant', async () => {
  let reusable;
  const { registry } = setup({ createWindow: options => {
    if (!reusable) reusable = new NativeWindow(1, options.mainFrameUrl);
    return reusable;
  } });
  const first = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  await refused(registry.openView({ role: 'code', entityId: 'code_a' }));
  assert.deepEqual(registry.listViews(), [first]);
  assert.equal(registry.caller(eventFor(reusable)).role, 'docs');
  const dead = setup({ createWindow: options => {
    const window = new NativeWindow(5, options.mainFrameUrl); window.destroy(); return window;
  } });
  await refused(dead.registry.openView({ role: 'docs', entityId: 'doc_a' }));
  assert.deepEqual(dead.registry.listViews(), []);
});

test('returned view records cannot mutate registry role, epoch or lifecycle state', async () => {
  const { registry, windows } = setup();
  const docs = await registry.openView({ role: 'docs', entityId: 'doc_a' });
  assert.throws(() => { docs.role = 'workspace'; }, TypeError);
  const listed = registry.listViews()[0];
  listed.role = 'workspace'; listed.epoch = 999; listed.state = 'closed';
  assert.equal(registry.caller(eventFor(windows[0])).role, 'docs');
  assert.equal(registry.listViews()[0].epoch, 1);
  assert.equal(registry.listViews()[0].state, 'active');
});

test('a replacement main-frame object at the same URL cannot inherit a prior grant', async () => {
  const { registry, windows } = setup();
  await registry.openView({ role: 'docs', entityId: 'doc_a' });
  const window = windows[0];
  window.webContents.mainFrame = { url: window.webContents.getURL() };
  assert.equal(registry.caller(eventFor(window)), null);
});

test('factory identity collisions reject the new view without destroying an existing renderer', async () => {
  for (const collision of ['window', 'webContents']) {
    const made = [];
    const { registry } = setup({ createWindow: options => {
      const window = new NativeWindow(made.length + 1, options.mainFrameUrl);
      if (made.length) {
        if (collision === 'window') window.id = made[0].id;
        else window.webContents.id = made[0].webContents.id;
      }
      made.push(window);
      return window;
    } });
    const first = await registry.openView({ role: 'docs', entityId: 'doc_a' });
    await refused(registry.openView({ role: 'code', entityId: 'code_a' }));
    assert.equal(made[0].isDestroyed(), false);
    assert.equal(made[1].isDestroyed(), true);
    assert.deepEqual(registry.listViews(), [first]);
  }
});

test('failed epoch destruction revokes every grant and blocks new windows until destruction completes', async () => {
  const { registry, windows } = setup();
  await registry.openView({ role: 'docs', entityId: 'doc_a' });
  await registry.openView({ role: 'code', entityId: 'code_a' });
  const realDestroy = windows[0].destroy.bind(windows[0]);
  windows[0].destroy = () => { throw new Error('native destroy failed'); };
  assert.throws(() => registry.invalidateEpoch(), error => error.code === 'WINDOW_DESTROY_FAILED');
  assert.equal(windows[1].isDestroyed(), true);
  assert.equal(registry.caller(eventFor(windows[0])), null);
  assert.deepEqual(registry.listViews(), []);
  await refused(registry.openView({ role: 'docs', entityId: 'doc_a' }));
  windows[0].destroy = realDestroy;
  assert.equal(registry.invalidateEpoch(), 3);
  assert.equal((await registry.openView({ role: 'docs', entityId: 'doc_a' })).epoch, 3);
});

test('sparse trusted entity lists and malformed native windows fail closed without publishing', async () => {
  const { registry, native } = setup();
  native.entityIds = ['doc_a', , 'code_a'];
  await refused(registry.openView({ role: 'docs', entityId: 'doc_a' }));
  for (const factory of [() => null, () => ({}), options => new NativeWindow(0, options.mainFrameUrl)]) {
    const denied = setup({ createWindow: factory });
    await refused(denied.registry.openView({ role: 'docs', entityId: 'doc_a' }));
    assert.deepEqual(denied.registry.listViews(), []);
  }
});

test('a failed stale factory disposal is retained for epoch retry and never gains a grant', async () => {
  let finish;
  let late;
  const { registry } = setup({ createWindow: options => new Promise(resolve => {
    finish = () => {
      late = new NativeWindow(1, options.mainFrameUrl);
      late.destroy = () => { throw new Error('late native destruction failed'); };
      resolve(late);
    };
  }) });
  const pending = registry.openView({ role: 'docs', entityId: 'doc_a' });
  registry.invalidateEpoch();
  finish();
  await assert.rejects(pending, error => error.code === 'WINDOW_DESTROY_FAILED');
  assert.equal(registry.caller(eventFor(late)), null);
  assert.deepEqual(registry.listViews(), []);
  await refused(registry.openView({ role: 'docs', entityId: 'doc_a' }));
  late.destroy = NativeWindow.prototype.destroy.bind(late);
  assert.equal(registry.invalidateEpoch(), 3);
  assert.equal(late.isDestroyed(), true);
});

test('navigation destruction failure revokes synchronously and prevents new grants until retry', async () => {
  const { registry, windows } = setup();
  await registry.openView({ role: 'docs', entityId: 'doc_a' });
  windows[0].destroy = () => { throw new Error('navigation destruction failed'); };
  assert.doesNotThrow(() => windows[0].webContents.emit('will-navigate', {}, 'https://example.com'));
  assert.equal(registry.caller(eventFor(windows[0])), null);
  await refused(registry.openView({ role: 'code', entityId: 'code_a' }));
  windows[0].destroy = NativeWindow.prototype.destroy.bind(windows[0]);
  assert.equal(registry.invalidateEpoch(), 2);
  assert.equal(windows[0].isDestroyed(), true);
});

test('a pending factory cannot publish after another view fails navigation destruction', async () => {
  const windows = []; let finish;
  const { registry } = setup({ createWindow: options => {
    const window = new NativeWindow(windows.length + 1, options.mainFrameUrl);
    windows.push(window);
    return options.role === 'code' ? new Promise(resolve => { finish = () => resolve(window); }) : window;
  } });
  await registry.openView({ role: 'docs', entityId: 'doc_a' });
  const pending = registry.openView({ role: 'code', entityId: 'code_a' });
  windows[0].destroy = () => { throw new Error('native destruction unavailable'); };
  windows[0].webContents.emit('will-navigate', {}, 'https://example.com');
  finish();
  await refused(pending);
  assert.equal(windows[1].isDestroyed(), true);
  assert.equal(registry.caller(eventFor(windows[1])), null);
  assert.deepEqual(registry.listViews(), []);
  await refused(registry.openView({ role: 'code', entityId: 'code_a' }));
  windows[0].destroy = NativeWindow.prototype.destroy.bind(windows[0]);
  registry.invalidateEpoch();
  assert.equal((await registry.openView({ role: 'docs', entityId: 'doc_a' })).epoch, 2);
});
