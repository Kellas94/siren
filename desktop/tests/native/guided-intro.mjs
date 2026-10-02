import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ProjectStore } from '../../src/projects/store.mjs';
import { launchDesktop } from './drive.mjs';

// Own synthetic projects only. Observation does not change the renderer or intro.
const evidence = resolve('evidence', `guided-intro-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const build = JSON.parse(await readFile('generated/build.json', 'utf8'));
const result = { completed: false, build, guided: {}, replay: {}, firstPaint: {}, scope: 'Actual editable development renderer, synthetic project, native pointer/keyboard; no login implementation or packaged activation claim' };
let driver;
const save = () => writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
const visible = id => `(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)return false;const r=e.getBoundingClientRect();return !e.hidden&&r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'&&Number(getComputedStyle(e).opacity)>0.1;})()`;
const stopTour = async () => {
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<0.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  if (await driver.evaluate('!!document.querySelector(".tour-card")')) {
    await driver.waitFor('Number(getComputedStyle(document.querySelector(".tour-card")).opacity)>.99');
    await driver.click('.tour-card .tour-actions .ghost');
  }
};
const recordFailure = async error => {
  result.error = String(error.stack || error);
  if (driver) {
    await driver.screenshot(join(evidence, 'failure.png')).catch(() => {});
    result.failureState = await driver.evaluate(`({bootstrap:{mode:window.sirenDesktopBootstrap?.mode,readonly:window.sirenDesktopBootstrap?.readonly},source:document.getElementById('source')?.value,structure:[...document.querySelectorAll('#structureEditor,#structureRows,#codeEditor')].map(e=>({id:e.id,hidden:e.hidden,display:getComputedStyle(e).display,rect:e.getBoundingClientRect().toJSON(),html:e.innerHTML.slice(0,6000)})),intro:document.getElementById('sirenIntroOverlay')?.outerHTML.slice(0,1500),frames:window.__sirenPaintEvidence})`).catch(() => null);
  }
  await save();
};
try {
  const root = await mkdtemp(join(evidence, 'guided-data-'));
  const projects = new ProjectStore(root);
  const source = 'flowchart TD\n A[Start]-->B[Next step]';
  const project = await projects.createProject({ label: 'Guided exact screenshot source', json: JSON.stringify({ source, tourDone: true }) });
  driver = await launchDesktop({ extraArgs: [`--siren-test-root=${root}`, `--siren-test-project=${project.project.id}`] });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  await stopTour();
  assert.equal(await driver.evaluate('window.sirenDesktopBootstrap.readonly'), false);
  await driver.click('#codeModeButton'); await driver.click('#structureModeButton');
  result.guided.source = await driver.evaluate('document.getElementById("source").value');
  result.guided.rows = await driver.evaluate(`[...document.querySelectorAll('#structureRows .struct-code')].map(e=>({text:e.textContent,line:e.dataset.line,rect:e.getBoundingClientRect().toJSON(),chips:[...e.querySelectorAll('.struct-token')].map(c=>({kind:c.dataset.kind,text:c.textContent,rect:c.getBoundingClientRect().toJSON()}))}))`);
  result.guided.paneVisible = await driver.evaluate(visible('structureEditor'));
  await driver.screenshot(join(evidence, 'guided-before-edit.png'));
  assert.equal(result.guided.source, source);
  assert.equal(result.guided.paneVisible, true, 'Guided pane must actually be visible');
  assert.equal(result.guided.rows.length, 2, 'Both exact source lines must have Guided rows');
  // Discover by rendered text if the accessible role wording changes, without invoking app functions.
  const selector = await driver.evaluate(`(()=>{const e=[...document.querySelectorAll('#structureRows [data-kind="label"][role="button"]')].find(e=>e.textContent==='Start');return e?'#structureRows [data-kind="label"][aria-label='+JSON.stringify(e.getAttribute('aria-label'))+']':null})()`);
  assert.ok(selector, 'Start must be a clickable semantic chip');
  await driver.click(selector);
  await driver.waitFor('!!document.querySelector("#structureRows .struct-inline-input")');
  await driver.send('Input.insertText', { text: 'Guided saved label' });
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  // The existing Guided writer safely quotes a changed label and spaces that edited link.
  // Keep an exact saved-source assertion, including the untouched header and second label.
  const edited = 'flowchart TD\n A["Guided saved label"] --> B[Next step]';
  await driver.waitFor(`document.getElementById('source').value===${JSON.stringify(edited)}`);
  await driver.evaluate('window.sirenDesktopRequestClose()');
  const bag = JSON.parse((await projects.readProject(project.project.id)).json);
  const state = JSON.parse(bag.storage['t-industries-siren-v23-state']);
  assert.equal(state.diagrams.find(d => d.id === state.activeDiagramId).source, edited);
  result.guided.editSaved = true;
  await driver.screenshot(join(evidence, 'guided-edited.png'));
  await driver.click('#headerMoreButton'); await driver.click('.struct-menu-item:nth-child(2)');
  await driver.waitFor('document.getElementById("guideDialog").open');
  await driver.click('#replayIntroButton');
  result.replay.reducedMotion = await driver.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches');
  if (!result.replay.reducedMotion) {
    await driver.waitFor('!document.getElementById("sirenIntroOverlay").hidden');
    await driver.screenshot(join(evidence, 'explicit-intro-replay.png'));
    result.replay.animated = true;
  }
  await driver.waitFor('document.getElementById("introOverviewDialog").open');
  result.replay.overview = true;
  await writeFile(join(evidence, 'guided-electron.log'), driver.logs()); await driver.close(); driver = null;

  // Add a passive frame observer before document scripts, using an owned test entry.
  // The unchanged real main creates and loads the actual SIREN BrowserWindow.
  const fixture = join(evidence, 'observer-entry'); await mkdir(fixture);
  const observer = `window.__sirenPaintEvidence={frames:[],mutations:[],started:performance.now()};const sample=()=>{const b=window.__sirenPaintEvidence;const app=document.getElementById('codeModeButton');const intro=document.getElementById('sirenIntroOverlay');const rect=app?.getBoundingClientRect();b.frames.push({at:performance.now(),appVisible:!!rect&&rect.width>0&&rect.height>0&&app.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),introVisible:!!intro&&!intro.hidden&&intro.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),introHidden:intro?.hidden,introClass:intro?.className});if(b.frames.length<180)requestAnimationFrame(sample);};requestAnimationFrame(sample);new MutationObserver(()=>{const b=window.__sirenPaintEvidence;const i=document.getElementById('sirenIntroOverlay');if(i&&b.mutations.length<200)b.mutations.push({at:performance.now(),hidden:i.hidden,className:i.className});}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class']});`;
  await writeFile(join(fixture, 'package.json'), JSON.stringify({ type: 'module', main: 'entry.mjs' }));
  // Initialise an owned blank document so CDP can register before the actual
  // SIREN navigation. Timings below are SIREN-document-relative; the extra blank
  // navigation is driver setup, not a claim about process-launch latency.
  await writeFile(join(fixture, 'entry.mjs'), `import {BrowserWindow} from 'electron';const load=BrowserWindow.prototype.loadURL;BrowserWindow.prototype.loadURL=async function(...args){await load.call(this,'about:blank');const w=this.webContents;w.debugger.attach('1.3');await w.debugger.sendCommand('Page.enable');await w.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument',{source:${JSON.stringify(observer)}});console.log('OWNED_FIRST_PAINT_OBSERVER_READY');return load.apply(this,args);};await import(${JSON.stringify(pathToFileURL(resolve('src/main.mjs')).href)});`);
  const freshRoot = await mkdtemp(join(evidence, 'fresh-data-'));
  const fresh = await new ProjectStore(freshRoot).createProject({ label: 'Fresh intro frame observation', json: JSON.stringify({ kind: 'siren-desktop', schema: 1, storage: {} }) });
  driver = await launchDesktop({ root: fixture, executable: resolve('node_modules/electron/dist/electron.exe'), extraArgs: [`--siren-test-root=${freshRoot}`, `--siren-test-project=${fresh.project.id}`] });
  await driver.waitFor('window.__sirenPaintEvidence?.frames.length >= 170');
  result.firstPaint = await driver.evaluate('window.__sirenPaintEvidence');
  assert.ok(driver.logs().includes('OWNED_FIRST_PAINT_OBSERVER_READY'));
  const frames = result.firstPaint.frames;
  const firstIntro = frames.findIndex(f => f.introVisible);
  assert.ok(firstIntro >= 0, 'Fresh storage must show intro unless reduced motion is enabled');
  result.firstPaint.firstIntroAt = frames[firstIntro].at;
  result.firstPaint.appBeforeIntro = frames.slice(0, firstIntro).filter(f => f.appVisible);
  result.firstPaint.flashConfirmed = result.firstPaint.appBeforeIntro.length > 0;
  await driver.screenshot(join(evidence, 'fresh-after-intro.png'));
  await save();
  assert.equal(result.firstPaint.flashConfirmed, false, 'Workspace must not paint before intro');
  result.completed = true; await save();
  console.log(JSON.stringify({ completed: true, evidence, guided: result.guided.editSaved, replay: result.replay, flashConfirmed: result.firstPaint.flashConfirmed }));
} catch (error) { await recordFailure(error); throw error; }
finally { if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); } }
