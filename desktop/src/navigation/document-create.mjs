import {randomUUID} from 'node:crypto';
import {ProjectStore,verifySnapshot} from '../projects/store.mjs';
import {SourceRepository} from '../sources/repository.mjs';
import {commitManifest} from '../sources/manifest.mjs';
import {workspaceMetadata} from '../windows/entities.mjs';
import {navigationFields} from './contracts.mjs';

const fail=code=>({ok:false,code});
export function normalizeHomeDocument(input){
 const request=navigationFields(input,['title']);
 if(typeof request.title!=='string'||!request.title.trim()||request.title.length>160||!request.title.isWellFormed())throw Object.assign(Error('Document title refused'),{code:'REQUEST_REFUSED'});
 return request;
}
/** Native Home derives root, current project and all new identities. Its caller
 * must complete genuine all-view preparation before invoking this transaction.
 * No renderer project/path, source copy, release verdict or agent is invented. */
export async function createHomeDocument({root,snapshot,title,isCurrent,recovery,writerOptions={}}){
 const live=()=>{try{return isCurrent()===true;}catch{return false;}};
 const guard=()=>{if(!live())throw Object.assign(Error('Document creation access changed'),{code:'ACCESS_REFUSED'});};
 try{
  guard();normalizeHomeDocument({title});verifySnapshot(snapshot);if(snapshot.schema!==2)return fail('PROJECT_FORMAT_REFUSED');
  const projectId=snapshot.project.id,fault=async phase=>{if(writerOptions.fault)await writerOptions.fault(phase);if(phase==='before-select'||phase==='before-rename')guard();};
  const projects=new ProjectStore(root,{...writerOptions,fault,canSave:context=>live()&&context.projectId===projectId});
  const repository=new SourceRepository(root,{...writerOptions,fault,canWrite:context=>live()&&context.projectId===projectId});
  const current=await projects.readProject(projectId);guard();if(JSON.stringify(current)!==JSON.stringify(snapshot))return fail('REVISION_CONFLICT');
  const workspace=workspaceMetadata(current);if(workspace.workpapers!==undefined&&!Array.isArray(workspace.workpapers))return fail('PROJECT_FORMAT_REFUSED');
  if((workspace.workpapers??[]).length>=4096)return fail('NAVIGATION_LIMIT');
  const documentId=randomUUID();if((workspace.workpapers??[]).some(document=>document?.id===documentId))return fail('DOCUMENT_CREATE_FAILED');
  workspace.workpapers=[...(workspace.workpapers??[]),{id:documentId,title,blocks:[],agent:null,releases:[]}];
  const bag=JSON.parse(current.json),key='t-industries-siren-v23-state';let metadata;
  if(bag.storage&&Object.hasOwn(bag.storage,key)){bag.storage[key]=JSON.stringify(workspace);metadata=bag;}
  else if(Object.hasOwn(bag,'state')){bag.state=workspace;metadata=bag;}else metadata=workspace;
  const receipt=await commitManifest({projects,repository,recovery,projectId,baseRevision:current.revision,sourceRefs:current.sourceRefs,metadata,operationId:randomUUID()});guard();if(!receipt.ok)return fail(receipt.code);
  const saved=await projects.readProject(projectId);guard();if(saved.sha256!==receipt.sha256||saved.revision!==receipt.revision)return fail('DOCUMENT_CREATE_FAILED');
  return {ok:true,snapshot:saved};
 }catch(cause){return fail(['ACCESS_REFUSED','REQUEST_REFUSED'].includes(cause.code)?cause.code:'DOCUMENT_CREATE_FAILED');}
}
