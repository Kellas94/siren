import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ProjectStore } from '../../src/projects/store.mjs';
import { RecoveryStore } from '../../src/recovery/checkpoints.mjs';
import { launchDesktop, unlockDesktop } from './drive.mjs';

const evidence = resolve('evidence', `code-recovery-${new Date().toISOString().replaceAll(':', '-')}`); await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'data-')); const projects = new ProjectStore(root); const recovery = new RecoveryStore(root);
const first = await projects.createProject({ label: 'Private Code proof', json: '{"source":"flowchart TD\\n A[Code recovery]-->B"}' });
await recovery.checkpointProject({ snapshot: first, kind: 'saved' });
const python = 'from dataclasses import dataclass\n\n@dataclass\nclass Agent:\n    name: str\n    def review(self, values):\n        for value in values:\n            if value > 0:\n                yield value * 2\n\nPRIVATE_DRAFT_MARKER = "exact-uncommitted-α"\n';
const extraArgs = [`--siren-test-root=${root}`, `--siren-test-project=${first.project.id}`]; let driver;
const diagnostic={phase:'startup',commands:[]};let sequence=0;
const trace=owned=>{
  diagnostic.ownedPid=owned.pid;
  // Stage/method metadata only: retain the first failed command without PIN,
  // Python, expressions or returned private workspace data. Deadlines and
  // persistence/clean-close assertions stay unchanged.
  for(const method of ['evaluate','waitFor','click','send','screenshot','waitForExit']){
    const execute=owned[method].bind(owned);
    owned[method]=async(...args)=>{
      const command={sequence:++sequence,phase:diagnostic.phase,method,started:new Date().toISOString()};
      diagnostic.commands.push(command);if(diagnostic.commands.length>32)diagnostic.commands.shift();
      await writeFile(join(evidence,'diagnostic.json'),JSON.stringify(diagnostic,null,2));
      try{const value=await execute(...args);command.finished=new Date().toISOString();return value;}
      catch(cause){command.error=String(cause.message).startsWith('CDP timeout:')?cause.message:'COMMAND_FAILED';diagnostic.failedCommand??={...command};throw cause;}
    };
  }
  return owned;
};
try {
  driver = trace(await launchDesktop({ extraArgs }));
  diagnostic.phase='initial-unlock';
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  diagnostic.phase='initial-intro';
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  diagnostic.phase='open-private-code';
  await driver.click('#codeLibraryButton'); await driver.click('#codeSectionNewButton');
  await driver.waitFor('document.getElementById("codeWorkspace")?.hidden === false');
  diagnostic.phase='edit-private-code';
  await driver.click('#cwEditor'); await driver.send('Input.insertText', { text: python });
  diagnostic.phase='native-draft-checkpoint';
  const until = Date.now() + 8000; let point;
  while (Date.now() < until) { point = (await recovery.scan(first.project.id)).valid.find(p => p.kind === 'draft' && p.snapshot.json.includes('exact-uncommitted-α')); if (point) break; await delay(100); }
  assert.ok(point, 'Actual Python draft must reach native recovery, not only Chromium localStorage');
  const draftBag = JSON.parse(point.snapshot.json); const draftRecord = JSON.parse(draftBag.storage['siren-code-drafts-v1']);
  assert.ok(JSON.stringify(draftRecord).includes('PRIVATE_DRAFT_MARKER'));
  const workspace = JSON.parse(draftBag.storage['t-industries-siren-v23-state']);
  assert.equal(JSON.stringify(workspace.workpapers || []).includes('PRIVATE_DRAFT_MARKER'), false, 'Private draft must not implicitly become a Docs source');
  diagnostic.phase='private-code-graph';
  await driver.waitFor('document.querySelector("#cwGraph svg")?.textContent.includes("Agent")');
  await driver.screenshot(join(evidence, 'private-code.png'));
  // Exercise the actual native Quit accelerator and require a durable clean-close record.
  diagnostic.phase='native-quit';
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'q', code: 'KeyQ', modifiers: 2, windowsVirtualKeyCode: 81 });
  diagnostic.phase='clean-close-journal';
  let clean = false; const closeUntil = Date.now() + 12000;
  while (Date.now() < closeUntil) { const events = JSON.parse(await readFile(join(root, 'Recovery', 'sessions.json'))).events; clean = events.some(e => e.event === 'clean-close'); if (clean) break; await delay(100); }
  if (!clean) {diagnostic.phase='close-diagnosis';await writeFile(join(evidence, 'close-diagnosis.json'), JSON.stringify(await driver.evaluate('window.sirenDesktopRequestClose().then(()=>({ok:true})).catch(e=>({error:e.message}))')));}
  assert.equal(clean, true, 'Native Quit must await save/recovery and record a clean close');
  // The journal event precedes window destruction. Do not force-kill the owned
  // process while its normal unload/exit is still pending before a restart.
  diagnostic.phase='native-exit';
  await driver.waitForExit();
  await driver.close(); diagnostic.phase='restart';driver = trace(await launchDesktop({ extraArgs }));
  diagnostic.phase='restart-unlock';
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  diagnostic.phase='restart-draft';
  const snapshot = await projects.readProject(first.project.id);
  assert.ok(JSON.parse(snapshot.json).storage['siren-code-drafts-v1'].includes('exact-uncommitted-α'));
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  await driver.click('#codeLibraryButton');
  assert.ok((await driver.evaluate('document.getElementById("codeLibrarySection").textContent')).includes('Untitled 1.py'));
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Actual Python keyboard draft -> native checkpoint, no implicit Docs save, native Quit confirmation, restart and private draft library', projectId: first.project.id, pointId: point.id }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));
} catch (error) {
  const failure = { completed: false, error: String(error.stack || error), snapshot: await projects.readProject(first.project.id).catch(error => ({ error: error.message })) };
  if (driver) {
    failure.ui = await driver.evaluate(`({confirmationOpen:document.getElementById('confirmDialog')?.open,confirmationText:document.getElementById('confirmDialog')?.textContent,saveState:document.getElementById('saveStateChip')?.dataset.state,saveText:document.getElementById('saveStateText')?.textContent,bootstrap:window.sirenDesktopBootstrap})`).catch(error => ({ error: error.message }));
    await driver.screenshot(join(evidence, 'failure.png')).catch(() => {});
  }
  await writeFile(join(evidence, 'failure.json'), JSON.stringify(failure, null, 2));
  console.error(JSON.stringify({ evidence, error: failure.error, ui: failure.ui }));
  throw error;
} finally { await writeFile(join(evidence,'diagnostic.json'),JSON.stringify(diagnostic,null,2));if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
