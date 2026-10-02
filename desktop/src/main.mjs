import { app, BrowserWindow, ipcMain, protocol, net, session, dialog, shell, safeStorage, Menu } from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { join, basename } from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolveLocalResource } from './protocol.mjs';
import { invokeDesktop, failure } from './ipc.mjs';
import { chooseDataRoot, writableDataRoot } from './data-root.mjs';
import { ProjectStore } from './projects/store.mjs';
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
let mode = startup.mode; let reason = startup.reason; let nativeReadonly = mode === 'readonly';
let accountTransition = false; let accountQuiesced = false;
const projects = new ProjectStore(dataRoot, { ...writerOptions, canSave: async ({ action, projectId }) => {
  if (accountQuiesced || (['workspace', 'create'].includes(action) && (nativeReadonly || mode !== 'normal'))) return false;
  return (!app.isPackaged && mode === 'normal' && !nativeReadonly) || account.canPerform({ action, projectId, owned: action === 'restore' || grants.has(projectId) });
} });
const recovery = new RecoveryStore(dataRoot, writerOptions);
const updates = new UpdateService({ root: dataRoot, config: publisherConfig.updates, currentVersion: '1.131.0', onStatus: state => { if (!window.isDestroyed()) window.webContents.send('siren:status', { kind: 'updates', state }); } });
let selectedId = devArgument('--siren-test-project=') || null;
if (!selectedId) { try { const record = JSON.parse((await readOwnedBytes(join(dataRoot, 'session-selection.json'), 65536)).toString('utf8')); if (validId(record.projectId) && (!app.isPackaged || record.accountId === account.accountId)) selectedId = record.projectId; } catch { /* no implicit browser/profile import */ } }
let snapshot = null;
if (selectedId && mode === 'normal') {
  try { snapshot = await projects.readProject(selectedId); }
  catch { mode = 'recovery'; reason = 'Selected project is damaged; open a verified recovered copy'; }
}
if (selectedId) account.policy.opened(selectedId);
let bootstrap = { mode, reason, snapshot, recoveryProjectId: selectedId, readonly: !snapshot || (app.isPackaged && account.policy.state.recoveryOnly) || mode !== 'normal' };
const grants = new Set(selectedId ? [selectedId] : []);
const recoveryAccess = new RecoveryAccess({ projects, recovery, grants });
const writes = new Set();
const selected = async next => {
  selectedId = next.project.id; grants.add(selectedId); snapshot = next;
  await atomicWrite(join(dataRoot, 'session-selection.json'), Buffer.from(JSON.stringify({ schema: 1, projectId: selectedId, accountId: account.accountId })));
  account.policy.opened(selectedId);
  mode = nativeReadonly ? 'readonly' : 'normal'; reason = nativeReadonly ? reason : null;
  bootstrap = { mode, reason, snapshot: next, recoveryProjectId: selectedId, readonly: nativeReadonly || (app.isPackaged && account.policy.state.recoveryOnly) };
  return next;
};
const exportBytes = async (bytes, suggested) => {
  const result = await dialog.showSaveDialog({ title: 'Export local SIREN data', defaultPath: suggested });
  if (result.canceled || !result.filePath) return failure('CANCELLED', 'Export cancelled');
  await atomicWrite(result.filePath, bytes);
  return { ok: true };
};
session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
session.defaultSession.setPermissionCheckHandler(() => false);
protocol.handle('siren', async request => {
  try { return await net.fetch(pathToFileURL(await resolveLocalResource({ url: request.url, rendererRoot })).href); }
  catch { return new Response('Resource refused', { status: 403 }); }
});
const services = {
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
      } });
      if (state.ok !== false) { grants.clear(); selectedId = null; snapshot = null; bootstrap = { mode, reason, snapshot: null, recoveryProjectId: null, readonly: true }; committed = true; }
      return state;
    } finally {
      accountQuiesced = false; accountTransition = false;
      if (!committed) await window.webContents.executeJavaScript('window.sirenDesktopEndAccountTransition?.()').catch(() => {});
    }
  },
  logout: async () => {
    if (accountTransition) return failure('ACCOUNT_BUSY', 'An account transition is already pending');
    accountTransition = true; let committed = false;
    try {
      await window.webContents.executeJavaScript('window.sirenDesktopBeginAccountTransition()');
      accountQuiesced = true; await Promise.all([...writes]);
      const state = await account.logout(); bootstrap = { ...bootstrap, readonly: true }; committed = true; return state;
    } finally {
      accountQuiesced = false; accountTransition = false;
      if (!committed) await window.webContents.executeJavaScript('window.sirenDesktopEndAccountTransition?.()').catch(() => {});
    }
  },
  getUpdate: () => updates.getUpdate(),
  checkForUpdates: () => updates.checkForUpdates(),
  downloadUpdate: () => updates.downloadUpdate(),
  cancelUpdate: () => updates.cancelUpdate(),
  restartAndUpdate: async () => failure('HELPER_NOT_QUALIFIED', 'The verified package is staged; installation requires the qualified launcher/helper'),
  pickProject: async () => {
    await window.webContents.executeJavaScript('window.sirenDesktopRequestClose?.()');
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
        bootstrap = { mode, reason, snapshot: null, recoveryProjectId: projectId, readonly: true };
      } });
    }
    const input = await readOwnedBytes(await realpath(answer.filePaths[0]), 64 * 1024 * 1024);
    // Existing renderer import validation and imported-file sign-off provenance run before disk creation.
    if (input.length > 64 * 1024 * 1024) return failure('IMPORT_TOO_LARGE', 'Desktop import exceeds the 64 MiB foundation limit');
    const validated = await window.webContents.executeJavaScript(`window.sirenDesktopValidateImport(${JSON.stringify(input.toString('utf8'))},${JSON.stringify(basename(answer.filePaths[0]))})`);
    const next = await projects.createProject({ label: basename(answer.filePaths[0]).slice(0, 180), json: parseLegacyImport(Buffer.from(validated)) });
    await recovery.checkpointProject({ snapshot: next, kind: 'saved' }); return selected(next);
  },
  saveProject: async request => {
    if (!grants.has(request.projectId)) return failure('PROJECT_REFUSED', 'Project is not open in this session');
    const operation = (async () => {
      const result = await projects.saveProject(request);
      if (!result.ok) return result;
      const current = request.purpose === 'workspace' ? await projects.readProject(request.projectId) : { ...await projects.readProject(request.projectId), json: request.json, sha256: result.sha256 };
      try { await recovery.checkpointProject({ snapshot: current, kind: request.purpose === 'workspace' ? 'saved' : 'draft' }); }
      catch { return failure('RECOVERY_DEGRADED', 'Project may be committed but recovery checkpoint was not acknowledged. Export and inspect recovery.'); }
      if (request.purpose === 'workspace') { snapshot = current; bootstrap = { ...bootstrap, snapshot: current }; }
      if (request.purpose === 'workspace') { try { await projects.pruneRevisions({ snapshot: current, recovery }); } catch { /* safe to retain extra revisions */ } }
      try { await projects.acknowledgePending(request.projectId, result.pendingId); } catch { /* keep original if cleanup fails */ }
      return { ok: true, revision: result.revision, sha256: result.sha256 };
    })();
    writes.add(operation); try { return await operation; } finally { writes.delete(operation); }
  },
  exportProject: async id => grants.has(id) ? exportBytes(Buffer.from((await projects.readProject(id)).json), `SIREN-${id}.siren-backup`) : failure('PROJECT_REFUSED', 'Project not selected'),
  getRecovery: async id => grants.has(id) ? recoveryAccess.inspect(id) : failure('PROJECT_REFUSED', 'Project not selected'),
  restoreRecovery: async id => {
    return selected(await recoveryAccess.restore(id));
  },
  exportRecovery: async id => {
    const bytes = await recoveryAccess.export(id);
    return exportBytes(bytes, `SIREN-recovery-${id}.siren-backup`);
  },
};
const window = new BrowserWindow({ width: 1440, height: 960, minWidth: 960, minHeight: 640, title: 'SIREN — Desktop prototype', backgroundColor: '#171719', webPreferences: {
  preload: resolve(here, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true,
} });
const desktopCommand = id => { if (!window.isDestroyed()) window.webContents.send('siren:command', id); };
Menu.setApplicationMenu(Menu.buildFromTemplate([
  { label: 'File', submenu: [
    { label: 'Open / import local project…', accelerator: 'Ctrl+Alt+O', click: () => desktopCommand('desktopOpenProject') },
    { label: 'Export saved backup…', accelerator: 'Ctrl+Alt+E', click: () => desktopCommand('desktopExportProject') },
    { type: 'separator' }, { label: 'Quit SIREN', accelerator: 'Ctrl+Q', click: () => window.close() },
  ] },
  { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
  { label: 'View', submenu: [{ role: 'togglefullscreen' }] },
  { label: 'Help', submenu: [
    { label: 'Account…', click: () => desktopCommand('desktopLogin') },
    { label: 'Check for Updates…', accelerator: 'Ctrl+Alt+U', click: () => desktopCommand('desktopCheckUpdates') },
    { label: 'Disaster Recovery…', accelerator: 'Ctrl+Alt+R', click: () => desktopCommand('desktopRecovery') },
    { type: 'separator' }, { label: 'Desktop guide…', click: () => desktopCommand('desktopGuide') },
  ] },
]));
if (!app.isPackaged) window.webContents.on('console-message', event => { if (event.level === 'error' || event.level >= 2) console.error('Renderer:', event.message?.slice(0, 800)); });
ipcMain.on('siren:bootstrap', event => {
  event.returnValue = event.sender === window.webContents && event.senderFrame === event.sender.mainFrame && event.senderFrame.url === 'siren://app/app.html' ? bootstrap : { mode: 'readonly', reason: 'Bootstrap request refused', snapshot: null };
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
  if (accountTransition && ['pickProject', 'restoreRecovery'].includes(method)) return failure('ACCOUNT_BUSY', 'Wait for the account transition before changing projects');
  return invokeDesktop({ method, payload,
    context: { senderUrl: event.senderFrame?.url, isMainFrame: event.sender === window.webContents && event.senderFrame === event.sender.mainFrame }, services });
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
    if (processIdentity) await journal.recordSession({ event: 'clean-close', sessionId, version: app.getVersion(), processIdentity });
    closing = true; window.close();
  })().catch(() => { closeRequested = false; dialog.showErrorBox('SIREN — Close delayed', 'Save/recovery did not complete. Export live work before forcing close.'); });
});
app.on('window-all-closed', () => app.quit());
}).catch(() => { dialog.showErrorBox('SIREN startup failed', 'The prototype could not start. Existing project files were retained.'); app.exit(1); });
