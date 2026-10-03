import { invokeSource, normalizeSourceRequest } from '../sources/ipc.mjs';
import { navigationFields } from '../navigation/contracts.mjs';
import { normalizeDocsLink, projectDocsReceipt } from './docs.mjs';
import { randomUUID } from 'node:crypto';

const fail=code=>Object.freeze({ok:false,code});
const error=code=>Object.assign(new Error(code),{code});

/** Native source and explicit Docs-link owner. Sources is a repository factory
 * with a per-invocation publication guard, never a renderer mirror.
 * General Docs/Diagram edits and all-view transitions remain unadmitted. */
export class WorkspaceCoordinator {
  #registry;#sources;#docs;#access;#tail=Promise.resolve();#pending=new Set();
  #bytes=0;#paused=false;#maxPending;#maxBytes;#subscriptions=new Set();
  #flushes=new Map();#pauseGeneration=0;
  constructor({sources,docs,registry,access,maxPending=64,maxQueueBytes=16*1024*1024}) {
    if(typeof sources!=='function' || typeof access!=='function' || !registry || !['isCurrent','eventFor','caller'].every(key=>typeof registry[key]==='function'))throw TypeError('Native source owner adapters required');
    if(!Number.isSafeInteger(maxPending)||maxPending<1||maxPending>64||!Number.isSafeInteger(maxQueueBytes)||maxQueueBytes<1||maxQueueBytes>16*1024*1024)throw error('OWNER_BUDGET');
    if(docs!==undefined && typeof docs.commitCodeToDocs!=='function')throw TypeError('Native Docs adapter required');
    this.#registry=registry;this.#sources=sources;this.#docs=docs;this.#access=access;this.#maxPending=maxPending;this.#maxBytes=maxQueueBytes;
  }
  #current(grant,sourceId) {
    try {return this.#registry.isCurrent(grant) && ['workspace','code'].includes(grant.role) && grant.entityIds.includes(sourceId);}
    catch{return false;}
  }
  #currentDocs(grant,payload) {
    try {
      if(!this.#registry.isCurrent(grant))return false;
      const entity=grant.role==='docs'?payload.documentId:payload.sourceReceipt.sourceId;
      return ['workspace','code','docs'].includes(grant.role) && grant.entityIds.includes(entity) &&
        this.#access(grant,{action:'docs-link',sourceId:payload.sourceReceipt.sourceId,documentId:payload.documentId})===true;
    } catch{return false;}
  }
  #flushCurrent(grant,ticket) {
    try {
      const event=this.#registry.eventFor(grant);
      return this.#paused && ticket.generation===this.#pauseGeneration && this.#registry.isCurrent(ticket.grant) &&
        !ticket.cancelled && this.#registry.isCurrent(grant) && event?.sender===ticket.event.sender && event?.senderFrame===ticket.event.senderFrame;
    } catch {return false;}
  }
  // Main-only issuance. The control transport may disclose the nonce solely to
  // its captured frame. It grants finite draining of existing source authority,
  // never another entity, role, frame, epoch, read or general Docs operation.
  beginViewFlush(grant,options={}) {
    if(!this.#registry.isCurrent(grant) || !['workspace','code'].includes(grant?.role))throw error('ACCESS_REFUSED');
    if(!this.#paused)throw error('WORKSPACE_NOT_PAUSED');
    let values;try{values=navigationFields(options,['maxOperations','maxBytes'],[]);}catch{throw error('FLUSH_BUDGET');}
    const maxOperations=values.maxOperations??65,maxBytes=values.maxBytes??17*1024*1024;
    if(!Number.isSafeInteger(maxOperations)||maxOperations<1||maxOperations>65||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>17*1024*1024)throw error('FLUSH_BUDGET');
    if(this.#flushes.size>=64 || [...this.#flushes.values()].some(ticket=>ticket.grant.windowId===grant.windowId))throw error('FLUSH_BUDGET');
    const nonce=randomUUID(),event=this.#registry.eventFor(grant);
    if(!event)throw error('ACCESS_REFUSED');
    this.#flushes.set(nonce,{grant,event,generation:this.#pauseGeneration,maxOperations,maxBytes,bytes:0,operations:[],sealed:false});
    return nonce;
  }
  async finishViewFlush(grant,nonce) {
    const ticket=typeof nonce==='string'?this.#flushes.get(nonce):null;
    if(!ticket || ticket.sealed || !this.#flushCurrent(grant,ticket))return fail('FLUSH_REFUSED');
    ticket.sealed=true;
    const operations=[...ticket.operations],receipts=Object.freeze(await Promise.all(operations.map(item=>item.promise)));
    const current=this.#flushCurrent(grant,ticket);
    this.#flushes.delete(nonce);
    if(!current)return fail('ACCESS_REFUSED');
    if(receipts.some(receipt=>receipt.ok!==true))return fail('FLUSH_FAILED');
    const final=new Map();operations.forEach((operation,index)=>final.set(operation.sourceId,{method:operation.method,receipt:receipts[index]}));
    if(!final.size || [...final.values()].some(item=>item.method!=='commitSource' || !['committed','recovery-degraded'].includes(item.receipt.durability)))return fail('FLUSH_NOT_COMMITTED');
    return Object.freeze({ok:true,receipts});
  }
  cancelViewFlush(grant,nonce) {
    const ticket=typeof nonce==='string'?this.#flushes.get(nonce):null;
    // The original private native capture may retire before its main-owned
    // deadline cleanup. A cloned capture or another frame cannot cancel it.
    if(!ticket || !(ticket.grant===grant || this.#flushCurrent(grant,ticket)))return fail('FLUSH_REFUSED');
    ticket.cancelled=true;this.#flushes.delete(nonce);return Object.freeze({ok:true});
  }
  invoke(grant,intent,flushNonce) {
    let kind,method,payload,bytes;
    try {
      const input=navigationFields(intent,['kind','method','payload']);
      kind=input.kind;method=input.method;
      if(kind==='source')payload=normalizeSourceRequest(method,input.payload);
      else if(kind==='docs' && method==='commitCodeToDocs' && this.#docs)payload=normalizeDocsLink(input.payload);
      else return Promise.resolve(fail('REQUEST_REFUSED'));
      if(!payload)return Promise.resolve(fail('REQUEST_REFUSED'));
      bytes=Buffer.byteLength(JSON.stringify(payload));
    } catch{return Promise.resolve(fail('REQUEST_REFUSED'));}
    let ticket;
    const current=()=> (kind==='source'?this.#current(grant,payload.sourceId):this.#currentDocs(grant,payload)) &&
      (!ticket || this.#flushCurrent(grant,ticket));
    if(!current())return Promise.resolve(fail('ACCESS_REFUSED'));
    if(flushNonce!==undefined) {
      ticket=typeof flushNonce==='string'?this.#flushes.get(flushNonce):null;
      if(!ticket || ticket.sealed || !this.#flushCurrent(grant,ticket) || kind!=='source' || !['applyEdit','commitSource'].includes(method))return Promise.resolve(fail('FLUSH_REFUSED'));
      if(ticket.operations.length>=ticket.maxOperations || ticket.bytes+bytes>ticket.maxBytes)return Promise.resolve(fail('FLUSH_BUDGET'));
    } else if(this.#paused)return Promise.resolve(fail('WORKSPACE_PAUSED'));
    if(this.#pending.size>=this.#maxPending || this.#bytes+bytes>this.#maxBytes)return Promise.resolve(fail('OWNER_BUDGET'));
    if(ticket)ticket.bytes+=bytes;
    this.#bytes+=bytes;
    const operation=this.#tail.catch(()=>{}).then(async()=>{
      if(!current())return fail('ACCESS_REFUSED');
      const event=this.#registry.eventFor(grant);
      if(!event)return fail('ACCESS_REFUSED');
      const receipt=kind==='source'?await invokeSource({event,method,payload,registry:this.#registry,repositoryFactory:this.#sources,
        access:(caller,scope)=>current() && this.#access(caller,scope)===true}):
        projectDocsReceipt(await this.#docs.commitCodeToDocs(payload,{projectId:grant.projectId,isCurrent:current}),payload);
      if(!current())return fail('ACCESS_REFUSED');
      if(kind==='source' && receipt.ok===true && ['applyEdit','commitSource'].includes(method))this.#publish(grant.projectId,payload.sourceId,receipt);
      if(kind==='docs' && receipt.ok===true)this.#publish(grant.projectId,payload.documentId,receipt,'docs');
      return current()?receipt:fail('ACCESS_REFUSED');
    }).catch(()=>fail('OWNER_OPERATION_FAILED'));
    this.#pending.add(operation);this.#tail=operation;
    if(ticket)ticket.operations.push({method,sourceId:payload.sourceId,promise:operation});
    operation.then(()=>{this.#pending.delete(operation);this.#bytes-=bytes;});
    return operation;
  }
  pause(reason) {
    if(typeof reason!=='string' || reason.length<1 || reason.length>128)throw error('REQUEST_REFUSED');
    this.#paused=true;this.#pauseGeneration++;this.#flushes.clear();
  }
  resume() {this.#paused=false;this.#pauseGeneration++;this.#flushes.clear();}
  async drain() {
    const receipts=[];
    while(this.#pending.size) {
      const batch=[...this.#pending];receipts.push(...await Promise.all(batch));
    }
    return receipts;
  }
  #subscriptionCurrent(grant,entityId,domain) {
    try {return this.#registry.isCurrent(grant) && grant.entityIds.includes(entityId) &&
      (domain==='source'?['workspace','code']:['workspace','docs']).includes(grant.role);}
    catch{return false;}
  }
  subscribe(grant,entityId,callback,domain=grant?.role==='docs'?'docs':'source') {
    if(!['source','docs'].includes(domain))throw error('REQUEST_REFUSED');
    if(!this.#subscriptionCurrent(grant,entityId,domain))throw error('ACCESS_REFUSED');
    if(typeof callback!=='function')throw error('REQUEST_REFUSED');
    for(const subscription of this.#subscriptions)if(!this.#subscriptionCurrent(subscription.grant,subscription.entityId,subscription.domain))this.#subscriptions.delete(subscription);
    if(this.#subscriptions.size>=1024 || [...this.#subscriptions].filter(item=>item.grant.windowId===grant.windowId).length>=64)throw error('OWNER_BUDGET');
    const subscription={grant,entityId,callback,domain};this.#subscriptions.add(subscription);
    return ()=>{this.#subscriptions.delete(subscription);};
  }
  #publish(projectId,sourceId,receipt,domain='source') {
    for(const subscription of this.#subscriptions) {
      if(!this.#subscriptionCurrent(subscription.grant,subscription.entityId,subscription.domain)) {this.#subscriptions.delete(subscription);continue;}
      if(subscription.domain!==domain || subscription.grant.projectId!==projectId || subscription.entityId!==sourceId)continue;
      try {if(this.#access(subscription.grant,domain==='docs'?{action:'read-docs',documentId:sourceId}:{action:'read',sourceId})===true)subscription.callback(receipt);}catch {/* One disposed native transport cannot fail another view's durable edit. */}
    }
  }
}
