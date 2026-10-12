import {workspaceMetadata} from '../windows/entities.mjs';

const roles=Object.freeze({code:'⌘ Code',docs:'Docs',diagram:'Diagrams',presenter:'Presenter',audience:'Audience'});
const own=(value,key)=>{const descriptor=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,key):null;return descriptor&&Object.hasOwn(descriptor,'value')?descriptor.value:undefined;};
const key=ref=>ref&&typeof ref.sourceId==='string'&&Number.isSafeInteger(ref.version)&&ref.version>0&&typeof ref.sha256==='string'&&/^[a-f0-9]{64}$/.test(ref.sha256)?`${ref.sourceId}:${ref.version}:${ref.sha256}`:null;
function name(value,fallback,limit=160){
 if(typeof value!=='string')return fallback;
 const clean=value.slice(0,1024).toWellFormed().replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').replace(/\s+/g,' ').trim().slice(0,limit);
 return (/[\uD800-\uDBFF]$/.test(clean)?clean.slice(0,-1):clean)||fallback;
}
const fileName=value=>typeof value==='string'&&value.length>0&&value.length<=200&&value.isWellFormed()&&!/[\\/:\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(value)&&value!=='.'&&value!=='..'?value:null;
const rows=value=>Array.isArray(value)?value.slice(0,4096):[];

/** Display-only native title; never use it to select an entity or authorize work. */
export function surfaceWindowLabel(role,title,entityId){
 const module=roles[role];if(!['code','docs','diagram'].includes(role))return null;
 const prefix='SIREN — '+module+' — ';
 const fallback=typeof entityId==='string'?entityId.slice(0,8):module;
 return module+' · '+name(typeof title==='string'&&title.startsWith(prefix)?title.slice(prefix.length):null,fallback,224);
}

/** Trusted native roster and selected saved metadata only. A main-owned callback
 * may supply {reference, working:true} from a current NativeWorkingSources grant;
 * plain references still require exact selected-manifest hash/version membership.
 * No renderer reference can supply this admission. Labels never read
 * source bodies, draft/release/agent content or confer entity/window authority. */
export function homeWindowSummaries(snapshot,views,referenceFor=()=>null){
 if(!snapshot?.project?.id||!Array.isArray(views))return [];
 let metadata={};try{metadata=workspaceMetadata(snapshot);}catch{}
 const docs=new Map(rows(metadata.workpapers).map(row=>[own(row,'id'),own(row,'title')]));
 const diagrams=new Map(rows(metadata.diagrams).map(row=>[own(row,'id'),row]));
 const files=rows(metadata.codeFiles),names=new Map(),fileIds=new Map();
 for(const file of files){const label=fileName(own(file,'name'));if(!label)continue;const ref=key(own(file,'sourceRef'));if(ref)names.set(ref,label);const id=own(file,'id');if(typeof id==='string')fileIds.set(id,label);}
 const references=new Map(),selectedSources=new Map(),selectedVersions=new Map();
 if(snapshot.schema===2&&Array.isArray(snapshot.sourceRefs)&&snapshot.sourceRefs.length<=65536)for(const ref of snapshot.sourceRefs){const id=key(ref);if(id){references.set(id,ref);if(!selectedSources.has(ref.sourceId))selectedSources.set(ref.sourceId,ref);selectedVersions.set(ref.sourceId+':'+ref.version,ref);}}
 const result=[];
 for(const view of views){
  if(!Object.hasOwn(roles,view?.role)||view.projectId!==snapshot.project.id)continue;
  if(result.length===16)break;
  const fallback=typeof view.entityId==='string'?view.entityId.slice(0,8):roles[view.role];let title=fallback,suffix='';
  if(view.role==='code'){
   let requested;try{requested=referenceFor(view);}catch{}
   const working=own(requested,'working')===true,admitted=working?own(requested,'reference'):requested;
   const exact=references.get(key(admitted)),selected=selectedSources.get(own(admitted,'sourceId')),version=selectedVersions.get(own(admitted,'sourceId')+':'+own(admitted,'version'));
   const ref=exact||(working&&key(admitted)&&selected&&(!version||key(version)===key(admitted))?admitted:null);
   if(ref&&ref.sourceId===view.entityId){
    const named=exact||selected,provenance=own(named,'provenance'),standalone=own(provenance,'kind')==='standalone';
    title=names.get(key(named))||(standalone?fileIds.get(own(provenance,'fileId'))||fileName(own(provenance,'fileName')):null)||fallback;
    suffix=' · v'+ref.version;
   }
  }else if(view.role==='docs'){
   title=docs.get(view.entityId)||fallback;
   if(Number.isSafeInteger(snapshot.revision)&&snapshot.revision>0)suffix=' · project r'+snapshot.revision;
  }else{
   const diagram=diagrams.get(view.entityId);title=own(diagram,'name')||fallback;
   const version=own(diagram,'version');if(view.role==='diagram'&&Number.isSafeInteger(version)&&version>0)suffix=' · v'+version;
  }
  result.push({windowId:view.windowId,role:view.role,entityId:view.entityId,label:roles[view.role]+' · '+name(title,fallback)+suffix,state:view.state==='minimized'?'minimized':'open'});
 }
 return result;
}
