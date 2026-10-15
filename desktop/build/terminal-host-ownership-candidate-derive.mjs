// Source-only derivation. Never load an addon or start a process.
import {createHash} from 'node:crypto';import {types} from 'node:util';
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get,apply=Reflect.apply;
export function deriveHostOwnershipCandidate(input,...extra){
 if(extra.length||!input||types.isProxy(input)||!types.isUint8Array(input)||apply(byteLength,input,[])!==40356)throw TypeError('HOST_OWNERSHIP_BASE_REFUSED');
 const bytes=new Uint8Array(40356);for(let i=0;i<bytes.length;i++)bytes[i]=input[i];
 if(createHash('sha256').update(bytes).digest('hex')!=='d5147e8d95f3e1bcfd18fa40faa33edcb62a684c9e6af284a79a2b062ccec4cc')throw TypeError('HOST_OWNERSHIP_BASE_REFUSED');
 let source=Buffer.from(bytes).toString('utf8').replaceAll('\r\n','\n');
 const replace=(a,b)=>{if(source.split(a).length!==2)throw Error('HOST_OWNERSHIP_PATCH_REFUSED');source=source.replace(a,b);};
 replace("import {TerminalSessionCleanup} from './session-cleanup.mjs';","import {TerminalSessionCleanup} from './session-cleanup.mjs';\nimport {captureHostAsyncOperationFactory} from './host-async-captured-operation.mjs';");
 replace('export class TerminalProductionOwnership {','export class TerminalHostCandidateOwnership {');
 replace("const PEER=['lane'","const PEER=['pairOrdinal','lane'");replace('if(!r||!p)return false;','if(!r||!p||!pid(r.pairOrdinal))return false;');
 replace(' #host=null;#sessions=', ' #hostFactory=null;#hostOperation=null;#hostLife=hostShutdownLifetime(this.#life);\n #host=null;#sessions=');
 replace('   const methods=Object.create(null);for(const name of METHODS)', '   this.#hostFactory=captureHostAsyncOperationFactory({native:p.native});\n   const methods=Object.create(null);for(const name of METHODS)');
 replace("h.cap=this.#cap(this.#call('start',[e.pid,e.image,e.since]));", "h.cap=this.#cap(this.#call('start',[e.pid,e.image,e.since]));this.#hostOperation=this.#hostFactory.bindHost(h.cap);this.#hostFactory=null;if(!this.#hostOperation)throw Error('HOST_BIND_REFUSED');");
 replace(" #finishOwnership(){const c=this.#life;if(c.done||!c.retired||c.unknown||c.frames||c.pending||c.sessions)return;c.done=true;this.#isCurrent=this.#onUnavailable=this.#onVerified=null;const resolve=c.resolve;c.resolve=null;resolve(frozen({scope:'OWNERSHIP_JS',actualSettled:true,hostNativeJoined:false,nativeExecutionAdmitted:false}));}",` #finishOwnership(){
  const c=this.#life;if(!c.done&&c.retired&&!c.unknown&&!c.frames&&!c.pending&&!c.sessions){c.done=true;this.#isCurrent=this.#onUnavailable=this.#onVerified=null;const resolve=c.resolve;c.resolve=null;resolve(frozen({scope:'OWNERSHIP_JS',actualSettled:true,hostNativeJoined:false,nativeExecutionAdmitted:false}));}
  this.#launchHostShutdown();this.#finishHostShutdown();
 }
 captureHostShutdownSettlement(...extra){return extra.length?null:this.#hostLife.handle;}
 beginHostShutdown(value,...extra){
  const r=!extra.length&&hostShutdownRequest(value),c=this.#hostLife;if(!r)return null;
  if(c.request)return c.request.code===r.code&&c.request.deadlineMs===r.deadlineMs&&c.request.shutdownId===r.shutdownId?c.handle.actualSettled:null;
  if(!this.#hostOperation)return null;
  return this.#globalFrame(()=>{c.request=r;this.#life.retired=true;for(const session of this.#actualSessions)session.fenced=true;this.#finishOwnership();return c.handle.actualSettled;});
 }
 #launchHostShutdown(){
  const c=this.#hostLife;if(!c.request||c.launched||!this.#life.done||this.#life.frames||this.#life.pending||this.#life.sessions||this.#life.unknown)return;
  c.launched=true;c.inner=this.#hostOperation.captureSettlement();c.pending=1;
  try{
   const observer=apply(then,c.inner.actualSettled,[()=>this.#globalFrame(()=>{c.matched=true;}),()=>this.#globalFrame(()=>{c.unknown=true;})]);
   if(!nativePromise(observer))throw Error('HOST_JOIN_OBSERVER_UNKNOWN');
   apply(then,observer,[()=>this.#globalFrame(()=>{c.pending--;}),()=>this.#globalFrame(()=>{c.unknown=true;})]);
   if(this.#hostOperation.start(c.request)===null)c.unknown=true;
  }catch{c.unknown=true;}
 }
 #finishHostShutdown(){
  const c=this.#hostLife;if(c.done||!c.matched||c.unknown||c.pending||this.#life.frames||!this.#life.done)return;
  c.done=true;c.inner=null;this.#hostOperation=this.#hostFactory=this.#native=this.#methods=null;if(this.#host)this.#host.cap=null;this.#sessions.clear();this.#caps=new WeakSet();
  const resolve=c.resolve;c.resolve=null;resolve(c.handle.snapshot());
 }`);
 replace('function opaque(value){',`function hostShutdownRequest(value){const r=record(value,['code','deadlineMs','shutdownId']);return r&&[77,98].includes(r.code)&&deadline(r.deadlineMs)&&typeof r.shutdownId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(r.shutdownId)?frozen(r):null;}
function hostShutdownLifetime(ownership){
 const c={request:null,launched:false,matched:false,unknown:false,pending:0,done:false,inner:null,resolve:null};
 c.handle=frozen({actualSettled:new NativePromise(resolve=>c.resolve=resolve),snapshot:(...extra)=>extra.length?null:frozen({scope:'OWNERSHIP_AND_CAPTURED_HOST_JS',requested:!!c.request,hostStarted:c.launched,ownershipJsSettled:ownership.done,hostOperationJsSettled:c.matched,actualSettled:c.done,unknown:c.unknown||ownership.unknown||!!c.inner?.snapshot().unknown,pendingCallbacks:c.pending,hostNativeJoined:false,sessionCleanupJoined:false,rosterAuthorityEstablished:false,nativeExecutionAdmitted:false})});return c;
}
function opaque(value){`);
 return '// Derived isolated candidate; legacy production/default remains unchanged. SOURCE_ONLY, unwired.\n'+source;
}
