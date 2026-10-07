import {SourceReadService,normalizeSourceReadRequest} from '../sources/read-ipc.mjs';
import {workspaceMetadata} from './entities.mjs';
const fail=code=>Object.freeze({ok:false,code});
const ref=value=>value&&typeof value.sourceId==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(value.sourceId)&&Number.isSafeInteger(value.version)&&value.version>=1&&typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256)
  ?Object.freeze({sourceId:value.sourceId,version:value.version,sha256:value.sha256}):null;
const same=(a,b)=>a&&b&&a.sourceId===b.sourceId&&a.version===b.version&&a.sha256===b.sha256;
const own=(value,key)=>{const d=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,key):null;return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const safeName=value=>typeof value==='string'&&value.length>0&&value.length<=200&&value.isWellFormed()&&!/[\\/:\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(value)&&value!=='.'&&value!=='..'?value:null;

/** Bounded name metadata only. The caller must have already admitted this exact
 * reference; names confer no read/write grant and never include Docs content. */
export function selectedSourceDisplayName(snapshot,reference){
 try{
  if(own(snapshot,'schema')!==2)return null;
  const refs=own(snapshot,'sourceRefs');if(!Array.isArray(refs)||refs.length>65536)return null;
  const selected=refs.find(value=>same(value,reference));if(!selected)return null;
  const provenance=own(selected,'provenance'),standalone=own(provenance,'kind')==='standalone',fileId=standalone?own(provenance,'fileId'):undefined;
  const files=workspaceMetadata(snapshot).codeFiles;
  if(Array.isArray(files))for(const file of files.slice(0,4096)){
   if(same(own(file,'sourceRef'),reference)||typeof fileId==='string'&&own(file,'id')===fileId){const name=safeName(own(file,'name'));if(name)return name;}
  }
  return standalone?safeName(own(provenance,'fileName')):null;
 }catch{return null;}
}

/** Selected native references only. Never consult repository latest/drafts or
 * permit a projected renderer grant to reconstruct admitted Code versions. */
export function selectedSourceReference(snapshot,registry,grant,request){
 try{
  if(snapshot?.schema!==2||!registry.isCurrent(grant)||!Array.isArray(snapshot.sourceRefs))return null;
  const scope=grant.role==='code'?registry.sourceScope(grant):null;
  if(!['workspace','code'].includes(grant.role)||grant.role==='code'&&!scope)return null;
  const sourceId=request?.sourceId??scope?.sourceId,version=request?.version??scope?.version;
  if(!grant.entityIds.includes(sourceId)||scope&&(sourceId!==scope.sourceId||scope.version!==undefined&&version!==scope.version))return null;
  const matches=snapshot.sourceRefs.filter(value=>value.sourceId===sourceId&&(version===undefined||value.version===version));
  return ref(matches.reduce((latest,value)=>!latest||value.version>latest.version?value:latest,null));
 }catch{return null;}
}

/** Immutable native read leases only; no editor write admission. All callers
 * retain genuine frame/owner/selected-reference checks during actual I/O. */
export class NativeSourceReads {
 #registry;#owner;#referenceFor;#service;#disposed=false;#readonlyFor;#editingState;#displayNameFor;#languageFor;#repository;
 constructor({registry,owner,referenceFor,repositoryFactory,readonlyFor,editingState,displayNameFor,languageFor}){
  if(!['capture','isCurrent','sourceScope'].every(key=>typeof registry?.[key]==='function')||typeof owner?.canRead!=='function'||typeof referenceFor!=='function'||typeof repositoryFactory!=='function')throw TypeError('NATIVE_SOURCE_READ_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#referenceFor=referenceFor;this.#repository=repositoryFactory;
  if(readonlyFor!==undefined&&typeof readonlyFor!=='function'||editingState!==undefined&&typeof editingState!=='function'||displayNameFor!==undefined&&typeof displayNameFor!=='function'||languageFor!==undefined&&typeof languageFor!=='function')throw TypeError('NATIVE_SOURCE_READ_ADAPTERS_REQUIRED');
  this.#readonlyFor=readonlyFor;this.#editingState=editingState;this.#displayNameFor=displayNameFor;this.#languageFor=languageFor;
  this.#service=new SourceReadService({registry,repositoryFactory,access:(_grant,scope,event)=>Boolean(this.#context(event,scope))});
 }
 #context(event,request){
  if(this.#disposed)return null;
  const grant=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame});
  const entry=grant?.role==='workspace'?'siren://app/app.html':grant?.role==='code'?`siren://app/windows/code.html?windowId=${grant.windowId}`:null;
  if(!entry||grant.mainFrameUrl!==entry||!this.#registry.isCurrent(grant)||!request&&grant.role!=='code')return null;
  const reference=ref(this.#referenceFor(grant,request));
  if(!reference||request&&(request.sourceId!==reference.sourceId||request.version!==reference.version)||!this.#owner.canRead(grant,reference.sourceId))return null;
  return {grant,reference};
 }
 dispose(){if(this.#disposed)return;this.#disposed=true;this.#service.dispose();}
 async invoke({event,method,payload}){
  try{
   if(method==='getReference'){
    if(payload!=null&&(![Object.prototype,null].includes(Object.getPrototypeOf(payload))||Reflect.ownKeys(payload).length))return fail('REQUEST_REFUSED');
    const context=this.#context(event);if(!context)return fail('ACCESS_REFUSED');
    let displayName;try{displayName=safeName(this.#displayNameFor?.(context.grant,context.reference));}catch{displayName=null;}
    let language;try{language=this.#languageFor?.(context.grant,context.reference);}catch{language='unknown';}
    const readonly=this.#readonlyFor?this.#readonlyFor(context.grant)!==false:true;
    let committedOperationId;
    if(!readonly){
     // Optional replay identity only, never a synthetic save acknowledgement.
     // The repository independently verifies the exact selected historical bytes
     // and actual commit chain; imports/uncommitted drafts have no such proof.
     try{
      const repository=this.#repository({canWrite:scope=>scope?.action==='read'&&scope.projectId===context.grant.projectId&&scope.sourceId===context.reference.sourceId&&same(this.#context(event)?.reference,context.reference)});
      const loaded=await repository.load(context.grant.projectId,context.reference.sourceId,context.reference.version,{materializeModel:false});
      const operationId=loaded.pointer.commitHead?.operationId;
      if(typeof operationId==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(operationId)){
       const proof=await repository.getCommitReceipt({projectId:context.grant.projectId,sourceId:context.reference.sourceId,expectedVersion:context.reference.version,sha256:context.reference.sha256,operationId});
       if(proof?.ok===true&&same(proof,context.reference)&&proof.operationId===operationId&&['committed','recovery-degraded'].includes(proof.durability))committedOperationId=operationId;
      }
     }catch{/* Missing/unverifiable proof keeps ordinary fresh CAS semantics. */}
    }
    const result={ok:true,readonly,sourceRef:context.reference,...(committedOperationId?{committedOperationId}:{}),...(this.#editingState?{canEdit:this.#editingState(context.grant)===true}:{}),...(displayName?{displayName}:{}),...(this.#languageFor?{language:['python','text'].includes(language)?language:'unknown'}:{})};
    const current=this.#context(event);return current&&same(current.reference,context.reference)?Object.freeze(result):fail('ACCESS_REFUSED');
   }
   const request=normalizeSourceReadRequest(method,payload);if(!request)return fail('REQUEST_REFUSED');
   const context=this.#context(event,request);
   if(!context||method==='openRead'&&request.sha256!==context.reference.sha256)return fail('ACCESS_REFUSED');
   const result=await this.#service.invoke({event,method,payload:request});
   const current=this.#context(event,request);
   return current&&same(current.reference,context.reference)?result:fail('ACCESS_REFUSED');
  }catch{return fail('SOURCE_REQUEST_FAILED');}
 }
}
