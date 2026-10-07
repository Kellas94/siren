import {createHash,randomUUID} from 'node:crypto';
import {TERMINAL_LIMITS as limits,validateTerminalRequest} from './contracts.mjs';

// Pure local session/input state for a FUTURE native manager. Registration is
// trusted native metadata, not process creation/adoption or a caller grant.
// No main/preload/host imports this module. A qualified host must recheck the
// generation immediately before PTY write and acknowledge its own Lock fence.
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const fail=(code,operationId)=>Object.freeze({ok:false,...(operationId===undefined?{}:{operationId}),code,message:code});
const pass=(value,operationId)=>Object.freeze({ok:true,...(operationId===undefined?{}:{operationId}),value:Object.freeze(value)});
export class TerminalSessionLedger {
  #sessions=new Map();#closed=true;#generation=0;#write;
  constructor({writeInput}={}){this.#write=typeof writeInput==='function'?writeInput:null;}
  get nativeExecutionAdmitted(){return false;}
  register({sessionId,projectId,profileId,cwdDisplay}={}){
    if(![sessionId,projectId,profileId].every(id)||typeof cwdDisplay!=='string'||!cwdDisplay.isWellFormed()||cwdDisplay.length>32768||this.#sessions.has(sessionId))return fail('REQUEST_REFUSED');
    if(this.#sessions.size>=limits.sessions)return fail('CAPACITY_EXCEEDED');
    const s={sessionId,projectId,profileId,cwdDisplay,state:'running',exitCode:null,droppedUtf8Bytes:0,lease:null,queue:[],active:null,queuedBytes:0,inputUnverified:false};this.#sessions.set(sessionId,s);return pass(this.#info(s));
  }
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
  closeInput(_reason){this.#closed=true;for(const s of this.#sessions.values())this.#revoke(s);return Object.freeze({localInputFenced:true,hostAcknowledged:false});}
  resumeInput(){this.#closed=false;return Object.freeze({localInputFenced:false,hostAcknowledged:false});}
  detach(context,sessionId,lease){
    const s=this.#sessions.get(sessionId),error=this.#live(s,context,{...lease,epoch:context?.epoch});if(error)return fail(error);this.#revoke(s);return pass(this.#info(s));
  }
  input(context,payload){
    const validated=validateTerminalRequest('terminalInput',payload);if(!validated.ok)return Promise.resolve(fail('REQUEST_REFUSED'));
    const p=validated.payload,s=this.#sessions.get(p.sessionId),error=this.#live(s,context,p);if(error)return Promise.resolve(fail(error,p.operationId));
    const l=s.lease,hash=createHash('sha256').update(p.data,'utf8').digest('hex');
    const existing=l.pending.get(p.inputSequence)||l.receipts.get(p.inputSequence);
    if(existing){if(existing.hash!==hash)return Promise.resolve(fail('REQUEST_REFUSED',p.operationId));return existing.promise??Promise.resolve(existing.receipt);}
    if(p.inputSequence<l.nextInput)return Promise.resolve(fail('INPUT_RECEIPT_EXPIRED',p.operationId));
    if(p.inputSequence!==l.nextInput||!integer(l.nextInput+1))return Promise.resolve(fail('REQUEST_REFUSED',p.operationId));
    const bytes=Buffer.byteLength(p.data,'utf8');if(l.pending.size>=limits.inputReceipts||s.queuedBytes+bytes>limits.inputQueueBytes)return Promise.resolve(fail('CAPACITY_EXCEEDED',p.operationId));
    let resolve;const promise=new Promise(r=>resolve=r),e={payload:p,context:{...context},lease:l,hash,bytes,resolve,promise,done:false};
    l.pending.set(p.inputSequence,e);l.nextInput++;s.queuedBytes+=bytes;s.queue.push(e);this.#pump(s);return promise;
  }
  #finish(s,e,receipt){if(e.done)return;e.done=true;s.queuedBytes-=e.bytes;e.lease.pending.delete(e.payload.inputSequence);e.resolve(receipt);}
  #pump(s){
    if(s.active)return;const e=s.queue.shift();if(!e)return;
    const refused=this.#live(s,e.context,e.payload);if(refused){this.#finish(s,e,fail(refused,e.payload.operationId));this.#pump(s);return;}
    s.active=e;
    let result;try{result=this.#write(Object.freeze({...e.payload}));}catch{result=Promise.reject(new Error('INPUT_TRANSPORT_FAILED'));}
    Promise.resolve(result).then(ack=>{
      if(e.done)return; // Known host loss already settled this ambiguous write.
      if(ack?.accepted!==true)throw new Error('INPUT_ACCEPTANCE_UNKNOWN');
      const error=this.#live(s,e.context,e.payload),receipt=error?fail(error==='PIN_REQUIRED'?'LEASE_STALE':error,e.payload.operationId):pass({inputSequence:e.payload.inputSequence,accepted:true},e.payload.operationId);
      e.lease.receipts.set(e.payload.inputSequence,{hash:e.hash,receipt});while(e.lease.receipts.size>limits.inputReceipts)e.lease.receipts.delete(e.lease.receipts.keys().next().value);
      this.#finish(s,e,receipt);
    }).catch(()=>{if(e.done)return;s.inputUnverified=true;this.#revoke(s);this.#finish(s,e,fail('HOST_UNAVAILABLE',e.payload.operationId));}).finally(()=>{if(s.active===e)s.active=null;this.#pump(s);});
  }
  hostFailed(){for(const s of this.#sessions.values()){s.state='host-failed';s.inputUnverified=true;this.#revoke(s);const active=s.active;s.active=null;if(active)this.#finish(s,active,fail('HOST_UNAVAILABLE',active.payload.operationId));}}
  stats(sessionId){const s=this.#sessions.get(sessionId);if(!s)return null;return Object.freeze({queuedInputUtf8Bytes:s.queuedBytes,pendingInputs:(s.active&&!s.active.done?1:0)+s.queue.length,retainedInputReceipts:s.lease?.receipts.size??0,inputUnverified:s.inputUnverified});}
}
