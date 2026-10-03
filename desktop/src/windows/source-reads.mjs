import {SourceReadService,normalizeSourceReadRequest} from '../sources/read-ipc.mjs';
const fail=code=>Object.freeze({ok:false,code});
const ref=value=>value&&typeof value.sourceId==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(value.sourceId)&&Number.isSafeInteger(value.version)&&value.version>=1&&typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256)
  ?Object.freeze({sourceId:value.sourceId,version:value.version,sha256:value.sha256}):null;
const same=(a,b)=>a&&b&&a.sourceId===b.sourceId&&a.version===b.version&&a.sha256===b.sha256;

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
 #registry;#owner;#referenceFor;#service;#disposed=false;#readonlyFor;#editingState;
 constructor({registry,owner,referenceFor,repositoryFactory,readonlyFor,editingState}){
  if(!['capture','isCurrent','sourceScope'].every(key=>typeof registry?.[key]==='function')||typeof owner?.canRead!=='function'||typeof referenceFor!=='function'||typeof repositoryFactory!=='function')throw TypeError('NATIVE_SOURCE_READ_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#referenceFor=referenceFor;
  if(readonlyFor!==undefined&&typeof readonlyFor!=='function'||editingState!==undefined&&typeof editingState!=='function')throw TypeError('NATIVE_SOURCE_READ_ADAPTERS_REQUIRED');
  this.#readonlyFor=readonlyFor;this.#editingState=editingState;
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
    const context=this.#context(event);return context?Object.freeze({ok:true,readonly:this.#readonlyFor?this.#readonlyFor(context.grant)!==false:true,sourceRef:context.reference,...(this.#editingState?{canEdit:this.#editingState(context.grant)===true}:{})}):fail('ACCESS_REFUSED');
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
