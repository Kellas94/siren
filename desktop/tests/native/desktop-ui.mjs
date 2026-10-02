import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ProjectStore } from '../../src/projects/store.mjs';
import { RecoveryStore } from '../../src/recovery/checkpoints.mjs';
import { launchDesktop, unlockDesktop } from './drive.mjs';

const evidence = resolve('evidence', `desktop-ui-${new Date().toISOString().replaceAll(':', '-')}`); await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'data-')); const projects = new ProjectStore(root);
const first = await projects.createProject({ label: 'Theme and keyboard proof', json: '{"source":"flowchart TD\\n A[Desktop controls]-->B[Local data]"}' }); await new RecoveryStore(root).checkpointProject({ snapshot: first, kind: 'saved' });
let driver;
const doneGeometry = [];
async function scrollToDesktopDone() {
  const state = await driver.evaluate(`(()=>{const e=document.getElementById('desktopCloseControls'),p=document.getElementById('desktopControlsPanel');if(!e||!p||!p.open)throw new Error('Desktop controls must be open');const r=e.getBoundingClientRect(),q=p.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {target:r.toJSON(),panel:q.toJSON(),viewport:{width:innerWidth,height:innerHeight},scrollTop:p.scrollTop,scrollHeight:p.scrollHeight,clientHeight:p.clientHeight,hit:r.width>0&&r.height>0&&x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&e.contains(document.elementFromPoint(x,y)),wheelX:q.right-24,wheelY:Math.max(24,Math.min(innerHeight-24,q.y+q.height/2)),deltaY:y-(q.y+q.height/2)}})()`);
  doneGeometry.push(state);
  if (!state.hit) {
    assert.ok(state.scrollHeight > state.clientHeight, 'A clipped Desktop Done control must have a real scrollable panel');
    await driver.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: state.wheelX, y: state.wheelY, deltaX: 0, deltaY: state.deltaY });
    await driver.waitFor(`(()=>{const e=document.getElementById('desktopCloseControls'),r=e?.getBoundingClientRect();return !!r&&r.width>0&&r.height>0&&r.x+r.width/2>=0&&r.y+r.height/2>=0&&r.x+r.width/2<innerWidth&&r.y+r.height/2<innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`);
    state.afterWheel = await driver.evaluate(`(()=>{const e=document.getElementById('desktopCloseControls'),p=document.getElementById('desktopControlsPanel'),r=e.getBoundingClientRect();return {scrollTop:p.scrollTop,target:r.toJSON(),hit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})()`);
    assert.notEqual(state.afterWheel.scrollTop, state.scrollTop, 'Native wheel must actually scroll the clipped panel');
    assert.equal(state.afterWheel.hit, true);
  }
  // The unchanged strict native pointer oracle still decides the eventual click.
}
try {
  driver = await launchDesktop({ extraArgs: [`--siren-test-root=${root}`, `--siren-test-project=${first.project.id}`] });
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  if (process.argv.includes('--small-viewport')) await driver.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 640, deviceScaleFactor: 1, mobile: false });
  // Deliberately cover the visible Desktop button: the same pointer sensor must refuse.
  await driver.evaluate(`(()=>{const e=document.getElementById('desktopOptions'),r=e.getBoundingClientRect(),cover=document.createElement('div');cover.id='intentionalOcclusion';Object.assign(cover.style,{position:'fixed',left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px',zIndex:2147483647,background:'red'});document.body.append(cover)})()`);
  await assert.rejects(driver.click('#desktopOptions'), /Occluded/); await driver.evaluate('document.getElementById("intentionalOcclusion").remove()');
  for (const theme of ['dark', 'light']) {
    await driver.click('#themeMenuButton');
    // Theme-menu placement explicitly schedules another animation frame. Keep
    // one real pointer click, after the same hit/animation sensor as Code uses.
    const themeSelector = `[data-theme-value="${theme}"]`;
    await driver.waitFor(`(()=>{const e=document.querySelector(${JSON.stringify(themeSelector)}),m=document.getElementById('themeMenu');if(!e||!m||m.hidden)return false;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return r.width>0&&r.height>0&&x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&e.contains(document.elementFromPoint(x,y))&&m.getAnimations().length===0})()`);
    await driver.click(themeSelector);
    await driver.waitFor(`document.body.dataset.theme === '${theme}'`);
    await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
    await driver.click('#desktopOptions'); await driver.click('#desktopCheckUpdates');
    await driver.waitFor('document.querySelector(".desktop-state").textContent.includes("not configured")');
    assert.equal(await driver.evaluate('document.getElementById("desktopDownloadUpdate").disabled'), true);
    assert.equal(await driver.evaluate('document.getElementById("desktopCancelUpdate").disabled'), true);
    assert.equal((await driver.evaluate('window.sirenDesktop.getPinState()')).unlocked, true);
    assert.equal(await driver.evaluate('!!document.getElementById("desktopPinSettings") && !!document.getElementById("desktopLockPin")'), true, 'Local mode exposes Settings and Lock');
    const panelBackground = await driver.evaluate('getComputedStyle(document.getElementById("desktopControlsPanel")).backgroundColor');
    assert.ok(!panelBackground.startsWith('rgba(') || panelBackground.endsWith(', 1)'), 'Desktop dialog must use an opaque theme background');
    const panelRgb = await driver.evaluate(`(()=>{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.fillStyle=getComputedStyle(document.getElementById('desktopControlsPanel')).backgroundColor;x.fillRect(0,0,1,1);return [...x.getImageData(0,0,1,1).data]})()`);
    assert.equal(panelRgb[3], 255, 'Theme surface must paint opaque pixels');
    assert.ok(theme === 'light' ? panelRgb.slice(0,3).every(v => v > 180) : panelRgb.slice(0,3).every(v => v < 100), 'Dialog background must follow the actual theme, not a constant dark fallback');
    await driver.waitFor('Number(getComputedStyle(document.getElementById("desktopControlsPanel")).opacity) >= 0.99');
    await driver.screenshot(join(evidence, `controls-${theme}.png`));
    await scrollToDesktopDone();
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
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Dark/Warm Light actual pointer controls and Code opacity, negative occlusion oracle, real Find Ctrl+K keyboard update route; production states covered by separate actual HTTP service tests', smallViewport: process.argv.includes('--small-viewport'), doneGeometry, projectId: first.project.id }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));
} catch (error) {
  if (driver) {
    await driver.screenshot(join(evidence, 'failure.png')).catch(() => {});
    const state = await driver.evaluate(`({theme:document.body.dataset.theme,menu:{hidden:document.getElementById('themeMenu')?.hidden,expanded:document.getElementById('themeMenuButton')?.getAttribute('aria-expanded'),rect:document.getElementById('themeMenu')?.getBoundingClientRect().toJSON()},options:[...document.querySelectorAll('[data-theme-value="dark"],[data-theme-value="light"]')].map(e=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {theme:e.dataset.themeValue,rect:r.toJSON(),hit:e.contains(h),cover:h?.id||h?.className||h?.tagName}})})`).catch(() => null);
    await writeFile(join(evidence, 'failure-state.json'), JSON.stringify({ error: String(error.stack || error), state, doneGeometry }, null, 2));
    console.error('SIREN_DESKTOP_UI_DIAGNOSTIC ' + JSON.stringify(state));
  }
  throw error;
} finally { if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
