import {randomUUID} from 'node:crypto';
import {ProjectStore,verifySnapshot} from '../projects/store.mjs';
import {SourceRepository,MAX_SOURCE_BYTES} from '../sources/repository.mjs';
import {commitManifest} from '../sources/manifest.mjs';
import {workspaceMetadata} from '../windows/entities.mjs';

const fail=code=>({ok:false,code});
/** Inputs come from a native owned file picker, never renderer paths/bytes.
 * The project has already passed the genuine all-view preparation barrier. */
export async function importHomeSource({root,snapshot,bytes,fileName,isCurrent,recovery,writerOptions={}}){
 const live=()=>{try{return isCurrent()===true;}catch{return false;}};
 const guard=()=>{if(!live())throw Object.assign(Error('Source import access changed'),{code:'ACCESS_REFUSED'});};
 try{
  guard();verifySnapshot(snapshot);if(snapshot.schema!==2)return fail('PROJECT_FORMAT_REFUSED');
  if(!Buffer.isBuffer(bytes)||bytes.length>MAX_SOURCE_BYTES)return fail('SOURCE_BUDGET');
  if(typeof fileName!=='string'||!fileName||fileName.length>200||!fileName.isWellFormed()||/[\\/\u0000-\u001f]/.test(fileName)||fileName==='.'||fileName==='..')return fail('REQUEST_REFUSED');
  try{new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{return fail('UNSUPPORTED_ENCODING');}
  const projectId=snapshot.project.id,fault=async phase=>{if(writerOptions.fault)await writerOptions.fault(phase);if(phase==='before-select'||phase==='before-rename')guard();};
  const projects=new ProjectStore(root,{...writerOptions,fault,canSave:context=>live()&&context.projectId===projectId});
  const repository=new SourceRepository(root,{...writerOptions,fault,canWrite:context=>live()&&context.projectId===projectId});
  const current=await projects.readProject(projectId);guard();if(JSON.stringify(current)!==JSON.stringify(snapshot))return fail('REVISION_CONFLICT');
  const fileId=randomUUID(),ref=await repository.importSource({projectId,bytes,provenance:{kind:'standalone',fileId,fileName}});guard();
  const workspace=workspaceMetadata(current);if(workspace.codeFiles!==undefined&&!Array.isArray(workspace.codeFiles))return fail('PROJECT_FORMAT_REFUSED');
  const sourceRef={sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256};
  workspace.codeFiles=[...(workspace.codeFiles??[]),{id:fileId,name:fileName,language:/\.py(?:w|i)?$/i.test(fileName)?'python':'text',linkedRef:null,sourceRef}];
  const bag=JSON.parse(current.json),key='t-industries-siren-v23-state';let metadata;
  if(bag.storage&&Object.hasOwn(bag.storage,key)){bag.storage[key]=JSON.stringify(workspace);metadata=bag;}
  else if(Object.hasOwn(bag,'state')){bag.state=workspace;metadata=bag;}else metadata=workspace;
  const result=await commitManifest({projects,repository,recovery,projectId,baseRevision:current.revision,sourceRefs:[...current.sourceRefs,ref],metadata,operationId:randomUUID()});guard();if(!result.ok)return fail(result.code);
  const saved=await projects.readProject(projectId);guard();if(saved.sha256!==result.sha256||saved.revision!==result.revision)return fail('SOURCE_READBACK_FAILED');
  return {ok:true,snapshot:saved};
 }catch(cause){return fail(cause.code==='ACCESS_REFUSED'?'ACCESS_REFUSED':'SOURCE_IMPORT_FAILED');}
}
