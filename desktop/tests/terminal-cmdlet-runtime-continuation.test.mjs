// Owner causal regressions for the actual arm loop, no launcher/native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {win32 as path} from 'node:path';
import * as api from './native/terminal-cmdlet-runtime.mjs';
const source=await readFile(new URL('./native/terminal-cmdlet-runtime.mjs',import.meta.url),'utf8');
async function runFirst(worker,overrides={}){
 const start=source.indexOf('  for(const control of controls){'),end=source.indexOf("  await recheckTerminalSessionExecutionResources(inventory);await save('execution-inventory-after.json'",start);
 assert.ok(start>0&&end>start);const calls=[],receipt={arms:[]};
 const scope={assert,...api,controls:['start-sleep','write-output'],out:'C:\\owned',root:'C:\\repo',execution:'C:\\execution',electronExecutable:'C:\\electron.exe',filesystemExecutable:'C:\\filesystem.exe',observerExecutable:'C:\\observer.exe',context:{run:'123',commit:'a'.repeat(40)},receipt,env:{},join:path.join,
  mkdir:async()=>{},writeFile:async()=>{},pin:async p=>({path:p,bytes:0,sha256:'inert'}),
  launchFixedControl:async(_exe,entry)=>{calls.push(entry);return{spawnError:null,closeObserved:true,watchdog:false,overflow:false,exit:0,signal:null};},
  readFile:async p=>{if(p.endsWith('worker-result.json'))return JSON.stringify(worker);throw Error('No fixed fixture after failed worker');},...overrides};
 await runInNewContext('(async()=>{'+source.slice(start,end)+'})()',scope);return{calls,receipt};
}
test('bare cleanupVerified flag cannot launch a second arm after failed native observation',async()=>{
 const observed=await runFirst({scope:'HOSTED_SINGLE_CMDLET_DIAGNOSTIC',status:'FAILED',cleanupVerified:true});
 assert.equal(observed.calls.length,1);assert.equal(observed.receipt.arms[0].nextArmRefused,'PREVIOUS_NATIVE_CLEANUP_UNVERIFIED');
});
test('even separately validated cleanup cannot authorize evidence from another run or arm',async()=>{
 const original={scope:'HOSTED_SINGLE_CMDLET_DIAGNOSTIC',status:'FAILED',run:'123',commit:'a'.repeat(40),control:'start-sleep',cleanupVerified:true,failureCleanup:{code:98}};
 // This control isolates context binding; cleanup DATA validation has separate tests.
 for(const [key,bad] of [['scope','foreign'],['run','999'],['commit','c'.repeat(40)],['control','write-output']]){
  const observed=await runFirst({...original,[key]:bad},{validateDiagnosticCleanup(){}});assert.equal(observed.calls.length,1,key);
 }
});
test('contradictory graph cleanup remains refused even with a true summary flag',async()=>{
 const observed=await runFirst({scope:'HOSTED_SINGLE_CMDLET_DIAGNOSTIC',status:'FAILED',cleanupVerified:true,failureCleanup:{verified:true,graph:{actualSettled:false,unknown:true}}});
 assert.equal(observed.calls.length,1);assert.equal(observed.receipt.arms[0].nextArmRefused,'PREVIOUS_NATIVE_CLEANUP_UNVERIFIED');
});
test('runtime source-pin minimum cannot omit its fixed command and controller dependencies',()=>{
 const start=source.indexOf('  for(const required of ['),end=source.indexOf('\n',start);assert.ok(start>0);
 const seen=new Set(['desktop/tests/native/terminal-cmdlet-runtime.mjs','desktop/tests/native/terminal-cmdlet-runtime-worker.mjs','desktop/tests/native/terminal-cmdlet-fixture.mjs','desktop/tests/fixtures/terminal-session-process-observer.cs','.github/workflows/terminal-cmdlet-runtime.yml']);
 assert.throws(()=>runInNewContext(source.slice(start,end),{assert,seen}));
});
