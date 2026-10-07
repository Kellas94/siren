import {digest} from '../projects/atomic.mjs';
import {validId} from '../projects/paths.mjs';
import {verifySnapshot} from '../projects/store.mjs';
import {commitManifest,selectedManifestHistory,manifestSnapshotHash} from '../sources/manifest.mjs';
import {workspaceMetadata,validEntityId} from './entities.mjs';
import {createDiagramCatalogueContract} from '../documents/diagram-catalogue.mjs';
import {navigationFields} from '../navigation/contracts.mjs';

const catalogue=createDiagramCatalogueContract();
const markerKey='sirenNativeCatalogueCreation',action='append-catalogue-diagram';
export const MAX_CATALOGUE_DIAGRAMS=10000;
const maxHistoryRecords=32768;
const error=code=>Object.assign(new Error(code),{code});
const fail=code=>Object.freeze({ok:false,code});
const json=value=>JSON.stringify(value),fingerprint=value=>digest(Buffer.from(json(value)));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const guard=scope=>{if(!validId(scope?.projectId)||scope.isCurrent?.()!==true)throw error('ACCESS_REFUSED');};
function snapshotIdentity(snapshot,scope){verifySnapshot(snapshot);if(snapshot.schema!==2)throw error('CATALOGUE_SCHEMA_REFUSED');if(snapshot.project.id!==scope.projectId)throw error('ACCESS_REFUSED');}
function container(snapshot){
 const workspace=workspaceMetadata(snapshot),list=Object.hasOwn(workspace,'diagrams')?workspace.diagrams:[];
 if(!Array.isArray(list))throw error('DIAGRAM_CONTAINER_REFUSED');
 if(list.length>MAX_CATALOGUE_DIAGRAMS)throw error('DIAGRAM_LIMIT');
 const ids=new Set();for(const item of list){if(!object(item)||!validEntityId(item.id)||ids.has(item.id))throw error('DIAGRAM_CONTAINER_REFUSED');ids.add(item.id);}
 return {workspace,list,ids};
}
function appendEnvelope(snapshot,diagram){
 const {workspace,list}=container(snapshot),bag=JSON.parse(snapshot.json),key='t-industries-siren-v23-state';
 workspace.diagrams=[...list,diagram];
 if(object(bag.storage)&&Object.hasOwn(bag.storage,key)){bag.storage[key]=json(workspace);return bag;}
 if(Object.hasOwn(bag,'state')){bag.state=workspace;return bag;}
 return workspace;
}
function identity(request,entry,projectId){return fingerprint({schema:1,action,projectId,request,catalogueVersion:catalogue.version,referenceSha256:catalogue.referenceSha256,sourceSha256:entry.sourceSha256});}
function newDiagram(id,request,entry,projectId){
 const minimal={id,name:request.title,source:entry.source,sirenNativeVersion:1};
 return {...minimal,[markerKey]:{schema:1,action,projectId,operationId:request.operationId,requestHash:identity(request,entry,projectId),catalogueVersion:catalogue.version,referenceSha256:catalogue.referenceSha256,entryId:entry.id,sourceSha256:entry.sourceSha256,entityId:id,entitySha256:fingerprint(minimal)}};
}
function verifiedHistory(history,scope){
 if(!Array.isArray(history)||!history.length||history.length>maxHistoryRecords)throw error('CATALOGUE_HISTORY_REFUSED');
 for(let i=0;i<history.length;i++){
  const child=history[i];snapshotIdentity(child,scope);const parent=history[i+1];
  if(parent){snapshotIdentity(parent,scope);if(child.revision!==parent.revision+1||child.parentRequestHash!==parent.requestHash||child.parentManifestHash!==manifestSnapshotHash(parent))throw error('CATALOGUE_HISTORY_REFUSED');}
  else if(child.parentRequestHash!==null||child.parentManifestHash!==null)throw error('CATALOGUE_HISTORY_REFUSED');
 }
}
function historicalDiagram(history,index,request,entry,scope){
 const child=history[index],parent=history[index+1];if(!parent)throw error('OPERATION_CONFLICT');
 const before=container(parent),after=container(child);
 if(after.list.length!==before.list.length+1)throw error('OPERATION_CONFLICT');
 const last=after.list.at(-1),id=last.id;
 if(before.ids.has(id))throw error('OPERATION_CONFLICT');
 const expected=newDiagram(id,request,entry,scope.projectId);
 if(json(last)!==json(expected)||json(child.project)!==json(parent.project)||json(child.sourceRefs)!==json(parent.sourceRefs)||json(appendEnvelope(parent,expected))!==child.json)throw error('OPERATION_CONFLICT');
 return last;
}
function availability(snapshot,diagram){
 try{
  const {list}=container(snapshot),matches=list.filter(item=>item.id===diagram.id);
  if(matches.length!==1)return Object.freeze({available:false,code:'ENTITY_REFUSED',projectRevision:snapshot.revision});
  const current=matches[0],version=current.sirenNativeVersion??1;
  if(json(current[markerKey])!==json(diagram[markerKey])||!Number.isSafeInteger(version)||version<1)return Object.freeze({available:false,code:'CREATION_IDENTITY_CHANGED',projectRevision:snapshot.revision});
  return Object.freeze({available:true,version,sha256:fingerprint(current),projectRevision:snapshot.revision});
 }catch(cause){return Object.freeze({available:false,code:cause.code??'ENTITY_REFUSED',projectRevision:snapshot.revision});}
}
const receipt=(snapshot,diagram,latest,saved,request)=>Object.freeze({ok:true,operationId:request.operationId,entityId:diagram.id,creation:Object.freeze({version:1,sha256:fingerprint(diagram),projectRevision:snapshot.revision,durability:saved.durability}),current:availability(latest,diagram)});
export function normalizeCatalogueCreation(input){const result=catalogue.normalizeRequest(input);if(!result.ok)throw error('REQUEST_REFUSED');return result.request;}
// Derive the complete immutable birth marker in main. Later legitimate entity
// edits may change name/source/version, but cannot rebind the creation identity.
// No marker or native capability is added to the renderer receipt.
export function matchesCatalogueCreation(entity,input,projectId){
 try{
  const normalized=catalogue.normalizeRequest(input);
  if(!normalized.ok||!validId(projectId)||!object(entity)||!validEntityId(entity.id))return false;
  const expected=newDiagram(entity.id,normalized.request,normalized.entry,projectId);
  return json(entity[markerKey])===json(expected[markerKey]);
 }catch{return false;}
}
export function projectCatalogueCreationReceipt(result,request){
 try{
  if(result?.ok!==true)return fail(['ACCESS_REFUSED','REQUEST_REFUSED','OPERATION_CONFLICT','DIAGRAM_LIMIT','DIAGRAM_CONTAINER_REFUSED','CATALOGUE_HISTORY_REFUSED','CATALOGUE_SCHEMA_REFUSED','MANIFEST_HISTORY_BUDGET','DOMAIN_VALIDATION_FAILED','REVISION_CONFLICT','DOMAIN_READBACK_FAILED','MANIFEST_READBACK_FAILED','MANIFEST_WRITE_FAILED','ENTITY_REFUSED','WRITER_BUSY'].includes(result?.code)?result.code:'CATALOGUE_CREATION_FAILED');
  const r=navigationFields(result,['ok','operationId','entityId','creation','current']),birth=navigationFields(r.creation,['version','sha256','projectRevision','durability']);
  const current=navigationFields(r.current,r.current?.available===true?['available','version','sha256','projectRevision']:['available','code','projectRevision']);
  const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),revision=v=>Number.isSafeInteger(v)&&v>=2;
  if(r.operationId!==request.operationId||!validEntityId(r.entityId)||birth.version!==1||!hash(birth.sha256)||!revision(birth.projectRevision)||!['committed','recovery-degraded'].includes(birth.durability)||!revision(current.projectRevision)||current.projectRevision<birth.projectRevision)throw error('CATALOGUE_RESULT_REFUSED');
  if(current.available===true){if(!Number.isSafeInteger(current.version)||current.version<1||!hash(current.sha256)||current.projectRevision===birth.projectRevision&&(current.version!==1||current.sha256!==birth.sha256))throw error('CATALOGUE_RESULT_REFUSED');}
  else if(current.available!==false||!['ENTITY_REFUSED','CREATION_IDENTITY_CHANGED','DIAGRAM_LIMIT','DIAGRAM_CONTAINER_REFUSED'].includes(current.code))throw error('CATALOGUE_RESULT_REFUSED');
  return Object.freeze({...r,creation:Object.freeze(birth),current:Object.freeze(current)});
 }catch{return fail('CATALOGUE_RESULT_REFUSED');}
}

/** Main-only append transaction. Caller must place it on the native owner FIFO.
 * A marker is consistency metadata, never sender authority or authorship proof.
 * Only the new object is marked; every existing envelope/opaque value is kept. */
export async function appendCatalogueDiagram({projects,repository,recovery,validatePatch,allocateDiagramId},input,scope){
 try{
  const normalized=catalogue.normalizeRequest(input);if(!normalized.ok)throw error('REQUEST_REFUSED');
  const {request,entry}=normalized;guard(scope);
  const history=await selectedManifestHistory(projects,scope.projectId,{maxRecords:maxHistoryRecords});guard(scope);verifiedHistory(history,scope);
  const current=history[0],matches=history.flatMap((snapshot,index)=>snapshot.operationId===request.operationId?[index]:[]);
  if(matches.length>1)throw error('OPERATION_CONFLICT');
  if(matches.length){
   const index=matches[0],prior=history[index],diagram=historicalDiagram(history,index,request,entry,scope);
   const saved=await commitManifest({projects,repository,recovery,projectId:scope.projectId,baseRevision:prior.revision-1,sourceRefs:prior.sourceRefs,metadata:JSON.parse(prior.json),operationId:request.operationId});guard(scope);if(!saved.ok)return fail(saved.code);
   const latest=await projects.readProject(scope.projectId);guard(scope);snapshotIdentity(latest,scope);if(latest.revision<prior.revision)throw error('DOMAIN_READBACK_FAILED');
   return receipt(prior,diagram,latest,saved,request);
  }
  const {list,ids}=container(current);
  if(list.some(item=>item[markerKey]?.operationId===request.operationId))throw error('OPERATION_CONFLICT');
  if(list.length>=MAX_CATALOGUE_DIAGRAMS)throw error('DIAGRAM_LIMIT');
  const id=allocateDiagramId();if(!validEntityId(id)||ids.has(id))throw error('ENTITY_REFUSED');
  const diagram=newDiagram(id,request,entry,scope.projectId);
  if(await validatePatch({domain:'diagram',action:'replace-source',payload:{source:entry.source},before:{id,name:request.title,source:entry.source,sirenNativeVersion:1}},scope)!==true)throw error('DOMAIN_VALIDATION_FAILED');guard(scope);
  const metadata=appendEnvelope(current,diagram);
  const saved=await commitManifest({projects,repository,recovery,projectId:scope.projectId,baseRevision:current.revision,sourceRefs:current.sourceRefs,metadata,operationId:request.operationId});guard(scope);if(!saved.ok)return fail(saved.code);
  const latest=await projects.readProject(scope.projectId);guard(scope);snapshotIdentity(latest,scope);
  if(latest.revision!==saved.revision||latest.json!==json(metadata))throw error('DOMAIN_READBACK_FAILED');
  return receipt(latest,diagram,latest,saved,request);
 }catch(cause){return fail(cause.code??'CATALOGUE_CREATION_FAILED');}
}
