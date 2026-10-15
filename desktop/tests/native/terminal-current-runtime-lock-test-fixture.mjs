// INERT finite test only. Real current JS authority classes, synthetic windows,
// byte transport, process observations and fixture files. Never native proof.
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {win32 as path} from 'node:path';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {TerminalPolicy} from '../../src/terminal/policy.mjs';
import {CwdAuthority} from '../../src/terminal/cwd.mjs';
import {TerminalProfileCatalogueOwner} from '../../src/terminal/profile-catalogue-owner.mjs';
import {TerminalProductionManager} from '../../src/terminal/production-manager.mjs';
import {TerminalRequestRouter} from '../../src/terminal/request-router.mjs';
import {TerminalProductionAccessTransitions} from '../../src/terminal/production-access-transitions.mjs';
import {createInertProductionComposition,inertTick} from '../fixtures/terminal-production-inert.mjs';
import {createLockContinuationFixture} from './terminal-session-command.mjs';
let ids=5000;
class InertWindow extends EventEmitter{
 constructor(url){super();this.id=++ids;this.dead=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:++ids,mainFrame:{url},isDestroyed:()=>this.dead,getURL:()=>url});}
 isDestroyed(){return this.dead;}isMinimized(){return false;}focus(){}restore(){}
 close(){this.destroy();}
 destroy(){this.dead=true;this.webContents.emit('destroyed');this.emit('closed');}
}
function directory(p){p=path.normalize(p);const root=path.parse(p).root,ancestors=[{path:root,identity:root,directory:true,reparse:false}];let part=root;for(const name of p.slice(root.length).split('\\').filter(Boolean)){part=path.join(part,name);ancestors.push({path:part,identity:part,directory:true,reparse:false});}return {canonicalPath:p,identity:p,directory:true,reparse:false,ancestors};}
const executable=p=>({canonicalPath:p,identity:p,file:true,reparse:false,ancestors:directory(path.dirname(p)).ancestors});
export function syntheticFourJoinObservation(){
 const identity=n=>({pid:n,image:'C:\\Runtime\\p'+n+'.exe',createdFileTime:String(1000+n)}),live=n=>({...identity(n),alive:true,exitCode:259}),dead=n=>({...identity(n),alive:false,exitCode:77});
 const expected=[1,2,3,4].map(identity),beforeSession={root:live(3),shell:live(4),held:[live(3),live(4)]};
 return {code:77,graph:{actualSettled:true,unknown:false,hostNativeJoined:false,sessionCleanupJoined:false},beforeSession,sessionReceipts:[{closed:true,snapshot:{active:0,root:dead(3),shell:dead(4),held:[dead(3),dead(4)]}}],hostReceipt:{closed:true,code:77,snapshot:{active:0,root:dead(1),held:[dead(1)]}},checked:{ok:true,actualSettlementEstablished:false},expected,external:{status:'EXACT_HELD_PROCESSES_EXITED',before:expected.map(p=>({...p,wait:258,exitCode:259})),after:expected.map(p=>({...p,wait:0,exitCode:77}))},externalExit:{code:0,signal:null},utilityExit:77};
}
export async function currentLockFixture(options={}){
 const composition=createInertProductionComposition({deadlineMs:1000}),windows=[],entities=[],grants=new Map(),state={locked:false},trace=[],files=new Map(),projectDirectory='C:\\Project Ω Space',token='a'.repeat(32);
 const event=w=>({sender:w.webContents,senderFrame:w.webContents.mainFrame});
 const registry=new WindowRegistry({terminalViews:true,authorize:()=>({projectId:'project1',mode:'normal',access:'write',entityIds:entities}),createWindow:o=>{const w=new InertWindow(o.mainFrameUrl);windows.push(w);return w;}});
 const main=new InertWindow('siren://app/app.html');windows.push(main);registry.bindWorkspace(main);registry.activateWorkspace();let manager;
 const workspace=()=>({event:event(main),grant:registry.capture(event(main))});
 const policy=new TerminalPolicy({isCurrentGrant:g=>registry.isCurrent(g),isUnlocked:()=>!state.locked,getMode:()=> 'normal',isCurrentLease:(...args)=>manager.isCurrentLease(...args),canExecute:g=>{grants.set(g.windowId,g);return true;}});
 const cwdAuthority=new CwdAuthority({pickDirectory:async()=>({canceled:false,filePaths:[projectDirectory]}),inspectDirectory:async p=>directory(p),protectedRoots:['C:\\Protected'],authorize:(g,m)=>registry.isCurrent(g)&&policy.authorize({grant:g,method:m,epoch:g.epoch}).ok===true,captureAdmission:g=>registry.captureAdmissionGuard(g)});
 const profileCatalogueOwner=new TerminalProfileCatalogueOwner({registry,policy,projectId:'project1',grants:[workspace().grant],providers:{getSystemDirectory:async()=> 'C:\\Windows\\System32',inspectExecutable:async p=>executable(p),readEnvironment:async()=>({SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32'}),privateEnvironmentKeys:[]}});
 manager=new TerminalProductionManager({registry,policy,backend:composition.backend,cwdAuthority,profilesFor:g=>profileCatalogueOwner.forGrant(g),accessReady:()=>!state.locked,deadlineMs:1000});
 const router=new TerminalRequestRouter({registry,manager});
 const access=new TerminalProductionAccessTransitions({manager,router,registry,cwdAuthority,profileCatalogues:profileCatalogueOwner,prepareWorkspace:async()=>{trace.push('prepare');},retireViews:async()=>{trace.push('retire');for(const w of windows)if(w!==main&&!w.dead)w.destroy();},rollbackWorkspace:async()=>{trace.push('rollback');},isReady:()=>true,projectId:'project1',deadlineMs:1000});
 const members={manager,access,cwdAuthority,profileCatalogueOwner,backend:composition.backend,ownership:composition.ownership},request=(g,extra={})=>({operationId:'fixture_'+ ++ids,epoch:g.epoch,...extra});
 assert.equal((await access.beginLock('initial fixture')).ok,true);assert.equal((await access.reopen(event(main))).ok,true);
 async function attach(sessionId){const record=await registry.openView({role:'terminal',entityId:sessionId}),w=windows.find(w=>!w.dead&&w.webContents.getURL()===`siren://app/windows/terminal.html?windowId=${record.windowId}`),r=access.currentRouter(),g=registry.capture(event(w));const reply=await r.route({event:event(w),method:'terminalAttach',payload:request(g,{sessionId})});assert.equal(reply.ok,true,reply.code);return {caller:event(w),grant:grants.get(record.windowId),router:r,lease:{sessionId,leaseId:reply.value.leaseId,generation:reply.value.generation}};}
 const fixture=createLockContinuationFixture({projectDirectory,token});let sessionId;
 const io={record:async(name,value)=>{trace.push(name);options.record?.(name,value);},absent:async p=>{assert.equal(files.has(p),false,'INERT_EXPECTED_ABSENT:'+p);},waitFile:async(p,value)=>{
  if(p===fixture.startedPath){assert.equal(composition.state.writes.at(-1),fixture.input);files.set(p,value);trace.push('started');}
  if(options.failWait===p)throw Error('FIXTURE_FILE_DEADLINE');
  assert.equal(files.get(p),value,'INERT_TOKEN_MISMATCH');return files.get(p);
 },writeExclusive:async(p,value)=>{assert.equal(p,fixture.releasePath);assert.equal(state.locked,true);assert.equal(manager.stats().inputClosed,true);assert.equal(files.has(p),false);files.set(p,value);files.set(fixture.completedPath,value);trace.push('inert-completion-while-locked');if(!options.omitMarker)composition.emitOutput(sessionId,'SIREN_LOCK_CONTINUATION_COMPLETE\r\n');},delay:async()=>inertTick()};
 return {members,workspace,attach,composition,registry,state,trace,files,fixture,projectDirectory,token,
  async prepare(discover){const discovery=await discover({members,workspace}),w=workspace(),created=await access.currentRouter().route({event:w.event,method:'terminalCreate',payload:request(w.grant,{cwdId:discovery.cwd.cwdId,profileId:'powershell',cols:120,rows:40})});assert.equal(created.ok,true,created.code);sessionId=created.value.sessionId;entities.push(sessionId);const first=await attach(sessionId);trace.length=0;return {members,workspace,first,sessionId,projectDirectory,token,io,beforeInput:async()=>{trace.push('private-preinput-double');const g=composition.group(sessionId);return {inputAuthorized:options.refuseInput!==true,isCurrent:()=>options.revokedPermit!==true,beforeSession:{root:{...g.root,alive:!g.nativeExited},shell:{...g.shell,alive:!g.nativeExited}}};},observeRunning:async()=>{const g=composition.group(sessionId);return {sessionId,sessionStopCalls:composition.state.trace.filter(r=>r.name==='native-stop').length,hostStopCalls:0,session:{root:{...g.root,alive:!g.nativeExited},shell:{...g.shell,alive:!g.nativeExited}}};},setLocked:v=>{state.locked=v;trace.push(v?'locked':'unlocked');},attach,cleanup:async()=>{trace.push('synthetic-cleanup-data');return options.cleanup??syntheticFourJoinObservation();}};},
  async dispose(){composition.releaseWrites();composition.releaseReads();await manager.closeInput('inert teardown');await composition.dispose();profileCatalogueOwner.retire();for(const w of windows)if(!w.dead)w.destroy();}
 };
}
