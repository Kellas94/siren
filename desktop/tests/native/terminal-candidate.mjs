import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Test-owned candidate only. Run native mode through an approved escalated exec.
// No product imports, package edits, install scripts, app Data or Job guard.
const desktop = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const dependencies = join(desktop, 'evidence/terminal-candidate-dependencies');
const pins = { '@xterm/xterm': '6.0.0', '@xterm/addon-fit': '0.11.0', '@xterm/addon-search': '0.16.0', 'node-pty': '1.1.0' };
const evidence = join(desktop, 'evidence', 'terminal-candidate-' + new Date().toISOString().replaceAll(':', '-'));
await mkdir(evidence, { recursive: true });
const hash = data => createHash('sha256').update(data).digest('hex');
async function files(root) {
  const out = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) out.push(...await files(path));
    else if (entry.isFile()) out.push(path);
  }
  return out;
}
const result = {
  scope: 'Isolated exact-artifact/Electron/ConPTY candidate; no SIREN integration or native Job ownership qualification',
  admitted: false, productDependenciesChanged: false, installScriptsExecuted: false,
  evidence, sourceSha256: hash(await readFile(fileURLToPath(import.meta.url))),
  packages: [], artifacts: [], phases: [], blockers: ['Native Job guard not implemented or qualified'],
};
const lock = JSON.parse(await readFile(join(dependencies, 'package-lock.json'), 'utf8'));
result.lockSha256 = hash(await readFile(join(dependencies, 'package-lock.json')));
for (const [key, entry] of Object.entries(lock.packages)) {
  if (!key) continue;
  const root = join(dependencies, key);
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  if (pins[manifest.name]) assert.equal(manifest.version, pins[manifest.name]);
  const row = { name: manifest.name, version: manifest.version, declaredLicense: manifest.license, integrity: entry.integrity, resolved: entry.resolved, licenses: [] };
  for (const path of await files(root)) {
    const rel = relative(dependencies, path).replaceAll('\\', '/');
    const isLicense = /(?:^|\/)(?:LICENSE[^/]*|NOTICE[^/]*|COPYING[^/]*)$/i.test(rel);
    const isArtifact = /\.(?:node|dll|exe)$/i.test(rel) || (manifest.name.startsWith('@xterm/')&&/\/(?:lib|css)\/[^/]+\.(?:js|mjs|css)$/.test(rel)) || /(?:conpty_console_list_agent|windowsConoutConnection|worker\/conoutSocketWorker|shared\/conout|scripts\/(?:prebuild|post-install)|lib\/(?:utils|windowsPtyAgent|windowsTerminal))\.js$/.test(rel);
    if (!isLicense && !isArtifact) continue;
    const bytes = await readFile(path); const artifact = { path: rel, bytes: bytes.length, sha256: hash(bytes), kind: isLicense ? 'license' : 'runtime-or-install-helper' };
    if (/\.(?:node|dll|exe)$/i.test(rel) && bytes.toString('ascii', 0, 2) === 'MZ') {
      const pe = bytes.readUInt32LE(60); artifact.peMachine = '0x' + bytes.readUInt16LE(pe + 4).toString(16);
    }
    result.artifacts.push(artifact);
    if (isLicense) row.licenses.push(artifact);
  }
  result.packages.push(row);
}
result.compilerInspection = {
  source: 'Read-only shell discovery before this run',
  node: 'C:/Program Files/nodejs/node.exe', python: 'C:/Program Files/Python312/python.exe',
  clOnPath: false, msbuildOnPath: false, electronRebuildInstalled: false,
  caveat: 'No claim that every non-PATH compiler installation has been excluded; no rebuild or system-tool installation attempted',
};
const save = () => writeFile(join(evidence, 'inventory.json'), JSON.stringify(result, null, 2));
await save();
if (!process.argv.includes('--native')) {
  console.log(JSON.stringify({ evidence, packages: result.packages.map(p => [p.name, p.version, p.declaredLicense, p.licenses.length]), artifacts: result.artifacts.length, admitted: false }));
  process.exit(0);
}

const executable = join(desktop, 'node_modules/electron/dist/electron.exe');
result.electronExecutable = { path: executable, sha256: hash(await readFile(executable)) };
const mainRoot = join(evidence, 'native-entry');
await mkdir(mainRoot, { recursive: true });
await mkdir(join(evidence, 'electron-profile'), { recursive: true });
const cwd = join(evidence, 'Synthetic project șir 漢字');
await mkdir(cwd, { recursive: true });
const nativeResult = join(evidence, 'native-result.json');
const hostResult = join(evidence, 'host-result.json');
const xtermRoot = join(dependencies, 'node_modules/@xterm');
const html = '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src file:; style-src file: \'unsafe-inline\'; font-src file:">' +
  `<link rel="stylesheet" href="${pathToFileURL(join(xtermRoot, 'xterm/css/xterm.css')).href}"><div id="terminal" style="width:900px;height:500px"></div>` +
  ['xterm/lib/xterm.js', 'addon-fit/lib/addon-fit.js', 'addon-search/lib/addon-search.js'].map(p => `<script src="${pathToFileURL(join(xtermRoot, p)).href}"></script>`).join('');
await writeFile(join(mainRoot, 'app.html'), html);
await writeFile(join(mainRoot, 'package.json'), JSON.stringify({ type: 'module', main: 'main.mjs' }));
// Bound the fixture child independently, so cleanup failures cannot leave it running forever.
await writeFile(join(evidence, 'fixture-child.mjs'), `import{writeFile}from'node:fs/promises';await writeFile(process.argv[2],JSON.stringify({pid:process.pid,exe:process.execPath,at:Date.now()}));setTimeout(()=>process.exit(0),12000);`);

async function hostProbe(config) {
  const { createRequire } = await import('node:module');
  const { writeFile, readFile } = await import('node:fs/promises');
  const { setTimeout: delay } = await import('node:timers/promises');
  const { release } = await import('node:os');
  const record = { runtime: { versions: process.versions, arch: process.arch, platform: process.platform, osRelease: release(), pid: process.pid }, admitted: false, phases: [], lockGateIsModelOnly: true, ringBudget: 4 * 1024 * 1024, rootExited: false };
  const save = () => writeFile(config.hostResult, JSON.stringify(record, null, 2));
  let term; let ring = Buffer.alloc(0); let dropped = 0; let received = 0; let gateOpen = true; let peakRss = 0; let exited = false;
  const memoryTimer = setInterval(() => { peakRss = Math.max(peakRss, process.memoryUsage().rss); }, 100);
  const contains = value => ring.toString('utf8').includes(value);
  const wait = async (value, timeout = 15000) => { const end = Date.now() + timeout; while (Date.now() < end) { if (contains(value)) return; if (exited) throw Error('PTY exited while awaiting ' + value); await delay(30); } throw Error('Native output deadline: ' + value); };
  const input = data => { if (!gateOpen) return false; term.write(data); return true; };
  process.parentPort.on('message', event => { const message=event.data; if(message?.kind==='terminal-replies'&&Array.isArray(message.replies)){for(const data of message.replies){if(typeof data==='string'&&Buffer.byteLength(data)<=32768)input(data);}} });
  const phase = async (name, fn) => { const row = { name, at: Date.now() }; record.phases.push(row); await save(); try { row.result = await fn(); row.status = 'completed'; } catch (error) { row.status = 'failed'; row.error = String(error.stack || error); throw error; } finally { row.ms = Date.now() - row.at; await save(); } };
  try {
    const require = createRequire(config.packagePath);
    await phase('native-addon-load', async () => { const pty = require('node-pty'); record.resolvedPty = require.resolve('node-pty'); const native = require(config.nativePath); record.nativeExportNames = Object.keys(native); return { loaded: true }; });
    const pty = require('node-pty');
    await phase('powershell-conpty-start', async () => {
      const shellEnv=Object.fromEntries(Object.entries(process.env).filter(([key]) => !['NODE_OPTIONS','NODE_PATH','ELECTRON_RUN_AS_NODE','ELECTRON_NO_ASAR','ELECTRON_EXTRA_LAUNCH_ARGS','PSModulePath'].includes(key)));
      shellEnv.PSModulePath=config.osModules;record.shellEnvironmentPolicy={psModulePath:config.osModules,codexModulesExcluded:true,executionPolicyChanged:false};
      term = pty.spawn(config.shell, ['-NoLogo', '-NoProfile'], { cwd: config.cwd, env: shellEnv, cols: 80, rows: 24, useConpty: true, useConptyDll: false, handleFlowControl: false });
      record.shellPid = term.pid; record.cwd = config.cwd; record.shell = config.shell;
      term.onExit(event => { exited = true; record.rootExited = true; record.exitEvent = event; });
      term.onData(data => {
        const bytes = Buffer.from(data); received += bytes.length;
        ring = Buffer.concat([ring, bytes]);
        if (ring.length > record.ringBudget) { const trim = ring.length - record.ringBudget; dropped += trim; ring = Buffer.from(ring.subarray(trim)); }
        record.peakRingBytes = Math.max(record.peakRingBytes || 0, ring.length);
        if(gateOpen&&bytes.length<=32768)process.parentPort.postMessage({kind:'terminal-data',data});
      });
      await wait('PS ');
      input("[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); [Console]::WriteLine(('SIREN_'+'READY'))\r");
      await wait('SIREN_READY'); return { pid: term.pid, args: ['-NoLogo','-NoProfile'], inboxConpty: true };
    });
    await phase('unicode-roundtrip', async () => {
      input("[Console]::WriteLine(('U_'+[char]0x0219+[char]0x0103+[char]::ConvertFromUtf32(0x1F600)+'漢字_E'))\r");
      await wait('U_șă😀漢字_E'); return { expected: 'U_șă😀漢字_E', outputExact: true };
    });
    await phase('native-resize', async () => {
      term.resize(132, 38); input("[Console]::WriteLine(('SIZE_'+'IS_')+$Host.UI.RawUI.WindowSize.Width+'x'+$Host.UI.RawUI.WindowSize.Height)\r");
      await wait('SIZE_IS_'); const observed = ring.toString('utf8').match(/SIZE_IS_(\d+)x(\d+)/)?.[0];
      if (observed !== 'SIZE_IS_132x38') throw Error('Resize readback differs: ' + observed); return { observed };
    });
    await phase('locked-completion-and-model-input-gate', async () => {
      input("Start-Sleep -Milliseconds 1500; [Console]::WriteLine(('LOCK_'+'DONE'))\r"); gateOpen = false;
      const rejected = input("[Console]::WriteLine('FORBIDDEN_INPUT')\r") === false;
      await wait('LOCK_DONE'); if (!rejected || contains('FORBIDDEN_INPUT')) throw Error('Model input gate failed');
      return { completedWhileLocked: true, newInputRefused: true, productLockQualified: false };
    });
    await phase('interactive-prompt-through-model-lock', async () => {
      gateOpen = true; input("[Console]::Write(('PROMPT_'+'WAIT')); $answer=Read-Host; [Console]::WriteLine(('PROMPT_'+'ANSWER_')+$answer)\r");
      await wait('PROMPT_WAIT'); gateOpen = false; const rejected = !input('locked-fixture\r'); await delay(500);
      if (contains('PROMPT_ANSWER_locked-fixture')) throw Error('Locked prompt was answered');
      gateOpen = true; input('unlocked-fixture\r'); await wait('PROMPT_ANSWER_unlocked-fixture');
      return { inputWaitedUntilModelUnlock: rejected, productPinOrLockQualified: false };
    });
    await phase('bounded-pause-resume', async () => {
      input("1..256 | ForEach-Object { [Console]::WriteLine(('PAUSE_'+('x'*1024))) }; [Console]::WriteLine(('PAUSE_'+'DONE'))\r");
      term.pause(); await delay(100); term.resume(); await wait('PAUSE_DONE'); return { pausedMs: 100, explicitProbeOnly: true, lockDoesNotPause: true };
    });
    await phase('60-second-flood-drains-with-model-view-locked', async () => {
      const before = received;
      input("$timer=[Diagnostics.Stopwatch]::StartNew(); while($timer.ElapsedMilliseconds -lt 60000) { 1..64 | ForEach-Object { [Console]::WriteLine(('F_'+('x'*1022))) }; Start-Sleep -Milliseconds 100 }; [Console]::WriteLine(('FLOOD_'+'DONE'))\r");
      gateOpen = false; await wait('FLOOD_DONE', 80000);
      return { elapsedMinimumMs: 60000, utf8Received: received - before, retainedBytes: ring.length, droppedBytes: dropped, ptyPausedForViewLock: false, gateModelOnly: true };
    });
    await phase('owned-child-stop-observation', async () => {
      gateOpen = true;
      const quote = s => "'" + s.replaceAll("'", "''") + "'";
      const args = ['"' + config.fixturePath + '"', '"' + config.childLedger + '"'].map(quote).join(',');
      input(`$child=Start-Process -FilePath ${quote(config.node)} -ArgumentList @(${args}) -PassThru -WindowStyle Hidden; [Console]::WriteLine(('CHILD_'+'PID_')+$child.Id)\r`);
      await wait('CHILD_PID_'); const ledgerEnd=Date.now()+5000; while(!record.child&&Date.now()<ledgerEnd){try{record.child=JSON.parse(await readFile(config.childLedger,'utf8'));}catch{await delay(50);}} if(!record.child)throw Error('Owned child ledger deadline');
      gateOpen = false; term.kill(); const until = Date.now() + 10000; while (!exited && Date.now() < until) await delay(50);
      if (!exited) throw Error('PTY exit not observed after stop');
      let alive = true; try { process.kill(record.child.pid, 0); } catch { alive = false; }
      record.childAliveAfterPtyExit = alive;
      if (alive) { const deadline = Date.now() + 15000; while (alive && Date.now() < deadline) { await delay(100); try { process.kill(record.child.pid, 0); } catch { alive = false; } } }
      record.childEventuallyGone = !alive;
      return { rootExitObserved: true, childAliveAtStop: record.childAliveAfterPtyExit, childGoneAfterFiniteFixtureDeadline: !alive, nativeJobGuardImplemented: false };
    });
    record.completed = true;
  } catch (error) { record.error = String(error.stack || error); record.completed = false; }
  finally {
    clearInterval(memoryTimer); gateOpen = false;
    if (term && !exited) { try { term.kill(); } catch (error) { record.stopError = String(error); } const end = Date.now() + 10000; while (!exited && Date.now() < end) await delay(50); }
    record.receivedUtf8Bytes = received; record.retainedBytes = ring.length; record.droppedUtf8Bytes = dropped; record.peakHostRssBytes = peakRss;
    record.outputTail = ring.subarray(Math.max(0,ring.length-8192)).toString('utf8');
    record.cleanup = { rootExitObserved: exited, allDescendantOwnershipQualified: false, nativeJobGuardImplemented: false };
    await save(); process.parentPort.postMessage({ kind: 'done', record });
  }
}

await writeFile(join(mainRoot, 'host.mjs'), `(${hostProbe.toString()})(${JSON.stringify({ packagePath: join(dependencies,'package.json'), nativePath: join(dependencies,'node_modules/node-pty/prebuilds/win32-x64/conpty.node'), shell: join(process.env.SystemRoot || 'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'), osModules:join(process.env.SystemRoot || 'C:/Windows','System32/WindowsPowerShell/v1.0/Modules'), cwd, hostResult, node: process.execPath, fixturePath: join(evidence,'fixture-child.mjs'), childLedger: join(evidence,'fixture-child.json') })}).catch(error=>{process.parentPort.postMessage({kind:'fatal',error:String(error.stack||error)});});`);

async function mainProbe(config) {
  const { app, utilityProcess, BrowserWindow } = await import('electron');
  const { writeFile } = await import('node:fs/promises');
  const { release } = await import('node:os');
  const result = { runtime: { versions: process.versions, arch: process.arch, osRelease: release(), pid: process.pid }, admitted: false, metrics: [], xterm: null };
  let host; let window; let timer; let done = false;
  const finish = async error => { if (done) return; done = true; clearInterval(timer); if (error) result.error = String(error.stack || error); if (host?.pid) { result.utilityExitRequested = host.kill(); } if (window && !window.isDestroyed()) window.destroy(); await writeFile(config.result, JSON.stringify(result,null,2)); app.exit(error ? 1 : 0); };
  app.whenReady().then(async () => {
    try {
      app.setPath('userData', config.userData);
      window = new BrowserWindow({ show: false, width: 1000, height: 650, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
      window.webContents.setWindowOpenHandler(() => ({action:'deny'}));
      await window.loadFile(config.html);
      result.xterm = await window.webContents.executeJavaScript(`(async()=>{const term=new Terminal({scrollback:10000,cols:80,rows:24});term.open(document.getElementById('terminal'));const fit=new FitAddon.FitAddon();term.loadAddon(fit);fit.fit();const search=new SearchAddon.SearchAddon();term.loadAddon(search);await new Promise(resolve=>term.write('\\x1b[31mANSI\\x1b[0m șir 😀 漢字\\r\\nneedle sentinel',resolve));const found=search.findNext('needle');const lines=[term.buffer.active.getLine(0)?.translateToString(true),term.buffer.active.getLine(1)?.translateToString(true)];const response={cols:term.cols,rows:term.rows,found,selection:term.getSelection(),lines,isolatedHiddenBrowserOnly:true};term.dispose();return response;})()`);
      await window.webContents.executeJavaScript(`window.probeReplies=[];window.probeTerminal=new Terminal({scrollback:10000,cols:80,rows:24});window.probeTerminal.open(document.getElementById('terminal'));window.probeTerminal.onData(data=>window.probeReplies.push(data));true;`);
      timer = setInterval(() => { if (result.metrics.length < 200) result.metrics.push({ at: Date.now(), processes: app.getAppMetrics().map(p=>({pid:p.pid,type:p.type,memory:p.memory})) }); }, 500);
      host = utilityProcess.fork(config.host, [], { serviceName: 'SIREN isolated Terminal candidate', stdio: 'pipe', env: { ...process.env } });
      result.hostPid = host.pid ?? null;
      let logs = ''; host.stdout?.on('data',d=>{ logs=(logs+d).slice(-16000); });host.stderr?.on('data',d=>{ logs=(logs+d).slice(-16000); });
      host.on('spawn',()=>{result.hostPid=host.pid;});
      let pendingOutputBytes=0;let outputWork=Promise.resolve();result.protocolReplyCount=0;
      host.on('message',message=>{
        if(message.kind==='done'){result.host=message.record;result.hostLogs=logs;void finish();}
        else if(message.kind==='fatal')void finish(Error(message.error));
        else if(message.kind==='terminal-data'){
          const size=Buffer.byteLength(message.data);if(pendingOutputBytes+size>262144){result.prototypeForwardingDroppedBytes=(result.prototypeForwardingDroppedBytes||0)+size;return;}
          pendingOutputBytes+=size;
          outputWork=outputWork.then(async()=>{try{if(!done){const replies=await window.webContents.executeJavaScript(`new Promise(resolve=>window.probeTerminal.write(${JSON.stringify(message.data)},()=>resolve(window.probeReplies.splice(0))))`);result.protocolReplyCount+=replies.length;host.postMessage({kind:'terminal-replies',replies});}}finally{pendingOutputBytes-=size;}}).catch(error=>{result.prototypeOutputError=String(error);});
        }
      });
      host.on('exit',code=>{result.hostExitCode=code;if(!done)void finish(Error('Utility host exited before evidence completion: '+code));});
      setTimeout(()=>void finish(Error('Native candidate deadline 180 seconds')),180000).unref();
    } catch(error) { await finish(error); }
  });
}
await writeFile(join(mainRoot, 'main.mjs'), `(${mainProbe.toString()})(${JSON.stringify({ result:nativeResult,userData:join(evidence,'electron-profile'),host:join(mainRoot,'host.mjs'),html:join(mainRoot,'app.html') })});`);
await save();
const child = spawn(executable, [mainRoot], { windowsHide: true, stdio: ['ignore','pipe','pipe'], env: Object.fromEntries(Object.entries(process.env).filter(([key])=>key!=='ELECTRON_RUN_AS_NODE')) });
result.nativeMainPid = child.pid;
let logs = ''; child.stdout.on('data', d => {logs=(logs+d).slice(-32000);}); child.stderr.on('data', d => {logs=(logs+d).slice(-32000);});
const exitCode = await new Promise((done,reject)=>{
  const watchdog=setTimeout(()=>{result.nativeDeadlineExceeded=true;child.kill();},200000);
  child.once('error',error=>{clearTimeout(watchdog);reject(error);});child.once('exit',code=>{clearTimeout(watchdog);done(code);});
});
result.nativeExitCode = exitCode;result.nativeLogs=logs;
try { result.native = JSON.parse(await readFile(nativeResult,'utf8')); } catch(error) {result.nativeEvidenceError=String(error);}
await save();
console.log(JSON.stringify({evidence,exitCode,admitted:false,native:result.native?{runtime:result.native.runtime,xterm:result.native.xterm,host:result.native.host?{phases:result.native.host.phases,cleanup:result.native.host.cleanup,receivedUtf8Bytes:result.native.host.receivedUtf8Bytes,retainedBytes:result.native.host.retainedBytes,droppedUtf8Bytes:result.native.host.droppedUtf8Bytes,peakHostRssBytes:result.native.host.peakHostRssBytes,error:result.native.host.error}:null,error:result.native.error}:null}));
