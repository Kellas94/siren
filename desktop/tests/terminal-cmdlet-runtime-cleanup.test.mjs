// DATA equality only; native provenance/execution cannot be established here.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from './native/terminal-cmdlet-runtime.mjs';
import {fixture as hostFixture} from './fixtures/terminal-host-receipt-contract.mjs';
function cleanup(){
 const h=hostFixture({held:1});h.expected.held=[{...h.expected.root}];h.receipt.snapshot.held=[{...h.receipt.snapshot.root}];
 const identity=pid=>({pid,image:'C:\\fixed.exe',createdFileTime:String(10000+pid)}),session=[identity(301),identity(302),identity(303)];
 const member=p=>({...p,alive:true,exitCode:259}),dead=p=>({...p,alive:false,exitCode:98});
 const expected=[h.expected.root,...session];
 return{code:98,verified:true,graph:{actualSettled:true,unknown:false,hostNativeJoined:false,sessionCleanupJoined:false},
  beforeSession:{active:3,root:member(session[0]),shell:member(session[2]),held:session.map(member),hostPid:h.expected.root.pid,atomicBeforeResume:true,killOnClose:true,breakaway:false,inheritable:false,stopping:false,monitorFired:false,monitorTerminateSucceeded:false,shellMonitorFired:false,shellMonitorTerminated:false},
  sessionReceipts:[{closed:true,snapshot:{active:0,root:dead(session[0]),shell:dead(session[2]),held:session.map(dead),hostPid:h.expected.root.pid,atomicBeforeResume:true,killOnClose:true,breakaway:false,inheritable:false,stopping:true,monitorFired:false,monitorTerminateSucceeded:false,shellMonitorFired:false,shellMonitorTerminated:false}}],
  hostExpected:h.expected,hostReceipt:h.receipt,checked:{ok:true,actualSettlementEstablished:false},expected,
  external:{status:'EXACT_HELD_PROCESSES_EXITED',before:expected.map(p=>({...p,wait:258,exitCode:259})),after:expected.map(p=>({...p,wait:0,exitCode:98}))},externalExit:{code:0,signal:null},utilityExit:98};
}
test('actual receipt-shaped cleanup DATA permits continuation without treating it as native proof',()=>{
 assert.equal(typeof api.validateDiagnosticCleanup,'function');assert.doesNotThrow(()=>api.validateDiagnosticCleanup(cleanup()));
});
test('every missing cleanup boundary refuses continuation',()=>{
 for(const key of Object.keys(cleanup())){const value=cleanup();delete value[key];assert.throws(()=>api.validateDiagnosticCleanup(value),key);}
});
test('summary flags cannot hide contradictory native or external identity evidence',()=>{
 const changes=[c=>c.graph.actualSettled=false,c=>c.graph.unknown=true,c=>c.graph.hostNativeJoined=true,c=>c.sessionReceipts=[],c=>c.sessionReceipts[0].snapshot.active=1,c=>c.sessionReceipts[0].snapshot.root.alive=true,c=>c.sessionReceipts[0].snapshot.shell.createdFileTime='1',c=>c.sessionReceipts[0].snapshot.held.pop(),c=>c.hostReceipt.peers[0].nativeReaped=false,c=>c.hostExpected.root.pid++,c=>c.expected[1].pid++,c=>c.external.before.pop(),c=>c.external.after[0].wait=258,c=>c.external.after[0].exitCode=77,c=>c.external.after[1].createdFileTime='1',c=>c.externalExit.signal='SIGTERM',c=>c.utilityExit=0,c=>c.verified=false,c=>c.errors=[{message:'unknown'}],c=>c.verificationError='unknown'];
 for(const change of changes){const value=cleanup();change(value);assert.throws(()=>api.validateDiagnosticCleanup(value),String(change));}
});
