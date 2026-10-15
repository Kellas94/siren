// Pure main-side composition. No Electron/native loader, filesystem, spawn,
// renderer bridge or product admission. Real bootstrap/transport/fan-out gate
// providers are still required and must be separately qualified before wiring.
import {TerminalLifecycle} from './lifecycle.mjs';
import {TerminalSessionLedger} from './session-state.mjs';
import {TerminalOutputPump} from './output-pump.mjs';
import {TerminalRemoteOutput} from './remote-output.mjs';
import {VtBudgetFilter} from './output.mjs';
import {TerminalInputFence} from './input-gate.mjs';
import {TERMINAL_LIMITS as limits,validateTerminalRequest} from './contracts.mjs';
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const fail=(code='HOST_UNAVAILABLE',operationId)=>Object.freeze({ok:false,code,message:code,...(operationId?{operationId}:{})});
const pass=(value,operationId)=>Object.freeze({ok:true,value:Object.freeze(value),...(operationId?{operationId}:{})});
const refuse=code=>{throw Object.assign(new Error(code),{code});};
function method(object,key){
 try{for(let p=object;p;p=Object.getPrototypeOf(p)){const d=Object.getOwnPropertyDescriptor(p,key);if(d)return Object.hasOwn(d,'value')&&typeof d.value==='function'?d.value.bind(object):null;}}catch{}return null;
}
function data(value,keys){
 try{if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
  const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}return r;}catch{return null;}
}
function context(grant){
 try{const c={};for(const k of ['windowId','projectId','epoch','role']){const d=Object.getOwnPropertyDescriptor(grant,k);if(!d||!Object.hasOwn(d,'value'))return null;c[k]=d.value;}
  return id(c.windowId)&&id(c.projectId)&&integer(c.epoch)&&c.epoch>0&&['workspace','terminal'].includes(c.role)?Object.freeze(c):null;}catch{return null;}
}
export class TerminalManager {
 #deps;#lifecycle;#ledger;#output;#remoteOutput;#records=new Map();#listeners=new Set();
 #closed=true;#generation=0;#gateGeneration=0;#retired=false;#lost=false;#deadline;
 constructor({registry,policy,cwdAuthority,profilesFor,ownership,hostOwnerId,atomicStarter,sessionTransport,inputFence,aggregateGateLink,outputMode='local',deadlineMs=limits.stopDeadlineMs}={}){
  if(!integer(deadlineMs)||deadlineMs<1||deadlineMs>limits.stopDeadlineMs)throw TypeError('Bounded manager deadline required');this.#deadline=deadlineMs;
  if(!['local','remote'].includes(outputMode))throw TypeError('Explicit output mode required');this.#remoteOutput=outputMode==='remote';this.#output=this.#remoteOutput?new TerminalRemoteOutput({deadlineMs}):new TerminalOutputPump();
  this.#deps={capture:method(registry,'captureAdmissionGuard'),authorize:method(policy,'authorize'),cwdResolve:method(cwdAuthority,'resolve'),cwdPick:method(cwdAuthority,'pick'),cwdRevoke:method(cwdAuthority,'revoke'),profilesFor:typeof profilesFor==='function'?profilesFor:null,
   createOwner:method(ownership,'createSession'),watchOwner:method(ownership,'watchSessionRoot'),stopOwner:method(ownership,'stopSession'),stopAll:method(ownership,'stopAll'),verify:method(ownership,'verifyExit'),hostOwnerId,
   prepare:method(atomicStarter,'prepare'),connect:method(sessionTransport,'connect'),channelCurrent:method(sessionTransport,'isCurrentSession'),write:method(sessionTransport,'writeInput'),resize:method(sessionTransport,'resize'),readHistory:method(sessionTransport,'readHistory'),
   close:method(inputFence,'closeInput'),open:method(inputFence,'resumeInput'),reserve:method(inputFence,'reserve'),bind:method(inputFence,'bind'),release:method(inputFence,'release')};
  this.#ledger=new TerminalSessionLedger({writeInput:p=>this.#write(p)});
  // Production-preparation path: compose the actual ledger/fence/fan-out lane.
  // Explicit aggregate configuration never falls back to an opaque test fence.
  if(aggregateGateLink!==undefined){
   const send=method(aggregateGateLink,'sendGate'),available=method(aggregateGateLink,'isAvailable'),subscribe=method(aggregateGateLink,'subscribeUnavailable');
   for(const k of ['reserve','bind','release'])this.#deps[k]=method(aggregateGateLink,k);
   this.#deps.close=null;this.#deps.open=null;
   if(send&&available&&subscribe){
    const fence=new TerminalInputFence({ledger:this.#ledger,deadlineMs,gateLink:{sendGate:send,isAvailable:available,subscribeUnavailable:listener=>subscribe(()=>{this.hostFailed();listener();})}});
    this.#deps.close=method(fence,'closeInput');this.#deps.open=method(fence,'resumeInput');
   }
  }
  this.#lifecycle=new TerminalLifecycle({deadlineMs,
   authorize:(grant,operation,session)=>this.#allowed(grant,operation,session),captureAdmission:grant=>this.#capture(grant),
   inputFence:{closeInput:reason=>this.#close(reason),resumeInput:()=>this.#open()},
   prepareSession:(grant,p)=>this.#prepare(grant,p),createOwnedSession:(p,g)=>this.#allocate(p,g),activateOwnedSession:(p,g)=>this.#activate(p,g),
   stopOwnedSession:({ownerId,deadlineMs})=>this.#deps.stopOwner?.({sessionOwnerId:ownerId,deadlineMs}),verifyOwnedExit:p=>this.#deps.verify?.(p),onVerifiedExit:p=>this.#retire(p.sessionId),
  });
 }
 get nativeExecutionAdmitted(){return false;}
 #configured(){return (!this.#remoteOutput||typeof this.#deps.readHistory==='function')&&id(this.#deps.hostOwnerId)&&['capture','authorize','cwdResolve','profilesFor','createOwner','watchOwner','stopOwner','stopAll','verify','prepare','connect','channelCurrent','write','resize','close','open','reserve','bind','release'].every(k=>typeof this.#deps[k]==='function');}
 #capture(grant){const guard=this.#deps.capture?.(grant),current=method(guard,'isCurrent');return Object.freeze({isCurrent:()=>{try{return current?.()===true;}catch{return false;}}});}
 #allowed(grant,operation,session,lease,epoch){
  const c=context(grant);if(!c||this.#closed||this.#retired||this.#lost)return false;
  try{return this.#deps.authorize?.({grant,method:operation,session,lease,epoch:epoch??c.epoch})?.ok===true&&!this.#closed&&!this.#retired&&!this.#lost;}catch{return false;}
 }
 #outputStats(sessionId){return this.#remoteOutput?{firstSequence:0,droppedUtf8Bytes:this.#records.get(sessionId)?.remoteDroppedBytes??0}:this.#output.sessionStats(sessionId);}
 #info(s){const record=this.#records.get(s.sessionId),stat=this.#outputStats(s.sessionId);return Object.freeze({...s,droppedUtf8Bytes:(stat?.droppedUtf8Bytes??0)+(record?.filter.stats().totalOmittedUtf8Bytes??0),attachedWindowId:record?.attachment?.context.windowId??null});}
 #session(id){return this.#lifecycle.snapshot().find(s=>s.sessionId===id);}
 #lease(record){const a=record?.attachment;return a?{sessionId:record.sessionId,projectId:record.projectId,windowId:a.context.windowId,epoch:a.context.epoch,leaseId:a.leaseId,generation:a.generation}:null;}
 #check(scope){
  if(this.#closed)refuse('PIN_REQUIRED');if(this.#retired||this.#lost)refuse('HOST_UNAVAILABLE');
  const c=context(scope.grant);if(!c||Object.keys(c).some(k=>c[k]!==scope.context[k])||scope.localGeneration!==this.#generation||scope.guard.isCurrent()!==true)refuse('SENDER_REFUSED');
  const session=scope.payload.sessionId?this.#session(scope.payload.sessionId):null,record=this.#records.get(scope.payload.sessionId),lease=this.#lease(record);
  if(!this.#allowed(scope.grant,scope.operation,session?this.#info(session):null,lease,scope.payload.epoch))refuse('SENDER_REFUSED');
  if(scope.payload.epoch!==c.epoch)refuse('EPOCH_STALE');
  if(['terminalInput','terminalResize','terminalAck','terminalDetach'].includes(scope.operation)){
   if(!record||!record.attachment||record.attachment.grant!==scope.grant||record.attachment.leaseId!==scope.payload.leaseId||record.attachment.generation!==scope.payload.generation)refuse('LEASE_STALE');
  }
  // Reentrant native providers or caller proxies cannot reopen a checked scope.
  if(this.#closed||scope.localGeneration!==this.#generation||scope.guard.isCurrent()!==true)refuse('SENDER_REFUSED');
 }
 #begin(grant,operation,payload){
  const validated=validateTerminalRequest(operation,payload);if(!validated.ok)refuse('REQUEST_REFUSED');
  const c=context(grant);if(!c)refuse('SENDER_REFUSED');
  const scope={grant,operation,payload:validated.payload,context:c,localGeneration:this.#generation,guard:this.#capture(grant)};this.#check(scope);return scope;
 }
 async #run(grant,operation,payload,work){let scope;try{scope=this.#begin(grant,operation,payload);const result=await work(scope);this.#check(scope);return result;}catch(e){return fail(e.code,scope?.payload.operationId);}}
 #guard(g){if(g?.isCurrent?.()!==true||this.#closed||this.#retired||this.#lost)refuse('SENDER_REFUSED');}
 async #prepare(grant,p){
  if(!this.#configured())refuse('HOST_UNAVAILABLE');const scope=this.#begin(grant,'terminalCreate',p);
  const cwd=await this.#deps.cwdResolve(grant,p.cwdId);this.#check(scope);
  const catalogue=this.#deps.profilesFor(grant),resolve=method(catalogue,'resolveShellProfile');if(!resolve)refuse('PROFILE_UNAVAILABLE');
  const shell=await resolve(p.profileId);this.#check(scope);
  return {profileId:p.profileId,cwdDisplay:cwd,envelope:Object.freeze({cwd,shell})};
 }
 async #allocate(p,guard){
  this.#guard(guard);const record={sessionId:p.sessionId,projectId:p.projectId,ownerId:null,channelId:null,attachment:null,ledger:false,output:false,resizePending:false,filter:new VtBudgetFilter()};this.#records.set(p.sessionId,record);
  if(this.#deps.reserve(p.sessionId)?.ok!==true)refuse('HOST_UNAVAILABLE');
  const creator=await this.#deps.prepare(Object.freeze({...p}),guard);this.#guard(guard);
  const normalized=data(creator,['executable','entry','directory']);if(!normalized)refuse('REQUEST_REFUSED');
  const result=this.#deps.createOwner({hostOwnerId:this.#deps.hostOwnerId,sessionId:p.sessionId,creator:normalized});
  if(result?.ok!==true||!id(result.sessionOwnerId))refuse('CLEANUP_FAILED');record.ownerId=result.sessionOwnerId;
  // No await between retaining the owner and returning it to lifecycle.
  return {ownerId:record.ownerId};
 }
 async #activate(p,guard){
  const record=this.#records.get(p.sessionId);if(!record||record.ownerId!==p.ownerId)refuse('CLEANUP_FAILED');this.#guard(guard);
  const ready=data(await this.#deps.connect(Object.freeze({sessionId:p.sessionId,ownerId:p.ownerId})),['channelId','shellProcessIdentity']);this.#guard(guard);
  if(!ready||!id(ready.channelId)||this.#deps.channelCurrent(p.sessionId,ready.channelId)!==true)refuse('HOST_UNAVAILABLE');record.channelId=ready.channelId;
  if(this.#deps.watchOwner({sessionOwnerId:p.ownerId,shellProcessIdentity:ready.shellProcessIdentity})?.ok!==true)refuse('CLEANUP_FAILED');this.#guard(guard);
  // Capture authenticated startup output before awaiting gate binding. No
  // ledger or renderer lease exists yet; rollback retires this bounded ring.
  if(!this.#output.register(p.sessionId,q=>this.#readHistory(record,q)).ok)refuse('CAPACITY_EXCEEDED');record.output=true;
  if((await this.#deps.bind(p.sessionId,ready.channelId))?.ok!==true)refuse('HOST_UNAVAILABLE');this.#guard(guard);
  const s=this.#session(p.sessionId);if(!s)refuse('SESSION_REFUSED');
  if(!this.#ledger.register(this.#info(s)).ok)refuse('CAPACITY_EXCEEDED');record.ledger=true;
  return {ready:true};
 }
 async #retire(sessionId){
  const record=this.#records.get(sessionId);if(!record)return true;
  this.#fenceSession(sessionId);
  if(record.ledger){if(!this.#ledger.retire(sessionId).ok)return false;record.ledger=false;}
  if(record.output){if(!this.#output.retire(sessionId).ok)return false;record.output=false;}
  if(this.#deps.release?.(sessionId)?.ok!==true)return false;
  this.#records.delete(sessionId);return true;
 }
 #fenceSession(sessionId){
  const record=this.#records.get(sessionId);if(!record)return;
  if(record.ledger)this.#ledger.fenceSession(sessionId);
  if(record.attachment)this.#output.detach({sessionId,leaseId:record.attachment.leaseId,generation:record.attachment.generation});record.attachment=null;
 }
 async #close(reason){
  this.#closed=true;this.#generation++;this.#ledger.closeInput(reason);this.#output.suspendViews();this.#listeners.clear();
  for(const r of this.#records.values())r.attachment=null;
  try{this.#deps.cwdRevoke?.();const r=await this.#deps.close?.(reason);
   if(r?.ok===true&&r.localInputFenced===true&&r.hostAcknowledged===true&&integer(r.generation)&&r.generation>0){this.#gateGeneration=Math.max(this.#gateGeneration,r.generation);return Object.freeze({ok:true,localInputFenced:true,hostAcknowledged:true});}
  }catch{}return fail();
 }
 async #open(){
  if(this.#retired||this.#lost||!this.#configured())return fail();const generation=this.#generation;
  try{const r=await this.#deps.open();if(generation!==this.#generation||this.#retired||this.#lost||r?.ok!==true||r.localInputFenced!==false||r.hostAcknowledged!==true||!integer(r.generation)||r.generation<=this.#gateGeneration)return fail();
   this.#gateGeneration=r.generation;this.#closed=false;this.#ledger.resumeInput();this.#output.resumeViews();return Object.freeze({ok:true,localInputFenced:false,hostAcknowledged:true});
  }catch{return fail();}
 }
 closeInput(reason){return this.#lifecycle.closeInput(reason);}
 resumeInput(){return this.#lifecycle.resumeInput();}
 async create(grant,payload){return this.#run(grant,'terminalCreate',payload,async scope=>{const r=await this.#lifecycle.create(grant,scope.payload);this.#notify();return r.ok?pass(this.#info(r.value),scope.payload.operationId):r;});}
 list(grant,payload){try{const s=this.#begin(grant,'terminalList',payload),r=this.#lifecycle.list(grant,s.payload);return r.ok?pass(r.value.map(v=>this.#info(v)),s.payload.operationId):r;}catch(e){return fail(e.code);}}
 pickCwd(grant,payload){return this.#run(grant,'terminalPickCwd',payload,async s=>pass(await this.#deps.cwdPick(grant),s.payload.operationId));}
 listProfiles(grant,payload){return this.#run(grant,'terminalListProfiles',payload,async s=>{const catalogue=this.#deps.profilesFor?.(grant),list=method(catalogue,'listShellProfiles');if(!list)refuse('PROFILE_UNAVAILABLE');return pass(await list(),s.payload.operationId);});}
 attach(grant,payload){
  try{const scope=this.#begin(grant,'terminalAttach',payload),session=this.#session(scope.payload.sessionId),record=this.#records.get(session?.sessionId);if(session?.state!=='running'||!record?.output||!record.ledger)refuse('HOST_UNAVAILABLE');
   this.#check(scope);const r=this.#ledger.attach(scope.context,session.sessionId);if(!r.ok)return r;
   const token={sessionId:session.sessionId,leaseId:r.value.leaseId,generation:r.value.generation},stats=this.#outputStats(session.sessionId);
   record.attachment={...token,grant,context:scope.context,guard:scope.guard};
   const out=this.#output.attach(session.sessionId,{leaseId:token.leaseId,generation:token.generation,fromSequence:stats.firstSequence});
   if(!out.ok){this.#ledger.detach(scope.context,session.sessionId,token);record.attachment=null;return fail(out.code,scope.payload.operationId);}
   this.#check(scope);this.#notify();return pass({session:this.#info(session),leaseId:token.leaseId,generation:token.generation,firstSequence:stats.firstSequence,nextSequence:stats.nextSequence,droppedUtf8Bytes:stats.droppedUtf8Bytes},scope.payload.operationId);
  }catch(e){return fail(e.code);}
 }
 #attachmentScope(record,p,operation){const a=record?.attachment;if(!a)refuse('LEASE_STALE');const scope={grant:a.grant,context:a.context,guard:a.guard,localGeneration:this.#generation,operation,payload:p};this.#check(scope);return scope;}
 #timed(work){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.closeInput('transport-timeout').catch(()=>{});reject(Object.assign(new Error('HOST_UNAVAILABLE'),{code:'HOST_UNAVAILABLE'}));},this.#deadline);Promise.resolve(work).then(v=>{clearTimeout(timer);resolve(v);},e=>{clearTimeout(timer);reject(e);});});}
 async #write(p){
  const record=this.#records.get(p.sessionId),scope=this.#attachmentScope(record,p,'terminalInput');if(this.#session(p.sessionId)?.state!=='running'||this.#deps.channelCurrent(p.sessionId,record.channelId)!==true)refuse('HOST_UNAVAILABLE');
  const gateGeneration=this.#gateGeneration;this.#check(scope);
  const reply=data(await this.#timed(this.#deps.write(Object.freeze({...p,channelId:record.channelId,gateGeneration}))),['accepted']);
  // This settles the dispatched transport operation, not delivery to its old
  // caller. A known accepted write stays known through Lock/lease replacement;
  // ledger and #run separately refuse the stale receipt. Timeout/malformed or
  // failed transport still rejects and permanently fences ambiguous input.
  if(reply?.accepted!==true)refuse('HOST_UNAVAILABLE');return {accepted:true};
 }
 input(grant,payload){return this.#run(grant,'terminalInput',payload,s=>this.#ledger.input(s.context,s.payload));}
 resize(grant,payload){return this.#run(grant,'terminalResize',payload,async s=>{
  const r=this.#records.get(s.payload.sessionId);if(this.#session(s.payload.sessionId)?.state!=='running'||r.resizePending||this.#deps.channelCurrent(r.sessionId,r.channelId)!==true)refuse('HOST_UNAVAILABLE');
  this.#check(s);r.resizePending=true;const gateGeneration=this.#gateGeneration;
  let underlying;try{underlying=Promise.resolve(this.#deps.resize(Object.freeze({...s.payload,channelId:r.channelId,gateGeneration})));}catch(e){r.resizePending=false;throw e;}
  underlying.then(()=>{r.resizePending=false;},()=>{r.resizePending=false;});
  const reply=data(await this.#timed(underlying),['accepted']);this.#check(s);if(reply?.accepted!==true||gateGeneration!==this.#gateGeneration)refuse('HOST_UNAVAILABLE');return pass({cols:s.payload.cols,rows:s.payload.rows},s.payload.operationId);
 });}
 ack(grant,payload){try{const s=this.#begin(grant,'terminalAck',payload),r=this.#output.ack(this.#token(s.payload),s.payload.throughSequence);return r.ok?pass({throughSequence:s.payload.throughSequence},s.payload.operationId):fail(r.code,s.payload.operationId);}catch(e){return fail(e.code);}}
 #token(p){return {sessionId:p.sessionId,leaseId:p.leaseId,generation:p.generation};}
 detach(grant,payload){try{const s=this.#begin(grant,'terminalDetach',payload),r=this.#ledger.detach(s.context,s.payload.sessionId,this.#token(s.payload));if(!r.ok)return r;this.#output.detach(this.#token(s.payload));this.#records.get(s.payload.sessionId).attachment=null;return pass(this.#info(this.#session(s.payload.sessionId)),s.payload.operationId);}catch(e){return fail(e.code);}}
 // Main-only pull; the native event adapter must authorize again before send.
 deliverAvailable(grant,payload){if(this.#remoteOutput)return this.#deliverRemote(grant,payload);try{const s=this.#begin(grant,'terminalDetach',payload),r=this.#output.take(this.#token(s.payload));this.#check(s);return r.ok?pass({...r.value,epoch:s.context.epoch,...this.#token(s.payload)},s.payload.operationId):fail(r.code,s.payload.operationId);}catch(e){return fail(e.code);}}
 async #readHistory(record,q){
  if(this.#records.get(record.sessionId)!==record||!record.output||this.#deps.channelCurrent(record.sessionId,record.channelId)!==true)refuse('HOST_UNAVAILABLE');
  const result=await this.#deps.readHistory(Object.freeze({...q,channelId:record.channelId}));
  if(this.#records.get(record.sessionId)!==record||!record.output||this.#deps.channelCurrent(record.sessionId,record.channelId)!==true)refuse('HOST_UNAVAILABLE');return result;
 }
 async #deliverRemote(grant,payload){let scope;try{
  scope=this.#begin(grant,'terminalDetach',payload);const r=await this.#output.take(this.#token(scope.payload));this.#check(scope);
  if(!r.ok)return fail(r.code,scope.payload.operationId);const record=this.#records.get(scope.payload.sessionId);if(r.value.gap)record.remoteDroppedBytes=Math.max(record.remoteDroppedBytes??0,r.value.gap.resumeSequence);
  return pass({...r.value,epoch:scope.context.epoch,...this.#token(scope.payload)},scope.payload.operationId);
 }catch(e){
  if(scope){const p=scope.payload,record=this.#records.get(p.sessionId);if(record?.attachment?.leaseId===p.leaseId&&record.attachment.generation===p.generation){this.#output.detach(this.#token(p));this.#ledger.detach(scope.context,p.sessionId,this.#token(p));record.attachment=null;}}
  return fail(e.code,scope?.payload.operationId);
 }}
 stop(grant,payload){return this.#run(grant,'terminalStop',payload,async s=>{this.#fenceSession(s.payload.sessionId);const r=await this.#lifecycle.stop(grant,s.payload);this.#notify();return r.ok?pass(this.#info(r.value),s.payload.operationId):r;});}
 #event(event,keys){const e=data(event,keys),r=e&&this.#records.get(e.sessionId);if(!r||!id(e.channelId)||r.channelId!==e.channelId||this.#deps.channelCurrent(e.sessionId,e.channelId)!==true)return null;return e;}
 sessionOutput(event){try{
  if(this.#remoteOutput)return fail('REQUEST_REFUSED');
  const e=this.#event(event,['sessionId','channelId','data']);if(!e||typeof e.data!=='string'||e.data.length>limits.outputBytes||!e.data.isWellFormed()||Buffer.byteLength(e.data)>limits.outputBytes)return fail('REQUEST_REFUSED');
  const filtered=this.#records.get(e.sessionId).filter.push(e.data);
  for(const chunk of filtered.chunks){const r=this.#output.append(e.sessionId,chunk);if(!r.ok)return r;}
  if(filtered.marker){const r=this.#output.append(e.sessionId,`\r\n[${filtered.marker}]\r\n`);if(!r.ok)return r;}
  return pass({omittedUtf8Bytes:filtered.omittedUtf8Bytes});
 }catch{return fail();}}
 async sessionExited(event){try{const e=this.#event(event,['sessionId','channelId']);if(!e)return fail('SENDER_REFUSED');this.#fenceSession(e.sessionId);const r=await this.#lifecycle.reconcileExit(e.sessionId);this.#notify();return r;}catch{return fail('CLEANUP_FAILED');}}
 sessionFailed(event){return this.sessionExited(event);}
 hostFailed(){if(this.#lost)return;this.#lost=true;this.#closed=true;this.#generation++;this.#ledger.hostFailed();this.#lifecycle?.hostFailed();this.#output.suspendViews();this.#listeners.clear();}
 async shutdown(reason){this.#retired=true;const sessions=this.#lifecycle.shutdown(reason);let common;try{common=await this.#timed(this.#deps.stopAll?.({hostOwnerId:this.#deps.hostOwnerId,deadlineMs:this.#deadline}));const v=this.#deps.verify?.({ownerId:this.#deps.hostOwnerId});if(common?.ok!==true||common.verifiedExited!==true||v?.identityKnown!==true||v.verifiedExited!==true||v.remainingCount!==0)common=null;}catch{common=null;}const r=await sessions;return common&&r.ok?pass({verifiedExited:true}):fail('CLEANUP_FAILED');}
 subscribeState(grant,payload,listener){const scope=this.#begin(grant,'terminalList',payload);if(typeof listener!=='function'||this.#listeners.size>=32)refuse('CAPACITY_EXCEEDED');const row={scope,listener};this.#listeners.add(row);return ()=>this.#listeners.delete(row);}
 #notify(){for(const row of [...this.#listeners])try{this.#check(row.scope);const r=this.list(row.scope.grant,row.scope.payload);if(!r.ok)throw Error();row.listener(r.value);}catch{this.#listeners.delete(row);}}
 stats(){return Object.freeze({nativeExecutionAdmitted:false,ledgerSessions:this.#ledger.snapshot().length,ownershipReservations:this.#records.size,output:this.#output.stats()});}
}
