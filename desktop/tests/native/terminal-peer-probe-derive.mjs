// Pure pinned source derivation. Never import or execute generated entrypoints.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const RUNNER='c38cb94d2675fc7685367266e3db5bc911e009ea9ee52d88196ff7b7dab71c57';
const WORKER='4832c3c65b3073af4a92f5e0b8d22abf2fdf4307ee4c4798fc866bfc9875b91b';
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
 const {createRequire}=await import('node:module'),native=createRequire(import.meta.url)(addon);
 const {readPeerTerminalBootstrap}=await import(reader);const packet=await readPeerTerminalBootstrap(process.stdin,{native,timeoutMs:1000});
 try{const {runPeerWorker}=await import(worker);await runPeerWorker(packet.bootstrap,process.argv[2],{native,witness:packet.witness});}finally{packet.dispose();}
}
`);
 runner=once(runner,",net=(await import('node:net')).default",'');
 runner=once(runner," app.setPath('userData'"," const {createNativePeerStream}=await import(config.modules.peerStream);\n app.setPath('userData'");
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
 worker=once(worker,'export async function runNormalWorker(bootstrap,directory){','export async function runPeerWorker(bootstrap,directory,peer){');
 worker=section(worker,' const connect=async name=>',' const control=new TerminalControlChannel',` const native=peer.native;
 const controlEndpoint=await native.connectPeerLane(peer.witness,bootstrap.controlPipe,'control',2500),historyEndpoint=await native.connectPeerLane(peer.witness,bootstrap.dataPipe,'history',2500);
 const controlSocket=createNativePeerStream({native,endpoint:controlEndpoint,lane:'control',deadlineMs:2500}),historySocket=createNativePeerStream({native,endpoint:historyEndpoint,lane:'history',deadlineMs:2500});
`);
 worker=once(worker,'initial:probe.snapshot()});','initial:probe.snapshot(),nativePeer:{control:native.peerSnapshot(controlEndpoint),history:native.peerSnapshot(historyEndpoint),streams:{control:controlSocket.stats(),history:historySocket.stats()},nativeExecutionAdmitted:false}});');
 return {runner,worker,nativeExecuted:false,admitted:false};
}
