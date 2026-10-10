// Pure composition of the branded authenticated creator lane and synchronous
// creator authority. No generic handlers, replay, main tracker or process work.
import {types} from 'node:util';
import {TerminalCommandChannel} from './command-channel.mjs';
import {TerminalCreatorCommands,TERMINAL_CREATOR_COMMAND_CODES} from './creator-commands.mjs';
import {encodeTerminalCommandRequest,decodeTerminalCommandRequest} from './command-protocol.mjs';

const invoke=Reflect.apply;
const channelIdentity=Object.getOwnPropertyDescriptor(TerminalCommandChannel.prototype,'identity').get;
const subscribe=TerminalCommandChannel.prototype.subscribe,send=TerminalCommandChannel.prototype.send,close=TerminalCommandChannel.prototype.dispose;
const install=TerminalCreatorCommands.prototype.installLease,revoke=TerminalCreatorCommands.prototype.revokeLease,input=TerminalCreatorCommands.prototype.input,resize=TerminalCreatorCommands.prototype.resize;
const retire=TerminalCreatorCommands.prototype.retire,stats=TerminalCreatorCommands.prototype.stats;
const failures=new Set(TERMINAL_CREATOR_COMMAND_CODES);
const refused=()=>TypeError('Branded creator command responder required');
function fields(value,keys){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(key=>!keys.includes(key)))return null;
 const r=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[key]=d.value;}return r;
}
function acceptance(value,request){
 const failure=fields(value,['ok','code']);if(failure)return failure.ok===false&&failures.has(failure.code)?{status:'failed',code:failure.code}:null;
 const keys=request.op==='input'?['ok','accepted','inputSequence']:request.op==='resize'?['ok','accepted','requestId','cols','rows']:['ok'];
 const r=fields(value,keys);if(!r||r.ok!==true)return null;
 if(request.op==='input'&&(r.accepted!==true||r.inputSequence!==request.inputSequence))return null;
 if(request.op==='resize'&&(r.accepted!==true||r.requestId!==request.requestId||r.cols!==request.cols||r.rows!==request.rows))return null;
 return{status:'accepted',code:'COMMAND_ACCEPTED'};
}

export function createTerminalCommandResponder(options,...extra){
 let p,identity;
 try{
  p=fields(options,['channel','commands']);if(extra.length||!p||!p.channel||!p.commands||types.isProxy(p.channel)||types.isProxy(p.commands))throw refused();
  // Original private-field-bearing methods perform branding without instanceof,
  // caller getters, prototype traversal or Proxy traps.
  identity=invoke(channelIdentity,p.channel,[]);invoke(stats,p.commands,[]);if(identity.role!=='creator')throw refused();
 }catch{throw refused();}
 const scope=Object.freeze({channelId:identity.channelId,sessionId:identity.sessionId});
 let disposed=false,unsubscribe=null;
 function dispose(){
  if(disposed)return;disposed=true;
  // Fence local authority before callbacks, transport close or queued frames.
  try{invoke(retire,p.commands,[]);}catch{}
  if(unsubscribe){const fn=unsubscribe;unsubscribe=null;try{invoke(fn,undefined,[]);}catch{}}
  try{invoke(close,p.channel,[]);}catch{}
 }
 function message(value){
  if(disposed)return;
  try{
   // Validate the already decoded request again at the composition boundary.
   const wire=encodeTerminalCommandRequest(value,scope),q=wire&&decodeTerminalCommandRequest(wire,scope);if(!q){dispose();return;}
   let result;
   if(q.op==='install')result=invoke(install,p.commands,[q.token]);
   else if(q.op==='revoke')result=invoke(revoke,p.commands,[q.token]);
   else if(q.op==='input')result=invoke(input,p.commands,[{...q.token,inputSequence:q.inputSequence,data:q.data}]);
   else result=invoke(resize,p.commands,[{...q.token,requestId:q.requestId,cols:q.cols,rows:q.rows}]);
   if(disposed)return;
   const receipt=acceptance(result,q);if(!receipt){dispose();return;}
   const reply={type:'command-result',op:q.op,channelId:q.channelId,sessionId:q.sessionId,requestId:q.requestId,token:q.token,...receipt};
   if(invoke(send,p.channel,[reply])!==true)dispose();
  }catch{dispose();}
 }
 try{
  unsubscribe=invoke(subscribe,p.channel,[{message,closed:dispose}]);
  // subscribe may synchronously observe an already closed branded channel.
  if(disposed&&unsubscribe){const fn=unsubscribe;unsubscribe=null;invoke(fn,undefined,[]);}
 }catch{dispose();throw refused();}
 return dispose;
}
