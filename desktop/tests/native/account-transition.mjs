import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ProjectStore } from '../../src/projects/store.mjs';
import { RecoveryStore } from '../../src/recovery/checkpoints.mjs';
import { launchDesktop } from './drive.mjs';

const evidence = resolve('evidence', `account-transition-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'data-')); const projects = new ProjectStore(root);
const first = await projects.createProject({ label: 'Account transition UI proof', json: '{"source":"flowchart TD\\n A[Account]-->B[Saved first]"}' });
const recovery = new RecoveryStore(root); await recovery.checkpointProject({ snapshot: first, kind: 'saved' });
let driver;
try {
  driver = await launchDesktop({ extraArgs: [`--siren-test-root=${root}`, `--siren-test-project=${first.project.id}`] });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  await driver.click('#codeLibraryButton'); await driver.click('#codeSectionNewButton'); await driver.click('#cwEditor');
  await driver.evaluate('window.__transitionToasts=[];new MutationObserver(()=>window.__transitionToasts.push(document.getElementById("toast").textContent)).observe(document.getElementById("toast"),{childList:true,subtree:true,characterData:true})');
  const python = 'def transition_proof(values):\n    for value in values:\n        yield value * 2\n\nPRIVATE_TRANSITION_MARKER = "uncommitted-β"\n';
  await driver.send('Input.insertText', { text: python });
  // Invoke the actual final-commit renderer guard. This is not a production login.
  await driver.evaluate('window.sirenDesktopBeginAccountTransition()');
  assert.equal(await driver.evaluate('document.body.inert && window.sirenDesktopStorageLocked'), true);
  const textBefore = await driver.evaluate('document.getElementById("cwEditor").value');
  await driver.send('Input.insertText', { text: 'SHOULD_NOT_ENTER_LOCKED_EDITOR' });
  assert.equal(await driver.evaluate('document.getElementById("cwEditor").value'), textBefore);
  const saved = await projects.readProject(first.project.id);
  const bag = JSON.parse(saved.json);
  assert.ok(bag.storage['siren-code-drafts-v1'].includes('PRIVATE_TRANSITION_MARKER'));
  assert.equal(bag.storage['t-industries-siren-v23-state'].includes('PRIVATE_TRANSITION_MARKER'), false, 'Guard cannot implicitly save private Code to Docs');
  assert.ok((await recovery.scan(first.project.id)).valid.some(point => point.snapshot.json.includes('PRIVATE_TRANSITION_MARKER')));
  await driver.evaluate('new Promise(resolve=>setTimeout(resolve,1000))');
  await driver.screenshot(join(evidence, 'account-commit-guard.png'));
  await writeFile(join(evidence, 'transition-toasts.json'), JSON.stringify(await driver.evaluate('window.__transitionToasts')));
  assert.equal(await driver.evaluate('window.__transitionToasts.some(text=>text.includes("Local save failed"))'), false, 'Pending autosave timers cannot report a false save failure during the guarded transition');
  await driver.evaluate('window.sirenDesktopEndAccountTransition()');
  assert.equal(await driver.evaluate('document.body.inert || window.sirenDesktopStorageLocked'), false);
  const accessBefore = await driver.evaluate('window.sirenDesktop.getAccess()');
  await driver.click('#desktopOptions'); await driver.click('#desktopAccountSignIn');
  await driver.waitFor('document.getElementById("desktopAccessScreen")?.open');
  await driver.waitFor('Number(getComputedStyle(document.querySelector(".desktop-access-centre")).opacity)>.99');
  assert.equal(await driver.evaluate('!!document.getElementById("desktopControlsPanel")'), false, 'Access preview replaces the Desktop panel');
  await driver.click('#desktopAccessOnline');
  await driver.waitFor('document.getElementById("desktopAccessStatus")?.textContent.includes("production account service") && !document.getElementById("desktopAccessOnline").disabled');
  assert.equal(await driver.evaluate('document.body.inert'), false, 'Unavailable login cannot lock editing');
  assert.equal(await driver.evaluate('!!window.sirenDesktopStorageLocked'), false, 'Unavailable login cannot leave storage locked');
  assert.deepEqual(await driver.evaluate('window.sirenDesktop.getAccess()'), accessBefore, 'Unconfigured activation cannot grant or change account authority');
  await driver.screenshot(join(evidence, 'unconfigured-online-activation.png'));
  await driver.click('#desktopAccessBack');
  await driver.waitFor('!document.getElementById("desktopAccessScreen")');
  assert.equal(await driver.evaluate('document.getElementById("cwEditor").value'), python, 'Attempted activation must preserve the exact private draft');
  await driver.click('#cwEditor');
  const resumed = '\n# Editing resumed after unavailable online activation\n';
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', modifiers: 2, windowsVirtualKeyCode: 35 });
  await driver.send('Input.insertText', { text: resumed });
  await driver.evaluate('window.sirenDesktopRequestClose()');
  const resumedBag = JSON.parse((await projects.readProject(first.project.id)).json);
  assert.ok(JSON.parse(resumedBag.storage['siren-code-drafts-v1']).some(draft => draft.text === python + resumed), 'Resumed keyboard edit must receive a native private-draft save');
  assert.equal(resumedBag.storage['t-industries-siren-v23-state'].includes('PRIVATE_TRANSITION_MARKER'), false);
  await driver.evaluate('window.sirenDesktopApplySafety({readonly:true,reason:"Controlled readiness failure UI proof"})');
  await driver.waitFor('document.body.classList.contains("read-only-mode") && document.getElementById("saveStateText").textContent.includes("Read-only")');
  await driver.screenshot(join(evidence, 'runtime-safety-ui.png'));
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, renderer: JSON.parse(await readFile('generated/build.json', 'utf8')), scope: 'Actual unprivileged renderer final-account guard with keyboard input blocked, exact native workspace/private-draft checkpoint readback and explicit resume. Actual unconfigured login stays usable; runtime safety UI was invoked directly. Not production login, not native journal-failure injection; native permission is separately tested in source service integrations.' }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));
} catch (error) {
  if (driver) {
    await driver.screenshot(join(evidence, 'failure.png')).catch(() => {});
    const state = await driver.evaluate(`({bodyInert:document.body.inert,storageLocked:!!window.sirenDesktopStorageLocked,accessOpen:document.getElementById('desktopAccessScreen')?.open,accessStatus:document.getElementById('desktopAccessStatus')?.textContent,controlsOpen:document.getElementById('desktopControlsPanel')?.open,focused:document.activeElement?.id})`).catch(() => null);
    await writeFile(join(evidence, 'failure-state.json'), JSON.stringify({ error: String(error.stack || error), state }, null, 2));
    console.error('SIREN_ACCOUNT_TRANSITION_DIAGNOSTIC ' + JSON.stringify(state));
  }
  throw error;
} finally { if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
