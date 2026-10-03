import {WindowRegistry} from './registry.mjs';
import {WorkspaceCoordinator} from './coordinator.mjs';
import {documentContentVersion,normalizeDocsLink} from './docs.mjs';
import {verifySnapshot} from '../projects/store.mjs';
import {workspaceMetadata} from './entities.mjs';
import {navigationFields} from '../navigation/contracts.mjs';

const fail=code=>Object.freeze({ok:false,code});
const entity=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const title=(value,fallback)=>typeof value==='string'&&value.trim()?value.slice(0,200):fallback;
const error=code=>Object.assign(Error(code),{code});

/** Explicit working-Code to Docs boundary. Only metadata targets leave main;
 * the native owner derives project/source authority and validates commit proof.
 * No full Docs envelope, filesystem path or draining nonce is accepted. */
export class NativeCodeDocs{
 #registry;#owner;#canLink;#snapshotFor;
 constructor({registry,owner,canLink,snapshotFor}){
  if(!(registry instanceof WindowRegistry)||!(owner instanceof WorkspaceCoordinator)||typeof canLink!=='function'||typeof snapshotFor!=='function')throw TypeError('NATIVE_CODE_DOCS_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#owner=owner;this.#canLink=canLink;this.#snapshotFor=snapshotFor;
 }
 #current(event,grant){
  try{
   const actual=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame}),source=this.#registry.sourceScope(grant);
   return actual?.windowId===grant?.windowId&&actual.epoch===grant.epoch&&actual.role==='code'&&
    grant.mainFrameUrl===`siren://app/windows/code.html?windowId=${grant.windowId}`&&this.#registry.isCurrent(grant)&&
    source&&!Object.hasOwn(source,'version')&&this.#canLink(grant)===true&&this.#owner.canRead(grant,source.sourceId);
  }catch{return false;}
 }
 #targets(grant,offset){
  const snapshot=this.#snapshotFor(grant),source=this.#registry.sourceScope(grant);
  if(snapshot?.schema!==2||snapshot.project.id!==grant.projectId||!snapshot.sourceRefs.some(ref=>ref.sourceId===source.sourceId))throw error('ACCESS_REFUSED');
  verifySnapshot(snapshot);
  const documents=workspaceMetadata(snapshot).workpapers??[];
  if(documents.length>4096)throw error('CATALOG_BUDGET');
  const targets=[],documentIds=new Set();let scanned=0;
  for(const doc of documents){
   if(!entity(doc?.id)||documentIds.has(doc.id))throw error('LINK_TARGET_REFUSED');documentIds.add(doc.id);
   const ids=new Set();let token;
   for(const block of doc.blocks??[]){
    if(block?.kind!=='knowledge')continue;
    const rows=block.rows??[];scanned+=rows.length;if(scanned>65536)throw error('CATALOG_BUDGET');
    for(const row of rows){
    if(row?.sourceRef?.sourceId!==source.sourceId)continue;
    if(!entity(row.id)||ids.has(row.id))throw error('LINK_TARGET_REFUSED');ids.add(row.id);
    if(targets.length===4096)throw error('CATALOG_BUDGET');
    token??=documentContentVersion(snapshot.project.id,doc);
    targets.push(Object.freeze({documentId:doc.id,rowId:row.id,documentTitle:title(doc.title??doc.name,'Untitled document'),rowTitle:title(row.title??row.name,'Linked code'),documentVersion:token}));
    }
   }
  }
  return Object.freeze({ok:true,targets:Object.freeze(targets.slice(offset,offset+64)),total:targets.length,nextOffset:offset+64<targets.length?offset+64:null});
 }
 async invoke({event,method,payload={}}){
  let input;
  try{
   if(method==='listTargets'){
    input=navigationFields(payload,['offset'],[]);input.offset??=0;
    if(!Number.isSafeInteger(input.offset)||input.offset<0||input.offset>4096)return fail('REQUEST_REFUSED');
   }else if(method==='commitCodeToDocs')input=normalizeDocsLink(payload);
   else return fail('REQUEST_REFUSED');
  }catch{return fail('REQUEST_REFUSED');}
  try{
   const grant=this.#registry.capture({sender:event?.sender,senderFrame:event?.senderFrame});
   if(!this.#current(event,grant))return fail('ACCESS_REFUSED');
   if(method==='listTargets')return this.#targets(grant,input.offset);
   if(this.#registry.sourceScope(grant).sourceId!==input.sourceReceipt.sourceId)return fail('ACCESS_REFUSED');
   const result=await this.#owner.invoke(grant,{kind:'docs',method,payload:input});
   return this.#current(event,grant)?result:fail('ACCESS_REFUSED');
  }catch(failure){return fail(['ACCESS_REFUSED','CATALOG_BUDGET','LINK_TARGET_REFUSED'].includes(failure.code)?failure.code:'DOCS_LINK_FAILED');}
 }
}
