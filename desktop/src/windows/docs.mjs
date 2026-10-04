import { verifySnapshot } from '../projects/store.mjs';
import { digest } from '../projects/atomic.mjs';
import { validId } from '../projects/paths.mjs';
import { navigationFields } from '../navigation/contracts.mjs';
import { workspaceMetadata } from './entities.mjs';
import { commitManifest, selectedManifestHistory, sourceReferenceKey } from '../sources/manifest.mjs';

const workspaceKey='t-industries-siren-v23-state';
const error=code=>Object.assign(new Error(code),{code});
const hash=value=>typeof value==='string' && /^[a-f0-9]{64}$/.test(value);
const entity=value=>typeof value==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const pointer=ref=>({sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256});
const fingerprint=value=>digest(Buffer.from(JSON.stringify(value)));
const guard=scope=>{if(!scope || !validId(scope.projectId) || scope.isCurrent?.()!==true)throw error('ACCESS_REFUSED');};

function document(workspace,documentId) {
  const matches=(workspace.workpapers??[]).filter(value=>value?.id===documentId);
  if(matches.length!==1)throw error('DOCUMENT_REFUSED');
  return matches[0];
}
function linkedRow(doc,rowId) {
  const rows=(doc.blocks??[]).filter(block=>block?.kind==='knowledge').flatMap(block=>block.rows??[]).filter(row=>row?.id===rowId);
  if(rows.length!==1)throw error('LINK_TARGET_REFUSED');
  return rows[0];
}
// Content CAS token, scoped to the native project/document; no source text is
// returned. Exact restored content is the same content version by definition.
export function documentVersion(snapshot,documentId) {
  verifySnapshot(snapshot);
  return documentContentVersion(snapshot.project.id,document(workspaceMetadata(snapshot),documentId));
}
// Native metadata catalogs verify their whole snapshot once, then hash each
// selected document once. The content token stays identical to documentVersion.
export function documentContentVersion(projectId,doc){
  if(!validId(projectId)||!entity(doc?.id))throw error('DOCUMENT_REFUSED');
  return fingerprint({projectId,documentId:doc.id,document:doc});
}
export function normalizeDocsLink(input) {
  const data=navigationFields(input,['operationId','documentId','rowId','expectedDocumentVersion','sourceReceipt']);
  const receipt=navigationFields(data.sourceReceipt,['ok','operationId','sourceId','version','sha256','durability']);
  if(!validId(data.operationId)||!entity(data.documentId)||!entity(data.rowId)||!hash(data.expectedDocumentVersion)||
    receipt.ok!==true || !validId(receipt.operationId)||!validId(receipt.sourceId)||!Number.isSafeInteger(receipt.version)||receipt.version<1||!hash(receipt.sha256)||!['committed','recovery-degraded'].includes(receipt.durability))throw error('REQUEST_REFUSED');
  return {...data,sourceReceipt:receipt};
}
const createdRowId=operationId=>'code-'+fingerprint(operationId).slice(0,32);
export function normalizeDocsCreation(input){
 try{
 const {rowTitle,...data}=navigationFields(input,['operationId','documentId','expectedDocumentVersion','rowTitle','sourceReceipt']);
 if(!validId(data.operationId))throw error('REQUEST_REFUSED');
 if(typeof rowTitle!=='string'||!rowTitle.trim()||rowTitle.length>160||!rowTitle.isWellFormed()||/[\x00-\x1f\x7f]/.test(rowTitle))throw error('REQUEST_REFUSED');
 const {rowId,...normalized}=normalizeDocsLink({...data,rowId:createdRowId(data.operationId)});
 return {...normalized,rowTitle};
 }catch{throw error('REQUEST_REFUSED');}
}
function envelope(snapshot,workspace) {
  const metadata=JSON.parse(snapshot.json);
  if(metadata.storage && Object.hasOwn(metadata.storage,workspaceKey)) metadata.storage[workspaceKey]=JSON.stringify(workspace);
  else if(Object.hasOwn(metadata,'state')) metadata.state=workspace;
  else return workspace;
  return metadata;
}
const receipt=(snapshot,marker,durability)=>({ok:true,operationId:marker.operationId,documentId:marker.documentId,
  rowId:marker.rowId,documentVersion:marker.documentVersion,projectRevision:snapshot.revision,sourceRef:marker.sourceRef,durability});

const resultCodes=new Set(['REQUEST_REFUSED','ACCESS_REFUSED','DOCUMENT_REFUSED','DOCUMENT_CONFLICT','LINK_TARGET_REFUSED','UNKNOWN_COMMIT',
  'COMMIT_RECEIPT_MISMATCH','CORRUPT_SOURCE','OPERATION_CONFLICT','REVISION_CONFLICT','WRITER_BUSY','OWNED_PATH_REFUSED','PROJECT_BUDGET','SOURCE_BUDGET','CATALOG_BUDGET','DOCS_LINK_FAILED']);
export function projectDocsReceipt(result,request) {
  try {
    if(result?.ok!==true)return Object.freeze({ok:false,code:resultCodes.has(result?.code)?result.code:'DOCS_LINK_FAILED'});
    const data=navigationFields(result,['ok','operationId','documentId','rowId','documentVersion','projectRevision','sourceRef','durability']);
    const ref=navigationFields(data.sourceRef,['sourceId','version','sha256']);
    if(data.operationId!==request.operationId || data.documentId!==request.documentId || data.rowId!==request.rowId || !hash(data.documentVersion) ||
      !Number.isSafeInteger(data.projectRevision)||data.projectRevision<1 || !['committed','recovery-degraded'].includes(data.durability)||
      ref.sourceId!==request.sourceReceipt.sourceId||ref.version!==request.sourceReceipt.version||ref.sha256!==request.sourceReceipt.sha256)throw error('DOCS_RESULT_REFUSED');
    return Object.freeze({...data,sourceRef:Object.freeze(ref)});
  } catch {return Object.freeze({ok:false,code:'DOCS_RESULT_REFUSED'});}
}

export function projectDocsCreationReceipt(result,request){return projectDocsReceipt(result,{...request,rowId:createdRowId(request.operationId)});}

/** Native-only explicit link service. Factories bind every durable write to the
 * invocation's actual native grant; no renderer supplies a snapshot/path. */
export class DocsLinkService {
  #projects;#sources;#recovery;
  constructor({projects,sources,recovery}) {
    if(typeof projects!=='function'||typeof sources!=='function')throw TypeError('Native scoped factories required');
    this.#projects=projects;this.#sources=sources;this.#recovery=recovery;
  }
  commitCodeToDocs(input,scope){return this.#commit(input,scope,false);}
  createCodeToDocs(input,scope){return this.#commit(input,scope,true);}
  async #commit(input,scope,creating) {
    try {
      const normalized=creating?normalizeDocsCreation(input):normalizeDocsLink(input);
      const request=creating?{...normalized,rowId:createdRowId(normalized.operationId)}:normalized,requestHash=fingerprint(request);
      guard(scope);
      const canWrite=()=>scope.isCurrent()===true;
      const projects=this.#projects({canWrite,scope}),repository=this.#sources({canWrite,scope});
      const history=await selectedManifestHistory(projects,scope.projectId);guard(scope);
      const current=history[0];
      // Bind operation provenance to selected native project + manifest, not an
      // imported marker, cache, or merely existing revision file.
      const previous=history.find(value=>value.operationId===request.operationId);
      if(previous) {
        const marker=JSON.parse(previous.json).sirenNativeDocsLink;
        if(marker?.schema!==1 || marker.projectId!==scope.projectId || marker.operationId!==previous.operationId || marker.requestHash!==requestHash || creating&&marker.action!=='create')throw error('OPERATION_CONFLICT');
        const actualRow=linkedRow(document(workspaceMetadata(previous),request.documentId),request.rowId);
        if(marker.documentId!==request.documentId || marker.rowId!==request.rowId || marker.documentVersion!==documentVersion(previous,request.documentId) ||
          !marker.sourceRef || fingerprint(marker.sourceRef)!==fingerprint(pointer(request.sourceReceipt)) ||
          fingerprint(actualRow.sourceRef)!==fingerprint(marker.sourceRef))throw error('OPERATION_CONFLICT');
        const proof=await repository.getCommitReceipt({projectId:scope.projectId,sourceId:marker.sourceRef.sourceId,expectedVersion:marker.sourceRef.version,sha256:marker.sourceRef.sha256,operationId:request.sourceReceipt.operationId});guard(scope);
        if(!proof.ok)throw error(proof.code);
        // Resolve manifest durability through its existing exact duplicate path.
        const saved=await commitManifest({projects,repository,recovery:this.#recovery,projectId:scope.projectId,baseRevision:previous.revision-1,sourceRefs:previous.sourceRefs,metadata:JSON.parse(previous.json),operationId:previous.operationId});guard(scope);
        if(!saved.ok)return saved;
        return receipt(previous,marker,saved.durability==='committed'&&proof.durability==='committed'?'committed':'recovery-degraded');
      }
      if(documentVersion(current,request.documentId)!==request.expectedDocumentVersion)throw error('DOCUMENT_CONFLICT');
      const workspace=workspaceMetadata(current),doc=document(workspace,request.documentId);
      let row;
      if(creating){
        if(doc.blocks!==undefined&&!Array.isArray(doc.blocks))throw error('LINK_TARGET_REFUSED');
        const blocks=doc.blocks??[],blockId='knowledge-'+fingerprint(request.operationId).slice(0,32);
        if(blocks.length>=300)throw error('CATALOG_BUDGET');
        if(blocks.some(block=>block?.id===blockId||Array.isArray(block?.rows)&&block.rows.some(value=>value?.id===request.rowId)))throw error('LINK_TARGET_REFUSED');
        row={id:request.rowId,name:request.rowTitle};
        doc.blocks=[...blocks,{id:blockId,kind:'knowledge',rows:[row]}];
      }else{
        row=linkedRow(doc,request.rowId);
        if(row.sourceRef?.sourceId!==request.sourceReceipt.sourceId)throw error('LINK_TARGET_REFUSED');
      }
      const proof=await repository.getCommitReceipt({projectId:scope.projectId,sourceId:request.sourceReceipt.sourceId,expectedVersion:request.sourceReceipt.version,sha256:request.sourceReceipt.sha256,operationId:request.sourceReceipt.operationId});guard(scope);
      if(!proof.ok)throw error(proof.code);
      const ref=await repository.getMetrics({projectId:scope.projectId,sourceId:proof.sourceId,version:proof.version});guard(scope);
      row.sourceRef=pointer(ref);
      const metadata=envelope(current,workspace);
      const marker={schema:1,...(creating?{action:'create'}:{}),projectId:scope.projectId,operationId:request.operationId,requestHash,documentId:request.documentId,rowId:request.rowId,
        documentVersion:fingerprint({projectId:scope.projectId,documentId:request.documentId,document:doc}),sourceRef:pointer(ref)};
      metadata.sirenNativeDocsLink=marker;
      const refs=[...(current.sourceRefs??[])];
      if(!refs.some(value=>sourceReferenceKey(value)===sourceReferenceKey(ref)))refs.push(ref);
      const saved=await commitManifest({projects,repository,recovery:this.#recovery,projectId:scope.projectId,baseRevision:current.revision,sourceRefs:refs,metadata,operationId:request.operationId});guard(scope);
      if(!saved.ok)return saved; // No stale full-envelope retry with a fresh base.
      return receipt({revision:saved.revision},marker,saved.durability==='committed'&&proof.durability==='committed'?'committed':'recovery-degraded');
    } catch(failure) {return {ok:false,code:failure.code??'DOCS_LINK_FAILED'};}
  }
}
