import {digest} from '../projects/atomic.mjs';
const fail=code=>Object.freeze({ok:false,code});
const fingerprint=value=>value?digest(Buffer.from(JSON.stringify(value))):null;

/** Selected single-document readonly transport. The native registry supplies
 * identity; a caller cannot select a project, document, path or writable role. */
export class NativeDocsReads {
 #registry;#owner;#documentFor;#readonly;#editing;
 constructor({registry,owner,documentFor,readonlyFor,editingState}){
  if(!['capture','isCurrent'].every(key=>typeof registry?.[key]==='function')||!['invoke','canReadDomain'].every(key=>typeof owner?.[key]==='function')||typeof documentFor!=='function')throw TypeError('NATIVE_DOCS_READ_ADAPTERS_REQUIRED');
  if(readonlyFor!==undefined&&typeof readonlyFor!=='function'||editingState!==undefined&&typeof editingState!=='function')throw TypeError('NATIVE_DOCS_READ_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#documentFor=documentFor;this.#readonly=readonlyFor;this.#editing=editingState;
 }
 #context(event,flushNonce){
  const grant=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame});
  if(grant?.role!=='docs'||grant.mainFrameUrl!==`siren://app/windows/docs.html?windowId=${grant.windowId}`||grant.entityIds.length!==1||!this.#registry.isCurrent(grant))return null;
  const entityId=grant.entityIds[0],document=this.#documentFor(grant,entityId);
  return document?.id===entityId&&this.#owner.canReadDomain(grant,'docs',entityId,flushNonce)?{grant,entityId,sha256:fingerprint(document)}:null;
 }
 async invoke({event,method,payload,flushNonce}){
  try{
   if(method!=='getDocument'||payload!=null&&(![Object.prototype,null].includes(Object.getPrototypeOf(payload))||Reflect.ownKeys(payload).length))return fail('REQUEST_REFUSED');
   const context=this.#context(event,flushNonce);if(!context)return fail('ACCESS_REFUSED');
   const result=await this.#owner.invoke(context.grant,{kind:'docs',method:'readDocument',payload:{entityId:context.entityId}},flushNonce);
   const current=this.#context(event,flushNonce);if(!current||current.grant.windowId!==context.grant.windowId||current.grant.epoch!==context.grant.epoch||flushNonce===undefined&&current.sha256!==context.sha256)return fail('ACCESS_REFUSED');
   if(result?.ok!==true)return fail(['ACCESS_REFUSED','ENTITY_REFUSED','WORKSPACE_PAUSED','DOMAIN_OPERATION_FAILED'].includes(result?.code)?result.code:'DOCUMENT_READ_FAILED');
   const expected=flushNonce===undefined?context:current;
   if(result.sha256!==expected.sha256||result.entityId!==expected.entityId)return fail('DOCUMENT_VERSION_CHANGED');
   return Object.freeze({ok:true,readonly:this.#readonly?this.#readonly(current.grant)!==false:true,document:result.entity,version:result.version,sha256:result.sha256,projectRevision:result.projectRevision,...(this.#editing?{canEdit:this.#editing(current.grant)===true}:{})});
  }catch{return fail('DOCUMENT_READ_FAILED');}
 }
}
