import {workspaceMetadata,validEntityId} from './entities.mjs';
import {selectedSourceReference} from './source-reads.mjs';
const own=(value,key)=>{const d=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,key):null;return d&&Object.hasOwn(d,'value')?d.value:undefined;};
const key=value=>{const id=own(value,'sourceId'),version=own(value,'version'),sha=own(value,'sha256');return typeof id==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(id)&&Number.isSafeInteger(version)&&version>0&&typeof sha==='string'&&/^[a-f0-9]{64}$/.test(sha)?`${id}:${version}:${sha}`:null;};
const text=(value,max=160)=>{if(typeof value!=='string'||!value.isWellFormed())return '';const clean=value.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,' ').slice(0,max);return /[\uD800-\uDBFF]$/.test(clean)?clean.slice(0,-1):clean;};
const name=value=>typeof value==='string'&&value.length>0&&value.length<=200&&value.isWellFormed()&&!/[\\/:\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/.test(value)&&value!=='.'&&value!=='..'?value:null;
const array=value=>Array.isArray(value)?value:[];

/** Metadata only, derived once per verified snapshot. Exact references remain
 * authority elsewhere. No source bytes, Docs bodies, paths or drafts escape. */
export function createSourceContext(snapshot){
 const refs=new Map(),files=new Map(),fileIds=new Map(),links=new Map(),bySource=new Map(),languages=new Map();let limited=false;
 const claim=(identity,value)=>{if(!['python','text'].includes(value))return;const old=languages.get(identity);languages.set(identity,old&&old!==value?'unknown':value);};
 try{
  const selected=own(snapshot,'sourceRefs');if(own(snapshot,'schema')!==2||!Array.isArray(selected)||selected.length>65536)return Object.freeze({describe:()=>null});
  for(let i=0;i<selected.length;i++){const value=own(selected,String(i)),identity=key(value);if(identity)refs.set(identity,value);}
  const metadata=workspaceMetadata(snapshot),code=array(metadata.codeFiles),papers=array(metadata.workpapers);
  for(const file of code.slice(0,4096)){
   const identity=key(own(file,'sourceRef'));if(identity&&refs.has(identity))claim(identity,own(file,'language'));
   const displayName=name(own(file,'name'));if(!displayName)continue;
   const language=['python','text'].includes(own(file,'language'))?own(file,'language'):'unknown',item={displayName,language};
   if(identity&&refs.has(identity)&&!files.has(identity))files.set(identity,item);
   const id=own(file,'id');if(typeof id==='string'&&!fileIds.has(id))fileIds.set(id,displayName);
  }
  let visited=0;const seen=new Set();
  outer:for(const paper of papers.slice(0,4096)){
   const documentId=own(paper,'id');if(!validEntityId(documentId))continue;
   const agent=own(paper,'agent'),caption={documentId,title:text(own(paper,'title'))||'Untitled document',agentId:text(own(agent,'agentId'),40),agentVersion:text(own(agent,'agentVersion'),40)};
   for(const block of array(own(paper,'blocks'))){
    if(++visited>16384){limited=true;break outer;}if(own(block,'kind')!=='knowledge')continue;
    for(const row of array(own(block,'rows'))){
     if(++visited>16384){limited=true;break outer;}
     const identity=key(own(row,'sourceRef')),reference=refs.get(identity);if(!reference)continue;
     const type=own(row,'fileType');claim(identity,type==='txt'?'text':type);
     if(!files.has(identity)){const displayName=name(own(row,'name'))??name(own(row,'fileName'));if(displayName)files.set(identity,{displayName});}
     const unique=documentId+':'+identity;if(seen.has(unique))continue;seen.add(unique);
     const item=Object.freeze({...caption,version:own(reference,'version')});
     if(!links.has(identity))links.set(identity,[]);links.get(identity).push(item);
    }
   }
  }
  limited ||= papers.length>4096||code.length>4096;
  for(const [identity,list]of links){const id=own(refs.get(identity),'sourceId');if(!bySource.has(id))bySource.set(id,[]);bySource.get(id).push({version:own(refs.get(identity),'version'),list});}
 }catch{limited=true;}
 return Object.freeze({matches(reference,filters={}){
  const identity=key(reference),selected=refs.get(identity);if(!selected)return false;
  const rows=(bySource.get(own(selected,'sourceId'))??[]).filter(group=>group.version<=own(selected,'version')).flatMap(group=>group.list);
  const includes=(value,needle)=>value.normalize('NFKC').toLowerCase().includes(needle.trim().normalize('NFKC').toLowerCase());
  return (!filters.agent||rows.some(row=>includes(row.agentId+' '+row.agentVersion,filters.agent)))&&(!filters.document||rows.some(row=>includes(row.title,filters.document)));
 },describe(reference){
  const identity=key(reference),selected=refs.get(identity);if(!selected)return null;
  const exact=files.get(identity),provenance=own(selected,'provenance'),standalone=own(provenance,'kind')==='standalone';
  const displayName=exact?.displayName??(standalone?fileIds.get(own(provenance,'fileId'))??name(own(provenance,'fileName')):null);
  const exactLinks=links.get(identity)??[],earlierLinks=[];
  for(const group of bySource.get(own(selected,'sourceId'))??[])if(group.version<own(selected,'version'))earlierLinks.push(...group.list);
  return Object.freeze({...(displayName?{displayName}:{}),language:limited?'unknown':languages.get(identity)??'unknown',linkState:exactLinks.length?'linked':earlierLinks.length?'earlier':limited?'unknown':'unlinked',exactCount:exactLinks.length,earlierCount:earlierLinks.length,exactLinks:Object.freeze(exactLinks.slice(0,8)),earlierLinks:Object.freeze(earlierLinks.slice(0,8)),linksTruncated:limited||exactLinks.length>8||earlierLinks.length>8});
 }});
}

const cache=new WeakMap();
/** Only the genuine main-owned working entry can carry syntax/name preferences
 * beyond the selected manifest version. This never transfers Docs link claims. */
export function selectedCodeMetadata(snapshot,registry,workingSources,grant,reference){
 try{
  if(!registry.isCurrent(grant))return null;
  const base=selectedSourceReference(snapshot,registry,grant);if(!base||base.sourceId!==reference?.sourceId)return null;
  let record=cache.get(snapshot);if(!record||record.json!==snapshot.json||record.refs!==snapshot.sourceRefs){record={json:snapshot.json,refs:snapshot.sourceRefs,context:createSourceContext(snapshot)};cache.set(snapshot,record);}
  const context=record.context;let value;
  if(key(base)===key(reference))value=context.describe(reference);
  else{
   const working=workingSources?.isWorking(grant)&&workingSources.referenceFor(grant);
   if(!working||key(working)!==key(reference)||reference.version<=base.version)return null;
   value=context.describe(reference)??context.describe(base);
  }
  return value?Object.freeze({language:value.language,...(value.displayName?{displayName:value.displayName}:{})}):null;
 }catch{return null;}
}
