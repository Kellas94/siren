import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ProjectStore } from '../../src/projects/store.mjs';
import { RecoveryStore } from '../../src/recovery/checkpoints.mjs';
import { launchDesktop } from './drive.mjs';

const evidence = resolve('evidence', `desktop-ui-${new Date().toISOString().replaceAll(':', '-')}`); await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'data-')); const projects = new ProjectStore(root);
const first = await projects.createProject({ label: 'Theme and keyboard proof', json: '{"source":"flowchart TD\\n A[Desktop controls]-->B[Local data]"}' }); await new RecoveryStore(root).checkpointProject({ snapshot: first, kind: 'saved' });
let driver;
try {
  driver = await launchDesktop({ extraArgs: [`--siren-test-root=${root}`, `--siren-test-project=${first.project.id}`] });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  // Deliberately cover the visible Desktop button: the same pointer sensor must refuse.
  await driver.evaluate(`(()=>{const e=document.getElementById('desktopOptions'),r=e.getBoundingClientRect(),cover=document.createElement('div');cover.id='intentionalOcclusion';Object.assign(cover.style,{position:'fixed',left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px',zIndex:2147483647,background:'red'});document.body.append(cover)})()`);
  await assert.rejects(driver.click('#desktopOptions'), /Occluded/); await driver.evaluate('document.getElementById("intentionalOcclusion").remove()');
  for (const theme of ['dark', 'light']) {
    await driver.click('#themeMenuButton'); await driver.click(`[data-theme-value="${theme}"]`);
    await driver.waitFor(`document.body.dataset.theme === '${theme}'`);
    await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
    await driver.click('#desktopOptions'); await driver.click('#desktopCheckUpdates');
    await driver.waitFor('document.querySelector(".desktop-state").textContent.includes("not configured")');
    assert.equal(await driver.evaluate('document.getElementById("desktopDownloadUpdate").disabled'), true);
    assert.equal(await driver.evaluate('document.getElementById("desktopCancelUpdate").disabled'), true);
    await driver.click('#desktopLogin'); await driver.waitFor('document.querySelector(".desktop-state").textContent.includes("not activated")');
    const panelBackground = await driver.evaluate('getComputedStyle(document.getElementById("desktopControlsPanel")).backgroundColor');
    assert.ok(!panelBackground.startsWith('rgba(') || panelBackground.endsWith(', 1)'), 'Desktop dialog must use an opaque theme background');
    const panelRgb = await driver.evaluate(`(()=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=getComputedStyle(document.getElementById('desktopControlsPanel')).backgroundColor;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data]})()`);
    assert.equal(panelRgb[3], 255, 'Theme surface must paint opaque pixels');
    assert.ok(theme === 'light' ? panelRgb.slice(0,3).every(v => v > 180) : panelRgb.slice(0,3).every(v => v < 100), 'Dialog background must follow the actual theme, not a constant dark fallback');
    await driver.waitFor('Number(getComputedStyle(document.getElementById("desktopControlsPanel")).opacity) >= 0.99');
    await driver.screenshot(join(evidence, `controls-${theme}.png`));
    await driver.click('#desktopCloseControls');
    await driver.click('#codeLibraryButton'); await driver.click('#codeSectionNewButton');
    const selector = await driver.evaluate(`'#'+[...document.querySelectorAll('.cw-window')].find(e=>!e.hidden).id`);
    await driver.waitFor(`Number(getComputedStyle(document.querySelector(${JSON.stringify(selector)})).opacity) >= 0.99`);
    const background = await driver.evaluate(`getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backgroundColor`);
    assert.ok(!background.startsWith('rgba(') || background.endsWith(', 1)'), 'Zero transparency must provide an opaque readable window');
    const codeRgb = await driver.evaluate(`(()=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=getComputedStyle(document.querySelector(${JSON.stringify(selector)})).backgroundColor;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data]})()`);
    assert.equal(codeRgb[3], 255);
    assert.ok(theme === 'light' ? codeRgb.slice(0,3).every(v => v > 180) : codeRgb.slice(0,3).every(v => v < 100), 'Code window must follow the actual theme');
    await driver.screenshot(join(evidence, `code-${theme}.png`));
    await driver.click(`${selector} [data-action="minimise"]`);
    assert.equal(await driver.evaluate('document.getElementById("codeLibrarySection").hidden'), true, 'Floating Code must release the library');
    assert.equal(await driver.evaluate('document.querySelector(".app-header").inert'), false);
  }
  // Search is the actual curated palette path, including keyboard invocation.
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'k', code: 'KeyK', modifiers: 2, windowsVirtualKeyCode: 75 });
  await driver.waitFor('document.getElementById("commandPalette").open');
  await driver.send('Input.insertText', { text: 'Check for Updates' });
  await driver.waitFor('document.getElementById("commandPaletteList").textContent.includes("Check for Updates")');
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await driver.waitFor('document.getElementById("desktopControlsPanel")?.open && document.querySelector(".desktop-state").textContent.includes("not configured")');
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Dark/Warm Light actual pointer controls and Code opacity, negative occlusion oracle, real Find Ctrl+K keyboard update route; production states covered by separate actual HTTP service tests', projectId: first.project.id }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));
} finally { if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
