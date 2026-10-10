import assert from 'node:assert/strict';
import test from 'node:test';
import {localNativeCasePassed,localNativeBatchPassed} from './native/terminal-local-case-verdict.mjs';
const modes=['zero','eight','listeners','accepts','captured','gc','session-async','host-loss','negative-no-stop','negative-js-hang'];
const fixture=mode=>({mode,exit:mode.startsWith('negative-')?1:0,result:{
 scope:'LOCAL_WINDOWS_NODE_ROSTER_QUALIFICATION',nativeExecutionAdmitted:false,cleanupVerified:true,
 nativeBefore:{mode,sessionCount:mode==='zero'?0:8,peerCount:['listeners','accepts','captured','gc','session-async'].includes(mode)?8:0},before:[{pid:20}],
 ...(mode.startsWith('negative-')?{status:'FAILED',cleanupEntryActive:3,error:mode==='negative-no-stop'?'NATIVE_LEFT_LIVE_DESCENDANT':'EXTERNAL_WATCHDOG_DEADLINE:after.json',
 ...(mode==='negative-no-stop'?{nativeAfter:{status:'DELIBERATELY_FALSE_SUCCESS_NEGATIVE_CONTROL'},afterBeforeSafetyCleanup:[{pid:20,alive:true}]}:{watchdogWorkerAlive:true,watchdogElapsedMs:20001,watchdogProtocol:'after.json'})}:
 {status:'LOCAL_NATIVE_CASE_PASSED',nativeGroupDeadBeforeSafetyCleanup:true,canaryAliveBeforeSafetyCleanup:true,finalActiveBeforeSafetyCleanup:0,nativeAfter:{status:'NATIVE_OPERATION_COMPLETED',mode,checked:{ok:true},nativeExecutionAdmitted:false}})
}});
for(const mode of modes)test('bounded completed evidence accepted: '+mode,()=>assert.equal(localNativeCasePassed(fixture(mode)),true));
test('setup watchdog failure cannot pass JS-hang negative control',()=>{
 const f=fixture('negative-js-hang');f.result.error='EXTERNAL_WATCHDOG_DEADLINE:before.json';assert.equal(localNativeCasePassed(f),false);
});
test('after watchdog without observed setup cannot pass',()=>{
 const f=fixture('negative-js-hang');delete f.result.nativeBefore;assert.equal(localNativeCasePassed(f),false);
});
test('worker exit cannot impersonate external JS-hang watchdog',()=>{
 const f=fixture('negative-js-hang');f.result.watchdogWorkerAlive=false;assert.equal(localNativeCasePassed(f),false);
});
test('early or unbounded timeout cannot impersonate actual watchdog deadline',()=>{
 for(const elapsed of [undefined,0,19999,25000]){const f=fixture('negative-js-hang');f.result.watchdogElapsedMs=elapsed;assert.equal(localNativeCasePassed(f),false);}
});
test('fake success without live-process observation cannot pass negative control',()=>{
 const f=fixture('negative-no-stop');delete f.result.afterBeforeSafetyCleanup;assert.equal(localNativeCasePassed(f),false);
});
test('startup failure cannot count as either negative control',()=>{
 for(const mode of modes.slice(-2))assert.equal(localNativeCasePassed({mode,exit:'UNKNOWN',result:null}),false);
});
test('cleanup uncertainty, wrong case, missing checked receipt and promoted admission refuse',()=>{
 for(const change of [f=>{f.result.cleanupVerified=false;},f=>{f.result.nativeBefore.mode='eight';},f=>{delete f.result.nativeAfter.checked;},f=>{f.result.nativeExecutionAdmitted=true;},f=>{f.exit=1;},f=>{f.result.before=[];}]){
  const f=fixture('zero');change(f);assert.equal(localNativeCasePassed(f),false);
 }
});
const batch=()=>({scope:'LOCAL_WINDOWS_NODE_ROSTER_QUALIFICATION',status:'BOUNDED_LOCAL_NATIVE_CASES_PASSED',nativeExecutionAdmitted:false,cases:modes.map(mode=>({mode,passed:true,negative:mode.startsWith('negative-'),exit:mode.startsWith('negative-')?1:0}))});
test('complete ordered ten-case batch accepted',()=>assert.equal(localNativeBatchPassed(batch()),true));
test('empty, truncated, duplicated or reordered batch refuses',()=>{
 for(const change of [b=>{b.cases=[];},b=>b.cases.pop(),b=>{b.cases[9]=b.cases[8];},b=>b.cases.reverse(),b=>{b.cases[0].passed=false;},b=>{b.nativeExecutionAdmitted=true;},b=>{b.cases[9].exit=0;}]){
  const b=batch();change(b);assert.equal(localNativeBatchPassed(b),false);
 }
});
test('malformed data refuses without throwing',()=>{
 for(const value of [null,undefined,{},[],true,'PASS']){assert.equal(localNativeCasePassed(value),false);assert.equal(localNativeBatchPassed(value),false);}
});
