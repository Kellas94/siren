import {navigationFields} from '../navigation/contracts.mjs';
import {workspaceMetadata,validEntityId} from './entities.mjs';
import {validId} from '../projects/paths.mjs';
import {documentTypes} from '../documents/context.mjs';
const fail=code=>Object.freeze({ok:false,code});
const label=(value,max=160)=>{const short=value.toWellFormed().slice(0,max);return /[\uD800-\uDBFF]$/.test(short)?short.slice(0,-1):short;};

/** Metadata discovery for the permanently bound workspace owner. Catalog rows
 * confer no read or window grant; native open/read still validate current scope. */
export class NativeWindowCatalog {
 #registry;#snapshotFor;
 constructor({registry,snapshotFor}){
  if(!['capturePrimary','isCurrent'].every(key=>typeof registry?.[key]==='function')||typeof snapshotFor!=='function')throw TypeError('NATIVE_CATALOG_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#snapshotFor=snapshotFor;
 }
 #capture(event){
  const grant=this.#registry.capturePrimary({sender:event?.sender,senderFrame:event?.senderFrame});
  return grant?.role==='workspace'&&['siren://app/app.html','siren://app/home.html'].includes(grant.mainFrameUrl)&&this.#registry.isCurrent(grant)?grant:null;
 }
 async invoke({event,payload}){
  try{
   let cursor,role,query,details=false,filters={};try{
    const request=navigationFields(payload??{},['cursor','role','query','details','filters'],[]);cursor=request.cursor??0;role=request.role;query=request.query??'';
    if(Object.hasOwn(request,'query')&&(typeof request.query!=='string'||!request.query.isWellFormed()||request.query.length>160||/[\u0000-\u001f\u007f]/.test(request.query))||!Number.isSafeInteger(cursor)||cursor<0||cursor>4096||role!==undefined&&!['code','docs','diagram','presenter','all'].includes(role))return fail('REQUEST_REFUSED');
    if(Object.hasOwn(request,'details')&&(typeof request.details!=='boolean'||role!=='docs')||Object.hasOwn(request,'filters')&&role!=='docs')return fail('REQUEST_REFUSED');details=request.details===true;
    if(request.filters!==undefined){filters=navigationFields(request.filters,['type','status','owner','links'],[]);
     if(filters.type!==undefined&&!documentTypes.includes(filters.type)||filters.status!==undefined&&!['draft','in-review','approved'].includes(filters.status)||filters.links!==undefined&&!['linked','unlinked'].includes(filters.links)||filters.owner!==undefined&&(typeof filters.owner!=='string'||!filters.owner.isWellFormed()||filters.owner.length>80))return fail('REQUEST_REFUSED');
    }
    query=query.trim().normalize('NFKC').toLowerCase();
   }catch{return fail('REQUEST_REFUSED');}
   const grant=this.#capture(event);if(!grant)return fail('ACCESS_REFUSED');
   const snapshot=await this.#snapshotFor(grant),live=this.#capture(event);
   if(!live||live.windowId!==grant.windowId||live.epoch!==grant.epoch||snapshot?.project?.id!==grant.projectId)return fail('ACCESS_REFUSED');
   const rows=[],seen=new Set(),metadata=workspaceMetadata(snapshot);
   for(const document of metadata.workpapers??[]){
    if(!validEntityId(document?.id))continue;if(seen.has(document.id))return fail('CATALOG_REFUSED');seen.add(document.id);
    const context={type:documentTypes.includes(document.type)?document.type:'unknown',status:['draft','in-review','approved'].includes(document.status)?document.status:'unknown',owner:typeof document.owner==='string'?label(document.owner,80):'',agentId:typeof document.agent?.agentId==='string'?label(document.agent.agentId,40):'',agentVersion:typeof document.agent?.agentVersion==='string'?label(document.agent.agentVersion,40):'',referenceCount:Array.isArray(document.links)?Math.min(document.links.length,4096):0};
    if(role==='docs'&&(filters.type!==undefined&&context.type!==filters.type||filters.status!==undefined&&context.status!==filters.status||filters.owner!==undefined&&!context.owner.normalize('NFKC').toLowerCase().includes(filters.owner.normalize('NFKC').toLowerCase())||filters.links==='linked'&&!context.referenceCount||filters.links==='unlinked'&&context.referenceCount))continue;
    rows.push({role:'docs',entityId:document.id,label:typeof document.title==='string'&&document.title?label(document.title):'Untitled document',readonly:true,...(details?{context}:{})});
   }
   const refs=new Map();
   if(snapshot.schema===2)for(const ref of snapshot.sourceRefs??[]){
    if(!validId(ref?.sourceId)||!Number.isSafeInteger(ref.version)||ref.version<1||typeof ref.sha256!=='string'||!/^[a-f0-9]{64}$/.test(ref.sha256))return fail('CATALOG_REFUSED');
    if(!refs.has(ref.sourceId)||refs.get(ref.sourceId).version<ref.version)refs.set(ref.sourceId,ref);
   }
   const key=ref=>ref&&`${ref.sourceId}:${ref.version}:${ref.sha256}`,names=new Map(),linked=new Set();
   for(const file of metadata.codeFiles??[]){if(typeof file?.name==='string'&&file.name&&!/[\\/:\u0000-\u001f]/.test(file.name)&&file.name!=='.'&&file.name!=='..'&&file.sourceRef)names.set(key(file.sourceRef),file.name);}
   for(const document of metadata.workpapers??[])for(const block of document.blocks??[])if(block?.kind==='knowledge')for(const row of block.rows??[])if(row?.sourceRef)linked.add(key(row.sourceRef));
   for(const ref of refs.values()){const name=names.get(key(ref)),text=name?name+(linked.has(key(ref))?'':' · Unlinked'):'Source '+ref.sourceId.slice(0,8);rows.push({role:'code',entityId:ref.sourceId,label:label(text),readonly:true,sourceRef:{sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256}});}
   const diagramIds=new Set();
   for(const diagram of metadata.diagrams??[]){
    if(!validEntityId(diagram?.id))continue;if(diagramIds.has(diagram.id))return fail('CATALOG_REFUSED');diagramIds.add(diagram.id);
    rows.push({role:role==='presenter'?'presenter':'diagram',entityId:diagram.id,label:typeof diagram.name==='string'&&diagram.name?label(diagram.name):'Untitled diagram',readonly:true});
   }
   const selected=role==='all'?rows.flatMap(item=>item.role==='diagram'?[item,{...item,role:'presenter'}]:[item]):role?rows.filter(item=>item.role===role):rows;
   const bounded=selected.slice(0,4096),matches=query?bounded.filter(item=>item.label.normalize('NFKC').toLowerCase().includes(query)):bounded;
   const total=query?matches.length:selected.length,limit=matches.length,items=matches.slice(cursor,Math.min(cursor+64,limit)),nextCursor=cursor+items.length;
   return Object.freeze({ok:true,items,total,truncated:selected.length>4096,hasMore:nextCursor<limit,nextCursor});
  }catch{return fail('CATALOG_REFUSED');}
 }
}
