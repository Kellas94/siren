// Separate test dependency seams; preserves the earlier frozen fixture.
// SYNTHETIC role-neutral PRIVATE policy over genuine WindowRegistry grants.
// Actual backend/creator/channel/ledger JS; no Terminal role or native admission.
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {TerminalPolicy} from '../../src/terminal/policy.mjs';
import {TerminalProductionManager} from '../../src/terminal/production-manager.mjs';
import {createInertProductionComposition,inertConfig,inertTick} from './terminal-production-inert.mjs';
export {inertTick};
export const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
export async function until(predicate,label){for(let i=0;i<400&&!predicate();i++)await inertTick();assert(predicate(),label);}
class SyntheticWindow extends EventEmitter {
 constructor(){super();this.id=902;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:1902,mainFrame:{url:'siren://app/app.html'},isDestroyed:()=>false,getURL:()=>this.webContents.mainFrame.url});}
 isDestroyed(){return false;}isMinimized(){return false;}focus(){}restore(){}
}
export function privateManager(options={}){
 const composition=createInertProductionComposition({deadlineMs:1000,...options.inert}),window=new SyntheticWindow(),access={unlocked:true,transition:false,mode:'normal'},guards=[],calls=Object.create(null),seen=[];
 const registry=new WindowRegistry({createWindow:()=>{throw Error('No native satellite');},authorize:()=>({projectId:'project1',mode:access.mode,access:'write',entityIds:[]})});registry.bindWorkspace(window);registry.activateWorkspace();
 const capture=()=>registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame});let grant=capture(),manager,sequence=0,h;
 const observedRegistry={isCurrent:g=>options.onCurrent?options.onCurrent(g,h):registry.isCurrent(g),captureAdmissionGuard:g=>{options.onCapture?.(g,h);const original=registry.captureAdmissionGuard(g),bit={current:true};guards.push(bit);return Object.freeze({isCurrent:()=>bit.current&&original.isCurrent()});}};
 const realPolicy=new TerminalPolicy({isCurrentGrant:g=>registry.isCurrent(g),isUnlocked:()=>access.unlocked,getMode:()=>access.mode,canExecute:()=>true,isCurrentLease:(l,g,s)=>manager?.isCurrentLease(l,g,s)===true});
 const policy=options.realPolicy?realPolicy:{authorize:q=>{
  calls.policy=(calls.policy??0)+1;
  if(!registry.isCurrent(q.grant))return {ok:false,code:'SENDER_REFUSED'};
  if(!access.unlocked)return {ok:false,code:'PIN_REQUIRED'};if(access.transition||access.mode!=='normal')return {ok:false,code:'READONLY'};
  if(q.epoch!==q.grant.epoch)return {ok:false,code:'EPOCH_STALE'};
  if(['terminalAttach','terminalInput','terminalResize','terminalAck','terminalDetach','terminalStop'].includes(q.method)&&(!q.session||q.session.projectId!==q.grant.projectId))return {ok:false,code:'SESSION_REFUSED'};
  if(['terminalInput','terminalResize','terminalAck','terminalDetach'].includes(q.method)&&manager.isCurrentLease(q.lease,q.grant,q.session)!==true)return {ok:false,code:'LEASE_STALE'};
  const result=options.onPolicy?.(q,h);return result===undefined?{ok:true}:result;
 }};
 const backend=Object.create(null);
 for(const name of ['prepare','allocate','connect','stopSession','sessionStatus','captureBackendSettlement','captureControlSettlement','retireControl','sendGate','isAvailable','subscribeUnavailable','install','revoke','input','resize','readHistory'])backend[name]=(...args)=>{
  calls[name]=(calls[name]??0)+1;const invoke=(replacement=args)=>Reflect.apply(composition.backend[name],composition.backend,replacement);
  return options.wrap?.[name]?options.wrap[name]({args,invoke,h}):invoke();
 };
 const config=inertConfig();manager=new TerminalProductionManager({registry:observedRegistry,policy,backend,accessReady:()=>options.onReady?options.onReady(h):access.unlocked&&!access.transition&&access.mode==='normal',cwdAuthority:{resolve:()=>options.cwd?options.cwd(config.cwd):Promise.resolve(config.cwd)},profilesFor:()=>({resolveShellProfile:()=>options.shell?options.shell(config.shell):Promise.resolve(config.shell)}),deadlineMs:options.deadlineMs??1000});
 const packet=(sessionId,extra={},g=grant)=>({operationId:'private_'+ ++sequence,epoch:g.epoch,sessionId,...extra});
 const leasePacket=(lease,extra={},g=grant)=>packet(lease.session.sessionId,{leaseId:lease.leaseId,generation:lease.generation,...extra},g);
 h={composition,window,registry,observedRegistry,realPolicy,policy,manager,access,calls,guards,seen,packet,leasePacket,capture,
  get grant(){return grant;},refresh(){grant=capture();return grant;},
  async ready(text='AΩ😀'){assert.equal((await manager.resumeInput()).ok,true);const made=await manager.create(grant,{operationId:'create_'+ ++sequence,epoch:grant.epoch,cwdId:'cwd1',profileId:'powershell',cols:120,rows:40});assert.equal(made.ok,true);if(text)composition.emitOutput(made.value.sessionId,text);return made.value;},
  attach:session=>manager.attach(grant,packet(session.sessionId)),
  input:(lease,n=0,data='hello',g=grant)=>manager.input(g,leasePacket(lease,{inputSequence:n,data},g)),
  resize:(lease,cols=90,rows=30)=>manager.resize(grant,leasePacket(lease,{cols,rows})),
  detach:lease=>manager.detach(grant,leasePacket(lease)),
  ack:(lease,end)=>manager.ack(grant,leasePacket(lease,{throughSequence:end})),
  observe:frame=>{seen.push(frame);},
  deliver:(lease,observer=frame=>{seen.push(frame);})=>manager.deliverAvailable(grant,leasePacket(lease),observer),
  async end(){composition.releaseWrites();composition.releaseReads();await manager.closeInput('synthetic cleanup');await composition.dispose();}
 };return h;
}
