import {graphDataRecord,graphDataBatch} from './fixtures/terminal-graph-native-data.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
const {graphNativeCasePassed,graphNativeBatchPassed,graphNativeRecordsPassed,graphNativeModes}=await import('./native/terminal-graph-native-verdict.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});

const positive=graphDataRecord,negative=()=>graphDataRecord('negative-provider-held');

test('a claimed receipt check cannot replace the actual native receipt',()=>{
 const x=positive();delete x.result.nativeAfter.receipt;assert.equal(graphNativeCasePassed(x),false,'checked.ok alone is not receipt evidence');
 const corrupt=positive();corrupt.result.nativeAfter.receipt.snapshot.root.exitCode=-1;assert.equal(graphNativeCasePassed(corrupt),false);
 const foreign=positive();foreign.result.nativeAfter.receipt.shutdownId='foreign';assert.equal(graphNativeCasePassed(foreign),false);
});
test('an internally valid receipt from a different process cannot prove this graph',()=>{
 const x=positive(),a=x.result.nativeAfter;
 a.expected.root.pid=2;a.receipt.snapshot.root.pid=2;a.receipt.snapshot.held[0].pid=2;
 assert.equal(graphNativeCasePassed(x),false);
});
test('batch summary must equal the separately reread actual records',()=>{
 const cases=graphNativeModes.map(mode=>mode==='negative-provider-held'?negative():positive(mode));
 const batch=graphDataBatch(cases);
 assert.equal(graphNativeRecordsPassed(batch,structuredClone(cases)),true);
 const records=structuredClone(cases);records[0].result.nativeAfter.elapsedMs=2;
 assert.equal(graphNativeCasePassed(records[0]),true);assert.equal(graphNativeRecordsPassed(batch,records),false);
});
test('new graph gate is present and accepts only the exact finite case set',()=>{
 assert.equal(typeof graphNativeCasePassed,'function','Missing graph native case gate');assert.deepEqual(graphNativeModes,['graph-empty','graph-lock','graph-held-cwd','graph-host-loss','negative-provider-held']);
 for(const mode of graphNativeModes.slice(0,4))assert.equal(graphNativeCasePassed(positive(mode)),true,mode);
 assert.equal(graphNativeCasePassed(negative()),true);
});
test('each product flag, unknown graph, pending joins and causal process observations refuse',()=>{
 assert.equal(typeof graphNativeCasePassed,'function');
 for(const [key,value] of [['actualSettled',false],['unknown',true],['upperJsSettled',false],['hostJsSettled',false],['pendingObservers',1],['nativeExecutionAdmitted',true],['hostNativeJoined',true],['sessionCleanupJoined',true],['rosterAuthorityEstablished',true]]){const x=positive();x.result.nativeAfter.graph[key]=value;assert.equal(graphNativeCasePassed(x),false,key);}
 for(const key of ['cleanupVerified','nativeGroupDeadBeforeSafetyCleanup','canaryAliveBeforeSafetyCleanup']){const x=positive();x.result[key]=false;assert.equal(graphNativeCasePassed(x),false,key);}
 for(const key of ['duplicateSame','conflictRefused']){const x=positive();x.result.nativeAfter[key]=false;assert.equal(graphNativeCasePassed(x),false,key);}
 for(const key of ['startCalls','stopCalls']){const x=positive();x.result.nativeAfter[key]=2;assert.equal(graphNativeCasePassed(x),false,key);}
 const live=positive();live.result.cleanupFinalHeld[0].alive=true;assert.equal(graphNativeCasePassed(live),false);
 const bad=positive();bad.result.nativeAfter.checked.ok=false;assert.equal(graphNativeCasePassed(bad),false);
});
test('Lock and held-provider requirements cannot be supplied by ordinary empty graph proof',()=>{
 assert.equal(typeof graphNativeCasePassed,'function');const lock=positive('graph-lock');lock.result.nativeAfter.lockPreserved=false;assert.equal(graphNativeCasePassed(lock),false);
 for(const [key,value] of [['elapsedMs',5499],['requested',false],['actualSettled',true],['hostStarted',true],['stopCalls',1],['rootAlive',false]]){const x=positive('graph-held-cwd');x.result.nativeAfter.hold[key]=value;assert.equal(graphNativeCasePassed(x),false,key);}
});
test('held-provider negative requires a real after-phase watchdog and live required root',()=>{
 assert.equal(typeof graphNativeCasePassed,'function');
 for(const [key,value] of [['error','EXTERNAL_WATCHDOG_DEADLINE:before.json:2'],['watchdogElapsedMs',19999],['watchdogWorkerAlive',false],['watchdogProtocol','before.json'],['cleanupVerified',false]]){const x=negative();x.result[key]=value;assert.equal(graphNativeCasePassed(x),false,key);}
 const exited=negative();exited.result.cleanupEntryHeld[0].alive=false;assert.equal(graphNativeCasePassed(exited),false);
 const after=negative();after.result.nativeAfter={status:'GRAPH_NATIVE_OPERATION_COMPLETED'};assert.equal(graphNativeCasePassed(after),false);
 const missing=negative();delete missing.blocked;assert.equal(graphNativeCasePassed(missing),false);
 for(const key of ['actualSettled','hostStarted']){const x=negative();x.blocked[key]=true;assert.equal(graphNativeCasePassed(x),false,key);}
});
test('complete batch requires actual unique ordered five-case gate results',()=>{
 assert.equal(typeof graphNativeBatchPassed,'function');const cases=['graph-empty','graph-lock','graph-held-cwd','graph-host-loss'].map(positive);cases.push(negative());const value=graphDataBatch(cases);assert.equal(graphNativeBatchPassed(value),true);
 for(const bad of [{...value,cases:cases.slice(0,4)},{...value,cases:[cases[0],...cases.slice(0,4)]},{...value,cases:[...cases].reverse()},{...value,nativeExecutionAdmitted:true}])assert.equal(graphNativeBatchPassed(bad),false);
 const forged=structuredClone(value);forged.cases[0].result.nativeAfter.graph.unknown=true;forged.cases[0].passed=true;assert.equal(graphNativeBatchPassed(forged),false);
});
