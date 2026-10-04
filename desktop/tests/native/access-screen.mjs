import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { launchDesktop, unlockDesktop } from './drive.mjs';
import {observeAccessToast} from './toast-observation.mjs';

const evidence = resolve('evidence', `access-screen-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'data-'));
const result = { completed: false, scope: 'Actual local PIN Settings/change flow, native wrong-current refusal, session authority, themes, toast isolation and reduced motion. No online activation or encrypted-project claim.', build: JSON.parse(await readFile('generated/build.json', 'utf8')) };
let driver;
try {
  driver = await launchDesktop({ extraArgs: [`--siren-test-root=${root}`] });
  result.ownedPid = driver.pid; result.phase = 'startup'; result.commands = [];
  // Record only controlled stage/method labels, never PINs, expressions,
  // bootstrap snapshots or project data. Original assertions/deadlines remain.
  let commandSequence = 0;
  for (const method of ['evaluate', 'waitFor', 'click', 'send', 'screenshot']) {
    const execute = driver[method].bind(driver);
    driver[method] = async (...args) => {
      const command = { sequence: ++commandSequence, phase: result.phase, method, started: new Date().toISOString() };
      result.commands.push(command); if (result.commands.length > 32) result.commands.shift();
      await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
      try { const value = await execute(...args); command.finished = new Date().toISOString(); return value; }
      catch (cause) { command.error = cause.message; result.failedCommand ??= { ...command }; throw cause; }
    };
  }
  await driver.waitFor('window.sirenDesktopBootstrap?.mode === "locked"');
  assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'), null);
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  if (await driver.evaluate('!!document.querySelector(".tour-card")')) {
    await driver.waitFor('Number(getComputedStyle(document.querySelector(".tour-card")).opacity)>.99');
    await driver.click('.tour-card .tour-actions .ghost');
  }
  const before = await driver.evaluate('window.sirenDesktop.getAccess()');
  const snapshot = await driver.evaluate('window.sirenDesktopBootstrap.snapshot');
  assert.ok(snapshot?.project?.id);
  const openChange = async () => {
    result.phase = 'open-change-settings';
    await driver.click('#desktopOptions'); await driver.click('#desktopPinSettings');
    await driver.waitFor('document.getElementById("desktopPinSettingsPanel")?.open');
    await driver.waitFor('Number(getComputedStyle(document.getElementById("desktopPinSettingsPanel")).opacity)>.99');
    await driver.click('#desktopPinChange');
    await driver.waitFor('document.getElementById("desktopAccessScreen")?.open && document.getElementById("desktopAccessScreen").dataset.mode==="change"');
    await driver.waitFor('Number(getComputedStyle(document.querySelector(".desktop-access-centre")).opacity)>.99');
  };
  // This owned preview scenario checks animation with motion allowed, independent
  // of the host's accessibility setting. Explicit reduced motion is checked below.
  await driver.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
  assert.equal(await driver.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'), false);
  for (const theme of ['dark', 'light']) {
    result.phase = `${theme}:select-theme`;
    await driver.click('#themeMenuButton');
    await driver.waitFor(`(()=>{const e=document.querySelector('[data-theme-value="${theme}"]'),r=e?.getBoundingClientRect();return !!r&&r.width>0&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()`);
    await driver.click(`[data-theme-value="${theme}"]`);
    await driver.waitFor(`document.body.dataset.theme==='${theme}'`);
    await openChange();
    result.phase = `${theme}:toast-isolation`;
    const observed=await observeAccessToast(driver);
    assert.ok(observed.opacity>.99,'Actual synthetic toast must be opaque during isolation observation');
    assert.equal(observed.topLayer,true,'Isolation must be tested against the actual top-layer toast');
    assert.equal(observed.visible,false,'Workspace notifications must not cover the access preview');
    result[theme+'ToastIsolation']=observed;
    result.phase = `${theme}:layout-and-motion`;
    const state = await driver.evaluate(`(()=>{const e=document.getElementById('desktopAccessScreen'),r=e.getBoundingClientRect();return {rect:r.toJSON(),w:innerWidth,h:innerHeight,fields:[...e.querySelectorAll('input')].map(i=>({id:i.id,type:i.type})),decorative:e.querySelector('.desktop-access-scene')?.getAttribute('aria-hidden'),focused:document.activeElement?.id,background:getComputedStyle(e).backgroundColor,animated:e.getAnimations({subtree:true}).filter(a=>a.playState==='running').length};})()`);
    assert.equal(state.rect.x, 0); assert.equal(state.rect.y, 0);
    assert.equal(state.rect.width, state.w); assert.equal(state.rect.height, state.h);
    assert.deepEqual(state.fields, [{ id: 'desktopAccessPin', type: 'password' }]);
    assert.equal(state.decorative, 'true'); assert.equal(state.focused, 'desktopAccessPin');
    assert.equal(await driver.evaluate('document.querySelectorAll("#desktopPinDigits span").length'), 4);
    assert.equal(await driver.evaluate('document.querySelectorAll(".desktop-pin-key[data-digit]").length'), 10);
    assert.equal(await driver.evaluate('document.getElementById("desktopAccessScreen").dataset.stage'), 'current');
    assert.ok(state.animated > 0); result[theme] = state;
    result.phase = `${theme}:wrong-current-pin`;
    await driver.click('#desktopAccessPin'); await driver.send('Input.insertText', { text: '0000' });
    // Full-length entry auto-submits through the real native verifier.
    await driver.waitFor('/incorrect/i.test(document.getElementById("desktopAccessStatus").textContent) && document.getElementById("desktopAccessPin").value===""');
    assert.equal(await driver.evaluate('document.getElementById("desktopAccessPin").value'), '');
    result.phase = `${theme}:session-authority-after-refusal`;
    assert.equal((await driver.evaluate('window.sirenDesktop.getPinState()')).unlocked, true, 'Wrong current PIN must not revoke the existing editing session');
    assert.equal(await driver.evaluate('document.getElementById("desktopAccessScreen").dataset.stage'), 'current');
    assert.deepEqual(await driver.evaluate('window.sirenDesktopBootstrap.snapshot'), snapshot);
    assert.deepEqual(await driver.evaluate('window.sirenDesktop.getAccess()'), before);
    result.phase = `${theme}:refusal-screenshot`;
    await driver.screenshot(join(evidence, `access-${theme}.png`));
    result.phase = `${theme}:correct-current-pin`;
    for (const digit of '4826') await driver.click(`.desktop-pin-key[data-digit="${digit}"]`);
    await driver.waitFor('document.getElementById("desktopAccessScreen").dataset.stage==="new"');
    assert.equal(await driver.evaluate('document.getElementById("desktopAccessPin").value'), '');
    assert.equal((await driver.evaluate('window.sirenDesktop.getPinState()')).unlocked, true);
    result.phase = `${theme}:cancel-change`;
    // Cancel before selecting a replacement PIN; this fixture retains 4826.
    await driver.click('#desktopAccessBack');
    await driver.waitFor('!document.getElementById("desktopAccessScreen")');
    assert.equal(await driver.evaluate('!!document.getElementById("desktopAccessScreen")'), false);
    assert.equal(await driver.evaluate('document.activeElement?.id'), 'desktopOptions');
  }
  await driver.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await openChange();
  result.phase = 'reduced-motion-and-escape';
  assert.equal(await driver.evaluate('document.getElementById("desktopAccessScreen").getAnimations({subtree:true}).filter(a=>a.playState==="running").length'), 0);
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await driver.waitFor('!document.getElementById("desktopAccessScreen")');
  assert.equal(await driver.evaluate('document.activeElement?.id'), 'desktopOptions');
  assert.deepEqual(await driver.evaluate('window.sirenDesktop.getAccess()'), before);
  assert.equal((await driver.evaluate('window.sirenDesktop.getPinState()')).unlocked, true);
  result.reducedMotion = true; result.phase = 'complete'; result.completed = true;
  console.log(JSON.stringify({ completed: true, evidence }));
} catch (error) {
  result.error = String(error.stack || error); if (driver) await driver.screenshot(join(evidence, 'failure.png')).catch(() => {});
  throw error;
} finally {
  await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
  if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); }
}
