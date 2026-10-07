import {navigationFields} from '../navigation/contracts.mjs';
import {workspaceMetadata,validEntityId} from './entities.mjs';
import {documentContentVersion} from './docs.mjs';
import {isWholeReference} from '../documents/context.mjs';
const fail=code=>Object.freeze({ok:false,code}),refuse=code=>{throw Object.assign(Error(code),{code});};
const label=v=>typeof v==='string'?v.toWellFormed().slice(0,160).replace(/[\uD800-\uDBFF]$/,''):'';
/** Metadata-only discovery and saved-reference navigation for one bound Docs
 * window. Neither operation accepts a caller-selected target or write grant. */
export class NativeDocsReferences{
 #registry;#owner;#reads;#snapshot;#canOpen;#show;
 constructor({registry,owner,reads,snapshotFor,canOpen,show}){
  if(!['capture','isCurrent','openView','discardViewAsync'].every(k=>typeof registry?.[k]==='function')||typeof owner?.canReadDomain!=='function'||typeof reads?.invoke!=='function'||![snapshotFor,canOpen,show].every(v=>typeof v==='function'))throw TypeError('DOCS_REFERENCE_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#reads=reads;this.#snapshot=snapshotFor;this.#canOpen=canOpen;this.#show=show;
 }
 #capture(event){const g=this.#registry.capture(event);return g?.role==='docs'&&g.entityIds.length===1&&g.mainFrameUrl===`siren://app/windows/docs.html?windowId=${g.windowId}`&&this.#registry.isCurrent(g)&&this.#canOpen(g)&&this.#owner.canReadDomain(g,'docs',g.entityIds[0])?g:null;}
 async invoke({event,method,payload,flushNonce}){
  let opened;
  try{
   if(flushNonce!==undefined||!['getTargets','openReference'].includes(method))refuse('REQUEST_REFUSED');let p;try{p=navigationFields(payload??{},method==='getTargets'?['cursor','kind','query']:['index','expectedDocumentVersion'],method==='getTargets'?[]:['index','expectedDocumentVersion']);}catch{refuse('REQUEST_REFUSED');}
   if(method==='getTargets'&&(!Number.isSafeInteger(p.cursor??0)||(p.cursor??0)<0||(p.cursor??0)>4096||p.kind!==undefined&&!['diagram','document'].includes(p.kind)||p.query!==undefined&&(typeof p.query!=='string'||!p.query.isWellFormed()||p.query.length>160||/[\u0000-\u001f\u007f]/.test(p.query)))||method==='openReference'&&(!Number.isInteger(p.index)||p.index<0||p.index>=60||typeof p.expectedDocumentVersion!=='string'||!/^[a-f0-9]{64}$/.test(p.expectedDocumentVersion)))refuse('REQUEST_REFUSED');
   const grant=this.#capture(event);if(!grant)refuse('ACCESS_REFUSED');
   const snapshot=this.#snapshot(grant),metadata=workspaceMetadata(snapshot),matches=(metadata.workpapers??[]).filter(v=>v.id===grant.entityIds[0]);if(snapshot.project.id!==grant.projectId||matches.length!==1)refuse('ACCESS_REFUSED');
   const version=documentContentVersion(grant.projectId,matches[0]),current=()=>{const g=this.#capture(event);if(!g||g.windowId!==grant.windowId||g.epoch!==grant.epoch)return false;const s=this.#snapshot(g),docs=(workspaceMetadata(s).workpapers??[]).filter(v=>v.id===grant.entityIds[0]);return s.project.id===grant.projectId&&docs.length===1&&documentContentVersion(grant.projectId,docs[0])===version;};
   const read=await this.#reads.invoke({event,method:'getDocument'});if(!current())refuse('ACCESS_REFUSED');if(!read.ok||read.version!==version)refuse('DOCUMENT_CONFLICT');
   const rows=[],seen=new Set();for(const [kind,list]of [['document',metadata.workpapers??[]],['diagram',metadata.diagrams??[]]])for(const v of list){if(!validEntityId(v?.id)||kind==='document'&&v.id===grant.entityIds[0])continue;const key=kind+':'+v.id;if(seen.has(key))refuse('LINK_TARGET_REFUSED');seen.add(key);rows.push({kind,id:v.id,label:label(kind==='document'?v.title:v.name)||'Untitled '+kind});}
   if(method==='getTargets'){const query=(p.query??'').trim().normalize('NFKC').toLowerCase(),items=rows.slice(0,4096).filter(v=>(!p.kind||v.kind===p.kind)&&(!query||v.label.normalize('NFKC').toLowerCase().includes(query))),cursor=p.cursor??0,page=items.slice(cursor,cursor+64);return {ok:true,version,items:page,nextCursor:cursor+page.length,hasMore:cursor+page.length<items.length,truncated:rows.length>4096};}
   if(p.expectedDocumentVersion!==version)refuse('DOCUMENT_CONFLICT');const link=matches[0].links?.[p.index];if(!isWholeReference(link))refuse('LINK_TARGET_REFUSED');const id=link.kind==='diagram'?link.diagramId:link.documentId,target=rows.find(v=>v.kind===link.kind&&v.id===id);if(!target)refuse('LINK_TARGET_REFUSED');
   opened=await this.#registry.openView({role:target.kind==='document'?'docs':'diagram',entityId:target.id});if(!current()||!this.#registry.listViews().some(v=>v.windowId===opened.windowId&&v.epoch===opened.epoch&&v.projectId===grant.projectId&&v.entityId===target.id))refuse('ACCESS_REFUSED');this.#show(opened);
   return {ok:true,view:{windowId:opened.windowId,role:opened.role,entityId:opened.entityId,projectId:opened.projectId,epoch:opened.epoch}};
  }catch(e){if(opened&&!await this.#registry.discardViewAsync(opened.windowId))return fail('WINDOW_DESTROY_FAILED');return fail(['REQUEST_REFUSED','ACCESS_REFUSED','DOCUMENT_CONFLICT','LINK_TARGET_REFUSED'].includes(e?.code)?e.code:'REFERENCE_FAILED');}
 }
}
