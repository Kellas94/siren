import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { mkdtemp, mkdir, copyFile, writeFile, realpath } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { once } from 'node:events';
import { performance } from 'node:perf_hooks';
import { inspectWindowsProcess } from '../src/recovery/processes.mjs';

assert.equal(process.platform, 'win32', 'This diagnostic requires actual Windows');
const evidence = resolve('evidence', `independent-process-identity-${new Date().toISOString().replaceAll(':', '-')}`);
await mkdir(evidence, { recursive: true });
const root = await realpath(await mkdtemp(join(evidence, 'data-')));
const directory = join(root, 'Știință-日本-Україна-😀'); await mkdir(directory);
const executable = join(directory, 'node.exe'); await copyFile(process.execPath, executable);
const child = spawn(executable, ['-e', 'console.log(JSON.stringify({path:process.execPath}));setInterval(()=>{},1000)'], { windowsHide:true, stdio:['ignore','pipe','pipe'] });
const exited = once(child, 'exit');
let stderr = ''; child.stderr.on('data', b => { stderr += b; });
const result = { completed:false, scope:'Measured actual owned Unicode process query and explicitly induced latency; not a diagnosis of CI host state.', production:[], diagnostic:[] };
const alive = () => ({exitCode:child.exitCode,signalCode:child.signalCode});
const query = pid => `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($null -eq $p) { 'null' } elseif (!$p.Path) { '{"unknown":true}' } else { @{pid=$p.Id;path=$p.Path;startedAt=$p.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json -Compress }`;
const diagnose = (script, deadline) => new Promise(resolveQuery => {
  const started = performance.now();
  execFile('powershell.exe', ['-NoProfile','-NonInteractive','-Command',script], {windowsHide:true,timeout:deadline,maxBuffer:16384}, (error,stdout,stderr) => {
    let value, parseError; try { value=JSON.parse(stdout.trim()); } catch(e) { parseError=e.message; }
    resolveQuery({deadline,elapsedMs:performance.now()-started,error:error?{code:error.code,signal:error.signal,killed:error.killed,message:error.message}:null,stdoutBytes:Buffer.byteLength(stdout),stderr:stderr.slice(0,2000),value,parseError,child:alive()});
  });
});
try {
  const [bytes] = await once(child.stdout,'data'); const expected=JSON.parse(bytes.toString('utf8').trim());
  result.child={pid:child.pid,path:expected.path};
  let first;
  for(let i=0;i<3;i++) {
    const began=performance.now(); const identity=await inspectWindowsProcess(child.pid);
    result.production.push({elapsedMs:performance.now()-began,identity,child:alive()});
    assert.equal(identity?.pid,child.pid); assert.equal(identity.path,expected.path); assert.match(identity.startedAt,/^\d{4}-\d{2}-\d{2}T/);
    if(first) assert.deepEqual(identity,first); else first=identity;
  }
  for(let i=0;i<3;i++) {
    const observed=await diagnose(query(child.pid),5000); result.diagnostic.push(observed);
    assert.equal(observed.error,null); assert.deepEqual(observed.value,first);
  }
  const delayed=`Start-Sleep -Milliseconds 5500; ${query(child.pid)}`;
  const short=await diagnose(delayed,5000); result.inducedShort=short;
  assert.equal(short.error?.killed,true); assert.equal(short.value,undefined);
  assert.equal(short.child.exitCode,null); assert.equal(short.child.signalCode,null);
  const longer=await diagnose(delayed,10000); result.inducedLong=longer;
  assert.equal(longer.error,null); assert.deepEqual(longer.value,first);
  result.completed=true;
  console.log(JSON.stringify({completed:true,evidence,productionMs:result.production.map(x=>x.elapsedMs),diagnosticMs:result.diagnostic.map(x=>x.elapsedMs),inducedShort:{elapsedMs:short.elapsedMs,error:short.error,child:short.child},inducedLongMs:longer.elapsedMs}));
} catch(error) {result.error=String(error.stack||error);throw error;}
finally {
  child.kill(); await exited; result.childStderr=stderr;
  await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));
}
