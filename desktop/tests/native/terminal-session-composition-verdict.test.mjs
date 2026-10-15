import test from 'node:test';
import assert from 'node:assert/strict';
let isSessionCompositionObserved;
try { ({isSessionCompositionObserved}=await import('./terminal-session-composition-verdict.mjs')); } catch(e) { if(e.code!=='ERR_MODULE_NOT_FOUND')throw e; }
const identity=(pid,alive=true,exitCode=259)=>({pid,image:pid%10===1?'C:\\fixed\\electron.exe':'C:\\fixed\\fixture.exe',createdFileTime:'133000000000000000',alive,exitCode});
function snapshot(base,alive=true,code=259){const held=Array.from({length:5},(_,i)=>identity(base+i,alive,code));return {active:alive?5:0,root:held[0],shell:held[1],held,hostPid:10,killOnClose:true,breakaway:false,inheritable:false,atomicBeforeResume:true,shellMonitorFired:false,shellMonitorTerminated:false};}
function control(negative=false){
 const groups=['A','B','C','D'].map((label,index)=>{
  const base=21+index*10;
  return {label,before:snapshot(base),ready:{workerPid:base,rootPid:base+1,runtime:{electron:'44.5.1',node:'24.21.0',modules:'149',napi:'10',arch:'x64',platform:'win32'},nodePty:'1.1.0',windowsRelease:'10.0.26100',osConpty:true,useConptyDll:false,inputWrites:0,helperListObserved:true,helperExitCode:0,receivedBytes:64,retainedBytes:64,rssBytes:20000000},fixturePids:{root:base+1,branch:base+2,grandchild:base+3,detached:base+4}};
 });
 const stoppedA=snapshot(21,false,77),rootB=snapshot(31,!negative?false:true,!negative?80:259);
 rootB.held[1]={...rootB.held[1],alive:false,exitCode:51};rootB.shell=rootB.held[1];
 if(negative)rootB.active=4;else {rootB.shellMonitorFired=true;rootB.shellMonitorTerminated=true;}
 const cleanupB=structuredClone(rootB);cleanupB.active=0;for(const p of cleanupB.held){p.alive=false;if(p.pid!==32)p.exitCode=negative?98:80;}cleanupB.root=cleanupB.held[0];cleanupB.shell=cleanupB.held[1];
 return {admitted:false,negative,status:'SESSION_COMPOSITION_OBSERVED_NOT_ADMITTED',runtime:{electron:'44.5.1',node:'24.21.0',modules:'149',napi:'10',arch:'x64',platform:'win32'},groups,stoppedA,otherAlive:groups[1].before,stopMs:8,rootB,rootWaitMs:2000,blockedRootMs:2000,hostLoss:{active:0,root:identity(10,false,0),held:[identity(10,false,0),...snapshot(41,false,79).held,...snapshot(51,false,79).held],killOnClose:true,breakaway:false,inheritable:false,monitorFired:true,monitorTerminateSucceeded:true},blockedHostMs:2000,fixtureAgeMs:7000,cleanup:[{label:'A',snapshot:stoppedA,closed:true},{label:'B',snapshot:cleanupB,closed:true},{label:'C',snapshot:snapshot(41,false,79),closed:true},{label:'D',snapshot:snapshot(51,false,79),closed:true}],hostClosed:true};
}
test('accepts finite composed positive and genuine disabled-root-monitor survival control',()=>{
 assert.equal(typeof isSessionCompositionObserved,'function','MISSING_COMPOSITION_CLASSIFIER');
 assert.equal(isSessionCompositionObserved(control(false)),true);
 assert.equal(isSessionCompositionObserved(control(true)),true);
});
test('rejects broken native identity, isolation, timing, platform or cleanup observations',()=>{
 assert.equal(typeof isSessionCompositionObserved,'function','MISSING_COMPOSITION_CLASSIFIER');
 const mutations=[r=>r.groups.pop(),r=>r.groups[0].before.atomicBeforeResume=false,r=>r.groups[0].before.breakaway=true,r=>r.groups[0].before.inheritable=true,r=>r.groups[0].ready.inputWrites=1,r=>r.groups[0].ready.useConptyDll=true,r=>r.groups[0].ready.runtime.electron='0',r=>r.groups[0].fixturePids.branch=999,r=>r.stoppedA.held[0].alive=true,r=>r.otherAlive.held[1].createdFileTime='1',r=>r.rootB.shellMonitorTerminated=false,r=>r.rootB.held[1].exitCode=0,r=>r.blockedRootMs=0,r=>r.fixtureAgeMs=12000,r=>r.stopMs=3000,r=>r.hostLoss.monitorTerminateSucceeded=false,r=>r.hostLoss.held.pop(),r=>r.hostLoss.held[1].alive=true,r=>r.cleanup[2].closed=false,r=>r.cleanup[0].snapshot.held[0].pid=777,r=>r.hostClosed=false,r=>r.admitted=true];
 for(const mutate of mutations){const r=control();mutate(r);assert.equal(isSessionCompositionObserved(r),false,mutate.toString());}
 for(const mutate of [r=>r.rootB.held[2].alive=false,r=>r.rootB.shellMonitorTerminated=true,r=>r.rootB.root.alive=false]){const r=control(true);mutate(r);assert.equal(isSessionCompositionObserved(r),false);}
});
