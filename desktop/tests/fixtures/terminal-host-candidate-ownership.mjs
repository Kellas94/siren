import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {TerminalHostCandidateOwnership} from '../../src/terminal/host-candidate-ownership.mjs';

const creator={executable:'C:\\Runtime\\electron.exe',entry:'C:\\Runtime\\creator.mjs',directory:'C:\\Runtime'};
const identity=(pid,image=creator.executable)=>({pid,image,createdFileTime:String(pid+1000)});
const member=(p,alive=true)=>({...p,alive,exitCode:alive?259:77});
const hostIdentity=identity(101),rootIdentity=identity(201),shellIdentity=identity(301,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
export function fixture(options={}){
 const calls=[],events=[],owners=new WeakSet(),pairs=new WeakSet(),sessions=new WeakSet(),endpoints=new Map();
 const accepts=Object.fromEntries(['control','history','command'].map(l=>[l,deferred()]));
 const nativeStop=deferred(),listenerClose=deferred(),endpointCloses=Object.fromEntries(['control','history','command'].map(l=>[l,deferred()]));
 let shell=false,held=[],onNative=null,nowSnapshot=null,guard=()=>true;
 const hostSnapshot=()=>({active:1,root:member(hostIdentity),held:[],killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:false});
 const snapshot=()=>nowSnapshot??({active:shell?2:1,root:member(rootIdentity),held:held.map(p=>member(p)),killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:false,shell:shell?member(shellIdentity):false,hostPid:hostIdentity.pid,atomicBeforeResume:true,shellMonitorFired:false,shellMonitorTerminated:false});
 const cap=()=>({});
 const native={
  start(...args){calls.push(['start',...args]);const c=cap();owners.add(c);return c;},
  snapshot(c){assert(owners.has(c));calls.push(['snapshot']);if(onNative)onNative('snapshot');return hostSnapshot();},
  createPeerListeners(h,...names){assert(owners.has(h));calls.push(['listeners',...names]);const p=cap();pairs.add(p);if(onNative)onNative('listeners');return p;},
  createPeerSession(h,exe,entry,directory,payload,p){assert(owners.has(h)&&pairs.has(p));calls.push(['create',exe,entry,directory,Buffer.from(payload)]);const c=cap();sessions.add(c);if(onNative)onNative('create');return c;},
  snapshotSession(c){assert(sessions.has(c));calls.push(['snapshotSession']);if(onNative)onNative('snapshotSession');return snapshot();},
  watchRoot(c,pid,image,since){assert(sessions.has(c));calls.push(['watch',pid,image,since]);shell=true;if(onNative)onNative('watch');return snapshot();},
  captureSession(c){assert(sessions.has(c));calls.push(['capture']);held=[rootIdentity,shellIdentity,...(options.withHelper?[identity(401,'C:\\Runtime\\helper.exe')]:[])];if(onNative)onNative('capture');return snapshot();},
  acceptPeerLane(p,lane,ms){assert(pairs.has(p));calls.push(['accept',lane,ms]);return accepts[lane].promise;},
  assertPeerCurrent(e){assert(endpoints.has(e));calls.push(['assert',endpoints.get(e)]);if(onNative)onNative('assert');return true;},
  peerSnapshot(e){const lane=endpoints.get(e);assert(lane);calls.push(['peerSnapshot',lane]);return{pairOrdinal:17,lane,server:true,connected:true,retiring:false,settled:false,peer:{...member(rootIdentity),observedBeforeClose:false},mainPid:process.pid,creatorPid:rootIdentity.pid,queriedPeerPid:rootIdentity.pid,nativeDirection:'client',bothJobsChecked:true,commonJobMember:true,sessionJobMember:true,readPending:false,writePending:false,readReservedBytes:0,writeReservedBytes:0,heldPeerClosed:false,generation:0,readIdleTimeout:false,nativeExecutionAdmitted:false};},
  peerRead(e,ms){calls.push(['read',endpoints.get(e),ms]);return new Promise(()=>{});},
  peerWrite(e,bytes,ms){calls.push(['write',endpoints.get(e),bytes.length,ms]);return Promise.resolve({bytes:bytes.length});},
  closePeerEndpoint(e,ms){const lane=endpoints.get(e);calls.push(['endpointClose',lane,ms]);return endpointCloses[lane].promise;},
  closePeerListeners(p,ms){assert(pairs.has(p));calls.push(['listenerClose',ms]);return listenerClose.promise;},
  stopAndCloseSessionAsync(c,code,ms){assert(sessions.has(c));calls.push(['stop',code,ms]);if(onNative)onNative('stop');return nativeStop.promise;},
 };
 const hostStop=deferred();let hostRequest=null;const hostOrdinals=Object.freeze([...(options.hostOrdinals??[17])]);
 native.stopAndCloseHostAsync=function(h,code,deadlineMs,shutdownId){assert(owners.has(h));calls.push(['hostStop',h,code,deadlineMs,shutdownId,this]);hostRequest=Object.freeze({code,deadlineMs,shutdownId});return hostStop.promise;};
 native.captureHostShutdownPeerRoster=function(h,shutdownId){assert(owners.has(h));calls.push(['hostRoster',h,shutdownId,this]);return Object.freeze({version:1,shutdownId,scope:'HOST_ASYNC_CAPTURED_PEER_ROSTER',pairOrdinals:hostOrdinals});};
 native.captureHostShutdownExpectation=function(h,shutdownId){assert(owners.has(h));calls.push(['hostExpected',h,shutdownId,this]);return Object.freeze({request:hostRequest,root:Object.freeze({...hostIdentity}),held:Object.freeze([]),pairOrdinals:hostOrdinals});};
 const finalHost=()=>({version:1,...hostRequest,snapshot:{...hostSnapshot(),active:0,root:member(hostIdentity,false),held:[],stopping:true},closed:true,scope:'HOST_AND_EXACT_PEER_ROSTER_ONLY',sessionCleanupJoined:false,peers:hostOrdinals.map(pairOrdinal=>({pairOrdinal,nativeReaped:true,jsDeliveryVerified:true,tsfnFinalized:true}))});
 if(options.configure)options.configure(native,{calls,events,accepts,nativeStop,listenerClose});
 const adapter=new TerminalHostCandidateOwnership({native,isCurrent:()=>guard(),onUnavailable:r=>{events.push(['unavailable',r]);return options.onUnavailable?.(r);},onVerified:r=>{events.push(['verified',r]);return options.onVerified?.(r);}});
 const start=()=>adapter.startHost({hostProcessIdentity:{pid:hostIdentity.pid,image:hostIdentity.image,since:1n}});
 const prepare=(id='session')=>adapter.prepareSession({hostOwnerId:hostId,sessionId:id,channelId:'channel_'+id,creator:{...creator}});
 let hostId=options.noStart?null:start().hostOwnerId;
 const allocate=id=>adapter.allocateSession({sessionOwnerId:id});
 const accept=lane=>{const e=cap();endpoints.set(e,lane);accepts[lane].resolve(e);return e;};
 const connect=async id=>{const p=adapter.connectSession({sessionOwnerId:id,deadlineMs:500});for(const lane of Object.keys(accepts))accept(lane);return p;};
 const final=()=>({snapshot:{...snapshot(),active:0,root:member(rootIdentity,false),held:held.map(p=>member(p,false)),shell:shell?member(shellIdentity,false):false,stopping:true},closed:true});
 const closeAll=()=>{listenerClose.resolve(true);for(const p of Object.values(endpointCloses))p.resolve(true);};
 return{hostStop,finalHost,adapter,native,calls,events,start,prepare,allocate,accept,connect,final,closeAll,nativeStop,listenerClose,endpointCloses,accepts,hostId,setHook:f=>onNative=f,setSnapshot:s=>nowSnapshot=s,setGuard:f=>guard=f,snapshot};
}