import {isDeepStrictEqual} from 'node:util';
import {verifySnapshot} from '../projects/store.mjs';
import {sourceReferenceKey,manifestRequestHash} from './manifest.mjs';
import {measureSource} from './metrics.mjs';
import {digest} from '../projects/atomic.mjs';

const maximum={wireBytes:64*1024*1024,sourceBytes:32*1024*1024,decodedBytes:256*1024*1024,references:65536,nodes:1000000,depth:64,provenanceBytes:65536};
const refused=code=>Object.assign(Error(code),{code});
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
const keys=(value,allowed)=>object(value)&&Object.keys(value).length===allowed.length&&allowed.every(key=>Object.hasOwn(value,key));
function budgets(input={}){
 if(!object(input)||Object.keys(input).some(key=>!Object.hasOwn(maximum,key)))throw refused('BUNDLE_BUDGET_INVALID');
 const result={...maximum,...input};for(const [key,value]of Object.entries(result))if(!Number.isSafeInteger(value)||value<0||value>maximum[key])throw refused('BUNDLE_BUDGET_INVALID');return result;
}
function checkTree(value,limit){
 let nodes=0;
 function visit(value,depth=0){
  if(++nodes>limit.nodes||depth>limit.depth)throw refused('BUNDLE_METADATA_BUDGET');
  if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return;
  if(typeof value==='string'){if(!value.isWellFormed())throw refused('BUNDLE_METADATA_INVALID');return;}
  if(Array.isArray(value)){for(const child of value)visit(child,depth+1);return;}
  if(!object(value))throw refused('BUNDLE_METADATA_INVALID');
  for(const [key,child]of Object.entries(value)){
   if(!key.isWellFormed())throw refused('BUNDLE_METADATA_INVALID');visit(child,depth+1);
   if(key==='storage'&&object(child))for(const stored of Object.values(child))if(typeof stored==='string'){let parsed;try{parsed=JSON.parse(stored);}catch{continue;}visit(parsed,depth+2);}
  }
 }
 visit(value);
}
function actualMetrics(bytes){
 let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{text=null;}
 let newline='none';if(text!==null){let crlf=false,lf=false,cr=false;for(let i=0;i<text.length;i++){if(text[i]==='\r'){if(text[i+1]==='\n'){crlf=true;i++;}else cr=true;}else if(text[i]==='\n')lf=true;}const types=[crlf&&'crlf',lf&&'lf',cr&&'cr'].filter(Boolean);newline=types.length>1?'mixed':types[0]??'none';}
 return {...(text===null?{utf8Bytes:bytes.length,utf16Units:null,lines:null,longestLineUnits:null}:measureSource(text)),encoding:text===null?'unsupported':'utf8',bom:bytes.length>=3&&bytes[0]===0xef&&bytes[1]===0xbb&&bytes[2]===0xbf,newline};
}
function snapshotParts(snapshot,limit){
 checkTree(snapshot,limit);verifySnapshot(snapshot);
 if(snapshot.schema!==2||snapshot.sourceRefs.length>limit.references)throw refused('BUNDLE_REFERENCES_INVALID');
 const metadata=JSON.parse(snapshot.json);checkTree(metadata,limit);
 for(const ref of snapshot.sourceRefs)if(Buffer.byteLength(JSON.stringify(ref.provenance))>limit.provenanceBytes)throw refused('BUNDLE_PROVENANCE_BUDGET');
 return metadata;
}
function verifiedParts(snapshot,records,limit){
 const metadata=snapshotParts(snapshot,limit);
 if(!Array.isArray(records)||records.length!==snapshot.sourceRefs.length||records.length>limit.references)throw refused('BUNDLE_REFERENCES_INVALID');
 const refs=new Map(snapshot.sourceRefs.map(ref=>[sourceReferenceKey(ref),ref])),seen=new Set();let total=0;
 for(const record of records){
  if(!keys(record,['ref','bytes'])||!(record.bytes instanceof Uint8Array)||!object(record.ref))throw refused('BUNDLE_SOURCE_INVALID');
  const key=sourceReferenceKey(record.ref),ref=refs.get(key);if(!ref||seen.has(key)||!isDeepStrictEqual(record.ref,ref))throw refused('BUNDLE_REFERENCES_INVALID');seen.add(key);
  total+=record.bytes.byteLength;if(record.bytes.byteLength>limit.sourceBytes||total>limit.decodedBytes)throw refused('BUNDLE_SOURCE_BUDGET');
 }
 const sources=records.map(({ref,bytes})=>{
  bytes=Buffer.from(bytes);const metrics=actualMetrics(bytes);
  if(digest(bytes)!==ref.sha256||Object.entries(metrics).some(([key,value])=>ref[key]!==value))throw refused('BUNDLE_SOURCE_MISMATCH');
  return {ref:JSON.parse(JSON.stringify(ref)),bytes};
 });
 return {snapshot:JSON.parse(JSON.stringify(snapshot)),metadata,sources};
}

/** Native-only chosen-file parser. Legacy format validation remains at caller. */
export function parseSourceBundle(bytes,{limits,allowDiagramAssets=false}={}){
 const limit=budgets(limits);if(!(bytes instanceof Uint8Array)||bytes.byteLength===0||bytes.byteLength>limit.wireBytes)throw refused('BUNDLE_WIRE_BUDGET');
 let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw refused('BUNDLE_JSON_INVALID');}
 if(value?.format!=='siren-source-bundle')return null;
 if(!keys(value,['format','schema','snapshot','sources'])||value.schema!==2)throw refused('BUNDLE_FORMAT_INVALID');
 snapshotParts(value.snapshot,limit);
 if(!allowDiagramAssets&&(JSON.parse(value.snapshot.json).diagramEmbedAssets?.refs?.length??0)>0)throw refused('BUNDLE_DIAGRAM_ASSETS_REQUIRED');
 if(!Array.isArray(value.sources)||value.sources.length!==value.snapshot.sourceRefs.length||value.sources.length>limit.references)throw refused('BUNDLE_REFERENCES_INVALID');
 let total=0;
 for(const source of value.sources){
  // A repeated-group regex overflowed V8's stack on valid 300k-line exports.
  // Scan the alphabet without groups, then check padding placement explicitly;
  // the decode/re-encode equality below still rejects noncanonical unused bits.
  if(!keys(source,['ref','base64'])||typeof source.base64!=='string'||source.base64.length%4!==0||/[^A-Za-z0-9+/=]/.test(source.base64))throw refused('BUNDLE_BASE64_INVALID');
  const padding=source.base64.endsWith('==')?2:source.base64.endsWith('=')?1:0,firstPadding=source.base64.indexOf('=');
  if(firstPadding!==-1&&firstPadding!==source.base64.length-padding)throw refused('BUNDLE_BASE64_INVALID');
  const size=source.base64.length/4*3-padding;total+=size;
  if(size>limit.sourceBytes||total>limit.decodedBytes)throw refused('BUNDLE_SOURCE_BUDGET');
 }
 const records=value.sources.map(({ref,base64})=>{const bytes=Buffer.from(base64,'base64');if(bytes.toString('base64')!==base64)throw refused('BUNDLE_BASE64_INVALID');return {ref,bytes};});
 return verifiedParts(value.snapshot,records,limit);
}

/** Copy boundaries recheck owned parsed data after asynchronous admission. */
export function verifyParsedSourceBundle(bundle,{limits}={}){
 const limit=budgets(limits);if(!keys(bundle,['snapshot','metadata','sources']))throw refused('BUNDLE_FORMAT_INVALID');
 const result=verifiedParts(bundle.snapshot,bundle.sources,limit);checkTree(bundle.metadata,limit);
 if(!isDeepStrictEqual(bundle.metadata,result.metadata))throw refused('BUNDLE_METADATA_MISMATCH');return result;
}

/** Metadata comes from isolated native admission, not renderer input. Verify
 * that its pointer graph still refers only to the exact admitted source set. */
export function verifyBundleMetadata(metadata,bundle){
 const limit=budgets();checkTree(metadata,limit);const json=JSON.stringify(metadata),snapshot={...bundle.snapshot,json,sha256:digest(Buffer.from(json))};
 snapshot.requestHash=manifestRequestHash({projectId:snapshot.project.id,baseRevision:snapshot.revision-1,sourceRefs:snapshot.sourceRefs,json,operationId:snapshot.operationId});
 snapshotParts(snapshot,limit);
 const graph=value=>{
  const pointers=new Map();
  function visit(value,path=[]){
   if(Array.isArray(value)){value.forEach((child,index)=>visit(child,[...path,index]));return;}if(!object(value))return;
   for(const [key,child]of Object.entries(value)){
    const next=[...path,key];if(key==='sourceRef'||key==='baseSourceRef')pointers.set(JSON.stringify(next),child);
    else if(key==='storage'&&object(child))for(const [storedKey,stored]of Object.entries(child)){if(typeof stored==='string'){let parsed;try{parsed=JSON.parse(stored);}catch{continue;}visit(parsed,[...next,storedKey]);}else visit(stored,[...next,storedKey]);}
    else visit(child,next);
   }
  }
  visit(value);return pointers;
 };
 if(!isDeepStrictEqual(graph(bundle.metadata),graph(metadata)))throw refused('BUNDLE_POINTER_GRAPH_CHANGED');
 return JSON.parse(json);
}
