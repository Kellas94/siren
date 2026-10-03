import {WindowRegistry} from './registry.mjs';
import {WorkspaceCoordinator} from './coordinator.mjs';

const fail=code=>Object.freeze({ok:false,code});
const reference=value=>value&&typeof value.sourceId==='string'&&Number.isSafeInteger(value.version)&&value.version>=1&&typeof value.sha256==='string'&&/^[a-f0-9]{64}$/.test(value.sha256)
 ?Object.freeze({sourceId:value.sourceId,version:value.version,sha256:value.sha256}):null;

/** Main-owned working source identities, separate from immutable selected
 * manifest references. Explicit admission reads the actual repository through
 * the shared owner. Only that owner's verified subscription advances drafts.
 * No renderer-supplied receipt or projected window ID can create an entry. */
export class NativeWorkingSources {
 #registry;#owner;#enabled;#snapshot;#views=new Map();#disposed=false;
 constructor({registry,owner,enabled,snapshotFor}){
  if(!(registry instanceof WindowRegistry)||!(owner instanceof WorkspaceCoordinator)||typeof enabled!=='function'||typeof snapshotFor!=='function')throw TypeError('NATIVE_WORKING_SOURCE_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#enabled=enabled;this.#snapshot=snapshotFor;
 }
 #context(grant){
  try{
   if(this.#disposed||!this.#registry.isCurrent(grant)||grant.role!=='code'||this.#enabled(grant)!==true)return null;
   const source=this.#registry.sourceScope(grant),snapshot=this.#snapshot();
   if(!source||Object.hasOwn(source,'version')||snapshot?.schema!==2||snapshot.project.id!==grant.projectId||!snapshot.sourceRefs.some(ref=>ref.sourceId===source.sourceId))return null;
   return {sourceId:source.sourceId,event:this.#registry.eventFor(grant)};
  }catch{return null;}
 }
 #entry(grant){
  const context=this.#context(grant),entry=context&&this.#views.get(grant.windowId);
  return entry&&!entry.invalid&&context.event?.sender===entry.event.sender&&context.event?.senderFrame===entry.event.senderFrame&&context.sourceId===entry.ref.sourceId?entry:null;
 }
 isWorking(grant){return Boolean(this.#entry(grant));}
 referenceFor(grant,request){
  const entry=this.#entry(grant);return entry&&(!request||request.sourceId===entry.ref.sourceId&&request.version===entry.ref.version)?entry.ref:null;
 }
 async admit(grant){
  const context=this.#context(grant);if(!context)return fail('ACCESS_REFUSED');
  for(const [id,entry] of this.#views)if(!this.#context(entry.grant)){entry.unsubscribe();this.#views.delete(id);}
  if(!this.#views.has(grant.windowId)&&this.#views.size>=64)return fail('WORKING_SOURCE_BUDGET');
  const metrics=await this.#owner.invoke(grant,{kind:'source',method:'getMetrics',payload:{sourceId:context.sourceId}});
  if(!this.#context(grant))return fail('ACCESS_REFUSED');if(!metrics.ok)return metrics;
  const ref=reference(metrics);if(!ref||ref.sourceId!==context.sourceId)return fail('SOURCE_RESULT_REFUSED');
  const previous=this.#views.get(grant.windowId);previous?.unsubscribe();
  const entry={grant,event:context.event,ref,invalid:false,unsubscribe:()=>{}};
  try{
   entry.unsubscribe=this.#owner.subscribe(grant,ref.sourceId,receipt=>{
    if(this.#disposed||this.#views.get(grant.windowId)!==entry||!this.#context(grant))return;
    const next=reference(receipt);
    if(!next||next.sourceId!==entry.ref.sourceId||next.version<entry.ref.version||next.version===entry.ref.version&&next.sha256!==entry.ref.sha256){entry.invalid=true;return;}
    entry.ref=next;
   });
   this.#views.set(grant.windowId,entry);
   return Object.freeze({ok:true,sourceRef:ref});
  }catch{this.#views.delete(grant.windowId);return fail('ACCESS_REFUSED');}
 }
 dispose(){if(this.#disposed)return;this.#disposed=true;for(const entry of this.#views.values())entry.unsubscribe();this.#views.clear();}
}
