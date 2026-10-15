// Synthetic classifier exercises only; none are native execution evidence.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {syntheticNormalObservation} from './native/terminal-normal-contract-fixture.mjs';
const api=await import('./native/terminal-peer-endpoints-contract.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
function fixture(){
 const x=syntheticNormalObservation(),n=x.result.native,main=x.result.observer.main,creator=n.before.root;
 const endpoint=(lane,server)=>({lane,server,connected:true,retiring:false,settled:false,peer:{...(server?creator:main)},mainPid:main.pid,creatorPid:creator.pid,queriedPeerPid:server?creator.pid:main.pid,nativeDirection:server?'client':'server',bothJobsChecked:server,commonJobMember:server?true:null,sessionJobMember:server?true:null,generation:1,heldPeerClosed:false,readPending:true,writePending:false,readReservedBytes:32768,writeReservedBytes:0,readIdleTimeout:false,nativeExecutionAdmitted:false});
 n.nativePeer={control:endpoint('control',true),history:endpoint('history',true),close:{control:true,history:true,listeners:true}};
 n.ready.nativePeer={control:endpoint('control',false),history:endpoint('history',false)};
 return x;
}
test('source-only oracle requires both held peer directions and verified native retirement',()=>{
 assert.equal(typeof api.validateCandidateObservation,'function');const result=api.validateCandidateObservation(fixture());
 assert.equal(result.nativePeer.admitted,false);assert.equal(result.nativePeer.bothDirectionsObserved,true);assert.equal(result.nativePeer.closed,true);
});
test('counterfeit native PID, birth, image, Jobs, generation and closed state cannot classify as supported',()=>{
 assert.equal(typeof api.validateCandidateObservation,'function');
 const mutations=[
  x=>x.result.native.nativePeer.control.queriedPeerPid++,
  x=>x.result.native.nativePeer.control.peer.createdFileTime='1',
  x=>x.result.native.nativePeer.control.peer.image='C:\\fake\\electron.exe',
  x=>x.result.native.nativePeer.control.peer.alive=false,
  x=>x.result.native.nativePeer.control.sessionJobMember=false,
  x=>x.result.native.nativePeer.history.commonJobMember=false,
  x=>x.result.native.nativePeer.control.bothJobsChecked=false,
  x=>x.result.native.nativePeer.history.generation=0,
  x=>x.result.native.nativePeer.control.retiring=true,
  x=>x.result.native.nativePeer.control.settled=true,
  x=>x.result.native.nativePeer.control.heldPeerClosed=true,
  x=>x.result.native.ready.nativePeer.control.mainPid=x.result.native.hostBefore.root.pid,
  x=>x.result.native.ready.nativePeer.history.nativeDirection='client',
  x=>x.result.native.ready.nativePeer.history.peer.pid++,
  x=>x.result.native.ready.nativePeer.history.peer.createdFileTime='1',
  x=>x.result.native.nativePeer.close.listeners=false,
  x=>x.result.native.nativePeer.close.control=false,
  x=>x.result.native.nativePeer.control.readReservedBytes=32769,
  x=>x.result.native.nativePeer.history.writeReservedBytes=90121,
  x=>x.result.native.nativePeer.control.writeReservedBytes=2049,
  x=>x.result.native.nativePeer.control.readIdleTimeout=true,
  x=>delete x.result.native.ready.nativePeer,
 ];
 for(const mutate of mutations){const x=fixture();mutate(x);assert.throws(()=>api.validateCandidateObservation(x));}
});
test('old successful HMAC/PowerShell receipt alone does not qualify a native peer candidate',()=>{
 assert.equal(typeof api.validateCandidateObservation,'function');assert.throws(()=>api.validateCandidateObservation(syntheticNormalObservation()),/PEER_/);
});
test('candidate CI rejects wrong branch, local environment and non-exact publication closure',()=>{
 assert.equal(typeof api.requireCandidateCi,'function');
 const good={platform:'win32',arch:'x64',node:'v24.16.0',env:{GITHUB_ACTIONS:'true',RUNNER_OS:'Windows',GITHUB_REF:'refs/heads/'+api.CANDIDATE_BRANCH}};
 assert.doesNotThrow(()=>api.requireCandidateCi(good));
 for(const bad of [{...good,platform:'linux'},{...good,env:{}},{...good,env:{...good.env,GITHUB_REF:'refs/heads/main'}}])assert.throws(()=>api.requireCandidateCi(bad),/PEER_CI_ONLY/);
 assert.doesNotThrow(()=>api.validatePublicationInputs(api.PUBLICATION_INPUTS));assert.throws(()=>api.validatePublicationInputs(api.PUBLICATION_INPUTS.slice(1)));
});
test('guarded candidate is separately hash pinned and does not load native code here',async()=>{
 assert.equal(typeof api.validateOwnershipCandidate,'function');
 const read=p=>readFile(new URL(p,import.meta.url));
 const args={source:await read('../native/terminal-creator-peer/ownership.cc'),binding:await read('../native/terminal-creator-peer/binding.gyp'),endpointSource:await read('../native/terminal-creator-peer/peer-endpoints.inc')};
 const value=api.validateOwnershipCandidate(args);assert.equal(value.admitted,false);assert.equal(value.compiled,false);
 for(const key of Object.keys(args))assert.throws(()=>api.validateOwnershipCandidate({...args,[key]:Buffer.concat([args[key],Buffer.from('\n')])}),/PEER_CANDIDATE_BYTES/);
});
