import { app, BrowserWindow, ipcMain, protocol, net, session, dialog, shell, safeStorage, Menu, screen } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { join, basename } from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolveLocalResource } from './protocol.mjs';
import { invokeDesktop, failure } from './ipc.mjs';
import { chooseDataRoot, writableDataRoot } from './data-root.mjs';
import { ProjectStore } from './projects/store.mjs';
import { SourceRepository } from './sources/repository.mjs';
import { runAfterWorkspaceLoad } from './windows/readiness.mjs';
import { WindowRegistry } from './windows/registry.mjs';
import { invokeWindow } from './windows/ipc.mjs';
import { nativeViewFactory } from './windows/factory.mjs';
import { workspaceEntities } from './windows/entities.mjs';
import { openOwnedSelection } from './projects/selection.mjs';
import { parseLegacyImport } from './projects/migration.mjs';
import { atomicWrite } from './projects/atomic.mjs';
import { ownedFile, validId } from './projects/paths.mjs';
import { RecoveryStore } from './recovery/checkpoints.mjs';
import { RecoveryAccess } from './recovery/access.mjs';
import { SessionJournal } from './recovery/sessions.mjs';
import { inspectWindowsProcess } from './recovery/processes.mjs';
import { publisherConfig } from './publisher-config.mjs';
import { CredentialStore } from './account/credentials.mjs';
import { AccountService } from './account/service.mjs';
import { LocalPinAccess } from './account/local-pin.mjs';
import { readOwnedBytes } from './projects/io.mjs';
import { UpdateService } from './updates/service.mjs';
import { buildDiagnostics } from './recovery/diagnostics.mjs';
import { release as osRelease } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const rendererRoot = resolve(here, '../generated');
protocol.registerSchemesAsPrivileged([{ scheme: 'siren', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
// Dev paths are separate from packaged/user data. No fallback silently changes the data root.
const devArgument = prefix => !app.isPackaged ? process.argv.find(a => a.startsWith(prefix))?.slice(prefix.length) : undefined;
const preferred = app.isPackaged ? resolve(dirname(app.getPath('exe')), '../../..', 'Data') : resolve(devArgument('--siren-test-root=') || resolve(here, '../.dev-data'));
let dataRoot = null;
try { dataRoot = await writableDataRoot(preferred); app.setPath('userData', dataRoot); } catch { /* user choice occurs after ready */ }
// Do not top-level await ready: the ESM entry must finish before Electron emits ready.
app.whenReady().then(async () => {
if (!dataRoot) dataRoot = await chooseDataRoot({ preferred, choose: async () => {
  const reply = await dialog.showOpenDialog({ title: 'SIREN — Choose a writable data folder', message: 'The portable data folder cannot be used. Select a folder explicitly, or cancel without opening a project.', properties: ['openDirectory', 'createDirectory'] });
  return reply.canceled ? null : reply.filePaths[0];
} });
if (!dataRoot) { app.exit(0); return; }
else app.setPath('userData', dataRoot);
if (!app.requestSingleInstanceLock()) { app.quit(); return; }
const sessionId = randomUUID();
const processIdentity = await inspectWindowsProcess(process.pid);
const journal = new SessionJournal(dataRoot, { inspectProcess: inspectWindowsProcess });
const startup = processIdentity ? await journal.inspectStartup() : { mode: 'readonly', reason: 'Process identity unavailable; use explicit recovery/export' };
if (processIdentity) await journal.recordSession({ event: 'opened', sessionId, version: app.getVersion(), processIdentity });
const writerOptions = { ownerIdentity: processIdentity, inspectProcess: inspectWindowsProcess };
const account = new AccountService({ config: publisherConfig.account, credentials: new CredentialStore(dataRoot, safeStorage), openBrowser: url => shell.openExternal(url) });
await account.getAccess();
const localPin = new LocalPinAccess(dataRoot, safeStorage);
await localPin.initialize();
let mode = startup.mode; let reason = startup.reason; let nativeReadonly = mode === 'readonly';
let accountTransition = false; let accountQuiesced = false; let pinTransition = false;
const projects = new ProjectStore(dataRoot, { ...writerOptions, canSave: async ({ action, projectId }) => {
  if (accountQuiesced || (['workspace', 'create'].includes(action) && (nativeReadonly || mode !== 'normal'))) return false;
  return localPin.state().unlocked;
} });
const sources = new SourceRepository(dataRoot, { ...writerOptions, canWrite: async ({ action }) => {
  if (accountQuiesced || !localPin.state().unlocked) return false;
  if (['read', 'export'].includes(action)) return true;
  // No source IPC is exposed yet. Trusted recovery copies may write only while
  // the existing renderer is quiesced; normal edits retain the native mode gate.
  return (!nativeReadonly && mode === 'normal') || Boolean(writes.selectionQuiesced);
} });
const recovery = new RecoveryStore(dataRoot, { ...writerOptions, sources });
const updates = new UpdateService({ root: dataRoot, config: publisherConfig.updates, currentVersion: '1.131.0', onStatus: state => { if (!window.isDestroyed()) window.webContents.send('siren:status', { kind: 'updates', state }); } });
let selectedId = devArgument('--siren-test-project=') || null;
if (!selectedId) { try { const record = JSON.parse((await readOwnedBytes(join(dataRoot, 'session-selection.json'), 65536)).toString('utf8')); if (validId(record.projectId)) selectedId = record.projectId; } catch { /* no implicit browser/profile import */ } }
let snapshot = null;
if (selectedId && mode === 'normal') {
  try { snapshot = await projects.readProject(selectedId); }
  catch { mode = 'recovery'; reason = 'Selected project is damaged; open a verified recovered copy'; }
}
if (selectedId) account.policy.opened(selectedId);
if (snapshot?.schema === 2) reason = 'Schema 2 sources require the source-aware workspace; the legacy view is read-only';
let bootstrap = { mode, reason, snapshot, recoveryProjectId: selectedId, readonly: !snapshot || mode !== 'normal' || snapshot.schema !== 1, localAccess: true, selectionGeneration: 0 };
const grants = new Set(selectedId ? [selectedId] : []);
const recoveryAccess = new RecoveryAccess({ projects, recovery, grants });
const writes = new Set();
const selected = async next => {
  await atomicWrite(join(dataRoot, 'session-selection.json'), Buffer.from(JSON.stringify({ schema: 1, projectId: next.project.id, accountId: account.accountId })));
  selectedId = next.project.id; grants.add(selectedId); snapshot = next;
  account.policy.opened(selectedId);
  mode = nativeReadonly ? 'readonly' : 'normal'; reason = nativeReadonly ? reason : null;
  if (next.schema !== 1) reason = 'Schema 2 sources require the source-aware workspace; the legacy view is read-only';
  bootstrap = { mode, reason, snapshot: next, recoveryProjectId: selectedId, readonly: nativeReadonly || next.schema !== 1, localAccess: true, selectionGeneration: (bootstrap.selectionGeneration || 0) + 1 };
  return next;
};
const changeSelection = async action => {
  if (writes.selectionTransition || accountTransition || pinTransition) return failure('PROJECT_BUSY', 'Wait for the current access or project transition');
  writes.selectionTransition = true; let changed = false; const generation = bootstrap.selectionGeneration;
  try {
    // Renderer flush can still submit writes until it locks its adapter. Only
    // then refuse late native saves and drain the tracked operations.
    await window.webContents.executeJavaScript('window.sirenDesktopBeginAccountTransition()');
    writes.selectionQuiesced = true;
    await Promise.all([...writes]);
    retireNativeViews();
    const result = await action(); changed = bootstrap.selectionGeneration !== generation; return result;
  } finally {
    writes.selectionQuiesced = false; writes.selectionTransition = false;
    // A successful selection reloads the renderer; keep that old view frozen.
    if (!changed) {
      await window.webContents.executeJavaScript('window.sirenDesktopEndAccountTransition?.()').catch(() => {});
      try { windowRegistry.activateWorkspace(); } catch { /* Native failure remains fenced. */ }
    }
  }
};
const exportBytes = async (bytes, suggested) => {
  const result = await dialog.showSaveDialog({ title: 'Export local SIREN data', defaultPath: suggested });
  if (result.canceled || !result.filePath) return failure('CANCELLED', 'Export cancelled');
  await atomicWrite(result.filePath, bytes);
  return { ok: true };
};
// First local unlock creates an owned empty workspace only when no selection exists.
// Never replace a selection or conceal startup recovery.
const prepareLocalWorkspace = async result => {
  if (result.ok && !selectedId && mode === 'normal') {
    try {
      await selected(await projects.createProject({ label: 'Untitled desktop project', json: JSON.stringify({ kind: 'siren-desktop', schema: 1, storage: {} }) }));
    } catch {
      localPin.lock();
      return failure('WORKSPACE_UNAVAILABLE', 'Your PIN was retained, but the local workspace could not be prepared. Unlock to retry.');
    }
  }
  return result;
};
session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
session.defaultSession.setPermissionCheckHandler(() => false);
protocol.handle('siren', async request => {
  try { return await net.fetch(pathToFileURL(await resolveLocalResource({ url: request.url, rendererRoot })).href); }
  catch { return new Response('Resource refused', { status: 403 }); }
});
const services = {
  getPinState: () => localPin.state(),
  setupPin: async payload => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : runAfterWorkspaceLoad(window.webContents, async () => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : prepareLocalWorkspace(await localPin.setup(payload))),
  unlockPin: async payload => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : runAfterWorkspaceLoad(window.webContents, async () => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : prepareLocalWorkspace(await localPin.unlock(payload))),
  verifyCurrentPin: payload => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : localPin.verifyCurrent(payload),
  changePin: payload => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : localPin.change(payload),
  lockPin: async () => {
    if (pinTransition || accountTransition) return failure('PIN_BUSY', 'Local access is changing.');
    pinTransition = true;
    try {
      await window.webContents.executeJavaScript('window.sirenDesktopBeginAccountTransition()');
      accountQuiesced = true;
      await Promise.all([...writes]);
      retireNativeViews();
      localPin.lock(); return { ok: true };
    } catch (error) {
      await window.webContents.executeJavaScript('window.sirenDesktopEndAccountTransition?.()').catch(() => {});
      if (error?.code === 'WINDOW_DESTROY_FAILED') return failure('WINDOW_DESTROY_FAILED', 'SIREN could not protect every native window. Lock was not confirmed; your project was retained.');
      return failure('SAVE_FAILED', 'SIREN could not confirm your local changes. The workspace remains open.');
    } finally {
      accountQuiesced = false; pinTransition = false;
      if (localPin.state().unlocked) { try { windowRegistry.activateWorkspace(); } catch { /* Native failure remains fenced. */ } }
    }
  },
  requestClose: async () => { window.close(); return { ok: true }; },
  exportDiagnostics: async () => {
    const points = await recovery.scan();
    const report = buildDiagnostics({ desktopVersion: app.getVersion(), rendererVersion: '1.131.0', electron: process.versions.electron, chromium: process.versions.chrome, node: process.versions.node, platform: process.platform, arch: process.arch, osRelease: osRelease(), mode, accountState: (await account.getAccess()).state, updatePhase: updates.getUpdate().phase, projectCount: (await projects.listProjects()).length, verifiedPointCount: points.valid.length, damagedPointCount: points.invalid.length });
    return exportBytes(Buffer.from(JSON.stringify(report, null, 2)), 'SIREN-diagnostics.json');
  },
  getAccess: () => account.getAccess(),
  beginLogin: async () => {
    if (accountTransition) return failure('ACCOUNT_BUSY', 'An account transition is already pending');
    accountTransition = true; let committed = false;
    try {
      const state = await account.beginLogin({ beforeCommit: async () => {
        await window.webContents.executeJavaScript('window.sirenDesktopBeginAccountTransition()');
        accountQuiesced = true;
        await Promise.all([...writes]);
        retireNativeViews();
      } });
      if (state.ok !== false) { grants.clear(); selectedId = null; snapshot = null; bootstrap = { mode, reason, snapshot: null, recoveryProjectId: null, readonly: true }; committed = true; }
      return state;
    } finally {
      accountQuiesced = false; accountTransition = false;
      if (!committed) {
        await window.webContents.executeJavaScript('window.sirenDesktopEndAccountTransition?.()').catch(() => {});
        try { windowRegistry.activateWorkspace(); } catch { /* Native failure remains fenced. */ }
      }
    }
  },
  logout: async () => {
    if (accountTransition) return failure('ACCOUNT_BUSY', 'An account transition is already pending');
    accountTransition = true; let committed = false;
    try {
      await window.webContents.executeJavaScript('window.sirenDesktopBeginAccountTransition()');
      accountQuiesced = true; await Promise.all([...writes]);
      retireNativeViews();
      const state = await account.logout(); bootstrap = { ...bootstrap, readonly: true }; committed = true; return state;
    } finally {
      accountQuiesced = false; accountTransition = false;
      if (!committed) {
        await window.webContents.executeJavaScript('window.sirenDesktopEndAccountTransition?.()').catch(() => {});
        try { windowRegistry.activateWorkspace(); } catch { /* Native failure remains fenced. */ }
      }
    }
  },
  getUpdate: () => updates.getUpdate(),
  checkForUpdates: () => updates.checkForUpdates(),
  downloadUpdate: () => updates.downloadUpdate(),
  cancelUpdate: () => updates.cancelUpdate(),
  restartAndUpdate: async () => failure('HELPER_NOT_QUALIFIED', 'The verified package is staged; installation requires the qualified launcher/helper'),
  pickProject: async () => {
    return changeSelection(async () => {
    const choice = await dialog.showMessageBox({ type: 'question', title: 'SIREN local project', message: 'Choose a desktop project', detail: 'Opening another project replaces this view. Save or export pending work first. Browser data is imported only from a file you choose.', buttons: ['New project', 'Open project folder', 'Import .siren / JSON', 'Cancel'], cancelId: 3, defaultId: 3 });
    if (choice.response === 3) return failure('CANCELLED', 'No project changed');
    if (choice.response === 0) {
      const next = await projects.createProject({ label: 'New project', json: JSON.stringify({ diagrams: [] }) });
      await recovery.checkpointProject({ snapshot: next, kind: 'saved' }); return selected(next);
    }
    const answer = await dialog.showOpenDialog({ title: choice.response === 1 ? 'Choose an owned project folder in this data directory' : 'Import an exported SIREN project', defaultPath: choice.response === 1 ? join(dataRoot, 'Projects') : undefined, properties: [choice.response === 1 ? 'openDirectory' : 'openFile'] });
    if (answer.canceled) return failure('CANCELLED', 'No project changed');
    if (choice.response === 1) {
      const id = basename(answer.filePaths[0]);
      if (resolve(answer.filePaths[0]).toLowerCase() !== resolve(dataRoot, 'Projects', id).toLowerCase()) return failure('PROJECT_REFUSED', 'Choose an owned project folder; move data through explicit import');
      return openOwnedSelection({ projectId: id, projects, grants, selected, recoverySelected: async projectId => {
        await atomicWrite(join(dataRoot, 'session-selection.json'), Buffer.from(JSON.stringify({ schema: 1, projectId, accountId: account.accountId })));
        selectedId = projectId; snapshot = null; mode = 'recovery'; reason = 'The selected project is damaged; open a verified recovered copy';
        bootstrap = { mode, reason, snapshot: null, recoveryProjectId: projectId, readonly: true, localAccess: true, selectionGeneration: (bootstrap.selectionGeneration || 0) + 1 };
      } });
    }
    const input = await readOwnedBytes(await realpath(answer.filePaths[0]), 64 * 1024 * 1024);
    // Existing renderer import validation and imported-file sign-off provenance run before disk creation.
    if (input.length > 64 * 1024 * 1024) return failure('IMPORT_TOO_LARGE', 'Desktop import exceeds the 64 MiB foundation limit');
    const validated = await window.webContents.executeJavaScript(`window.sirenDesktopValidateImport(${JSON.stringify(input.toString('utf8'))},${JSON.stringify(basename(answer.filePaths[0]))})`);
    const next = await projects.createProject({ label: basename(answer.filePaths[0]).slice(0, 180), json: parseLegacyImport(Buffer.from(validated)) });
    await recovery.checkpointProject({ snapshot: next, kind: 'saved' }); return selected(next);
    });
  },
  saveProject: async request => {
    if (writes.selectionQuiesced) return failure('PROJECT_BUSY', 'Project selection is changing; keep the live work and retry after opening');
    if (!grants.has(request.projectId)) return failure('PROJECT_REFUSED', 'Project is not open in this session');
    const selectionId = selectedId; const selectionGeneration = bootstrap.selectionGeneration;
    const operation = (async () => {
      const result = await projects.saveProject(request);
      if (!result.ok) return result;
      const current = request.purpose === 'workspace' ? await projects.readProject(request.projectId) : { ...await projects.readProject(request.projectId), json: request.json, sha256: result.sha256 };
      const workspaceCommitted = request.purpose === 'workspace' && current.revision === request.baseRevision + (result.unchanged === true ? 0 : 1) && current.revision === result.revision && current.json === request.json && current.sha256 === result.sha256;
      if (request.purpose === 'workspace' && !workspaceCommitted) return failure('SAVE_UNVERIFIED', 'The attempted workspace commit could not be verified; inspect recovery before retrying');
      if (workspaceCommitted && selectionId === request.projectId && selectedId === selectionId && bootstrap.selectionGeneration === selectionGeneration) { snapshot = current; bootstrap = { ...bootstrap, snapshot: current }; }
      try { await recovery.checkpointProject({ snapshot: current, kind: request.purpose === 'workspace' ? 'saved' : 'draft' }); }
      catch (error) { return { ...failure('RECOVERY_DEGRADED', 'Recovery checkpoint was not acknowledged. Export and inspect recovery.'), workspaceCommitted, ...(result.unchanged === true ? { unchanged: true } : {}), ...(workspaceCommitted ? { committedRevision: current.revision, committedSha256: current.sha256 } : {}), checkpointAcknowledged: false, recoveryCode: typeof error.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) ? error.code : 'CHECKPOINT_FAILED' }; }
      if (request.purpose === 'workspace') { try { await projects.pruneRevisions({ snapshot: current, recovery }); } catch { /* safe to retain extra revisions */ } }
      try { await projects.acknowledgePending(request.projectId, result.pendingId); } catch { /* keep original if cleanup fails */ }
      return { ok: true, revision: result.revision, sha256: result.sha256 };
    })();
    writes.add(operation); try { return await operation; } finally { writes.delete(operation); }
  },
  exportProject: async id => {
    if (!grants.has(id)) return failure('PROJECT_REFUSED', 'Project not selected');
    const snapshot = await projects.readProject(id);
    const bytes = snapshot.schema === 2 ? await recovery.exportSourceSnapshot(snapshot) : Buffer.from(snapshot.json);
    return exportBytes(bytes, `SIREN-${id}.siren-backup`);
  },
  getRecovery: async id => grants.has(id) ? recoveryAccess.inspect(id) : failure('PROJECT_REFUSED', 'Project not selected'),
  restoreRecovery: async id => {
    return changeSelection(async () => selected(await recoveryAccess.restore(id)));
  },
  exportRecovery: async id => {
    const bytes = await recoveryAccess.export(id);
    return exportBytes(bytes, `SIREN-recovery-${id}.siren-backup`);
  },
};
const window = new BrowserWindow({ width: 1440, height: 960, minWidth: 960, minHeight: 640, title: 'SIREN — Desktop prototype', backgroundColor: '#171719', webPreferences: {
  preload: resolve(here, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
} });
const nativeShells = new Map(); let nativeShellFailure = false;
const windowRegistry = new WindowRegistry({
  authorize: request => {
    if (!localPin.state().unlocked || !selectedId || !snapshot || accountQuiesced || writes.selectionQuiesced || nativeShellFailure) return null;
    const roster = workspaceEntities(snapshot);
    const entityIds = request.role === 'workspace' ? [...new Set([...roster.code, ...roster.docs])] : roster[request.role];
    if (!entityIds) return null;
    if (request.role === 'code' && Object.hasOwn(request, 'version') && !snapshot.sourceRefs?.some(ref => ref.sourceId === request.entityId && ref.version === request.version)) return null;
    const nativeMode = mode === 'normal' && !nativeReadonly ? 'normal' : mode === 'recovery' ? 'recovery' : 'readonly';
    return { projectId: selectedId, mode: nativeMode, access: nativeMode === 'normal' ? 'write' : 'read', entityIds };
  },
  createWindow: nativeViewFactory({ BrowserWindow, displays: () => {
    const primaryId = screen.getPrimaryDisplay().id;
    return screen.getAllDisplays().map(display => ({ id: display.id, workArea: display.workArea, primary: display.id === primaryId }));
  }, preload: resolve(here, 'windows/preload.cjs'), onCreated: (view, record) => {
    nativeShells.set(record.windowId, view);
    view.on('closed', () => nativeShells.delete(record.windowId));
  } }),
});
windowRegistry.bindWorkspace(window);
const retireNativeViews = () => {
  let failed = false;
  try { windowRegistry.invalidateEpoch({ preserveWorkspace: true }); } catch { failed = true; }
  // Includes hidden pending factories, which have no registry grant yet.
  for (const view of nativeShells.values()) {
    try { if (!view.isDestroyed()) view.destroy(); if (!view.isDestroyed()) failed = true; } catch { failed = true; }
  }
  nativeShellFailure = failed;
  if (failed) throw Object.assign(new Error('Native window protection incomplete'), { code: 'WINDOW_DESTROY_FAILED' });
};
const desktopCommand = id => { if (!window.isDestroyed()) window.webContents.send('siren:command', id); };
Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'File', submenu: [
    { label: 'Settings…', accelerator: 'Ctrl+,', click: () => desktopCommand('desktopPinSettings') },
    { label: 'Lock SIREN', accelerator: 'Ctrl+Alt+L', click: () => desktopCommand('desktopLockPin') },
    { label: 'Open / import local project…', accelerator: 'Ctrl+Alt+O', click: () => desktopCommand('desktopOpenProject') },
    { label: 'Export saved backup…', accelerator: 'Ctrl+Alt+E', click: () => desktopCommand('desktopExportProject') },
    { type: 'separator' }, { label: 'Quit SIREN', accelerator: 'Ctrl+Q', click: () => window.close() },
  ] },
  { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  { label: 'View', submenu: [{ role: 'togglefullscreen' }] },
  { label: 'Help', submenu: [
    { label: 'Settings…', click: () => desktopCommand('desktopPinSettings') },
    { label: 'Check for Updates…', accelerator: 'Ctrl+Alt+U', click: () => desktopCommand('desktopCheckUpdates') },
    { label: 'Disaster Recovery…', accelerator: 'Ctrl+Alt+R', click: () => desktopCommand('desktopRecovery') },
    { type: 'separator' }, { label: 'Desktop guide…', click: () => desktopCommand('desktopGuide') },
  ] },
]));
if (!app.isPackaged) window.webContents.on('console-message', event => { if (event.level === 'error' || event.level >= 2) console.error('Renderer:', event.message?.slice(0, 800)); });
ipcMain.on('siren:bootstrap', event => {
  const trusted = event.sender === window.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === 'siren://app/app.html';
  if (!trusted) { event.returnValue = { mode: 'readonly', reason: 'Bootstrap request refused', snapshot: null }; return; }
  if (!localPin.state().unlocked) { event.returnValue = { mode: 'locked', readonly: true, snapshot: null, recoveryProjectId: null, localAccess: true, pin: localPin.state() }; return; }
  if (snapshot) {
    try { windowRegistry.activateWorkspace(); if (!windowRegistry.caller(event)) throw new Error('Native grant unavailable'); }
    catch { event.returnValue = { mode: 'readonly', reason: 'Native workspace access refused; existing data was retained', snapshot: null, recoveryProjectId: selectedId, readonly: true, localAccess: true, pin: localPin.state() }; return; }
  }
  event.returnValue = { ...bootstrap, pin: localPin.state() };
});
let readyRecorded = false;
ipcMain.on('siren:ready', async event => {
  if (readyRecorded || event.sender !== window.webContents || event.senderFrame !== event.sender.mainFrame || event.senderFrame.url !== 'siren://app/app.html') return;
  try {
    if (processIdentity) await journal.recordSession({ event: 'ready', sessionId, version: app.getVersion(), processIdentity });
    readyRecorded = true;
  } catch {
    nativeReadonly = true; mode = 'readonly'; reason = 'Readiness journal could not be confirmed; preserve/export existing work';
    bootstrap = { ...bootstrap, mode, readonly: true, reason };
    if (!window.isDestroyed()) window.webContents.send('siren:status', { kind: 'safety', mode, readonly: true, reason });
  }
});
ipcMain.handle('siren:desktop', (event, method, payload) => {
  if (writes.selectionTransition && ['pickProject', 'restoreRecovery', 'setupPin', 'unlockPin', 'changePin', 'lockPin', 'beginLogin', 'logout'].includes(method)) return failure('PROJECT_BUSY', 'Wait for the project transition before changing access or selection');
  if (accountTransition && ['pickProject', 'restoreRecovery'].includes(method)) return failure('ACCOUNT_BUSY', 'Wait for the account transition before changing projects');
  return invokeDesktop({ method, payload,
    context: { senderUrl: event.senderFrame?.url, isMainFrame: event.sender === window.webContents && event.senderFrame === event.sender.mainFrame }, services, localAccess: localPin });
});
ipcMain.handle('siren:windows', async (event, method, payload) => {
  if (pinTransition || writes.selectionTransition || accountQuiesced || nativeShellFailure) return failure('PROJECT_BUSY', 'Wait for the current workspace transition');
  const before = windowRegistry.caller(event);
  const result = await invokeWindow({ event, method, payload, registry: windowRegistry });
  if (result.code === 'WINDOW_DESTROY_FAILED') nativeShellFailure = true;
  if (method === 'openView' && result.ok) {
    const current = windowRegistry.caller(event); const view = nativeShells.get(result.view.windowId);
    const registered = view && windowRegistry.caller({ sender: view.webContents, senderFrame: view.webContents.mainFrame });
    if (!before || !current || current.windowId !== before.windowId || current.epoch !== before.epoch || !registered || registered.epoch !== current.epoch) {
      const discarded = windowRegistry.discardView(result.view.windowId);
      if (!discarded) nativeShellFailure = true;
      return failure(discarded ? 'SENDER_REFUSED' : 'WINDOW_DESTROY_FAILED', 'Native view admission changed');
    }
    try { view.webContents.send('siren:view-ready'); view.show(); }
    catch {
      const discarded = windowRegistry.discardView(result.view.windowId);
      if (!discarded) nativeShellFailure = true;
      return failure(discarded ? 'OPERATION_FAILED' : 'WINDOW_DESTROY_FAILED', 'Native window could not be shown');
    }
  }
  return result;
});
window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
window.webContents.on('will-navigate', event => { if (event.url !== 'siren://app/app.html') event.preventDefault(); });
window.webContents.on('will-attach-webview', event => event.preventDefault());
window.webContents.on('will-frame-navigate', event => { if (!event.isMainFrame || event.url !== 'siren://app/app.html') event.preventDefault(); });
window.webContents.on('before-input-event', (event, input) => {
  if (input.type === 'keyDown' && input.control && !input.alt && !input.shift && input.key.toLowerCase() === 'q') { event.preventDefault(); window.close(); }
});
await window.loadURL('siren://app/app.html');
const automaticUpdateTimer = setTimeout(() => { if (!window.isDestroyed()) void updates.automaticCheck({ online: net.isOnline() }); }, 10000);
automaticUpdateTimer.unref();
let closing = false; let closeRequested = false;
window.on('close', event => {
  if (closing) return;
  event.preventDefault();
  if (closeRequested) return;
  closeRequested = true;
  (async () => {
    await window.webContents.executeJavaScript('window.sirenDesktopRequestClose?.()');
    await Promise.all([...writes]);
    retireNativeViews();
    if (processIdentity) await journal.recordSession({ event: 'clean-close', sessionId, version: app.getVersion(), processIdentity });
    closing = true; window.close();
  })().catch(() => {
    closeRequested = false;
    try { windowRegistry.activateWorkspace(); } catch { /* Failed native destruction remains fenced. */ }
    dialog.showErrorBox('SIREN — Close delayed', 'Save/recovery did not complete. Export live work before forcing close.');
  });
});
app.on('window-all-closed', () => app.quit());
}).catch(() => { dialog.showErrorBox('SIREN startup failed', 'The prototype could not start. Existing project files were retained.'); app.exit(1); });
