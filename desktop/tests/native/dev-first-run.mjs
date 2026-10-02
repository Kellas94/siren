import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { ProjectStore } from '../../src/projects/store.mjs';
import { launchDesktop, unlockDesktop, waitForDesktopStartup } from './drive.mjs';

// Fresh owned Data, deliberately no --siren-test-project or precreated project.
const evidence = resolve('evidence', `dev-first-run-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'data-'));
const build = JSON.parse(await readFile('generated/build.json', 'utf8'));
const sources = Object.fromEntries(await Promise.all(['src/main.mjs', 'src/preload.cjs', 'tests/native/drive.mjs', 'tests/native/dev-first-run.mjs'].map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const result = { completed: false, build, sources, scope: 'Actual first development launch creates an owned editable scratch project; Guided keyboard save and floating Code minimise. Packaged account activation is not changed or bypassed.' };
let driver;
const save = () => writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
try {
  driver = await launchDesktop({ extraArgs: [`--siren-test-root=${root}`] });
  result.initialContext = await driver.evaluate(`({url:location.href,readyState:document.readyState,bridge:typeof window.sirenDesktop?.getPinState,bootstrapMode:window.sirenDesktopBootstrap?.mode})`).catch(error => ({ observationError: error.message }));
  result.firstAppEntry = await waitForDesktopStartup(driver);
  assert.equal(result.firstAppEntry.url, 'siren://app/app.html', 'First fixture authentication must use the actual app entry, never about:blank');
  assert.equal(result.firstAppEntry.bootstrap.mode, 'locked');
  assert.equal(result.firstAppEntry.bootstrap.snapshotPresent, false, 'First real app entry must still withhold the native snapshot');
  assert.equal(result.firstAppEntry.bootstrap.pin.configured, false, 'Fresh owned Data must start without a configured PIN');
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  result.bootstrap = await driver.evaluate('({mode:window.sirenDesktopBootstrap?.mode,readonly:window.sirenDesktopBootstrap?.readonly,project:window.sirenDesktopBootstrap?.snapshot?.project})');
  await driver.screenshot(join(evidence, 'first-development-launch.png'));
  assert.equal(result.bootstrap.mode, 'normal');
  assert.equal(result.bootstrap.readonly, false, 'Fresh development launch must create an editable project');
  assert.match(result.bootstrap.project?.id || '', /^[a-f0-9-]{36}$/, 'Fresh development project needs a native identity');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  if (await driver.evaluate('!!document.querySelector(".tour-card")')) {
    await driver.waitFor('Number(getComputedStyle(document.querySelector(".tour-card")).opacity)>.99');
    await driver.click('.tour-card .tour-actions .ghost');
  }
  const python = 'def startup_probe(value):\n    return value + 1\n';
  await driver.click('#codeLibraryButton'); await driver.click('#codeSectionNewButton');
  await driver.click('#cwEditor'); await driver.send('Input.insertText', { text: python });
  await driver.click('#codeWorkspace [data-action="minimise"]');
  await driver.waitFor('document.getElementById("codeWorkspace").hidden && !document.getElementById("codeWorkspaceRestore").hidden');
  result.codeMinimised = true;
  await driver.click('#codeModeButton'); await driver.click('#textModeButton');
  await driver.click('#source');
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  const source = 'flowchart TD\n A[Start]-->B[Next step]';
  await driver.send('Input.insertText', { text: source });
  await driver.click('#structureModeButton');
  await driver.waitFor('!document.getElementById("structureEditor").hidden && document.querySelectorAll("#structureRows .struct-code").length===2');
  await driver.click('#structureRows [data-kind="label"][aria-label="Label: Start"]');
  await driver.waitFor('!!document.querySelector("#structureRows .struct-inline-input")');
  await driver.send('Input.insertText', { text: 'First development save' });
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  const edited = 'flowchart TD\n A["First development save"] --> B[Next step]';
  await driver.waitFor(`document.getElementById('source').value===${JSON.stringify(edited)}`);
  await driver.evaluate('window.sirenDesktopRequestClose()');
  const snapshot = await new ProjectStore(root).readProject(result.bootstrap.project.id);
  const bag = JSON.parse(snapshot.json);
  const state = JSON.parse(bag.storage['t-industries-siren-v23-state']);
  assert.equal(state.diagrams.find(d => d.id === state.activeDiagramId).source, edited);
  assert.ok(JSON.parse(bag.storage['siren-code-drafts-v1']).some(d => d.text === python));
  assert.equal(JSON.stringify(state.workpapers).includes('startup_probe'), false);
  result.savedRevision = snapshot.revision; result.guidedSaved = true;
  await driver.screenshot(join(evidence, 'guided-saved-code-minimised.png'));
  await driver.click('#codeWorkspaceRestore');
  assert.equal(await driver.evaluate('document.getElementById("cwEditor").value'), python);
  result.codeRestored = true;
  result.completed = true; await save();
  console.log(JSON.stringify({ completed: true, evidence, projectId: result.bootstrap.project.id }));
} catch (error) {
  result.error = String(error.stack || error);
  if (driver) {
    await driver.screenshot(join(evidence, 'failure.png')).catch(() => {});
    result.failureState = await driver.evaluate(`({url:location.href,readyState:document.readyState,bridge:typeof window.sirenDesktop?.getPinState,bootstrap:window.sirenDesktopBootstrap?{mode:window.sirenDesktopBootstrap.mode,readonly:window.sirenDesktopBootstrap.readonly,pin:window.sirenDesktopBootstrap.pin}:null,body:document.body?.className,source:document.getElementById('source')?.value,readonlyBanner:document.getElementById('readOnlyBanner')?.textContent,editor:[...document.querySelectorAll('#codeEditor,#structureEditor')].map(e=>({id:e.id,hidden:e.hidden,display:getComputedStyle(e).display,rect:e.getBoundingClientRect().toJSON()}))})`).catch(() => null);
    result.saveState = await driver.evaluate(`({state:document.getElementById('saveStateChip')?.dataset.state,text:document.getElementById('saveStateText')?.textContent,confirmationOpen:document.getElementById('confirmDialog')?.open,confirmationText:document.getElementById('confirmDialog')?.textContent})`).catch(() => null);
    result.nativeSnapshot = await new ProjectStore(root).readProject(result.bootstrap?.project?.id).catch(error => ({ error: error.message }));
  }
  await save(); console.error(JSON.stringify({ evidence, error: result.error, initialContext: result.initialContext, failureState: result.failureState, saveState: result.saveState })); throw error;
} finally { if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
