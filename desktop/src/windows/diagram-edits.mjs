import {WindowRegistry} from './registry.mjs';
import {WorkspaceCoordinator} from './coordinator.mjs';
import {workspaceEntities} from './entities.mjs';
import {normalizeDomainRequest} from './domain.mjs';
const fail=code=>Object.freeze({ok:false,code});
const version=value=>Number.isSafeInteger(value)&&value>=1;

/** Main-only working Diagram admission. Typed mutations retain the shared
 * owner's entity CAS and recovery semantics; no satellite full-project save. */
export class NativeDiagramEdits{
 #registry;#owner;#enabled;#snapshot;#notify;#views=new Map();#disposed=false;
 constructor({registry,owner,enabled,snapshotFor,onReferenceChanged}){
  if(!(registry instanceof WindowRegistry)||!(owner instanceof WorkspaceCoordinator)||typeof enabled!=='function'||typeof snapshotFor!=='function'||onReferenceChanged!==undefined&&typeof onReferenceChanged!=='function')throw TypeError('NATIVE_DIAGRAM_EDIT_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#enabled=enabled;this.#snapshot=snapshotFor;this.#notify=onReferenceChanged;
 }
 #context(grant){
  try{
   const snapshot=this.#snapshot();
   if(this.#disposed||!this.#registry.isCurrent(grant)||grant?.role!=='diagram'||grant.mainFrameUrl!==('siren://app/windows/diagram.html?windowId='+grant.windowId)||grant.entityIds.length!==1||this.#enabled(grant)!==true||snapshot?.schema!==2||snapshot.project.id!==grant.projectId||!workspaceEntities(snapshot).diagram.includes(grant.entityIds[0]))return null;
   return {entityId:grant.entityIds[0],event:this.#registry.eventFor(grant)};
  }catch{return null;}
 }
 #entry(grant){
  const context=this.#context(grant),entry=context&&this.#views.get(grant.windowId);
  return entry&&entry.entityId===context.entityId&&entry.event.sender===context.event?.sender&&entry.event.senderFrame===context.event?.senderFrame?entry:null;
 }
 isWorking(grant){return Boolean(this.#entry(grant));}
 async admit(grant){
  const context=this.#context(grant);if(!context)return fail('ACCESS_REFUSED');
  for(const [id,entry]of this.#views)if(!this.#context(entry.grant)){entry.unsubscribe();this.#views.delete(id);}
  if(!this.#views.has(grant.windowId)&&this.#views.size>=64)return fail('WORKING_DIAGRAM_BUDGET');
  const actual=await this.#owner.invoke(grant,{kind:'diagram',method:'readDiagram',payload:{entityId:context.entityId}});
  if(!this.#context(grant))return fail('ACCESS_REFUSED');if(!actual.ok)return actual;
  if(actual.entityId!==context.entityId||!version(actual.version)||!Number.isSafeInteger(actual.projectRevision))return fail('DOMAIN_RESULT_REFUSED');
  this.#views.get(grant.windowId)?.unsubscribe();
  const entry={grant,event:context.event,entityId:context.entityId,version:actual.version,projectRevision:actual.projectRevision,unsubscribe:()=>{}};
  try{
   entry.unsubscribe=this.#owner.subscribe(grant,entry.entityId,(receipt,originWindowId)=>{
    if(this.#views.get(grant.windowId)!==entry||!this.#context(grant)||receipt?.ok!==true||receipt.entityId!==entry.entityId||!version(receipt.version)||!Number.isSafeInteger(receipt.projectRevision)||receipt.projectRevision<entry.projectRevision)return;
    const changed=entry.version!==receipt.version;entry.version=receipt.version;entry.projectRevision=receipt.projectRevision;
    if(changed&&originWindowId!==grant.windowId&&this.#owner.canReadDomain(grant,'diagram',entry.entityId))try{this.#notify?.(grant,Object.freeze({diagramId:entry.entityId,version:entry.version,projectRevision:entry.projectRevision}));}catch{/* Observer failure cannot undo a genuine committed edit. */}
   },'diagram');this.#views.set(grant.windowId,entry);return Object.freeze({ok:true});
  }catch{return fail('ACCESS_REFUSED');}
 }
 async invoke({event,method,payload,flushNonce}){
  let request;try{if(!['applyDiagram','flushDiagram'].includes(method))return fail('REQUEST_REFUSED');request=normalizeDomainRequest('diagram',method,payload);}catch{return fail('REQUEST_REFUSED');}
  const grant=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame}),entry=this.#entry(grant);
  if(!entry||(request.diagramId??request.entityId)!==entry.entityId)return fail('ACCESS_REFUSED');
  const result=await this.#owner.invoke(grant,{kind:'diagram',method,payload:request},flushNonce);
  return this.#entry(grant)?result:fail('ACCESS_REFUSED');
 }
 dispose(){if(this.#disposed)return;this.#disposed=true;for(const entry of this.#views.values())entry.unsubscribe();this.#views.clear();}
}
