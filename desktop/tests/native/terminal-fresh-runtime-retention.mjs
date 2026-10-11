// Inactive preparation: one-time complete inert tree copy, no member evaluation.
import {lstat,mkdir,copyFile} from 'node:fs/promises';
import {constants,realpathSync} from 'node:fs';
import path from 'node:path';
import {types,isDeepStrictEqual} from 'node:util';
import {captureFreshRuntimeInventory,recheckFreshRuntimeInventory} from './terminal-fresh-runtime-inventory.mjs';

const captures=new WeakMap();
class Refusal extends Error{constructor(code,created=false){super('FRESH_RUNTIME_RETENTION_REFUSED: '+code);Object.defineProperties(this,{code:{value:code,enumerable:true},retainedDirectoryCreated:{value:created,enumerable:true}});}}
const fail=code=>{throw new Refusal(code);};
function options(value){
 if(!value||types.isProxy(value)||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('OPTIONS_REFUSED');
 const keys=Reflect.ownKeys(value);if(keys.length!==2||keys.some(key=>!['sourceDirectory','retainedDirectory'].includes(key)))fail('OPTIONS_REFUSED');
 const result=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('OPTIONS_REFUSED');result[key]=canonical(d.value);}return result;
}
function canonical(value){
 if(typeof value!=='string'||!value.isWellFormed()||value.length>32768||value.includes('\0')||!path.isAbsolute(value)||path.resolve(value)!==value||value===path.parse(value).root)fail('CANONICAL_PATH_REQUIRED');
 if(process.platform==='win32'&&!/^[A-Z]:\\/.test(value))fail('CANONICAL_PATH_REQUIRED');return value;
}
function disjoint(source,target){const fold=value=>process.platform==='win32'?value.toUpperCase():value,a=fold(source),b=fold(target);if(a===b||a.startsWith(b+path.sep)||b.startsWith(a+path.sep))fail('OVERLAPPING_ROOTS');}
const sameIdentity=(a,b)=>['dev','ino','mode'].every(key=>a[key]===b[key]);
async function parentIdentity(parent){
 try{const stat=await lstat(parent,{bigint:true});if(!stat.isDirectory()||stat.isSymbolicLink()||path.normalize(realpathSync(parent))!==parent)fail('DESTINATION_PARENT_REFUSED');return stat;}catch{fail('DESTINATION_PARENT_REFUSED');}
}
async function absent(target){try{await lstat(target,{bigint:true});}catch(error){if(error.code==='ENOENT')return;fail('DESTINATION_UNAVAILABLE');}fail('TARGET_EXISTS');}
export async function captureFreshRuntimeRetention(value,...extra){
 let created=false,phase='OPTIONS_REFUSED';
 try{
  if(extra.length)fail('EXTRA_ARGUMENTS');const {sourceDirectory,retainedDirectory}=options(value);disjoint(sourceDirectory,retainedDirectory);
  const parent=path.dirname(retainedDirectory),originalParent=await parentIdentity(parent);await absent(retainedDirectory);
  phase='SOURCE_CAPTURE_REFUSED';const source=await captureFreshRuntimeInventory(sourceDirectory);
  phase='DESTINATION_PARENT_REFUSED';if(!sameIdentity(originalParent,await parentIdentity(parent)))fail('DESTINATION_PARENT_REFUSED');
  await absent(retainedDirectory);phase='TARGET_CREATE_REFUSED';await mkdir(retainedDirectory);created=true;
  const targetRoot=await lstat(retainedDirectory,{bigint:true});if(!targetRoot.isDirectory()||targetRoot.isSymbolicLink()||path.normalize(realpathSync(retainedDirectory))!==retainedDirectory)fail('TARGET_CREATE_REFUSED');
  phase='COPY_FAILED';for(const relative of source.directories){if(relative)await mkdir(path.join(retainedDirectory,...relative.split('/')));}
  for(const file of source.files)await copyFile(path.join(sourceDirectory,...file.path.split('/')),path.join(retainedDirectory,...file.path.split('/')),constants.COPYFILE_EXCL);
  phase='SOURCE_CHANGED';await recheckFreshRuntimeInventory(source);
  phase='RETAINED_CAPTURE_REFUSED';if(!sameIdentity(targetRoot,await lstat(retainedDirectory,{bigint:true})))fail('RETAINED_CAPTURE_REFUSED');const retained=await captureFreshRuntimeInventory(retainedDirectory);
  phase='COPY_MISMATCH';if(!isDeepStrictEqual(source,retained))fail('COPY_MISMATCH');
  // A second source identity check covers time spent scanning the retained tree.
  phase='SOURCE_CHANGED';await recheckFreshRuntimeInventory(source);
  const receipt=Object.freeze({schema:'siren-terminal-fresh-retention/v1',evidenceClass:'ONE_TIME_COMPLETE_TREE_RETENTION',sourceInventorySha256:source.sha256,retainedInventorySha256:retained.sha256,copiedFiles:retained.files.length,copiedDirectories:retained.directories.length,totalBytes:retained.totalBytes,nativeExecutionAdmitted:false,inspectedModulesExecuted:false,filesystemGuarantee:'Node-visible identity/membership/byte checks; non-atomic copy, not a security boundary under hostile directory races.',roleBinding:'No runtime role classification, executed identity or native admission.'});
  captures.set(receipt,{retained});return receipt;
 }catch(error){throw new Refusal(error instanceof Refusal?error.code:phase,created);}
}
export async function recheckFreshRuntimeRetention(receipt,...extra){
 if(extra.length)throw new Refusal('EXTRA_ARGUMENTS');const saved=captures.get(receipt);if(!saved)throw new Refusal('PRIVATE_RECEIPT_REQUIRED');
 try{await recheckFreshRuntimeInventory(saved.retained);return true;}catch{throw new Refusal('RETAINED_TREE_CHANGED',true);}
}
