import {navigationFields} from './contracts.mjs';
import {verifySnapshot} from '../projects/store.mjs';
import {digest} from '../projects/atomic.mjs';

const wireLimit=64*1024*1024;
const fail=code=>({ok:false,code});
const budget=()=>{throw Object.assign(Error('Backup exceeds import wire budget'),{code:'BACKUP_BUDGET'});};
function preflight(snapshot){
 if(snapshot.schema===1){if(Buffer.byteLength(snapshot.json)>wireLimit)budget();return;}
 if(snapshot.schema!==2||!Array.isArray(snapshot.sourceRefs)||snapshot.sourceRefs.length>65536)throw Error('Invalid saved snapshot');
 let expanded=0;
 for(const ref of snapshot.sourceRefs){
  if(!Number.isSafeInteger(ref.utf8Bytes)||ref.utf8Bytes<0||ref.utf8Bytes>32*1024*1024)throw Error('Invalid source size');
  expanded+=4*Math.ceil(ref.utf8Bytes/3);if(expanded>wireLimit)budget();
 }
 // Base64 requires no JSON escaping. Count metadata before reading source blobs.
 const skeleton=JSON.stringify({format:'siren-source-bundle',schema:2,snapshot,sources:snapshot.sourceRefs.map(ref=>({ref,base64:''}))});
 if(Buffer.byteLength(skeleton)+expanded>wireLimit)budget();
}

/** Main-only saved export. Renderer supplies neither project identity nor bytes.
 * The unanswered chooser is deliberately outside the native writes drain;
 * publish owns pre-rename fences, accepted rename/readback and cleanup. */
export function createHomeBackupExporter({authority,projects,recovery,publish,ready}){
 let pending=false;
 return async(event,payload)=>{
  try{navigationFields(payload,[]);}catch{return fail('REQUEST_REFUSED');}
  const grant=authority.capture({sender:event?.sender,senderFrame:event?.senderFrame});
  if(!grant||grant.url!=='siren://app/home.html')return fail('SENDER_REFUSED');
  // Sticky revocation: returning to the same PIN/project cannot revive a chooser.
  let revoked=false;
  const isCurrent=()=>{try{if(!authority.isCurrent(grant)||ready()!==true)revoked=true;}catch{revoked=true;}return !revoked;};
  if(!isCurrent()||!grant.projectId)return fail('ACCESS_REFUSED');
  if(pending)return fail('EXPORT_BUSY');
  pending=true;
  let publishing=false;
  try{
   const snapshot=await projects.readProject(grant.projectId);
   if(!isCurrent())return fail('ACCESS_REFUSED');
   if(snapshot.project.id!==grant.projectId)throw Error('Selected snapshot mismatch');
   preflight(snapshot);verifySnapshot(snapshot);
   const bytes=snapshot.schema===2?await recovery.exportSourceSnapshot(snapshot):Buffer.from(snapshot.json);
   if(!isCurrent())return fail('ACCESS_REFUSED');
   if(!Buffer.isBuffer(bytes))throw Error('Invalid backup bytes');
   if(bytes.length>wireLimit)budget();
   const receipt={revision:snapshot.revision,schema:snapshot.schema,bytes:bytes.length,sha256:digest(bytes)};
   publishing=true;
   const result=await publish(bytes,`SIREN-${grant.projectId}.siren-backup`,isCurrent);
   // Accepted output must never be misreported as an uncommitted cancellation.
   if(result?.ok===true)return isCurrent()?{ok:true,...receipt}:fail('EXPORT_COMMITTED');
   if(!isCurrent())return fail('ACCESS_REFUSED');
   return fail(result?.code==='CANCELLED'?'CANCELLED':'BACKUP_WRITE_FAILED');
  }catch(cause){return fail(publishing?'BACKUP_WRITE_FAILED':!isCurrent()?'ACCESS_REFUSED':cause.code==='BACKUP_BUDGET'?'BACKUP_BUDGET':'BACKUP_UNAVAILABLE');}
  finally{pending=false;}
 };
}
