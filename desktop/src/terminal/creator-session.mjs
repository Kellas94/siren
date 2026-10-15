// Pure production-composition candidate. No PTY/native/child import, spawn,
// runtime admission or cleanup receipt. Main must still hold native identities.
import {types} from 'node:util';
import {TerminalSessionCommandChannel} from './session-command-channel.mjs';
import {TerminalCreatorStartup} from './creator-startup.mjs';
import {TerminalCreatorCommands,TERMINAL_CREATOR_COMMAND_CODES} from './creator-commands.mjs';
import {HostInputGate} from './input-gate.mjs';
import {encodeStartupRequest} from './startup-protocol.mjs';
import {encodeTerminalCommandRequest,decodeTerminalCommandRequest} from './command-protocol.mjs';

const invoke=Reflect.apply;
const identity=Object.getOwnPropertyDescriptor(TerminalSessionCommandChannel.prototype,'identity').get;
const subscribe=TerminalSessionCommandChannel.prototype.subscribe,send=TerminalSessionCommandChannel.prototype.send,close=TerminalSessionCommandChannel.prototype.dispose;
const startupHandle=TerminalCreatorStartup.prototype.handle,startupDispose=TerminalCreatorStartup.prototype.dispose,startupStats=TerminalCreatorStartup.prototype.stats,startupCallbacks=TerminalCreatorStartup.prototype.commandCallbacks;
const gateApply=HostInputGate.prototype.apply;
const install=TerminalCreatorCommands.prototype.installLease,revoke=TerminalCreatorCommands.prototype.revokeLease,input=TerminalCreatorCommands.prototype.input,resize=TerminalCreatorCommands.prototype.resize,commandsApply=TerminalCreatorCommands.prototype.applyGate,retire=TerminalCreatorCommands.prototype.retire,commandStats=TerminalCreatorCommands.prototype.stats;
const then=Promise.prototype.then,fill=Uint8Array.prototype.fill;
const failures=new Set(TERMINAL_CREATOR_COMMAND_CODES);
const refused=()=>TypeError('Bounded creator session dependencies required');
const failure=code=>Object.freeze({ok:false,code});
function fields(value,keys=null){
 if(!value||typeof value!=='object'||types.isProxy(value))return null;
 const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return null;
 const own=Reflect.ownKeys(value);if(keys&&(own.length!==keys.length||own.some(k=>!keys.includes(k))))return null;
 const r=Object.create(null);for(const k of own){const d=Object.getOwnPropertyDescriptor(value,k);if(typeof k!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}return r;
}
const callback=v=>typeof v==='function'&&!types.isProxy(v);
function acceptance(value,q){
 const failed=fields(value,['ok','code']);if(failed)return failed.ok===false&&failures.has(failed.code)?{status:'failed',code:failed.code}:null;
 const keys=q.op==='input'?['ok','accepted','inputSequence']:q.op==='resize'?['ok','accepted','requestId','cols','rows']:['ok'];
 const r=fields(value,keys);if(!r||r.ok!==true)return null;
 if(q.op==='input'&&(r.accepted!==true||r.inputSequence!==q.inputSequence))return null;
 if(q.op==='resize'&&(r.accepted!==true||r.requestId!==q.requestId||r.cols!==q.cols||r.rows!==q.rows))return null;
 return {status:'accepted',code:'COMMAND_ACCEPTED'};
}

/** Owns one lifetime channel subscriber, one startup, and one private gate.
 * All control updates go through applyGate, so startup and input authority see
 * the same captured generation. Closing never stops an existing shell here;
 * eventual backend cleanup is a distinct native operation with held budgets.
 * The provider callbacks must implement CreatorStartup's trusted contract.
 */
export class TerminalCreatorSession {
 #channel;#scope;#startup;#gate=new HostInputGate();#gateState=Object.freeze({generation:0,open:false});
 #endpoints;#notify;#commands=null;#begin=null;#project=null;#closed=false;#notified=false;#pendingStartup=false;#unsubscribe=null;
 constructor(options,...extra){
  let p,scope;
  try{
   p=fields(options);if(extra.length||!p||Object.keys(p).some(k=>!['channel','prepareShell','assertEndpointsCurrent','onUnavailable','deadlineMs','policy'].includes(k))||!p.channel||types.isProxy(p.channel)||!['prepareShell','assertEndpointsCurrent','onUnavailable'].every(k=>callback(p[k])))throw Error();
   scope=invoke(identity,p.channel,[]);if(scope.role!=='creator')throw Error();
  }catch{throw refused();}
  this.#channel=p.channel;this.#scope=Object.freeze({sessionId:scope.sessionId,channelId:scope.channelId});this.#endpoints=p.assertEndpointsCurrent;this.#notify=p.onUnavailable;
  try{
   this.#startup=new TerminalCreatorStartup({...this.#scope,readGate:()=>this.#gateState,assertEndpointsCurrent:this.#endpoints,prepareShell:p.prepareShell,onUnavailable:code=>this.#fence(code,!this.#pendingStartup),...(p.deadlineMs===undefined?{}:{deadlineMs:p.deadlineMs}),...(p.policy===undefined?{}:{policy:p.policy})});
   this.#unsubscribe=invoke(subscribe,this.#channel,[{message:q=>this.#message(q),closed:()=>this.#fence('STARTUP_UNAVAILABLE')}]);
   if(this.#closed)this.#detach();
  }catch{this.#fence('STARTUP_UNAVAILABLE');throw refused();}
 }
 get nativeExecutionAdmitted(){return false;}
 get identity(){return Object.freeze({role:'creator',...this.#scope});}
 #detach(){if(this.#unsubscribe){const fn=this.#unsubscribe;this.#unsubscribe=null;try{invoke(fn,undefined,[]);}catch{}}}
 #transportClose(){this.#detach();try{invoke(close,this.#channel,[]);}catch{}}
 #fence(code,closeTransport=true){
  this.#closed=true;
  // Claim the first cause before disposal callbacks can reenter this method.
  const notify=!this.#notified;this.#notified=true;
  if(this.#commands)try{invoke(retire,this.#commands,[]);}catch{}
  if(this.#startup)try{invoke(startupDispose,this.#startup,[]);}catch{}
  if(notify)try{invoke(this.#notify,undefined,[code]);}catch{}
  if(closeTransport)this.#transportClose();
 }
 #message(value){
  // The branded channel already validated semantic DATA. Revalidate at this
  // boundary and consume ownership of its returned mutable chunk Buffer.
  const type=Object.getOwnPropertyDescriptor(value,'type')?.value;
  let chunk=null;
  if(type==='startup-chunk')chunk=Object.getOwnPropertyDescriptor(value,'data')?.value;
  try{
   if(this.#closed)return;
   if(type==='command'){this.#command(value);return;}
   if(this.#pendingStartup){this.#fence('STARTUP_BUSY');return;}
   const wire=encodeStartupRequest(value,this.#begin??this.#scope);if(!wire){this.#fence('STARTUP_REFUSED');return;}
   if(type==='startup-begin')this.#begin=wire;
   this.#pendingStartup=true;
   const promise=invoke(startupHandle,this.#startup,[wire]);
   invoke(then,promise,[reply=>this.#startupReply(reply),()=>{this.#pendingStartup=false;this.#fence('STARTUP_UNAVAILABLE');}]);
  }catch{this.#pendingStartup=false;this.#fence('STARTUP_UNAVAILABLE');}
  finally{if(chunk)try{invoke(fill,chunk,[0]);}catch{this.#fence('STARTUP_REFUSED');}}
 }
 #startupReply(reply){
  this.#pendingStartup=false;
  try{
   if(!reply){this.#fence('STARTUP_UNAVAILABLE');return;}
   if(this.#closed){if(reply.type==='startup-failed')try{invoke(send,this.#channel,[reply]);}catch{}this.#transportClose();return;}
   if(reply.type==='startup-prepared')this.#project=reply.projectId;
   if(reply.type==='startup-ready'){
    const callbacks=invoke(startupCallbacks,this.#startup,[]);if(!callbacks||!this.#project){this.#fence('STARTUP_UNAVAILABLE');return;}
    // Install the receiver BEFORE publishing ready. A synchronous connected
    // transport can deliver the first command from inside that write.
    this.#commands=new TerminalCreatorCommands({...this.#scope,projectId:this.#project,gate:this.#gate,assertEndpointCurrent:this.#endpoints,writeInput:callbacks.writeInput,resize:callbacks.resize});
   }
   if(invoke(send,this.#channel,[reply])!==true){this.#fence('STARTUP_UNAVAILABLE');return;}
   if(reply.type==='startup-failed')this.#fence(reply.code);
  }catch{this.#fence('STARTUP_UNAVAILABLE');}
 }
 #command(value){
  if(!this.#commands){this.#fence('COMMAND_UNAVAILABLE');return;}
  const wire=encodeTerminalCommandRequest(value,this.#scope),q=wire&&decodeTerminalCommandRequest(wire,this.#scope);
  if(!q){this.#fence('COMMAND_UNAVAILABLE');return;}
  let result;
  if(q.op==='install')result=invoke(install,this.#commands,[q.token]);
  else if(q.op==='revoke')result=invoke(revoke,this.#commands,[q.token]);
  else if(q.op==='input')result=invoke(input,this.#commands,[{...q.token,inputSequence:q.inputSequence,data:q.data}]);
  else result=invoke(resize,this.#commands,[{...q.token,requestId:q.requestId,cols:q.cols,rows:q.rows}]);
  if(this.#closed)return;
  const receipt=acceptance(result,q);if(!receipt){this.#fence('COMMAND_UNAVAILABLE');return;}
  if(invoke(send,this.#channel,[{type:'command-result',...this.#scope,op:q.op,requestId:q.requestId,token:q.token,...receipt}])!==true)this.#fence('COMMAND_UNAVAILABLE');
  else if(receipt.status==='failed'&&['COMMAND_AMBIGUOUS','COMMAND_RETIRED','ENDPOINT_UNAVAILABLE'].includes(receipt.code))this.#fence(receipt.code);
 }
 applyGate(value,...extra){
  if(this.#closed)return failure('HOST_UNAVAILABLE');
  let p;try{p=!extra.length&&fields(value,['generation','open']);}catch{}
  if(!p||!Number.isSafeInteger(p.generation)||p.generation<0||typeof p.open!=='boolean')return failure('REQUEST_REFUSED');
  const result=invoke(this.#commands?commandsApply:gateApply,this.#commands??this.#gate,[p]);
  if(result.ok===true)this.#gateState=Object.freeze({generation:p.generation,open:p.open});
  return result;
 }
 dispose(...extra){if(extra.length)return false;this.#fence('STARTUP_RETIRED');return true;}
 stats(){return Object.freeze({nativeExecutionAdmitted:false,closed:this.#closed,commandsCreated:!!this.#commands,pendingStartup:this.#pendingStartup,gate:this.#gateState,startup:this.#startup?invoke(startupStats,this.#startup,[]):null,commands:this.#commands?invoke(commandStats,this.#commands,[]):null});}
}
