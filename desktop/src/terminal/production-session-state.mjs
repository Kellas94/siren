import {createHash,randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {TERMINAL_LIMITS as limits,validateTerminalRequest} from './contracts.mjs';

// Pure local session/input state for a FUTURE native manager. Registration is
// trusted native metadata, not process creation/adoption or a caller grant.
// No main/preload/host imports this module. A qualified host must recheck the
// generation immediately before PTY write and acknowledge its own Lock fence.
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const fail=(code,operationId)=>Object.freeze({ok:false,...(operationId===undefined?{}:{operationId}),code,message:code});
const pass=(value,operationId)=>Object.freeze({ok:true,...(operationId===undefined?{}:{operationId}),value:Object.freeze(value)});
const P=Promise,prototype=P.prototype,then=prototype.then,apply=Reflect.apply,species=Object.getOwnPropertyDescriptor(P,Symbol.species).get,microtask=queueMicrotask;
const resolved=v=>new P(resolve=>resolve(v));
function observable(v){const c=Object.getOwnPropertyDescriptor(prototype,'constructor'),s=Object.getOwnPropertyDescriptor(P,Symbol.species);return !!v&&typeof v==='object'&&!types.isProxy(v)&&types.isPromise(v)&&Object.getPrototypeOf(v)===prototype&&!Object.hasOwn(v,'constructor')&&c&&Object.hasOwn(c,'value')&&c.value===P&&s?.get===species&&!Object.hasOwn(s,'value');}
function synchronous(v){if(v===null||!['object','function'].includes(typeof v))return true;if(types.isProxy(v)||types.isPromise(v))return false;for(let p=v;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))return false;const d=Object.getOwnPropertyDescriptor(p,'then');if(d)return Object.hasOwn(d,'value')&&typeof d.value!=='function';}return true;}
function inputLifetime(sessionId){const c={retired:false,done:false,unknown:false,frames:0,workers:new Set(),resolve:null};c.handle=Object.freeze({sessionId,actualSettled:new P(resolve=>c.resolve=resolve),snapshot:()=>Object.freeze({sessionId,retired:c.retired,actualSettled:c.done,unknown:c.unknown,activeFrames:c.frames,pendingWrites:c.workers.size,nativeExecutionAdmitted:false})});return c;}
// Trusted main transport metadata only. A refusal marker never substitutes for
// a known write ACK; accessors/proxies/inherited or malformed markers are unknown.
function inputOutcome(value){
  if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return 'unknown';
  const accepted=Object.getOwnPropertyDescriptor(value,'accepted');
  if(!accepted?.enumerable||!Object.hasOwn(accepted,'value'))return 'unknown';
  if(accepted.value===true)return 'accepted';
  const keys=Reflect.ownKeys(value),known=Object.getOwnPropertyDescriptor(value,'knownRefused');
  return accepted.value===false&&keys.length===2&&keys.every(k=>k==='accepted'||k==='knownRefused')&&known?.enumerable&&Object.hasOwn(known,'value')&&known.value===true?'refused':'unknown';
}
export class TerminalProductionSessionLedger {
  #sessions=new Map();#closed=true;#generation=0;#write;#lifetimes=new Set();
  constructor({writeInput}={}){this.#write=typeof writeInput==='function'?writeInput:null;}
  get nativeExecutionAdmitted(){return false;}
  register({sessionId,projectId,profileId,cwdDisplay}={}){
    if(![sessionId,projectId,profileId].every(id)||typeof cwdDisplay!=='string'||!cwdDisplay.isWellFormed()||cwdDisplay.length>32768||this.#sessions.has(sessionId))return fail('REQUEST_REFUSED');
    if(this.#sessions.size>=limits.sessions||this.#lifetimes.size>=limits.sessions)return fail('CAPACITY_EXCEEDED');
    const s={sessionId,projectId,profileId,cwdDisplay,state:'running',exitCode:null,droppedUtf8Bytes:0,lease:null,queue:[],active:null,queuedBytes:0,inputUnverified:false,lifetime:inputLifetime(sessionId)};this.#sessions.set(sessionId,s);this.#lifetimes.add(s);return pass(this.#info(s));
  }
  captureLedgerSettlement(value,...extra){if(extra.length||!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;const keys=Reflect.ownKeys(value),d=Object.getOwnPropertyDescriptor(value,'sessionId');return keys.length===1&&keys[0]==='sessionId'&&d?.enumerable&&Object.hasOwn(d,'value')&&id(d.value)?this.#sessions.get(d.value)?.lifetime.handle??null:null;}
  captureLedgerSettlementRoster(...extra){return extra.length?null:Object.freeze([...this.#lifetimes].map(s=>s.lifetime.handle));}
  #actual(s){const c=s.lifetime;if(!c.done&&c.retired&&!c.unknown&&!c.frames&&!c.workers.size){c.done=true;const resolve=c.resolve;c.resolve=null;resolve(Object.freeze({scope:'LEDGER_SESSION_INPUT',sessionId:s.sessionId,actualSettled:true,nativeExecutionAdmitted:false}));}if(c.done)this.#lifetimes.delete(s);}
  #frame(s,run){s.lifetime.frames++;try{return run();}finally{s.lifetime.frames--;this.#actual(s);}}
  #info(s){return Object.freeze({sessionId:s.sessionId,projectId:s.projectId,profileId:s.profileId,cwdDisplay:s.cwdDisplay,state:s.state,exitCode:s.exitCode,droppedUtf8Bytes:s.droppedUtf8Bytes,attachedWindowId:s.lease?.windowId??null});}
  snapshot(){return Object.freeze([...this.#sessions.values()].map(s=>this.#info(s)));}
  #access(context,s){if(!s||!context||!id(context.projectId)||!id(context.windowId)||!integer(context.epoch)||context.projectId!==s.projectId)return 'SESSION_REFUSED';return null;}
  #live(s,context,p){
    const access=this.#access(context,s);if(access)return access;
    if(s.state!=='running'||s.inputUnverified||!this.#write)return 'HOST_UNAVAILABLE';
    if(this.#closed)return 'PIN_REQUIRED';
    if(context.epoch!==p.epoch||s.lease&&s.lease.epoch!==context.epoch)return 'EPOCH_STALE';
    if(!s.lease||s.lease.leaseId!==p.leaseId||s.lease.generation!==p.generation||s.lease.windowId!==context.windowId)return 'LEASE_STALE';return null;
  }
  attach(context,sessionId){
    const s=this.#sessions.get(sessionId),access=this.#access(context,s);if(access)return fail(access);
    if(s.state!=='running'||s.inputUnverified||!this.#write)return fail('HOST_UNAVAILABLE');if(this.#closed)return fail('PIN_REQUIRED');
    if(!integer(this.#generation+1))return fail('HOST_UNAVAILABLE');this.#revoke(s);
    s.lease={leaseId:randomUUID(),generation:++this.#generation,windowId:context.windowId,epoch:context.epoch,nextInput:0,receipts:new Map(),pending:new Map()};
    return pass({session:this.#info(s),leaseId:s.lease.leaseId,generation:s.lease.generation});
  }
  #revoke(s){s.lease=null;for(const e of s.queue.splice(0))this.#finish(s,e,fail('LEASE_STALE',e.payload.operationId));}
  closeInput(_reason){this.#closed=true;for(const s of this.#sessions.values())this.#frame(s,()=>this.#revoke(s));return Object.freeze({localInputFenced:true,hostAcknowledged:false});}
  resumeInput(){this.#closed=false;return Object.freeze({localInputFenced:false,hostAcknowledged:false});}
  detach(context,sessionId,lease){
    const s=this.#sessions.get(sessionId),error=this.#live(s,context,{...lease,epoch:context?.epoch});if(error)return fail(error);this.#revoke(s);return pass(this.#info(s));
  }
  input(context,payload){
    const validated=validateTerminalRequest('terminalInput',payload);if(!validated.ok)return resolved(fail('REQUEST_REFUSED'));
    const p=validated.payload,s=this.#sessions.get(p.sessionId),error=this.#live(s,context,p);if(error)return resolved(fail(error,p.operationId));
    const l=s.lease,hash=createHash('sha256').update(p.data,'utf8').digest('hex');
    const existing=l.pending.get(p.inputSequence)||l.receipts.get(p.inputSequence);
    if(existing){if(existing.hash!==hash)return resolved(fail('REQUEST_REFUSED',p.operationId));return existing.promise??resolved(existing.receipt);}
    if(p.inputSequence<l.nextInput)return resolved(fail('INPUT_RECEIPT_EXPIRED',p.operationId));
    if(p.inputSequence!==l.nextInput||!integer(l.nextInput+1))return resolved(fail('REQUEST_REFUSED',p.operationId));
    const bytes=Buffer.byteLength(p.data,'utf8');if(l.pending.size>=limits.inputReceipts||s.queuedBytes+bytes>limits.inputQueueBytes)return resolved(fail('CAPACITY_EXCEEDED',p.operationId));
    let resolve;const promise=new P(r=>resolve=r),e={payload:p,context:{...context},lease:l,hash,bytes,resolve,promise,done:false};
    return this.#frame(s,()=>{l.pending.set(p.inputSequence,e);l.nextInput++;s.queuedBytes+=bytes;s.queue.push(e);this.#pump(s);return promise;});
  }
  #finish(s,e,receipt){if(e.done)return;e.done=true;s.queuedBytes-=e.bytes;e.lease.pending.delete(e.payload.inputSequence);const resolve=e.resolve;e.resolve=null;resolve(receipt);}
  #failedWrite(s,e){if(e.done)return;s.inputUnverified=true;this.#revoke(s);this.#finish(s,e,fail('HOST_UNAVAILABLE',e.payload.operationId));}
  #consume(s,e,ack){
    if(e.done)return;
    const outcome=inputOutcome(ack);if(outcome==='refused'){if(s.lease===e.lease)this.#revoke(s);this.#finish(s,e,fail('LEASE_STALE',e.payload.operationId));return;}
    if(outcome!=='accepted'){this.#failedWrite(s,e);return;}
    const error=this.#live(s,e.context,e.payload),receipt=error?fail(error==='PIN_REQUIRED'?'LEASE_STALE':error,e.payload.operationId):pass({inputSequence:e.payload.inputSequence,accepted:true},e.payload.operationId);
    e.lease.receipts.set(e.payload.inputSequence,{hash:e.hash,receipt});while(e.lease.receipts.size>limits.inputReceipts)e.lease.receipts.delete(e.lease.receipts.keys().next().value);this.#finish(s,e,receipt);
  }
  #complete(s,cell){this.#frame(s,()=>{try{if(s.active===cell.entry)s.active=null;this.#pump(s);}finally{cell.original=null;cell.secondary=null;cell.entry=null;s.lifetime.workers.delete(cell);}});}
  #pump(s){
    if(s.active)return;const e=s.queue.shift();if(!e)return;
    const refused=this.#live(s,e.context,e.payload);if(refused){this.#finish(s,e,fail(refused,e.payload.operationId));this.#pump(s);return;}
    s.active=e;const cell={entry:e,original:null,secondary:null};s.lifetime.workers.add(cell);
    this.#frame(s,()=>{
      if(!observable(e.promise)){this.#failedWrite(s,e);this.#complete(s,cell);return;}
      try{
        cell.original=this.#write(Object.freeze({...e.payload}));
        if(!observable(cell.original)){
          if(!synchronous(cell.original))throw Error('UNOBSERVABLE_WRITE');
          const ack=cell.original;microtask(()=>{this.#frame(s,()=>{try{this.#consume(s,e,ack);}catch{this.#failedWrite(s,e);}finally{this.#complete(s,cell);}});});return;
        }
        cell.secondary=apply(then,cell.original,[ack=>{this.#frame(s,()=>{try{this.#consume(s,e,ack);}catch{this.#failedWrite(s,e);}finally{cell.original=null;}});},()=>{this.#frame(s,()=>{cell.original=null;this.#failedWrite(s,e);});}]);
        if(!observable(cell.secondary))throw Error('UNOBSERVABLE_WRITE_SECONDARY');
        const complete=()=>{this.#complete(s,cell);};apply(then,cell.secondary,[complete,complete]);
      }catch{s.lifetime.unknown=true;this.#failedWrite(s,e);}
    });
  }
  hostFailed(){for(const s of this.#sessions.values())this.#frame(s,()=>{s.lifetime.retired=true;s.state='host-failed';s.inputUnverified=true;this.#revoke(s);const active=s.active;s.active=null;if(active)this.#finish(s,active,fail('HOST_UNAVAILABLE',active.payload.operationId));});}
  // Main-only metadata transitions. Manager calls retire only after held-owner
  // close verification; these methods neither terminate nor qualify processes.
  fenceSession(sessionId){const s=this.#sessions.get(sessionId);if(!s)return fail('SESSION_REFUSED');return this.#frame(s,()=>{s.state='stopping';this.#revoke(s);return pass(this.#info(s));});}
  retire(sessionId){const s=this.#sessions.get(sessionId);if(!s)return fail('SESSION_REFUSED');return this.#frame(s,()=>{s.lifetime.retired=true;s.state='exited';this.#revoke(s);if(s.active){const e=s.active;s.active=null;this.#finish(s,e,fail('HOST_UNAVAILABLE',e.payload.operationId));}this.#sessions.delete(sessionId);return pass({sessionId});});}
  stats(sessionId){const s=this.#sessions.get(sessionId);if(!s)return null;return Object.freeze({queuedInputUtf8Bytes:s.queuedBytes,pendingInputs:(s.active&&!s.active.done?1:0)+s.queue.length,retainedInputReceipts:s.lease?.receipts.size??0,inputUnverified:s.inputUnverified});}
}
