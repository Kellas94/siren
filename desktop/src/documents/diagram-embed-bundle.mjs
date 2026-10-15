import {isDeepStrictEqual} from 'node:util';
import {verifySnapshot} from '../projects/store.mjs';
import {verifySourceSnapshot} from '../sources/recovery.mjs';
import {verifyParsedSourceBundle,parseSourceBundle} from '../sources/bundle-import.mjs';
import {validateDiagramEmbedWorkspace,normalizeDiagramEmbedAssetRef} from './diagram-embeds.mjs';
import {verifyDiagramEmbedAsset} from './diagram-embed-export.mjs';
import {workspaceMetadata} from '../windows/entities.mjs';
import {normalizeDiagramEmbed} from './diagram-embeds.mjs';
const admittedAssets=new WeakMap();
const maximum=64*1024*1024;
const fail=code=>{throw Object.assign(Error(code),{code});};
const key=ref=>ref.kind+':'+ref.sha256;
const fields=(value,names)=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===names.length&&names.every(n=>Object.hasOwn(value,n));
function guard(callback){let revoked=false;return()=>{try{if(typeof callback!=='function'||callback()!==true)revoked=true;}catch{revoked=true;}if(revoked)fail('ACCESS_REFUSED');};}
export function diagramBundleRefs(snapshot){
 verifySnapshot(snapshot);const metadata=JSON.parse(snapshot.json);validateDiagramEmbedWorkspace(metadata);
 return (metadata.diagramEmbedAssets?.refs??[]).map(normalizeDiagramEmbedAssetRef);
}
/** Includes historical registry assets needed by saved Undo, not merely the
 * currently displayed blocks. Reads immutable owned blobs; no current renderer. */
export async function verifyDiagramSnapshot({snapshot,assets,isCurrent}){
 const current=guard(isCurrent);current();const records=[];
 for(const ref of diagramBundleRefs(snapshot)){current();if(typeof assets?.read!=='function')fail('DIAGRAM_EMBED_ASSET_UNKNOWN');const bytes=await assets.read({projectId:snapshot.project.id,ref,isCurrent:()=>{current();return true;}});current();records.push(verifyDiagramEmbedAsset({ref,bytes}));}return records;
}
export async function exportEmbedBundle({snapshot,sources,assets,isCurrent}){
 const current=guard(isCurrent);current();const refs=diagramBundleRefs(snapshot);
 const skeleton={format:'siren-workspace-bundle',version:1,snapshot,sources:snapshot.sourceRefs.map(ref=>({ref,base64:''})),assets:refs.map(ref=>({ref,base64:''}))};
 const expanded=[...snapshot.sourceRefs.map(r=>r.utf8Bytes),...refs.map(r=>r.bytes)].reduce((n,b)=>n+4*Math.ceil(b/3),0);
 if(expanded+Buffer.byteLength(JSON.stringify(skeleton))>maximum)fail('BACKUP_BUDGET');
 const sourceRecords=await verifySourceSnapshot({snapshot,repository:sources});current();const records=await verifyDiagramSnapshot({snapshot,assets,isCurrent:()=>{current();return true;}});current();
 const bytes=Buffer.from(JSON.stringify({...skeleton,sources:sourceRecords.map(({ref,bytes})=>({ref,base64:bytes.toString('base64')})),assets:records.map(({ref,bytes})=>({ref,base64:bytes.toString('base64')}))}));if(bytes.length>maximum)fail('BACKUP_BUDGET');current();return bytes;
}
/** Finite DATA parser only. A valid hash is not SVG admission. The native
 * chosen-file integration must separately qualify visuals before any copy. */
export function parseEmbedBundle(bytes){
 if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>maximum)fail('BUNDLE_WIRE_BUDGET');let value;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail('BUNDLE_JSON_INVALID');}
 if(value?.format!=='siren-workspace-bundle')return null;
 if(!fields(value,['format','version','snapshot','sources','assets'])||value.version!==1)fail('BUNDLE_FORMAT_INVALID');const refs=diagramBundleRefs(value.snapshot);
 if(!Array.isArray(value.assets)||value.assets.length!==refs.length)fail('BUNDLE_REFERENCES_INVALID');const expected=new Map(refs.map(r=>[key(r),r])),seen=new Set();let total=0;
 // Preflight every wire record before allocating decoded buffers.
 for(const record of value.assets){if(!fields(record,['ref','base64'])||typeof record.base64!=='string')fail('BUNDLE_BASE64_INVALID');const ref=normalizeDiagramEmbedAssetRef(record.ref),id=key(ref);if(seen.has(id)||!isDeepStrictEqual(expected.get(id),ref))fail('BUNDLE_REFERENCES_INVALID');seen.add(id);if(record.base64.length!==4*Math.ceil(ref.bytes/3))fail('BUNDLE_BASE64_INVALID');total+=ref.bytes;if(total>128*1024*1024)fail('BUNDLE_SOURCE_BUDGET');}
 const assets=value.assets.map(({ref,base64})=>{const bytes=Buffer.from(base64,'base64');if(bytes.toString('base64')!==base64)fail('BUNDLE_BASE64_INVALID');return verifyDiagramEmbedAsset({ref,bytes});});
 const bundle=parseSourceBundle(Buffer.from(JSON.stringify({format:'siren-source-bundle',schema:2,snapshot:value.snapshot,sources:value.sources})),{allowDiagramAssets:true});
 return {bundle:verifyParsedSourceBundle(bundle),assets};
}
/** Native-only qualification. Neither parsed DATA nor a structured clone can
 * mint the private copy capability. Currently only the shipped SVG producer
 * is admitted; PNG import awaits its separate decoder qualification. */
export async function qualifyEmbedBundle({parsed,createValidator,isCurrent}){
 const current=guard(isCurrent);current();const bundle=verifyParsedSourceBundle(parsed.bundle),expected=diagramBundleRefs(bundle.snapshot);
 if(!Array.isArray(parsed.assets)||parsed.assets.length!==expected.length)fail('BUNDLE_REFERENCES_INVALID');
 const records=parsed.assets.map(verifyDiagramEmbedAsset),byKey=new Map(records.map(r=>[key(r.ref),r]));if(byKey.size!==expected.length||expected.some(r=>!isDeepStrictEqual(byKey.get(key(r))?.ref,r)))fail('BUNDLE_REFERENCES_INVALID');
 const captures=new Map();for(const record of records)if(record.ref.kind==='diagram-source'){let capture;try{capture=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(record.bytes));}catch{fail('BUNDLE_DIAGRAM_SOURCE_INVALID');}if(!capture||typeof capture!=='object'||Array.isArray(capture)||typeof capture.id!=='string'||typeof capture.source!=='string'||!Number.isSafeInteger(capture.sirenNativeVersion??1)||(capture.sirenNativeVersion??1)<1)fail('BUNDLE_DIAGRAM_SOURCE_INVALID');captures.set(record.ref.sha256,capture);}
 for(const doc of workspaceMetadata(bundle.snapshot).workpapers??[])for(const value of doc.blocks??[])if(value?.kind==='diagram-embed'){const b=normalizeDiagramEmbed(value),capture=captures.get(b.snapshot.sourceAsset.sha256);if(b.snapshot.sourceHash!==b.snapshot.sourceAsset.sha256||capture?.id!==b.diagramId||(capture.sirenNativeVersion??1)!==b.snapshot.sourceVersion)fail('BUNDLE_DIAGRAM_SOURCE_INVALID');}
 let validator;try{validator=await createValidator();current();if(typeof validator?.validateDiagramAsset!=='function'||typeof validator?.dispose!=='function')fail('IMPORT_VALIDATOR_UNAVAILABLE');for(const record of records){current();if(record.ref.kind==='diagram-source')continue;let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(record.bytes);}catch{fail('BUNDLE_DIAGRAM_VISUAL_REFUSED');}if(record.ref.kind!=='svg'||await validator.validateDiagramAsset(record.ref.kind,text)!==true)fail('BUNDLE_DIAGRAM_VISUAL_REFUSED');current();}}
 finally{if(validator)await validator.dispose();}current();const token=Object.freeze({});admittedAssets.set(token,{snapshot:bundle.snapshot,records});return token;
}
export function readAdmittedEmbedAssets(token,snapshot){const value=admittedAssets.get(token);if(!value||!isDeepStrictEqual(value.snapshot,snapshot))fail('BUNDLE_DIAGRAM_ADMISSION_REQUIRED');return value.records.map(verifyDiagramEmbedAsset);}
export async function importEmbedBundle({bytes,projects,sources,assets,recovery,isCurrent,createValidator,fileName='workspace.siren-backup'}){
 if(recovery?.sources!==sources||recovery?.assets!==assets||typeof projects?.root!=='string')fail('BUNDLE_RECOVERY_REFUSED');
 const {admitImportedProject}=await import('../projects/import-admission.mjs');const admitted=await admitImportedProject({bytes,fileName},{createValidator,isCurrent});if(admitted.kind!=='sources'||!admitted.diagramAdmission)fail('BUNDLE_FORMAT_INVALID');
 const {createImportedSourceBundleCopy}=await import('../navigation/source-bundle-copy.mjs');const result=await createImportedSourceBundleCopy({root:projects.root,...admitted,recovery,writerOptions:projects.writerOptions,isCurrent});if(!result.ok)throw Object.assign(Error(result.code),result);return result.snapshot;
}
