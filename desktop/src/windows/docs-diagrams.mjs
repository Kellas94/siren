import {randomUUID} from 'node:crypto';
import {navigationFields} from '../navigation/contracts.mjs';
import {validId} from '../projects/paths.mjs';
import {digest} from '../projects/atomic.mjs';
import {workspaceMetadata,validEntityId} from './entities.mjs';
import {documentVersion} from './docs.mjs';
import {normalizeDiagramEmbed,normalizeDiagramEmbedSuspensions,DIAGRAM_EMBED_ASSET_BYTES} from '../documents/diagram-embeds.mjs';
import {createDiagramEmbedPublication} from '../documents/diagram-embed-publication.mjs';
import {inspectDiagramSelection} from '../documents/diagram-selection.mjs';
const refuse=code=>{throw Object.assign(Error(code),{code});},fail=code=>Object.freeze({ok:false,code});
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),fingerprint=v=>digest(Buffer.from(JSON.stringify(v)));
const copy=v=>JSON.parse(JSON.stringify(v));
const methods={listDiagrams:['cursor','query'],inspectSelection:['diagramId'],preview:['diagramId','scope','nodeIds'],insert:['previewId','afterBlockId','caption','expectedDocumentVersion','operationId'],readEmbed:['blockId','expectedDocumentVersion'],openSource:['blockId','expectedDocumentVersion'],setMode:['blockId','mode','expectedDocumentVersion','operationId'],update:['blockId','expectedDocumentVersion','operationId']};
Object.assign(methods,{listDocuments:['cursor','query'],sendToDocs:['documentId','scope','nodeIds','expectedVersion','expectedSha256'],getProposal:[]});
/** Main-owned preview receipts and document publication. The render adapter is
 * trusted and must validate its visual before returning; IPC accepts no bytes.
 * Pure tests use inert fixture visuals and do not qualify a native renderer. */
export class NativeDocsDiagrams{
 #registry;#owner;#assets;#snapshot;#render;#identity;#cache=new Map();#working;#show;#failed=false;#paused=false;#disposed=false;#generation=0;#pending=new Set();#previews=new Map();#publications=new Map();#proposals=new Map();
 constructor({registry,owner,projects,assets,snapshotFor,render,renderIdentityFor,workingState,show}){
  if(!['capture','isCurrent','captureAdmissionGuard'].every(k=>typeof registry?.[k]==='function')||!['invoke','canReadDomain','captureDomainGuard'].every(k=>typeof owner?.[k]==='function')||typeof projects?.readProject!=='function'||!['read','put'].every(k=>typeof assets?.[k]==='function')||![snapshotFor,render,workingState].every(v=>typeof v==='function'))throw TypeError('DOCS_DIAGRAM_ADAPTERS_REQUIRED');
  if(renderIdentityFor!==undefined&&typeof renderIdentityFor!=='function')throw TypeError('DOCS_DIAGRAM_RENDER_IDENTITY_REQUIRED');this.#identity=renderIdentityFor;
  this.#registry=registry;this.#owner=owner;this.#assets=assets;this.#snapshot=snapshotFor;this.#render=render;this.#working=workingState;this.#show=show;
 }
 #capture(event,role='docs'){
  const g=this.#registry.capture(event);
  if(this.#failed||this.#paused||this.#disposed||g?.role!==role||g.entityIds.length!==1||g.mainFrameUrl!==`siren://app/windows/${role}.html?windowId=${g.windowId}`||!this.#registry.isCurrent(g)||!this.#owner.canReadDomain(g,role==='diagram'?'diagram':'docs',g.entityIds[0]))refuse('ACCESS_REFUSED');return g;
 }
 #guard(grant,write=false){
  const generation=this.#generation,admission=this.#owner.captureDomainGuard(grant,grant.role==='diagram'?'diagram':'docs',grant.entityIds[0]);let revoked=false;
  return ()=>{if(this.#disposed||this.#paused||generation!==this.#generation||admission?.isCurrent()!==true||write&&this.#working(grant)!==true)revoked=true;if(revoked)refuse('ACCESS_REFUSED');return true;};
 }
 async #state(grant,current){
  current();const snapshot=await this.#snapshot(grant);current();if(snapshot?.project?.id!==grant.projectId)refuse('ACCESS_REFUSED');const version=documentVersion(snapshot,grant.entityIds[0]),workspace=workspaceMetadata(snapshot),doc=workspace.workpapers.filter(d=>d?.id===grant.entityIds[0]);if(doc.length!==1)refuse('ACCESS_REFUSED');return {snapshot,workspace,doc:doc[0],version};
 }
 #request(method,payload){
  if(!Object.hasOwn(methods,method))refuse('REQUEST_REFUSED');let p;try{p=navigationFields(payload??{},method==='setMode'?[...methods[method],'previewId']:methods[method],['listDiagrams','listDocuments'].includes(method)?[]:methods[method]);}catch{refuse('REQUEST_REFUSED');}
  if(Object.hasOwn(p,'previewId')&&method==='setMode'&&(!validId(p.previewId)||p.mode!=='live'))refuse('REQUEST_REFUSED');
  if(method==='getProposal')return p;
  if(method==='sendToDocs'){if(!validEntityId(p.documentId)||!Number.isSafeInteger(p.expectedVersion)||p.expectedVersion<1||!hash(p.expectedSha256))refuse('REQUEST_REFUSED');p.nodeIds=this.#request('preview',{diagramId:'source',scope:p.scope,nodeIds:p.nodeIds}).nodeIds;return p;}
  if(['listDiagrams','listDocuments'].includes(method)){
   if(!Number.isSafeInteger(p.cursor??0)||(p.cursor??0)<0||(p.cursor??0)>4096||p.query!==undefined&&(typeof p.query!=='string'||!p.query.isWellFormed()||p.query.length>160))refuse('REQUEST_REFUSED');
  }else if(method==='inspectSelection'){if(!validEntityId(p.diagramId))refuse('REQUEST_REFUSED');
  }else if(method==='preview'){
   if(!Array.isArray(p.nodeIds)||Object.getPrototypeOf(p.nodeIds)!==Array.prototype)refuse('REQUEST_REFUSED');
   const fields=Object.getOwnPropertyDescriptors(p.nodeIds),length=fields.length?.value;
   if(!Number.isInteger(length)||length>250||Reflect.ownKeys(fields).length!==length+1)refuse('REQUEST_REFUSED');
   p.nodeIds=Array.from({length},(_,i)=>{const d=fields[i];if(!d||!Object.hasOwn(d,'value'))refuse('REQUEST_REFUSED');return d.value;});
   if(!validEntityId(p.diagramId)||!['whole','selection'].includes(p.scope)||!Array.isArray(p.nodeIds)||p.nodeIds.length>250||p.scope==='whole'&&p.nodeIds.length||p.scope==='selection'&&!p.nodeIds.length||new Set(p.nodeIds).size!==p.nodeIds.length||p.nodeIds.some(v=>typeof v!=='string'||!/^[A-Za-z_][\w.-]{0,127}$/.test(v)))refuse('REQUEST_REFUSED');p.nodeIds=[...p.nodeIds];
  }else{
   if(!hash(p.expectedDocumentVersion)||!['readEmbed','openSource'].includes(method)&&!validId(p.operationId)||method==='insert'&&(!validId(p.previewId)||p.afterBlockId!==null&&!validEntityId(p.afterBlockId)||typeof p.caption!=='string'||!p.caption.isWellFormed()||p.caption.length>1000)||method!=='insert'&&!validEntityId(p.blockId)||method==='setMode'&&!['live','fixed'].includes(p.mode))refuse('REQUEST_REFUSED');
  }return p;
 }
 async #transfer(event,method,p){
  const grant=this.#capture(event,'diagram'),current=this.#guard(grant);let opened;
  const state=async()=>{current();const snapshot=await this.#snapshot(grant);current();if(snapshot?.project?.id!==grant.projectId)refuse('ACCESS_REFUSED');const workspace=workspaceMetadata(snapshot),matches=(workspace.diagrams??[]).filter(d=>d?.id===grant.entityIds[0]);if(matches.length!==1)refuse('DIAGRAM_EMBED_SOURCE_CHANGED');return {workspace,diagram:matches[0]};};
  const captured=await state();if(method==='listDocuments'){const q=(p.query??'').trim().normalize('NFKC').toLowerCase(),seen=new Set(),rows=[];for(const doc of captured.workspace.workpapers??[]){if(!validEntityId(doc.id)||seen.has(doc.id))refuse('DIAGRAM_EMBED_REFUSED');seen.add(doc.id);const label=typeof doc.title==='string'?doc.title.toWellFormed().slice(0,160):'Untitled document';if(!q||label.normalize('NFKC').toLowerCase().includes(q))rows.push({id:doc.id,label});if(seen.size>4096)refuse('DIAGRAM_EMBED_BUDGET');}const cursor=p.cursor??0,items=rows.slice(cursor,cursor+64);return {ok:true,items,nextCursor:cursor+items.length,hasMore:cursor+items.length<rows.length};}
  const check=s=>{if((s.diagram.sirenNativeVersion??1)!==p.expectedVersion||fingerprint(s.diagram)!==p.expectedSha256)refuse('DIAGRAM_EMBED_SOURCE_CHANGED');if((s.workspace.workpapers??[]).filter(d=>d?.id===p.documentId).length!==1)refuse('DIAGRAM_EMBED_REFUSED');};check(captured);
  if(p.scope==='selection'){const model=inspectDiagramSelection({source:captured.diagram.source,nodeIds:p.nodeIds});if(!model.ok)refuse(model.code);}
  if(typeof this.#show!=='function')refuse('REQUEST_REFUSED');
  try{opened=await this.#registry.openView({role:'docs',entityId:p.documentId});check(await state());if(opened.projectId!==grant.projectId||opened.role!=='docs'||opened.entityId!==p.documentId)refuse('ACCESS_REFUSED');for(const [k,v]of this.#proposals)if(v.expires<Date.now())this.#proposals.delete(k);const key=grant.projectId+':'+p.documentId;if(!this.#proposals.has(key)&&this.#proposals.size>=64)refuse('DIAGRAM_EMBED_BUDGET');this.#show(opened);current();this.#proposals.set(key,{diagramId:grant.entityIds[0],scope:p.scope,nodeIds:[...p.nodeIds],sourceHash:p.expectedSha256,expires:Date.now()+300000});return {ok:true,view:{windowId:opened.windowId,role:opened.role,projectId:opened.projectId,entityId:opened.entityId,epoch:opened.epoch}};}
  catch(e){if(opened&&!await this.#registry.discardViewAsync(opened.windowId)){this.#failed=true;refuse('WINDOW_DESTROY_FAILED');}throw e;}
 }
 #nativeRefreshGuard({capability,isCurrent}){
  const generation=this.#generation;let revoked=false;
  return()=>{if(revoked||this.#failed||this.#disposed||this.#paused||generation!==this.#generation||typeof isCurrent!=='function'||isCurrent()!==true||capability&&capability.isCurrent()!==true){revoked=true;refuse('ACCESS_REFUSED');}return true;};
 }
 async listRefreshTargets({projectId,diagramId,isCurrent}){
  const current=this.#nativeRefreshGuard({isCurrent});current();const snapshot=await this.#snapshot({projectId});current();if(snapshot?.project?.id!==projectId)refuse('ACCESS_REFUSED');const rows=[],seen=new Set();
  for(const doc of workspaceMetadata(snapshot).workpapers??[]){if(!validEntityId(doc.id)||seen.has(doc.id))refuse('DIAGRAM_EMBED_REFUSED');seen.add(doc.id);for(const value of doc.blocks??[]){if(value?.kind!=='diagram-embed'||value.diagramId!==diagramId)continue;const block=normalizeDiagramEmbed(value);if(block.mode==='live')rows.push({documentId:doc.id,blockId:block.id,mode:block.mode});if(rows.length>4096)refuse('DIAGRAM_EMBED_BUDGET');}}
  return rows;
 }
 async listRefreshSources({projectId,isCurrent}){
  const current=this.#nativeRefreshGuard({isCurrent});current();const snapshot=await this.#snapshot({projectId});current();if(snapshot?.project?.id!==projectId)refuse('ACCESS_REFUSED');const workspace=workspaceMetadata(snapshot),ids=new Set();
  for(const doc of workspace.workpapers??[])for(const value of doc.blocks??[]){if(value?.kind!=='diagram-embed')continue;const block=normalizeDiagramEmbed(value);if(block.mode==='live')ids.add(block.diagramId);if(ids.size>4096)refuse('DIAGRAM_EMBED_BUDGET');}
  return [...ids].map(diagramId=>{const matches=(workspace.diagrams??[]).filter(d=>d?.id===diagramId);if(matches.length>1)refuse('DIAGRAM_EMBED_REFUSED');const diagram=matches[0];return {projectId,diagramId,sourceHash:fingerprint(diagram??{diagramId,missing:true,revision:snapshot.revision}),sourceVersion:diagram?.sirenNativeVersion??1,projectRevision:snapshot.revision};});
 }
 async prepareRefresh(request){
  const current=this.#nativeRefreshGuard(request),{projectId,documentId,blockId}=request;
  try{
   if(typeof request.capability?.isCurrent!=='function')refuse('ACCESS_REFUSED');current();const snapshot=await this.#snapshot({projectId});current();if(snapshot?.project?.id!==projectId)refuse('ACCESS_REFUSED');const workspace=workspaceMetadata(snapshot),docs=(workspace.workpapers??[]).filter(d=>d?.id===documentId);if(docs.length!==1)return {skip:true};
   const blocks=(docs[0].blocks??[]).filter(b=>b?.id===blockId);if(blocks.length!==1||blocks[0].kind!=='diagram-embed')return {skip:true};const block=normalizeDiagramEmbed(blocks[0]);if(block.mode!=='live')return {skip:true};
   if(normalizeDiagramEmbedSuspensions(workspace.diagramEmbedRefreshSuspensions??{schema:1,refs:[]}).some(r=>r.documentId===documentId&&r.blockId===block.id&&r.snapshotHash===fingerprint(block.snapshot)))return {skip:true};
   const expectedVersion=documentVersion(snapshot,documentId);
   const publication=(action,next)=>({token:createDiagramEmbedPublication({documentId,expectedVersion,operationId:randomUUID(),action,afterBlockId:null,block:next})});
   const warning=(status,missingNodeIds=[])=>block.status===status&&JSON.stringify(block.missingNodeIds)===JSON.stringify(missingNodeIds)?{skip:true}:publication('status',{...block,status,missingNodeIds});
   const matches=(workspace.diagrams??[]).filter(d=>d?.id===block.diagramId);if(matches.length!==1)return warning('missing');
   const capture=copy(matches[0]),sourceBytes=Buffer.from(JSON.stringify(capture)),sourceHash=digest(sourceBytes);if(sourceBytes.length>DIAGRAM_EMBED_ASSET_BYTES)return warning('render-error');
   if(!this.#identity&&block.snapshot.sourceHash===sourceHash&&block.status==='current')return {skip:true};
   const selected=block.scope==='selection'?inspectDiagramSelection({source:capture.source,nodeIds:block.nodeIds}):null;
   if(selected&&!selected.ok)return warning(selected.code==='DIAGRAM_EMBED_SELECTION_MISSING'?'missing':'render-error',selected.missingNodeIds??[]);
   let visual;
   try{
    const scope={projectId,isCurrent:current},renderIdentity=this.#identity?await this.#identity(scope):null;current();if(this.#identity&&!hash(renderIdentity?.key))throw Error('Invalid render identity');const key=renderIdentity?fingerprint({projectId,sourceHash,scope:block.scope,nodeIds:block.nodeIds,renderer:renderIdentity.key}):null;
    const cached=key&&this.#cache.get(key);visual=cached?{...cached,bytes:Buffer.from(cached.bytes)}:await this.#render(selected?{...capture,source:selected.source}:capture,{scope:block.scope,nodeIds:[...block.nodeIds]},{...scope,renderIdentity});current();if(!Buffer.isBuffer(visual?.bytes)||visual.bytes.length<1||visual.bytes.length>DIAGRAM_EMBED_ASSET_BYTES||!['svg','png'].includes(visual.kind)||typeof visual.rendererVersion!=='string'||!visual.rendererVersion.length||visual.rendererVersion.length>80||!hash(visual.styleHash))throw Error('Invalid visual');
    if(key&&!cached){while(this.#cache.size&&(this.#cache.size>=64||[...this.#cache.values()].reduce((n,v)=>n+v.bytes.length,0)+visual.bytes.length>16*1024*1024))this.#cache.delete(this.#cache.keys().next().value);this.#cache.set(key,{...visual,bytes:Buffer.from(visual.bytes)});}
   }
   catch{current();return warning('render-error');}
   if(block.status==='current'&&block.snapshot.sourceHash===sourceHash&&block.snapshot.rendererVersion===visual.rendererVersion&&block.snapshot.styleHash===visual.styleHash&&block.snapshot.visualAsset.sha256===digest(visual.bytes)&&block.snapshot.visualAsset.kind===visual.kind)return {skip:true};
   const sourceAsset=await this.#assets.put({projectId,kind:'diagram-source',bytes:sourceBytes,isCurrent:current});current();const visualAsset=await this.#assets.put({projectId,kind:visual.kind,bytes:visual.bytes,isCurrent:current});current();
   return publication('refresh',{...block,snapshot:{sourceHash,sourceVersion:capture.sirenNativeVersion??1,sourceAsset,visualAsset,rendererVersion:visual.rendererVersion,styleHash:visual.styleHash},status:'current',missingNodeIds:[]});
  }catch(e){return {code:e?.code??'DIAGRAM_EMBED_REFRESH_FAILED'};}
 }
 #prune(){const now=Date.now();for(const [id,p]of this.#previews)if(p.expires<now){this.#previews.delete(id);}}
 async #preview(grant,p,current){
  const {workspace}=await this.#state(grant,current),matches=(workspace.diagrams??[]).filter(d=>d?.id===p.diagramId);if(matches.length!==1)refuse('DIAGRAM_EMBED_SOURCE_CHANGED');
  const capture=copy(matches[0]),sourceBytes=Buffer.from(JSON.stringify(capture));if(sourceBytes.length>DIAGRAM_EMBED_ASSET_BYTES)refuse('DIAGRAM_EMBED_BUDGET');
  const qualified=p.scope==='selection'?inspectDiagramSelection({source:capture.source,nodeIds:p.nodeIds}):null;if(qualified&&!qualified.ok)refuse(qualified.code);
  const scope={projectId:grant.projectId,isCurrent:current},renderIdentity=this.#identity?await this.#identity(scope):null;current();if(this.#identity&&!hash(renderIdentity?.key))refuse('DIAGRAM_EMBED_RENDER_FAILED');const visual=await this.#render(qualified?{...capture,source:qualified.source}:capture,{scope:p.scope,nodeIds:[...p.nodeIds]},{...scope,renderIdentity});current();
  if(!Buffer.isBuffer(visual?.bytes)||visual.bytes.length<1||visual.bytes.length>DIAGRAM_EMBED_ASSET_BYTES||!['svg','png'].includes(visual.kind)||typeof visual.rendererVersion!=='string'||!visual.rendererVersion.length||visual.rendererVersion.length>80||!hash(visual.styleHash))refuse('DIAGRAM_EMBED_RENDER_FAILED');
  this.#prune();const bytes=sourceBytes.length+visual.bytes.length,total=[...this.#previews.values()].reduce((n,v)=>n+v.bytes,0);if(this.#previews.size>=64||total+bytes>16*1024*1024)refuse('DIAGRAM_EMBED_BUDGET');
  const previewId=randomUUID(),sourceHash=digest(sourceBytes),entry={grant,sourceBytes,sourceHash,capture,selection:copy(p),visual:{...visual,bytes:Buffer.from(visual.bytes)},bytes,current,expires:Date.now()+300000,attempts:new Map()};this.#previews.set(previewId,entry);
  return {ok:true,previewId,sourceHash,sourceVersion:capture.sirenNativeVersion??1,scope:p.scope,nodeIds:[...p.nodeIds],boundary:qualified?.boundary??[],visual:{kind:entry.visual.kind,base64:entry.visual.bytes.toString('base64')}};
 }
 #receipt(grant,id){
  this.#prune();const p=this.#previews.get(id);if(!p||p.grant.windowId!==grant.windowId||p.grant.epoch!==grant.epoch||p.grant.projectId!==grant.projectId||p.grant.entityIds[0]!==grant.entityIds[0])refuse('DIAGRAM_EMBED_PREVIEW_REFUSED');p.current();return p;
 }
 #operationKey(grant,p){return `${grant.projectId}:${grant.windowId}:${grant.epoch}:${p.operationId}`;}
 async #commit(grant,method,p,token,current){
  const key=this.#operationKey(grant,p),requestHash=fingerprint({method,p}),previous=this.#publications.get(key);
  if(previous&&previous.requestHash!==requestHash)refuse('OPERATION_CONFLICT');
  if(!previous&&this.#publications.size>=256)refuse('DIAGRAM_EMBED_BUDGET');
  this.#publications.set(key,previous??{requestHash,token,current});
  const result=await this.#owner.invoke(grant,{kind:'docs-diagram',method:'commit',payload:previous?.token??token});current();return result;
 }
 async #publish(grant,entry,p,current,action='insert',oldBlock,method=action==='insert'?'insert':'update'){
  const requestHash=fingerprint({p,action}),previous=entry.attempts.get(p.operationId);
  if(previous){if(previous.requestHash!==requestHash)refuse('OPERATION_CONFLICT');return this.#owner.invoke(grant,{kind:'docs-diagram',method:'commit',payload:previous.token});}
  if(entry.attempts.size>=64)refuse('DIAGRAM_EMBED_BUDGET');
  const state=await this.#state(grant,current);if(state.version!==p.expectedDocumentVersion)refuse('DOCUMENT_CONFLICT');
  const source=(state.workspace.diagrams??[]).filter(d=>d?.id===entry.capture.id);if(source.length!==1||fingerprint(source[0])!==entry.sourceHash)refuse('DIAGRAM_EMBED_SOURCE_CHANGED');entry.current();
  const scope={projectId:grant.projectId,isCurrent:()=>{current();entry.current();return true;}},sourceAsset=await this.#assets.put({...scope,kind:'diagram-source',bytes:entry.sourceBytes}),visualAsset=await this.#assets.put({...scope,kind:entry.visual.kind,bytes:entry.visual.bytes});current();entry.current();
  const block=normalizeDiagramEmbed({id:oldBlock?.id??randomUUID(),kind:'diagram-embed',schema:1,diagramId:entry.capture.id,mode:oldBlock?.mode??'live',scope:entry.selection.scope,nodeIds:entry.selection.nodeIds,caption:oldBlock?.caption??p.caption,display:oldBlock?.display??{height:320,fit:'contain'},snapshot:{sourceHash:entry.sourceHash,sourceVersion:entry.capture.sirenNativeVersion??1,sourceAsset,visualAsset,rendererVersion:entry.visual.rendererVersion,styleHash:entry.visual.styleHash},status:'current',missingNodeIds:[]});
  const token=createDiagramEmbedPublication({documentId:grant.entityIds[0],expectedVersion:p.expectedDocumentVersion,operationId:p.operationId,action,afterBlockId:action==='insert'?p.afterBlockId:null,block});entry.attempts.set(p.operationId,{requestHash,token});
  return this.#commit(grant,method,p,token,current);
 }
 async #invoke({event,method,payload,flushNonce}){
  if(flushNonce!==undefined)refuse('REQUEST_REFUSED');const p=this.#request(method,payload);if(['listDocuments','sendToDocs'].includes(method))return this.#transfer(event,method,p);const grant=this.#capture(event),write=['insert','setMode','update'].includes(method),current=this.#guard(grant,write);current();
  if(write){const previous=this.#publications.get(this.#operationKey(grant,p));if(previous){previous.current();return this.#commit(grant,method,p,previous.token,current);}}
  if(method==='preview')return this.#preview(grant,p,current);
  if(method==='insert')return this.#publish(grant,this.#receipt(grant,p.previewId),p,current);
  const state=await this.#state(grant,current);
  if(method==='getProposal'){const key=grant.projectId+':'+grant.entityIds[0],proposal=this.#proposals.get(key);if(!proposal)return {ok:true,proposal:null};const diagrams=(state.workspace.diagrams??[]).filter(d=>d?.id===proposal.diagramId);if(proposal.expires<Date.now()||diagrams.length!==1||fingerprint(diagrams[0])!==proposal.sourceHash){this.#proposals.delete(key);refuse('DIAGRAM_EMBED_SOURCE_CHANGED');}if(this.#working(grant)===true)this.#proposals.delete(key);const {expires,...identifiers}=proposal;return {ok:true,proposal:copy(identifiers)};}
  if(method==='inspectSelection'){const diagrams=(state.workspace.diagrams??[]).filter(d=>d?.id===p.diagramId);if(diagrams.length!==1)refuse('DIAGRAM_EMBED_SOURCE_CHANGED');const model=inspectDiagramSelection({source:diagrams[0].source,nodeIds:[]});return model.ok?{ok:true,nodes:model.nodes.map(({id,label})=>({id,label:label.slice(0,160)})),sourceHash:fingerprint(diagrams[0])}:model;}
  if(method==='listDiagrams'){
   const seen=new Set(),rows=[];for(const d of state.workspace.diagrams??[]){if(!validEntityId(d?.id)||seen.has(d.id))refuse('DIAGRAM_EMBED_SOURCE_CHANGED');seen.add(d.id);if(rows.length>=4096)refuse('DIAGRAM_EMBED_BUDGET');rows.push({id:d.id,label:typeof d.name==='string'?d.name.toWellFormed().slice(0,160):'Untitled diagram',version:d.sirenNativeVersion??1});}
   const q=(p.query??'').trim().normalize('NFKC').toLowerCase(),filtered=rows.filter(v=>!q||v.label.normalize('NFKC').toLowerCase().includes(q)),cursor=p.cursor??0,items=filtered.slice(cursor,cursor+64);return {ok:true,items,nextCursor:cursor+items.length,hasMore:cursor+items.length<filtered.length,documentVersion:state.version};
  }
  if(state.version!==p.expectedDocumentVersion)refuse('DOCUMENT_CONFLICT');const matches=(state.doc.blocks??[]).filter(b=>b?.id===p.blockId);if(matches.length!==1||matches[0].kind!=='diagram-embed')refuse('DIAGRAM_EMBED_REFUSED');const block=normalizeDiagramEmbed(matches[0]);
  if(method==='openSource'){
   if(typeof this.#show!=='function'||typeof this.#registry.openView!=='function'||typeof this.#registry.discardViewAsync!=='function')refuse('REQUEST_REFUSED');
   if((state.workspace.diagrams??[]).filter(d=>d?.id===block.diagramId).length!==1)refuse('DIAGRAM_EMBED_SOURCE_CHANGED');let opened;
   try{opened=await this.#registry.openView({role:'diagram',entityId:block.diagramId});current();const latest=await this.#state(grant,current);if(latest.version!==state.version)refuse('DOCUMENT_CONFLICT');if((latest.workspace.diagrams??[]).filter(d=>d?.id===block.diagramId).length!==1)refuse('DIAGRAM_EMBED_SOURCE_CHANGED');if(opened.projectId!==grant.projectId||opened.role!=='diagram'||opened.entityId!==block.diagramId)refuse('ACCESS_REFUSED');this.#show(opened);return {ok:true,view:{windowId:opened.windowId,role:opened.role,projectId:opened.projectId,entityId:opened.entityId,epoch:opened.epoch}};}
   catch(e){if(opened&&!await this.#registry.discardViewAsync(opened.windowId)){this.#failed=true;refuse('WINDOW_DESTROY_FAILED');}throw e;}
  }
  if(method==='readEmbed'){const bytes=await this.#assets.read({projectId:grant.projectId,ref:block.snapshot.visualAsset,isCurrent:current});current();const refreshSuspended=normalizeDiagramEmbedSuspensions(state.workspace.diagramEmbedRefreshSuspensions??{schema:1,refs:[]}).some(r=>r.documentId===grant.entityIds[0]&&r.blockId===block.id&&r.snapshotHash===fingerprint(block.snapshot));return {ok:true,block,refreshSuspended,documentVersion:state.version,visual:{kind:block.snapshot.visualAsset.kind,base64:bytes.toString('base64')}};}
  if(method==='setMode'){
   if(p.previewId){const preview=this.#receipt(grant,p.previewId);if(preview.capture.id!==block.diagramId||preview.selection.scope!==block.scope||JSON.stringify(preview.selection.nodeIds)!==JSON.stringify(block.nodeIds))refuse('DIAGRAM_EMBED_PREVIEW_REFUSED');return this.#publish(grant,preview,p,current,'replace',{...block,mode:'live'},method);}
   if(p.mode==='live'){const source=(state.workspace.diagrams??[]).filter(d=>d?.id===block.diagramId);if(source.length!==1||fingerprint(source[0])!==block.snapshot.sourceHash||block.status!=='current')refuse('DIAGRAM_EMBED_SOURCE_CHANGED');}
   const token=createDiagramEmbedPublication({documentId:grant.entityIds[0],expectedVersion:p.expectedDocumentVersion,operationId:p.operationId,action:'mode',afterBlockId:null,block:{...block,mode:p.mode}});return this.#commit(grant,method,p,token,current);
  }
  const preview=await this.#preview(grant,{diagramId:block.diagramId,scope:block.scope,nodeIds:block.nodeIds},current);return this.#publish(grant,this.#receipt(grant,preview.previewId),p,current,'replace',block);
 }
 invoke(input){
  if(this.#pending.size>=8)return Promise.resolve(fail('DIAGRAM_EMBED_BUDGET'));
  const operation=this.#invoke(input).catch(e=>fail(e?.code??'DIAGRAM_EMBED_FAILED'));this.#pending.add(operation);operation.finally(()=>this.#pending.delete(operation));return operation;
 }
 pause(){this.#paused=true;this.#generation++;this.#previews.clear();this.#publications.clear();this.#proposals.clear();this.#cache.clear();}
 resume(){if(this.#disposed)return;this.#paused=false;this.#generation++;this.#previews.clear();this.#publications.clear();this.#proposals.clear();}
 isIdle(){return this.#pending.size===0&&!this.#failed;}
 async drain(){while(this.#pending.size)await Promise.all([...this.#pending]);}
 dispose(){this.#disposed=true;this.pause();}
}
