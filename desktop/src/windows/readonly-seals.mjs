import {verifySnapshot} from '../projects/store.mjs';
import {digest} from '../projects/atomic.mjs';
import {documentVersion} from './docs.mjs';
import {workspaceMetadata} from './entities.mjs';
import {selectedSourceReference} from './source-reads.mjs';

const fail=code=>Object.freeze({ok:false,code});
const sameRef=(a,b)=>a&&b&&a.sourceId===b.sourceId&&a.version===b.version&&a.sha256===b.sha256;
const fingerprint=value=>digest(Buffer.from(JSON.stringify(value)));

/** Main-only immutable-view proofs. Classification is a trusted native adapter,
 * never a renderer flag. These receipts prove selected readonly bytes, not a
 * source commit, writable flush or general project recovery checkpoint. */
export class NativeReadonlyViewSeals {
 #registry;#readonly;#snapshot;#sources;#receipts=new WeakMap();#latest=new Map();
 constructor({registry,isReadonly,snapshotFor,sources}){
  if(!['isCurrent','eventFor','sourceScope'].every(name=>typeof registry?.[name]==='function')||[isReadonly,snapshotFor,sources].some(value=>typeof value!=='function'))throw TypeError('NATIVE_READONLY_SEAL_ADAPTERS_REQUIRED');
  this.#registry=registry;this.#readonly=isReadonly;this.#snapshot=snapshotFor;this.#sources=sources;
 }
 isReadonly(grant){
  try{return ['code','docs'].includes(grant?.role)&&grant.entityIds.length===1&&this.#registry.isCurrent(grant)&&this.#readonly(grant)===true;}
  catch{return false;}
 }
 async #read(grant,scope){
  const current=()=>{try{return this.isReadonly(grant)&&scope?.isCurrent()===true;}catch{return false;}};
  if(!current())return fail('ACCESS_REFUSED');
  try{
   const before=verifySnapshot(await this.#snapshot(grant));
   if(!current()||before.project.id!==grant.projectId)return fail('ACCESS_REFUSED');
   let receipt;
   if(grant.role==='code'){
    const admitted=this.#registry.sourceScope(grant);
    if(!Number.isSafeInteger(admitted?.version)||admitted.version<1)return fail('SOURCE_VERSION_CHANGED');
    const reference=selectedSourceReference(before,this.#registry,grant);
    if(!reference)return fail('SOURCE_VERSION_CHANGED');
    const repository=this.#sources({grant,canWrite:context=>current()&&context?.action==='read'&&context.projectId===grant.projectId&&context.sourceId===reference.sourceId});
    const metrics=await repository.getMetrics({projectId:grant.projectId,sourceId:reference.sourceId,version:reference.version});
    if(!current())return fail('ACCESS_REFUSED');if(!sameRef(metrics,reference))return fail('SOURCE_PROOF_FAILED');
    receipt={ok:true,domain:'source',purpose:'readonly',entityId:reference.sourceId,...reference,durability:'readonly'};
   }else{
    const entityId=grant.entityIds[0],matches=(workspaceMetadata(before).workpapers??[]).filter(doc=>doc?.id===entityId);
    if(matches.length!==1)return fail('DOCUMENT_VERSION_CHANGED');
    receipt={ok:true,domain:'docs',purpose:'readonly',entityId,version:documentVersion(before,entityId),sha256:fingerprint(matches[0]),projectRevision:before.revision,durability:'readonly'};
   }
   const after=verifySnapshot(await this.#snapshot(grant));
   if(!current()||after.project.id!==grant.projectId)return fail('ACCESS_REFUSED');
   if(after.schema!==before.schema||after.revision!==before.revision||after.sha256!==before.sha256||JSON.stringify(after.sourceRefs)!==JSON.stringify(before.sourceRefs))return fail('READONLY_VERSION_CHANGED');
   return Object.freeze(receipt);
  }catch{return fail(current()?'READONLY_PROOF_FAILED':'ACCESS_REFUSED');}
 }
 async seal(grant,scope){
  const receipt=await this.#read(grant,scope);if(!receipt.ok)return receipt;
  for(const [id,proof] of this.#latest)if(!this.isReadonly(proof.grant))this.#latest.delete(id);
  if(!this.#latest.has(grant.windowId)&&this.#latest.size>=64)return fail('READONLY_PROOF_BUDGET');
  const event=this.#registry.eventFor(grant);if(!event||!this.isReadonly(grant)||scope?.isCurrent()!==true)return fail('ACCESS_REFUSED');
  const proof={grant,event,receipt};this.#latest.set(grant.windowId,proof);this.#receipts.set(receipt,proof);return receipt;
 }
 async verify(grant,receipt,scope){
  const proof=receipt&&this.#receipts.get(receipt),event=this.#registry.eventFor(grant);
  if(!proof||this.#latest.get(grant?.windowId)!==proof||!this.isReadonly(grant)||!this.isReadonly(proof.grant)||event?.sender!==proof.event.sender||event?.senderFrame!==proof.event.senderFrame)return false;
  const actual=await this.#read(grant,scope);
  return actual.ok===true&&this.#latest.get(grant.windowId)===proof&&JSON.stringify(actual)===JSON.stringify(receipt);
 }
}
