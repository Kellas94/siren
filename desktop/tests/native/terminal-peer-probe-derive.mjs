// Pure pinned source derivation. Never import or execute generated entrypoints.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const RUNNER='c38cb94d2675fc7685367266e3db5bc911e009ea9ee52d88196ff7b7dab71c57';
const WORKER='4832c3c65b3073af4a92f5e0b8d22abf2fdf4307ee4c4798fc866bfc9875b91b';
// Diagnostic-only DATA classification. Serialized into the guarded functions;
// no arbitrary message, stack, input bytes or witness enters a receipt.
export function classifyPeerDiagnosticError(error,isProxy){
 const codes=['ERR_MODULE_NOT_FOUND','ERR_DLOPEN_FAILED','ERR_INVALID_ARG_TYPE','ERR_INVALID_MODULE_SPECIFIER','ERR_ASSERTION','ERR_INVALID_PACKAGE_CONFIG','ERR_UNKNOWN_FILE_EXTENSION','ERR_UNSUPPORTED_DIR_IMPORT','ERR_REQUIRE_ESM','ENOENT','EACCES','EPERM','ENOSPC',
  'TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED','TERMINAL_PEER_BOOTSTRAP_REFUSED','TERMINAL_PEER_BOOTSTRAP_TIMEOUT','NATIVE_PEER_STREAM_UNAVAILABLE','PEER_DIAGNOSTIC_BOUND','PEER_DIAGNOSTIC_STAGE','PEER_DIAGNOSTIC_CALLBACK_REFUSED',
  'PEER_ACCEPT_REFUSED','PEER_BIND_REFUSED','PEER_BOOTSTRAP_REFUSED','PEER_CAPABILITY_CLOSED','PEER_CAPABILITY_FINALIZED','PEER_CAPABILITY_REFUSED','PEER_CAPACITY_REFUSED','PEER_CLOSE_CAPACITY','PEER_CONNECT_FAILED','PEER_CONNECT_REFUSED','PEER_DACL_FAILED','PEER_DEADLINE','PEER_ENDPOINT_STALE','PEER_ENVIRONMENT_CLOSING','PEER_ENVIRONMENT_UNAVAILABLE','PEER_EOF','PEER_EVENT_FAILED','PEER_EXPLICIT_CLOSE','PEER_HOST_UNAVAILABLE','PEER_IDENTITY_DUPLICATE_FAILED','PEER_IDENTITY_LOST','PEER_IDENTITY_REFUSED','PEER_LISTENER_CREATE_FAILED','PEER_MAIN_IDENTITY_FAILED','PEER_NAME_REFUSED','PEER_NAPI_FAILURE','PEER_OWNER_RETIRED','PEER_PARTIAL_WRITE','PEER_PROCESS_EXITED','PEER_READ_BUSY','PEER_READ_FAILED','PEER_READ_LIMIT','PEER_REQUEST_CAPACITY','PEER_REQUEST_REFUSED','PEER_RETIRED','PEER_SESSION_RETIRED','PEER_STALE_COMPLETION','PEER_STARTUP_ABORTED','PEER_STARTUP_DEADLINE','PEER_STARTUP_REFUSED','PEER_THREAD_FAILED','PEER_TSFN_FAILED','PEER_WAIT_FAILED','PEER_WITNESS_CLOSE_FAILED','PEER_WITNESS_CLOSED','PEER_WITNESS_DUPLICATE_FAILED','PEER_WITNESS_REFUSED','PEER_WRITE_CAPACITY','PEER_WRITE_FAILED','PEER_WRITE_REFUSED'];
 const names=['Error','TypeError','RangeError','SyntaxError','ReferenceError','AssertionError','AggregateError'];
 const result={code:'UNKNOWN',name:'Error'};
 if(!error||typeof error!=='object'||isProxy(error))return result;
 for(const key of ['code','message']){
  const descriptor=Object.getOwnPropertyDescriptor(error,key);
  if(descriptor&&Object.hasOwn(descriptor,'value')){const code=codes.find(value=>value===descriptor.value);if(code){result.code=code;break;}}
 }
 let object=error;
 for(let depth=0;object&&depth<4;depth++){
  if(isProxy(object))break;
  const descriptor=Object.getOwnPropertyDescriptor(object,'name');
  if(descriptor){if(Object.hasOwn(descriptor,'value'))result.name=names.find(value=>value===descriptor.value)??'Error';break;}
  object=Object.getPrototypeOf(object);
 }
 return result;
}
export function wrapPeerBootstrapDiagnostics(native,record,classifyError,isProxy){
 const refuse=()=>{throw Error('PEER_DIAGNOSTIC_CALLBACK_REFUSED');};
 if(!native||typeof native!=='object'||isProxy(native))return refuse();
 const methods=Object.create(null);
 for(const name of ['consumePeerBootstrap','closePeerWitness']){
  const descriptor=Object.getOwnPropertyDescriptor(native,name);
  if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof descriptor.value!=='function'||isProxy(descriptor.value))return refuse();
  methods[name]=descriptor.value;
 }
 return Object.freeze({
  consumePeerBootstrap(buffer){try{return Reflect.apply(methods.consumePeerBootstrap,native,[buffer]);}catch(error){record.consumeFailure=classifyError(error,isProxy);throw error;}},
  closePeerWitness(witness){return Reflect.apply(methods.closePeerWitness,native,[witness]);},
 });
}
function once(source,old,next){assert.equal(source.split(old).length,2,'PEER_PROBE_ANCHOR_DRIFT');return source.replace(old,()=>next);}
function section(source,start,end,next){
 assert.equal(source.split(start).length,2,'PEER_PROBE_ANCHOR_DRIFT');assert.equal(source.split(end).length,2,'PEER_PROBE_ANCHOR_DRIFT');
 const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(to>from,'PEER_PROBE_ANCHOR_DRIFT');return once(source,source.slice(from,to),next);
}
export function deriveTerminalPeerProbe({runner,worker}){
 assert.equal(hash(runner),RUNNER,'PEER_PROBE_INPUT_DRIFT');assert.equal(hash(worker),WORKER,'PEER_PROBE_INPUT_DRIFT');
 runner=once(runner,'// Guarded, finite hosted normal-shell experiment. Never product admission.','// Guarded, finite hosted native peer experiment derived from the normal fixture. Never product admission.');
 runner=once(runner,"from './terminal-normal-powershell-contract.mjs'","from './terminal-peer-endpoints-contract.mjs'");
 runner=once(runner,"'evidence/terminal-normal-powershell-observation'","'evidence/terminal-peer-endpoints-observation'");
 runner=section(runner,'async function creator(worker,reader){','async function main(config){',`async function creator(worker,reader,addon){
 const {writeFile,rename}=await import('node:fs/promises'),{join}=await import('node:path'),{types}=await import('node:util');
 const stages=['addon-loaded','bootstrap-read','worker-imported','worker-entered','control-connected','history-connected'];
 const diagnostic={schema:1,diagnosticOnly:true,admitted:false,stages:[],failure:null,consumeFailure:null},path=join(process.argv[2],'peer-creator-diagnostic.json');
 const classifyError=${classifyPeerDiagnosticError.toString()},wrapBootstrap=${wrapPeerBootstrapDiagnostics.toString()};
 const persist=async()=>{const body=JSON.stringify(diagnostic);if(Buffer.byteLength(body,'utf8')>=4096)throw Error('PEER_DIAGNOSTIC_BOUND');await writeFile(path+'.pending',body,{encoding:'utf8',flag:'w'});await rename(path+'.pending',path);};
 const mark=async stage=>{if(stage!==stages[diagnostic.stages.length])throw Error('PEER_DIAGNOSTIC_STAGE');diagnostic.stages.push(stage);await persist();};
 let packet;
 try{
  const {createRequire}=await import('node:module'),native=createRequire(import.meta.url)(addon);await mark('addon-loaded');
  const bootstrapNative=wrapBootstrap(native,diagnostic,classifyError,types.isProxy);
  const {readPeerTerminalBootstrap}=await import(reader);packet=await readPeerTerminalBootstrap(process.stdin,{native:bootstrapNative,timeoutMs:1000});await mark('bootstrap-read');
  const {runPeerWorker}=await import(worker);await mark('worker-imported');await runPeerWorker(packet.bootstrap,process.argv[2],{native,witness:packet.witness,diagnostic:mark});
 }catch(error){diagnostic.failure=classifyError(error,types.isProxy);try{await persist();}catch{}throw error;}finally{packet?.dispose();}
}
`);
 runner=once(runner,",net=(await import('node:net')).default",'');
 runner=once(runner," app.setPath('userData'",` const {createNativePeerStream}=await import(config.modules.peerStream),{types}=await import('node:util');
 const classifyError=${classifyPeerDiagnosticError.toString()};
 app.setPath('userData'`);
 runner=once(runner,'let host,hostOwner,owner,sessionClosed=false,hostClosed=false,packet,control,historyChannel;const listeners=[];',
  'let host,hostOwner,owner,sessionClosed=false,hostClosed=false,packet,control,historyChannel,pair,pairClosed=false,controlEndpoint,historyEndpoint,controlSocket,historySocket,controlKey,historyKey;');
 runner=once(runner,'const controlKey=Buffer.from(packet.controlSecret),historyKey=Buffer.from(packet.dataSecret);','controlKey=Buffer.from(packet.controlSecret);historyKey=Buffer.from(packet.dataSecret);');
 runner=section(runner,'  // Wait for each listener before creating its contained connector. Accept at','  const ledger=',`  // Native listener creation and creator binding precede endpoint acquisition.
  // HMAC runs only through native endpoints that already checked both peers.
  pair=native.createPeerListeners(hostOwner,packet.controlPipe,packet.dataPipe);
  const creatorMark=native.mark();try{owner=native.createPeerSession(hostOwner,config.electron,config.creator,directory,packet.payload,pair);}finally{packet.dispose();}
  const accepted=await Promise.allSettled([Promise.resolve().then(()=>native.acceptPeerLane(pair,'control',2500)),Promise.resolve().then(()=>native.acceptPeerLane(pair,'history',2500))]);
  if(accepted[0].status==='fulfilled')controlEndpoint=accepted[0].value;
  if(accepted[1].status==='fulfilled')historyEndpoint=accepted[1].value;
  result.nativePeerAccept=accepted.map((outcome,index)=>({lane:['control','history'][index],status:outcome.status,error:outcome.status==='rejected'?classifyError(outcome.reason,types.isProxy):null}));
  assert.ok(accepted.every(value=>value.status==='fulfilled'),'NORMAL_CHANNEL_CONNECTION');
  controlSocket=createNativePeerStream({native,endpoint:controlEndpoint,lane:'control',deadlineMs:2500});
  historySocket=createNativePeerStream({native,endpoint:historyEndpoint,lane:'history',deadlineMs:2500});
  try{control=new TerminalControlChannel({stream:controlSocket,role:'main',channelId:packet.channelId,secret:controlKey,deadlineMs:2500});}finally{controlKey.fill(0);}
  try{historyChannel=new TerminalHistoryChannel({stream:historySocket,role:'main',channelId:packet.channelId,sessionId:packet.sessionId,secret:historyKey,deadlineMs:2500});}finally{historyKey.fill(0);}
`);
 runner=once(runner,'  assert.equal(await control.ready,true);assert.equal(await historyChannel.ready,true);',
  "  assert.equal(await control.ready,true);assert.equal(await historyChannel.ready,true);\n  result.nativePeer={control:native.peerSnapshot(controlEndpoint),history:native.peerSnapshot(historyEndpoint),close:{control:null,history:null,listeners:null}};");
 runner=once(runner,'  const start=performance.now();let ticks=0,last=start,maxGapMs=0;',`  // Lock above retained both lanes for completion and replay. Explicit Stop
  // starts only after both adapter operation ledgers and native listeners drain.
  control.dispose();historyChannel.dispose();controlSocket.destroy();historySocket.destroy();
  result.nativePeer.close.control=await controlSocket.closed;
  result.nativePeer.close.history=await historySocket.closed;
  result.nativePeer.close.listeners=await native.closePeerListeners(pair,3000);pairClosed=result.nativePeer.close.listeners===true;
  assert.deepEqual(result.nativePeer.close,{control:true,history:true,listeners:true});
  const start=performance.now();let ticks=0,last=start,maxGapMs=0;`);
 runner=once(runner,'  packet?.dispose();for(const dispose of listeners)dispose();control?.dispose();historyChannel?.dispose();',`  packet?.dispose();controlKey?.fill(0);historyKey?.fill(0);control?.dispose();historyChannel?.dispose();controlSocket?.destroy();historySocket?.destroy();
  if(pair&&!pairClosed)try{
   const close={control:controlSocket?await controlSocket.closed:null,history:historySocket?await historySocket.closed:null,listeners:null};result.nativePeerCleanup=close;
   close.listeners=await native.closePeerListeners(pair,3000);pairClosed=close.listeners===true;
   assert.equal(close.listeners,true);if(controlSocket)assert.equal(close.control,true);if(historySocket)assert.equal(close.history,true);
  }catch(e){result.nativePeerCleanupError=String(e.stack??e);result.status='FAILED';}`);
 runner=once(runner,"modules.probe=pathToFileURL(join(desktop,'tests/native/terminal-normal-probe-core.mjs')).href;", "modules.probe=pathToFileURL(join(desktop,'tests/native/terminal-normal-probe-core.mjs')).href;modules.peerStream=pathToFileURL(join(desktop,'src/terminal/native-peer-stream.mjs')).href;");
 runner=once(runner,"await writeFile(creatorEntry,`void (${creator.toString()})(${JSON.stringify(pathToFileURL(join(desktop,'tests/native/terminal-normal-worker.mjs')).href)},${JSON.stringify(pathToFileURL(join(desktop,'src/terminal/bootstrap-reader.mjs')).href)});`,{flag:'wx'});", "await writeFile(creatorEntry,`void (${creator.toString()})(${JSON.stringify(pathToFileURL(join(desktop,'tests/native/terminal-peer-worker.mjs')).href)},${JSON.stringify(pathToFileURL(join(desktop,'src/terminal/peer-bootstrap-reader.mjs')).href)},${JSON.stringify(addon)});`,{flag:'wx'});");

 worker=once(worker,'// Fixed CI worker only. Root invokes it only after native contained bootstrap.','// Fixed CI peer worker only. Native witness and endpoint checks precede HMAC.');
 worker=once(worker,"import net from 'node:net';\nimport {once} from 'node:events';", "import {createNativePeerStream} from '../../src/terminal/native-peer-stream.mjs';");
 worker=once(worker,'export async function runNormalWorker(bootstrap,directory){',"export async function runPeerWorker(bootstrap,directory,peer){\n await peer.diagnostic('worker-entered');");
 worker=section(worker,' const connect=async name=>',' const control=new TerminalControlChannel',` const native=peer.native;
 const controlEndpoint=await native.connectPeerLane(peer.witness,bootstrap.controlPipe,'control',2500);await peer.diagnostic('control-connected');
 const historyEndpoint=await native.connectPeerLane(peer.witness,bootstrap.dataPipe,'history',2500);await peer.diagnostic('history-connected');
 const controlSocket=createNativePeerStream({native,endpoint:controlEndpoint,lane:'control',deadlineMs:2500}),historySocket=createNativePeerStream({native,endpoint:historyEndpoint,lane:'history',deadlineMs:2500});
`);
 worker=once(worker,'initial:probe.snapshot()});','initial:probe.snapshot(),nativePeer:{control:native.peerSnapshot(controlEndpoint),history:native.peerSnapshot(historyEndpoint),streams:{control:controlSocket.stats(),history:historySocket.stats()},nativeExecutionAdmitted:false}});');
 return {runner,worker,nativeExecuted:false,admitted:false};
}
