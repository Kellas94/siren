import {randomUUID} from 'node:crypto';
import {win32 as path} from 'node:path';

// Pure authority only: no fs/dialog/Electron/host imports or process creation.
// Main supplies authorize(grant,method) from live TerminalPolicy and a captured
// registry admission guard. Defaults refuse. Call revoke on Lock/project/run
// retirement, including a failed transition's rollback; dispose is permanent.
// inspectDirectory(path) must return a main-owned DATA snapshot:
// {canonicalPath,identity,directory:true,reparse:false,ancestors:[
//   {path,identity,directory:true,reparse:false}, ...]}
// ancestors covers EVERY component from the drive root through the leaf.
// identity is a bounded opaque actual filesystem identity, not a path/hash
// invented by this class. The future Windows adapter must qualify that claim.
// Revalidation is path-based: it does not eliminate pre-spawn TOCTOU or sandbox
// a shell. No token or result permits native execution before ownership admission.
class Refusal extends Error {constructor(code){super(code);this.code=code;}}
const refuse=code=>{throw new Refusal(code);};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
function data(value,keys){
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))return null;
 const result=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}return result;
}
function array(value,max){
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max||Reflect.ownKeys(value).length!==value.length+1)return null;
 const result=[];for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result.push(d.value);}return result;
}
function localPath(value){
 if(typeof value!=='string'||!value.isWellFormed()||value.length>32768||! /^[A-Za-z]:[\\/]/.test(value)||/[\x00-\x1f\x7f<>"|?*]/.test(value)||value.slice(2).includes(':'))return null;
 const parts=value.slice(3).split(/[\\/]/).filter(Boolean);
 if(parts.some(p=>p!=='.'&&p!=='..'&&(/[ .]$/.test(p)||/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:\.|$)/i.test(p))))return null;
 const normalized=path.normalize(value.replaceAll('/','\\'));
 return normalized.length>3&&normalized.endsWith('\\')?normalized.slice(0,-1):normalized;
}
const equal=(a,b)=>a.toLowerCase()===b.toLowerCase();
const inside=(value,root)=>equal(value,root)||value.toLowerCase().startsWith(root.toLowerCase()+(root.endsWith('\\')?'':'\\'));
function chain(value){const root=path.parse(value).root,parts=value.slice(root.length).split('\\').filter(Boolean);return [root,...parts.map((_,i)=>path.join(root,...parts.slice(0,i+1)))];}
const identity=v=>typeof v==='string'&&v.length>0&&v.length<=256&&v.isWellFormed()&&!/[\x00-\x1f\x7f]/.test(v);
function evidence(value,requested){
 const v=data(value,['canonicalPath','identity','directory','reparse','ancestors']);
 if(!v||v.directory!==true||v.reparse!==false||!identity(v.identity))refuse('CWD_REFUSED');
 const canonical=localPath(v.canonicalPath),parents=array(v.ancestors,128),expected=chain(requested);
 if(!canonical||!equal(canonical,requested)||!parents||parents.length!==expected.length)refuse('CWD_REFUSED');
 const entries=parents.map((p,i)=>{const d=data(p,['path','identity','directory','reparse']),name=d&&localPath(d.path);if(!d||!name||!equal(name,expected[i])||d.directory!==true||d.reparse!==false||!identity(d.identity))refuse('CWD_REFUSED');return [name.toLowerCase(),d.identity];});
 if(entries.at(-1)[1]!==v.identity)refuse('CWD_REFUSED');
 return Object.freeze({canonical,signature:JSON.stringify([canonical.toLowerCase(),v.identity,entries])});
}
function context(grant){
 const result={};for(const key of ['windowId','projectId','epoch','role']){const d=grant&&Object.getOwnPropertyDescriptor(grant,key);if(!d||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}
 return id(result.windowId)&&id(result.projectId)&&Number.isSafeInteger(result.epoch)&&result.epoch>=1&&['workspace','terminal'].includes(result.role)?Object.freeze(result):null;
}
export class CwdAuthority {
 #pick;#inspect;#authorize;#capture;#roots;#maxGrants;#maxPending;#pending=0;#grants=new Map();#generation=Symbol();#disposed=false;
 constructor({pickDirectory,protectedRoots,inspectDirectory,authorize,captureAdmission,maxGrants=64,maxPending=8}={}){
  if(!Number.isSafeInteger(maxGrants)||maxGrants<1||maxGrants>64||!Number.isSafeInteger(maxPending)||maxPending<1||maxPending>8)throw TypeError('Bounded cwd limits required');
  this.#pick=pickDirectory;this.#inspect=inspectDirectory;this.#authorize=authorize;this.#capture=captureAdmission;
  const roots=array(protectedRoots,16);this.#roots=roots?.length?roots.map(localPath):null;if(this.#roots?.some(r=>!r))this.#roots=null;
  this.#maxGrants=maxGrants;this.#maxPending=maxPending;
 }
 #assert(scope){
  try{const current=context(scope.grant);if(!this.#disposed&&scope.generation===this.#generation&&current&&Object.keys(current).every(k=>current[k]===scope.context[k])&&this.#authorize?.(scope.grant,scope.method)===true&&scope.guard?.isCurrent?.()===true){const after=context(scope.grant);if(!this.#disposed&&scope.generation===this.#generation&&after&&Object.keys(after).every(k=>after[k]===scope.context[k]))return;}}catch{/* Native authority failure is a refusal, never a fallback. */}
  refuse('SENDER_REFUSED');
 }
 #begin(grant,method){
  let scope;try{const c=context(grant);if(this.#disposed||!c||this.#authorize?.(grant,method)!==true)refuse('SENDER_REFUSED');scope={grant,method,context:c,generation:this.#generation,guard:this.#capture?.(grant)};}catch{refuse('SENDER_REFUSED');}
  this.#assert(scope);if(this.#pending>=this.#maxPending)refuse('CAPACITY_EXCEEDED');this.#pending++;return scope;
 }
 async #step(scope,fn){this.#assert(scope);let value;try{value=await fn();}catch{this.#assert(scope);refuse('CWD_REFUSED');}this.#assert(scope);return value;}
 async #inspectPath(scope,value){return evidence(await this.#step(scope,()=>{if(typeof this.#inspect!=='function')refuse('CWD_REFUSED');return this.#inspect(value);}),value);}
 async #protected(scope){if(!this.#roots)refuse('CWD_REFUSED');const roots=[];for(const value of this.#roots)roots.push(await this.#inspectPath(scope,value));return roots;}
 async pick(grant){
  const scope=this.#begin(grant,'terminalPickCwd');try{
   if(!this.#roots||typeof this.#pick!=='function'||typeof this.#inspect!=='function')refuse('CWD_REFUSED');
   if(this.#grants.size>=this.#maxGrants)refuse('CAPACITY_EXCEEDED');
   const answer=data(await this.#step(scope,()=>this.#pick(grant)),['canceled','filePaths']);
   if(!answer||typeof answer.canceled!=='boolean')refuse('CWD_REFUSED');
   const files=array(answer.filePaths,2);if(!files)refuse('CWD_REFUSED');if(answer.canceled)refuse('CANCELLED');
   const selected=files.length===1?localPath(files[0]):null;if(!selected||this.#roots.some(root=>inside(selected,root)))refuse('CWD_REFUSED');
   const roots=await this.#protected(scope),directory=await this.#inspectPath(scope,selected);
   if(roots.some(root=>inside(directory.canonical,root.canonical)))refuse('CWD_REFUSED');
   this.#assert(scope);if(this.#grants.size>=this.#maxGrants)refuse('CAPACITY_EXCEEDED');
   const cwdId=randomUUID(),publicGrant=Object.freeze({cwdId,projectId:scope.context.projectId,displayPath:directory.canonical});
   this.#grants.set(cwdId,{projectId:scope.context.projectId,epoch:scope.context.epoch,generation:this.#generation,directory,roots:roots.map(r=>r.signature)});return publicGrant;
  }finally{this.#pending--;}
 }
 async resolve(grant,cwdId){
  const scope=this.#begin(grant,'terminalCreate');try{
   const record=id(cwdId)?this.#grants.get(cwdId):null;
   if(!record||record.projectId!==scope.context.projectId||record.epoch!==scope.context.epoch||record.generation!==this.#generation)refuse('CWD_REFUSED');
   const roots=await this.#protected(scope),directory=await this.#inspectPath(scope,record.directory.canonical);
   if(directory.signature!==record.directory.signature||roots.some((root,i)=>root.signature!==record.roots[i]||inside(directory.canonical,root.canonical)))refuse('CWD_REFUSED');
   this.#assert(scope);return directory.canonical;
  }finally{this.#pending--;}
 }
 revoke(){this.#generation=Symbol();this.#grants.clear();}
 dispose(){this.#disposed=true;this.revoke();}
}
