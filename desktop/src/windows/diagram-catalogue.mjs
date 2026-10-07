import {WindowRegistry} from './registry.mjs';
import {WorkspaceCoordinator} from './coordinator.mjs';
import {createDiagramCatalogueContract} from '../documents/diagram-catalogue.mjs';
import {normalizeCatalogueCreation,matchesCatalogueCreation} from './diagram-create.mjs';
import {workspaceMetadata} from './entities.mjs';
const catalogue=createDiagramCatalogueContract(),fail=code=>Object.freeze({ok:false,code});
const refuse=code=>{throw Object.assign(new Error(code),{code});};

/** Main-only append/open service. Persistence uses the owner FIFO; native
 * working admission queues a read AFTER that transaction has left the FIFO.
 * No renderer path, sibling ID or frame can substitute the created identity. */
export class NativeDiagramCatalogue{
 #registry;#owner;#browse;#create;#snapshot;#window;#admit;#working;#show;#notify;#failure;
 #disposed=false;#pending=0;#opening=new Map();
 constructor({registry,owner,canBrowse,canCreate,snapshotFor,windowFor,admit,isWorking,show,onCreated,onNativeFailure}){
  if(!(registry instanceof WindowRegistry)||!(owner instanceof WorkspaceCoordinator)||![canBrowse,canCreate,snapshotFor,windowFor,admit,isWorking,show].every(v=>typeof v==='function')||[onCreated,onNativeFailure].some(v=>v!==undefined&&typeof v!=='function'))throw TypeError('NATIVE_CATALOGUE_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#browse=canBrowse;this.#create=canCreate;this.#snapshot=snapshotFor;this.#window=windowFor;this.#admit=admit;this.#working=isWorking;this.#show=show;this.#notify=onCreated;this.#failure=onNativeFailure;
 }
 #context(g){
  try{const s=this.#snapshot(g);return !this.#disposed&&this.#registry.isCurrent(g)&&this.#browse(g)===true&&s?.project.id===g.projectId&&
   (g.role==='diagram'&&g.entityIds.length===1||g.role==='workspace'&&g.entityIds.length===0&&g.mainFrameUrl==='siren://app/home.html');}catch{return false;}
 }
 #frame(view){const window=this.#window(view.windowId);return window&&!window.isDestroyed()?this.#registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame}):null;}
 #available(g,receipt,request){
  const s=this.#snapshot(g),list=workspaceMetadata(s).diagrams;
  if(s?.schema!==2||s.project.id!==g.projectId||s.revision<receipt.current.projectRevision||!Array.isArray(list))return false;
  const matches=list.filter(d=>d?.id===receipt.entityId);
  return matches.length===1&&matchesCatalogueCreation(matches[0],request,g.projectId);
 }
 #view(view){return Object.freeze({windowId:view.windowId,role:'diagram',entityId:view.entityId,epoch:view.epoch});}
 async #open(g,receipt,request,current){
  let opened;
  try{
   if(!current())refuse('ACCESS_REFUSED');if(!this.#available(g,receipt,request))return fail('ENTITY_REFUSED');
   // Reuse an authentic already admitted editor. Never reload its draft.
   const existing=this.#registry.listViews().find(v=>v.role==='diagram'&&v.projectId===g.projectId&&v.entityId===receipt.entityId&&this.#working(this.#frame(v))===true);
   if(existing){if(!current()||!this.#available(g,receipt,request))refuse('ACCESS_REFUSED');this.#show(existing);if(!current()||!this.#available(g,receipt,request))refuse('ACCESS_REFUSED');return Object.freeze({ok:true,view:this.#view(existing)});}
   opened=await this.#registry.openView({role:'diagram',entityId:receipt.entityId});
   if(!current()||opened.projectId!==g.projectId||opened.entityId!==receipt.entityId||!this.#available(g,receipt,request))refuse('ACCESS_REFUSED');
   const fresh=this.#frame(opened);if(!fresh||!this.#registry.isCurrent(fresh))refuse('ACCESS_REFUSED');
   const admitted=await this.#admit(fresh);
   if(!current()||admitted?.ok!==true||this.#working(fresh)!==true||!this.#available(g,receipt,request))refuse('OPEN_UNAVAILABLE');
   this.#show(opened);if(!current()||!this.#available(g,receipt,request))refuse('ACCESS_REFUSED');
   return Object.freeze({ok:true,view:this.#view(opened)});
  }catch(cause){
   if(opened&&!await this.#registry.discardViewAsync(opened.windowId)){
    try{this.#failure?.(Object.freeze({code:'WINDOW_DESTROY_FAILED'}));}catch{/* A notification cannot hide a retained failed handle. */}
    return fail('WINDOW_DESTROY_FAILED');
   }
   if(cause?.code==='WINDOW_DESTROY_FAILED')try{this.#failure?.(Object.freeze({code:'WINDOW_DESTROY_FAILED'}));}catch{}
   return fail(cause?.code==='WINDOW_DESTROY_FAILED'?'WINDOW_DESTROY_FAILED':cause?.code==='ACCESS_REFUSED'?'ACCESS_REFUSED':'OPEN_UNAVAILABLE');
  }
 }
 async invoke({event,method,payload}){
  if(!['getPage','createDiagram'].includes(method))return fail('REQUEST_REFUSED');
  const native=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame});
  const grant=native?.role==='workspace'?this.#registry.capturePrimary(event):native;
  if(!grant||!this.#context(grant))return fail('ACCESS_REFUSED');
  if(method==='getPage'){
   const page=catalogue.page(payload??{});if(!page.ok)return fail('REQUEST_REFUSED');
   return Object.freeze({...page,version:catalogue.version,referenceSha256:catalogue.referenceSha256,canCreate:this.#create(grant)===true&&this.#owner.captureCatalogueGuard(grant)!==null});
  }
  let request;try{request=normalizeCatalogueCreation(payload);}catch{return fail('REQUEST_REFUSED');}
  if(this.#create(grant)!==true)return fail('ACCESS_REFUSED');
  const guard=this.#owner.captureCatalogueGuard(grant);let revoked=false;
  const current=()=>{if(revoked)return false;if(!this.#context(grant)||this.#create(grant)!==true||guard?.isCurrent()!==true){revoked=true;return false;}return true;};
  if(!current())return fail('ACCESS_REFUSED');if(this.#pending>=64)return fail('OWNER_BUDGET');this.#pending++;
  try{
   const receipt=await this.#owner.invoke(grant,{kind:'catalogue',method:'appendDiagram',payload:request});
   if(!current())return fail('ACCESS_REFUSED');if(!receipt.ok)return receipt;
   try{this.#notify?.(Object.freeze({projectId:grant.projectId,projectRevision:receipt.current.projectRevision}));}catch{/* Metadata notification does not roll back a committed append. */}
   if(!current())return fail('ACCESS_REFUSED');
   if(receipt.current.available!==true)return Object.freeze({...receipt,opening:fail('ENTITY_REFUSED')});
   const key=grant.projectId+':'+request.operationId;let opening=this.#opening.get(key);
   if(!opening){opening=this.#open(grant,receipt,request,current);this.#opening.set(key,opening);}
   const result=await opening;
   if(this.#opening.get(key)===opening)this.#opening.delete(key);
   // Failed cleanup fences the registry, which also revokes the caller guard.
   // Preserve that generic failure signal without exposing private receipts.
   if(result.code==='WINDOW_DESTROY_FAILED')return fail('WINDOW_DESTROY_FAILED');
   if(!current())return fail('ACCESS_REFUSED');
   if(result.ok){const fresh=this.#frame(result.view);if(!fresh||!this.#working(fresh)||!this.#available(grant,receipt,request))return Object.freeze({...receipt,opening:fail('OPEN_UNAVAILABLE')});}
   return Object.freeze({...receipt,opening:result});
  }catch{return current()?fail('CATALOGUE_CREATION_FAILED'):fail('ACCESS_REFUSED');}
  finally{this.#pending--;}
 }
 dispose(){this.#disposed=true;}
}
