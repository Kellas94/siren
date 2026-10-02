import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { launchDesktop } from '../tests/native/drive.mjs';

// Independent observation of conditional toast suppression, synthetic data only.
const evidence = resolve('evidence', `independent-access-toast-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const root = await mkdtemp(join(evidence, 'data-'));
const result = { completed: false, build: JSON.parse(await readFile('generated/build.json', 'utf8')) };
let driver;
const observe = `(()=>{const t=document.getElementById('toast');return {popover:t.matches(':popover-open'),visibility:getComputedStyle(t).visibility,opacity:getComputedStyle(t).opacity,visible:t.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),dialogOpen:!!document.getElementById('desktopAccessScreen')?.open};})()`;
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
  await driver.evaluate(`(()=>{const t=document.getElementById('toast');t.textContent='Synthetic independent workspace notification';t.classList.add('is-visible');t.showPopover();})()`);
  await driver.waitFor('Number(getComputedStyle(document.getElementById("toast")).opacity)>.99');
  result.open = await driver.evaluate(observe);
  assert.equal(result.open.popover, true);
  assert.equal(result.open.dialogOpen, true);
  assert.equal(result.open.visibility, 'hidden');
  assert.equal(result.open.visible, false);
  await driver.screenshot(join(evidence, 'open-toast-hidden.png'));
  await driver.click('#desktopAccessBack');
  await driver.waitFor('!document.getElementById("desktopAccessScreen")');
  result.closed = await driver.evaluate(observe);
  assert.equal(result.closed.popover, true);
  assert.equal(result.closed.visibility, 'visible');
  assert.equal(result.closed.visible, true);
  assert.equal(await driver.evaluate('document.activeElement?.id'), 'desktopOptions');
  await driver.screenshot(join(evidence, 'closed-toast-restored.png'));
  result.completed = true;
  console.log(JSON.stringify({ completed: true, evidence, open: result.open, closed: result.closed }));
} catch (error) {
  result.error = String(error.stack || error);
  if (driver) await driver.screenshot(join(evidence, 'failure.png')).catch(() => {});
  throw error;
} finally {
  await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
  if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); }
}
