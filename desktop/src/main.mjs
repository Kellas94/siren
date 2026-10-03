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
import {WorkspaceCoordinator} from './windows/coordinator.mjs';
import {PrimaryPersistence} from './windows/primary.mjs';
import {invokeSourceRead,invokeSourceMutation} from './windows/source-bridge.mjs';
import {NativeWorkingSources} from './windows/working-sources.mjs';
import {NativeCodeDocs} from './windows/code-docs.mjs';
import {DocsLinkService} from './windows/docs.mjs';
import {NativeSourceReads,selectedSourceReference} from './windows/source-reads.mjs';
import {NativeDocsReads} from './windows/docs-reads.mjs';
import {NativeWindowCatalog} from './windows/catalog.mjs';
import {invokeHomeWindow} from './windows/home-admission.mjs';
import {NativeReadonlyViewSeals} from './windows/readonly-seals.mjs';
import {NativeAllViewControl} from './windows/control.mjs';
import {NativeAllWorkspaceBarrier} from './windows/source-barrier.mjs';
import {navigationFields} from './navigation/contracts.mjs';
import {HomeAuthority} from './navigation/authority.mjs';
import {HomeService} from './navigation/service.mjs';
import {HomeTransitionReceipts} from './navigation/transition-receipts.mjs';
import {continueSavedLocation} from './navigation/continue.mjs';
import {NavigationStore} from './navigation/store.mjs';
import {ProjectCatalog} from './navigation/catalog.mjs';
import {createLocationResolver} from './navigation/resolver.mjs';
import {invokeHome} from './navigation/ipc.mjs';
import {DomainRepository} from './windows/domain.mjs';
import { invokeWindow } from './windows/ipc.mjs';
import { nativeViewFactory } from './windows/factory.mjs';
import { workspaceEntities,workspaceMetadata } from './windows/entities.mjs';
import { openOwnedSelection } from './projects/selection.mjs';
import { parseLegacyImport } from './projects/migration.mjs';
import { validateImportedProject } from './projects/import-validation.mjs';
import { createImportValidator } from './projects/import-validator-window.mjs';
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
const processIdentity = await inspectWindowsProcess(process.pid, { onFailure: observed => {
  // Native startup attribution only: no PID, executable path, stack or output.
  // Unknown identity still selects readonly; diagnostics never grant ownership.
  console.warn('SIREN_PROCESS_IDENTITY_FAILURE ' + JSON.stringify({
    category: ['Error', 'SyntaxError', 'TypeError'].includes(observed.name) ? observed.name : 'UNKNOWN',
    code: (Number.isSafeInteger(observed.code) || (typeof observed.code === 'string' && /^[A-Z_]{1,32}$/.test(observed.code))) ? observed.code : null,
    killed: observed.killed === true, signal: observed.signal === 'SIGTERM' ? 'SIGTERM' : null,
  }));
} });
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
  // Source IPC exposes reads only. Trusted recovery copies may write only while
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
    await prepareNativeWorkspace();
    writes.selectionQuiesced = true;
    await Promise.all([...writes]);
    retireNativeViews();
    const result = await action(); changed = bootstrap.selectionGeneration !== generation; return result;
  } finally {
    writes.selectionQuiesced = false; writes.selectionTransition = false;
    // A successful selection reloads the renderer; keep that old view frozen.
    if (!changed) {
      await rollbackNativePreparation();
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
// Unlock never creates or selects a project. First-use Home requires an
// explicit New/Open action; PIN success is independent of project creation.
const prepareLocalWorkspace = async result => result;
session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
session.defaultSession.setPermissionCheckHandler(() => false);
protocol.handle('siren', async request => {
  try { return await net.fetch(pathToFileURL(await resolveLocalResource({ url: request.url, rendererRoot })).href); }
  catch { return new Response('Resource refused', { status: 403 }); }
});
const services = {
  getPinState: () => localPin.state(),
  setupPin: async payload => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : runAfterWorkspaceLoad(window.webContents, async () => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : prepareLocalWorkspace(await localPin.setup(payload)),{expectedUrl:window.webContents.getURL()}),
  unlockPin: async payload => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : runAfterWorkspaceLoad(window.webContents, async () => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : prepareLocalWorkspace(await localPin.unlock(payload)),{expectedUrl:window.webContents.getURL()}),
  verifyCurrentPin: payload => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : localPin.verifyCurrent(payload),
  changePin: payload => pinTransition ? failure('PIN_BUSY', 'Local access is changing.') : localPin.change(payload),
  lockPin: async () => {
    if (pinTransition || accountTransition) return failure('PIN_BUSY', 'Local access is changing.');
    pinTransition = true;
    try {
      await prepareNativeWorkspace();
      accountQuiesced = true;
      await Promise.all([...writes]);
      retireNativeViews();
      localPin.lock(); return { ok: true };
    } catch (error) {
      await rollbackNativePreparation();
      await window.webContents.executeJavaScript('window.sirenDesktopEndAccountTransition?.()').catch(() => {});
      if (error?.code === 'WINDOW_DESTROY_FAILED') return failure('WINDOW_DESTROY_FAILED', 'SIREN could not protect every native window. Lock was not confirmed; your project was retained.');
      return failure('SAVE_FAILED', 'SIREN could not confirm your local changes. The workspace remains open.');
    } finally {
      accountQuiesced = false; pinTransition = false;
      if (localPin.state().unlocked) { try { windowRegistry.activateWorkspace(); } catch { /* Native failure remains fenced. */ } }
    }
  },
  requestClose: async () => { window.close(); return { ok: true }; },
  goHome:()=>invokeHome({event:{sender:window.webContents,senderFrame:window.webContents.mainFrame},method:'continueWork',payload:{},authority:homeAuthority,transitions:homeTransitions,services:{continueWork:(_input,scope)=>navigateHome(scope)}}),
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
        await prepareNativeWorkspace();
        accountQuiesced = true;
        await Promise.all([...writes]);
        retireNativeViews();
      } });
      if (state.ok !== false) { grants.clear(); selectedId = null; snapshot = null; bootstrap = { mode, reason, snapshot: null, recoveryProjectId: null, readonly: true }; committed = true; }
      return state;
    } finally {
      accountQuiesced = false; accountTransition = false;
      if (!committed) {
        await rollbackNativePreparation();
        await window.webContents.executeJavaScript('window.sirenDesktopEndAccountTransition?.()').catch(() => {});
        try { windowRegistry.activateWorkspace(); } catch { /* Native failure remains fenced. */ }
      }
    }
  },
  logout: async () => {
    if (accountTransition) return failure('ACCOUNT_BUSY', 'An account transition is already pending');
    accountTransition = true; let committed = false;
    try {
      await prepareNativeWorkspace();
      accountQuiesced = true; await Promise.all([...writes]);
      retireNativeViews();
      const state = await account.logout(); bootstrap = { ...bootstrap, readonly: true }; committed = true; return state;
    } finally {
      accountQuiesced = false; accountTransition = false;
      if (!committed) {
        await rollbackNativePreparation();
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
    // Validate through a hidden isolated entry, retaining frozen sign-off rules
    // without requiring Home to load or execute the workspace application.
    if (input.length > 64 * 1024 * 1024) return failure('IMPORT_TOO_LARGE', 'Desktop import exceeds the 64 MiB foundation limit');
    const importGeneration=bootstrap.selectionGeneration,importProject=selectedId,importMode=mode,importContents=window.webContents,importFrame=importContents.mainFrame;
    const importCurrent=()=>!window.isDestroyed() && !importContents.isDestroyed() && window.webContents===importContents && importContents.mainFrame===importFrame && importContents.getURL()==='siren://app/app.html' && importFrame.url==='siren://app/app.html' && localPin.state().unlocked && bootstrap.selectionGeneration===importGeneration && selectedId===importProject && mode===importMode;
    const build=JSON.parse(await readOwnedBytes(join(rendererRoot,'build.json'),65536));
    const validated=await validateImportedProject({bytes:input,fileName:basename(answer.filePaths[0])},{isCurrent:importCurrent,createValidator:()=>createImportValidator({BrowserWindow,entryPath:join(rendererRoot,'import-validation.html'),entrySha256:build.importValidation?.entrySha256})});
    const next = await projects.createProject({ label: basename(answer.filePaths[0]).slice(0, 180), json: parseLegacyImport(Buffer.from(validated)) });
    if(!importCurrent())throw Object.assign(new Error('Import access changed'),{code:'ACCESS_REFUSED'});
    await recovery.checkpointProject({ snapshot: next, kind: 'saved' });
    if(!importCurrent())throw Object.assign(new Error('Import access changed'),{code:'ACCESS_REFUSED'});
    return selected(next);
    });
  },
  saveProject: async request => {
    if (writes.selectionQuiesced) return failure('PROJECT_BUSY', 'Project selection is changing; keep the live work and retry after opening');
    if (!grants.has(request.projectId)) return failure('PROJECT_REFUSED', 'Project is not open in this session');
    const grant=windowRegistry.capturePrimary({sender:window.webContents,senderFrame:window.webContents.mainFrame});
    if(!grant || grant.role!=='workspace' || grant.projectId!==request.projectId)return failure('ACCESS_REFUSED','Save scope is no longer current; retain live work.');
    const operation=workspaceOwner.saveWorkspace(grant,request);
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
const closingWorkingViews=new WeakSet();
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
    view.on('close',event=>{
      const grant=windowRegistry.capture({sender:view.webContents,senderFrame:view.webContents.mainFrame});
      if(closingWorkingViews.has(view)||!workingSources?.isWorking(grant))return;
      event.preventDefault();
      if(writes.viewClosing||workspaceBarrier||writes.selectionTransition||pinTransition||accountTransition)return;
      writes.viewClosing=true;
      void (async()=>{
        const prepared=await prepareNativeWorkspace('native-close-view');
        if(!prepared.barrier.release(prepared.proof))throw Error('Native close release refused');
        workspaceBarrier=null;closingWorkingViews.add(view);view.close();
        for(const current of [window,...nativeShells.values()])if(!current.isDestroyed())current.webContents.send('siren:view-resume');
      })().catch(()=>rollbackNativePreparation()).finally(()=>{writes.viewClosing=false;});
    });
  } }),
});
windowRegistry.bindWorkspace(window);
const homeAuthority=new HomeAuthority({workspace:window,state:()=>({unlocked:localPin.state().unlocked,projectId:selectedId,mode,generation:bootstrap.selectionGeneration||0})});
const homeTransitions=new HomeTransitionReceipts({authority:homeAuthority,registry:windowRegistry,projects});
let workingSources=null;
const workingEnabled=grant=>localPin.state().unlocked&&!nativeReadonly&&mode==='normal'&&!accountQuiesced&&!writes.selectionQuiesced&&!nativeShellFailure&&snapshot?.schema===2&&grant?.projectId===selectedId;
const canOpenWorking=grant=>Boolean(workingEnabled(grant)&&grant.role==='code'&&windowRegistry.isCurrent(grant)&&snapshot.sourceRefs.some(ref=>ref.sourceId===windowRegistry.sourceScope(grant)?.sourceId));
const sourceReferenceFor=(grant,request)=>workingSources?.isWorking(grant)?workingSources.referenceFor(grant,request):selectedSourceReference(snapshot,windowRegistry,grant,request);
const canLinkCodeDocs=grant=>workingSources?.isWorking(grant)===true&&!pinTransition&&!writes.selectionTransition&&!writes.viewClosing;
const codeDocsLinkService=new DocsLinkService({
  projects:({canWrite})=>new ProjectStore(dataRoot,{...writerOptions,canSave:async context=>await projects.canSave(context)&&canWrite(context)}),
  sources:({canWrite})=>new SourceRepository(dataRoot,{...writerOptions,canWrite}),recovery,
});
const readonlyViews=new NativeReadonlyViewSeals({registry:windowRegistry,
  isReadonly:grant=>['code','docs'].includes(grant.role)&&!workingSources?.isWorking(grant)&&localPin.state().unlocked&&!accountQuiesced&&!writes.selectionQuiesced&&grant.projectId===selectedId,
  snapshotFor:()=>projects.readProject(selectedId),sources:({canWrite})=>new SourceRepository(dataRoot,{...writerOptions,canWrite}),
});
const workspaceOwner=new WorkspaceCoordinator({registry:windowRegistry,
  readonlyViews,
  onNativeFailure:info=>console.warn('SIREN_SOURCE_NATIVE_FAILURE',JSON.stringify(info)),
  access:(grant,scope)=>localPin.state().unlocked && !accountQuiesced && !writes.selectionQuiesced && grant.projectId===selectedId &&
    (grant.role==='workspace'&&grant.mainFrameUrl==='siren://app/home.html'?scope.action==='readonly':scope.action==='read'
      ? (!pinTransition||workspaceBarrier&&workingSources?.isWorking(grant)) && !nativeShellFailure && snapshot?.schema===2 && snapshot.sourceRefs?.some(ref=>ref.sourceId===scope.sourceId)
      : scope.action==='read-domain'
        ? !pinTransition && !nativeShellFailure && scope.domain==='docs' && workspaceEntities(snapshot).docs.includes(scope.entityId)
        : ['edit','commit'].includes(scope.action)?workingSources?.isWorking(grant)===true
        : scope.action==='docs-link'?canLinkCodeDocs(grant)&&windowRegistry.sourceScope(grant)?.sourceId===scope.sourceId
        : ['edit-domain','flush-domain'].includes(scope.action)?false:scope.action==='readonly'?bootstrap.readonly===true:scope.action==='recovery' || !nativeReadonly && mode==='normal' && snapshot?.schema===1),
  sources:({canWrite})=>new SourceRepository(dataRoot,{...writerOptions,canWrite}),
  domains:new DomainRepository({projects:()=>new ProjectStore(dataRoot,{...writerOptions,canSave:()=>false}),sources:()=>new SourceRepository(dataRoot,{...writerOptions,canWrite:()=>false}),validatePatch:()=>false}),
  docs:{async commitCodeToDocs(input,scope){
    const result=await codeDocsLinkService.commitCodeToDocs(input,scope);
    if(!result.ok||!scope.isCurrent())return scope.isCurrent()?result:{ok:false,code:'ACCESS_REFUSED'};
    try{
      const current=await projects.readProject(scope.projectId);
      if(!scope.isCurrent())return {ok:false,code:'ACCESS_REFUSED'};
      snapshot=current;bootstrap={...bootstrap,snapshot:current};return result;
    }catch{nativeShellFailure=true;return {ok:false,code:'DOCS_LINK_FAILED'};}
  }},
  primary:new PrimaryPersistence({
    projects:({canWrite})=>new ProjectStore(dataRoot,{...writerOptions,canSave:async context=>await projects.canSave(context) && canWrite(context)}),
    recovery,onSelected:current=>{snapshot=current;bootstrap={...bootstrap,snapshot:current};},
  }),
});
let sourceReads=null;
const docsReads=new NativeDocsReads({registry:windowRegistry,owner:workspaceOwner,documentFor:(_grant,entityId)=>workspaceMetadata(snapshot).workpapers?.find(document=>document.id===entityId)});
const codeDocs=new NativeCodeDocs({registry:windowRegistry,owner:workspaceOwner,canLink:canLinkCodeDocs,snapshotFor:()=>snapshot});
const windowCatalog=new NativeWindowCatalog({registry:windowRegistry,snapshotFor:()=>snapshot});
const viewControl=new NativeAllViewControl({registry:windowRegistry,owner:workspaceOwner,send:(event,ticket)=>event.sender.send('siren:view-prepare',ticket)});
let workspaceBarrier=null;
const rollbackNativePreparation=async()=>{
  if(!workspaceBarrier)return;
  workspaceBarrier?.dispose();workspaceBarrier=null;workspaceOwner.resume();
  for(const view of [window,...nativeShells.values()])if(!view.isDestroyed())view.webContents.send('siren:view-resume');
};
const prepareNativeWorkspace=async(reason='native-workspace-transition')=>{
  homeAuthority.invalidate();window.webContents.send('siren:home-invalidated');
  if(!snapshot){
    if(window.webContents.getURL()==='siren://app/home.html'){
      if(nativeShells.size||windowRegistry.listViews().length)throw Object.assign(Error('Unprepared native views'),{code:'ROSTER_CHANGED'});
      await Promise.all([...writes]);return;
    }
    await window.webContents.executeJavaScript('window.sirenDesktopBeginAccountTransition()');return;
  }
  if(workspaceBarrier)throw Object.assign(Error('Preparation pending'),{code:'PROJECT_BUSY'});
  workspaceBarrier=new NativeAllWorkspaceBarrier({registry:windowRegistry,owner:workspaceOwner,control:{
    flushView:async grant=>{const receipt=await viewControl.flushView(grant);if(!receipt.ok)console.warn('SIREN_NATIVE_VIEW_FLUSH_FAILURE',JSON.stringify({role:grant.role,code:receipt.code}));return receipt;},
    cancelView:grant=>viewControl.cancelView(grant),
  },cover:()=>{}});
  const result=await workspaceBarrier.prepare(reason);
  if(!result.ok){console.warn('SIREN_WORKSPACE_PREPARE_FAILURE',JSON.stringify({code:result.code}));await rollbackNativePreparation();throw Object.assign(Error('Native preparation refused'),{code:result.code});}
  await Promise.all([...writes]);
  if(!workspaceBarrier.isPrepared(result.proof)){await rollbackNativePreparation();throw Object.assign(Error('Native roster changed'),{code:'ROSTER_CHANGED'});}
  return {barrier:workspaceBarrier,proof:result.proof};
};
ipcMain.handle('siren:view-ack',async(event,input)=>{
  const result=await viewControl.acknowledge(event,input);
  if(!result.ok){const role=windowRegistry.capture(event)?.role;console.warn('SIREN_VIEW_PREPARE_FAILURE',JSON.stringify({role:['workspace','code','docs'].includes(role)?role:'unknown',code:result.code,rendererCode:typeof input?.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(input.code)?input.code:null}));}
  return result;
});
ipcMain.handle('siren:workspace-flush',async(event,method,input)=>{
  const grant=windowRegistry.capturePrimary(event);
  if(!grant||grant.role!=='workspace'||grant.projectId!==selectedId)return failure('ACCESS_REFUSED','Native preparation scope refused');
  if(grant.mainFrameUrl==='siren://app/home.html'&&method!=='sealReadonly')return failure('ACCESS_REFUSED','Home has no workspace edit authority');
  let payload;try{payload=navigationFields(input,method==='saveProject'?['nonce','request']:['nonce']);}catch{return failure('REQUEST_REFUSED','Invalid preparation request');}
  if(!['saveProject','sealReadonly'].includes(method)||typeof payload.nonce!=='string')return failure('REQUEST_REFUSED','Invalid preparation request');
  const operation=workspaceOwner.invoke(grant,{kind:'workspace',method,payload:method==='saveProject'?payload.request:{}},payload.nonce);
  writes.add(operation);try{return await operation;}finally{writes.delete(operation);}
});
const retireNativeViews = () => {
  sourceReads?.dispose();sourceReads=null;
  workingSources?.dispose();workingSources=null;
  let failed = false;
  try { windowRegistry.invalidateEpoch({ preserveWorkspace: true }); } catch { failed = true; }
  // Includes hidden pending factories, which have no registry grant yet.
  for (const view of nativeShells.values()) {
    try { if (!view.isDestroyed()) view.destroy(); if (!view.isDestroyed()) failed = true; } catch { failed = true; }
  }
  nativeShellFailure = failed;
  workspaceBarrier?.dispose();workspaceBarrier=null;workspaceOwner.resume();
  if (failed) throw Object.assign(new Error('Native window protection incomplete'), { code: 'WINDOW_DESTROY_FAILED' });
};
const navigation=new NavigationStore(dataRoot,{canWrite:()=>localPin.state().unlocked&&!nativeReadonly&&mode==='normal'&&!accountQuiesced&&!writes.selectionQuiesced});
const homeService=new HomeService({navigation,catalog:new ProjectCatalog(dataRoot),projects,
  selection:{state:()=>({projectId:selectedId,label:snapshot?.project.label,mode,readonly:nativeReadonly||mode!=='normal',
    views:windowRegistry.listViews().filter(view=>['code','docs'].includes(view.role)).slice(0,16).map(view=>({windowId:view.windowId,role:view.role,entityId:view.entityId,label:view.role==='code'?'⌘ Code':'Docs',state:view.state==='minimized'?'minimized':'open'})),
    capabilities:{diagrams:Boolean(snapshot),docs:Boolean(snapshot),code:snapshot?.schema===2,present:false}})},
  resolveEntity:createLocationResolver({sources,displays:()=>screen.getAllDisplays().map(display=>({id:display.id,workArea:display.workArea,primary:display.id===screen.getPrimaryDisplay().id}))}),
});
let nativeNavigationTarget=null;
const navigateEntry=async(scope,entryUrl)=>{
  if(!snapshot)return navigateEmptyRecovery(scope,entryUrl);
  if(!scope.transition||!scope.isCurrent()||writes.selectionTransition||pinTransition||accountTransition)return {ok:false,code:'TRANSITION_FAILED'};
  writes.selectionTransition=true;homeAuthority.invalidate();window.webContents.send('siren:home-invalidated');let handedOff=false;
  try{
    const prepared=await prepareNativeWorkspace('native-home-navigation');
    const started=prepared.barrier.beginWorkspaceNavigation(prepared.proof,{entryUrl});
    if(!started.ok)throw Error('Native Home navigation refused');
    nativeNavigationTarget=entryUrl;await window.loadURL(nativeNavigationTarget);
    await runAfterWorkspaceLoad(window.webContents,()=>true,{expectedUrl:nativeNavigationTarget});
    const finished=prepared.barrier.finishWorkspaceNavigation(prepared.proof,started.navigation);if(!finished.ok)throw Error('Native Home entry refused');
    const receipt=homeTransitions.complete(scope.transition,{barrier:prepared.barrier,proof:prepared.proof,view:finished.view});if(!receipt.ok)throw Error('Native Home receipt refused');
    if(!prepared.barrier.release(prepared.proof))throw Error('Native Home release refused');workspaceBarrier=null;handedOff=true;
    if(entryUrl==='siren://app/app.html'){
      const grant=homeAuthority.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame});
      await homeService.recordLocation({surface:'diagrams'},{projectId:selectedId,mode,isCurrent:()=>homeAuthority.isCurrent(grant)});
    }
    window.webContents.send('siren:workspace-admitted');
    for(const view of nativeShells.values())if(!view.isDestroyed())view.webContents.send('siren:view-resume');
    // Returning Home preserves the last actual module location. Home itself is
    // not a NavigationLocation and must never overwrite Continue metadata.
    return receipt;
  }catch{return {ok:false,code:'TRANSITION_FAILED'};}
  finally{nativeNavigationTarget=null;writes.selectionTransition=false;if(!handedOff)await rollbackNativePreparation();}
};
const navigateHome=scope=>navigateEntry(scope,'siren://app/home.html');
const navigateEmptyRecovery=async(scope,entryUrl)=>{
  if(mode==='normal'||snapshot||!scope.transition||!scope.isCurrent()||writes.selectionTransition||pinTransition||accountTransition)return {ok:false,code:'ACCESS_REFUSED'};
  writes.selectionTransition=true;let roster;
  try{
    await prepareNativeWorkspace('native-home-navigation');roster=windowRegistry.freezeRoster();
    if(roster.grants.length!==0)return {ok:false,code:'TRANSITION_FAILED'};
    nativeNavigationTarget=entryUrl;await window.loadURL(entryUrl);
    await runAfterWorkspaceLoad(window.webContents,()=>true,{expectedUrl:entryUrl});
    const receipt=homeTransitions.completeEmptyRecovery(scope.transition,roster,entryUrl);
    if(!receipt.ok||!windowRegistry.releaseRoster(roster))return {ok:false,code:'TRANSITION_FAILED'};roster=null;return receipt;
  }catch{return {ok:false,code:'TRANSITION_FAILED'};}
  finally{if(roster)windowRegistry.releaseRoster(roster);nativeNavigationTarget=null;writes.selectionTransition=false;}
};
const selectHomeProject=async(input,scope,{create=false,json}={})=>{
  if(!scope.transition||!scope.isCurrent()||writes.selectionTransition||pinTransition||accountTransition||
    window.webContents.getURL()!=='siren://app/home.html')return {ok:false,code:'ACCESS_REFUSED'};
  if(create&&(nativeReadonly||mode!=='normal'))return {ok:false,code:'ACCESS_REFUSED'};
  const contents=window.webContents,frame=contents.mainFrame,generation=bootstrap.selectionGeneration||0,previous=selectedId;
  const live=()=>!window.isDestroyed()&&!contents.isDestroyed()&&contents===window.webContents&&contents.mainFrame===frame&&
    contents.getURL()==='siren://app/home.html'&&localPin.state().unlocked&&!accountQuiesced&&!pinTransition&&
    (bootstrap.selectionGeneration||0)===generation&&selectedId===previous;
  writes.selectionTransition=true;let changed=false;
  try{
    let next=create?null:await projects.readProject(input.projectId);
    if(!live())return {ok:false,code:'ACCESS_REFUSED'};
    // Do not manufacture a new selection or checkpoint when reopening the
    // current verified project. The existing renderer remains current.
    if(next?.project.id===selectedId){const grant=windowRegistry.capturePrimary({sender:contents,senderFrame:frame});return grant?{ok:true,epoch:grant.epoch}:{ok:false,code:'ACCESS_REFUSED'};}
    if(snapshot)await prepareNativeWorkspace('native-home-navigation');
    else{homeAuthority.invalidate();contents.send('siren:home-invalidated');}
    if(!live())return {ok:false,code:'ACCESS_REFUSED'};
    writes.selectionQuiesced=true;await Promise.all([...writes]);retireNativeViews();
    if(create){next=await projects.createProject({label:input.label,json:json??JSON.stringify({kind:'siren-desktop',schema:1,storage:{}})});if(json!==undefined)await recovery.checkpointProject({snapshot:next,kind:'saved'});}
    if(!live())return {ok:false,code:'ACCESS_REFUSED'};
    await selected(next);changed=true;writes.selectionQuiesced=false;
    windowRegistry.activateWorkspace({entryUrl:'siren://app/home.html'});
    return await homeTransitions.completeSelection(scope.transition);
  }catch{return {ok:false,code:create?'TRANSITION_FAILED':'PROJECT_UNAVAILABLE'};}
  finally{
    writes.selectionQuiesced=false;writes.selectionTransition=false;
    if(!changed){await rollbackNativePreparation();if(snapshot&&!nativeShellFailure)try{windowRegistry.activateWorkspace({entryUrl:'siren://app/home.html'});}catch{/* Refused activation remains fenced. */}}
    if(!window.isDestroyed())contents.send('siren:view-resume');
  }
};
ipcMain.handle('siren:home',(event,method,payload)=>invokeHome({event,method,payload,authority:homeAuthority,services:{
  getHomeState:(input,scope)=>homeService.getHomeState(input,scope),recordLocation:(input,scope)=>homeService.recordLocation(input,scope),
  openProject:(input,scope)=>selectHomeProject(input,scope),createProject:(input,scope)=>selectHomeProject(input,scope,{create:true}),
  continueWork:async(_input,scope)=>{
    const state=await homeService.getHomeState({},scope),location=state.continuation?.location;
    return continueSavedLocation({scope,location,projects,selectedProjectId:()=>selectedId,
      resolveEntity:input=>homeService.resolveEntity(input),selectProject:selectHomeProject,
      selectionIsCurrent:(ticket,receipt)=>homeTransitions.selectionIsCurrent(ticket,receipt),
      openView:input=>invokeNativeWindow(event,'openView',input),navigateDiagrams:own=>navigateEntry(own,'siren://app/app.html')});
  },
},transitions:homeTransitions}));
ipcMain.handle('siren:home-route',(event,input)=>{
  if(event.sender!==window.webContents||event.senderFrame!==event.sender.mainFrame||event.senderFrame?.url!=='siren://app/home.html')return {ok:false,code:'SENDER_REFUSED'};
  let request;try{request=navigationFields(input,['surface']);if(request.surface!=='diagrams')throw Error();}catch{return {ok:false,code:'REQUEST_REFUSED'};}
  return invokeHome({event,method:'continueWork',payload:{},authority:homeAuthority,transitions:homeTransitions,services:{continueWork:(_input,scope)=>navigateEntry(scope,'siren://app/app.html')}});
});
ipcMain.handle('siren:home-recovery',(event,input)=>{
  try{navigationFields(input??{},[]);}catch{return {ok:false,code:'REQUEST_REFUSED'};}
  if(event.sender!==window.webContents||event.senderFrame!==event.sender.mainFrame||event.senderFrame?.url!=='siren://app/home.html'||mode==='normal')return {ok:false,code:'ACCESS_REFUSED'};
  return invokeHome({event,method:'continueWork',payload:{},authority:homeAuthority,transitions:homeTransitions,services:{continueWork:(_input,scope)=>navigateEntry(scope,'siren://app/app.html')}});
});
ipcMain.handle('siren:home-import',(event,input)=>{
  try{navigationFields(input??{},[]);}catch{return {ok:false,code:'REQUEST_REFUSED'};}
  if(event.sender!==window.webContents||event.senderFrame!==event.sender.mainFrame||event.senderFrame?.url!=='siren://app/home.html')return {ok:false,code:'SENDER_REFUSED'};
  return invokeHome({event,method:'createProject',payload:{label:'Imported project'},authority:homeAuthority,transitions:homeTransitions,services:{createProject:async(_input,scope)=>{
    if(nativeReadonly||mode!=='normal'||writes.selectionTransition||!scope.isCurrent())return {ok:false,code:'ACCESS_REFUSED'};
    const answer=await dialog.showOpenDialog(window,{title:'Open a SIREN project',properties:['openFile'],filters:[{name:'SIREN projects',extensions:['siren','json']}]});
    if(!scope.isCurrent())return {ok:false,code:'ACCESS_REFUSED'};
    if(answer.canceled)return {ok:false,code:'CANCELLED'};
    if(answer.filePaths?.length!==1)return {ok:false,code:'PROJECT_UNAVAILABLE'};
    try{
      const bytes=await readOwnedBytes(await realpath(answer.filePaths[0]),64*1024*1024);
      const build=JSON.parse(await readOwnedBytes(join(rendererRoot,'build.json'),65536));
      const validated=await validateImportedProject({bytes,fileName:basename(answer.filePaths[0])},{isCurrent:scope.isCurrent,createValidator:()=>createImportValidator({BrowserWindow,entryPath:join(rendererRoot,'import-validation.html'),entrySha256:build.importValidation?.entrySha256})});
      if(!scope.isCurrent())return {ok:false,code:'ACCESS_REFUSED'};
      return selectHomeProject({label:basename(answer.filePaths[0]).slice(0,180)},scope,{create:true,json:parseLegacyImport(Buffer.from(validated))});
    }catch{return {ok:false,code:scope.isCurrent()?'PROJECT_UNAVAILABLE':'ACCESS_REFUSED'};}
  }}});
});
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
let initialOpening=true;
ipcMain.on('siren:bootstrap', event => {
  const entry=event.senderFrame?.url;
  const trusted = event.sender === window.webContents && event.senderFrame === event.sender.mainFrame && ['siren://app/app.html','siren://app/home.html'].includes(entry);
  if (!trusted) { event.returnValue = { mode: 'readonly', reason: 'Bootstrap request refused', snapshot: null }; return; }
  if (!localPin.state().unlocked) { event.returnValue = { mode: 'locked', readonly: true, snapshot: null, recoveryProjectId: null, localAccess: true, pin: localPin.state(),opening:entry==='siren://app/home.html'&&initialOpening?'intro':'none' };initialOpening=false;return; }
  if(entry==='siren://app/home.html'){
    if(snapshot)try{windowRegistry.activateWorkspace({entryUrl:entry});}catch{/* Prepared native navigation completes after load. */}
    event.returnValue={mode,readonly:nativeReadonly||mode!=='normal',snapshot:null,localAccess:true,pin:localPin.state(),opening:'none'};return;
  }
  if (snapshot) {
    if(nativeNavigationTarget==='siren://app/app.html'&&writes.selectionTransition&&workspaceBarrier){event.returnValue={...bootstrap,pin:localPin.state(),navigationPending:true};return;}
    try { windowRegistry.activateWorkspace(); if (!windowRegistry.caller(event)) throw new Error('Native grant unavailable'); }
    catch { event.returnValue = { mode: 'readonly', reason: 'Native workspace access refused; existing data was retained', snapshot: null, recoveryProjectId: selectedId, readonly: true, localAccess: true, pin: localPin.state() }; return; }
  }
  event.returnValue = { ...bootstrap, pin: localPin.state() };
});
let readyRecorded = false;
ipcMain.on('siren:ready', async event => {
  if (readyRecorded || event.sender !== window.webContents || event.senderFrame !== event.sender.mainFrame || !['siren://app/app.html','siren://app/home.html'].includes(event.senderFrame.url)) return;
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
  if ((writes.selectionTransition||writes.viewClosing) && ['pickProject', 'restoreRecovery', 'setupPin', 'unlockPin', 'changePin', 'lockPin', 'beginLogin', 'logout'].includes(method)) return failure('PROJECT_BUSY', 'Wait for the workspace transition before changing access or selection');
  if (accountTransition && ['pickProject', 'restoreRecovery'].includes(method)) return failure('ACCOUNT_BUSY', 'Wait for the account transition before changing projects');
  return invokeDesktop({ method, payload,
    context: { senderUrl: event.senderFrame?.url, isMainFrame: event.sender === window.webContents && event.senderFrame === event.sender.mainFrame }, services, localAccess: localPin });
});
ipcMain.handle('siren:sources', async (event, method, payload) => {
  const operation=invokeSourceRead({event,method,payload,registry:windowRegistry,owner:workspaceOwner,
    referenceFor:sourceReferenceFor,
  });
  writes.add(operation);
  try { return await operation; } finally { writes.delete(operation); }
});
ipcMain.handle('siren:source-readers', async (event, method, payload) => {
  sourceReads??=new NativeSourceReads({registry:windowRegistry,owner:workspaceOwner,
    referenceFor:sourceReferenceFor,readonlyFor:grant=>!workingSources?.isWorking(grant),editingState:canOpenWorking,
    repositoryFactory:({canWrite,readers})=>new SourceRepository(dataRoot,{...writerOptions,canWrite,readers}),
  });
  const operation=sourceReads.invoke({event,method,payload});writes.add(operation);
  try{return await operation;}finally{writes.delete(operation);}
});
ipcMain.handle('siren:source-mutations',async(event,method,payload,flushNonce)=>{
  const operation=invokeSourceMutation({event,method,payload,flushNonce,registry:windowRegistry,owner:workspaceOwner,canEdit:grant=>workingSources?.isWorking(grant)===true});
  writes.add(operation);try{return await operation;}finally{writes.delete(operation);}
});
ipcMain.handle('siren:source-editors',async(event,method,payload)=>{
  if(method!=='openWorkingCopy')return {ok:false,code:'REQUEST_REFUSED'};
  try{navigationFields(payload??{},[]);}catch{return {ok:false,code:'REQUEST_REFUSED'};}
  const grant=windowRegistry.capture(event);if(!canOpenWorking(grant)||pinTransition||writes.selectionTransition||writes.viewClosing)return {ok:false,code:'ACCESS_REFUSED'};
  const operation=(async()=>{
   let opened;
   try{
    const source=windowRegistry.sourceScope(grant);opened=await windowRegistry.openView({role:'code',entityId:source.sourceId});
    if(!canOpenWorking(grant))throw Error('Native source scope retired');
    const view=nativeShells.get(opened.windowId),fresh=windowRegistry.capture({sender:view?.webContents,senderFrame:view?.webContents.mainFrame});
    workingSources??=new NativeWorkingSources({registry:windowRegistry,owner:workspaceOwner,enabled:workingEnabled,snapshotFor:()=>snapshot,
      onReferenceChanged:(own,ref)=>{if(workingSources?.isWorking(own)&&workspaceOwner.canRead(own,ref.sourceId))windowRegistry.eventFor(own)?.sender.send('siren:working-source-changed',ref);},
    });
    const admitted=await workingSources.admit(fresh);
    if(!admitted.ok||!canOpenWorking(grant)||!workingSources.isWorking(fresh))throw Error('Native working source refused');
    view.webContents.send('siren:view-ready');view.show();return {ok:true,view:opened};
   }catch{
    if(opened&&!windowRegistry.discardView(opened.windowId)){nativeShellFailure=true;return {ok:false,code:'WINDOW_DESTROY_FAILED'};}
    return {ok:false,code:'ACCESS_REFUSED'};
   }
  })();
  writes.add(operation);try{return await operation;}finally{writes.delete(operation);}
});
ipcMain.handle('siren:code-docs',async(event,method,payload)=>{
  const operation=codeDocs.invoke({event,method,payload});writes.add(operation);
  try{return await operation;}finally{writes.delete(operation);}
});
ipcMain.handle('siren:docs-read', async (event, method, payload) => {
  const operation=docsReads.invoke({event,method,payload});writes.add(operation);
  try{return await operation;}finally{writes.delete(operation);}
});
const invokeNativeWindow=async (event, method, payload) => {
  if (pinTransition || writes.selectionTransition || writes.viewClosing || accountQuiesced || nativeShellFailure) return failure('PROJECT_BUSY', 'Wait for the current workspace transition');
  if(method==='getCatalog'){
    const operation=windowCatalog.invoke({event,payload});writes.add(operation);
    try{return await operation;}finally{writes.delete(operation);}
  }
  const before = windowRegistry.caller(event);
  const result = method==='openView'&&before?.mainFrameUrl==='siren://app/home.html'
    ? await invokeHomeWindow({event,payload,registry:windowRegistry,snapshot})
    : await invokeWindow({ event, method, payload, registry: windowRegistry });
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
};
ipcMain.handle('siren:windows',invokeNativeWindow);
window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
window.webContents.on('will-navigate', event => { if (event.url !== window.webContents.getURL() && event.url!==nativeNavigationTarget) event.preventDefault(); });
window.webContents.on('will-attach-webview', event => event.preventDefault());
window.webContents.on('will-frame-navigate', event => { if (!event.isMainFrame || event.url!==window.webContents.getURL()&&event.url!==nativeNavigationTarget) event.preventDefault(); });
window.webContents.on('before-input-event', (event, input) => {
  if(input.type!=='keyDown'||!input.control||input.shift||input.meta||input.isComposing||typeof input.key!=='string')return;
  const key=input.key.toLowerCase();
  const command=input.alt?new Map([['l','desktopLockPin'],['o','desktopOpenProject'],['e','desktopExportProject'],['u','desktopCheckUpdates'],['r','desktopRecovery']]).get(key):key===','?'desktopPinSettings':null;
  if(command){event.preventDefault();if(!input.isAutoRepeat)desktopCommand(command);}
  else if(!input.alt&&key==='q'){event.preventDefault();if(!input.isAutoRepeat)window.close();}
});
await window.loadURL('siren://app/home.html');
const automaticUpdateTimer = setTimeout(() => { if (!window.isDestroyed()) void updates.automaticCheck({ online: net.isOnline() }); }, 10000);
automaticUpdateTimer.unref();
let closing = false; let closeRequested = false;
window.on('close', event => {
  if (closing) return;
  event.preventDefault();
  if(writes.selectionTransition||writes.viewClosing||accountTransition||pinTransition){dialog.showErrorBox('SIREN — Close delayed','Wait for the current workspace or access transition to finish before closing. Your work was retained.');return;}
  if (closeRequested) return;
  closeRequested = true;
  (async () => {
    if(localPin.state().unlocked)await prepareNativeWorkspace();
    else await window.webContents.executeJavaScript('window.sirenDesktopRequestClose?.()');
    await Promise.all([...writes]);
    retireNativeViews();
    if (processIdentity) await journal.recordSession({ event: 'clean-close', sessionId, version: app.getVersion(), processIdentity });
    closing = true; window.close();
  })().catch(() => {
    closeRequested = false;
    void rollbackNativePreparation();
    try { windowRegistry.activateWorkspace(); } catch { /* Failed native destruction remains fenced. */ }
    dialog.showErrorBox('SIREN — Close delayed', 'Save/recovery did not complete. Export live work before forcing close.');
  });
});
app.on('window-all-closed', () => app.quit());
}).catch(() => { dialog.showErrorBox('SIREN startup failed', 'The prototype could not start. Existing project files were retained.'); app.exit(1); });
