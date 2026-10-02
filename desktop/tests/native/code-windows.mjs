import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ProjectStore } from '../../src/projects/store.mjs';
import { launchDesktop, unlockDesktop } from './drive.mjs';

// Leaving the full-screen library inert after minimising an editor would block
// the diagram workspace even though its window has disappeared.
const evidence = resolve('evidence', `code-windows-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'data-'));
const first = await new ProjectStore(root).createProject({ label: 'Code window controls', json: '{"source":"flowchart TD\\n A[Window controls]-->B[Local draft]"}' });
const python = 'def review_agent(values):\n    return [value * 2 for value in values if value > 0]\n';
let driver;
const controlGeometry = {};
const rect = selector => driver.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);
async function drag(selector, dx, dy, header = false) {
  const r = await rect(selector), x = header ? r.x + 100 : r.x + r.width / 2, y = r.y + r.height / 2;
  await driver.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await driver.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + dx, y: y + dy, button: 'left', buttons: 1 });
  await driver.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x + dx, y: y + dy, button: 'left', clickCount: 1 });
}
try {
  driver = await launchDesktop({ extraArgs: [`--siren-test-root=${root}`, `--siren-test-project=${first.project.id}`] });
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  await driver.click('#codeLibraryButton'); await driver.click('#codeSectionNewButton');
  await driver.click('#cwEditor'); await driver.send('Input.insertText', { text: python });
  await driver.click('#codeWorkspace [data-action="minimise"]');
  assert.equal(await driver.evaluate('document.getElementById("codeWorkspace").hidden'), true);
  assert.equal(await driver.evaluate('document.getElementById("codeLibrarySection").hidden'), true, 'Minimising Code must return to a usable application, not leave the full-screen library blocking it');
  assert.equal(await driver.evaluate('document.querySelector(".app-header").inert || document.querySelector(".workspace").inert'), false);
  await driver.click('#themeMenuButton');
  // The menu schedules frame placement and animates its surface. Wait for an
  // actually hittable option; the unchanged click oracle still rejects covers.
  await driver.waitFor(`(()=>{const e=document.querySelector('[data-theme-value="light"]'),m=e?.closest('[role="menu"]')||document.getElementById('themeMenu');if(!e)return false;const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return r.width>0&&r.height>0&&x>=0&&y>=0&&x<innerWidth&&y<innerHeight&&e.contains(document.elementFromPoint(x,y))&&(!m||m.getAnimations().length===0)})()`);
  await driver.click('[data-theme-value="light"]');
  await driver.click('#codeWorkspaceRestore');
  await driver.waitFor('document.getElementById("codeWorkspace").getAnimations().length === 0');
  assert.equal(await driver.evaluate('document.getElementById("cwEditor").value'), python, 'Restore must retain exact draft bytes');
  const normal = await rect('#codeWorkspace');
  controlGeometry.normal = normal;
  await driver.click('#codeWorkspace [data-action="maximise"]');
  await driver.waitFor(`(()=>{const e=document.getElementById('codeWorkspace'),r=e.getBoundingClientRect();return e.dataset.windowMode==='maximised'&&r.width>${normal.width}&&r.height>${normal.height}})()`);
  const full = await rect('#codeWorkspace');
  controlGeometry.maximised = full;
  assert.ok(full.width > normal.width && full.height > normal.height, 'Maximise must visibly change both dimensions');
  await driver.click('#codeWorkspace [data-action="maximise"]');
  await driver.waitFor(`(()=>{const e=document.getElementById('codeWorkspace'),r=e.getBoundingClientRect();return e.dataset.windowMode==='normal'&&r.x===${normal.x}&&r.y===${normal.y}&&r.width===${normal.width}&&r.height===${normal.height}})()`);
  assert.deepEqual(await rect('#codeWorkspace'), normal, 'Restore must retain original geometry');
  await drag('#codeWorkspace .cw-head', 45, 25, true);
  await driver.waitFor(`(()=>{const r=document.getElementById('codeWorkspace').getBoundingClientRect();return r.x===${normal.x+45}&&r.y===${normal.y+25}})()`);
  const moved = await rect('#codeWorkspace');
  assert.equal(moved.x, normal.x + 45); assert.equal(moved.y, normal.y + 25);
  await drag('#codeWorkspace .cw-resize', -100, -60);
  await driver.waitFor(`(()=>{const r=document.getElementById('codeWorkspace').getBoundingClientRect();return r.width===${normal.width-100}&&r.height===${normal.height-60}})()`);
  const resized = await rect('#codeWorkspace');
  assert.equal(resized.width, normal.width - 100); assert.equal(resized.height, normal.height - 60);
  assert.equal(await driver.evaluate('document.getElementById("cwEditor").value'), python);
  await driver.click('#codeWorkspace .cw-view summary');
  await driver.click('#codeWorkspace [data-window-transparency]');
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Home', code: 'Home', windowsVirtualKeyCode: 36 });
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'ArrowRight', code: 'ArrowRight', windowsVirtualKeyCode: 39 });
  await driver.waitFor('document.getElementById("codeWorkspace").dataset.glass === "true" && Number(document.querySelector("#codeWorkspace [data-window-transparency]").value) > 0');
  assert.ok(Number(await driver.evaluate('document.querySelector("#codeWorkspace [data-window-transparency]").value')) > 0);
  assert.equal(await driver.evaluate('document.getElementById("codeWorkspace").dataset.glass'), 'true');
  await driver.click('#codeWorkspace .cw-view summary');
  await driver.click('#cwEditor');
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'm', code: 'KeyM', modifiers: 3, windowsVirtualKeyCode: 77 });
  await driver.waitFor('document.getElementById("codeWorkspace").hidden');
  await driver.click('#codeWorkspaceRestore');
  await driver.click('#codeWorkspace .cw-more summary'); await driver.click('#codeWorkspace [data-action="new-window"]');
  await driver.waitFor('document.querySelectorAll(".cw-window:not([hidden])").length === 2');
  const second = await driver.evaluate(`'#'+[...document.querySelectorAll('.cw-window')].find(e=>e.id!=='codeWorkspace'&&!e.hidden).id`);
  await driver.click(`${second} [data-action="minimise"]`);
  await driver.click('#codeWorkspace [data-action="minimise"]');
  assert.equal(await driver.evaluate('document.querySelectorAll(".cw-restore:not([hidden])").length'), 2);
  await driver.screenshot(join(evidence, 'minimised-windows.png'));
  await driver.click('#codeWorkspaceRestore');
  assert.equal(await driver.evaluate('document.getElementById("cwEditor").value'), python);
  const hr = await rect('#codeWorkspace .cw-head');
  await driver.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hr.x + 80, y: hr.y + hr.height/2, button: 'right', clickCount: 1 });
  await driver.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hr.x + 80, y: hr.y + hr.height/2, button: 'right', clickCount: 1 });
  await driver.waitFor('!!document.querySelector("[role=menu]")?.textContent.includes("Minimise")');
  await driver.screenshot(join(evidence, 'code-actions.png'));
  await writeFile(join(evidence, 'result.json'), JSON.stringify({ completed: true, scope: 'Actual pointer/keyboard minimise+restore, main workspace availability, exact Python draft, maximise geometry, drag/resize, transparency, multiple windows and right-click commands' }, null, 2));
  console.log(JSON.stringify({ completed: true, evidence }));
} catch (error) {
  if (driver) {
    await driver.screenshot(join(evidence, 'failure.png')).catch(() => {});
    const failureState = await driver.evaluate(`(()=>{const e=document.querySelector('[data-theme-value="light"]'),m=document.getElementById('themeMenu'),r=e?.getBoundingClientRect(),hit=r&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {libraryHidden:document.getElementById('codeLibrarySection')?.hidden,codeHidden:document.getElementById('codeWorkspace')?.hidden,headerInert:document.querySelector('.app-header')?.inert,workspaceInert:document.querySelector('.workspace')?.inert,viewport:{width:innerWidth,height:innerHeight},menu:{hidden:m?.hidden,scrollTop:m?.scrollTop,animations:m?.getAnimations().length},option:r&&{x:r.x,y:r.y,width:r.width,height:r.height},hit:hit?.outerHTML?.slice(0,500)}})()`).catch(() => null);
    await writeFile(join(evidence, 'failure-state.json'), JSON.stringify({ ...failureState, controlGeometry }));
    console.error(JSON.stringify({ codeWindowFailure: failureState, controlGeometry }));
  }
  throw error;
} finally { if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
