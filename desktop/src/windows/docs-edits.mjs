import {WindowRegistry} from './registry.mjs';
import {WorkspaceCoordinator} from './coordinator.mjs';
import {workspaceEntities} from './entities.mjs';
import {normalizeDomainRequest} from './domain.mjs';
const fail=code=>Object.freeze({ok:false,code});
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

/** Main-owned document working-view admission. Neither a renderer flag nor a
 * same-origin URL creates it. The shared owner supplies real receipts; this
 * service does not clone project content or retry stale document edits. */
export class NativeDocsEdits{
 #registry;#owner;#enabled;#snapshot;#notify;#views=new Map();#disposed=false;
 constructor({registry,owner,enabled,snapshotFor,onReferenceChanged}){
  if(!(registry instanceof WindowRegistry)||!(owner instanceof WorkspaceCoordinator)||typeof enabled!=='function'||typeof snapshotFor!=='function'||onReferenceChanged!==undefined&&typeof onReferenceChanged!=='function')throw TypeError('NATIVE_DOCS_EDIT_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#enabled=enabled;this.#snapshot=snapshotFor;this.#notify=onReferenceChanged;
 }
 #context(grant){
  try{
   const snapshot=this.#snapshot();
   if(this.#disposed||!this.#registry.isCurrent(grant)||grant?.role!=='docs'||grant.mainFrameUrl!==`siren://app/windows/docs.html?windowId=${grant.windowId}`||grant.entityIds.length!==1||this.#enabled(grant)!==true||snapshot?.schema!==2||snapshot.project.id!==grant.projectId||!workspaceEntities(snapshot).docs.includes(grant.entityIds[0]))return null;
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
  if(!this.#views.has(grant.windowId)&&this.#views.size>=64)return fail('WORKING_DOCS_BUDGET');
  const actual=await this.#owner.invoke(grant,{kind:'docs',method:'readDocument',payload:{entityId:context.entityId}});
  if(!this.#context(grant))return fail('ACCESS_REFUSED');if(!actual.ok)return actual;
  if(actual.entityId!==context.entityId||!hash(actual.version)||!Number.isSafeInteger(actual.projectRevision))return fail('DOMAIN_RESULT_REFUSED');
  const previous=this.#views.get(grant.windowId);previous?.unsubscribe();
  const entry={grant,event:context.event,entityId:context.entityId,version:actual.version,projectRevision:actual.projectRevision,unsubscribe:()=>{}};
  try{
   entry.unsubscribe=this.#owner.subscribe(grant,context.entityId,(receipt,originWindowId)=>{
    const version=receipt?.version??receipt?.documentVersion,entityId=receipt?.entityId??receipt?.documentId;
    if(this.#views.get(grant.windowId)!==entry||!this.#context(grant)||receipt?.ok!==true||entityId!==entry.entityId||!hash(version)||!Number.isSafeInteger(receipt.projectRevision)||receipt.projectRevision<entry.projectRevision)return;
    const changed=version!==entry.version;entry.version=version;entry.projectRevision=receipt.projectRevision;
    if(changed&&originWindowId!==grant.windowId&&this.#owner.canReadDomain(grant,'docs',entry.entityId))try{this.#notify?.(grant,Object.freeze({documentId:entry.entityId,version:entry.version,projectRevision:entry.projectRevision}));}catch{/* A metadata observer cannot undo a committed document. */}
   },'docs');
   this.#views.set(grant.windowId,entry);return Object.freeze({ok:true});
  }catch{return fail('ACCESS_REFUSED');}
 }
 async invoke({event,method,payload,flushNonce}){
  let request;try{if(!['applyDocument','flushDocument'].includes(method))return fail('REQUEST_REFUSED');request=normalizeDomainRequest('docs',method,payload);}catch{return fail('REQUEST_REFUSED');}
  const grant=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame}),entry=this.#entry(grant);
  if(!entry||(request.documentId??request.entityId)!==entry.entityId)return fail('ACCESS_REFUSED');
  const result=await this.#owner.invoke(grant,{kind:'docs',method,payload:request},flushNonce);
  return this.#entry(grant)?result:fail('ACCESS_REFUSED');
 }
 dispose(){if(this.#disposed)return;this.#disposed=true;for(const entry of this.#views.values())entry.unsubscribe();this.#views.clear();}
}
