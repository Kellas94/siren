import {WindowRegistry} from './registry.mjs';
import {WorkspaceCoordinator} from './coordinator.mjs';
import {NativeDocsReads} from './docs-reads.mjs';
import {navigationFields} from '../navigation/contracts.mjs';
import {verifySnapshot} from '../projects/store.mjs';
import {workspaceMetadata} from './entities.mjs';
import {documentContentVersion} from './docs.mjs';
import {validId} from '../projects/paths.mjs';
import {SourceReaderPool} from '../sources/readers.mjs';
const fail=code=>Object.freeze({ok:false,code});
const error=code=>Object.assign(Error(code),{code});
const entity=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);

/** Docs-only admission to the exact saved source pointer. No caller-selected
 * project, source, version, path, writable role or private drain ticket. */
export class NativeDocsSources{
 #registry;#owner;#reads;#snapshotFor;#sources;#canOpen;#show;#previewReaders=new SourceReaderPool();#previews=0;
 constructor({registry,owner,reads,snapshotFor,sources,canOpen,show}){
  if(!(registry instanceof WindowRegistry)||!(owner instanceof WorkspaceCoordinator)||!(reads instanceof NativeDocsReads)||![snapshotFor,sources,canOpen,show].every(fn=>typeof fn==='function'))throw TypeError('NATIVE_DOCS_SOURCES_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#reads=reads;this.#snapshotFor=snapshotFor;this.#sources=sources;this.#canOpen=canOpen;this.#show=show;
 }
 #current(event,grant){
  const actual=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame});
  return Boolean(actual&&grant&&actual.windowId===grant.windowId&&actual.epoch===grant.epoch&&grant.role==='docs'&&grant.entityIds.length===1&&grant.mainFrameUrl===`siren://app/windows/docs.html?windowId=${grant.windowId}`&&this.#registry.isCurrent(grant)&&this.#canOpen(grant)===true&&this.#owner.canReadDomain(grant,'docs',grant.entityIds[0]));
 }
 #pointer(grant,input){
  const snapshot=this.#snapshotFor(grant);verifySnapshot(snapshot);
  if(snapshot.schema!==2||snapshot.project.id!==grant.projectId)throw error('ACCESS_REFUSED');
  const docs=(workspaceMetadata(snapshot).workpapers??[]).filter(doc=>doc?.id===grant.entityIds[0]);
  if(docs.length!==1)throw error('LINK_TARGET_REFUSED');const doc=docs[0];
  if(documentContentVersion(grant.projectId,doc)!==input.expectedDocumentVersion)throw error('DOCUMENT_CONFLICT');
  if(!Array.isArray(doc.blocks)||doc.blocks.length>4096)throw error('LINK_TARGET_REFUSED');
  const blocks=doc.blocks.filter(block=>block?.id===input.blockId);
  if(blocks.length!==1||blocks[0].kind!=='knowledge'||!Array.isArray(blocks[0].rows)||blocks[0].rows.length>65536)throw error('LINK_TARGET_REFUSED');
  const rows=blocks[0].rows.filter(row=>row?.id===input.rowId);if(rows.length!==1)throw error('LINK_TARGET_REFUSED');
  let point;try{point=navigationFields(rows[0].sourceRef,['sourceId','version','sha256']);}catch{throw error('LINK_TARGET_REFUSED');}
  if(!validId(point.sourceId)||!Number.isSafeInteger(point.version)||point.version<1||!hash(point.sha256)||!snapshot.sourceRefs.some(ref=>ref.sourceId===point.sourceId&&ref.version===point.version&&ref.sha256===point.sha256))throw error('LINK_TARGET_REFUSED');
  return point;
 }
 async invoke({event,method,payload,flushNonce}){
  let input,opened,reader,reserved=false;
  try{
   const preview=method==='previewLinkedSource';if(!preview&&method!=='openLinkedSource'||flushNonce!==undefined)throw error('REQUEST_REFUSED');
   try{input=navigationFields(payload,['blockId','rowId','expectedDocumentVersion',...(preview?['start']:[])]);}catch{throw error('REQUEST_REFUSED');}
   if(!entity(input.blockId)||!entity(input.rowId)||!hash(input.expectedDocumentVersion))throw error('REQUEST_REFUSED');
   if(preview&&(!Number.isSafeInteger(input.start)||input.start<0))throw error('REQUEST_REFUSED');
   const grant=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame});if(!this.#current(event,grant))throw error('ACCESS_REFUSED');
   if(preview){if(this.#previews>=2)throw error('SOURCE_READER_BUDGET');this.#previews++;reserved=true;}
   const point=this.#pointer(grant,input),current=()=>{
    if(!this.#current(event,grant))return false;try{const now=this.#pointer(grant,input);return now.sourceId===point.sourceId&&now.version===point.version&&now.sha256===point.sha256;}catch{return false;}
   };
   const document=await this.#reads.invoke({event,method:'getDocument'});
   if(!current())throw error('ACCESS_REFUSED');if(!document.ok||document.version!==input.expectedDocumentVersion)throw error('DOCUMENT_CONFLICT');
   const repository=this.#sources({grant,...(preview?{readers:this.#previewReaders}:{}),canWrite:context=>context?.action==='read'&&context.projectId===grant.projectId&&context.sourceId===point.sourceId&&current()});
   if(preview){
    reader=await repository.openReader({projectId:grant.projectId,sourceId:point.sourceId,version:point.version});
    if(!current())throw error('ACCESS_REFUSED');const info=reader.info;
    if(info.sourceId!==point.sourceId||info.version!==point.version||info.sha256!==point.sha256||!Number.isSafeInteger(info.utf16Units)||info.utf16Units<0)throw error('SOURCE_RESULT_REFUSED');
    if(input.start>info.utf16Units)throw error('SOURCE_RANGE_REFUSED');
    const chunk=await reader.readChunk({start:input.start,maxUnits:8192});
    if(!current())throw error('ACCESS_REFUSED');
    if(chunk.sourceId!==point.sourceId||chunk.version!==point.version||chunk.start!==input.start||!Number.isSafeInteger(chunk.end)||chunk.end<chunk.start||chunk.end>info.utf16Units||chunk.end-chunk.start>8192||typeof chunk.text!=='string'||chunk.text.length!==chunk.end-chunk.start||!chunk.text.isWellFormed())throw error('SOURCE_RESULT_REFUSED');
    return Object.freeze({ok:true,sourceRef:Object.freeze(point),start:chunk.start,end:chunk.end,totalUnits:info.utf16Units,text:chunk.text});
   }
   const metrics=await repository.getMetrics({projectId:grant.projectId,sourceId:point.sourceId,version:point.version});
   if(!current())throw error('ACCESS_REFUSED');if(metrics.sourceId!==point.sourceId||metrics.version!==point.version||metrics.sha256!==point.sha256)throw error('SOURCE_RESULT_REFUSED');
   opened=await this.#registry.openView({role:'code',entityId:point.sourceId,version:point.version});
   if(!current()||!this.#registry.listViews().some(view=>view.windowId===opened.windowId&&view.epoch===opened.epoch&&view.role==='code'&&view.projectId===grant.projectId&&view.entityId===point.sourceId))throw error('ACCESS_REFUSED');
   this.#show(opened);
   return Object.freeze({ok:true,view:Object.freeze({windowId:opened.windowId,role:opened.role,projectId:opened.projectId,epoch:opened.epoch,entityId:opened.entityId,state:opened.state})});
  }catch(cause){
   if(opened&&!await this.#registry.discardViewAsync(opened.windowId))return fail('WINDOW_DESTROY_FAILED');
   return fail(['REQUEST_REFUSED','ACCESS_REFUSED','DOCUMENT_CONFLICT','LINK_TARGET_REFUSED','SOURCE_RESULT_REFUSED','SOURCE_READER_BUDGET','SOURCE_RANGE_REFUSED','WINDOW_DESTROY_FAILED'].includes(cause?.code)?cause.code:['INVALID_RANGE','INVALID_UNICODE'].includes(cause?.code)?'SOURCE_RANGE_REFUSED':method==='previewLinkedSource'?'SOURCE_PREVIEW_FAILED':'SOURCE_OPEN_FAILED');
  }finally{
   try{reader?.dispose();}finally{if(reserved)this.#previews--;}
  }
 }
}
