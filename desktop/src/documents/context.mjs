const refuse=code=>{throw Object.assign(Error(code),{code});};
export const documentTypes=Object.freeze(['agent-spec','narrative','control','note']);
export const oversightModes=Object.freeze(['always','conditional','no','unknown']);
export const dataFlags=Object.freeze(['yes','no','possible','unknown']);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
function fields(value,allowed){
 if(!object(value))refuse('CONTEXT_REFUSED');const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(!keys.length||keys.length>allowed.length||keys.some(k=>typeof k!=='string'||!allowed.includes(k)||!descriptors[k].enumerable||!Object.hasOwn(descriptors[k],'value')))refuse('CONTEXT_REFUSED');
 return Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));
}
const text=(v,max,trim=false)=>{if(typeof v!=='string'||!v.isWellFormed()||v.length>max||trim&&v!==v.trim())refuse('CONTEXT_REFUSED');return v;};
function agentPatch(value){
 const result=fields(value,['agentId','agentVersion','platform','environment','oversight','data']);
 for(const [key,max]of [['agentId',40],['agentVersion',40],['platform',80],['environment',120]])if(Object.hasOwn(result,key))text(result[key],max,['agentId','agentVersion'].includes(key));
 for(const [group,allowed,enums]of [['oversight',['mode','how','exceptions'],{mode:oversightModes}],['data',['types','confidential','personal','sensitive','restrictions'],{confidential:dataFlags,personal:dataFlags,sensitive:dataFlags}]])if(Object.hasOwn(result,group)){
  result[group]=fields(result[group],allowed);for(const [key,v]of Object.entries(result[group]))if(enums[key]){if(!enums[key].includes(v))refuse('CONTEXT_REFUSED');}else text(v,2000);
 }
 return result;
}
const referenceKey=r=>r.kind+':'+r.id;
function referenceOperations(value){
 const result=fields(value,['add','remove']),seen=new Set();
 for(const operation of Object.keys(result)){
  const list=result[operation];if(!Array.isArray(list)||Object.getPrototypeOf(list)!==Array.prototype||list.length>60)refuse('CONTEXT_REFUSED');
  result[operation]=Array.from({length:list.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(list,i);if(!d||!Object.hasOwn(d,'value'))refuse('CONTEXT_REFUSED');const ref=fields(d.value,['kind','id']);
   if(Object.keys(ref).length!==2||!['diagram','document'].includes(ref.kind)||typeof ref.id!=='string'||!/^[A-Za-z0-9_-]{1,120}$/.test(ref.id)||seen.has(referenceKey(ref)))refuse('CONTEXT_REFUSED');seen.add(referenceKey(ref));return ref;});
 }
 if(!Object.values(result).some(v=>v.length))refuse('CONTEXT_REFUSED');return result;
}
export function normalizeDocumentContext(value){
 const result=fields(value,['type','owner','agent','references']);
 if(Object.hasOwn(result,'type')&&!documentTypes.includes(result.type))refuse('CONTEXT_REFUSED');
 if(Object.hasOwn(result,'owner'))text(result.owner,80);
 if(Object.hasOwn(result,'agent'))result.agent=agentPatch(result.agent);
 if(Object.hasOwn(result,'references'))result.references=referenceOperations(result.references);
 return result;
}
export function isWholeReference(link){return link&&['diagram','document'].includes(link.kind)&&(link.kind==='diagram'?!link.nodeId:!link.blockId)&&typeof(link.diagramId??link.documentId)==='string';}
export function applyDocumentContext(before,input,{targets}={}){
 const patch=normalizeDocumentContext(input),next=structuredClone(before);
 for(const key of ['type','owner'])if(Object.hasOwn(patch,key))next[key]=patch[key];
 if(patch.agent){
  if(before.agent!=null&&!object(before.agent))refuse('CONTEXT_REFUSED');const agent=next.agent??{};
  for(const [key,value]of Object.entries(patch.agent))if(['oversight','data'].includes(key)){if(agent[key]!=null&&!object(agent[key]))refuse('CONTEXT_REFUSED');agent[key]={...(agent[key]??{}),...value};}else agent[key]=value;
  const answered=Object.entries(patch.agent).flatMap(([key,v])=>['oversight','data'].includes(key)?Object.keys(v).map(k=>key+'.'+k):[key]);
  if(Array.isArray(agent.incompleteFields))agent.incompleteFields=agent.incompleteFields.filter(k=>!answered.includes(k));next.agent=agent;
 }
 if(patch.references){
  if(before.links!==undefined&&!Array.isArray(before.links))refuse('CONTEXT_REFUSED');let links=structuredClone(before.links??[]);
  for(const r of patch.references.remove??[])links=links.filter(link=>!(isWholeReference(link)&&link.kind===r.kind&&(link.diagramId??link.documentId)===r.id));
  for(const r of patch.references.add??[]){
   if(r.kind==='document'&&r.id===before.id)refuse('REFERENCE_TARGET_REFUSED');
   if(targets&&(!Array.isArray(targets[r.kind==='diagram'?'diagrams':'workpapers'])||targets[r.kind==='diagram'?'diagrams':'workpapers'].filter(t=>t?.id===r.id).length!==1))refuse('REFERENCE_TARGET_REFUSED');
   if(links.some(link=>isWholeReference(link)&&link.kind===r.kind&&(link.diagramId??link.documentId)===r.id))continue;
   links.push(r.kind==='diagram'?{kind:r.kind,diagramId:r.id,nodeId:'',label:'',dangling:false}:{kind:r.kind,documentId:r.id,blockId:'',label:'',dangling:false});
  }
  if(links.length>60)refuse('REFERENCE_BUDGET');next.links=links;
 }
 return next;
}
export function documentContextDelta(before,next){
 const patch={};for(const key of ['type','owner'])if(next[key]!==before[key]&&Object.hasOwn(next,key))patch[key]=next[key];
 const agent={};for(const key of ['agentId','agentVersion','platform','environment','oversight','data']){
  const previous=before.agent?.[key],value=next.agent?.[key];
  if(['oversight','data'].includes(key)){
   const group={};for(const name of key==='oversight'?['mode','how','exceptions']:['types','confidential','personal','sensitive','restrictions'])if(value&&Object.hasOwn(value,name)&&(value[name]!==previous?.[name]||before.agent?.incompleteFields?.includes(key+'.'+name)&&!next.agent?.incompleteFields?.includes(key+'.'+name)))group[name]=value[name];
   if(Object.keys(group).length)agent[key]=group;
  }else if(next.agent&&Object.hasOwn(next.agent,key)&&(value!==previous||before.agent?.incompleteFields?.includes(key)&&!next.agent?.incompleteFields?.includes(key)))agent[key]=value;
 }
 if(Object.keys(agent).length)patch.agent=agent;
 const entries=v=>new Map((Array.isArray(v.links)?v.links:[]).filter(isWholeReference).map(link=>[link.kind+':'+(link.diagramId??link.documentId),{kind:link.kind,id:link.diagramId??link.documentId}]));
 const old=entries(before),current=entries(next),add=[...current].filter(([k])=>!old.has(k)).map(([,v])=>v),remove=[...old].filter(([k])=>!current.has(k)).map(([,v])=>v);
 if(add.length||remove.length)patch.references={...(add.length?{add}:{}),...(remove.length?{remove}:{})};return patch;
}
