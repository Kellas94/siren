import {navigationFields} from '../navigation/contracts.mjs';
import {validId} from '../projects/paths.mjs';
import {validateWorkspace,MAX_WORKSPACE_BYTES} from '../projects/store.mjs';
import {failure} from '../ipc.mjs';
import {digest} from '../projects/atomic.mjs';

export {MAX_WORKSPACE_BYTES};
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const revision=value=>Number.isSafeInteger(value)&&value>=1;
const fail=code=>failure(code,'Primary persistence was not acknowledged; retain live work.');
export function normalizeWorkspaceSave(value) {
 try {
  const request=navigationFields(value,['projectId','baseRevision','json','purpose']);
  if(!validId(request.projectId)||!Number.isSafeInteger(request.baseRevision)||request.baseRevision<0||!['workspace','recovery'].includes(request.purpose))return null;
  validateWorkspace(request.json);return Object.freeze(request);
 }catch{return null;}
}
export function projectWorkspaceResult(value) {
 try {
  const inspected=navigationFields(value,['ok','revision','sha256','code','message','workspaceCommitted','unchanged','committedRevision','committedSha256','checkpointAcknowledged','recoveryCode'],['ok']);
  if(inspected.ok===true) {
   const result=navigationFields(value,['ok','revision','sha256']);
   return revision(result.revision)&&hash(result.sha256)?Object.freeze(result):fail('WORKSPACE_RESULT_REFUSED');
  }
  const result=navigationFields(value,['ok','code','message','workspaceCommitted','unchanged','committedRevision','committedSha256','checkpointAcknowledged','recoveryCode'],['ok','code']);
  if(result.ok!==false||typeof result.code!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(result.code)||Object.hasOwn(result,'message')&&(typeof result.message!=='string'||result.message.length>512))return fail('WORKSPACE_RESULT_REFUSED');
  if(result.code!=='RECOVERY_DEGRADED')return Object.freeze(fail(result.code));
  if(typeof result.workspaceCommitted!=='boolean'||result.checkpointAcknowledged!==false||typeof result.recoveryCode!=='string'||!/^[A-Z][A-Z0-9_]{0,63}$/.test(result.recoveryCode))return fail('WORKSPACE_RESULT_REFUSED');
  if(Object.hasOwn(result,'unchanged')&&result.unchanged!==true)return fail('WORKSPACE_RESULT_REFUSED');
  if(result.workspaceCommitted?(!revision(result.committedRevision)||!hash(result.committedSha256)):(Object.hasOwn(result,'committedRevision')||Object.hasOwn(result,'committedSha256')))return fail('WORKSPACE_RESULT_REFUSED');
  return Object.freeze({...result,message:'Recovery checkpoint was not acknowledged. Export and inspect recovery.'});
 }catch{return fail('WORKSPACE_RESULT_REFUSED');}
}

/** Main-only schema-1 persistence adapter. A whole-envelope legacy save uses
 * exact CAS; it can never overwrite or downgrade a schema-2 source manifest.
 * Private recovery has a separate durable checkpoint and no selected commit. */
export class PrimaryPersistence {
 #projects;#recovery;#onSelected;#latest=new Map();
 constructor({projects,recovery,onSelected=()=>{}}) {
  if(typeof projects!=='function'||!['checkpointProject','readProjectPoint'].every(key=>typeof recovery?.[key]==='function')||typeof onSelected!=='function')throw TypeError('Native primary persistence adapters required');
  this.#projects=projects;this.#recovery=recovery;this.#onSelected=onSelected;
 }
 #remember(projectId,purpose,pointId,receipt,selected=null) {
  const key=`${projectId}:${purpose}`;this.#latest.delete(key);this.#latest.set(key,{pointId,receipt,selected});
  while(this.#latest.size>128)this.#latest.delete(this.#latest.keys().next().value);
 }
 async save(input,scope) {
  const request=normalizeWorkspaceSave(input);if(!request)return fail('REQUEST_REFUSED');
  const current=()=>{try{return scope?.projectId===request.projectId&&scope.isCurrent()===true;}catch{return false;}};
  if(!current())return fail('ACCESS_REFUSED');
  const projects=this.#projects({canWrite:context=>context?.projectId===request.projectId&&context.action===request.purpose&&current()});
  try {
   const result=await projects.saveProject(request);if(!current())return fail('ACCESS_REFUSED');if(!result.ok)return projectWorkspaceResult(result);
   const selected=await projects.readProject(request.projectId);if(!current())return fail('ACCESS_REFUSED');
   const committed=request.purpose==='workspace'&&selected.schema===1&&selected.revision===request.baseRevision+(result.unchanged===true?0:1)&&selected.revision===result.revision&&selected.json===request.json&&selected.sha256===result.sha256;
   if(request.purpose==='workspace'&&!committed)return fail('SAVE_UNVERIFIED');
   if(selected.schema!==1||result.revision!==selected.revision)return fail('SAVE_UNVERIFIED');
   const checkpoint=committed?selected:{...selected,json:request.json,sha256:result.sha256};
   const kind=committed?'saved':'draft';let checkpointError,pointId;
   try {
    const prior=this.#latest.get(`${request.projectId}:workspace`);
    const reused=committed&&result.unchanged===true&&prior?.pointId&&
      (await this.verify({ok:true,revision:result.revision,sha256:result.sha256},{projectId:request.projectId,purpose:'workspace',isCurrent:current})).ok===true;
    if(reused)pointId=prior.pointId;
    else{
    const point=await this.#recovery.checkpointProject({snapshot:checkpoint,kind});
    if(!current())return fail('ACCESS_REFUSED');
    const actual=await this.#recovery.readProjectPoint(request.projectId,point.id);
    if(!current())return fail('ACCESS_REFUSED');
    if(actual.kind!==kind||actual.snapshot.schema!==1||actual.snapshot.project.id!==request.projectId||actual.snapshot.revision!==checkpoint.revision||actual.snapshot.json!==checkpoint.json||actual.snapshot.sha256!==checkpoint.sha256)throw Object.assign(Error('Checkpoint mismatch'),{code:'CHECKPOINT_UNVERIFIED'});
    pointId=point.id;
    }
   }catch(error){checkpointError=error;}
   if(!current())return fail('ACCESS_REFUSED');
   // Notify only the genuine current selection, including an independently
   // verified selected commit whose recovery checkpoint is degraded.
   if(committed)this.#onSelected(selected,scope);
   if(checkpointError)return projectWorkspaceResult({...fail('RECOVERY_DEGRADED'),workspaceCommitted:committed,...(result.unchanged===true?{unchanged:true}:{}),...(committed?{committedRevision:selected.revision,committedSha256:selected.sha256}:{}),checkpointAcknowledged:false,recoveryCode:typeof checkpointError.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(checkpointError.code)?checkpointError.code:'CHECKPOINT_FAILED'});
   if(committed){try{await projects.pruneRevisions({snapshot:selected,recovery:this.#recovery});}catch{/* Retain unpruned originals. */}}
   if(!current())return fail('ACCESS_REFUSED');
   try{await projects.acknowledgePending(request.projectId,result.pendingId);}catch{/* Retain unacknowledged original. */}
   if(!current())return fail('ACCESS_REFUSED');
   const receipt=projectWorkspaceResult({ok:true,revision:result.revision,sha256:result.sha256});
   // Store only bounded native checkpoint tokens, never another 64 MiB mirror.
   this.#remember(request.projectId,request.purpose,pointId,receipt);
   return receipt;
  }catch{return fail(current()?'SAVE_FAILED':'ACCESS_REFUSED');}
 }
 async sealReadonly(scope) {
  const current=()=>{try{return scope?.readonly===true&&validId(scope.projectId)&&scope.isCurrent()===true;}catch{return false;}};
  if(!current())return fail('ACCESS_REFUSED');
  try {
   const selected=await this.#projects({canWrite:()=>false}).readProject(scope.projectId);if(!current())return fail('ACCESS_REFUSED');
   if(scope.checkpoint===false){
    const receipt=projectWorkspaceResult({ok:true,revision:selected.revision,sha256:selected.sha256});
    this.#remember(scope.projectId,'readonly',null,receipt,Object.freeze({schema:selected.schema,sourceRefsSHA:digest(Buffer.from(JSON.stringify(selected.sourceRefs??[])))}));
    return receipt;
   }
   const point=await this.#recovery.checkpointProject({snapshot:selected,kind:'saved'});if(!current())return fail('ACCESS_REFUSED');
   const actual=await this.#recovery.readProjectPoint(scope.projectId,point.id);if(!current())return fail('ACCESS_REFUSED');
   if(actual.kind!=='saved'||actual.snapshot.schema!==selected.schema||actual.snapshot.project.id!==scope.projectId||actual.snapshot.revision!==selected.revision||actual.snapshot.sha256!==selected.sha256||actual.snapshot.json!==selected.json||JSON.stringify(actual.snapshot.sourceRefs)!==JSON.stringify(selected.sourceRefs))return fail('WORKSPACE_PROOF_FAILED');
   const receipt=projectWorkspaceResult({ok:true,revision:selected.revision,sha256:selected.sha256});
   this.#remember(scope.projectId,'readonly',point.id,receipt);return receipt;
  }catch{return fail(current()?'WORKSPACE_PROOF_FAILED':'ACCESS_REFUSED');}
 }
 async verify(input,scope) {
  const receipt=projectWorkspaceResult(input),purpose=scope?.purpose;
  const current=()=>{try{return validId(scope.projectId)&&['workspace','recovery','readonly'].includes(purpose)&&scope.isCurrent()===true;}catch{return false;}};
  if(!current())return fail('ACCESS_REFUSED');
  const proof=this.#latest.get(`${scope.projectId}:${purpose}`);
  if(!proof||receipt.ok!==true||receipt.revision!==proof.receipt.revision||receipt.sha256!==proof.receipt.sha256)return fail('WORKSPACE_VERSION_CHANGED');
  try {
   if(purpose==='readonly'&&proof.pointId===null&&proof.selected){
    const selected=await this.#projects({canWrite:()=>false}).readProject(scope.projectId);if(!current())return fail('ACCESS_REFUSED');
    if(selected.schema!==proof.selected.schema||selected.revision!==receipt.revision||selected.sha256!==receipt.sha256||
      digest(Buffer.from(JSON.stringify(selected.sourceRefs??[])))!==proof.selected.sourceRefsSHA||this.#latest.get(`${scope.projectId}:${purpose}`)!==proof)return fail('WORKSPACE_VERSION_CHANGED');
    return {ok:true,domain:'workspace',entityId:scope.projectId,purpose,revision:receipt.revision,sha256:receipt.sha256,durability:'readonly'};
   }
   const point=await this.#recovery.readProjectPoint(scope.projectId,proof.pointId);if(!current())return fail('ACCESS_REFUSED');
   if(point.kind!==(purpose==='recovery'?'draft':'saved')||(purpose!=='readonly'&&point.snapshot.schema!==1)||point.snapshot.project.id!==scope.projectId||point.snapshot.revision!==receipt.revision||point.snapshot.sha256!==receipt.sha256)return fail('WORKSPACE_PROOF_FAILED');
   const projects=this.#projects({canWrite:()=>false}),selected=await projects.readProject(scope.projectId);if(!current())return fail('ACCESS_REFUSED');
   if(selected.schema!==point.snapshot.schema||selected.revision<receipt.revision||purpose!=='recovery'&&(selected.revision!==receipt.revision||selected.sha256!==receipt.sha256||selected.json!==point.snapshot.json||JSON.stringify(selected.sourceRefs)!==JSON.stringify(point.snapshot.sourceRefs)))return fail('WORKSPACE_VERSION_CHANGED');
   if(this.#latest.get(`${scope.projectId}:${purpose}`)!==proof)return fail('WORKSPACE_VERSION_CHANGED');
   return {ok:true,domain:'workspace',entityId:scope.projectId,purpose,revision:receipt.revision,sha256:receipt.sha256,durability:'committed'};
  }catch{return fail(current()?'WORKSPACE_PROOF_FAILED':'ACCESS_REFUSED');}
 }
}
