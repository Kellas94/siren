import { invokeSource, normalizeSourceRequest } from '../sources/ipc.mjs';
import { navigationFields } from '../navigation/contracts.mjs';
import { normalizeDocsLink, normalizeDocsCreation, projectDocsReceipt, projectDocsCreationReceipt } from './docs.mjs';
import { randomUUID } from 'node:crypto';
import {normalizeDomainRequest,projectDomainResult} from './domain.mjs';
import {normalizeWorkspaceSave,projectWorkspaceResult,MAX_WORKSPACE_BYTES} from './primary.mjs';

const fail=code=>Object.freeze({ok:false,code});
const error=code=>Object.assign(new Error(code),{code});

/** Native FIFO owner for scoped source/domain operations and schema-1 primary
 * persistence. All-view transitions require separately qualified native seals. */
export class WorkspaceCoordinator {
  #registry;#sources;#docs;#domains;#primary;#readonly;#workspaceBytes=0;#access;#tail=Promise.resolve();#pending=new Set();
  #bytes=0;#paused=false;#maxPending;#maxBytes;#subscriptions=new Set();
 #flushes=new Map();#pauseGeneration=0;#pauseReason=null;
  #activityGeneration=0;#quiescence=new WeakMap();#onNativeFailure;
  constructor({sources,docs,domains,primary,readonlyViews,registry,access,onNativeFailure,maxPending=64,maxQueueBytes=16*1024*1024}) {
    if(typeof sources!=='function' || typeof access!=='function' || !registry || !['isCurrent','eventFor','caller'].every(key=>typeof registry[key]==='function'))throw TypeError('Native source owner adapters required');
    if(!Number.isSafeInteger(maxPending)||maxPending<1||maxPending>64||!Number.isSafeInteger(maxQueueBytes)||maxQueueBytes<1||maxQueueBytes>16*1024*1024)throw error('OWNER_BUDGET');
    if(docs!==undefined && typeof docs.commitCodeToDocs!=='function')throw TypeError('Native Docs adapter required');
    if(domains!==undefined && !['read','apply','flush'].every(key=>typeof domains?.[key]==='function'))throw TypeError('Native domain adapter required');
    if(primary!==undefined && typeof primary?.save!=='function')throw TypeError('Native primary adapter required');
    if(readonlyViews!==undefined&&!['isReadonly','seal','verify'].every(method=>typeof readonlyViews?.[method]==='function'))throw TypeError('Native readonly proof adapter required');
    this.#registry=registry;this.#sources=sources;this.#docs=docs;this.#domains=domains;this.#primary=primary;this.#readonly=readonlyViews;this.#access=access;this.#onNativeFailure=onNativeFailure;this.#maxPending=maxPending;this.#maxBytes=maxQueueBytes;
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
  #currentDomain(grant,kind,method,payload) {
    try {const entityId=payload.entityId??payload.documentId??payload.diagramId;return this.#registry.isCurrent(grant) && ['workspace',kind].includes(grant.role) && grant.entityIds.includes(entityId) &&
      this.#access(grant,{action:method.startsWith('read')?'read-domain':method.startsWith('flush')?'flush-domain':'edit-domain',domain:kind,entityId})===true;}catch{return false;}
  }
  #currentWorkspace(grant,payload) {
    try{return this.#registry.isCurrent(grant)&&grant.role==='workspace'&&grant.projectId===payload.projectId&&
      this.#access(grant,{action:payload.purpose,projectId:payload.projectId})===true;}catch{return false;}
  }
  // Main-only issuance. The control transport may disclose the nonce solely to
  // its captured frame. It grants finite draining of existing source authority,
  // never another entity, role, frame, epoch or general Docs operation. Diagram
  // Docs/Diagram preparation may reread its own saved entity before its flush.
  beginViewFlush(grant,options={}) {
    if(!this.#registry.isCurrent(grant) || !['workspace','code',...(this.#domains?['docs','diagram']:[]),...(this.#readonly?.isReadonly(grant)?['presenter','audience']:[])].includes(grant?.role))throw error('ACCESS_REFUSED');
    if(!this.#paused)throw error('WORKSPACE_NOT_PAUSED');
    let values;try{values=navigationFields(options,['maxOperations','maxBytes'],[]);}catch{throw error('FLUSH_BUDGET');}
    const byteLimit=grant.role==='workspace'&&this.#primary?MAX_WORKSPACE_BYTES:17*1024*1024;
    const maxOperations=values.maxOperations??65,maxBytes=values.maxBytes??byteLimit;
    if(!Number.isSafeInteger(maxOperations)||maxOperations<1||maxOperations>65||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>byteLimit)throw error('FLUSH_BUDGET');
    if(this.#flushes.size>=64 || [...this.#flushes.values()].some(ticket=>ticket.grant.windowId===grant.windowId))throw error('FLUSH_BUDGET');
    const nonce=randomUUID(),event=this.#registry.eventFor(grant);
    if(!event)throw error('ACCESS_REFUSED');
    this.#flushes.set(nonce,{grant,event,generation:this.#pauseGeneration,maxOperations,maxBytes,bytes:0,operations:[],sealed:false});
    this.#activityGeneration++;
    return nonce;
  }
  async finishViewFlush(grant,nonce) {
    const ticket=typeof nonce==='string'?this.#flushes.get(nonce):null;
    if(!ticket || ticket.sealed || !this.#flushCurrent(grant,ticket))return fail('FLUSH_REFUSED');
    ticket.sealed=true;
    const operations=[...ticket.operations],actual=await Promise.all(operations.map(item=>item.promise));
    let readonlyReceipt;
    if(!operations.length&&this.#readonly?.isReadonly(grant))readonlyReceipt=await this.#readonly.seal(grant,{isCurrent:()=>this.#flushCurrent(grant,ticket)});
    // A clean preparing editor can race one other captured editor's save.
    // Retain that failure unless the same private ticket subsequently obtained
    // an exact native read and matching durable flush. Never forgive mutations,
    // unknown failures, a second conflict or a renderer-provided acknowledgement.
    let recaptured=false;const superseded=new Set();
    for(let index=0;index<actual.length;index++)if(actual[index]?.ok!==true){
      const operation=operations[index],reading=operations[index+1],flushing=operations[index+2],read=actual[index+1],flush=actual[index+2],domain=operation.domain;
      if(recaptured||!['docs','diagram'].includes(domain)||operation.method!==(domain==='docs'?'flushDocument':'flushDiagram')||actual[index]?.code!==(domain==='docs'?'DOCUMENT_CONFLICT':'REVISION_CONFLICT')||
        reading?.domain!==domain||reading.method!==(domain==='docs'?'readDocument':'readDiagram')||reading.entityId!==operation.entityId||flushing?.domain!==domain||flushing.method!==operation.method||flushing.entityId!==operation.entityId||
        read?.ok!==true||flush?.ok!==true||read.entityId!==operation.entityId||flush.entityId!==operation.entityId||read.version!==flushing.payload?.expectedVersion||read.version!==flush.version||read.sha256!==flush.sha256||read.projectRevision>flush.projectRevision||
        (domain==='diagram'?read.version<=operation.payload.expectedVersion:read.version===operation.payload.expectedVersion)||!['committed','recovery-degraded'].includes(flush.durability))continue;
      recaptured=true;superseded.add(index);
    }
    const projected=actual.map((receipt,index)=>operations[index].domain==='workspace'?Object.freeze({...receipt,domain:'workspace',entityId:grant.projectId,purpose:operations[index].purpose}):receipt);
    const receipts=Object.freeze(readonlyReceipt?[readonlyReceipt]:projected.filter((_receipt,index)=>!superseded.has(index)));
    const current=this.#flushCurrent(grant,ticket);
    this.#flushes.delete(nonce);
    if(!current)return fail('ACCESS_REFUSED');
    if(receipts.some(receipt=>receipt.ok!==true))return fail('FLUSH_FAILED');
    if(readonlyReceipt){
      const verified=await this.#readonly.verify(grant,readonlyReceipt,{isCurrent:()=>this.#flushCurrent(grant,ticket)});
      return verified&&this.#flushCurrent(grant,ticket)?Object.freeze({ok:true,receipts}):fail('READONLY_PROOF_FAILED');
    }
    const final=new Map();operations.forEach((operation,index)=>{if(!superseded.has(index))final.set(`${operation.domain}:${operation.entityId}:${operation.purpose??''}`,{method:operation.method,receipt:projected[index],payload:operation.payload});});
    if(!final.size)return fail('FLUSH_NOT_COMMITTED');
    for(const item of final.values()) {
      if(item.receipt.domain==='workspace') {
        if(!['saveProject','sealReadonly'].includes(item.method)||typeof this.#primary?.verify!=='function')return fail('FLUSH_NOT_COMMITTED');
        const verified=await this.#primary.verify({ok:true,revision:item.receipt.revision,sha256:item.receipt.sha256},{projectId:grant.projectId,purpose:item.receipt.purpose,isCurrent:()=>this.#registry.isCurrent(grant)&&this.#paused&&ticket.generation===this.#pauseGeneration&&!ticket.cancelled});
        if(!verified.ok)return verified;
      } else if(!['commitSource','flushDocument','flushDiagram'].includes(item.method)||!['committed','recovery-degraded'].includes(item.receipt.durability))return fail('FLUSH_NOT_COMMITTED');
    }
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
      else if(kind==='docs' && method==='createCodeToDocs' && typeof this.#docs?.createCodeToDocs==='function')payload=normalizeDocsCreation(input.payload);
      else if(['docs','diagram'].includes(kind) && this.#domains)payload=normalizeDomainRequest(kind,method,input.payload);
      else if(kind==='workspace' && method==='saveProject' && this.#primary)payload=normalizeWorkspaceSave(input.payload);
      else if(kind==='workspace' && method==='sealReadonly' && typeof this.#primary?.sealReadonly==='function')payload={...navigationFields(input.payload,[]),projectId:grant?.projectId,purpose:'readonly'};
      else return Promise.resolve(fail('REQUEST_REFUSED'));
      if(!payload)return Promise.resolve(fail('REQUEST_REFUSED'));
      // Preserve the legacy 64 MiB UTF-8 workspace limit. JSON-escaping that
      // string a second time must not silently lower its accepted capacity.
      bytes=kind==='workspace'?(method==='saveProject'?Buffer.byteLength(payload.json):128):Buffer.byteLength(JSON.stringify(payload));
    } catch{return Promise.resolve(fail('REQUEST_REFUSED'));}
    // A native draining nonce never promotes an explicitly readonly view.
    if(this.#readonly?.isReadonly(grant)&&!(kind==='source'?['getMetrics','readRange'].includes(method):['docs','diagram'].includes(kind)&&method.startsWith('read')))return Promise.resolve(fail('ACCESS_REFUSED'));
    let ticket;
    const primaryOperation=kind==='workspace';
    const domainOperation=!primaryOperation && kind!=='source' && !['commitCodeToDocs','createCodeToDocs'].includes(method);
    const current=()=> (primaryOperation?this.#currentWorkspace(grant,payload):kind==='source'?this.#current(grant,payload.sourceId):domainOperation?this.#currentDomain(grant,kind,method,payload):this.#currentDocs(grant,payload)) &&
      (!ticket || this.#flushCurrent(grant,ticket));
    if(!current())return Promise.resolve(fail('ACCESS_REFUSED'));
    if(flushNonce!==undefined) {
      ticket=typeof flushNonce==='string'?this.#flushes.get(flushNonce):null;
      if(!ticket || ticket.sealed || !this.#flushCurrent(grant,ticket) || !(primaryOperation?grant.role==='workspace':kind==='source'?['applyEdit','commitSource'].includes(method):domainOperation && (!method.startsWith('read')||grant.role===kind&&['readDiagram','readDocument'].includes(method))))return Promise.resolve(fail('FLUSH_REFUSED'));
      if(ticket.operations.length>=ticket.maxOperations || ticket.bytes+bytes>ticket.maxBytes)return Promise.resolve(fail('FLUSH_BUDGET'));
    } else if(this.#paused)return Promise.resolve(fail('WORKSPACE_PAUSED'));
    if(this.#pending.size>=this.#maxPending || (primaryOperation?this.#workspaceBytes+bytes>MAX_WORKSPACE_BYTES:this.#bytes+bytes>this.#maxBytes))return Promise.resolve(fail('OWNER_BUDGET'));
    if(ticket)ticket.bytes+=bytes;
    this.#activityGeneration++;
    if(primaryOperation)this.#workspaceBytes+=bytes;else this.#bytes+=bytes;
    const operation=this.#tail.catch(()=>{}).then(async()=>{
      if(!current())return fail('ACCESS_REFUSED');
      const event=this.#registry.eventFor(grant);
      if(!event)return fail('ACCESS_REFUSED');
      const receipt=primaryOperation?projectWorkspaceResult(method==='sealReadonly'?await this.#primary.sealReadonly({projectId:grant.projectId,readonly:true,checkpoint:this.#pauseReason!=='native-home-navigation',isCurrent:current}):await this.#primary.save(payload,{projectId:grant.projectId,isCurrent:current})):kind==='source'?await invokeSource({event,method,payload,registry:this.#registry,repositoryFactory:this.#sources,
        access:(_caller,scope)=>current() && this.#access(grant,scope)===true,onNativeFailure:this.#onNativeFailure}):
        domainOperation?projectDomainResult(kind,method,await this.#domains[method.startsWith('read')?'read':method.startsWith('flush')?'flush':'apply'](kind,payload,{projectId:grant.projectId,isCurrent:current}),payload):
        method==='createCodeToDocs'?projectDocsCreationReceipt(await this.#docs.createCodeToDocs(payload,{projectId:grant.projectId,isCurrent:current}),payload):projectDocsReceipt(await this.#docs.commitCodeToDocs(payload,{projectId:grant.projectId,isCurrent:current}),payload);
      if(!current())return fail('ACCESS_REFUSED');
      if(kind==='source' && receipt.ok===true && ['applyEdit','commitSource'].includes(method))this.#publish(grant.projectId,payload.sourceId,receipt,'source',grant.windowId);
      if(domainOperation && receipt.ok===true && !method.startsWith('read'))this.#publish(grant.projectId,receipt.entityId,receipt,kind,grant.windowId);
      if(kind==='docs' && !domainOperation && receipt.ok===true)this.#publish(grant.projectId,payload.documentId,receipt,'docs',grant.windowId);
      return current()?receipt:fail('ACCESS_REFUSED');
    }).catch(()=>fail('OWNER_OPERATION_FAILED'));
    this.#pending.add(operation);this.#tail=operation;
    if(ticket)ticket.operations.push({method,domain:kind==='source'?'source':kind,entityId:primaryOperation?payload.projectId:payload.sourceId??payload.entityId??payload.documentId??payload.diagramId,payload,...(primaryOperation?{purpose:payload.purpose}:{}),promise:operation});
    operation.then(()=>{this.#pending.delete(operation);if(primaryOperation)this.#workspaceBytes-=bytes;else this.#bytes-=bytes;});
    return operation;
  }
  saveWorkspace(grant,payload) {return this.invoke(grant,{kind:'workspace',method:'saveProject',payload});}
  // Main-only admission for immutable pooled readers. This is a current read
  // check, not a persistence/quiescence proof or a renderer-issued capability.
  canRead(grant,sourceId) {
    try{return !this.#paused && this.#current(grant,sourceId) && this.#access(grant,{action:'read',sourceId})===true;}
    catch{return false;}
  }
  canReadDomain(grant,kind,entityId,flushNonce) {
    const ticket=typeof flushNonce==='string'?this.#flushes.get(flushNonce):null;
    const readable=flushNonce===undefined?!this.#paused:['docs','diagram'].includes(kind)&&grant?.role===kind&&ticket&&!ticket.sealed&&this.#flushCurrent(grant,ticket);
    return Boolean(readable && ['docs','diagram'].includes(kind) && this.#currentDomain(grant,kind,kind==='docs'?'readDocument':'readDiagram',{entityId}));
  }
  // Trusted native classification controls preparation order only. It creates
  // no read/write grant and does not substitute for a verified readonly seal.
  isReadonlyForPreparation(grant) {
    try {
      if(!this.#registry.isCurrent(grant))return false;
      if(this.#readonly?.isReadonly(grant))return true;
      return grant.role==='workspace'&&typeof this.#primary?.sealReadonly==='function'&&
        this.#currentWorkspace(grant,{projectId:grant.projectId,purpose:'readonly'});
    }catch{return false;}
  }
  pause(reason) {
    if(typeof reason!=='string' || reason.length<1 || reason.length>128)throw error('REQUEST_REFUSED');
    this.#paused=true;this.#pauseReason=reason;this.#pauseGeneration++;this.#flushes.clear();
  }
  resume() {this.#paused=false;this.#pauseReason=null;this.#pauseGeneration++;this.#flushes.clear();}
  async drain() {
    const receipts=[];
    while(this.#pending.size) {
      const batch=[...this.#pending];receipts.push(...await Promise.all(batch));
    }
    return receipts;
  }
  captureQuiescence() {
    if(!this.#paused || this.#pending.size || this.#flushes.size)throw error('OWNER_NOT_QUIESCENT');
    const proof=Object.freeze({});this.#quiescence.set(proof,{pause:this.#pauseGeneration,activity:this.#activityGeneration});return proof;
  }
  isQuiescent(proof) {
    const scope=proof && this.#quiescence.get(proof);
    return Boolean(scope && this.#paused && !this.#pending.size && !this.#flushes.size && scope.pause===this.#pauseGeneration && scope.activity===this.#activityGeneration);
  }
  // Main-only final source proof after every captured view has sealed and the
  // owner has drained. Historical commits remain valid history, but cannot
  // represent a newer selected draft. No source text or paths are returned.
  async reconcileSourceReceipts(grants,receipts,isCurrent) {
    if(!this.#paused || this.#pending.size || this.#flushes.size)return fail('OWNER_NOT_QUIESCENT');
    if(!Array.isArray(grants)||!grants.length||grants.length>64||!Array.isArray(receipts)||receipts.length>4224||typeof isCurrent!=='function')return fail('REQUEST_REFUSED');
    const generation=this.#pauseGeneration,activity=this.#activityGeneration,projectId=grants[0]?.projectId;
    const current=()=>{try{return this.#paused && generation===this.#pauseGeneration && activity===this.#activityGeneration && !this.#pending.size && !this.#flushes.size &&
      isCurrent()===true && grants.every(grant=>grant.projectId===projectId && this.#registry.isCurrent(grant) && ['workspace','code'].includes(grant.role));}catch{return false;}};
    if(!current())return fail('ACCESS_REFUSED');
    if(receipts.some(receipt=>receipt?.ok!==true))return fail('SOURCE_FLUSH_FAILED');
    const sources=new Map();
    for(const receipt of receipts) {
      if(!['draft','committed','recovery-degraded'].includes(receipt.durability))continue;
      if(typeof receipt.sourceId!=='string'||!Number.isSafeInteger(receipt.version)||receipt.version<1||typeof receipt.operationId!=='string'||! /^[a-f0-9]{64}$/.test(receipt.sha256))return fail('SOURCE_PROOF_FAILED');
      const previous=sources.get(receipt.sourceId);
      if(!previous || receipt.version>previous.version)sources.set(receipt.sourceId,receipt);
      else if(receipt.version===previous.version) {
        if(receipt.sha256!==previous.sha256)return fail('SOURCE_PROOF_FAILED');
        if(receipt.durability!=='draft')sources.set(receipt.sourceId,receipt);
      }
    }
    const refs=[];
    if(!sources.size || grants.some(grant=>grant.role==='code' && grant.entityIds.some(sourceId=>!sources.has(sourceId))))return fail('SOURCE_NOT_COMMITTED');
    try {
      for(const receipt of sources.values()) {
        if(receipt.durability==='draft')return fail('SOURCE_NOT_COMMITTED');
        const grant=grants.find(grant=>this.#current(grant,receipt.sourceId));if(!grant)return fail('ACCESS_REFUSED');
        const repository=this.#sources(Object.freeze({grant,canWrite:context=>context?.action==='read' && context.projectId===projectId && context.sourceId===receipt.sourceId && current() && this.#access(grant,{action:'read',sourceId:receipt.sourceId})===true}));
        if(!current())return fail('ACCESS_REFUSED');
        const latest=await repository.getMetrics({projectId,sourceId:receipt.sourceId});
        if(!current())return fail('ACCESS_REFUSED');
        if(latest.version!==receipt.version || latest.sha256!==receipt.sha256)return fail('SOURCE_VERSION_CHANGED');
        const verified=await repository.getCommitReceipt({projectId,sourceId:receipt.sourceId,expectedVersion:receipt.version,operationId:receipt.operationId,sha256:receipt.sha256});
        if(!current())return fail('ACCESS_REFUSED');
        if(verified?.ok!==true || verified.sourceId!==receipt.sourceId || verified.version!==receipt.version || verified.sha256!==receipt.sha256 || !['committed','recovery-degraded'].includes(verified.durability))return fail('SOURCE_PROOF_FAILED');
        refs.push(Object.freeze({sourceId:receipt.sourceId,version:receipt.version,sha256:receipt.sha256,durability:verified.durability}));
      }
    } catch {return fail(current()?'SOURCE_PROOF_FAILED':'ACCESS_REFUSED');}
    return current()?Object.freeze({ok:true,refs:Object.freeze(refs)}):fail('ACCESS_REFUSED');
  }
  async reconcileWorkspaceReceipts(grants,receipts,isCurrent) {
    if(!this.#paused||this.#pending.size||this.#flushes.size)return fail('OWNER_NOT_QUIESCENT');
    if(!Array.isArray(grants)||!grants.length||grants.length>64||!Array.isArray(receipts)||receipts.length>4224||typeof isCurrent!=='function')return fail('REQUEST_REFUSED');
    const proof=this.captureQuiescence(),projectId=grants[0]?.projectId;
    const current=()=>{try{return this.isQuiescent(proof)&&isCurrent()===true&&grants.every(grant=>grant.projectId===projectId&&this.#registry.isCurrent(grant)&&['workspace','code','docs','diagram','presenter','audience'].includes(grant.role));}catch{return false;}};
    if(!current())return fail('ACCESS_REFUSED');if(receipts.some(receipt=>receipt?.ok!==true))return fail('WORKSPACE_FLUSH_FAILED');
    const immutable=grants.filter(grant=>this.#readonly?.isReadonly(grant)),immutableIds=new Set(immutable.map(grant=>grant.windowId));
    if(grants.some(grant=>['presenter','audience'].includes(grant.role)&&!immutableIds.has(grant.windowId)))return fail('READONLY_PROOF_FAILED');
    const immutableRefs=[];
    for(const grant of immutable){
      const presenting=['presenter','audience'].includes(grant.role),entityId=presenting?this.#registry.presentationScope(grant)?.deckId:grant.entityIds[0];
      const candidates=receipts.filter(receipt=>receipt.purpose==='readonly'&&receipt.domain===(presenting?'presentation':grant.role==='code'?'source':grant.role==='diagram'?'diagram':'docs')&&receipt.entityId===entityId);
      let verified;
      for(const receipt of candidates)if(await this.#readonly.verify(grant,receipt,{isCurrent:current})){verified=receipt;break;}
      if(!current())return fail('ACCESS_REFUSED');if(!verified)return fail('READONLY_PROOF_FAILED');immutableRefs.push(verified);
    }
    const code=grants.filter(grant=>grant.role==='code'&&!immutableIds.has(grant.windowId)),sourceReceipts=receipts.filter(receipt=>!receipt.domain && receipt.sourceId);
    let sources={ok:true,refs:[]};if(code.length)sources=await this.reconcileSourceReceipts(code,sourceReceipts,current);if(!sources.ok)return sources;
    const refs=[...sources.refs,...immutableRefs],seen=new Set();
    for(const grant of grants.filter(grant=>grant.role==='workspace')) {
      const candidates=receipts.filter(receipt=>receipt.domain==='workspace'&&receipt.entityId===projectId);
      if(!this.#primary?.verify||!candidates.some(receipt=>['workspace','readonly'].includes(receipt.purpose)))return fail('WORKSPACE_NOT_FLUSHED');
      for(const purpose of ['workspace','recovery','readonly']) {
        const versions=candidates.filter(receipt=>receipt.purpose===purpose);if(!versions.length)continue;
        const latest=versions.at(-1),live=()=>current()&&this.#currentWorkspace(grant,{projectId,purpose});
        const actual=await this.#primary.verify({ok:true,revision:latest.revision,sha256:latest.sha256},{projectId,purpose,isCurrent:live});
        if(!live())return fail('ACCESS_REFUSED');if(!actual.ok)return actual;refs.push(Object.freeze(actual));
      }
    }
    for(const grant of grants.filter(grant=>!['code','workspace'].includes(grant.role)&&!immutableIds.has(grant.windowId)))for(const entityId of grant.entityIds) {
      const key=`${grant.role}:${entityId}`;if(seen.has(key))continue;seen.add(key);
      const candidates=receipts.filter(receipt=>receipt.domain===grant.role&&receipt.entityId===entityId&&receipt.purpose!=='readonly'&&!Object.hasOwn(receipt,'entity'));
      const flushed=candidates.filter(receipt=>!Object.hasOwn(receipt,'operationId')).sort((a,b)=>b.projectRevision-a.projectRevision)[0];
      if(!flushed||candidates.some(receipt=>receipt.projectRevision>flushed.projectRevision))return fail('DOMAIN_NOT_FLUSHED');
      const method=grant.role==='docs'?'flushDocument':'flushDiagram',payload={entityId,expectedVersion:flushed.version};
      const live=()=>current()&&this.#currentDomain(grant,grant.role,method,payload);if(!live()||!this.#domains)return fail('ACCESS_REFUSED');
      const actual=projectDomainResult(grant.role,method,await this.#domains.flush(grant.role,payload,{projectId,isCurrent:live}),payload);
      if(!live())return fail('ACCESS_REFUSED');if(!actual.ok||actual.version!==flushed.version||actual.sha256!==flushed.sha256)return fail('DOMAIN_VERSION_CHANGED');
      refs.push(Object.freeze({domain:grant.role,entityId,version:actual.version,sha256:actual.sha256,durability:actual.durability}));
    }
    return current()?Object.freeze({ok:true,refs:Object.freeze(refs)}):fail('ACCESS_REFUSED');
  }
  #subscriptionCurrent(grant,entityId,domain) {
    try {return this.#registry.isCurrent(grant) && grant.entityIds.includes(entityId) &&
      (domain==='source'?['workspace','code']:['workspace',domain]).includes(grant.role);}
    catch{return false;}
  }
  subscribe(grant,entityId,callback,domain=grant?.role==='docs'?'docs':'source') {
    if(!['source','docs','diagram'].includes(domain))throw error('REQUEST_REFUSED');
    if(!this.#subscriptionCurrent(grant,entityId,domain))throw error('ACCESS_REFUSED');
    if(typeof callback!=='function')throw error('REQUEST_REFUSED');
    for(const subscription of this.#subscriptions)if(!this.#subscriptionCurrent(subscription.grant,subscription.entityId,subscription.domain))this.#subscriptions.delete(subscription);
    if(this.#subscriptions.size>=1024 || [...this.#subscriptions].filter(item=>item.grant.windowId===grant.windowId).length>=64)throw error('OWNER_BUDGET');
    const subscription={grant,entityId,callback,domain};this.#subscriptions.add(subscription);
    return ()=>{this.#subscriptions.delete(subscription);};
  }
  #publish(projectId,sourceId,receipt,domain='source',originWindowId) {
    for(const subscription of this.#subscriptions) {
      if(!this.#subscriptionCurrent(subscription.grant,subscription.entityId,subscription.domain)) {this.#subscriptions.delete(subscription);continue;}
      if(subscription.domain!==domain || subscription.grant.projectId!==projectId || subscription.entityId!==sourceId)continue;
      try {if(this.#access(subscription.grant,domain==='source'?{action:'read',sourceId}:{action:'read-domain',domain,entityId:sourceId})===true)subscription.callback(receipt,originWindowId);}catch {/* One disposed native transport cannot fail another view's durable edit. */}
    }
  }
}
