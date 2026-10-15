// Pure classifier and isolated CI policy. No native loading or execution.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PUBLICATION_INPUTS as previousInputs,validateCandidateObservation as validateNormalObservation} from './terminal-normal-powershell-contract.mjs';
export const CANDIDATE_BRANCH='probe/terminal-peer-endpoints-2026-10-08';
export const CANDIDATE_SCOPE='ACTUAL_NATIVE_PEER_ENDPOINTS_NOT_ADMITTED';
export const PUBLICATION_INPUTS=Object.freeze([...previousInputs,
 '.github/workflows/terminal-peer-endpoints.yml',
 'desktop/native/terminal-creator-peer/ownership.cc','desktop/native/terminal-creator-peer/binding.gyp','desktop/native/terminal-creator-peer/peer-endpoints.inc',
 'desktop/src/terminal/peer-endpoint-source.mjs','desktop/src/terminal/peer-bootstrap-reader.mjs','desktop/src/terminal/native-peer-stream.mjs',
 'desktop/tests/terminal-peer-endpoint-source.test.mjs','desktop/tests/terminal-peer-bootstrap-reader.test.mjs','desktop/tests/terminal-native-peer-stream.test.mjs',
 'desktop/tests/native/terminal-peer-endpoints-contract.mjs','desktop/tests/native/terminal-peer-probe-derive.mjs','desktop/tests/native/terminal-peer-endpoints.mjs','desktop/tests/native/terminal-peer-worker.mjs',
 'desktop/tests/native/terminal-peer-ci-derive.mjs','desktop/tests/native/build-terminal-peer-endpoints.mjs',
 'desktop/tests/terminal-peer-endpoints-contract.test.mjs','desktop/tests/terminal-peer-probe-source.test.mjs','desktop/tests/terminal-peer-builder.test.mjs',
]);
export function validatePublicationInputs(rows){assert.ok(Array.isArray(rows)&&new Set(rows).size===rows.length,'PEER_PUBLICATION_DUPLICATE');assert.deepEqual([...rows].sort(),[...PUBLICATION_INPUTS].sort(),'PEER_PUBLICATION_CLOSURE');}
export function requireCandidateCi({platform,arch,node,env}){assert.ok(platform==='win32'&&arch==='x64'&&node==='v24.16.0'&&env?.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Windows'&&env.GITHUB_REF==='refs/heads/'+CANDIDATE_BRANCH,'PEER_CI_ONLY');}
function branches(text){const declaration=/^    branches: \[([^\]]*)\]\r?$/m.exec(text);assert.ok(declaration,'PEER_WORKFLOW_BRANCH');const rows=[...declaration[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);assert.equal(rows.map(x=>"'"+x+"'").join(', '),declaration[1],'PEER_WORKFLOW_BRANCH');return rows;}
export function requireWorkflowIsolation({candidate,historical,previous}){
 assert.deepEqual(branches(candidate),[CANDIDATE_BRANCH],'PEER_WORKFLOW_BRANCH');
 validatePublicationInputs([...candidate.matchAll(/^      - '([^']+)'/gm)].map(m=>m[1]));
 for(const old of [historical,previous])for(const branch of branches(old)){assert.doesNotMatch(branch,/[*?!\[\]{}]/,'PEER_HISTORICAL_BRANCH');assert.notEqual(branch,CANDIDATE_BRANCH,'PEER_WORKFLOW_COLLISION');}
}
const hash=b=>createHash('sha256').update(b).digest('hex');
const pins={source:'cad20d5b5920cbf56ac8921de146682ce1208020eb3f64efa09ac3b97462594f',binding:'e687bcfd32044f431060fc1fe5471ae45cb3dd3bf5dbad5e8ca05b2f606655e7',endpointSource:'9cbbaa14ea8a2274141051c99d800463ab47b2f0d19dc5cddf5877999233e8bf'};
export function validateOwnershipCandidate(args){
 for(const key of Object.keys(pins))assert.ok(Buffer.isBuffer(args?.[key])&&hash(args[key])===pins[key],'PEER_CANDIDATE_BYTES');
 const recipe=JSON.parse(args.binding);assert.equal(recipe.targets[0].target_name,'siren_terminal_creator_peer');
 return {sourceSha256:pins.source,bindingSha256:pins.binding,endpointSha256:pins.endpointSource,compiled:false,admitted:false};
}
const require=(v,label)=>assert.ok(v,'PEER_'+label);
const integer=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const same=(a,b)=>a&&b&&a.pid===b.pid&&a.createdFileTime===b.createdFileTime&&typeof a.image==='string'&&a.image.toLowerCase()===b.image.toLowerCase();
function endpoint(p,{lane,server,main,creator}){
 require(p&&p.lane===lane&&p.server===server&&p.connected===true&&p.retiring===false&&p.settled===false&&p.heldPeerClosed===false&&p.nativeExecutionAdmitted===false,'LIVE_ENDPOINT');
 require(Number.isSafeInteger(p.generation)&&p.generation>=1,'GENERATION');
 require(p.mainPid===main.pid&&p.creatorPid===creator.pid&&main.pid!==creator.pid,'MAIN_CREATOR_BINDING');
 require(same(p.peer,server?creator:main)&&p.peer.alive===true&&p.peer.exitCode===259&&p.peer.observedBeforeClose!==true,'HELD_PEER_IDENTITY');
 require(p.queriedPeerPid===p.peer.pid&&p.nativeDirection===(server?'client':'server'),'KERNEL_QUERY_DIRECTION');
 require(p.bothJobsChecked===server&&p.commonJobMember===(server?true:null)&&p.sessionJobMember===(server?true:null),'BOTH_JOB_MEMBERSHIP');
 require(typeof p.readPending==='boolean'&&typeof p.writePending==='boolean'&&integer(p.readReservedBytes,32768)&&integer(p.writeReservedBytes,lane==='control'?2048:90120),'IO_BOUNDS');
 require(p.readIdleTimeout===false,'IDLE_READ_MUST_NOT_EXPIRE');
 require(p.readReservedBytes===(p.readPending?32768:0),'READ_RESERVATION');
 require(p.writePending||p.writeReservedBytes===0,'WRITE_RESERVATION');
}
export function validateCandidateObservation(args){
 const normal=validateNormalObservation(args),n=args.result.native,main=args.result.observer.main,creator=n.before.root;
 require(n.nativePeer&&n.ready.nativePeer,'ENDPOINT_OBSERVATIONS_REQUIRED');
 for(const lane of ['control','history']){
  endpoint(n.nativePeer[lane],{lane,server:true,main,creator});
  endpoint(n.ready.nativePeer[lane],{lane,server:false,main,creator});
 }
 assert.deepEqual(n.nativePeer.close,{control:true,history:true,listeners:true},'PEER_SETTLED_RETIREMENT_REQUIRED');
 return {...normal,nativePeer:{admitted:false,bothDirectionsObserved:true,heldCreatorPid:creator.pid,heldMainPid:main.pid,closed:true,normalShellAndSafetyObserved:true}};
}
