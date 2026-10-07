import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { createHash } from 'node:crypto';
import { ProjectStore } from '../../src/projects/store.mjs';
import { launchDesktop, unlockDesktop } from './drive.mjs';

// One actual input measurement of the previously adverse 80k/200Docs case.
// Profiling is passive and changes neither product logic nor driver deadlines.
const evidence = resolve('evidence', `large-source-profile-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const dataRoot = await mkdtemp(join(evidence, 'data-'));
const entryRoot = join(evidence, 'observer-entry'); await mkdir(entryRoot);
const marker = join(evidence, 'trace-command.json');
const tracePath = join(evidence, 'trace.json');
const traceStatus = join(evidence, 'trace-status.json');
const memoryPath = join(evidence, 'process-metrics.jsonl');
const result = { scope: 'One actual adverse80k-line paste with200Docs; diagnostic measurement, not scalability admission', phases: [], completed: false, sourceHashes: {}, outcomes: {} };
for (const path of ['src/main.mjs', 'src/projects/store.mjs', 'src/ui/storage.js', 'generated/app.html', 'tests/native/drive.mjs', 'tests/native/large-source-profile.mjs']) {
  result.sourceHashes[path] = createHash('sha256').update(await readFile(path)).digest('hex');
}
const save = () => writeFile(join(evidence, 'result.json'), JSON.stringify(result, null, 2));
const waitNativeFile = async (path, predicate, ms = 10000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const value = JSON.parse(await readFile(path, 'utf8')); if (predicate(value)) return value; } catch { /* observer may be writing */ }
    await delay(100);
  }
  throw new Error('Owned native diagnostic deadline: ' + path);
};

// The observer imports unchanged real main/preload/renderer. Main-process trace
// and process samples stay observable even when the renderer stops answering CDP.
await writeFile(join(entryRoot, 'package.json'), JSON.stringify({ type: 'module', main: 'entry.mjs' }));
await writeFile(join(entryRoot, 'entry.mjs'), `
import {app,contentTracing} from 'electron';
import {readFile,writeFile,appendFile} from 'node:fs/promises';
const marker=${JSON.stringify(marker)},status=${JSON.stringify(traceStatus)},output=${JSON.stringify(tracePath)},memory=${JSON.stringify(memoryPath)};
let phase='idle',busy=false,timer;
app.whenReady().then(()=>{ timer=setInterval(async()=>{if(busy)return;busy=true;try{
  await appendFile(memory,JSON.stringify({at:Date.now(),processes:app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,cpu:p.cpu,memory:p.memory}))})+'\\n');
  let command;try{command=JSON.parse(await readFile(marker,'utf8'));}catch{return;}
  if(command.action==='start'&&phase==='idle'){
    phase='starting';await contentTracing.startRecording({recording_mode:'record-until-full',included_categories:['devtools.timeline','v8','blink.user_timing','disabled-by-default-v8.cpu_profiler','electron']});
    phase='recording';await writeFile(status,JSON.stringify({phase,at:Date.now()}));
  }else if(command.action==='stop'&&phase==='recording'){
    phase='stopping';await writeFile(status,JSON.stringify({phase,at:Date.now()}));const file=await contentTracing.stopRecording(output);
    phase='stopped';await writeFile(status,JSON.stringify({phase,file,at:Date.now()}));
  }
}catch(error){await writeFile(status,JSON.stringify({phase:'error',error:String(error.stack||error)}));}finally{busy=false;}},200); });
app.on('will-quit',()=>clearInterval(timer));
await import(${JSON.stringify(pathToFileURL(resolve('src/main.mjs')).href)});
`);

const state = JSON.parse(await readFile('tests/fixtures/recovery-zoom-state.json', 'utf8'));
state.workpapers = Array.from({ length: 200 }, (_, i) => ({ id: `synthetic-doc-${i}`, ref: `QA-${i}`, title: `Synthetic scale document ${i}`, type: 'note', status: 'draft', owner: 'Synthetic fixture', createdAt: '2026-10-02T00:00:00.000Z', updatedAt: '2026-10-02T00:00:00.000Z', links: [], comments: [], revisions: [], blocks: [{ id: `synthetic-block-${i}`, kind: 'knowledge', rows: [{ sourceId: `synthetic-source-${i}`, name: 'Synthetic.py', fileType: 'python', role: 'code', notes: '', content: '# Synthetic Docs payload\n' + 'a'.repeat(19975), sourceOrigin: '', confirmedAt: '' }] }] }));
state.workpaperView.activeId = state.workpapers[0].id;
const json = JSON.stringify({ kind: 'siren-desktop', schema: 1, storage: { 't-industries-siren-v23-state': JSON.stringify(state) } });
const project = await new ProjectStore(dataRoot).createProject({ label: 'Owned synthetic adverse profile', json });
const source = Array(80000).fill('x=1').join('\n');
const expectedHash = createHash('sha256').update(source).digest('hex');
result.fixture = { docs: 200, sourceLines: 80000, sourceUtf16Units: 319999, sourceUtf8Bytes: 319999, sourceSha256: expectedHash, projectId: project.project.id, workspaceBytes: Buffer.byteLength(json) };
let driver;
const phase = async (name, action) => {
  const row = { name, beganAt: new Date().toISOString() }; result.phases.push(row); await save(); const began = performance.now();
  try { const value = await action(); row.status = 'completed'; row.ms = performance.now() - began; return value; }
  catch (error) { row.status = 'failed'; row.ms = performance.now() - began; row.error = String(error.stack || error); throw error; }
  finally { await save(); }
};
try {
  driver = await launchDesktop({ root: entryRoot, executable: resolve('node_modules/electron/dist/electron.exe'), extraArgs: [`--siren-test-root=${dataRoot}`, `--siren-test-project=${project.project.id}`] });
  result.pid = driver.pid;
  await unlockDesktop(driver, { pin: '4826', autoSetup: true });
  await driver.waitFor('document.getElementById("brandVersion")?.textContent === "v1.131.0"');
  await driver.waitFor(`[...document.querySelectorAll('[id$="IntroOverlay"]')].every(e=>getComputedStyle(e).display==='none'||Number(getComputedStyle(e).opacity)<.01)`);
  if (await driver.evaluate('document.getElementById("introOverviewDialog")?.open')) await driver.click('#closeIntroOverview');
  await driver.click('#workpapersButton'); await driver.waitFor('!document.getElementById("wpWorkspace").hidden');
  await driver.click('#closeWpButton'); await driver.waitFor('document.getElementById("wpWorkspace").hidden');
  await driver.click('#codeLibraryButton'); await driver.click('#codeSectionNewButton');
  await driver.click('#cwEditor');
  await driver.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
  await writeFile(marker, JSON.stringify({ action: 'start' }));
  await waitNativeFile(traceStatus, s => s.phase === 'recording');
  await phase('actual-80k-input', () => driver.send('Input.insertText', { text: source }));
  const actual = await phase('exact-text-readback', () => driver.evaluate('document.getElementById("cwEditor").value'));
  assert.equal(createHash('sha256').update(actual).digest('hex'), expectedHash);
  result.outcomes.textExact = true;
  await phase('settled-private-recovery', () => driver.waitFor('document.getElementById("cwStatus").textContent.includes("Private recovery stored")'));
  result.outcomes.status = await driver.evaluate('document.getElementById("cwStatus").textContent');
  result.completed = true;
} catch (error) {
  result.error = String(error.stack || error);
} finally {
  await writeFile(marker, JSON.stringify({ action: 'stop' }));
  try { result.trace = await waitNativeFile(traceStatus, s => s.phase === 'stopped', 10000); result.trace.bytes = (await stat(tracePath)).size; }
  catch (error) { result.trace = { status: 'unavailable', error: error.message }; }
  await save();
  if (driver) { await writeFile(join(evidence, 'electron.log'), driver.logs()); await driver.close(); }
  // No post-timeout CDP screenshot/evaluate retry can turn failure into success.
  console.log(JSON.stringify({ evidence, completed: result.completed, phases: result.phases.map(({name,status,ms,error})=>({name,status,ms,error})), trace: result.trace }));
}
