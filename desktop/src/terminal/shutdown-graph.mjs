// MAIN-private SOURCE_ONLY candidate. No import into the installed application.
// Membership follows construction here; IDs/receipt shapes do not prove it.
// No native loader, process creation, IPC, implicit Lock shutdown or admission.
import {types} from 'node:util';
import {WindowRegistry} from '../windows/registry.mjs';
import {TerminalHostCandidateOwnership} from './host-candidate-ownership.mjs';
import {TerminalProductionBackend} from './production-backend.mjs';
import {TerminalProductionManager} from './production-manager.mjs';
import {TerminalRequestRouter} from './request-router.mjs';
import {TerminalProductionAccessTransitions} from './production-access-transitions.mjs';
import {TerminalPolicy} from './policy.mjs';
import {CwdAuthority} from './cwd.mjs';
import {createShellProfileCatalogue,captureShellProfileSettlement,retireShellProfileCatalogue} from './profiles.mjs';
import {supportedProviderPromise} from './provider-lifetime.mjs';

const apply=Reflect.apply,NativePromise=Promise,then=Promise.prototype.then;
const frozen=o=>Object.freeze(Object.assign(Object.create(null),o));
const fail=()=>frozen({ok:false,code:'HOST_SHUTDOWN_UNVERIFIED'});
const callable=f=>typeof f==='function'&&!types.isProxy(f);
const id=s=>typeof s==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(s);
const method=(type,key)=>Object.getOwnPropertyDescriptor(type.prototype,key).value;
const ownership=Object.fromEntries(['startHost','snapshot','captureOwnershipSettlement','retireOwnership','captureHostShutdownSettlement','beginHostShutdown'].map(k=>[k,method(TerminalHostCandidateOwnership,k)]));
const backend=Object.fromEntries(['captureControlSettlement','retireControl'].map(k=>[k,method(TerminalProductionBackend,k)]));
const manager=Object.fromEntries(['captureManagerSettlement','retireManager','isCurrentLease'].map(k=>[k,method(TerminalProductionManager,k)]));
const router=Object.fromEntries(['captureRouterSettlement','retireRouter'].map(k=>[k,method(TerminalRequestRouter,k)]));
const access=Object.fromEntries(['captureAccessSettlement','retireAccess'].map(k=>[k,method(TerminalProductionAccessTransitions,k)]));
const cwd=Object.fromEntries(['captureCwdSettlement','retireCwd'].map(k=>[k,method(CwdAuthority,k)]));
const registryCurrent=method(WindowRegistry,'isCurrent'),registryGuard=method(WindowRegistry,'captureAdmissionGuard'),policyAuthorize=method(TerminalPolicy,'authorize');
const registryMethods={capture:method(WindowRegistry,'capture'),isCurrent:registryCurrent,captureAdmissionGuard:registryGuard};
const ownerMethods=Object.fromEntries(['prepareSession','allocateSession','connectSession','assertSessionCurrent','watchSessionRoot','captureSession','stopSession','verifyExit','captureSessionSettlement'].map(k=>[k,method(TerminalHostCandidateOwnership,k)]));
const backendMethods=Object.fromEntries(['prepare','allocate','connect','stopSession','sendGate','isAvailable','subscribeUnavailable','captureBackendSettlement','captureControlSettlement','retireControl','install','revoke','input','resize','readHistory'].map(k=>[k,method(TerminalProductionBackend,k)]));
const managerRoutes=Object.fromEntries(['create','list','attach','input','resize','ack','detach','stop'].map(k=>[k,method(TerminalProductionManager,k)]));
const cwdResolve=method(CwdAuthority,'resolve');
function facade(object,methods){return frozen(Object.fromEntries(Object.entries(methods).map(([key,fn])=>[key,(...args)=>apply(fn,object,args)])));}
function data(value,keys=null){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const names=Reflect.ownKeys(value);if(keys&&(names.length!==keys.length||names.some(k=>!keys.includes(k))))return null;
 const out=Object.create(null);for(const k of names){const d=Object.getOwnPropertyDescriptor(value,k);if(typeof k!=='string'||!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[k]=d.value;}return out;
}
function array(value,max){
 if(!Array.isArray(value)||types.isProxy(value)||Object.getPrototypeOf(value)!==Array.prototype)return null;
 const length=Object.getOwnPropertyDescriptor(value,'length')?.value;if(!Number.isInteger(length)||length>max||Reflect.ownKeys(value).length!==length+1)return null;
 const out=[];for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;out.push(d.value);}return Object.freeze(out);
}
function callbacks(value,keys){const o=data(value,keys);if(!o||!Object.values(o).every(callable))throw TypeError('Exact MAIN DATA callbacks required');return frozen(o);}
function request(value){const r=data(value,['code','deadlineMs','shutdownId']);return r&&[77,98].includes(r.code)&&Number.isInteger(r.deadlineMs)&&r.deadlineMs>=1&&r.deadlineMs<=10000&&typeof r.shutdownId==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(r.shutdownId)?frozen(r):null;}
function current(registry,project,grant){const g=data(grant);return !!g&&g.projectId===project&&apply(registryCurrent,registry,[grant])===true;}
function boundCatalogue(grant,providers,registry,policy,project){
 const authorize=method=>current(registry,project,grant)&&apply(policyAuthorize,policy,[{grant,method,epoch:grant.epoch}]).ok===true;
 return createShellProfileCatalogue({...providers,authorize,captureAdmission:()=>apply(registryGuard,registry,[grant])});
}
function profilesLookup(rows,registry,project){return grant=>{
 if(!current(registry,project,grant))return null;
 const row=rows.find(r=>r.grant.windowId===grant.windowId&&r.grant.epoch===grant.epoch&&r.grant.role===grant.role&&current(registry,project,r.grant));
 return row?.catalogue??null;
};}
function cwdCallbacks(registry,project,policy){return {authorize:(grant,method)=>current(registry,project,grant)&&apply(policyAuthorize,policy,[{grant,method,epoch:grant.epoch}]).ok===true,captureAdmission:grant=>apply(registryGuard,registry,[grant])};}
function lowerUnknown(c){for(const snapshot of c.snapshots)try{if(snapshot().unknown===true)return true;}catch{return true;}return false;}
function lifetime(projectId){
 const c={projectId,request:null,started:false,frames:0,pending:0,unknown:false,done:false,upperDone:false,hostStarted:false,hostDone:false,resolve:null,target:null,snapshots:[]};
 const snapshot=()=>frozen({scope:'MAIN_PRIVATE_TERMINAL_GRAPH_JS',projectId:c.projectId,requested:!!c.request,started:c.started,upperJsSettled:c.upperDone,hostStarted:c.hostStarted,hostJsSettled:c.hostDone,actualSettled:c.done,unknown:c.unknown||lowerUnknown(c),activeFrames:c.frames,pendingObservers:c.pending,nativeExecutionAdmitted:false,hostNativeJoined:false,sessionCleanupJoined:false,rosterAuthorityEstablished:false});
 c.handle=frozen({actualSettled:new NativePromise(resolve=>c.resolve=resolve),snapshot});return c;
}
function observe(c,handle,scope,onDone){
 c.pending++;
 c.snapshots.push(handle.snapshot);
 try{
  const p=handle.actualSettled;if(!supportedProviderPromise(p))throw Error('Unsupported actual Promise');
  const secondary=apply(then,p,[value=>{c.frames++;try{const r=data(value);if(!r||!Object.isFrozen(value)||r.actualSettled!==true||r.nativeExecutionAdmitted!==false||(scope&&r.scope!==scope))throw Error('Actual authority mismatch');onDone?.();}catch{c.unknown=true;}finally{c.frames--;}} ,()=>{c.unknown=true;}]);
  if(!supportedProviderPromise(secondary))throw Error('Unsupported observer');
  apply(then,secondary,[()=>{c.pending--;onDone=null;handle=null;c.target?.();},()=>{c.unknown=true;}]);
 }catch{c.unknown=true;}
}

class PrivateTerminalGraph {
 #config;#life;#members;#handles=[];#profileRows=[];#starting=false;#retirementStarted=false;
 constructor(options){
  const p=data(options,['projectId','registry','native','ownership','hostProcessIdentity','creator','cwd','profiles','access','policy','deadlineMs']);
  if(!p||!id(p.projectId)||!p.registry||types.isProxy(p.registry)||Object.getPrototypeOf(p.registry)!==WindowRegistry.prototype||!Number.isInteger(p.deadlineMs)||p.deadlineMs<1||p.deadlineMs>5000)throw TypeError('Private exact graph configuration required');
  apply(registryCurrent,p.registry,[frozen({})]); // Genuine private registry brand, no caller hook.
  const own=callbacks(p.ownership,['isCurrent','onUnavailable','onVerified']),ac=callbacks(p.access,['prepareWorkspace','retireViews','rollbackWorkspace','isReady']),pol=callbacks(p.policy,['isUnlocked','getMode','canExecute']);
  const identity=data(p.hostProcessIdentity,['pid','image','since']),creator=data(p.creator,['executable','entry','directory']);
  const cp=data(p.cwd,['pickDirectory','protectedRoots','inspectDirectory']),pp=data(p.profiles,['grants','getSystemDirectory','inspectExecutable','readEnvironment','privateEnvironmentKeys']);
  const grants=pp&&array(pp.grants,8),roots=cp&&array(cp.protectedRoots,16),privateKeys=pp&&array(pp.privateEnvironmentKeys,128);
  if(!identity||!creator||!cp||!pp||!grants||!roots||!privateKeys||![cp.pickDirectory,cp.inspectDirectory,pp.getSystemDirectory,pp.inspectExecutable,pp.readEnvironment].every(callable))throw TypeError('Captured bounded providers required');
  const keys=new Set();for(const grant of grants){const g=data(grant);if(!g||g.projectId!==p.projectId||!id(g.windowId)||!Number.isSafeInteger(g.epoch)||g.epoch<1||!['workspace','terminal'].includes(g.role)||!Object.isFrozen(grant))throw TypeError('Fixed MAIN grant roster required');const key=JSON.stringify([g.windowId,g.epoch,g.role]);if(keys.has(key))throw TypeError('Duplicate grant context');keys.add(key);}
  const c=this.#life=lifetime(p.projectId);c.target=()=>this.#advance();
  this.#config={...p,ownership:own,access:ac,policy:pol,hostProcessIdentity:frozen(identity),creator:frozen(creator)};
  // All objects/handles below belong to this graph, before explicit native start.
  const owner=new TerminalHostCandidateOwnership({native:p.native,...own});
  const policy=new TerminalPolicy({isCurrentGrant:g=>current(p.registry,p.projectId,g),...pol,isCurrentLease:(...args)=>this.#members?.manager?apply(manager.isCurrentLease,this.#members.manager,args):false});
  const cwdAuthority=new CwdAuthority({...cp,protectedRoots:roots,...cwdCallbacks(p.registry,p.projectId,policy)});
  const providers={getSystemDirectory:pp.getSystemDirectory,inspectExecutable:pp.inspectExecutable,readEnvironment:pp.readEnvironment,privateEnvironmentKeys:privateKeys};
  this.#profileRows=grants.map(grant=>({grant,catalogue:boundCatalogue(grant,providers,p.registry,policy,p.projectId)}));
  this.#members={ownership:owner,policy,cwdAuthority,profileCatalogues:Object.freeze(this.#profileRows.map(r=>r.catalogue)),backend:null,manager:null,router:null,access:null};
  c.snapshots.push(apply(ownership.captureOwnershipSettlement,owner,[]).snapshot,apply(ownership.captureHostShutdownSettlement,owner,[]).snapshot);
  this.#handles.push({object:cwdAuthority,fn:cwd.retireCwd,handle:apply(cwd.captureCwdSettlement,cwdAuthority,[]),scope:'CWD_AUTHORITY'});
  for(const row of this.#profileRows)this.#handles.push({object:row.catalogue,fn:retireShellProfileCatalogue,free:true,handle:captureShellProfileSettlement(row.catalogue),scope:'SHELL_PROFILE_CATALOGUE'});
 }
 captureSettlement(...extra){return extra.length?null:this.#life.handle;}
 mainAuthorities(...extra){return extra.length||this.#life.request||!this.#members?.access?null:frozen(this.#members);}
 start(...extra){
  const c=this.#life;if(extra.length||c.started||c.request)return fail();c.started=true;this.#starting=true;c.frames++;
  try{
   const p=this.#config,m=this.#members,result=apply(ownership.startHost,m.ownership,[{hostProcessIdentity:p.hostProcessIdentity}]);
   if(result.ok!==true||c.request)return fail();
   const b=m.backend=new TerminalProductionBackend({ownership:facade(m.ownership,ownerMethods),hostOwnerId:result.hostOwnerId,creator:p.creator,onUnavailable:()=>{},deadlineMs:p.deadlineMs});
   this.#handles.push({object:b,fn:backend.retireControl,handle:apply(backend.captureControlSettlement,b,[]),scope:'BACKEND_CONTROL_CALLERS'});
   const man=m.manager=new TerminalProductionManager({registry:facade(p.registry,registryMethods),policy:facade(m.policy,{authorize:policyAuthorize}),backend:facade(b,backendMethods),accessReady:p.access.isReady,cwdAuthority:facade(m.cwdAuthority,{resolve:cwdResolve}),profilesFor:profilesLookup(this.#profileRows,p.registry,p.projectId),deadlineMs:p.deadlineMs});
   this.#handles.push({object:man,fn:manager.retireManager,handle:apply(manager.captureManagerSettlement,man,[]),scope:'MANAGER_GLOBAL'});
   const r=m.router=new TerminalRequestRouter({registry:facade(p.registry,registryMethods),manager:facade(man,managerRoutes)});
   this.#handles.push({object:r,fn:router.retireRouter,handle:apply(router.captureRouterSettlement,r,[]),scope:'ROUTER_REQUESTS'});
   const a=m.access=new TerminalProductionAccessTransitions({manager:man,router:r,registry:p.registry,cwdAuthority:m.cwdAuthority,profileCatalogues:m.profileCatalogues,projectId:p.projectId,...p.access,deadlineMs:p.deadlineMs});
   this.#handles.push({object:a,fn:access.retireAccess,handle:apply(access.captureAccessSettlement,a,[]),scope:'ACCESS_TRANSITIONS'});
   return frozen({ok:true,hostOwnerId:result.hostOwnerId,nativeExecutionAdmitted:false});
  }catch{c.unknown=true;return fail();}finally{this.#starting=false;c.frames--;this.#advance();}
 }
 shutdown(value,...extra){
  const r=!extra.length&&request(value),c=this.#life;if(!r||!c.started)return null;
  if(c.request)return ['code','deadlineMs','shutdownId'].every(k=>c.request[k]===r[k])?c.handle.actualSettled:null;
  c.request=r;this.#advance();return c.handle.actualSettled;
 }
 #advance(){
  const c=this.#life;if(!c.request||c.done||this.#starting||c.frames)return;
  if(!this.#retirementStarted){
   this.#retirementStarted=true;c.frames++;
   try{
    // Fence ownership now, but do not request host Stop until every upper join.
    apply(ownership.retireOwnership,this.#members.ownership,[]);
    // Access initiates Session Stop independently of held control CLOSE.
    const ordered=[...this.#handles].reverse();
    for(const row of ordered)try{const h=row.free?row.fn(row.object):apply(row.fn,row.object,[]);if(h!==row.handle)throw Error('Retirement authority changed');observe(c,row.handle,row.scope);}catch{c.unknown=true;}
   }finally{c.frames--;}
  }
  if(c.unknown||c.pending||c.frames)return;
  if(!c.hostStarted){
   c.upperDone=true;c.hostStarted=true;c.frames++;
   try{const owner=this.#members.ownership,handle=apply(ownership.captureHostShutdownSettlement,owner,[]);observe(c,handle,null,()=>{c.hostDone=true;});if(apply(ownership.beginHostShutdown,owner,[c.request])!==handle.actualSettled)c.unknown=true;}catch{c.unknown=true;}finally{c.frames--;}
  }
  if(c.unknown||c.pending||c.frames||!c.hostDone)return;
  c.done=true;c.target=null;c.snapshots=[];this.#config=this.#members=null;this.#handles=[];this.#profileRows=[];const resolve=c.resolve;c.resolve=null;resolve(c.handle.snapshot());
 }
}
export function createTerminalShutdownGraph(options,...extra){if(extra.length)throw TypeError('Exact graph arity required');return new PrivateTerminalGraph(options);}
