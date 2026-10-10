// SYNTHETIC DATA / BYTE TRANSPORT ONLY. No Windows APIs, native addon, HANDLE,
// child, shell, PTY or Electron. These observations are never kernel proof.
// Actual production JS implementations own all auth, startup, lease and ACKs.
import {TerminalProductionOwnership} from '../../src/terminal/production-ownership.mjs';
import {TerminalProductionBackend} from '../../src/terminal/production-backend.mjs';
import {createProductionCreator} from '../../src/terminal/production-creator.mjs';
import {decodeThreeLaneTerminalBootstrap} from '../../src/terminal/three-lane-bootstrap-codec.mjs';
import {createNativeThreeLaneStream} from '../../src/terminal/native-three-lane-stream.mjs';

export const INERT_RUNTIME=Object.freeze({executable:'C:\\SIREN\\electron.exe',entry:'C:\\SIREN\\production-creator-entry.mjs',directory:'C:\\SIREN'});
export const INERT_SHELL='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
export const inertConfig=(sessionId='session1')=>({sessionId,projectId:'project1',admissionEpoch:4,profileId:'powershell',cwd:'C:\\Project Ω Space',shell:{executable:INERT_SHELL,args:['-NoLogo','-NoProfile'],env:{PATH:'C:\\Windows\\System32',SystemRoot:'C:\\Windows',INERT_MARK:'bounded synthetic value'}},cols:120,rows:40});
export const inertTick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const LANES=['control','history','command'],SIDES=['main','creator'],WIRE_LIMIT=32768;
const fileTime=()=>BigInt(Date.now())*10000n+116444736000000000n;
const identity=(pid,image,born=fileTime())=>Object.freeze({pid,image,createdFileTime:String(born)});
const member=(p,alive=true)=>({...p,alive,exitCode:alive?259:77});

export function createInertProductionComposition(options={}){
 const deadlineMs=options.deadlineMs??500,state={synthetic:true,nativeExecutionAdmitted:false,trace:[],groups:[],writes:[],resizes:[],spawns:[],loads:0,creatorUnavailable:[],ownershipUnavailable:[],backendUnavailable:0,snapshotDuringAsync:0};
 const caps=new WeakMap(),heldWrites=new Set(),groups=new Map(),host=identity(101,INERT_RUNTIME.executable),main=identity(process.pid,'C:\\SIREN\\main.exe');
 let ownerSequence=0,backend=null,lifetime=true,admission=true;
 const trace=(name,details={})=>{if(state.trace.length>=4096)throw Error('INERT_TRACE_BOUND');state.trace.push(Object.freeze({name,...details}));};
 const capability=(kind,data)=>{const cap={};caps.set(cap,{kind,...data});return cap;};
 const get=(value,kind)=>{const r=caps.get(value);if(!r||r.kind!==kind)throw Error('INERT_CAPABILITY_KIND');return r;};
 const current=e=>!e.group.retiring&&!e.group.nativeExited&&e.group.lanes[e.lane].accepted&&e.group.lanes[e.lane].connected;
 function snapshot(g,final=false){
  const alive=!final&&!g.nativeExited,held=g.captured?[g.root,g.watchedShell,...(options.withHelper?[g.helper]:[])]:[];
  return{active:alive?(g.shell?(options.withHelper?3:2):1):0,root:member(g.root,alive),held:held.map(p=>member(p,alive)),killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:final||g.stopping,shell:g.watchedShell?member(g.watchedShell,alive):false,hostPid:host.pid,atomicBeforeResume:true,shellMonitorFired:false,shellMonitorTerminated:false};
 }
 function pending(g){
  let reads=0,writes=0,readBytes=0,writeBytes=0;for(const l of Object.values(g.lanes))for(const side of SIDES){if(l.reads[side]){reads++;readBytes+=32768;}if(l.writes[side]){writes++;writeBytes+=l.writes[side].bytes.length;}}
  return Object.freeze({reads,writes,readBytes,writeBytes,queuedBytes:Object.values(g.lanes).reduce((n,l)=>n+l.queues.main.bytes+l.queues.creator.bytes,0),closeReceipts:g.closeRequests.length});
 }
 function maybeClosed(g){
  if(!g.retiring||g.peerClosed||options.manualPeerClose&&!g.allowPeerClose)return;const p=pending(g);if(p.reads||p.writes||g.connectionDeliveries)return;
  g.peerClosed=true;for(const l of Object.values(g.lanes))for(const side of SIDES){for(const b of l.queues[side].parts)b.fill(0);l.queues[side].parts=[];l.queues[side].bytes=0;}
  trace('peer-settled',{sessionId:g.id});for(const d of g.closeRequests.splice(0))d.resolve(options.peerCloseFalse?false:true);
 }
 function finishIo(g,l,side,kind,value,failed=false){
  const table=kind==='read'?l.reads:l.writes,r=table[side];if(!r||r.delivering)return;r.delivering=true;
  // Native completion frees its busy slot before JavaScript continuations may
  // issue the next request. The real adapters retain their own I/O charges
  // until their captured Promise handlers actually consume this settlement.
  table[side]=null;if(kind==='write')r.bytes.fill(0);
  if(failed)r.deferred.reject(Error('INERT_CANCELLED'));else r.deferred.resolve(value);
  queueMicrotask(()=>{schedule(g);maybeClosed(g);});
 }
 function take(queue){
  const size=Math.min(WIRE_LIMIT,queue.bytes),out=Buffer.alloc(size);let offset=0;
  while(offset<size){const p=queue.parts[0],n=Math.min(p.length,size-offset);p.copy(out,offset,0,n);offset+=n;queue.bytes-=n;
   if(n===p.length){queue.parts.shift();p.fill(0);}else{queue.parts[0]=Buffer.from(p.subarray(n));p.fill(0);}}
  return out;
 }
 function pump(g){
  for(const [lane,l]of Object.entries(g.lanes))for(const side of SIDES){
   const r=l.reads[side],w=l.writes[side];
   if(g.retiring){if(r&&!g.holdReadCancellation)finishIo(g,l,side,'read',null);if(w&&!heldWrites.has(side+':'+lane))finishIo(g,l,side,'write',null,true);continue;}
   const target=side==='main'?'creator':'main';
   if(w&&!w.delivering&&!heldWrites.has(side+':'+lane)){
    const q=l.queues[target],n=Math.min(w.bytes.length-w.offset,WIRE_LIMIT-q.bytes);
    if(n>0){q.parts.push(Buffer.from(w.bytes.subarray(w.offset,w.offset+n)));q.bytes+=n;w.offset+=n;}
    if(w.offset===w.bytes.length)finishIo(g,l,side,'write',{bytes:w.bytes.length});
   }
   if(r&&!r.delivering&&l.queues[side].bytes)finishIo(g,l,side,'read',take(l.queues[side]));
  }
 }
 function schedule(g){if(g.pumpScheduled)return;g.pumpScheduled=true;queueMicrotask(()=>{g.pumpScheduled=false;pump(g);});}
 function connectionDone(g,l,kind,ok,value){
  if(l[kind+'Settled'])return;l[kind+'Settled']=true;const d=l[kind+'Request'];if(ok)d.resolve(value);else d.reject(Error('INERT_CONNECT_CANCELLED'));
  queueMicrotask(()=>{g.connectionDeliveries--;maybeClosed(g);});
 }
 function retire(g){if(!g.retiring){g.retiring=true;trace('peer-retire',{sessionId:g.id});for(const l of Object.values(g.lanes))for(const kind of ['accept','connect'])if(l[kind+'Request']&&!l[kind+'Settled'])connectionDone(g,l,kind,false);}schedule(g);maybeClosed(g);}
 function close(g){if(g.peerClosed)return Promise.resolve(options.peerCloseFalse?false:true);if(g.closeRequests.length>=16)throw Error('INERT_CLOSE_BOUND');const d=deferred();g.closeRequests.push(d);retire(g);return d.promise;}
 function pairLane(g,lane){if(!LANES.includes(lane))throw Error('INERT_LANE');return g.lanes[lane];}
 function completePair(g,lane){const l=g.lanes[lane];if(!l.acceptRequest||!l.connectRequest||g.retiring)return;
  l.accepted=true;l.connected=true;trace('native-pair-connected',{sessionId:g.id,lane});connectionDone(g,l,'accept',true,l.endpoints.main);connectionDone(g,l,'connect',true,l.endpoints.creator);schedule(g);
 }
 function termFor(g){
  return{pid:g.shell.pid,write:data=>{if(g.nativeExited)throw Error('INERT_SHELL_EXITED');state.writes.push(data);trace('pty-write',{sessionId:g.id});},resize:(cols,rows)=>{state.resizes.push([cols,rows]);trace('pty-resize',{sessionId:g.id});},onData:fn=>{g.onData=fn;trace('output-attached',{sessionId:g.id});return{dispose(){g.onData=null;}};},onExit:fn=>{g.onExit=fn;return{dispose(){g.onExit=null;}};}};
 }
 function provider(g){return{spawn:(executable,args,spawnOptions)=>{
  trace('pty-spawn',{sessionId:g.id});g.shell=identity(300+g.sequence,executable);state.spawns.push({sessionId:g.id,executable,args:[...args],options:spawnOptions});
  if(options.spawnAmbiguous)throw Error('INERT_PRIVATE_SPAWN_EXCEPTION');return termFor(g);
 }};}
 function installCreator(g,payload){
  const bootstrap=decodeThreeLaneTerminalBootstrap(Buffer.from(payload));if(options.wrongCommandKey)bootstrap.commandSecret[0]^=1;
  g.id=bootstrap.sessionId;groups.set(g.id,g);const witness=capability('witness',{group:g});
  // Exact DATA shape of the reviewed reader's adopted result. This synthetic
  // fixture does NOT run the outer native HANDLE adoption or claim it happened.
  const adopted={bootstrap};Object.defineProperties(adopted,{witness:{value:witness},dispose:{value:()=>{native.closePeerWitness(witness);bootstrap.dispose();return true;}}});
  g.creator=createProductionCreator({bootstrap:Object.freeze(adopted),connectLane:q=>native.connectPeerLane(q.witness,q.pipe,q.lane,q.deadlineMs).then(endpoint=>{
   const stream=createNativeThreeLaneStream({native,endpoint,lane:q.lane,deadlineMs:q.deadlineMs});g.creatorStreams[q.lane]=stream;return stream;
  }),assertEndpointsCurrent:()=>LANES.every(l=>{const e=g.lanes[l].endpoints.creator;try{return native.assertPeerCurrent(e)===true;}catch{return false;}}),loadPty:()=>{
   state.loads++;trace('provider-load',{sessionId:g.id,startupPhase:g.creator.stats().session.startup.phase});if(options.providerReject)return Promise.reject(Error('INERT_PRIVATE_LOAD_EXCEPTION'));
   if(options.manualProvider){g.provider=deferred();return g.provider.promise;}return Promise.resolve(provider(g));
  },onUnavailable:code=>{state.creatorUnavailable.push(code);trace('creator-unavailable',{sessionId:g.id,code});},deadlineMs});
 }
 const native={
  start(pid,image,since){if(pid!==host.pid||image!==host.image||BigInt(host.createdFileTime)<since)throw Error('INERT_HOST');trace('host-start');return capability('owner',{});},
  snapshot(owner){get(owner,'owner');return{active:1,root:member(host),held:[],killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:false};},
  createPeerListeners(owner,controlPipe,historyPipe,commandPipe){get(owner,'owner');if(state.groups.length>=16||state.groups.filter(g=>!g.peerClosed).length>=8)throw Error('INERT_PAIR_BOUND');
   const sequence=++ownerSequence,g={sequence,id:null,root:identity(200+sequence,INERT_RUNTIME.executable),helper:identity(400+sequence,'C:\\SIREN\\helper.exe'),shell:null,watchedShell:null,captured:false,stopping:false,nativeExited:false,asyncPending:false,retiring:false,peerClosed:false,allowPeerClose:false,holdReadCancellation:false,pumpScheduled:false,connectionDeliveries:0,closeRequests:[],creatorStreams:{},lanes:{},creator:null,stop:null};
   const names={control:controlPipe,history:historyPipe,command:commandPipe};
   for(const lane of LANES){const l={name:names[lane],accepted:false,connected:false,reads:{main:null,creator:null},writes:{main:null,creator:null},queues:{main:{parts:[],bytes:0},creator:{parts:[],bytes:0}},endpoints:{},acceptRequest:null,connectRequest:null};g.lanes[lane]=l;for(const side of SIDES)l.endpoints[side]=capability('endpoint',{group:g,lane,side});}
   state.groups.push(g);trace('listeners',{sequence});return capability('pair',{group:g});
  },
  createPeerSession(owner,executable,entry,directory,payload,pair){get(owner,'owner');const g=get(pair,'pair').group;
   if(executable!==INERT_RUNTIME.executable||entry!==INERT_RUNTIME.entry||directory!==INERT_RUNTIME.directory||payload.length>2048||payload.subarray(0,8).toString()!=='SIRENTB2')throw Error('INERT_CREATE');
   trace('create',{sequence:g.sequence,payloadBytes:payload.length});const session=capability('session',{group:g});g.session=session;
   installCreator(g,payload);if(options.createAmbiguous)throw Error('INERT_PRIVATE_CREATE_EXCEPTION');return session;
  },
  snapshotSession(session){const g=get(session,'session').group;if(g.asyncPending){state.snapshotDuringAsync++;throw Error('INERT_ASYNC_PENDING');}trace('snapshot-session',{sessionId:g.id});return snapshot(g);},
  watchRoot(session,pid,image,since){const g=get(session,'session').group;if(g.asyncPending||!g.shell||g.shell.pid!==pid||g.shell.image!==image||BigInt(g.shell.createdFileTime)<since)throw Error('INERT_WATCH');g.watchedShell=g.shell;trace('watch',{sessionId:g.id});const s=snapshot(g);if(options.watchIdentityMismatch)s.shell.pid=999;return s;},
  captureSession(session){const g=get(session,'session').group;if(g.asyncPending||!g.watchedShell||g.captured)throw Error('INERT_CAPTURE');g.captured=true;trace('capture',{sessionId:g.id});return snapshot(g);},
  acceptPeerLane(pair,lane,ms){const g=get(pair,'pair').group,l=pairLane(g,lane);if(g.retiring||l.acceptRequest)throw Error('INERT_ACCEPT');trace('accept',{sessionId:g.id,lane});l.acceptRequest=deferred();g.connectionDeliveries++;completePair(g,lane);return l.acceptRequest.promise;},
  connectPeerLane(witness,name,lane,ms){const g=get(witness,'witness').group,l=pairLane(g,lane);if(name!==l.name||g.retiring||l.connectRequest)throw Error('INERT_CONNECT');trace('connect',{sessionId:g.id,lane});l.connectRequest=deferred();g.connectionDeliveries++;completePair(g,lane);return l.connectRequest.promise;},
  closePeerWitness(witness){const g=get(witness,'witness').group;trace('witness-close',{sessionId:g.id});if(!LANES.every(l=>g.lanes[l].connected))retire(g);return true;},
  assertPeerCurrent(endpoint){const e=get(endpoint,'endpoint');if(!current(e))throw Error('INERT_ENDPOINT_STALE');return true;},
  peerSnapshot(endpoint){const e=get(endpoint,'endpoint'),g=e.group,l=g.lanes[e.lane],server=e.side==='main',r=l.reads[e.side],w=l.writes[e.side];
   return{lane:e.lane,server,connected:l.connected,retiring:g.retiring,settled:g.peerClosed,peer:{...member(server?g.root:main,!g.nativeExited),observedBeforeClose:false},mainPid:process.pid,creatorPid:g.root.pid,queriedPeerPid:server?g.root.pid:process.pid,nativeDirection:server?'client':'server',bothJobsChecked:server,commonJobMember:server?true:null,sessionJobMember:server?true:null,readPending:!!r,writePending:!!w,readReservedBytes:r?32768:0,writeReservedBytes:w?w.bytes.length:0,heldPeerClosed:g.peerClosed,generation:0,readIdleTimeout:false,nativeExecutionAdmitted:false};
  },
  peerRead(endpoint,ms){const e=get(endpoint,'endpoint'),l=e.group.lanes[e.lane];if(!current(e)||l.reads[e.side])throw Error('INERT_READ');const d=deferred();l.reads[e.side]={deferred:d,delivering:false};schedule(e.group);return d.promise;},
  peerWrite(endpoint,bytes,ms){const e=get(endpoint,'endpoint'),l=e.group.lanes[e.lane];if(!current(e)||l.writes[e.side]||bytes.length<1||bytes.length>(e.lane==='control'?2048:90120))throw Error('INERT_WRITE');const d=deferred();l.writes[e.side]={deferred:d,bytes:Buffer.from(bytes),offset:0,delivering:false};schedule(e.group);return d.promise;},
  closePeerEndpoint(endpoint,ms){const e=get(endpoint,'endpoint');trace('endpoint-close',{sessionId:e.group.id,lane:e.lane,side:e.side});return close(e.group);},
  closePeerListeners(pair,ms){const g=get(pair,'pair').group;trace('listeners-close',{sessionId:g.id});return close(g);},
  stopAndCloseSessionAsync(session,code,ms){const g=get(session,'session').group;if(g.stop||g.asyncPending)throw Error('INERT_DOUBLE_STOP');g.stop=deferred();g.asyncPending=true;g.stopping=true;trace('native-stop',{sessionId:g.id,code});retire(g);if(!options.manualNative)queueMicrotask(()=>completeNative(g));return g.stop.promise;},
 };
 function completeNative(g){if(!g.stop||g.nativeExited)return;g.nativeExited=true;g.asyncPending=false;trace('native-settled',{sessionId:g.id});const s=snapshot(g,true);if(options.finalIdentityMismatch){const changed=String(BigInt(s.root.createdFileTime)+1n);s.root.createdFileTime=changed;for(const m of s.held)if(m.pid===s.root.pid)m.createdFileTime=changed;}g.stop.resolve({snapshot:s,closed:true});}
 const ownership=new TerminalProductionOwnership({native,isCurrent:()=>lifetime,onUnavailable:r=>{state.ownershipUnavailable.push(r);trace('ownership-unavailable',{sessionId:r.sessionId});},onVerified:r=>trace('ownership-verified',{sessionId:r.sessionId})});
 const started=ownership.startHost({hostProcessIdentity:{pid:host.pid,image:host.image,since:1n}});if(started.ok!==true)throw Error('INERT_HOST_START_REFUSED');
 backend=new TerminalProductionBackend({ownership,hostOwnerId:started.hostOwnerId,creator:INERT_RUNTIME,onUnavailable:()=>{state.backendUnavailable++;trace('backend-unavailable');},deadlineMs});
 const guard=Object.freeze({isCurrent:()=>admission});
 return{state,native,ownership,backend,guard,group:sessionId=>groups.get(sessionId),pending:sessionId=>pending(groups.get(sessionId)),setAdmission:v=>admission=v,setLifetime:v=>lifetime=v,
  emitOutput(sessionId,text){const g=groups.get(sessionId);if(!g?.onData)throw Error('INERT_NO_OUTPUT_SUBSCRIPTION');g.onData(text);},
  holdWrite(side,lane){if(!SIDES.includes(side)||!LANES.includes(lane))throw Error('INERT_LANE');heldWrites.add(side+':'+lane);},
  releaseWrites(){heldWrites.clear();for(const g of state.groups)schedule(g);},
  holdReadCancellation(sessionId){groups.get(sessionId).holdReadCancellation=true;},
  releaseReads(){for(const g of state.groups){g.holdReadCancellation=false;schedule(g);}},
  completeNative(sessionId){completeNative(groups.get(sessionId));},
  completePeers(sessionId){const g=groups.get(sessionId);g.allowPeerClose=true;maybeClosed(g);},
  releaseProvider(sessionId){const g=groups.get(sessionId);if(!g.provider)throw Error('INERT_PROVIDER_NOT_PENDING');g.provider.resolve(provider(g));},
  async dispose(){for(const g of state.groups){g.creator?.dispose();g.holdReadCancellation=false;g.allowPeerClose=true;}heldWrites.clear();for(const g of state.groups)schedule(g);const tasks=ownership.snapshot().sessions.map(r=>ownership.stopSession({sessionOwnerId:r.sessionOwnerId,deadlineMs,code:98}));for(const g of state.groups)completeNative(g);await Promise.all(tasks);for(const g of state.groups)maybeClosed(g);await inertTick();},
 };
}
