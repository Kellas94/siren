// Pure typed DATA contracts. This module grants no read, render or write authority.
export const DIAGRAM_EMBED_ASSET_BYTES=2*1024*1024;
export const DIAGRAM_EMBED_DOCUMENT_BYTES=16*1024*1024;
export const DIAGRAM_EMBED_BLOCKS=64;
const refuse=(code='DIAGRAM_EMBED_REFUSED')=>{throw Object.assign(Error(code),{code});};
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const text=(v,max)=>typeof v==='string'&&v.isWellFormed()&&v.length<=max;
function fields(value,allowed,required=allowed){
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))refuse();
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(keys.some(k=>typeof k!=='string'||!allowed.includes(k)||!descriptors[k].enumerable||!Object.hasOwn(descriptors[k],'value'))||required.some(k=>!Object.hasOwn(descriptors,k)))refuse();
 return Object.fromEntries(keys.map(k=>[k,descriptors[k].value]));
}
function ids(value){
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)refuse();const descriptors=Object.getOwnPropertyDescriptors(value),n=descriptors.length?.value;
 if(!Number.isInteger(n)||n>250||Reflect.ownKeys(descriptors).length!==n+1)refuse();
 const result=Array.from({length:n},(_,i)=>{const d=descriptors[i];if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='string'||!/^[A-Za-z_][\w.-]{0,127}$/.test(d.value))refuse();return d.value;});if(new Set(result).size!==result.length)refuse();return result;
}
export function normalizeDiagramEmbedAssetRef(value){
 const r=fields(value,['sha256','bytes','kind']);if(!hash(r.sha256)||!Number.isSafeInteger(r.bytes)||r.bytes<1||r.bytes>DIAGRAM_EMBED_ASSET_BYTES||!['svg','png','diagram-source'].includes(r.kind))refuse();return r;
}
export function normalizeDiagramEmbed(value){
 try{
  const allowed=['id','kind','schema','diagramId','mode','scope','nodeIds','caption','display','snapshot','status','missingNodeIds'],r=fields(value,allowed,allowed.filter(k=>k!=='mode'));
  if(!Object.hasOwn(r,'mode'))r.mode='live';if(!id(r.id)||r.kind!=='diagram-embed'||r.schema!==1||!id(r.diagramId)||!['live','fixed'].includes(r.mode)||!['whole','selection'].includes(r.scope)||!text(r.caption,1000)||!['current','pending','missing','render-error'].includes(r.status))refuse();
  r.nodeIds=ids(r.nodeIds);r.missingNodeIds=ids(r.missingNodeIds);if(r.scope==='whole'&&r.nodeIds.length||r.scope==='selection'&&!r.nodeIds.length||r.missingNodeIds.some(v=>!r.nodeIds.includes(v))||r.status!=='missing'&&r.missingNodeIds.length)refuse();
  r.display=fields(r.display,['height','fit']);if(!Number.isInteger(r.display.height)||r.display.height<80||r.display.height>1600||!['contain','width'].includes(r.display.fit))refuse();
  r.snapshot=fields(r.snapshot,['sourceHash','sourceVersion','sourceAsset','visualAsset','rendererVersion','styleHash']);const s=r.snapshot;
  if(!hash(s.sourceHash)||!hash(s.styleHash)||!Number.isSafeInteger(s.sourceVersion)||s.sourceVersion<1||!text(s.rendererVersion,80)||!s.rendererVersion.length)refuse();
  s.sourceAsset=normalizeDiagramEmbedAssetRef(s.sourceAsset);s.visualAsset=normalizeDiagramEmbedAssetRef(s.visualAsset);if(s.sourceAsset.kind!=='diagram-source'||!['svg','png'].includes(s.visualAsset.kind))refuse();return r;
 }catch{refuse();}
}
export function validateDiagramEmbedDocument(document){
 if(!document||typeof document!=='object'||!Array.isArray(document.blocks))refuse();let count=0,bytes=0;const assets=new Map(),blockIds=new Set();
 for(const b of document.blocks){if(b?.kind!=='diagram-embed')continue;const r=normalizeDiagramEmbed(b);if(++count>DIAGRAM_EMBED_BLOCKS)refuse('DIAGRAM_EMBED_BUDGET');if(blockIds.has(r.id))refuse();blockIds.add(r.id);
  for(const ref of [r.snapshot.sourceAsset,r.snapshot.visualAsset]){const previous=assets.get(ref.sha256);if(previous!==undefined&&previous!==ref.bytes)refuse();if(previous===undefined){assets.set(ref.sha256,ref.bytes);bytes+=ref.bytes;}if(bytes>DIAGRAM_EMBED_DOCUMENT_BYTES)refuse('DIAGRAM_EMBED_BUDGET');}
 }
 return {blocks:count,assetBytes:bytes};
}
export function validateDiagramEmbedWorkspace(metadata){
 // Metadata has already passed the bounded plain-JSON envelope. Only actual
 // document collections are interpreted; unknown custom data remains untouched.
 const workspace=metadata?.storage?.['t-industries-siren-v23-state'];let state=metadata;
 if(typeof workspace==='string'){try{state=JSON.parse(workspace);}catch{state=null;}}
 else if(Object.hasOwn(metadata,'state'))state=metadata.state;
 if(state?.diagramEmbedRefreshSuspensions!==undefined)normalizeDiagramEmbedSuspensions(state.diagramEmbedRefreshSuspensions);
 const docs=Array.isArray(state?.workpapers)?state.workpapers:[],assets=new Map(),sizes=new Map();let total=0,blocks=0;
 if(Object.hasOwn(metadata,'diagramEmbedAssets')){
  const registry=fields(metadata.diagramEmbedAssets,['schema','refs']);if(registry.schema!==1||!Array.isArray(registry.refs)||registry.refs.length>4096)refuse();
  for(const value of registry.refs){const ref=normalizeDiagramEmbedAssetRef(value),key=ref.kind+':'+ref.sha256;if(assets.has(key))refuse();assets.set(key,ref);const previous=sizes.get(ref.sha256);if(previous!==undefined&&previous!==ref.bytes)refuse();if(previous===undefined){sizes.set(ref.sha256,ref.bytes);total+=ref.bytes;}if(total>128*1024*1024)refuse('DIAGRAM_EMBED_BUDGET');}
 }
 for(const doc of docs){if(!Array.isArray(doc?.blocks))continue;blocks+=validateDiagramEmbedDocument(doc).blocks;for(const block of doc.blocks){if(block?.kind!=='diagram-embed')continue;const normalized=normalizeDiagramEmbed(block);for(const ref of [normalized.snapshot.sourceAsset,normalized.snapshot.visualAsset]){const actual=assets.get(ref.kind+':'+ref.sha256);if(!actual||actual.bytes!==ref.bytes)refuse('DIAGRAM_EMBED_ASSET_UNKNOWN');}}}
 return {blocks,assets:assets.size,assetBytes:total};
}
export function normalizeDiagramEmbedSuspensions(value){
 const registry=fields(value,['schema','refs']);if(registry.schema!==1||!Array.isArray(registry.refs)||registry.refs.length>4096)refuse();const seen=new Set();
 return registry.refs.map(value=>{const r=fields(value,['documentId','blockId','snapshotHash']),key=r.documentId+':'+r.blockId;if(!id(r.documentId)||!id(r.blockId)||!hash(r.snapshotHash)||seen.has(key))refuse();seen.add(key);return r;});
}
