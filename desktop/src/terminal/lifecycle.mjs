import {randomUUID} from 'node:crypto';
import {TERMINAL_LIMITS as limits,validateTerminalRequest} from './contracts.mjs';

// Pure lifecycle composition, deliberately not imported by main/IPC/host.
// No Electron, filesystem, process, PTY or ownership implementation. The future
// native manager must bind live registry policy/captured admission, a qualified
// atomic creator, and held-identity exit verification. Tests use inert callbacks;
// accepting a callback is never evidence that native execution is admitted.
const id = v => typeof v === 'string' && /^[a-z0-9][a-z0-9_-]{0,127}$/.test(v);
const fail = (code,operationId) => Object.freeze({ok:false,...(operationId?{operationId}:{}),code,message:code});
const pass = (value,operationId) => Object.freeze({ok:true,...(operationId?{operationId}:{}),value:Object.freeze(value)});
class Refusal extends Error {constructor(code){super(code);this.code=code;}}
const refuse = code => {throw new Refusal(code);};
function data(value,keys) {
  try {
    if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
    const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>!keys.includes(k)))return null;
    const r={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}return r;
  }catch{return null;}
}
function context(grant) {
  try {
    const r={};for(const k of ['windowId','projectId','epoch','role']){const d=grant&&Object.getOwnPropertyDescriptor(grant,k);if(!d||!Object.hasOwn(d,'value'))return null;r[k]=d.value;}
    return id(r.windowId)&&id(r.projectId)&&Number.isSafeInteger(r.epoch)&&r.epoch>=1&&['workspace','terminal'].includes(r.role)?Object.freeze(r):null;
  }catch{return null;}
}
export class TerminalLifecycle {
  #deps;#sessions=new Map();#closed=true;#generation=0;#lost=false;#retired=false;#openPending=null;#openBusy=false;
  constructor({authorize,captureAdmission,inputFence,prepareSession,createOwnedSession,activateOwnedSession,onVerifiedExit,stopOwnedSession,verifyOwnedExit,setTimer=setTimeout,clearTimer=clearTimeout,deadlineMs=limits.stopDeadlineMs}={}) {
    if(!Number.isSafeInteger(deadlineMs)||deadlineMs<1||deadlineMs>limits.stopDeadlineMs||typeof setTimer!=='function'||typeof clearTimer!=='function')throw TypeError('Bounded lifecycle deadline required');
    this.#deps={authorize,captureAdmission,inputFence,prepareSession,createOwnedSession,activateOwnedSession,onVerifiedExit,stopOwnedSession,verifyOwnedExit,setTimer,clearTimer,deadlineMs};
    // Construction is closed even if a supplied fence was previously open.
    try{Promise.resolve(inputFence?.closeInput?.('initial-lifecycle-fence')).catch(()=>{});}catch{/* Closed locally. */}
  }
  get nativeExecutionAdmitted(){return false;}
  #info(s){return Object.freeze({sessionId:s.sessionId,projectId:s.projectId,profileId:s.profileId,cwdDisplay:s.cwdDisplay,state:s.state,exitCode:null,droppedUtf8Bytes:0,attachedWindowId:null});}
  snapshot(){return Object.freeze([...this.#sessions.values()].map(s=>this.#info(s)));}
  #check(scope) {
    if(scope.cancelCode)refuse(scope.cancelCode);
    if(this.#lost||this.#retired)refuse('HOST_UNAVAILABLE');
    const c=context(scope.grant);
    try {
      if(!c||Object.keys(c).some(k=>c[k]!==scope.context[k])||this.#deps.authorize?.(scope.grant,scope.method,scope.session?this.#info(scope.session):null)!==true||scope.guard?.isCurrent?.()!==true)refuse('SENDER_REFUSED');
    }catch{refuse('SENDER_REFUSED');}
    if(this.#closed||scope.generation!==this.#generation)refuse('PIN_REQUIRED');
    if(c.epoch!==scope.payload.epoch)refuse('EPOCH_STALE');
    if(scope.session&&scope.session.projectId!==c.projectId)refuse('SESSION_REFUSED');
  }
  #begin(grant,method,payload,session) {
    const validated=validateTerminalRequest(method,payload);if(!validated.ok)refuse('REQUEST_REFUSED');
    const c=context(grant);if(!c)refuse('SENDER_REFUSED');
    const scope={grant,context:c,method,payload:validated.payload,session,generation:this.#generation,cancelCode:null};
    try{scope.guard=this.#deps.captureAdmission?.(grant);}catch{refuse('SENDER_REFUSED');}
    this.#check(scope);return scope;
  }
  #bounded(work,onTimeout) {
    const {setTimer,clearTimer,deadlineMs}=this.#deps;
    return new Promise(resolve=>{
      let finished=false,timer;
      const finish=value=>{if(finished)return;finished=true;if(timer!==undefined)clearTimer(timer);resolve(value);};
      timer=setTimer(()=>{if(!finished)finish(onTimeout());},deadlineMs);
      Promise.resolve().then(work).then(finish,()=>finish(fail('HOST_UNAVAILABLE')));
    });
  }
  closeInput(reason) {
    // No await before local refusal. Lock never invokes owner Stop or sends input.
    this.#closed=true;this.#generation++;
    for(const s of this.#sessions.values())if(s.scope)s.scope.cancelCode='PIN_REQUIRED';
    let hostFence;
    try{hostFence=this.#deps.inputFence?.closeInput?.(reason);}catch{return Promise.resolve(fail('HOST_UNAVAILABLE'));}
    return this.#bounded(async()=>{
      try{const r=await hostFence;return r?.ok===true&&r.localInputFenced===true&&r.hostAcknowledged===true?Object.freeze({ok:true,localInputFenced:true,hostAcknowledged:true}):fail('HOST_UNAVAILABLE');}
      catch{return fail('HOST_UNAVAILABLE');}
    },()=>fail('HOST_UNAVAILABLE'));
  }
  resumeInput() {
    if(this.#lost||this.#retired||typeof this.#deps.inputFence?.resumeInput!=='function')return Promise.resolve(fail('HOST_UNAVAILABLE'));
    if(this.#openBusy)return this.#openPending??Promise.resolve(fail('HOST_UNAVAILABLE'));
    if(!this.#closed)return Promise.resolve(Object.freeze({ok:true,localInputFenced:false,hostAcknowledged:true}));
    const generation=this.#generation;
    // Initiate the real external operation NOW. Deferring this call could put
    // an old open behind a later Lock/host-failure/shutdown close packet.
    this.#openBusy=true;
    let hostOpen;
    try{hostOpen=this.#deps.inputFence.resumeInput();}
    catch{this.#openBusy=false;return Promise.resolve(fail('HOST_UNAVAILABLE'));}
    const settled=Promise.resolve(hostOpen).then(value=>({value}),()=>({value:null}));
    const opening=this.#bounded(async()=>{
      try {
        const {value:r}=await settled;
        if(this.#lost||this.#retired||generation!==this.#generation||r?.ok!==true||r.localInputFenced!==false||r.hostAcknowledged!==true)return fail('HOST_UNAVAILABLE');
        this.#closed=false;return Object.freeze({ok:true,localInputFenced:false,hostAcknowledged:true});
      }catch{return fail('HOST_UNAVAILABLE');}
    },()=>{
      // Keep the underlying open single-flight, and issue a newer close even
      // if its ACK is uncertain. A wrapper timeout is not host settlement.
      this.closeInput('resume-timeout').catch(()=>{});return fail('HOST_UNAVAILABLE');
    });
    this.#openPending=opening;
    settled.then(()=>{this.#openBusy=false;if(this.#openPending===opening)this.#openPending=null;});
    return opening;
  }
  async create(grant,payload) {
    const validated=validateTerminalRequest('terminalCreate',payload);if(!validated.ok)return fail('REQUEST_REFUSED');
    let scope;try{scope=this.#begin(grant,'terminalCreate',validated.payload);}catch(e){return fail(e.code??'SENDER_REFUSED',validated.payload.operationId);}
    const operationId=scope.payload.operationId;
    // Pending native/prepare promises retain their slot even after a deadline.
    if([...this.#sessions.values()].filter(s=>s.pending||s.state!=='exited').length>=limits.sessions)return fail('CAPACITY_EXCEEDED',operationId);
    if(this.#sessions.size>=limits.sessions){const old=[...this.#sessions.values()].find(s=>s.state==='exited'&&!s.pending);this.#sessions.delete(old.sessionId);}
    const s={sessionId:randomUUID(),projectId:scope.context.projectId,profileId:scope.payload.profileId,cwdDisplay:'',state:'starting',ownerId:null,pending:true,nativeStarted:false,scope,stopPending:null};
    this.#sessions.set(s.sessionId,s);
    return this.#bounded(async()=>{
      try {
        this.#check(scope);if(typeof this.#deps.prepareSession!=='function'||typeof this.#deps.createOwnedSession!=='function')refuse('HOST_UNAVAILABLE');
        const prepared=data(await this.#deps.prepareSession(grant,scope.payload),['profileId','cwdDisplay','envelope']);
        this.#check(scope);
        if(!prepared||prepared.profileId!==s.profileId||typeof prepared.cwdDisplay!=='string'||!prepared.cwdDisplay.isWellFormed()||!prepared.cwdDisplay.length||prepared.cwdDisplay.length>32768||!prepared.envelope||typeof prepared.envelope!=='object')refuse('REQUEST_REFUSED');
        s.cwdDisplay=prepared.cwdDisplay;this.#check(scope);
        s.nativeStarted=true;
        const guard=Object.freeze({isCurrent:()=>{try{this.#check(scope);return true;}catch{return false;}}});
        const owner=data(await this.#deps.createOwnedSession(Object.freeze({sessionId:s.sessionId,projectId:s.projectId,envelope:prepared.envelope,cols:scope.payload.cols,rows:scope.payload.rows}),guard),['ownerId']);
        if(!owner||!id(owner.ownerId)||[...this.#sessions.values()].some(other=>other!==s&&other.ownerId===owner.ownerId))refuse('CLEANUP_FAILED');
        s.ownerId=owner.ownerId;
        // Retain the allocated owner BEFORE asynchronous shell readiness/watch.
        // Legacy pure providers may return an already activated owner; the
        // composed manager always supplies this separate activation boundary.
        this.#check(scope);
        if(this.#deps.activateOwnedSession){
          const ready=data(await this.#deps.activateOwnedSession(Object.freeze({sessionId:s.sessionId,projectId:s.projectId,ownerId:s.ownerId}),guard),['ready']);
          this.#check(scope);if(ready?.ready!==true)refuse('HOST_UNAVAILABLE');
        }
        this.#check(scope);s.state='running';return pass(this.#info(s),operationId);
      }catch(e){
        if(s.ownerId){const cleaned=await this.#cleanup(s);return fail(cleaned.ok?(e.code??'HOST_UNAVAILABLE'):'CLEANUP_FAILED',operationId);}
        s.state=s.nativeStarted?'cleanup-failed':'exited';return fail(s.nativeStarted?'CLEANUP_FAILED':e.code??'HOST_UNAVAILABLE',operationId);
      }finally{s.pending=false;s.scope=null;}
    },()=>{
      scope.cancelCode='HOST_UNAVAILABLE';s.state=s.nativeStarted?'cleanup-failed':'exited';
      return fail(s.nativeStarted?'CLEANUP_FAILED':'HOST_UNAVAILABLE',operationId);
    });
  }
  list(grant,payload) {
    const validated=validateTerminalRequest('terminalList',payload);if(!validated.ok)return fail('REQUEST_REFUSED');
    try{const scope=this.#begin(grant,'terminalList',validated.payload);return pass(Object.freeze([...this.#sessions.values()].filter(s=>s.projectId===scope.context.projectId).map(s=>this.#info(s))),scope.payload.operationId);}
    catch(e){return fail(e.code??'SENDER_REFUSED',validated.payload.operationId);}
  }
  #cleanup(s) {
    if(s.stopPending)return s.stopPending;
    if(s.state==='exited')return Promise.resolve(pass(this.#info(s)));
    if(!s.ownerId)return Promise.resolve(fail('CLEANUP_FAILED'));
    s.state='stopping';s.cleanupBusy=true;let expired=false;
    const stopping=this.#bounded(async()=>{
      try {
        const stopped=await this.#deps.stopOwnedSession?.(Object.freeze({ownerId:s.ownerId,deadlineMs:this.#deps.deadlineMs}));
        if(expired)return fail('CLEANUP_FAILED');
        if(stopped?.ok!==true||stopped.verifiedExited!==true)throw Error('STOP_NOT_VERIFIED');
        const v=data(await this.#deps.verifyOwnedExit?.(Object.freeze({ownerId:s.ownerId})),['identityKnown','verifiedExited','remainingCount']);
        if(expired)return fail('CLEANUP_FAILED');
        if(!v||v.identityKnown!==true||v.verifiedExited!==true||v.remainingCount!==0)throw Error('OWNED_EXIT_UNKNOWN');
        if(this.#deps.onVerifiedExit&&await this.#deps.onVerifiedExit(Object.freeze({sessionId:s.sessionId,ownerId:s.ownerId}))!==true)throw Error('RETIREMENT_UNVERIFIED');
        if(expired)return fail('CLEANUP_FAILED');
        s.state='exited';return pass(this.#info(s));
      }catch{if(!expired)s.state='cleanup-failed';return fail('CLEANUP_FAILED');}
      finally{s.cleanupBusy=false;if(expired&&s.stopPending===stopping)s.stopPending=null;}
    },()=>{expired=true;s.state='cleanup-failed';return fail('CLEANUP_FAILED');});
    s.stopPending=stopping;stopping.finally(()=>{if(s.stopPending===stopping&&!s.cleanupBusy)s.stopPending=null;});return stopping;
  }
  async stop(grant,payload) {
    const valid=validateTerminalRequest('terminalStop',payload);if(!valid.ok)return fail('REQUEST_REFUSED');
    const s=this.#sessions.get(valid.payload.sessionId);if(!s)return fail('SESSION_REFUSED',valid.payload.operationId);
    let scope;try{scope=this.#begin(grant,'terminalStop',payload,s);}catch(e){return fail(e.code??'SENDER_REFUSED',valid.payload.operationId);}
    // Startup cancellation is handled by the create worker's bounded rollback.
    if(s.scope){s.scope.cancelCode='SESSION_REFUSED';if(!s.ownerId)return fail('CLEANUP_FAILED',valid.payload.operationId);}
    const result=await this.#cleanup(s);
    try{this.#check(scope);}catch(e){return fail(e.code??'SENDER_REFUSED',valid.payload.operationId);}
    return result.ok?pass(this.#info(s),valid.payload.operationId):fail('CLEANUP_FAILED',valid.payload.operationId);
  }
  hostFailed() {
    this.#lost=true;this.#closed=true;this.#generation++;
    try{Promise.resolve(this.#deps.inputFence?.closeInput?.('host-unavailable')).catch(()=>{});}catch{/* Local fence already closed. */}
    for(const s of this.#sessions.values()){if(s.scope)s.scope.cancelCode='HOST_UNAVAILABLE';if(s.state!=='exited')s.state='host-failed';}
  }
  // Main-only authenticated exit events trigger cleanup; they never prove it.
  reconcileExit(sessionId) {
    const s=this.#sessions.get(sessionId);if(!s)return Promise.resolve(fail('SESSION_REFUSED'));
    if(s.scope)s.scope.cancelCode='HOST_UNAVAILABLE';
    return this.#cleanup(s);
  }
  async shutdown(reason) {
    this.#retired=true;const fence=this.closeInput(reason);
    const results=await Promise.all([...this.#sessions.values()].map(s=>s.pending&&!s.ownerId?Promise.resolve(fail('CLEANUP_FAILED')):this.#cleanup(s)));
    const f=await fence;
    return f.ok&&results.every(r=>r.ok)?pass({verifiedExited:true}):fail('CLEANUP_FAILED');
  }
}
