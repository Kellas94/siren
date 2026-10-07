import {navigationFields} from '../navigation/contracts.mjs';
import {validId} from '../projects/paths.mjs';
import {digest} from '../projects/atomic.mjs';
import {verifySnapshot} from '../projects/store.mjs';
import {commitManifest,selectedManifestHistory} from '../sources/manifest.mjs';
import {workspaceMetadata,validEntityId} from './entities.mjs';
import {documentVersion} from './docs.mjs';
import {normalizeDocumentContext,applyDocumentContext} from '../documents/context.mjs';
import {normalizePresentationEdits,applyPresentationEdits} from '../documents/presentation-edits.mjs';
import {createDiagramMetadataContract} from '../documents/diagram-metadata.mjs';
import {randomUUID} from 'node:crypto';
import {appendCatalogueDiagram} from './diagram-create.mjs';
const error=code=>Object.assign(new Error(code),{code});
const fail=code=>Object.freeze({ok:false,code});
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const DOMAIN_BYTES=2*1024*1024;
const styleFields=['diagramTitle','diagramTitleTouched','direction','curve','fontFamily','fontSize','fontWeight','nodeStyles','styleClasses','nodeClasses','edgeStyles','edgeRoutes','nodeMetadata','comments','layout','view','links','icons','rules','numbering','legend','gitBranchColours','presentation'];
const resettableStyleFields=new Set(['diagramTitle','diagramTitleTouched','fontFamily','fontSize','fontWeight','nodeStyles','nodeMetadata']);
const diagramMetadata=createDiagramMetadataContract();
const managedNodeStyleFields=new Set(['fill','border','text','fontFamily','fontSize','fontWeight']);
// Copy only plain bounded JSON data, never execute getters/toJSON or retain a
// renderer-owned nested object. Native validators subsequently apply the frozen
// product's semantic rules to blocks/styles; no sanitized replacement is saved.
function dataCopy(value,depth=0,budget={nodes:0,bytes:0}) {
 if(depth>32||++budget.nodes>50000)throw error('REQUEST_REFUSED');
 if(typeof value==='string'){if(!value.isWellFormed()||(budget.bytes+=Buffer.byteLength(value))>(budget.limit??DOMAIN_BYTES))throw error('REQUEST_REFUSED');return value;}
 if(value===null||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value))return value;
 if(!value||typeof value!=='object')throw error('REQUEST_REFUSED');
 const array=Array.isArray(value),proto=Object.getPrototypeOf(value);if(array?proto!==Array.prototype:![Object.prototype,null].includes(proto))throw error('REQUEST_REFUSED');
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(array){const length=descriptors.length.value;if(length>50000||keys.length!==length+1)throw error('REQUEST_REFUSED');return Array.from({length},(_,i)=>{const item=descriptors[i];if(!item||!('value'in item))throw error('REQUEST_REFUSED');return dataCopy(item.value,depth+1,budget);});}
 return Object.fromEntries(keys.map(key=>{if(typeof key!=='string'||!('value'in descriptors[key])||!descriptors[key].enumerable)throw error('REQUEST_REFUSED');budget.bytes+=Buffer.byteLength(key);if(budget.bytes>(budget.limit??DOMAIN_BYTES))throw error('REQUEST_REFUSED');return [key,dataCopy(descriptors[key].value,depth+1,budget)];}));
}
function domainIntent(domain,input) {
 if(!['docs','diagram'].includes(domain))throw error('REQUEST_REFUSED');
 const idKey=domain==='docs'?'documentId':'diagramId',request=navigationFields(input,['operationId',idKey,'expectedVersion','action','payload']);
 if(!validId(request.operationId)||!validEntityId(request[idKey])||(domain==='docs'?!hash(request.expectedVersion):!Number.isSafeInteger(request.expectedVersion)||request.expectedVersion<1||request.expectedVersion>=Number.MAX_SAFE_INTEGER))throw error('REQUEST_REFUSED');
 let payload;
 if(domain==='docs'&&request.action==='rename'){payload=navigationFields(request.payload,['title']);if(typeof payload.title!=='string'||payload.title.length>160||!payload.title.isWellFormed())throw error('REQUEST_REFUSED');}
 else if(domain==='docs'&&['replace-blocks','replace-content','replace-context-content'].includes(request.action)){
  payload=navigationFields(request.payload,request.action==='replace-context-content'?['title','blocks','context']:request.action==='replace-content'?['title','blocks']:['blocks']);
  if(!Array.isArray(payload.blocks)||payload.blocks.length>300||request.action!=='replace-blocks'&&(typeof payload.title!=='string'||payload.title.length>160||!payload.title.isWellFormed()))throw error('REQUEST_REFUSED');
  if(request.action==='replace-context-content')payload.context=normalizeDocumentContext(payload.context);
 }
 else if(domain==='diagram'&&['replace-source','update-model'].includes(request.action)){payload=navigationFields(request.payload,['source']);if(typeof payload.source!=='string')throw error('REQUEST_REFUSED');}
 else if(domain==='diagram'&&request.action==='replace-content'){payload=navigationFields(request.payload,['source','resetStyleFields',...styleFields],['source']);if(typeof payload.source!=='string'||Object.keys(payload).length<2)throw error('REQUEST_REFUSED');}
 else if(domain==='diagram'&&request.action==='replace-deck-content'){payload=navigationFields(request.payload,['source','presentationEdits','resetStyleFields',...styleFields.filter(k=>k!=='presentation')],['source','presentationEdits']);if(typeof payload.source!=='string')throw error('REQUEST_REFUSED');payload.presentationEdits=normalizePresentationEdits(payload.presentationEdits);}
 else if(domain==='diagram'&&request.action==='update-style'){payload=navigationFields(request.payload,styleFields,[]);if(!Object.keys(payload).length)throw error('REQUEST_REFUSED');}
 else throw error('REQUEST_REFUSED');
 const copied=dataCopy(payload);if(Object.hasOwn(copied,'resetStyleFields')){const fields=copied.resetStyleFields;if(!Array.isArray(fields)||!fields.length||fields.length>7||new Set(fields).size!==fields.length||fields.some(key=>!resettableStyleFields.has(key)||Object.hasOwn(copied,key)))throw error('REQUEST_REFUSED');}if(Buffer.byteLength(JSON.stringify(copied))>DOMAIN_BYTES)throw error('REQUEST_REFUSED');
 return Object.freeze({...request,payload:copied});
}
export function normalizeDomainIntent(domain,input) {try{return domainIntent(domain,input);}catch{throw error('REQUEST_REFUSED');}}
export function normalizeDomainRequest(domain,method,input) {
 try {
  if(!['docs','diagram'].includes(domain))throw error('REQUEST_REFUSED');
  if(method===`apply${domain==='docs'?'Document':'Diagram'}`)return normalizeDomainIntent(domain,input);
  const read=method===`read${domain==='docs'?'Document':'Diagram'}`,flush=method===`flush${domain==='docs'?'Document':'Diagram'}`;
  if(!read&&!flush)throw error('REQUEST_REFUSED');const payload=navigationFields(input,read?['entityId']:['entityId','expectedVersion']);
  if(!validEntityId(payload.entityId)||flush&&(domain==='docs'?!hash(payload.expectedVersion):!Number.isSafeInteger(payload.expectedVersion)||payload.expectedVersion<1))throw error('REQUEST_REFUSED');return Object.freeze(payload);
 }catch{throw error('REQUEST_REFUSED');}
}
const fingerprint=value=>digest(Buffer.from(JSON.stringify(value)));
const guard=scope=>{if(!validId(scope?.projectId)||scope.isCurrent?.()!==true)throw error('ACCESS_REFUSED');};
function selectedEntity(snapshot,domain,id) {
 const list=workspaceMetadata(snapshot)[domain==='docs'?'workpapers':'diagrams'];
 const matches=(Array.isArray(list)?list:[]).filter(item=>item?.id===id);if(matches.length!==1)throw error('ENTITY_REFUSED');return matches[0];
}
function version(snapshot,domain,id) {
 if(domain==='docs')return documentVersion(snapshot,id);
 const value=selectedEntity(snapshot,domain,id).sirenNativeVersion??1;if(!Number.isSafeInteger(value)||value<1)throw error('ENTITY_REFUSED');return value;
}
function envelope(snapshot,workspace) {
 const metadata=JSON.parse(snapshot.json),key='t-industries-siren-v23-state';
 if(metadata.storage&&Object.hasOwn(metadata.storage,key))metadata.storage[key]=JSON.stringify(workspace);
 else if(Object.hasOwn(metadata,'state'))metadata.state=workspace;
 else return workspace;
 return metadata;
}
const receipt=(snapshot,domain,id,durability,operationId)=>Object.freeze({ok:true,domain,entityId:id,version:version(snapshot,domain,id),sha256:fingerprint(selectedEntity(snapshot,domain,id)),projectRevision:snapshot.revision,durability,...(operationId?{operationId}:{})});
const publicCodes=new Set(['REQUEST_REFUSED','ACCESS_REFUSED','ENTITY_REFUSED','ENTITY_BUDGET','DOMAIN_VALIDATION_FAILED','REFERENCE_TARGET_REFUSED','REFERENCE_BUDGET','CONTEXT_REFUSED','REVISION_CONFLICT','DOCUMENT_CONFLICT','OPERATION_CONFLICT','DOMAIN_READBACK_FAILED','DOMAIN_VERSION_CHANGED','MANIFEST_WRITE_FAILED','MANIFEST_READBACK_FAILED','WRITER_BUSY','OWNED_PATH_REFUSED','INLINE_SOURCE_REFUSED','UNKNOWN_SOURCE_REFERENCE']);
export function projectDomainResult(domain,method,result,request) {
 try {
  if(result?.ok!==true)return fail(publicCodes.has(result?.code)?result.code:'DOMAIN_OPERATION_FAILED');
  const reading=method.startsWith('read'),applying=method.startsWith('apply'),entityId=request.entityId??request.documentId??request.diagramId;
  const output=navigationFields(result,['ok','domain','entityId','version','sha256','projectRevision','durability',...(reading?['entity']:[]),...(applying?['operationId']:[])],['ok','domain','entityId','version','sha256','projectRevision','durability',...(reading?['entity']:[]),...(applying?['operationId']:[])]);
  if(output.domain!==domain||output.entityId!==entityId||!hash(output.sha256)||!Number.isSafeInteger(output.projectRevision)||output.projectRevision<1||!['committed','recovery-degraded'].includes(output.durability)||
    (domain==='docs'?!hash(output.version):!Number.isSafeInteger(output.version)||output.version<1)||applying&&output.operationId!==request.operationId)throw error('DOMAIN_RESULT_REFUSED');
  if(reading){const entity=dataCopy(output.entity,0,{nodes:0,bytes:0,limit:8*1024*1024});if(entity?.id!==entityId||fingerprint(entity)!==output.sha256||domain==='diagram'&&(entity.sirenNativeVersion??1)!==output.version||Buffer.byteLength(JSON.stringify(entity))>8*1024*1024)throw error('DOMAIN_RESULT_REFUSED');output.entity=entity;}
  return Object.freeze(output);
 }catch{return fail('DOMAIN_RESULT_REFUSED');}
}
/** Scoped native domain owner. The validator is a trusted frozen-product
 * adapter, not a renderer answer. It may refuse a patch but may not silently
 * normalize it. Sources, historic releases and unrelated entities are retained. */
export class DomainRepository {
 #projects;#sources;#recovery;#validate;#allocateDiagramId;
 constructor({projects,sources,recovery,validatePatch,allocateDiagramId=randomUUID}) {
  if(typeof projects!=='function'||typeof sources!=='function'||typeof validatePatch!=='function')throw TypeError('Native domain adapters required');
  this.#projects=projects;this.#sources=sources;this.#recovery=recovery;this.#validate=validatePatch;
  if(typeof allocateDiagramId!=='function')throw TypeError('Native diagram identity allocator required');this.#allocateDiagramId=allocateDiagramId;
 }
 #adapters(scope){guard(scope);const canWrite=()=>scope.isCurrent()===true;return {projects:this.#projects({scope,canWrite}),repository:this.#sources({scope,canWrite})};}
 async appendCatalogueDiagram(input,scope){
  try{return await appendCatalogueDiagram({...this.#adapters(scope),recovery:this.#recovery,validatePatch:this.#validate,allocateDiagramId:this.#allocateDiagramId},input,scope);}
  catch(cause){return fail(cause.code??'CATALOGUE_CREATION_FAILED');}
 }
 async read(domain,input,scope) {
  try{if(!['docs','diagram'].includes(domain))throw error('REQUEST_REFUSED');const {entityId}=navigationFields(input,['entityId']);if(!validEntityId(entityId))throw error('REQUEST_REFUSED');const {projects}=this.#adapters(scope),snapshot=await projects.readProject(scope.projectId);guard(scope);verifySnapshot(snapshot);const entity=selectedEntity(snapshot,domain,entityId);if(Buffer.byteLength(JSON.stringify(entity))>8*1024*1024)throw error('ENTITY_BUDGET');return Object.freeze({...receipt(snapshot,domain,entityId,'committed'),entity:JSON.parse(JSON.stringify(entity))});}
  catch(cause){return fail(cause.code??'DOMAIN_READ_FAILED');}
 }
 async apply(domain,input,scope) {
  try {
   const request=normalizeDomainIntent(domain,input),id=request[domain==='docs'?'documentId':'diagramId'],requestHash=fingerprint(request),{projects,repository}=this.#adapters(scope);
   const history=await selectedManifestHistory(projects,scope.projectId);guard(scope);const current=history[0],prior=history.find(snapshot=>snapshot.schema===2&&snapshot.operationId===request.operationId);
   if(prior){const marker=JSON.parse(prior.json).sirenNativeEntityOperation;
    if(marker?.schema!==1||marker.projectId!==scope.projectId||marker.domain!==domain||marker.entityId!==id||marker.requestHash!==requestHash||marker.sha256!==fingerprint(selectedEntity(prior,domain,id)))throw error('OPERATION_CONFLICT');
    const saved=await commitManifest({projects,repository,recovery:this.#recovery,projectId:scope.projectId,baseRevision:prior.revision-1,sourceRefs:prior.sourceRefs,metadata:JSON.parse(prior.json),operationId:prior.operationId});guard(scope);if(!saved.ok)return fail(saved.code);return receipt(prior,domain,id,saved.durability,request.operationId);
   }
   if(version(current,domain,id)!==request.expectedVersion)throw error(domain==='docs'?'DOCUMENT_CONFLICT':'REVISION_CONFLICT');
   const before=selectedEntity(current,domain,id);
   if(domain==='diagram'&&(Object.hasOwn(request.payload,'nodeMetadata')||request.payload.resetStyleFields?.includes('nodeMetadata'))&&!diagramMetadata.validate(request.payload.nodeMetadata,before.nodeMetadata))throw error('DOMAIN_VALIDATION_FAILED');
   if(domain==='diagram'&&request.payload.resetStyleFields?.includes('nodeStyles')&&Object.hasOwn(before,'nodeStyles')){const styles=before.nodeStyles;if(!styles||typeof styles!=='object'||Array.isArray(styles)||Object.values(styles).some(node=>!node||typeof node!=='object'||Array.isArray(node)||Object.keys(node).some(key=>!managedNodeStyleFields.has(key))))throw error('DOMAIN_VALIDATION_FAILED');}
   if(await this.#validate({domain,action:request.action,payload:dataCopy(request.payload),before:JSON.parse(JSON.stringify(before))},scope)!==true)throw error('DOMAIN_VALIDATION_FAILED');guard(scope);
   const workspace=workspaceMetadata(current),target=workspace[domain==='docs'?'workpapers':'diagrams'].find(item=>item.id===id);
   const content=Object.fromEntries(Object.entries(request.payload).filter(([k])=>k!=='resetStyleFields'));
   if(domain==='diagram')for(const key of request.payload.resetStyleFields??[])delete target[key];
   if(domain==='docs'&&request.action==='replace-context-content')Object.assign(target,applyDocumentContext(target,request.payload.context,{targets:workspace}),{title:request.payload.title,blocks:request.payload.blocks});
   else if(domain==='diagram'&&request.action==='replace-deck-content')Object.assign(target,Object.fromEntries(Object.entries(content).filter(([k])=>k!=='presentationEdits')),{presentation:applyPresentationEdits(target.presentation,request.payload.presentationEdits)});
   else Object.assign(target,content);if(domain==='diagram')target.sirenNativeVersion=request.expectedVersion+1;
   const metadata=envelope(current,workspace);metadata.sirenNativeEntityOperation={schema:1,projectId:scope.projectId,domain,entityId:id,requestHash,sha256:fingerprint(target)};
   const saved=await commitManifest({projects,repository,recovery:this.#recovery,projectId:scope.projectId,baseRevision:current.revision,sourceRefs:current.sourceRefs??[],metadata,operationId:request.operationId});guard(scope);if(!saved.ok)return fail(saved.code);
   const reopened=await projects.readProject(scope.projectId);guard(scope);if(reopened.revision!==saved.revision||fingerprint(selectedEntity(reopened,domain,id))!==fingerprint(target))throw error('DOMAIN_READBACK_FAILED');return receipt(reopened,domain,id,saved.durability,request.operationId);
  }catch(cause){return fail(cause.code??'DOMAIN_WRITE_FAILED');}
 }
 async flush(domain,input,scope) {
  try {
   const {entityId,expectedVersion}=navigationFields(input,['entityId','expectedVersion']);if(!validEntityId(entityId)||!['docs','diagram'].includes(domain))throw error('REQUEST_REFUSED');
   const {projects,repository}=this.#adapters(scope),snapshot=await projects.readProject(scope.projectId);guard(scope);verifySnapshot(snapshot);
   if(version(snapshot,domain,entityId)!==expectedVersion)throw error(domain==='docs'?'DOCUMENT_CONFLICT':'REVISION_CONFLICT');let durability='committed';
   if(snapshot.schema===2){const saved=await commitManifest({projects,repository,recovery:this.#recovery,projectId:scope.projectId,baseRevision:snapshot.revision-1,sourceRefs:snapshot.sourceRefs,metadata:JSON.parse(snapshot.json),operationId:snapshot.operationId});guard(scope);if(!saved.ok)return fail(saved.code);durability=saved.durability;}
   const latest=await projects.readProject(scope.projectId);guard(scope);if(version(latest,domain,entityId)!==expectedVersion||fingerprint(selectedEntity(latest,domain,entityId))!==fingerprint(selectedEntity(snapshot,domain,entityId)))throw error('DOMAIN_VERSION_CHANGED');
   return receipt(latest,domain,entityId,durability);
  }catch(cause){return fail(cause.code??'DOMAIN_FLUSH_FAILED');}
 }
}
