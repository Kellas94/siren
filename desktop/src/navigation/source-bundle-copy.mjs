import {randomUUID} from 'node:crypto';
import {resolve,join} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {ProjectStore,verifySnapshot} from '../projects/store.mjs';
import {SourceRepository} from '../sources/repository.mjs';
import {RecoveryStore} from '../recovery/checkpoints.mjs';
import {childDirectory} from '../projects/paths.mjs';
import {digest,exclusiveWriter,atomicWrite} from '../projects/atomic.mjs';
import {readOwnedBytes} from '../projects/io.mjs';
import {commitManifest,sourceReferenceKey,selectedManifestHistory} from '../sources/manifest.mjs';
import {remapSourceReferences} from '../sources/migration.mjs';
import {verifyParsedSourceBundle,verifyBundleMetadata} from '../sources/bundle-import.mjs';

const statusFile='source-import-status.json';
/** Native discovery/open fence. Absent is an ordinary project; unreadable or
 * malformed status is a refusal, never absence or a completed import. */
export async function readSourceBundleImportStatus({projects,projectId}){
 try{
  if(!(projects instanceof ProjectStore))throw Error('Owned project store required');
  const directory=await projects.directory(projectId);let bytes;
  try{bytes=await readOwnedBytes(join(directory,statusFile),4096);}catch(cause){if(cause.code==='ENOENT')return null;throw cause;}
  const status=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),allowed=status?.state==='complete'?['schema','projectId','state','revision','sha256']:['schema','projectId','state'];
  if(!status||typeof status!=='object'||Array.isArray(status)||Object.keys(status).length!==allowed.length||allowed.some(key=>!Object.hasOwn(status,key))||status.schema!==1||status.projectId!==projectId||!['incomplete','complete'].includes(status.state))throw Error('Invalid import status');
  if(status.state==='complete'){
   if(!Number.isSafeInteger(status.revision)||status.revision<2||typeof status.sha256!=='string'||!/^[a-f0-9]{64}$/.test(status.sha256))throw Error('Invalid completed import status');
   const snapshot=await projects.readProject(projectId);if(snapshot.schema!==2||snapshot.revision<status.revision)throw Error('Completed import status differs from manifest');
   if(snapshot.revision===status.revision){if(snapshot.sha256!==status.sha256)throw Error('Completed import status differs from manifest');}
   else if(!(await selectedManifestHistory(projects,projectId)).some(item=>item.revision===status.revision&&item.sha256===status.sha256))throw Error('Completed import is not a selected ancestor');
  }
  return status;
 }catch{throw Object.assign(Error('Source bundle import status refused'),{code:'BUNDLE_IMPORT_STATUS_REFUSED'});}
}

/** Native-only new-copy transaction. It never writes a session pointer or an
 * existing project; caller owns all-view preparation and final selection. */
export async function createImportedSourceBundleCopy({root,bundle,metadata,isCurrent,recovery,writerOptions={}}){
 let allocatedId=null,revoked=false,completionAttempted=false;
 const guard=()=>{let current=false;try{current=isCurrent()===true;}catch{}if(!current)revoked=true;if(revoked)throw Object.assign(Error('Bundle import access changed'),{code:'ACCESS_REFUSED'});};
 try{
  guard();const verified=verifyParsedSourceBundle(bundle),admitted=verifyBundleMetadata(metadata,verified);
  if(!(recovery instanceof RecoveryStore)||resolve(recovery.root)!==resolve(root)||!recovery.sources)throw Object.assign(Error('Owned recovery reader required'),{code:'BUNDLE_RECOVERY_REFUSED'});
  const fault=async phase=>{if(writerOptions.fault)await writerOptions.fault(phase);guard();};
  const projects=new ProjectStore(root,{...writerOptions,fault,canSave:({action,projectId})=>{guard();return action==='create'?allocatedId===null:projectId===allocatedId;}});
  const repository=new SourceRepository(root,{...writerOptions,fault,canWrite:({projectId})=>{guard();return allocatedId!==null&&projectId===allocatedId;}});
  // Recovery scans other owned projects. Keep the supplied genuine global read
  // authority; only the newly copied project's writes/checkpoint are initiated.
  const guardedRecovery=new RecoveryStore(root,{...recovery.writerOptions,...writerOptions,now:recovery.now,sources:recovery.sources,fault:async phase=>{if(recovery.fault)await recovery.fault(phase);await fault(phase);}});
  if(!await projects.canSave({action:'create'}))throw Error('Copy creation refused');
  const parent=await projects.projectsRoot();guard();const copyId=randomUUID();
  const directory=await childDirectory(parent,copyId,{create:true});allocatedId=copyId;guard();
  const incomplete={schema:1,projectId:copyId,state:'incomplete'};
  await atomicWrite(join(directory,statusFile),Buffer.from(JSON.stringify(incomplete)),{fault});guard();
  if(!isDeepStrictEqual(await readSourceBundleImportStatus({projects,projectId:copyId}),incomplete))throw Error('Initial import status readback mismatch');guard();
  await childDirectory(directory,'revisions',{create:true});guard();await childDirectory(directory,'pending',{create:true});guard();
  const json=JSON.stringify({kind:'siren-incomplete-source-import',schema:1,importState:'incomplete'});
  const initial={schema:1,project:{id:copyId,label:`${verified.snapshot.project.label.slice(0,175)} — imported`,external:false},revision:1,json,sha256:digest(Buffer.from(json))};
  await exclusiveWriter(directory,()=>projects.commit(directory,initial,{canSelect:()=>{guard();return true;}}),projects.writerOptions);guard();
  const sourceRefs=[],mapping=new Map();
  for(const source of verified.sources){
   const copied=await repository.importSource({projectId:copyId,bytes:source.bytes,provenance:source.ref.provenance});guard();
   if(copied.sha256!==source.ref.sha256||copied.utf8Bytes!==source.ref.utf8Bytes||!isDeepStrictEqual(copied.provenance,source.ref.provenance))throw Error('Copied source differs');
   sourceRefs.push(copied);mapping.set(sourceReferenceKey(source.ref),copied);
  }
  const remapped=remapSourceReferences(admitted,mapping);
  const receipt=await commitManifest({projects,repository,recovery:guardedRecovery,projectId:copyId,baseRevision:initial.revision,sourceRefs,metadata:remapped,operationId:randomUUID(),purpose:'restore'});guard();
  if(!receipt.ok||receipt.durability==='recovery-degraded')throw Object.assign(Error('Copy manifest/checkpoint incomplete'),{code:receipt.code??'BUNDLE_CHECKPOINT_INCOMPLETE'});
  const snapshot=await projects.readProject(copyId);guard();verifySnapshot(snapshot);
  if(snapshot.schema!==2||snapshot.project.id!==copyId||snapshot.revision!==receipt.revision||snapshot.sha256!==receipt.sha256||snapshot.json!==JSON.stringify(remapped))throw Error('Copy manifest readback mismatch');
  for(const source of verified.sources){const copied=mapping.get(sourceReferenceKey(source.ref)),actual=await repository.readVerifiedVersion({projectId:copyId,sourceId:copied.sourceId,version:copied.version});guard();if(!isDeepStrictEqual(actual.ref,copied)||!actual.bytes.equals(source.bytes))throw Error('Copy source readback mismatch');}
  if(await guardedRecovery.hasSavedSnapshot(snapshot)!==true)throw Object.assign(Error('Exact saved copy checkpoint missing'),{code:'BUNDLE_CHECKPOINT_INCOMPLETE'});guard();
  const complete={schema:1,projectId:copyId,state:'complete',revision:snapshot.revision,sha256:snapshot.sha256};
  // Once publication starts, a later hook/readback/authority failure cannot
  // prove that the owned complete marker was never accepted. Retain the copy
  // unselected and let the strict status reader establish its durable state.
  completionAttempted=true;
  await atomicWrite(join(directory,statusFile),Buffer.from(JSON.stringify(complete)),{fault});guard();
  if(!isDeepStrictEqual(await readSourceBundleImportStatus({projects,projectId:copyId}),complete))throw Error('Completed import status readback mismatch');guard();
  return {ok:true,snapshot};
 }catch(cause){
  if(completionAttempted)return {ok:false,code:'BUNDLE_COMPLETION_UNCONFIRMED',completion:'unconfirmed',retainedProjectId:allocatedId,reason:cause.code??'BUNDLE_COPY_FAILED'};
  return {ok:false,code:cause.code??'BUNDLE_COPY_FAILED',...(allocatedId?{incompleteProjectId:allocatedId}:{} )};
 }
}
