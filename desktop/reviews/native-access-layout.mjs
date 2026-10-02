import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { launchDesktop } from '../tests/native/drive.mjs';

// Independent native observation using synthetic data and a synthetic PIN only.
const evidence = resolve('evidence', `independent-access-layout-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'data-'));
const result = { completed: false, build: JSON.parse(await readFile('generated/build.json', 'utf8')), views: [] };
let driver;
try {
  driver = await launchDesktop({ extraArgs: [`--siren-test-root=${root}`] });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent==="v1.131.0"');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  if (await driver.evaluate('!!document.querySelector(".tour-card")')) {
    await driver.waitFor('Number(getComputedStyle(document.querySelector(".tour-card")).opacity)>.99');
    await driver.click('.tour-card .tour-actions .ghost');
  }
  await driver.click('#desktopOptions'); await driver.click('#desktopAccountSignIn');
  await driver.waitFor('Number(getComputedStyle(document.querySelector(".desktop-access-centre")).opacity)>.99');
  result.settledOpacity = await driver.evaluate('getComputedStyle(document.querySelector(".desktop-access-centre")).opacity');
  result.tabOrder = [];
  for (let index = 0; index < 8; index++) {
    await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await driver.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    result.tabOrder.push(await driver.evaluate('({id:document.activeElement?.id,inDialog:!!document.activeElement?.closest("#desktopAccessScreen")})'));
  }
  assert.equal(result.tabOrder.every(s => s.inDialog), true);
  await driver.screenshot(join(evidence, 'settled-default.png'));
  for (const size of [{ width: 960, height: 600 }, { width: 640, height: 360 }, { width: 480, height: 300 }, { width: 320, height: 240 }]) {
    await driver.send('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 1, mobile: false });
    await driver.evaluate('document.getElementById("desktopAccessScreen").scrollTop=0');
    const view = await driver.evaluate(`(()=>{const d=document.getElementById('desktopAccessScreen');return {w:innerWidth,h:innerHeight,scrollWidth:d.scrollWidth,clientWidth:d.clientWidth,scrollHeight:d.scrollHeight,clientHeight:d.clientHeight,note:document.querySelector('.desktop-access-note').getBoundingClientRect().toJSON(),controls:[...d.querySelectorAll('input,button')].map(e=>{const r=e.getBoundingClientRect();const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id,rect:r.toJSON(),covered:r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight&&!e.contains(h),cover:h?.className||h?.id||h?.tagName};})};})()`);
    result.views.push(view);
    await driver.screenshot(join(evidence, `layout-${size.width}-${size.height}.png`));
    await driver.evaluate('document.getElementById("desktopAccessBack").scrollIntoView({block:"center"})');
    await driver.click('#desktopAccessBack');
    assert.equal(await driver.evaluate('document.activeElement?.id'), 'desktopOptions');
    await driver.send('Emulation.clearDeviceMetricsOverride');
    await driver.click('#desktopOptions'); await driver.click('#desktopAccountSignIn');
    await driver.waitFor('Number(getComputedStyle(document.querySelector(".desktop-access-centre")).opacity)>.99');
  }
  result.completed = true;
  console.log(JSON.stringify({ completed: true, evidence, settledOpacity: result.settledOpacity, tabOrder: result.tabOrder, views: result.views.map(v => ({ w: v.w, h: v.h, scrollHeight: v.scrollHeight, clientHeight: v.clientHeight, horizontalOverflow: v.scrollWidth>v.clientWidth, covered: v.controls.filter(c => c.covered).map(c => ({id:c.id,cover:c.cover})) })) }));
} catch (error) {
  result.error = String(error.stack || error); if (driver) await driver.screenshot(join(evidence, 'failure.png')).catch(() => {}); throw error;
} finally {
  await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
  if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); }
}
