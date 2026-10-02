import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ProjectStore } from '../src/projects/store.mjs';
import { launchDesktop } from '../tests/native/drive.mjs';

// Reviewer-owned observational wrapper; the real main and renderer are unchanged.
const evidence = resolve('evidence', `independent-intro-variants-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const result = { completed: false, build: JSON.parse(await readFile('generated/build.json', 'utf8')), scenarios: [] };
const observer = `window.__independentIntroFrames=[];const sample=()=>{const intro=document.getElementById('sirenIntroOverlay');const app=document.getElementById('codeModeButton');window.__independentIntroFrames.push({at:performance.now(),introExists:!!intro,hidden:intro?.hidden,running:intro?.classList.contains('is-running'),introVisible:!!intro&&intro.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),appVisible:!!app&&app.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})});if(window.__independentIntroFrames.length<180)requestAnimationFrame(sample);};requestAnimationFrame(sample);`;
let driver;
try {
  for (const name of ['reduced-motion-fresh', 'returning-selected', 'damaged-selected-recovery']) {
    const root = await mkdtemp(join(evidence, `${name}-data-`));
    const projects = new ProjectStore(root);
    const source = 'flowchart TD\n A[Returning original]-->B[Preserved]';
    let project; let damagedPath; const damagedBytes = '{REVIEW OWNED DAMAGED ORIGINAL';
    if (name !== 'reduced-motion-fresh') project = await projects.createProject({ label: name, json: JSON.stringify({ source, tourDone: true }) });
    if (name === 'damaged-selected-recovery') {
      const directory = join(root, 'Projects', project.project.id);
      const selection = JSON.parse(await readFile(join(directory, 'current.json'), 'utf8'));
      damagedPath = join(directory, 'revisions', selection.file);
      await writeFile(damagedPath, damagedBytes);
    }
    const fixture = join(evidence, `${name}-entry`); await mkdir(fixture);
    await writeFile(join(fixture, 'package.json'), JSON.stringify({ type: 'module', main: 'entry.mjs' }));
    const media = name === 'reduced-motion-fresh' ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [];
    await writeFile(join(fixture, 'entry.mjs'), `import {BrowserWindow} from 'electron';const load=BrowserWindow.prototype.loadURL;BrowserWindow.prototype.loadURL=async function(...args){await load.call(this,'about:blank');const w=this.webContents;w.debugger.attach('1.3');await w.debugger.sendCommand('Page.enable');await w.debugger.sendCommand('Emulation.setEmulatedMedia',{features:${JSON.stringify(media)}});await w.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:${JSON.stringify(observer)}});return load.apply(this,args);};await import(${JSON.stringify(pathToFileURL(resolve('src/main.mjs')).href)});`);
    driver = await launchDesktop({ root: fixture, executable: resolve('node_modules/electron/dist/electron.exe'), extraArgs: [`--siren-test-root=${root}`, ...(project ? [`--siren-test-project=${project.project.id}`] : [])] });
    if (name === 'damaged-selected-recovery') await driver.waitFor('document.getElementById("desktopRecoveryPanel")?.open');
    else await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
    await driver.waitFor('window.__independentIntroFrames.length>=170');
    const observation = await driver.evaluate(`({name:${JSON.stringify(name)},bootstrap:{mode:window.sirenDesktopBootstrap.mode,readonly:window.sirenDesktopBootstrap.readonly,id:window.sirenDesktopBootstrap.snapshot?.project.id},reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,introHidden:document.getElementById('sirenIntroOverlay').hidden,introDisplay:getComputedStyle(document.getElementById('sirenIntroOverlay')).display,version:document.getElementById('brandVersion').textContent,source:document.getElementById('source').value,recoveryOpen:!!document.getElementById('desktopRecoveryPanel')?.open,frames:window.__independentIntroFrames})`);
    if (name === 'reduced-motion-fresh') {
      assert.equal(observation.reducedMotion, true);
      assert.equal(observation.bootstrap.mode, 'normal'); assert.equal(observation.bootstrap.readonly, false);
      assert.equal(observation.introDisplay, 'none');
      assert.equal(observation.frames.some(f => f.introVisible || f.running), false);
    } else if (name === 'returning-selected') {
      assert.equal(observation.bootstrap.id, project.project.id);
      assert.equal(observation.source, source);
      assert.equal(observation.introHidden, true);
      assert.equal(observation.frames.some(f => f.running), false);
      assert.equal((await readdir(join(root, 'Projects'))).length, 1);
    } else {
      assert.equal(observation.bootstrap.mode, 'recovery'); assert.equal(observation.bootstrap.readonly, true);
      assert.equal(observation.introHidden, true); assert.equal(observation.recoveryOpen, true);
      assert.equal(observation.version, '');
      assert.equal(observation.frames.some(f => f.running), false);
      assert.equal(await readFile(damagedPath, 'utf8'), damagedBytes);
      assert.equal((await readdir(join(root, 'Projects'))).length, 1);
    }
    result.scenarios.push(observation);
    await driver.screenshot(join(evidence, `${name}.png`));
    await writeFile(join(evidence, `${name}-electron.log`), driver.logs());
    await driver.close(); driver = null;
  }
  result.completed = true;
  console.log(JSON.stringify({ completed: true, evidence, cases: result.scenarios.map(s => ({ name: s.name, mode: s.bootstrap.mode, readonly: s.bootstrap.readonly, animatedFrames: s.frames.filter(f => f.running).length })) }));
} catch (error) {
  result.error = String(error.stack || error);
  if (driver) await driver.screenshot(join(evidence, 'failure.png')).catch(() => {});
  throw error;
} finally {
  await writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
  if (driver) { await writeFile(join(evidence, 'failure-electron.log'), driver.logs()); await driver.close(); }
}
