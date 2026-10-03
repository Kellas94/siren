import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, cp, access, readdir } from 'node:fs/promises';
import { resolve, join, dirname, relative } from 'node:path';
import { ProjectStore } from '../../src/projects/store.mjs';
import { RecoveryStore } from '../../src/recovery/checkpoints.mjs';
import { launchDesktop, unlockDesktop } from './drive.mjs';
import { hashOwnedFile } from '../../src/updates/download.mjs';

async function closedPackageInventory(root) {
  const records = [];
  const visit = async directory => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { records.push({ path: relative(root, path), kind: 'directory' }); await visit(path); }
      else {
        assert.equal(entry.isFile(), true, 'Owned closed package inventory must contain ordinary files');
        const hash = await hashOwnedFile(path, 1024 ** 3);
        records.push({ path: relative(root, path), kind: 'file', bytes: hash.bytes, sha256: hash.sha256 });
      }
    }
  };
  await visit(root); return records;
}

const original = resolve(process.argv[2] || '');
assert.ok(process.argv[2], 'Supply a development package root, not a development renderer');
const receipt = JSON.parse(await readFile(join(original, 'BUILD-IDENTITY.json'), 'utf8'));
assert.equal(receipt.kind, 'development-preview'); assert.equal(receipt.releaseAdmitted, false);
const evidence = resolve('evidence', `packaged-${new Date().toISOString().replaceAll(':', '-')}`); await mkdir(evidence, { recursive: true });
const firstRoot = join(evidence, 'Pachet-Știință-1'); await cp(original, firstRoot, { recursive: true, errorOnExist: true, force: false });
assert.equal((await hashOwnedFile(join(dirname(join(firstRoot, receipt.appRelativePath)), 'resources', 'app.asar'), 1024 ** 3)).sha256, receipt.appArchive.sha256, 'Executed package archive must match its development build receipt');
const dataRoot = join(firstRoot, 'Data'); await mkdir(dataRoot); const projects = new ProjectStore(dataRoot);
const source = 'flowchart TD\n A[Packaged Unicode] --> B[Owned local recovery]';
const editedSource = 'flowchart TD\n A[Packaged pointer save] --> B[Owned preserved recovery]';
const project = await projects.createProject({ label: 'Packaged local-PIN fixture', json: JSON.stringify({ source }) });
await new RecoveryStore(dataRoot).checkpointProject({ snapshot: project, kind: 'saved' });
await writeFile(join(dataRoot, 'session-selection.json'), JSON.stringify({ schema: 1, accountId: null, projectId: project.project.id }));
const forbiddenRoot = join(evidence, 'must-not-be-used'); let driver; let saveDiagnostic = null; let lastOperation = null; let operationSerial = 0;
const probeSha256 = createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
try {
  const launch = async root => {
    const native = await launchDesktop({ executable: join(root, receipt.appRelativePath), packaged: true, extraArgs: ['--enable-logging=file', `--log-file=${join(evidence, 'runtime.log')}`, `--siren-test-root=${forbiddenRoot}`, '--siren-test-project=ignored-project'] });
    const observed = { ...native };
    for (const method of ['evaluate', 'waitFor', 'click', 'send']) observed[method] = async (...args) => {
      const value = args[0];
      const detail = typeof value === 'string' && /(?:setupPin|unlockPin)\(/.test(value) ? 'Native PIN operation (fixture secret masked)' : value;
      lastOperation = { id: ++operationSerial, method, detail };
      return native[method](...args);
    };
    return observed;
  };
  driver = await launch(firstRoot);
  await driver.waitFor('window.sirenDesktopBootstrap?.mode === "locked"');
  assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'), null, 'Locked package must not disclose its selected snapshot');
  assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.readonly'), true);
  assert.equal(await driver.evaluate('typeof window.require'), 'undefined');
  const denied = await driver.evaluate(`window.sirenDesktop.saveProject({projectId:${JSON.stringify(project.project.id)},baseRevision:1,json:'{}',purpose:'workspace'})`);
  assert.equal(denied.ok, false, 'Known project ID cannot bypass the native PIN gate');
  assert.equal(denied.code,await driver.evaluate('location.href==="siren://app/home.html"')?'SENDER_REFUSED':'PIN_REQUIRED');
  await assert.rejects(access(forbiddenRoot), { code: 'ENOENT' });
  assert.equal((await projects.readProject(project.project.id)).sha256, project.sha256);
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0" && !!document.querySelector("svg .node")');
  assert.equal(await driver.evaluate('document.getElementById("source").value'), source);
  assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.readonly'), false, 'Real local PIN unlock permits packaged editing without an online account');
  await driver.waitFor('!document.body.classList.contains("read-only-mode")');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  const beforeEdit = await projects.readProject(project.project.id);
  saveDiagnostic = { kind: 'production-editor-flush', baselineRevision: beforeEdit.revision, flush: 'not-started' };
  await driver.click('#codeModeButton'); await driver.click('#textModeButton'); await driver.click('#source');
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  await driver.send('Input.insertText', { text: editedSource });
  await driver.waitFor(`document.getElementById('source').value===${JSON.stringify(editedSource)}`);
  assert.equal(await driver.evaluate('typeof window.sirenDesktopRequestClose'), 'function');
  saveDiagnostic.flush = 'pending';
  // This production boundary clears delayed saves, saves the real editor state,
  // and drains both renderer and native adapter queues until acknowledged.
  // A raw CAS write alongside that adapter can legitimately lose its revision.
  await driver.evaluate('window.sirenDesktopRequestClose()');
  const acknowledged = await projects.readProject(project.project.id);
  saveDiagnostic = { ...saveDiagnostic, flush: 'resolved', postReadRevision: acknowledged.revision, postReadSha256: acknowledged.sha256 };
  await writeFile(join(evidence, 'save-diagnostic.json'), JSON.stringify(saveDiagnostic, null, 2));
  assert.ok(acknowledged.revision > beforeEdit.revision, 'Actual packaged editor save must advance its native revision');
  assert.equal(createHash('sha256').update(Buffer.from(acknowledged.json)).digest('hex'), acknowledged.sha256);
  const savedBag = JSON.parse(acknowledged.json);
  assert.equal(savedBag.kind, 'siren-desktop'); assert.equal(savedBag.schema, 1);
  const savedState = JSON.parse(savedBag.storage['t-industries-siren-v23-state']);
  assert.equal(savedState.source, editedSource);
  assert.equal(savedState.diagrams.find(d => d.id === savedState.activeDiagramId)?.source, editedSource);
  const acknowledgedRevisions = join(dataRoot, 'Projects', project.project.id, 'revisions');
  const acknowledgedNames = (await readdir(acknowledgedRevisions)).filter(name => name.startsWith(`${acknowledged.revision}-`) && /^[0-9]+-[a-f0-9-]{36}\.json$/.test(name));
  assert.equal(acknowledgedNames.length, 1);
  const selectedBytes = await readFile(join(acknowledgedRevisions, acknowledgedNames[0]));
  assert.equal(createHash('sha256').update(selectedBytes).digest('hex'), createHash('sha256').update(Buffer.from(JSON.stringify(acknowledged))).digest('hex'));
  assert.deepEqual(JSON.parse(selectedBytes.toString('utf8')), acknowledged, 'Readback must match the complete committed snapshot bytes');
  // This acknowledged saved checkpoint is the exact recovered-copy target.
  const restorePoint = (await new RecoveryStore(dataRoot).scan(project.project.id)).valid.find(p => p.kind === 'saved' && p.snapshot.sha256 === acknowledged.sha256 && p.snapshot.json === acknowledged.json);
  assert.ok(restorePoint, 'Acknowledged native write must have a verified recovery checkpoint');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  await driver.click('#desktopOptions'); await driver.click('#desktopCheckUpdates');
  await driver.waitFor('document.querySelector(".desktop-state").textContent.includes("not configured")');
  await driver.waitFor('Number(getComputedStyle(document.getElementById("desktopControlsPanel")).opacity) >= 0.99');
  await driver.screenshot(join(evidence, 'packaged-desktop.png'));
  await driver.click('#desktopRecovery'); await driver.waitFor('document.getElementById("desktopRecoveryPanel")?.open');
  await driver.waitFor('Number(getComputedStyle(document.getElementById("desktopRecoveryPanel")).opacity) >= 0.99');
  assert.ok(await driver.evaluate('document.querySelectorAll(".desktop-recovery-row").length') > 0);
  await driver.screenshot(join(evidence, 'packaged-recovery.png'));
  // A normal backup may update after the first edit acknowledgement. Preserve
  // the complete original at the explicitly drained pre-restore boundary;
  // the recovered copy still must match the selected verified checkpoint.
  await driver.evaluate('window.sirenDesktopRequestClose()');
  const preservedOriginal = await projects.readProject(project.project.id);
  assert.equal(JSON.parse(JSON.parse(preservedOriginal.json).storage['t-industries-siren-v23-state']).source, editedSource);
  assert.equal(createHash('sha256').update(Buffer.from(preservedOriginal.json)).digest('hex'), preservedOriginal.sha256);
  await writeFile(join(evidence, 'restore-boundary.json'), JSON.stringify({ selectedCheckpoint: acknowledged, preservedOriginal }, null, 2));
  const pointId = restorePoint.id;
  await driver.click(`#recover-${pointId}`);
  await driver.waitFor(`!!window.sirenDesktopBootstrap?.snapshot && window.sirenDesktopBootstrap.snapshot.project.id !== ${JSON.stringify(project.project.id)} && !document.body?.classList.contains('read-only-mode')`);
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0" && !!document.querySelector("svg .node")');
  assert.equal(await driver.evaluate('document.getElementById("source").value'), editedSource);
  assert.deepEqual(await projects.readProject(project.project.id), preservedOriginal, 'Recovery must preserve the complete acknowledged pre-restore original exactly');
  const recoveredBootstrap = await driver.evaluate('window.sirenDesktopBootstrap.snapshot');
  const recoveredId = recoveredBootstrap.project.id;
  assert.notEqual(recoveredId, project.project.id);
  assert.equal(recoveredBootstrap.revision, 1);
  assert.equal(recoveredBootstrap.json, acknowledged.json);
  assert.equal(recoveredBootstrap.sha256, acknowledged.sha256);
  // Independently inspect the initial recovered revision, which normal editing
  // cannot rewrite, and its native saved checkpoint rather than a later pointer.
  const recoveredRevisions = join(dataRoot, 'Projects', recoveredId, 'revisions');
  const initialNames = (await readdir(recoveredRevisions)).filter(name => /^1-[a-f0-9-]{36}\.json$/.test(name));
  assert.equal(initialNames.length, 1);
  const initialRecovered = JSON.parse((await readFile(join(recoveredRevisions, initialNames[0]))).toString('utf8'));
  assert.equal(initialRecovered.project.id, recoveredId); assert.equal(initialRecovered.revision, 1);
  assert.equal(initialRecovered.json, acknowledged.json); assert.equal(initialRecovered.sha256, acknowledged.sha256);
  assert.equal(createHash('sha256').update(Buffer.from(initialRecovered.json)).digest('hex'), initialRecovered.sha256);
  const initialCheckpoint = (await new RecoveryStore(dataRoot).scan(recoveredId)).valid.find(point => point.kind === 'saved' && point.snapshot.revision === 1);
  assert.ok(initialCheckpoint, 'Initial recovered revision must have its native saved checkpoint');
  assert.deepEqual(initialCheckpoint.snapshot, initialRecovered, 'Initial recovered disk bytes and native checkpoint must describe the complete same snapshot');
  assert.deepEqual(recoveredBootstrap, initialRecovered, 'Native initial bootstrap must match the complete immutable recovered revision');
  await writeFile(join(evidence, 'recovered-initial-revision.json'), JSON.stringify(initialRecovered, null, 2));
  // Normal initialization/editing may save a newer canonical envelope. Drain
  // that production queue and inspect one complete current snapshot; do not
  // combine JSON and hash from separate mutable-pointer generations.
  await driver.evaluate('window.sirenDesktopRequestClose()');
  const recoveredAtRestore = await projects.readProject(recoveredId);
  await writeFile(join(evidence, 'recovered-at-restore.json'), JSON.stringify({ selectedCheckpoint: acknowledged, recoveredBootstrap, initialRecovered, recoveredAtRestore }, null, 2));
  assert.equal(recoveredAtRestore.project.id, recoveredId);
  assert.ok(recoveredAtRestore.revision >= initialRecovered.revision);
  assert.equal(createHash('sha256').update(Buffer.from(recoveredAtRestore.json)).digest('hex'), recoveredAtRestore.sha256);
  const recoveredBag = JSON.parse(recoveredAtRestore.json);
  assert.equal(recoveredBag.kind, 'siren-desktop'); assert.equal(recoveredBag.schema, 1);
  const recoveredState = JSON.parse(recoveredBag.storage['t-industries-siren-v23-state']);
  assert.equal(recoveredState.source, editedSource);
  assert.equal(recoveredState.diagrams.find(d => d.id === recoveredState.activeDiagramId)?.source, editedSource);
  assert.deepEqual(await projects.readProject(project.project.id), preservedOriginal);
  await driver.evaluate('window.sirenDesktop.requestClose()');
  await driver.waitForExit();
  await driver.close(); driver = null;
  const closeEvents = JSON.parse(await readFile(join(dataRoot, 'Recovery', 'sessions.json'), 'utf8')).events;
  assert.equal(closeEvents.at(-1)?.event, 'clean-close', 'Moving the full package requires an acknowledged normal application exit, not killing only its parent process');
  assert.deepEqual(await projects.readProject(project.project.id), preservedOriginal);
  const recoveredAfterExit = await projects.readProject(recoveredId);
  const exitedBag = JSON.parse(recoveredAfterExit.json);
  const exitedSource = exitedBag.source ?? JSON.parse(exitedBag.storage['t-industries-siren-v23-state']).source;
  assert.equal(exitedSource, editedSource, 'Normal editable close must retain recovered source while serializing renderer state');
  const closedInventory = await closedPackageInventory(firstRoot);
  const secondRoot = join(evidence, 'Mutat-Știință-2'); await cp(firstRoot, secondRoot, { recursive: true, errorOnExist: true, force: false });
  const copiedInventory = await closedPackageInventory(secondRoot);
  assert.deepEqual(copiedInventory, closedInventory, 'The complete closed package directory must copy with identical file names and bytes before launch');
  await writeFile(join(evidence, 'folder-copy.json'), JSON.stringify({ source: closedInventory, copied: copiedInventory }, null, 2));
  const movedProjects = new ProjectStore(join(secondRoot, 'Data'));
  assert.deepEqual(await movedProjects.readProject(recoveredId), recoveredAfterExit, 'Copied snapshot must equal the normal-exit snapshot before a renderer can save');
  assert.deepEqual(await movedProjects.readProject(project.project.id), preservedOriginal);
  driver = await launch(secondRoot);
  await driver.waitFor('window.sirenDesktopBootstrap?.mode === "locked"');
  assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'), null, 'Copied package must relock on fresh process startup');
  assert.equal((await driver.evaluate('window.sirenDesktop.getPinState()')).unlocked, false);
  const movedDenied = await driver.evaluate(`window.sirenDesktop.saveProject(${JSON.stringify({ projectId: recoveredId, baseRevision: 1, json: '{}', purpose: 'workspace' })})`);
  assert.equal(movedDenied.ok, false);
  assert.equal(movedDenied.code, 'PIN_REQUIRED');
  assert.deepEqual(await movedProjects.readProject(recoveredId), recoveredAfterExit, 'Locked startup must preserve the complete copied snapshot');
  assert.deepEqual(await movedProjects.readProject(project.project.id), preservedOriginal);
  await unlockDesktop(driver, { pin: '4826', autoSetup: false });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0" && !!document.querySelector("svg .node")');
  assert.equal(await driver.evaluate('document.getElementById("source").value'), editedSource);
  assert.deepEqual(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'), recoveredAfterExit, 'Native copied-project bootstrap must exactly match the closed copied snapshot');
  await driver.evaluate('window.sirenDesktopRequestClose()');
  const movedCurrent = await movedProjects.readProject(recoveredId);
  assert.equal(movedCurrent.project.id, recoveredId); assert.ok(movedCurrent.revision >= recoveredAfterExit.revision);
  assert.equal(createHash('sha256').update(Buffer.from(movedCurrent.json)).digest('hex'), movedCurrent.sha256);
  const movedState = JSON.parse(JSON.parse(movedCurrent.json).storage['t-industries-siren-v23-state']);
  assert.equal(movedState.source, editedSource);
  assert.equal(movedState.diagrams.find(d => d.id === movedState.activeDiagramId)?.source, editedSource);
  assert.deepEqual(await movedProjects.readProject(project.project.id), preservedOriginal);
  assert.equal((await hashOwnedFile(join(secondRoot, receipt.appRelativePath), 1024 ** 3)).sha256, receipt.runtimeBinary.sha256);
  await driver.evaluate('window.sirenDesktop.requestClose()'); await driver.waitForExit(); await driver.close(); driver = null;
  const recoveredBeforeSafety = await new ProjectStore(join(secondRoot, 'Data')).readProject(recoveredId);
  assert.deepEqual(await new ProjectStore(join(secondRoot, 'Data')).readProject(project.project.id), preservedOriginal);
  // An owned damaged-journal variant verifies PIN cannot override native safety.
  const safetyRoot = join(evidence, 'Siguranță-readonly-3');
  await cp(secondRoot, safetyRoot, { recursive: true, errorOnExist: true, force: false });
  await writeFile(join(safetyRoot, 'Data', 'Recovery', 'sessions.json'), '{owned damaged journal fixture');
  driver = await launch(safetyRoot);
  await driver.waitFor('window.sirenDesktopBootstrap?.mode === "locked"');
  await unlockDesktop(driver, { pin: '4826', autoSetup: false });
  await driver.waitFor('window.sirenDesktopBootstrap?.mode === "readonly"');
  assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.readonly'), true, 'Native damaged-journal safety remains authoritative after a correct PIN');
  const safetyDenied = await driver.evaluate(`window.sirenDesktop.saveProject(${JSON.stringify({ projectId: recoveredId, baseRevision: 1, json: '{}', purpose: 'workspace' })})`);
  assert.equal(safetyDenied.ok, false, 'Correct PIN cannot bypass native safety read-only');
  assert.equal(safetyDenied.code, 'ACCESS_REFUSED');
  assert.deepEqual(await new ProjectStore(join(safetyRoot, 'Data')).readProject(project.project.id), preservedOriginal);
  assert.deepEqual(await new ProjectStore(join(safetyRoot, 'Data')).readProject(recoveredId), recoveredBeforeSafety);
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Actual packaged app.asar/SIREN.exe, locked null snapshot/refused saves, production native fixture PIN unlock, pointer/keyboard editor save through production acknowledged flush with exact native bytes/revision/hash/full-bag readback, rejected dev CLI, Unicode folder copy relock/unlock, pointer recovery into a new project preserving the acknowledged saved original, native damaged-journal read-only authority despite correct PIN, and unconfigured updates. No launcher/apply/clean-PC/online account qualification.', probeSha256, saveDiagnostic, sourceCommit: receipt.sourceCommit, rendererSha256: receipt.renderer.rendererSha256, archive: receipt.appArchive, runtime: receipt.runtimeBinary, initialProjectSha256: project.sha256, acknowledgedProjectSha256: acknowledged.sha256 }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));
} catch (error) {
  const failedOperation = lastOperation;
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: false, error: String(error.stack || error), probeSha256, failedOperation, saveDiagnostic, sourceCommit: receipt.sourceCommit, rendererSha256: receipt.renderer.rendererSha256, archive: receipt.appArchive, runtime: receipt.runtimeBinary }, null, 2));
  if (driver) {
    await writeFile(join(evidence, 'failure-events.json'), JSON.stringify(driver.events.filter(event => /^(?:Runtime\.executionContext(?:Created|Destroyed|sCleared)|Page\.(?:frameNavigated|frameStartedLoading|frameStoppedLoading|javascriptDialogOpening|javascriptDialogClosed))$/.test(event.method)).slice(-256), null, 2));
    await driver.screenshot(join(evidence, 'failure.png')).catch(() => {});
    const state = await driver.evaluate(`(()=>{const panel=document.getElementById('desktopControlsPanel');return {visibility:document.visibilityState,focused:document.hasFocus(),inert:document.body.inert,locked:window.sirenDesktopStorageLocked,bodyClasses:document.body.className,panel:panel?{open:panel.open,opacity:getComputedStyle(panel).opacity,display:getComputedStyle(panel).display,visibility:getComputedStyle(panel).visibility,animation:getComputedStyle(panel).animation,rect:panel.getBoundingClientRect().toJSON()}:null,animations:document.getAnimations().map(a=>({playState:a.playState,currentTime:a.currentTime,finish:a.effect?.getComputedTiming()?.endTime})),bootstrap: {mode:window.sirenDesktopBootstrap?.mode,readonly:window.sirenDesktopBootstrap?.readonly}};})()`).catch(() => null);
    await writeFile(join(evidence, 'failure-state.json'), JSON.stringify({ error: error.message, state }, null, 2));
  }
  throw error;
} finally { if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
