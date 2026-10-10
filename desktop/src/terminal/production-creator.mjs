// Additive production composition candidate. Injected inert providers can test
// ordering; this module loads no native addon, PTY, process, filesystem or shell.
// The fixed hosted entry supplies those providers only in isolated qualification.
import {types} from 'node:util';
import {performance} from 'node:perf_hooks';
import {ProductionControlChannel} from './production-control-channel.mjs';
import {ProductionHistoryChannel,createProductionHistoryResponder} from './production-history-channel.mjs';
import {createProductionGateResponder} from './production-gate-link.mjs';
import {TerminalSessionCommandChannel} from './session-command-channel.mjs';
import {TerminalCreatorSession} from './creator-session.mjs';
import {TerminalCreatorHistory} from './remote-output.mjs';

const invoke=Reflect.apply,NativePromise=Promise,promisePrototype=Promise.prototype,then=promisePrototype.then;
const promiseConstructor=Object.getOwnPropertyDescriptor(promisePrototype,'constructor'),promiseSpecies=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
const clock=performance.now.bind(performance),bufferPrototype=Buffer.prototype,fill=Uint8Array.prototype.fill,set=Uint8Array.prototype.set;
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get;
const controlSend=ProductionControlChannel.prototype.send,controlSubscribe=ProductionControlChannel.prototype.subscribe,controlClose=ProductionControlChannel.prototype.dispose,controlAvailable=ProductionControlChannel.prototype.isAvailable;
const historyClose=ProductionHistoryChannel.prototype.dispose,historyAvailable=ProductionHistoryChannel.prototype.isAvailable;
const commandClose=TerminalSessionCommandChannel.prototype.dispose,commandAvailable=TerminalSessionCommandChannel.prototype.isAvailable;
const sessionDispose=TerminalCreatorSession.prototype.dispose,sessionApply=TerminalCreatorSession.prototype.applyGate,sessionStats=TerminalCreatorSession.prototype.stats;
const historyAppend=TerminalCreatorHistory.prototype.append,historyRead=TerminalCreatorHistory.prototype.read,historyStats=TerminalCreatorHistory.prototype.stats;
const LANES=Object.freeze(['control','history','command']),MAX_EVENT_UNITS=262144,SLICE_UNITS=8192;
const callable=v=>typeof v==='function'&&!types.isProxy(v),integer=v=>Number.isSafeInteger(v)&&v>=0;
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const refused=()=>TypeError('Bounded production creator DATA dependencies required');
function fields(value,keys,hidden=false){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
 const result=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d||!Object.hasOwn(d,'value')||(!hidden&&!d.enumerable))return null;result[k]=d.value;}return result;
}
function method(value,name){
 if(!value||typeof value!=='object'||types.isProxy(value))throw refused();
 for(let p=value;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))throw refused();const d=Object.getOwnPropertyDescriptor(p,name);if(d){if(!Object.hasOwn(d,'value')||!callable(d.value))throw refused();return d.value;}}throw refused();
}
function copyKey(value){
 if(types.isProxy(value)||!types.isUint8Array(value)||Object.getPrototypeOf(value)!==bufferPrototype)throw refused();
 if(invoke(byteLength,value,[])!==32)throw refused();const result=Buffer.alloc(32);invoke(set,result,[value]);return result;
}
function promised(value){
 const ctor=Object.getOwnPropertyDescriptor(promisePrototype,'constructor'),species=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
 if(!value||typeof value!=='object'||types.isProxy(value)||!types.isPromise(value)||Object.getPrototypeOf(value)!==promisePrototype||Object.hasOwn(value,'constructor')||!ctor||ctor.value!==promiseConstructor.value||ctor.get||ctor.set||!species||species.get!==promiseSpecies.get||species.set!==promiseSpecies.set||Object.hasOwn(species,'value'))throw refused();return value;
}
function bootstrapCopy(value){
 const owner=fields(value,['bootstrap','witness','dispose'],true);if(!owner||!callable(owner.dispose)||!owner.witness||typeof owner.witness!=='object'||types.isProxy(owner.witness))throw refused();
 const b=fields(owner.bootstrap,['sessionId','channelId','controlPipe','historyPipe','commandPipe','nativeExecutionAdmitted','controlSecret','historySecret','commandSecret','dispose'],true);
 if(!b||![b.sessionId,b.channelId].every(id)||b.nativeExecutionAdmitted!==false||!callable(b.dispose))throw refused();
 const names=[b.controlPipe,b.historyPipe,b.commandPipe];for(let i=0;i<3;i++){const prefix='\\\\.\\pipe\\siren-terminal-'+['control','data','command'][i]+'-';if(typeof names[i]!=='string'||!names[i].startsWith(prefix)||!/^[a-f0-9]{32}$/.test(names[i].slice(prefix.length)))throw refused();}
 const keys=[];try{for(const k of ['controlSecret','historySecret','commandSecret'])keys.push(copyKey(b[k]));}catch(e){for(const k of keys)invoke(fill,k,[0]);throw e;}
 if(keys.some(k=>!k.some(v=>v!==0))||keys[0].equals(keys[1])||keys[0].equals(keys[2])||keys[1].equals(keys[2])){for(const k of keys)invoke(fill,k,[0]);throw refused();}
 return{scope:Object.freeze({sessionId:b.sessionId,channelId:b.channelId}),names:Object.freeze(names),keys,witness:owner.witness,dispose:owner.dispose};
}

export const PRODUCTION_CREATOR_CANDIDATE_BRANCH='refs/heads/probe/terminal-production-backend-2026-10-09';
export function requireProductionCreatorRuntime(value,...extra){
 const r=fields(value,['platform','arch','electron','modules','napi','electronRunAsNode','windowsVersion']);
 const match=r&&typeof r.windowsVersion==='string'&&r.windowsVersion.length<=64&&/^10\.0\.(0|[1-9][0-9]*)$/.exec(r.windowsVersion),build=match?Number(match[1]):NaN;
 if(extra.length||!r||r.platform!=='win32'||r.arch!=='x64'||r.electron!=='44.5.1'||r.modules!=='149'||r.napi!=='10'||r.electronRunAsNode!=='1'||!integer(build)||build<18309||build>0xffffffff)throw Error('PRODUCTION_CREATOR_RUNTIME_REFUSED');return true;
}
/** Eligibility for the isolated candidate entry, never product admission. The
 * entry supplies actual process metadata; a pure test fixture cannot launch it.
 */
export function requireProductionCreatorQualification(value,...extra){
 const r=fields(value,['platform','arch','electron','modules','napi','electronRunAsNode','actions','runnerOs','ref','windowsVersion']);
 if(extra.length||!r||r.actions!=='true'||r.runnerOs!=='Windows'||r.ref!==PRODUCTION_CREATOR_CANDIDATE_BRANCH)throw Error('PRODUCTION_CREATOR_ISOLATED_WINDOWS_CI_ONLY');
 const {platform,arch,electron,modules,napi,electronRunAsNode,windowsVersion}=r;requireProductionCreatorRuntime({platform,arch,electron,modules,napi,electronRunAsNode,windowsVersion});return true;
}

/** One creator lifetime and one shell attempt. bootstrap is the already-adopted
 * readThreeLaneTerminalBootstrap result, never bytes or a second native consume.
 * connectLane(DATA{witness,pipe,lane,deadlineMs}) -> native Promise<stream>.
 * loadPty() -> native Promise<DATA{spawn}>; spawn is synchronous and returns
 * DATA{pid,write,resize,onData,onExit}. Entry normalizes the trusted provider.
 * ready resolves all-three native-provider/currentness/HMAC composition only;
 * shell readiness remains the typed startup-ready transaction on command lane.
 * Disposal fences and closes adapters; it NEVER proves process exit or refunds
 * pending native connection/write/read ownership. Main owns actual async Stop.
 */
export function createProductionCreator(options,...extra){
 if(extra.length||!options||typeof options!=='object'||types.isProxy(options))throw refused();
 const own=Reflect.ownKeys(options);if(own.some(k=>!['bootstrap','connectLane','assertEndpointsCurrent','loadPty','onUnavailable','deadlineMs','policy'].includes(k)))throw refused();
 const o=fields(options,own);if(!o||!['connectLane','assertEndpointsCurrent','loadPty','onUnavailable'].every(k=>callable(o[k])))throw refused();
 const deadline=o.deadlineMs===undefined?10000:o.deadlineMs;if(!integer(deadline)||deadline<1||deadline>10000)throw refused();
 const b=bootstrapCopy(o.bootstrap),expires=clock()+deadline;
 let closed=false,notified=false,disposedBootstrap=false,bootstrapDisposeOk=null,connectPending=0,unknownConnectReservations=0,providerPending=false,providerUnknown=false,spawnAttempts=0,shellExists=false,history=null,session=null,control=null,historyChannel=null,command=null,carry='',outputEvents=0,outputUnits=0,readyResolved=false,resolveReady,timer;
 const streams=new Map(),subscriptions=[];
 const ready=new NativePromise(resolve=>resolveReady=resolve);
 const settleReady=ok=>{if(!readyResolved){readyResolved=true;resolveReady(ok);}};
 const left=()=>Math.max(1,Math.ceil(expires-clock()));
 function wipeKeys(){for(const key of b.keys)invoke(fill,key,[0]);}
 function releaseBootstrap(){if(disposedBootstrap)return bootstrapDisposeOk;disposedBootstrap=true;try{bootstrapDisposeOk=invoke(b.dispose,undefined,[])===true;}catch{bootstrapDisposeOk=false;}b.witness=null;wipeKeys();return bootstrapDisposeOk;}
 function closeStream(record){try{invoke(record.destroy,record.stream,[]);}catch{}}
 function fence(code='CREATOR_UNAVAILABLE'){
  if(closed)return;closed=true;clearTimeout(timer);carry='';
  if(session)try{invoke(sessionDispose,session,[]);}catch{}
  // Claim once before invoking any external teardown callback.
  const notify=!notified;notified=true;if(notify)try{invoke(o.onUnavailable,undefined,[code]);}catch{}
  for(const sub of subscriptions.splice(0))try{invoke(sub.dispose,sub.receiver,[]);}catch{}
  for(const [channel,close]of[[control,controlClose],[historyChannel,historyClose],[command,commandClose]])if(channel)try{invoke(close,channel,[]);}catch{}
  for(const s of streams.values())closeStream(s);
  releaseBootstrap();settleReady(false);
 }
 function live(){if(closed)return false;if(clock()>=expires&&(!session||invoke(sessionStats,session,[]).startup.phase!=='ready')){fence('CREATOR_TIMEOUT');return false;}return !closed;}
 function current(){
  if(!live())return false;let ok=false;try{ok=invoke(o.assertEndpointsCurrent,undefined,[])===true;}catch{}
  if(!live())return false;if(!ok){fence('CREATOR_ENDPOINT_UNAVAILABLE');return false;}
  if(control&&(!invoke(controlAvailable,control,[])||!invoke(historyAvailable,historyChannel,[])||!invoke(commandAvailable,command,[]))){fence('CREATOR_CHANNEL_UNAVAILABLE');return false;}return !closed;
 }
 function registerSubscription(term,fn,callback){
  const result=invoke(fn,term,[callback]),s=fields(result,['dispose']);if(!s||!callable(s.dispose))throw refused();
  if(closed){try{invoke(s.dispose,result,[]);}catch{}throw refused();}subscriptions.push({receiver:result,dispose:s.dispose});
 }
 function appendOutput(data){
  if(closed)return;
  if(typeof data!=='string'||data.length>MAX_EVENT_UNITS){fence('CREATOR_OUTPUT_REFUSED');return;}
  outputEvents++;outputUnits+=data.length;
  if(carry){data=carry+data;carry='';}
  if(data.length&&data.charCodeAt(data.length-1)>=0xd800&&data.charCodeAt(data.length-1)<=0xdbff){carry=data.slice(-1);data=data.slice(0,-1);}
  if(!data.isWellFormed()){fence('CREATOR_OUTPUT_REFUSED');return;}
  for(let offset=0;offset<data.length&&!closed;){let end=Math.min(data.length,offset+SLICE_UNITS);if(end<data.length&&data.charCodeAt(end-1)>=0xd800&&data.charCodeAt(end-1)<=0xdbff)end--;const chunk=data.slice(offset,end);offset=end;const result=invoke(historyAppend,history,[chunk]);if(result.ok!==true){fence('CREATOR_OUTPUT_REFUSED');return;}}
 }
 function prepareShell(config){
  if(!live())return NativePromise.reject(refused());providerPending=true;
  return new NativePromise((resolve,reject)=>{
   let promise;try{promise=promised(invoke(o.loadPty,undefined,[]));}catch{providerUnknown=true;fence('CREATOR_PROVIDER_REFUSED');reject(refused());return;}
   invoke(then,promise,[value=>{
    providerPending=false;if(!live()){reject(refused());return;}
    const provider=fields(value,['spawn']);if(!provider||!callable(provider.spawn)){providerUnknown=true;fence('CREATOR_PROVIDER_REFUSED');reject(refused());return;}
    resolve(Object.freeze({spawn:()=>{
     // CreatorStartup performed the final endpoint/gate/lifetime check. No
     // additional external query or await is inserted before provider spawn.
     if(closed||spawnAttempts)throw refused();spawnAttempts++;providerUnknown=true;
     const opts=Object.freeze({cwd:config.cwd,env:config.shell.env,cols:config.cols,rows:config.rows,useConpty:true,useConptyDll:false,handleFlowControl:false});
     const raw=invoke(provider.spawn,undefined,[config.shell.executable,config.shell.args,opts]);shellExists=true;
     const term=fields(raw,['pid','write','resize','onData','onExit']);if(!term||!Number.isSafeInteger(term.pid)||term.pid<1||term.pid>0xffffffff||!['write','resize','onData','onExit'].every(k=>callable(term[k]))||closed)throw refused();
     registerSubscription(raw,term.onData,appendOutput);registerSubscription(raw,term.onExit,()=>fence('CREATOR_SHELL_EXITED'));if(closed)throw refused();providerUnknown=false;
     return Object.freeze({reportedShell:Object.freeze({pid:term.pid,image:config.shell.executable}),writeInput:data=>{if(closed)throw refused();return invoke(term.write,raw,[data]);},resize:(cols,rows)=>{if(closed)throw refused();return invoke(term.resize,raw,[cols,rows]);}});
    }}));
   },()=>{providerPending=false;providerUnknown=true;fence('CREATOR_PROVIDER_REFUSED');reject(refused());}]);
  });
 }
 function installChannels(){
  if(!live())return;
  try{
   if(invoke(o.assertEndpointsCurrent,undefined,[])!==true||!live())throw refused();
   control=new ProductionControlChannel({stream:streams.get('control').stream,role:'creator',channelId:b.scope.channelId,secret:b.keys[0],deadlineMs:left()});
   historyChannel=new ProductionHistoryChannel({stream:streams.get('history').stream,role:'creator',...b.scope,secret:b.keys[1],deadlineMs:left()});
   command=new TerminalSessionCommandChannel({stream:streams.get('command').stream,role:'creator',...b.scope,secret:b.keys[2],deadlineMs:left()});
   history=new TerminalCreatorHistory(b.scope.sessionId);
   session=new TerminalCreatorSession({channel:command,prepareShell,assertEndpointsCurrent:current,onUnavailable:code=>fence(code),deadlineMs:left(),...(o.policy===undefined?{}:{policy:o.policy})});
   const responder=createProductionGateResponder({channelId:b.scope.channelId,gate:{apply:p=>invoke(sessionApply,session,[p])},send:p=>{if(invoke(controlSend,control,[p])!==true)throw refused();}});
   invoke(controlSubscribe,control,[{message:responder,closed:()=>fence('CREATOR_CONTROL_UNAVAILABLE')}]);
   createProductionHistoryResponder({channel:historyChannel,history:{read:q=>invoke(historyRead,history,[q])}});
   if(!releaseBootstrap()||!live())throw refused();
   let pending=3;for(const channel of [control,historyChannel,command])invoke(then,promised(Object.getOwnPropertyDescriptor(channel,channel===command?'authenticated':'ready').value),[ok=>{if(ok!==true){fence('CREATOR_AUTHENTICATION_REFUSED');return;}if(--pending===0&&current())settleReady(true);},()=>fence('CREATOR_AUTHENTICATION_REFUSED')]);
  }catch{fence('CREATOR_SETUP_REFUSED');}
 }
 function connected(lane,stream){
  connectPending--;let record;
  try{record={stream,on:method(stream,'on'),destroy:method(stream,'destroy')};}catch{unknownConnectReservations++;fence('CREATOR_CONNECT_REFUSED');return;}
  if(closed){closeStream(record);return;}streams.set(lane,record);
  try{for(const event of ['end','close','error','timeout'])invoke(record.on,stream,[event,()=>fence('CREATOR_ENDPOINT_UNAVAILABLE')]);}catch{fence('CREATOR_CONNECT_REFUSED');return;}
  if(!live())return;if(streams.size===3)installChannels();
 }
 timer=setTimeout(()=>{if(!session||invoke(sessionStats,session,[]).startup.phase!=='ready')fence('CREATOR_TIMEOUT');},deadline);
 // Reserve all three actual attempts before invoking a provider; synchronous
 // rejection cannot cause replay or allocate additional connection attempts.
 connectPending=3;
 for(let i=0;i<3;i++){
  if(closed){connectPending--;continue;}
  try{const q=Object.freeze({witness:b.witness,pipe:b.names[i],lane:LANES[i],deadlineMs:left()});const p=promised(invoke(o.connectLane,undefined,[q]));invoke(then,p,[stream=>connected(LANES[i],stream),()=>{connectPending--;fence('CREATOR_CONNECT_REFUSED');}]);}
  catch{connectPending--;unknownConnectReservations++;fence('CREATOR_CONNECT_REFUSED');}
 }
 const handle={ready,dispose(){fence('CREATOR_RETIRED');return true;},stats(){return Object.freeze({nativeExecutionAdmitted:false,verifiedExited:false,retainedSessionReservation:1,closed,authenticated:readyResolved&&!closed,connectPending,unknownConnectReservations,connectedLanes:streams.size,bootstrapDisposed:disposedBootstrap,bootstrapDisposeOk,providerPending,providerUnknown,spawnAttempts,shellExists,outputEvents,outputCodeUnits:outputUnits,pendingSurrogateUnits:carry.length,maxOutputEventCodeUnits:MAX_EVENT_UNITS,maxOutputSliceCodeUnits:SLICE_UNITS,history:history?invoke(historyStats,history,[]):null,session:session?invoke(sessionStats,session,[]):null});},nativeExecutionAdmitted:false};
 return Object.freeze(handle);
}
