import test from 'node:test';
import assert from 'node:assert/strict';
import {isHostGuardComplete,isExpectedHostMonitorRefusal} from './terminal-host-guard-verdict.mjs';
const expected={addonSha256:'a'.repeat(64),runnerSha256:'b'.repeat(64),executableSha256:'c'.repeat(64)};
const members=(base)=>Array.from({length:5},(_,i)=>({pid:base+i,image:i?'fixture.exe':'electron.exe',createdFileTime:String(1000+base+i),alive:true,exitCode:259}));
const snapshot=(base)=>({active:5,root:members(base)[0],held:members(base),killOnClose:true,breakaway:false,inheritable:false,monitorFired:false,monitorTerminateSucceeded:false});
function sample(negative=false){
 const a=snapshot(10),b=snapshot(20),stop=structuredClone(a),after=structuredClone(b);
 stop.active=0;stop.root.alive=false;stop.root.exitCode=77;stop.held.forEach(p=>{p.alive=false;p.exitCode=77;});
 after.root.alive=false;after.root.exitCode=0;after.held[0].alive=false;after.held[0].exitCode=0;
 if(!negative){after.active=0;after.monitorFired=true;after.monitorTerminateSucceeded=true;after.held.slice(1).forEach(p=>{p.alive=false;p.exitCode=79;});}else after.active=4;
 const cleaned=structuredClone(after);cleaned.active=0;cleaned.held.slice(1).forEach(p=>{p.alive=false;p.exitCode=negative?98:79;});
 return {...expected,addonReadbackSha256:expected.addonSha256,addonUnchanged:true,exitObserved:true,exitCode:negative?1:0,status:negative?'FAILED':'HOST_GUARD_PASSED',native:{status:negative?'FAILED':'HOST_GUARD_PASSED',runtime:{versions:{electron:'44.5.1',node:'24.21.0',modules:'149',napi:'10'},arch:'x64'},cases:[{captured:a,fixturePids:{root:11,branch:12,grandchild:13,detached:14}},{captured:b,fixturePids:{root:21,branch:22,grandchild:23,detached:24}}],stop,otherHostStillAlive:b,afterBlockedHostExit:after,blockedMs:2000,cleanup:[{verified:true,snapshot:stop},{verified:true,snapshot:cleaned}],...(negative?{error:{code:'ERR_ASSERTION',message:'HOST_DEATH_LEFT_OWNED_DESCENDANTS'}}:{})}};
}
test('host monitor qualification rejects missing held exits, wrong identities and deadline rescue',()=>{
 assert.equal(isHostGuardComplete(sample(),expected),true);
 for(const mutate of [r=>r.exitObserved=false,r=>r.outerDeadlineExceeded=true,r=>r.exitCode=1,r=>r.addonUnchanged=false,r=>r.addonReadbackSha256='d'.repeat(64),r=>r.native.afterBlockedHostExit.active=1,r=>r.native.afterBlockedHostExit.held[4].alive=true,r=>r.native.afterBlockedHostExit.held[4].createdFileTime='9999',r=>r.native.afterBlockedHostExit.monitorFired=false,r=>r.native.afterBlockedHostExit.monitorTerminateSucceeded=false,r=>r.native.stop.held[3].exitCode=0,r=>r.native.otherHostStillAlive.held[2].alive=false,r=>r.native.cleanup[1].verified=false,r=>r.native.blockedMs=12000,r=>r.native.runtime.versions.modules='148',r=>r.native.cases[1].fixturePids.detached=222]){
  const r=sample();mutate(r);assert.equal(isHostGuardComplete(r,expected),false);
 }
});
test('disabled monitor control requires real surviving fixed descendants and verified cleanup',()=>{
 assert.equal(isExpectedHostMonitorRefusal(sample(true),expected),true);
 for(const mutate of [r=>r.native.error.message='MODULE_NOT_FOUND',r=>r.exitObserved=false,r=>r.exitCode=0,r=>r.outerDeadlineExceeded=true,r=>r.native.afterBlockedHostExit.root.alive=true,r=>r.native.afterBlockedHostExit.held[4].alive=false,r=>r.native.afterBlockedHostExit.monitorFired=true,r=>r.native.cleanup[1].snapshot.held[4].alive=true,r=>r.native.cleanup.pop(),r=>r.runnerSha256='d'.repeat(64)]){
  const r=sample(true);mutate(r);assert.equal(isExpectedHostMonitorRefusal(r,expected),false);
 }
 assert.equal(isExpectedHostMonitorRefusal(sample(),expected),false);
});

// A fixture root/console helper may already have exited when its utility host
// exits. The mandatory branch, grandchild and detached process remain the
// causal canaries; the original hosted failure is retained separately.
test('negative accepts a previously exited fixture root but requires three surviving canaries',()=>{
 const r=sample(true),s=r.native.afterBlockedHostExit;
 s.held[1].alive=false;s.held[1].exitCode=0;s.active--;
 r.native.cleanup[1].snapshot.held[1].exitCode=0;
 assert.equal(isExpectedHostMonitorRefusal(r,expected),true);
});
test('positive accepts fixture root exit zero with all three canaries terminated by monitor79',()=>{
 const r=sample();r.native.afterBlockedHostExit.held[1].exitCode=0;r.native.cleanup[1].snapshot.held[1].exitCode=0;
 assert.equal(isHostGuardComplete(r,expected),true);
 for(const i of [2,3,4]){const changed=structuredClone(r);changed.native.afterBlockedHostExit.held[i].exitCode=0;assert.equal(isHostGuardComplete(changed,expected),false);}
});
test('negative cleanup must terminate each still-live captured member with code98',()=>{
 for(const i of [1,2,3,4]){const r=sample(true);r.native.cleanup[1].snapshot.held[i].exitCode=0;assert.equal(isExpectedHostMonitorRefusal(r,expected),false);}
});
test('snapshot root identity and held root state cannot disagree',()=>{
 for(const mutate of [r=>r.native.stop.root.createdFileTime='9999',r=>r.native.cleanup[1].snapshot.root.image='other.exe',r=>r.native.afterBlockedHostExit.held[0].exitCode=79]){const r=sample();mutate(r);assert.equal(isHostGuardComplete(r,expected),false);}
});
test('failed Stop requires an explicit live unchanged retryable owner before native host cleanup',async()=>{
 const {isFailedStopGuardComplete,isExpectedFailedStopMonitorRefusal}=await import('./terminal-host-guard-verdict.mjs');
 assert.equal(typeof isFailedStopGuardComplete,'function');assert.equal(typeof isExpectedFailedStopMonitorRefusal,'function');
 const r=sample();r.stopFailureControl=true;r.native.failedStop={code:'OWNERSHIP_STOP_FAILED',snapshot:structuredClone(r.native.otherHostStillAlive)};
 r.native.failedStop.snapshot.stopping=false;r.native.failedStop.snapshot.injectedStopFailures=1;
 assert.equal(isFailedStopGuardComplete(r,expected),true);
 for(const mutate of [x=>delete x.native.failedStop,x=>x.native.failedStop.code='OTHER',x=>x.native.failedStop.snapshot.stopping=true,x=>x.native.failedStop.snapshot.held[3].alive=false,x=>x.stopFailureControl=false]){const bad=structuredClone(r);mutate(bad);assert.equal(isFailedStopGuardComplete(bad,expected),false);}
 const legacy=sample(true);legacy.stopFailureControl=true;legacy.native.failedStop={code:'OWNERSHIP_STOP_FAILED',snapshot:structuredClone(legacy.native.otherHostStillAlive)};legacy.native.failedStop.snapshot.stopping=true;legacy.native.failedStop.snapshot.injectedStopFailures=1;legacy.native.afterBlockedHostExit.monitorFired=true;
 assert.equal(isExpectedFailedStopMonitorRefusal(legacy,expected),true);
 legacy.native.cleanup[1].snapshot.held[4].exitCode=0;assert.equal(isExpectedFailedStopMonitorRefusal(legacy,expected),false);
});
