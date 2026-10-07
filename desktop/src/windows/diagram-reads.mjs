import {digest} from '../projects/atomic.mjs';
import {WindowRegistry} from './registry.mjs';
import {WorkspaceCoordinator} from './coordinator.mjs';
const fail=code=>Object.freeze({ok:false,code});
const fingerprint=value=>value?digest(Buffer.from(JSON.stringify(value))):null;

/** Actual selected single-diagram transport. The genuine native frame supplies
 * its identity; renderer payloads cannot select a project/entity or write role. */
export class NativeDiagramReads{
 #registry;#owner;#diagramFor;#readonly;#editing;
 constructor({registry,owner,diagramFor,readonlyFor,editingState}){
  if(!(registry instanceof WindowRegistry)||!(owner instanceof WorkspaceCoordinator)||typeof diagramFor!=='function'||readonlyFor!==undefined&&typeof readonlyFor!=='function'||editingState!==undefined&&typeof editingState!=='function')throw TypeError('NATIVE_DIAGRAM_READ_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#diagramFor=diagramFor;this.#readonly=readonlyFor;this.#editing=editingState;
 }
 #context(event,flushNonce){
  const grant=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame});
  if(grant?.role!=='diagram'||grant.mainFrameUrl!==('siren://app/windows/diagram.html?windowId='+grant.windowId)||grant.entityIds.length!==1||!this.#registry.isCurrent(grant))return null;
  const entityId=grant.entityIds[0],diagram=this.#diagramFor(grant,entityId),version=diagram?.sirenNativeVersion??1;
  return diagram?.id===entityId&&Number.isSafeInteger(version)&&version>=1&&this.#owner.canReadDomain(grant,'diagram',entityId,flushNonce)?{grant,entityId,version,sha256:fingerprint(diagram)}:null;
 }
 async invoke({event,method,payload,flushNonce}){
  try{
   if(method!=='getDiagram'||payload!=null&&(![Object.prototype,null].includes(Object.getPrototypeOf(payload))||Reflect.ownKeys(payload).length))return fail('REQUEST_REFUSED');
   const context=this.#context(event,flushNonce);if(!context)return fail('ACCESS_REFUSED');
   const result=await this.#owner.invoke(context.grant,{kind:'diagram',method:'readDiagram',payload:{entityId:context.entityId}},flushNonce);
   const current=this.#context(event,flushNonce);if(!current||current.grant.windowId!==context.grant.windowId||current.grant.epoch!==context.grant.epoch||flushNonce===undefined&&current.sha256!==context.sha256)return fail('ACCESS_REFUSED');
   if(result?.ok!==true)return fail(['ACCESS_REFUSED','ENTITY_REFUSED','WORKSPACE_PAUSED','DOMAIN_OPERATION_FAILED'].includes(result?.code)?result.code:'DIAGRAM_READ_FAILED');
   const expected=flushNonce===undefined?context:current;
   if(result.sha256!==expected.sha256||result.entityId!==expected.entityId||result.version!==expected.version)return fail('DIAGRAM_VERSION_CHANGED');
   return Object.freeze({ok:true,readonly:this.#readonly?this.#readonly(current.grant)!==false:true,diagram:result.entity,version:result.version,sha256:result.sha256,projectRevision:result.projectRevision,...(this.#editing?{canEdit:this.#editing(current.grant)===true}:{})});
  }catch{return fail('DIAGRAM_READ_FAILED');}
 }
}
