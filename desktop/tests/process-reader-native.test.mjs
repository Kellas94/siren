import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {once} from 'node:events';
import {mkdtemp,mkdir,copyFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {inspectWindowsProcess} from '../src/recovery/processes.mjs';
import {runWindowsIdentity,processReaderPaths} from '../src/recovery/native-process.mjs';
const run=promisify(execFile);

test('fixed native reader matches the original Windows Unicode path and exact100ns creation time', {skip:process.platform!=='win32',timeout:30000},async()=>{
 const evidence=resolve('evidence','process-reader-native-'+new Date().toISOString().replaceAll(':','-'));await mkdir(evidence,{recursive:true});
 const root=await mkdtemp(join(tmpdir(),'siren-fixed-process-')),folder=join(root,'Știință-日本-Україна-😀');await mkdir(folder);
 const executable=join(folder,'node.exe');await copyFile(process.execPath,executable);
 const child=spawn(executable,['-e','console.log(process.execPath);setInterval(()=>{},1000)'],{windowsHide:true,stdio:['ignore','pipe','pipe']}),exited=once(child,'exit');
 const result={scope:'Actual native fixed reader vs original independent Windows cmdlet, exact Unicode and100ns timestamp; no retrospective hosted timing claim',status:'ADVERSE',observations:[]};
 try{
  const [bytes]=await once(child.stdout,'data'),expectedPath=bytes.toString('utf8').trim();
  const script=`[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);$p=Get-Process -Id ${child.pid};@{pid=$p.Id;path=$p.Path;startedAt=$p.StartTime.ToUniversalTime().ToString('o')}|ConvertTo-Json -Compress`;
  const original=JSON.parse((await run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:10000,maxBuffer:16384})).stdout);
  for(let index=0;index<6;index++){
   const before=performance.now(),observed=await inspectWindowsProcess(child.pid);
   result.observations.push({elapsedMs:performance.now()-before,observed});
   assert.deepEqual(observed,original);assert.equal(observed.path,expectedPath);
  }
  result.original=original;
  assert.equal(await inspectWindowsProcess(4),undefined,'Protected System process cannot establish missing identity');
  for(const arg of ['0','-1','1;whoami','01','4294967296','', '1 2'])await assert.rejects(run(processReaderPaths().executable,[arg],{windowsHide:true,timeout:10000,maxBuffer:16384}),error=>error.code===2);
  await assert.rejects(run(processReaderPaths().executable,['1','2'],{windowsHide:true,timeout:10000,maxBuffer:16384}),error=>error.code===2);
  child.kill();await exited;
  assert.equal(await inspectWindowsProcess(child.pid),null,'Actual terminated fixture is missing');
  assert.equal(JSON.parse((await runWindowsIdentity(child.pid,{timeout:10000,maxBuffer:16384})).stdout),null);
  result.status='COMPLETE';
 }catch(error){result.error=String(error.stack||error);throw error;}
 finally{if(child.exitCode===null&&child.signalCode===null){child.kill();await exited;}await writeFile(join(evidence,'result.json'),JSON.stringify(result,null,2));}
});
