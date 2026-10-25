// Explicit native/FS/utility/PTY boundary only. Genuine canonical-R creator,
// codecs and streams execute; no ownership/backend/graph composition is made.
export function createFirstSessionNativeWorld(runtime){
 const record=globalThis.__factoryRecord,options=record.sessionControl??{},win=globalThis.__factoryWinPath;
 const INERT_RUNTIME={executable:win.join(runtime,'electron','electron.exe'),entry:win.join(runtime,'desktop','src','terminal','desktop-native-runtime-creator.mjs'),directory:runtime};
 const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
 const LANES=['control','history','command'],SIDES=['main','creator'],WIRE_LIMIT=32768;
 const fileTime=()=>BigInt(Date.now())*10000n+116444736000000000n;const identity=(pid,image,born=fileTime())=>Object.freeze({pid,image,createdFileTime:String(born)}),member=(p,alive=true,code=77)=>({...p,alive,exitCode:alive?259:code});
 const decodeThreeLaneTerminalBootstrap=(...args)=>globalThis.__firstSessionGenuine.decodeThreeLaneTerminalBootstrap(...args);
 const createProductionCreator=(...args)=>globalThis.__firstSessionGenuine.createProductionCreator(...args);
 const createNativeThreeLaneStream=(...args)=>globalThis.__firstSessionGenuine.createNativeThreeLaneStream(...args);
function baseNativeWorldFactory(runtime){
 const record=globalThis.__factoryRecord,win=globalThis.__factoryWinPath;
 const caps=new WeakMap(),cache=Object.create(null);let nextPid=101;
 const trace=(name,details={})=>{record.nativeBoundaryTrace??=[];record.nativeBoundaryTrace.push({name,...details});record.onBoundaryEvent?.(name);globalThis.__factoryTraceEvent?.({name,...details});};
 const identity=pid=>({pid,image:win.join(runtime,'electron','electron.exe'),createdFileTime:'1001'});
 const member=(value,alive=true)=>({...value,alive,exitCode:alive?259:77});
 const snapshot=(state,final=false)=>({active:final?0:1,root:member(state.root,!final),held:[],killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:final});
 const stateFor=host=>{const state=caps.get(host);if(!state)throw Error('CONTROLLED_NATIVE_HOST_REQUIRED');return state;};
 const host={
  start(pid,image,since){if(image!==win.join(runtime,'electron','electron.exe')||since!==1n)throw Error('CONTROLLED_NATIVE_IDENTITY');const cap={};caps.set(cap,{root:identity(pid),request:null});trace('host-start',{pid});return cap;},
  snapshot(cap){trace('host-snapshot');return snapshot(stateFor(cap));},
  stopAndCloseHostAsync(cap,code,deadlineMs,shutdownId){const state=stateFor(cap);if(state.pending){if(state.request.code!==code||state.request.deadlineMs!==deadlineMs||state.request.shutdownId!==shutdownId)throw Error('CONTROLLED_SHUTDOWN_CONFLICT');return state.pending;}state.request=Object.freeze({code,deadlineMs,shutdownId});trace('host-stop',{shutdownId});state.pending=Promise.resolve({version:1,...state.request,snapshot:snapshot(state,true),closed:record.factoryControl.unknownHostCleanup!==true,scope:'HOST_AND_EXACT_PEER_ROSTER_ONLY',sessionCleanupJoined:false,peers:[]});return state.pending;},
  captureHostShutdownPeerRoster(cap,shutdownId){stateFor(cap);trace('host-roster');return Object.freeze({version:1,shutdownId,scope:'HOST_ASYNC_CAPTURED_PEER_ROSTER',pairOrdinals:Object.freeze([])});},
  captureHostShutdownExpectation(cap){const state=stateFor(cap);trace('host-expectation');return Object.freeze({request:state.request,root:Object.freeze({...state.root}),held:Object.freeze([]),pairOrdinals:Object.freeze([])});},
  mark(){return 1n;}
 };
 for(const name of ['createPeerListeners','createPeerSession','snapshotSession','watchRoot','captureSession','acceptPeerLane','peerRead','peerWrite','assertPeerCurrent','peerSnapshot','closePeerEndpoint','closePeerListeners','stopAndCloseSessionAsync'])host[name]=()=>{trace('unexpected-session-method',{name});throw Error('CONTROLLED_SESSION_NOT_ENTERED');};
 const guarded=value=>Object.defineProperty(value,'then',{value:undefined});
 const ancestry=path=>{const root=win.parse(path).root,parts=path.slice(root.length).split('\\').filter(Boolean);return [root,...parts.map((_,index)=>win.join(root,...parts.slice(0,index+1)))].map(path=>({path,identity:globalThis.__factoryIdentity(path),directory:true,reparse:false}));};
 const inspect=(path,kind)=>guarded({canonicalPath:path,identity:globalThis.__factoryIdentity(path),[kind]:true,reparse:false,ancestors:ancestry(kind==='file'?win.dirname(path):path)});
 const filesystem={createFilesystemInspector(){trace('filesystem-inspector');return {...(record.factoryControl.holdProvider?{extra:true}:{}),
  getSystemDirectory:()=>{const result='C:\\Windows\\System32';record.filesystemQueries??=[];record.filesystemQueries.push({method:'getSystemDirectory',args:[],result});trace('filesystem-system',{result});return Promise.resolve(result);},
  inspectDirectory:path=>{const result=inspect(path,'directory');record.filesystemQueries??=[];record.filesystemQueries.push({method:'inspectDirectory',args:[path],result:JSON.parse(JSON.stringify(result)),thenGuard:{own:true,enumerable:false,writable:false,configurable:false,valueUndefined:true}});trace('filesystem-directory',{path});return Promise.resolve(result);},
  inspectFile:path=>{const result=inspect(path,'file');record.filesystemQueries??=[];record.filesystemQueries.push({method:'inspectFile',args:[path],result:JSON.parse(JSON.stringify(result)),thenGuard:{own:true,enumerable:false,writable:false,configurable:false,valueUndefined:true}});trace('filesystem-file',{path});return Promise.resolve(result);},
  retire:()=>{trace('filesystem-retire');if(record.factoryControl.holdProvider)return new Promise(resolve=>{record.releaseProvider=()=>resolve(guarded({retired:true,actualSettled:true,pending:0}));});return Promise.resolve(guarded({retired:true,actualSettled:true,pending:0}));}
 };}};
 function utilityFork(entry,args,options){
  if(entry!==win.join(runtime,'desktop','src','terminal','desktop-native-runtime-host.mjs')||args.length||options.cwd!==runtime)throw Error('CONTROLLED_UTILITY_PATH');
  record.counters.utility++;record.counters.fork++;trace('utility-fork');const child=new globalThis.__factoryEmitter();child.pid=nextPid++;
  child.postMessage=value=>{if(value.kind==='retire'){trace('utility-retire');const hook=record.factoryControl.onUtilityRetire;record.factoryControl.onUtilityRetire=null;hook?.();if(!record.factoryControl.holdExit)queueMicrotask(()=>child.emit('exit',0));}};
  child.kill=()=>{trace('utility-kill');if(!record.factoryControl.holdExit)queueMicrotask(()=>child.emit('exit',0));return true;};
  record.releaseExit=()=>{trace('controlled-exit-release');child.emit('exit',0);};record.releaseUtility=()=>{trace('controlled-utility-release');child.emit('spawn');child.emit('message',{schema:'siren-desktop-utility-host/v1',pid:child.pid,electron:'44.9.3',modules:'149',napi:'10'});};if(!record.factoryControl.holdUtility)queueMicrotask(record.releaseUtility);return child;
 }
 return {host,filesystem,utilityFork,cache};
}

 const deadlineMs=10000,state={synthetic:true,nativeExecutionAdmitted:false,trace:[],groups:[],writes:[],resizes:[],spawns:[],loads:0,creatorUnavailable:[],ownershipUnavailable:[],backendUnavailable:0,snapshotDuringAsync:0};
 const caps=new WeakMap(),heldWrites=new Set(),groups=new Map();let host=identity(101,INERT_RUNTIME.executable,'1001');const main=identity(process.pid,INERT_RUNTIME.executable);
 let ownerSequence=0,backend=null,lifetime=true,admission=true;
 const trace=(name,details={})=>{if(state.trace.length>=4096)throw Error('INERT_TRACE_BOUND');const row=Object.freeze({name,...details});state.trace.push(row);record.nativeBoundaryTrace??=[];record.nativeBoundaryTrace.push(row);globalThis.__factoryTraceEvent?.(row);record.onSessionEvent?.(row);};
 const capability=(kind,data)=>{const cap={};caps.set(cap,{kind,...data});return cap;};
 const get=(value,kind)=>{const r=caps.get(value);if(!r||r.kind!==kind)throw Error('INERT_CAPABILITY_KIND');return r;};
 const current=e=>!e.group.retiring&&!e.group.nativeExited&&e.group.lanes[e.lane].accepted&&e.group.lanes[e.lane].connected;
 function snapshot(g,final=false){
  const alive=!final&&!g.nativeExited,held=g.captured?[g.root,g.watchedShell,...(options.withHelper?[g.helper]:[])]:[];
  return{active:alive?(g.shell?(options.withHelper?3:2):1):0,root:member(g.root,alive,g.observedExitCode??g.exitCode??77),held:held.map(p=>member(p,alive,g.observedExitCode??g.exitCode??77)),killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:final||g.stopping,shell:g.watchedShell?member(g.watchedShell,alive,g.observedExitCode??g.exitCode??77):false,hostPid:get(g.host,'owner').root.pid,atomicBeforeResume:true,shellMonitorFired:false,shellMonitorTerminated:false};
 }
 function pending(g){
  let reads=0,writes=0,readBytes=0,writeBytes=0;for(const l of Object.values(g.lanes))for(const side of SIDES){if(l.reads[side]){reads++;readBytes+=32768;}if(l.writes[side]){writes++;writeBytes+=l.writes[side].bytes.length;}}
  return Object.freeze({reads,writes,readBytes,writeBytes,ioDeliveries:g.ioDeliveries,closeDeliveries:g.closeDeliveries,connectionDeliveries:g.connectionDeliveries,queuedBytes:Object.values(g.lanes).reduce((n,l)=>n+l.queues.main.bytes+l.queues.creator.bytes,0),closeReceipts:g.closeRequests.length});
 }
 function maybeClosed(g){
  if(!g.retiring||g.peerClosed||options.manualPeerClose&&!g.allowPeerClose)return;const p=pending(g);if(p.reads||p.writes||g.connectionDeliveries||g.ioDeliveries)return;
  g.peerClosed=true;for(const l of Object.values(g.lanes))for(const side of SIDES){for(const b of l.queues[side].parts)b.fill(0);l.queues[side].parts=[];l.queues[side].bytes=0;}
  trace('peer-settled',{sessionId:g.id});for(const d of g.closeRequests.splice(0)){g.closeDeliveries++;d.resolve(options.peerCloseFalse?false:true);queueMicrotask(()=>{g.closeDeliveries--;finishHostOperations();});}finishHostOperations();
 }
 function finishIo(g,l,side,kind,value,failed=false){
  const table=kind==='read'?l.reads:l.writes,r=table[side];if(!r||r.delivering)return;r.delivering=true;
  // Native completion frees its busy slot before JavaScript continuations may
  // issue the next request. The real adapters retain their own I/O charges
  // until their captured Promise handlers actually consume this settlement.
  table[side]=null;g.ioDeliveries++;if(kind==='write')r.bytes.fill(0);
  if(failed)r.deferred.reject(Error('INERT_CANCELLED'));else r.deferred.resolve(value);
  queueMicrotask(()=>{g.ioDeliveries--;schedule(g);maybeClosed(g);});
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
  start(pid,image,since){if(image!==INERT_RUNTIME.executable||since!==1n)throw Error('INERT_HOST');host=identity(pid,image,'1001');trace('host-start',{pid});return capability('owner',{root:host});},
  snapshot(owner){const captured=get(owner,'owner');return{active:1,root:member(captured.root),held:[],killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:false};},
  createPeerListeners(owner,controlPipe,historyPipe,commandPipe){get(owner,'owner');if(state.groups.length>=16||state.groups.filter(g=>!g.peerClosed).length>=8)throw Error('INERT_PAIR_BOUND');
   const sequence=++ownerSequence,g={sequence,id:null,root:identity(200+sequence,INERT_RUNTIME.executable),helper:identity(400+sequence,'C:\\SIREN\\helper.exe'),shell:null,watchedShell:null,captured:false,stopping:false,nativeExited:false,asyncPending:false,retiring:false,peerClosed:false,allowPeerClose:false,holdReadCancellation:false,pumpScheduled:false,connectionDeliveries:0,ioDeliveries:0,closeDeliveries:0,closeRequests:[],creatorStreams:{},lanes:{},creator:null,stop:null,host:owner};
   const names={control:controlPipe,history:historyPipe,command:commandPipe};
   for(const lane of LANES){const l={name:names[lane],accepted:false,connected:false,reads:{main:null,creator:null},writes:{main:null,creator:null},queues:{main:{parts:[],bytes:0},creator:{parts:[],bytes:0}},endpoints:{},acceptRequest:null,connectRequest:null};g.lanes[lane]=l;for(const side of SIDES)l.endpoints[side]=capability('endpoint',{group:g,lane,side});}
   state.groups.push(g);trace('listeners',{sequence});return capability('pair',{group:g});
  },
  createPeerSession(owner,executable,entry,directory,payload,pair){get(owner,'owner');const g=get(pair,'pair').group;
   if(executable!==INERT_RUNTIME.executable||entry!==INERT_RUNTIME.entry||directory!==INERT_RUNTIME.directory||payload.length>2048||payload.subarray(0,8).toString()!=='SIRENTB2')throw Error('INERT_CREATE');
   trace('create',{sequence:g.sequence,payloadBytes:payload.length});const session=capability('session',{group:g});g.session=session;
   installCreator(g,payload);if(options.createAmbiguous)throw Error('INERT_PRIVATE_CREATE_EXCEPTION');return session;
  },
  snapshotSession(session){const g=get(session,'session').group;if(g.asyncPending){state.snapshotDuringAsync++;throw Error('INERT_ASYNC_PENDING');}trace('snapshot-session',{sessionId:g.id});const result=snapshot(g);record.nativeSnapshots??=[];record.nativeSnapshots.push({method:'snapshotSession',sessionId:g.id,value:JSON.parse(JSON.stringify(result))});return result;},
  watchRoot(session,pid,image,since){const g=get(session,'session').group;if(g.asyncPending||!g.shell||g.shell.pid!==pid||g.shell.image!==image||BigInt(g.shell.createdFileTime)<since)throw Error('INERT_WATCH');g.watchedShell=g.shell;trace('watch',{sessionId:g.id});const s=snapshot(g);if(options.watchIdentityMismatch)s.shell.pid=999;record.nativeSnapshots??=[];record.nativeSnapshots.push({method:'watchRoot',sessionId:g.id,request:{pid,image,since:String(since)},value:JSON.parse(JSON.stringify(s))});return s;},
  captureSession(session){const g=get(session,'session').group;if(g.asyncPending||!g.watchedShell||g.captured)throw Error('INERT_CAPTURE');g.captured=true;trace('capture',{sessionId:g.id});const result=snapshot(g);record.nativeSnapshots??=[];record.nativeSnapshots.push({method:'captureSession',sessionId:g.id,value:JSON.parse(JSON.stringify(result))});return result;},
  acceptPeerLane(pair,lane,ms){const g=get(pair,'pair').group,l=pairLane(g,lane);if(g.retiring||l.acceptRequest)throw Error('INERT_ACCEPT');trace('accept',{sessionId:g.id,lane});l.acceptRequest=deferred();g.connectionDeliveries++;completePair(g,lane);return l.acceptRequest.promise;},
  connectPeerLane(witness,name,lane,ms){const g=get(witness,'witness').group,l=pairLane(g,lane);if(name!==l.name||g.retiring||l.connectRequest)throw Error('INERT_CONNECT');trace('connect',{sessionId:g.id,lane});l.connectRequest=deferred();g.connectionDeliveries++;completePair(g,lane);return l.connectRequest.promise;},
  closePeerWitness(witness){const g=get(witness,'witness').group;trace('witness-close',{sessionId:g.id});if(!LANES.every(l=>g.lanes[l].connected))retire(g);return true;},
  assertPeerCurrent(endpoint){const e=get(endpoint,'endpoint');if(!current(e))throw Error('INERT_ENDPOINT_STALE');return true;},
  peerSnapshot(endpoint){const e=get(endpoint,'endpoint'),g=e.group,l=g.lanes[e.lane],server=e.side==='main',r=l.reads[e.side],w=l.writes[e.side];
   const observation={pairOrdinal:g.sequence,lane:e.lane,server,connected:l.connected,retiring:g.retiring,settled:g.peerClosed,peer:{...member(server?g.root:main,!g.nativeExited),observedBeforeClose:false},mainPid:process.pid,creatorPid:g.root.pid,queriedPeerPid:server?g.root.pid:process.pid,nativeDirection:server?'client':'server',bothJobsChecked:server,commonJobMember:server?true:null,sessionJobMember:server?true:null,readPending:!!r,writePending:!!w,readReservedBytes:r?32768:0,writeReservedBytes:w?w.bytes.length:0,heldPeerClosed:g.peerClosed,generation:0,readIdleTimeout:false,nativeExecutionAdmitted:false};
   if(server&&e.lane==='control'&&options.sensitivity==='wrong-creator-pid'&&!record.peerSensitivity){const before=JSON.parse(JSON.stringify(observation));observation.creatorPid++;record.peerSensitivity={kind:'one-valid-PID-creatorPid',sameEndpoint:endpoint===g.lanes.control.endpoints.main,before,after:JSON.parse(JSON.stringify(observation))};trace('peer-identity-perturbed',{sessionId:g.id,lane:e.lane});}
   record.peerObservations??=[];record.peerObservations.push(JSON.parse(JSON.stringify(observation)));return observation;
  },
  peerRead(endpoint,ms){const e=get(endpoint,'endpoint'),l=e.group.lanes[e.lane];if(!current(e)||l.reads[e.side])throw Error('INERT_READ');const d=deferred();l.reads[e.side]={deferred:d,delivering:false};schedule(e.group);return d.promise;},
  peerWrite(endpoint,bytes,ms){const e=get(endpoint,'endpoint'),l=e.group.lanes[e.lane];if(!current(e)||l.writes[e.side]||bytes.length<1||bytes.length>(e.lane==='control'?2048:90120))throw Error('INERT_WRITE');const d=deferred();l.writes[e.side]={deferred:d,bytes:Buffer.from(bytes),offset:0,delivering:false};schedule(e.group);return d.promise;},
  closePeerEndpoint(endpoint,ms){const e=get(endpoint,'endpoint');trace('endpoint-close',{sessionId:e.group.id,lane:e.lane,side:e.side});return close(e.group);},
  closePeerListeners(pair,ms){const g=get(pair,'pair').group;trace('listeners-close',{sessionId:g.id});return close(g);},
  stopAndCloseSessionAsync(session,code,ms){const g=get(session,'session').group;if(g.stop||g.asyncPending)throw Error('INERT_DOUBLE_STOP');g.requestedStopCode=code;g.exitCode??=code;g.stop=deferred();g.asyncPending=true;g.stopping=true;trace('native-stop',{sessionId:g.id,code});retire(g);if(!options.manualNative)queueMicrotask(()=>completeNative(g));return g.stop.promise;},
 };
 function completeNative(g){
  if(!g.stop&&g.requestedHostCode===undefined)throw Error('NATIVE_EXIT_REQUEST_REQUIRED');
  if(!g.nativeExited){g.nativeExited=true;g.observedExitCode=g.exitCode??77;trace('native-settled',{sessionId:g.id,requestedStopCode:g.requestedStopCode??null,requestedHostCode:g.requestedHostCode??null,observedExitCode:g.observedExitCode});}
  g.asyncPending=false;
  if(g.stop&&!g.stopResolved){g.stopResolved=true;const value=snapshot(g,true);record.nativeExitObservations??=[];record.nativeExitObservations.push({sessionId:g.id,requestedStopCode:g.requestedStopCode,requestedHostCode:g.requestedHostCode??null,observedExitCode:value.root.exitCode,snapshot:JSON.parse(JSON.stringify(value))});g.stop.resolve({snapshot:value,closed:true});}
  finishHostOperations();
 }
 const base=baseNativeWorldFactory(runtime),hostOps=new Map();
 function finishHostOperations(){
  for(const cell of hostOps.values()){
   if(cell.settled||cell.peers.some(g=>!g.nativeExited||!g.peerClosed||pending(g).reads||pending(g).writes||g.connectionDeliveries||g.ioDeliveries||g.closeDeliveries))continue;
   cell.settled=true;const request=cell.request,root=cell.root,receipt={version:1,...request,snapshot:{active:0,root:member(root,false,request.code),held:[],killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false,stopping:true},closed:true,scope:'HOST_AND_EXACT_PEER_ROSTER_ONLY',sessionCleanupJoined:false,peers:cell.peers.map((g,index)=>({pairOrdinal:cell.pairOrdinals[index],nativeReaped:g.nativeExited,jsDeliveryVerified:g.peerClosed,tsfnFinalized:g.peerClosed}))};record.hostExitObservations??=[];record.hostExitObservations.push({request,snapshot:JSON.parse(JSON.stringify(receipt.snapshot)),peers:JSON.parse(JSON.stringify(receipt.peers))});trace('host-native-and-peer-settled',{shutdownId:request.shutdownId,peers:receipt.peers.length});cell.resolve(receipt);
  }
 }

 const ordinals=cap=>hostOps.get(cap)?.pairOrdinals??state.groups.filter(g=>g.host===cap).map(g=>g.sequence);
 const hostRoot=cap=>get(cap,'owner').root;
 Object.assign(native,{
  mark:()=>1n,
  stopAndCloseHostAsync(cap,code,deadlineMs,shutdownId){
   let cell=hostOps.get(cap);if(cell){if(cell.request.code!==code||cell.request.deadlineMs!==deadlineMs||cell.request.shutdownId!==shutdownId)throw Error('HOST_REQUEST_CONFLICT');return cell.promise;}
   const request=Object.freeze({code,deadlineMs,shutdownId}),root=hostRoot(cap),peers=Object.freeze(state.groups.filter(g=>g.host===cap));cell={request,root,peers,pairOrdinals:Object.freeze(peers.map(g=>g.sequence)),settled:false,...deferred()};hostOps.set(cap,cell);trace('host-stop',{shutdownId,code,nativePending:peers.filter(g=>!g.nativeExited).length,peerPending:peers.filter(g=>!g.peerClosed).length});
   for(const g of peers){g.requestedHostCode=code;g.exitCode??=code;retire(g);if(!options.manualNative)queueMicrotask(()=>completeNative(g));}
   finishHostOperations();return cell.promise;
  },
  captureHostShutdownPeerRoster:(cap,shutdownId)=>Object.freeze({version:1,shutdownId,scope:'HOST_ASYNC_CAPTURED_PEER_ROSTER',pairOrdinals:Object.freeze(ordinals(cap))}),
  captureHostShutdownExpectation:cap=>{const cell=hostOps.get(cap);return Object.freeze({request:cell?.request,root:hostRoot(cap),held:Object.freeze([]),pairOrdinals:Object.freeze(ordinals(cap))});}
 });
 const hostNames=['start','snapshot','createPeerListeners','createPeerSession','snapshotSession','watchRoot','captureSession','acceptPeerLane','peerRead','peerWrite','assertPeerCurrent','peerSnapshot','closePeerEndpoint','closePeerListeners','stopAndCloseSessionAsync','stopAndCloseHostAsync','captureHostShutdownPeerRoster','captureHostShutdownExpectation','mark'];
 const hostAddon=Object.fromEntries(hostNames.map(key=>[key,native[key]]));
 const session={state,releaseAll(){options.manualNative=false;options.manualPeerClose=false;for(const g of state.groups){g.holdReadCancellation=false;g.allowPeerClose=true;g.provider?.resolve(provider(g));schedule(g);if(g.stop||g.requestedHostCode!==undefined)completeNative(g);maybeClosed(g);}},group:id=>groups.get(id),pending:id=>pending(groups.get(id)),emitOutput(id,text){const g=groups.get(id);if(!g?.onData)throw Error('OUTPUT_SUBSCRIPTION_REQUIRED');g.onData(text);},completeNative:id=>completeNative(groups.get(id)),completePeers(id){const g=groups.get(id);g.allowPeerClose=true;maybeClosed(g);},holdReadCancellation(id){groups.get(id).holdReadCancellation=true;},releaseReads(){for(const g of state.groups){g.holdReadCancellation=false;schedule(g);}},releaseProvider(id){const g=groups.get(id);if(!g.provider)throw Error('PROVIDER_HOLD_REQUIRED');g.provider.resolve(provider(g));}};
 record.session=session;return {...base,host:hostAddon,session};
}
