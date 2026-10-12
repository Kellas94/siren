// MAIN-private SOURCE_ONLY catalogue ownership. No shell/native/OS discovery.
import {types} from 'node:util';
import {WindowRegistry} from '../windows/registry.mjs';
import {TerminalPolicy} from './policy.mjs';
import {createShellProfileCatalogue,captureShellProfileSettlement,retireShellProfileCatalogue} from './profiles.mjs';
import {supportedProviderPromise} from './provider-lifetime.mjs';
const apply=Reflect.apply,then=Promise.prototype.then;
const method=(type,key)=>Object.getOwnPropertyDescriptor(type.prototype,key).value;
const current=method(WindowRegistry,'isCurrent'),guard=method(WindowRegistry,'captureAdmissionGuard'),authorize=method(TerminalPolicy,'authorize');
const frozen=o=>Object.freeze(Object.assign(Object.create(null),o));
const refuse=code=>{throw Object.assign(new Error(code),{code});};
const brands=new WeakMap();
function data(value,keys){
 if(!value||types.isProxy(value)||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const own=Reflect.ownKeys(value);if(keys&&(own.length!==keys.length||own.some(k=>!keys.includes(k))))return null;
 const out=Object.create(null);for(const key of own){const d=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[key]=d.value;}return out;
}
export function captureProfileCatalogueOwnerSettlement(owner,...extra){return extra.length?null:brands.get(owner)??null;}
export class TerminalProfileCatalogueOwner {
 #registry;#policy;#project;#providers;#rows=new Set();#initial;#seeding=true;#retired=false;#busy=false;#generation=0;#unknown=false;#frames=0;#done=false;#resolve;#handle;
 constructor(options){
  const o=data(options,['registry','policy','projectId','providers','grants']);
  if(!o||types.isProxy(o.registry)||Object.getPrototypeOf(o.registry)!==WindowRegistry.prototype||types.isProxy(o.policy)||Object.getPrototypeOf(o.policy)!==TerminalPolicy.prototype||typeof o.projectId!=='string')throw TypeError('Genuine private catalogue dependencies required');
  const p=data(o.providers),base=['getSystemDirectory','inspectExecutable','readEnvironment','privateEnvironmentKeys'];
  if(!p||base.some(k=>!Object.hasOwn(p,k))||Object.keys(p).some(k=>!base.includes(k)&&!['modulePathPolicy','inspectModuleDirectory'].includes(k))||Object.hasOwn(p,'modulePathPolicy')&&p.modulePathPolicy!=='system-seeded'||Object.hasOwn(p,'inspectModuleDirectory')&&(typeof p.inspectModuleDirectory!=='function'||types.isProxy(p.inspectModuleDirectory))||p.modulePathPolicy==='system-seeded'&&typeof p.inspectModuleDirectory!=='function')throw TypeError('Closed private profile providers required');
  if(!p||!['getSystemDirectory','inspectExecutable','readEnvironment'].every(k=>typeof p[k]==='function'&&!types.isProxy(p[k]))||!Array.isArray(o.grants)||types.isProxy(o.grants)||Object.getPrototypeOf(o.grants)!==Array.prototype||o.grants.length>8||Reflect.ownKeys(o.grants).length!==o.grants.length+1)throw TypeError('Bounded captured catalogue providers required');
  this.#registry=o.registry;this.#policy=o.policy;this.#project=o.projectId;this.#providers=frozen(p);
  this.#handle=frozen({actualSettled:new Promise(r=>this.#resolve=r),snapshot:()=>this.#snapshot()});brands.set(this,this.#handle);
  // Constructor snapshot remains immutable; all later acquisition is separate.
  const initial=[];for(let i=0;i<o.grants.length;i++){const d=Object.getOwnPropertyDescriptor(o.grants,String(i));if(!d||!Object.hasOwn(d,'value'))throw TypeError('DATA grant roster required');initial.push(this.forGrant(d.value));}this.#initial=Object.freeze(initial);this.#seeding=false;
 }
 initialSnapshot(...extra){return extra.length?null:this.#initial;}
 #current(grant){return apply(current,this.#registry,[grant])===true&&grant.projectId===this.#project;}
 #allowed(grant,generation){
  if(this.#retired||generation!==this.#generation||!this.#current(grant))return false;
  // Binding the explicitly captured initial roster is not a discovery request.
  // Preserve construction while PIN is closed; catalogue methods still enforce
  // the actual policy and admission guard before every provider operation.
  if(this.#seeding)return true;
  const result=apply(authorize,this.#policy,[{grant,method:'terminalListProfiles',epoch:grant.epoch}]);
  return data(result,['ok'])?.ok===true&&!this.#retired&&generation===this.#generation&&this.#current(grant);
 }
 forGrant(grant,...extra){
  if(extra.length)refuse('REQUEST_REFUSED');if(this.#busy)refuse('CAPACITY_EXCEEDED');if(this.#retired)refuse('HOST_UNAVAILABLE');
  // Acquire creation authority BEFORE registry/policy callbacks can reenter.
  this.#busy=true;this.#frames++;const generation=this.#generation;
  try{
   if(!this.#allowed(grant,generation))refuse('SENDER_REFUSED');
   for(const row of this.#rows)if(!row.retired&&!this.#current(row.grant))this.#retireRow(row);
   if(!this.#allowed(grant,generation))refuse('SENDER_REFUSED');
   const found=[...this.#rows].find(row=>!row.retired&&row.grant.windowId===grant.windowId&&row.grant.epoch===grant.epoch&&row.grant.role===grant.role);
   if(found)return found.catalogue;
   if(this.#rows.size>=16)refuse('CAPACITY_EXCEEDED');
   const known=grant,registry=this.#registry,policy=this.#policy,project=this.#project;
   const catalogue=createShellProfileCatalogue({...this.#providers,authorize:operation=>known.projectId===project&&apply(current,registry,[known])===true&&apply(authorize,policy,[{grant:known,method:operation,epoch:known.epoch}]).ok===true,captureAdmission:()=>apply(guard,registry,[known])});
   const handle=captureShellProfileSettlement(catalogue),row={grant:known,catalogue,handle,initial:this.#seeding,revoke:catalogue.revoke,retired:false,unknown:false};this.#rows.add(row);
   if(!this.#allowed(known,generation)){this.#retireRow(row);refuse('SENDER_REFUSED');}
   return catalogue;
  }finally{this.#busy=false;this.#frames--;this.#finish();}
 }
 #retireRow(row){
  if(row.retired)return;row.retired=true;
  try{
   if(retireShellProfileCatalogue(row.catalogue)!==row.handle||!supportedProviderPromise(row.handle.actualSettled))throw Error('Catalogue authority changed');
   let validated=false;const observed=apply(then,row.handle.actualSettled,[value=>{
    this.#frames++;try{const r=data(value,['scope','actualSettled','nativeExecutionAdmitted']),s=row.handle.snapshot();
     if(!r||!Object.isFrozen(value)||r.scope!=='SHELL_PROFILE_CATALOGUE'||r.actualSettled!==true||r.nativeExecutionAdmitted!==false||s.actualSettled!==true||s.unknown!==false)throw Error('Catalogue settlement unverified');
     validated=true;
    }catch{row.unknown=true;this.#unknown=true;}finally{this.#frames--;this.#finish();}
   },()=>{row.unknown=true;this.#unknown=true;}]);
   if(!supportedProviderPromise(observed))throw Error('Catalogue observer unverified');
   apply(then,observed,[()=>{this.#frames++;try{if(validated&&!row.unknown){this.#rows.delete(row);row.catalogue=row.grant=row.handle=null;}}finally{this.#frames--;this.#finish();}},()=>{row.unknown=true;this.#unknown=true;}]);
  }catch{row.unknown=true;this.#unknown=true;}
 }
 invalidateAll(...extra){
  if(extra.length)throw TypeError('Exact catalogue invalidation required');
  this.#generation++;this.#frames++;
  try{for(const row of this.#rows){if(row.initial&&!row.retired&&!this.#retired)apply(row.revoke,row.catalogue,[]);else this.#retireRow(row);}}finally{this.#frames--;this.#finish();}
  // Exact synchronous void is the Access revocation contract.
 }
 retire(...extra){if(extra.length)return null;this.#retired=true;apply(invalidateOwner,this,[]);this.#finish();return this.#handle;}
 #snapshot(){
  let active=0,retired=0,unknown=this.#unknown;for(const row of this.#rows){row.retired?retired++:active++;try{unknown||=row.unknown||row.handle.snapshot().unknown===true;}catch{unknown=true;}}
  return frozen({scope:'SHELL_PROFILE_CATALOGUES',owned:this.#rows.size,active,retired,capacity:16,creating:this.#busy,unknown,actualSettled:this.#done,activeFrames:this.#frames,nativeExecutionAdmitted:false});
 }
 stats(...extra){return extra.length?null:this.#snapshot();}
 #finish(){if(this.#done||!this.#retired||this.#frames||this.#rows.size||this.#unknown)return;this.#done=true;this.#registry=this.#policy=this.#providers=null;const resolve=this.#resolve;this.#resolve=null;resolve(frozen({scope:'SHELL_PROFILE_CATALOGUES',actualSettled:true,nativeExecutionAdmitted:false}));}
}
const invalidateOwner=method(TerminalProfileCatalogueOwner,'invalidateAll');
