import {randomUUID} from 'node:crypto';
import {ProjectStore,verifySnapshot} from '../projects/store.mjs';
import {SourceRepository} from '../sources/repository.mjs';
import {commitManifest} from '../sources/manifest.mjs';
import {migrateLegacySources} from '../sources/migration.mjs';

const refused=code=>({ok:false,code});
/** Native Home owns the root, legacy snapshot and transition fence. Only a
 * newly created directory can be written; original projects remain untouched.
 * Every selector rename checks the original live frame/PIN, even mid-copy. */
export async function createHomeProjectCopy({root,label,legacySnapshot,isCurrent,recovery,writerOptions={}}){
 let copyId=null;
 const live=()=>{try{return isCurrent()===true;}catch{return false;}};
 const guard=()=>{if(!live())throw Object.assign(Error('Copy access changed'),{code:'ACCESS_REFUSED'});};
 const fault=async phase=>{if(writerOptions.fault)await writerOptions.fault(phase);if(phase==='before-select'||phase==='before-rename')guard();};
 const projects=new ProjectStore(root,{...writerOptions,fault,canSave:({action,projectId})=>live()&&(action==='create'?copyId===null:projectId===copyId)});
 const repository=new SourceRepository(root,{...writerOptions,fault,canWrite:({projectId})=>live()&&copyId!==null&&projectId===copyId});
 const create=projects.createProject.bind(projects);
 projects.createProject=async input=>{guard();const result=await create(input);copyId=result.project.id;guard();return result;};
 try{
  guard();let snapshot;
  if(legacySnapshot!==undefined){
   verifySnapshot(legacySnapshot);if(legacySnapshot.schema!==1)return refused('PROJECT_FORMAT_REFUSED');
   const original=await projects.readProject(legacySnapshot.project.id);guard();
   if(JSON.stringify(original)!==JSON.stringify(legacySnapshot))return refused('REVISION_CONFLICT');
   const result=await migrateLegacySources({snapshot:original,projects,repository,recovery});guard();
   if(!result.ok)return refused(result.reason==='ACCESS_REFUSED'?'ACCESS_REFUSED':'MIGRATION_INCOMPLETE');snapshot=result.snapshot;
  }else{
   if(typeof label!=='string'||!label.trim()||label.length>200||!label.isWellFormed())return refused('REQUEST_REFUSED');
   const diagramId=randomUUID(),documentId=randomUUID(),workspace={diagrams:[{id:diagramId,name:'Untitled diagram',source:'flowchart TD\n    A[Start] --> B[Next step]',sirenNativeVersion:1}],activeDiagramId:diagramId,workpapers:[{id:documentId,title:'Untitled document',blocks:[],agent:null,releases:[]}],codeFiles:[]};
   const metadata={kind:'siren-desktop',schema:2,storage:{'t-industries-siren-v23-state':JSON.stringify(workspace)}};
   const initial=await projects.createProject({label,json:JSON.stringify(metadata)});guard();
   const receipt=await commitManifest({projects,repository,recovery,projectId:copyId,baseRevision:initial.revision,sourceRefs:[],metadata,operationId:randomUUID()});guard();
   if(!receipt.ok)return refused(receipt.code);snapshot=await projects.readProject(copyId);guard();
   if(snapshot.sha256!==receipt.sha256||snapshot.revision!==receipt.revision)return refused('COPY_READBACK_FAILED');
  }
  verifySnapshot(snapshot);guard();if(snapshot.schema!==2||snapshot.project.id!==copyId)return refused('COPY_READBACK_FAILED');
  if(recovery){const saved=await recovery.hasSavedSnapshot(snapshot);guard();if(saved!==true)return refused('MIGRATION_INCOMPLETE');}
  return {ok:true,snapshot};
 }catch(cause){return refused(cause.code==='ACCESS_REFUSED'?'ACCESS_REFUSED':'COPY_FAILED');}
}
