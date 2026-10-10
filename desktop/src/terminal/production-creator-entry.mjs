// Inert resource runner for isolated production-composition qualification only.
// A fixed launcher created by the hosted guarded parent calls this explicitly.
// NOT a product admission or default application entry. Do not run locally.
// No argv/config/mailbox/environment field selects a resource or shell command.
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {release} from 'node:os';
import {readThreeLaneTerminalBootstrap} from './three-lane-bootstrap-reader.mjs';
import {createNativeThreeLaneStream} from './native-three-lane-stream.mjs';
import {createProductionCreator,requireProductionCreatorRuntime} from './production-creator.mjs';
import {loadProductionPtyProvider} from './production-provider-loader.mjs';
import {performance} from 'node:perf_hooks';

export async function runProductionCreatorEntry(...extra){
if(extra.length)throw Error('PRODUCTION_CREATOR_ENTRY_ARGUMENT_REFUSED');
// Native creator env intentionally has exactly seven minimal keys. GitHub CI
// eligibility is asserted by the guarded parent BEFORE launching this resource;
// the child must not pretend those stripped variables exist or inherit them.
requireProductionCreatorRuntime({platform:process.platform,arch:process.arch,electron:process.versions.electron,modules:process.versions.modules,napi:process.versions.napi,electronRunAsNode:process.env.ELECTRON_RUN_AS_NODE,windowsVersion:release()});
const expires=performance.now()+10000;

// These are pinned application resources, not the shell's cwd or a caller path.
// Final qualification/package provisioning must install this exact dedicated
// provider resource. There is deliberately no test-fixture/global fallback.
const require=createRequire(import.meta.url);
const native=require(fileURLToPath(new URL('../../native/terminal-creator-three-lane/build/Release/siren_terminal_creator_three_lane.node',import.meta.url)));
const endpoints=new Map(),method={};
for(const name of ['connectPeerLane','assertPeerCurrent']){const d=Object.getOwnPropertyDescriptor(native,name);if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function')throw Error('PRODUCTION_CREATOR_NATIVE_API_REFUSED');method[name]=d.value;}
if(performance.now()>=expires)throw Error('CREATOR_TIMEOUT');
const adopted=await readThreeLaneTerminalBootstrap(process.stdin,{native,timeoutMs:Math.min(5000,Math.max(1,Math.ceil(expires-performance.now())))});
let composer;
try{
 if(performance.now()>=expires)throw Error('CREATOR_TIMEOUT');
 composer=createProductionCreator({
  bootstrap:adopted,deadlineMs:Math.max(1,Math.ceil(expires-performance.now())),
  connectLane(q){
   return new Promise((resolve,reject)=>{
    let p;try{p=Reflect.apply(method.connectPeerLane,native,[q.witness,q.pipe,q.lane,q.deadlineMs]);}catch{reject(Error('CREATOR_CONNECT_REFUSED'));return;}
    Promise.prototype.then.call(p,endpoint=>{try{endpoints.set(q.lane,endpoint);resolve(createNativeThreeLaneStream({native,endpoint,lane:q.lane,deadlineMs:10000}));}catch{reject(Error('CREATOR_CONNECT_REFUSED'));}},()=>reject(Error('CREATOR_CONNECT_REFUSED')));
   });
  },
  assertEndpointsCurrent(){return endpoints.size===3&&['control','history','command'].every(lane=>Reflect.apply(method.assertPeerCurrent,native,[endpoints.get(lane)])===true);},
  loadPty(){
   // Invoked exclusively by the authenticated, prepared, current open-generation
   // startup-start path. Merely importing this entry does not load node-pty.
   return new Promise((resolve,reject)=>{
    try{
     const pty=loadProductionPtyProvider(),d=Object.getOwnPropertyDescriptor(pty,'spawn');if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function')throw Error();const spawn=d.value;
     resolve(Object.freeze({spawn(executable,args,options){
      const term=Reflect.apply(spawn,pty,[executable,args,options]);
      // Version-specific trusted provider normalization. The private agent
      // observation refuses winpty/the bundled DLL fallback before ready.
      if(term?._agent?._useConpty!==true||term?._agent?._useConptyDll!==false)throw Error('CREATOR_CONPTY_BACKEND_REFUSED');
      const pid=term.pid,write=term.write,resize=term.resize,onData=term.onData,onExit=term.onExit;
      if(![write,resize,onData,onExit].every(fn=>typeof fn==='function'))throw Error('CREATOR_PTY_API_REFUSED');
      return Object.freeze({pid,write:data=>Reflect.apply(write,term,[data]),resize:(cols,rows)=>Reflect.apply(resize,term,[cols,rows]),onData:listener=>Reflect.apply(onData,term,[listener]),onExit:listener=>Reflect.apply(onExit,term,[listener])});
     }}));
    }catch{reject(Error('CREATOR_PROVIDER_REFUSED'));}
   });
  },
  onUnavailable(){process.exitCode=91;}
 });
 if(await composer.ready!==true)throw Error('CREATOR_NOT_READY');
}catch{
 try{composer?.dispose();}catch{}
 try{adopted.dispose();}catch{}
 process.exitCode=91;
}
// No fixed command, timer-driven input, reconnect, keepalive or diagnostic file.
// Native Jobs and main-owned async Stop retain actual process cleanup authority.
return composer;
}
