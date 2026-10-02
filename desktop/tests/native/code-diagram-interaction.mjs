import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ProjectStore } from '../../src/projects/store.mjs';
import { launchDesktop, unlockDesktop } from './drive.mjs';

// Code minimisation must permit a real edit and save on a different surface.
const evidence = resolve('evidence', `code-diagram-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'data-'));
const projects = new ProjectStore(root);
const project = await projects.createProject({ label: 'Parallel Code and diagram', json: '{"source":"flowchart TD\\n A[Original]-->B[Diagram]"}' });
const python = 'def keep_private(value):\n    return value + 3\n';
const mermaid = 'flowchart TD\n A[EDITED WHILE CODE MINIMISED] --> B[Saved diagram]';
let driver;
try {
  driver = await launchDesktop({ extraArgs: [`--siren-test-root=${root}`, `--siren-test-project=${project.project.id}`] });
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  await driver.click('#codeLibraryButton'); await driver.click('#codeSectionNewButton');
  await driver.click('#cwEditor'); await driver.send('Input.insertText', { text: python });
  await driver.click('#codeWorkspace [data-action="minimise"]');
  await driver.click('#codeModeButton'); await driver.click('#source');
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  await driver.send('Input.insertText', { text: mermaid });
  await driver.waitFor(`[...document.querySelectorAll('svg .node')].some(e=>e.getClientRects().length&&!e.closest('.cw-window')&&e.textContent.replace(/\\s+/g,' ').includes('EDITED WHILE CODE MINIMISED'))`);
  await driver.evaluate('window.sirenDesktopRequestClose()');
  const bag = JSON.parse((await projects.readProject(project.project.id)).json);
  const state = JSON.parse(bag.storage['t-industries-siren-v23-state']);
  assert.equal(state.diagrams.find(d => d.id === state.activeDiagramId).source, mermaid);
  assert.ok(JSON.parse(bag.storage['siren-code-drafts-v1']).some(d => d.text === python));
  assert.equal(JSON.stringify(state.workpapers).includes('keep_private'), false);
  await driver.screenshot(join(evidence, 'diagram-edited-code-minimised.png'));
  await driver.click('#codeWorkspaceRestore');
  assert.equal(await driver.evaluate('document.getElementById("cwEditor").value'), python);
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Actual Python draft -> minimise -> actual Mermaid editor keyboard edit -> diagram render -> acknowledged native save -> exact private Code restore; no implicit Docs save' }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));
} catch (error) {
  if (driver) {
    await driver.screenshot(join(evidence, 'failure.png')).catch(() => {});
    await writeFile(join(evidence, 'failure-state.json'), JSON.stringify(await driver.evaluate(`({source:document.getElementById('source')?.value,svgText:[...document.querySelectorAll('svg')].map(e=>e.textContent.slice(0,500)),toast:document.getElementById('toast')?.textContent})`).catch(() => null), null, 2));
  }
  throw error;
} finally { if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
