// Pure main-side request boundary only. No Electron, native loader, filesystem,
// renderer bridge, process control, product activation or admission flag.
// Main must install neither this router nor its providers before qualification.
// Manager policy remains authoritative for PIN/mode/session/attachment access.
// Revoke is permanent: the same lifecycle retains unresolved provider capacity.
// Capture this router's actual handle before replacing it. Manager/native work
// is a separate authority; this handle joins only returned work and local drain.
import {types} from 'node:util';
import {validateTerminalRequest} from './contracts.mjs';

const routes=Object.freeze({terminalPickCwd:'pickCwd',terminalListProfiles:'listProfiles',terminalCreate:'create',terminalList:'list',terminalAttach:'attach',terminalInput:'input',terminalResize:'resize',terminalAck:'ack',terminalDetach:'detach',terminalStop:'stop'});
const fields=Object.freeze(['windowId','projectId','epoch','role','webContentsId','mainFrameUrl']);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const positive=value=>Number.isSafeInteger(value)&&value>0;
const fail=(code,operationId)=>Object.freeze({ok:false,code,message:code,...(operationId?{operationId}:{})});
const NativePromise=Promise,promisePrototype=Promise.prototype,then=promisePrototype.then,apply=Reflect.apply;
const species=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
const resolved=value=>new NativePromise(resolve=>resolve(value));
function nativePromise(value){
 if(!value||types.isProxy(value)||!types.isPromise(value)||Object.getPrototypeOf(value)!==promisePrototype||Object.hasOwn(value,'constructor'))return false;
 const c=Object.getOwnPropertyDescriptor(promisePrototype,'constructor'),s=Object.getOwnPropertyDescriptor(NativePromise,Symbol.species);
 return !!c&&Object.hasOwn(c,'value')&&c.value===NativePromise&&!!s&&s.get===species.get&&s.set===species.set&&!Object.hasOwn(s,'value');
}
function unsafeAsync(value){
 if(value===null||!['object','function'].includes(typeof value))return false;
 for(let p=value;p;p=Object.getPrototypeOf(p)){if(types.isProxy(p))return true;const d=Object.getOwnPropertyDescriptor(p,'then');if(d)return !Object.hasOwn(d,'value')||typeof d.value==='function';}return false;
}
function replyData(value){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
 const keys=Reflect.ownKeys(value);return keys.length<=32&&keys.every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(value,k),'value'));
}
function copyReply(value){const out=Object.create(null);for(const key of Reflect.ownKeys(value))out[key]=Object.getOwnPropertyDescriptor(value,key).value;return Object.freeze(out);}
function routerLifetime(){
 const c={retired:false,done:false,unknown:false,frames:0,pending:0,workers:0,resolve:null};
 c.handle=Object.freeze({actualSettled:new NativePromise(resolve=>c.resolve=resolve),snapshot:()=>Object.freeze({retired:c.retired,actualSettled:c.done,unknown:c.unknown,activeFrames:c.frames,pending:c.pending,pendingWorkers:c.workers,nativeExecutionAdmitted:false})});return c;
}
function method(object,key){
  try{for(let own=object;own;own=Object.getPrototypeOf(own)){if(types.isProxy(own))return null;const d=Object.getOwnPropertyDescriptor(own,key);if(d){if(!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))return null;const fn=d.value;return(...args)=>apply(fn,object,args);}}}catch{}
  return null;
}
function context(grant){
  try{
    if(!grant||types.isProxy(grant)||![Object.prototype,null].includes(Object.getPrototypeOf(grant)))return null;
    const result={};for(const key of fields){const d=Object.getOwnPropertyDescriptor(grant,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}
    return id(result.windowId)&&id(result.projectId)&&positive(result.epoch)&&positive(result.webContentsId)&&['workspace','terminal'].includes(result.role)&&typeof result.mainFrameUrl==='string'&&result.mainFrameUrl.length>0&&result.mainFrameUrl.length<=4096?Object.freeze(result):null;
  }catch{return null;}
}

export class TerminalRequestRouter{
  #capture;#current;#guard;#methods;#maxPending;#maxPerCaller;#maxCallers;
  #pending=0;#callers=new Map();#generation=0;#revoked=false;#disposed=false;
  #life=routerLifetime();#entries=new Set();
  constructor({registry,manager,maxPending=32,maxPendingPerCaller=8,maxCallers=32}={}){
    if(!positive(maxPending)||maxPending>64||!positive(maxPendingPerCaller)||maxPendingPerCaller>8||!positive(maxCallers)||maxCallers>64)throw TypeError('Bounded terminal request limits required');
    this.#capture=method(registry,'capture');this.#current=method(registry,'isCurrent');this.#guard=method(registry,'captureAdmissionGuard');
    this.#methods=Object.freeze(Object.fromEntries(Object.entries(routes).map(([name,target])=>[name,method(manager,target)])));
    this.#maxPending=maxPending;this.#maxPerCaller=maxPendingPerCaller;this.#maxCallers=maxCallers;
  }
  captureRouterSettlement(...extra){return extra.length?null:this.#life.handle;}
  retireRouter(...extra){if(extra.length)return null;this.revoke();return this.#life.handle;}
  #frame(fn){this.#life.frames++;try{return fn();}finally{this.#life.frames--;this.#finish();}}
  #finish(){const c=this.#life;if(c.done||!c.retired||c.unknown||c.frames||c.workers||this.#pending)return;this.#capture=this.#current=this.#guard=this.#methods=null;this.#callers.clear();c.done=true;const resolve=c.resolve;c.resolve=null;resolve(Object.freeze({scope:'ROUTER_REQUESTS',actualSettled:true,nativeExecutionAdmitted:false}));}
  #sync(c,fn,...args){if(c.unknown||this.#revoked||this.#disposed)return undefined;const value=fn?.(...args);if(unsafeAsync(value)){c.unknown=true;this.#life.unknown=true;if(nativePromise(value))try{apply(then,value,[()=>{},()=>{}]);}catch{}return undefined;}return value;}
  #live(scope){
    try{return !scope.cell.unknown&&!this.#revoked&&!this.#disposed&&scope.generation===this.#generation&&this.#sync(scope.cell,this.#current,scope.grant)===true&&this.#sync(scope.cell,scope.isCurrent)===true&&!scope.cell.unknown&&!this.#revoked&&!this.#disposed&&scope.generation===this.#generation;}catch{return false;}
  }
  #retireIdle(c){
    for(const [sender,row] of this.#callers){
      if(row.pending!==0)continue;
      let current=false;try{current=this.#sync(c,this.#current,row.grant)===true;}catch{}
      if(c.unknown||this.#revoked||this.#disposed)return;
      if(!current)this.#callers.delete(sender);
    }
  }
  #release(c){if(!c.occupied||c.unknown||!c.originalDone)return;c.occupied=false;this.#pending--;this.#life.pending--;c.row.pending--;if((this.#revoked||this.#disposed)&&c.row.pending===0&&this.#callers.get(c.row.sender)===c.row)this.#callers.delete(c.row.sender);}
  #complete(c){this.#release(c);if(c.unknown||!c.originalDone||!c.secondaryDone||!c.publicDone||!this.#entries.has(c))return;this.#entries.delete(c);this.#life.workers--;c.row=c.scope=c.resolve=null;this.#finish();}
  #publish(c,result){if(c.published)return;c.published=true;const resolve=c.resolve;c.resolve=null;resolve(result);}
  #result(c,value,failed=false){
    if(!failed&&unsafeAsync(value)){c.unknown=true;this.#life.unknown=true;this.#publish(c,fail('HOST_UNAVAILABLE',c.request?.operationId));return;}
    const live=c.scope?this.#live(c.scope):!this.#revoked&&!this.#disposed;
    // Admission callbacks may mutate the original result. Recheck after them
    // and copy DATA into a null-prototype reply before Promise resolution.
    if(!failed&&unsafeAsync(value)){c.unknown=true;this.#life.unknown=true;this.#publish(c,fail('HOST_UNAVAILABLE',c.request?.operationId));return;}
    const reply=!live?fail('SENDER_REFUSED',c.request?.operationId):failed||!replyData(value)?fail('HOST_UNAVAILABLE',c.request?.operationId):copyReply(value);
    c.originalDone=true;this.#release(c);this.#publish(c,reply);
  }
  #dispatch(c,dispatch,grant,request){
    let value;try{value=dispatch(grant,request);}catch{c.secondaryDone=true;this.#result(c,null,true);this.#complete(c);return;}
    if(types.isPromise(value)&&!types.isProxy(value)){
      if(!nativePromise(value)){c.unknown=true;this.#life.unknown=true;this.#publish(c,fail('HOST_UNAVAILABLE',request.operationId));return;}
      try{
        const secondary=apply(then,value,[v=>this.#frame(()=>{this.#result(c,v);}),()=>this.#frame(()=>{this.#result(c,null,true);})]);
        if(!nativePromise(secondary))throw Error();
        apply(then,secondary,[()=>this.#frame(()=>{c.secondaryDone=true;this.#complete(c);}),()=>this.#frame(()=>{c.unknown=true;this.#life.unknown=true;this.#publish(c,fail('HOST_UNAVAILABLE',request.operationId));})]);
      }catch{c.unknown=true;this.#life.unknown=true;this.#publish(c,fail('HOST_UNAVAILABLE',request.operationId));}
      return;
    }
    c.secondaryDone=true;this.#result(c,value);this.#complete(c);
  }
  route(value={},...extra){
    if(this.#revoked||this.#disposed)return resolved(fail('SENDER_REFUSED'));
    // Bound even pre-admission continuations, including unexpected async guards.
    if(this.#entries.size>=64||this.#life.frames>=64)return resolved(fail('CAPACITY_EXCEEDED'));
    const c={row:null,scope:null,request:null,occupied:false,unknown:false,originalDone:false,secondaryDone:false,publicDone:false,published:false,resolve:null};
    const reply=new NativePromise(resolve=>c.resolve=resolve);this.#entries.add(c);this.#life.workers++;
    this.#frame(()=>{
      try{const secondary=apply(then,reply,[()=>{}]);if(!nativePromise(secondary))throw Error();apply(then,secondary,[()=>this.#frame(()=>{c.publicDone=true;this.#complete(c);}),()=>this.#frame(()=>{c.unknown=true;this.#life.unknown=true;})]);}catch{c.unknown=true;this.#life.unknown=true;}
      let result;try{result=this.#route(c,value,extra);}catch{result=fail('HOST_UNAVAILABLE',c.request?.operationId);}
      if(result!==undefined){c.originalDone=c.secondaryDone=true;this.#release(c);this.#publish(c,result);}
    });return reply;
  }
  #route(c,value,extra){
    let request,scope,row;
    try{
      if(extra.length||!value||typeof value!=='object'||types.isProxy(value))return fail('REQUEST_REFUSED');
      const own=Object.getOwnPropertyDescriptors(value);if(!['event','method','payload'].every(k=>Object.hasOwn(own[k]??{},'value')))return fail('REQUEST_REFUSED');
      const {event,method:operation,payload:input}=Object.fromEntries(['event','method','payload'].map(k=>[k,own[k].value]));
      if(types.isProxy(input))return fail('REQUEST_REFUSED');
      const checked=validateTerminalRequest(operation,input);if(!checked.ok)return checked;request=checked.payload;c.request=request;
      if(this.#revoked||this.#disposed)return fail('SENDER_REFUSED',request.operationId);
      if(!this.#capture||!this.#current||!this.#guard)return fail('SENDER_REFUSED',request.operationId);
      // Pin real Electron references before calling any async manager operation.
      const sender=event?.sender;if(this.#revoked||this.#disposed)return fail('SENDER_REFUSED',request.operationId);
      const senderFrame=event?.senderFrame;if(this.#revoked||this.#disposed)return fail('SENDER_REFUSED',request.operationId);
      const nativeEvent=Object.freeze({sender,senderFrame});
      if(!nativeEvent.sender||!nativeEvent.senderFrame)return fail('SENDER_REFUSED',request.operationId);
      const captured=this.#sync(c,this.#capture,nativeEvent),capturedContext=context(captured);
      if(!capturedContext||this.#revoked||this.#disposed||this.#sync(c,this.#current,captured)!==true)return fail('SENDER_REFUSED',request.operationId);
      if(request.epoch!==capturedContext.epoch)return fail('EPOCH_STALE',request.operationId);
      row=this.#callers.get(nativeEvent.sender);
      if(row){
        const same=row.frame===nativeEvent.senderFrame&&fields.every(key=>row.context[key]===capturedContext[key])&&this.#sync(c,this.#current,row.grant)===true;
        if(c.unknown)return fail('SENDER_REFUSED',request.operationId);
        if(!same){
          // Navigating/reprojecting one sender cannot rotate away an occupied
          // per-caller slot or replace its still-running request authority.
          if(row.pending!==0)return fail('SENDER_REFUSED',request.operationId);
          this.#callers.delete(nativeEvent.sender);row=null;
        }
      }
      if(!row){
        if(this.#callers.size>=this.#maxCallers)this.#retireIdle(c);
        if(c.unknown||this.#revoked||this.#disposed)return fail('SENDER_REFUSED',request.operationId);
        if(this.#callers.size>=this.#maxCallers)return fail('CAPACITY_EXCEEDED',request.operationId);
        row={sender:nativeEvent.sender,frame:nativeEvent.senderFrame,grant:captured,context:capturedContext,pending:0};
        this.#callers.set(nativeEvent.sender,row);
      }
      // Reuse only the registry-owned captured object. Manager attachment
      // equality must survive fresh capture() objects on subsequent IPC calls.
      scope={grant:row.grant,generation:this.#generation,isCurrent:method(this.#sync(c,this.#guard,row.grant),'isCurrent'),cell:c};c.scope=scope;c.row=row;
      if(!this.#live(scope))return fail('SENDER_REFUSED',request.operationId);
      const dispatch=this.#methods[operation];if(!dispatch)return fail('HOST_UNAVAILABLE',request.operationId);
      if(this.#pending>=this.#maxPending||row.pending>=this.#maxPerCaller)return fail('CAPACITY_EXCEEDED',request.operationId);
      if(!this.#live(scope))return fail('SENDER_REFUSED',request.operationId);
      // The final guard may reenter route and occupy capacity or replace an
      // idle canonical row. No effectful callback follows these final checks.
      if(this.#callers.get(row.sender)!==row)return fail('SENDER_REFUSED',request.operationId);
      if(this.#pending>=this.#maxPending||row.pending>=this.#maxPerCaller)return fail('CAPACITY_EXCEEDED',request.operationId);
      this.#pending++;this.#life.pending++;row.pending++;c.occupied=true;
      this.#dispatch(c,dispatch,scope.grant,request);return undefined;
    }catch{
      return fail(scope&&!this.#live(scope)?'SENDER_REFUSED':'HOST_UNAVAILABLE',request?.operationId);
    }finally{if((this.#revoked||this.#disposed)&&row?.pending===0&&this.#callers.get(row.sender)===row)this.#callers.delete(row.sender);}
  }
  revoke(){if(this.#life.done)return;return this.#frame(()=>{if(!this.#revoked){this.#revoked=true;this.#generation++;this.#life.retired=true;}for(const [sender,row] of this.#callers)if(row.pending===0)this.#callers.delete(sender);});}
  dispose(){this.#disposed=true;this.revoke();}
  stats(){return Object.freeze({pending:this.#pending,callers:this.#callers.size,revoked:this.#revoked,disposed:this.#disposed});}
}
