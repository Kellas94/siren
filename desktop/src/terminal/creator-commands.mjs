// Pure creator-side command authority. No PTY/native loader, transport, shell,
// kernel identity or execution admission. Main/transport supplies currentness;
// this class never upgrades that callback into kernel evidence.
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {HostInputGate} from './input-gate.mjs';
import {TERMINAL_LIMITS as limits} from './contracts.mjs';

const invoke=Reflect.apply,gateApply=HostInputGate.prototype.apply,gateAllows=HostInputGate.prototype.allows;
const tokenKeys=Object.freeze(['sessionId','channelId','projectId','windowId','epoch','leaseId','generation','gateGeneration']);
const optionKeys=Object.freeze(['sessionId','channelId','projectId','gate','assertEndpointCurrent','writeInput','resize']);
const id=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(value);
const integer=value=>Number.isSafeInteger(value)&&value>=0;
const positive=value=>integer(value)&&value>0;
const fail=code=>Object.freeze({ok:false,code});
const pass=fields=>Object.freeze({ok:true,...fields});
export const TERMINAL_CREATOR_COMMAND_CODES=Object.freeze(['REQUEST_REFUSED','SESSION_REFUSED','LEASE_STALE','GATE_CLOSED','ENDPOINT_UNAVAILABLE','INPUT_RECEIPT_EXPIRED','INPUT_SEQUENCE_REFUSED','RESIZE_RECEIPT_EXPIRED','COMMAND_BUSY','COMMAND_AMBIGUOUS','COMMAND_RETIRED']);

function record(value,keys){
 try{
  if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
  const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(key=>typeof key!=='string'||!keys.includes(key)))return null;
  const result=Object.create(null);
  for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}
  return result;
 }catch{return null;}
}
function validToken(p){return p&&['sessionId','channelId','projectId','windowId','leaseId'].every(key=>id(p[key]))&&['epoch','generation','gateGeneration'].every(key=>positive(p[key]));}
const sameToken=(a,b)=>!!a&&!!b&&tokenKeys.every(key=>a[key]===b[key]);
const copyToken=p=>Object.freeze(Object.fromEntries(tokenKeys.map(key=>[key,p[key]])));
function validInput(data){
 if(typeof data!=='string'||data.length>limits.inputBytes||!data.isWellFormed())return false;
 return Buffer.byteLength(data,'utf8')<=limits.inputBytes;
}
const validDimensions=p=>integer(p.cols)&&p.cols>=limits.minCols&&p.cols<=limits.maxCols&&integer(p.rows)&&p.rows>=limits.minRows&&p.rows<=limits.maxRows;

/**
 * All methods are synchronous. Callbacks are captured functions, invoked with
 * undefined receiver. assertEndpointCurrent must return strict true; writeInput
 * (data) and resize(cols,rows) must return undefined. Any throw/nonvoid result
 * makes acceptance ambiguous and permanently retires this authority. No return
 * object/thenable is inspected or awaited. Providers own any invalid async work.
 *
 * Route every gate update through applyGate. It retains the original branded
 * HostInputGate methods and revokes the lease on close/generation change. A
 * direct external gate change is also checked before every accepted receipt or
 * PTY callback, but supplies no automatic command replay or new lease.
 */
export class TerminalCreatorCommands {
 #session;#channel;#project;#gate;#endpoint;#write;#resize;
 #lease=null;#candidate=null;#lastRevoked=null;#lastLeaseGeneration=0;
 #gateGeneration=0;#gateOpen=false;#revision=0;#busy=false;#retiredCode=null;
 constructor(options){
  const p=record(options,optionKeys);
  if(!p||![p.sessionId,p.channelId,p.projectId].every(id)||!p.gate||types.isProxy(p.gate)||!['assertEndpointCurrent','writeInput','resize'].every(key=>typeof p[key]==='function'&&!types.isProxy(p[key])))throw TypeError('Creator command dependencies required');
  try{if(typeof invoke(gateAllows,p.gate,[0])!=='boolean')throw Error();}catch{throw TypeError('Branded HostInputGate required');}
  this.#session=p.sessionId;this.#channel=p.channelId;this.#project=p.projectId;this.#gate=p.gate;
  this.#endpoint=p.assertEndpointCurrent;this.#write=p.writeInput;this.#resize=p.resize;
 }
 get nativeExecutionAdmitted(){return false;}
 #base(p){return p.sessionId===this.#session&&p.channelId===this.#channel&&p.projectId===this.#project;}
 #invalidate(){
  if(this.#lease)this.#lastRevoked=this.#lease.token;
  this.#lease=null;this.#candidate=null;this.#revision++;
 }
 #retire(code){if(!this.#retiredCode){this.#retiredCode=code;this.#invalidate();}return fail(this.#retiredCode);}
 #endpointCurrent(){
  if(this.#retiredCode)return false;
  try{if(invoke(this.#endpoint,undefined,[])===true)return !this.#retiredCode;}catch{}
  this.#retire('ENDPOINT_UNAVAILABLE');return false;
 }
 #allowed(token){return invoke(gateAllows,this.#gate,[token.gateGeneration])===true;}
 #live(lease,revision){
  if(this.#retiredCode)return fail(this.#retiredCode);
  if(this.#lease!==lease||this.#revision!==revision)return fail('LEASE_STALE');
  if(!this.#allowed(lease.token)){this.#invalidate();return fail('GATE_CLOSED');}
  return null;
 }
 applyGate(packet,...extra){
  if(this.#retiredCode)return fail(this.#retiredCode);
  const p=record(packet,['generation','open']);if(extra.length||!p||!integer(p.generation)||typeof p.open!=='boolean')return fail('REQUEST_REFUSED');
  const result=invoke(gateApply,this.#gate,[p]),accepted=record(result,['ok','generation','open']);
  if(!accepted||accepted.ok!==true){const refused=record(result,['ok','code']);return fail(refused?.code==='LEASE_STALE'?'LEASE_STALE':'REQUEST_REFUSED');}
  if(p.generation!==this.#gateGeneration||!p.open)this.#invalidate();
  this.#gateGeneration=p.generation;this.#gateOpen=p.open;return pass({generation:p.generation,open:p.open});
 }
 installLease(value,...extra){
  if(this.#retiredCode)return fail(this.#retiredCode);
  const p=record(value,tokenKeys);if(extra.length||!validToken(p))return fail('REQUEST_REFUSED');
  if(!this.#base(p))return fail('SESSION_REFUSED');
  if(this.#busy)return fail('COMMAND_BUSY');
  if(p.generation<=this.#lastLeaseGeneration)return fail('LEASE_STALE');
  // Retire the previous lease before invoking any caller-supplied callback.
  this.#invalidate();this.#lastLeaseGeneration=p.generation;
  const token=copyToken(p),revision=this.#revision;this.#candidate=token;this.#busy=true;
  try{
   if(!this.#allowed(token)){this.#invalidate();return fail('GATE_CLOSED');}
   if(!this.#endpointCurrent())return fail(this.#retiredCode);
   if(this.#candidate!==token||this.#revision!==revision)return fail('LEASE_STALE');
   if(!this.#allowed(token)){this.#invalidate();return fail('GATE_CLOSED');}
   this.#candidate=null;this.#gateGeneration=token.gateGeneration;this.#gateOpen=true;
   this.#lease={token,nextInput:0,lastResize:0,inputs:new Map(),resizes:new Map()};return pass();
  }finally{this.#candidate=null;this.#busy=false;}
 }
 revokeLease(value,...extra){
  if(this.#retiredCode)return fail(this.#retiredCode);
  const p=record(value,tokenKeys);if(extra.length||!validToken(p))return fail('REQUEST_REFUSED');
  if(!this.#base(p))return fail('SESSION_REFUSED');
  if(sameToken(this.#lease?.token,p)||sameToken(this.#candidate,p)){this.#lastRevoked=copyToken(p);this.#invalidate();return pass();}
  return !this.#lease&&!this.#candidate&&sameToken(this.#lastRevoked,p)?pass():fail('LEASE_STALE');
 }
 #command(value,kind,extra){
  if(this.#retiredCode)return fail(this.#retiredCode);
  const input=kind==='input',p=record(value,[...tokenKeys,...(input?['inputSequence','data']:['requestId','cols','rows'])]);
  if(extra.length||!validToken(p)||(input?(!integer(p.inputSequence)||!validInput(p.data)):(!positive(p.requestId)||!validDimensions(p))))return fail('REQUEST_REFUSED');
  if(!this.#base(p))return fail('SESSION_REFUSED');
  if(this.#busy)return fail('COMMAND_BUSY');
  const lease=this.#lease,revision=this.#revision;if(!sameToken(lease?.token,p))return fail('LEASE_STALE');
  const unavailable=this.#live(lease,revision);if(unavailable)return unavailable;
  const hash=input?createHash('sha256').update(p.data,'utf8').digest('hex'):null;
  const key=input?p.inputSequence:p.requestId,receipts=input?lease.inputs:lease.resizes,prior=receipts.get(key);
  if(prior&&(input?prior.hash!==hash:prior.cols!==p.cols||prior.rows!==p.rows))return fail('REQUEST_REFUSED');
  if(!prior){
   if(input&&p.inputSequence<lease.nextInput)return fail('INPUT_RECEIPT_EXPIRED');
   if(input&&(p.inputSequence!==lease.nextInput||!integer(lease.nextInput+1)))return fail('INPUT_SEQUENCE_REFUSED');
   if(!input&&p.requestId<=lease.lastResize)return fail('RESIZE_RECEIPT_EXPIRED');
  }
  this.#busy=true;
  try{
   if(!this.#endpointCurrent())return fail(this.#retiredCode);
   // No caller-supplied function, await or stream queue intervenes between this
   // final local/gate check and the synchronous provider call.
   const stale=this.#live(lease,revision);if(stale)return stale;
   if(prior)return prior.receipt;
   let result;try{result=invoke(input?this.#write:this.#resize,undefined,input?[p.data]:[p.cols,p.rows]);}catch{return this.#retire('COMMAND_AMBIGUOUS');}
   if(result!==undefined)return this.#retire('COMMAND_AMBIGUOUS');
   // A returned void callback is known acceptance, even if that callback revoked
   // authority after its side effect. Transport/main separately suppress stale
   // delivery; neither can turn a known write into permission to replay it.
   const receipt=input?pass({accepted:true,inputSequence:p.inputSequence}):pass({accepted:true,requestId:p.requestId,cols:p.cols,rows:p.rows});
   if(this.#lease===lease&&this.#revision===revision){
    if(input)lease.nextInput++;else lease.lastResize=p.requestId;
    receipts.set(key,input?{hash,receipt}:{cols:p.cols,rows:p.rows,receipt});
    while(receipts.size>limits.inputReceipts)receipts.delete(receipts.keys().next().value);
   }
   return receipt;
  }finally{this.#busy=false;}
 }
 input(value,...extra){return this.#command(value,'input',extra);}
 resize(value,...extra){return this.#command(value,'resize',extra);}
 retire(...extra){if(extra.length)return fail('REQUEST_REFUSED');this.#retire('COMMAND_RETIRED');return true;}
 stats(){return Object.freeze({nativeExecutionAdmitted:false,retired:!!this.#retiredCode,leased:!!this.#lease,busy:this.#busy,gateGeneration:this.#gateGeneration,gateOpen:this.#gateOpen,lastLeaseGeneration:this.#lastLeaseGeneration,inputReceipts:this.#lease?.inputs.size??0,resizeReceipts:this.#lease?.resizes.size??0});}
}
