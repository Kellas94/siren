import {navigationFields} from '../navigation/contracts.mjs';
import {workspaceMetadata} from './entities.mjs';
import {validId} from '../projects/paths.mjs';
const fail=code=>Object.freeze({ok:false,code});
const label=value=>{const short=value.toWellFormed().slice(0,160);return /[\uD800-\uDBFF]$/.test(short)?short.slice(0,-1):short;};

/** Metadata discovery for the permanently bound App owner only. Catalog rows
 * confer no read or window grant; native open/read still validate current scope. */
export class NativeWindowCatalog {
 #registry;#snapshotFor;
 constructor({registry,snapshotFor}){
  if(!['capturePrimary','isCurrent'].every(key=>typeof registry?.[key]==='function')||typeof snapshotFor!=='function')throw TypeError('NATIVE_CATALOG_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#snapshotFor=snapshotFor;
 }
 #capture(event){
  const grant=this.#registry.capturePrimary({sender:event?.sender,senderFrame:event?.senderFrame});
  return grant?.role==='workspace'&&grant.mainFrameUrl==='siren://app/app.html'&&this.#registry.isCurrent(grant)?grant:null;
 }
 async invoke({event,payload}){
  try{
   let cursor;try{const request=navigationFields(payload??{},['cursor'],[]);cursor=request.cursor??0;if(!Number.isSafeInteger(cursor)||cursor<0||cursor>4096)return fail('REQUEST_REFUSED');}catch{return fail('REQUEST_REFUSED');}
   const grant=this.#capture(event);if(!grant)return fail('ACCESS_REFUSED');
   const snapshot=await this.#snapshotFor(grant),live=this.#capture(event);
   if(!live||live.windowId!==grant.windowId||live.epoch!==grant.epoch||snapshot?.project?.id!==grant.projectId)return fail('ACCESS_REFUSED');
   const rows=[],seen=new Set(),metadata=workspaceMetadata(snapshot);
   for(const document of metadata.workpapers??[]){
    if(!validId(document?.id))continue;if(seen.has(document.id))return fail('CATALOG_REFUSED');seen.add(document.id);
    rows.push({role:'docs',entityId:document.id,label:typeof document.title==='string'&&document.title?label(document.title):'Untitled document',readonly:true});
   }
   const refs=new Map();
   if(snapshot.schema===2)for(const ref of snapshot.sourceRefs??[]){
    if(!validId(ref?.sourceId)||!Number.isSafeInteger(ref.version)||ref.version<1||typeof ref.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256))return fail('CATALOG_REFUSED');
    if(!refs.has(ref.sourceId)||refs.get(ref.sourceId).version<ref.version)refs.set(ref.sourceId,ref);
   }
   for(const ref of refs.values())rows.push({role:'code',entityId:ref.sourceId,label:'Source '+ref.sourceId.slice(0,8),readonly:true,sourceRef:{sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256}});
   const total=rows.length,limit=Math.min(total,4096),items=rows.slice(cursor,Math.min(cursor+64,limit)),nextCursor=cursor+items.length;
   return Object.freeze({ok:true,items,total,truncated:total>limit,hasMore:nextCursor<limit,nextCursor});
  }catch{return fail('CATALOG_REFUSED');}
 }
}
