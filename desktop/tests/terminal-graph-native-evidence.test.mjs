import assert from 'node:assert/strict';
import test from 'node:test';
import {graphDataRecord,graphDataBatch} from './fixtures/terminal-graph-native-data.mjs';
import {graphNativeCasePassed,graphNativeBatchPassed,graphNativeModes,graphNativeProvenancePassed} from './native/terminal-graph-native-verdict.mjs';
test('causal process contradictions, missing phases and lost cleanup identities refuse',()=>{
 for(const mutate of [r=>r.afterBeforeSafetyCleanup[0].alive=true,r=>r.afterBeforeSafetyCleanup[2].alive=false,r=>delete r.afterBeforeSafetyCleanup,r=>delete r.finalBeforeSafetyCleanup,r=>r.cleanupFinalHeld=[{...r.cleanupFinalHeld[0],pid:99}],r=>r.afterBeforeSafetyCleanup.push(r.afterBeforeSafetyCleanup[0]),r=>r.activeBeforeSafetyCleanup=0,r=>r.before[0].createdFileTime='0']){
  const x=graphDataRecord();assert.equal(graphNativeCasePassed(x),true);mutate(x.result);assert.equal(graphNativeCasePassed(x),false);
 }
});
test('negative root requires exact birth/image and real live held partition',()=>{
 for(const mutate of [r=>r.cleanupEntryHeld[0].createdFileTime='99',r=>r.cleanupEntryHeld[0].image='C:\\Foreign\\node.exe',r=>r.cleanupEntryActive=0,r=>delete r.before,r=>r.cleanupFinalHeld=[]]){
  const x=graphDataRecord('negative-provider-held');assert.equal(graphNativeCasePassed(x),true);mutate(x.result);assert.equal(graphNativeCasePassed(x),false);
 }
});
test('batch needs finite unique source/runtime/binary pin rows',()=>{
 const value=graphDataBatch(graphNativeModes.map(graphDataRecord));assert.equal(graphNativeBatchPassed(value),true);
 for(const mutate of [v=>delete v.inputs,v=>v.inputs=[],v=>v.inputs=[{path:'foreign.node',bytes:1,sha256:'0'.repeat(64)}],v=>v.inputs.push(v.inputs[0]),v=>v.inputs[0].sha256='bad',v=>v.boundaries.sessions=8]){const x=structuredClone(value);mutate(x);assert.equal(graphNativeBatchPassed(x),false);}
});
test('before/config/Lock records and initial manifest must match the actual batch',()=>{
 const batch={...graphDataBatch(graphNativeModes.map(graphDataRecord)),status:'BOUNDED_GRAPH_CASES_PASSED'},initial={...batch,cases:[]};delete initial.status;
 const details=batch.cases.map(c=>({mode:c.mode,before:c.result.nativeBefore,after:c.result.nativeAfter,config:{mode:c.mode,inputs:batch.inputs,addon:'C:/Fixture/siren_terminal_host_roster_candidate.node',addonHash:'a'.repeat(64),nodeHash:'a'.repeat(64),payload:'C:/Fixture/desktop/tests/fixtures/terminal-host-roster-local-payload.mjs'},lock:c.mode==='graph-lock'?{lockPreserved:true,graph:c.result.nativeBefore.graphBefore,stopCalls:0,ownerRetired:false,managerRetired:false,inputClosed:true,root:c.result.nativeBefore.before.root}:null}));
 assert.equal(graphNativeProvenancePassed(batch,initial,details),true);
 for(const mutate of [d=>delete d[0].config,d=>delete d[0].before,d=>d[1].lock.inputClosed=false,d=>delete d[1].lock,d=>d[0].config.addonHash='b'.repeat(64),d=>d[0].config.inputs=[],d=>d[0].before.mainPid=99]){const copy=structuredClone(details);mutate(copy);assert.equal(graphNativeProvenancePassed(batch,initial,copy),false);}
 const foreign=structuredClone(initial);foreign.inputs=[];assert.equal(graphNativeProvenancePassed(batch,foreign,details),false);
});
