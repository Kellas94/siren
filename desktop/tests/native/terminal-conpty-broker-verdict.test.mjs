import test from 'node:test';
import assert from 'node:assert/strict';
const {isConptyBrokerObserved,isExpectedConptyBrokerRefusal}=await import('./terminal-conpty-broker-verdict.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
function fixture(negative=false){
 const image='C:/fixed/study.exe',helper='C:/Windows/System32/conhost.exe';
 const before=Array.from({length:12},(_,n)=>{const pid=n+1,a=[1,3,4,5,6,11].includes(pid);return {pid,image:pid>10?helper:image,createdFileTime:String(1000+pid),alive:true,exitCode:259,inA:a&&!negative,inB:!a};});
 const after=before.map(p=>({...p,...(p.inA?{alive:false,exitCode:77}:{})}));
 return {negative,status:negative?'EXPECTED_BROKER_SESSION_ASSIGNMENT_REFUSED':'CONPTY_BROKER_CONTAINMENT_OBSERVED_TERMINAL_NOT_ADMITTED',pseudoConsoles:2,fixtureImage:image,systemConhostImage:helper,workerPids:{A:1,B:2},workerBeforeResume:{A:!negative,B:true},rootPids:{A:3,B:7},rootBeforeResume:{A:!negative,B:true},fixturePids:{A:[3,4,5,6],B:[7,8,9,10]},hostActiveBefore:12,before,after,stopMs:negative?2001:8,fixtureAgeMs:negative?2400:400,...(!negative?{sessionActiveAfterStop:0,stopWaits:before.filter(p=>p.inA).map(p=>({pid:p.pid,initialWait:258,finalWait:0,elapsedMs:7}))}:{}),cleanup:{verified:true,active:0,held:after.map(p=>({...p,alive:false,exitCode:p.alive?98:p.exitCode}))}};
}
test('fixed per-HPCON worker controls qualify only their observed Safety universe',()=>{
 assert.equal(typeof isConptyBrokerObserved,'function');assert.equal(typeof isExpectedConptyBrokerRefusal,'function');
 assert.equal(isConptyBrokerObserved(fixture()),true);assert.equal(isExpectedConptyBrokerRefusal(fixture(true)),true);
 assert.equal(isConptyBrokerObserved(fixture(true)),false);assert.equal(isExpectedConptyBrokerRefusal(fixture()),false);
});
test('pre-creation worker and inherited root membership are required independently',()=>{
 for(const field of ['workerBeforeResume','rootBeforeResume'])for(const label of ['A','B']){const r=fixture();r[field][label]=false;assert.equal(isConptyBrokerObserved(r),false);}
 const r=fixture();r.before[0].inA=false;r.after[0].inA=false;r.cleanup.held[0].inA=false;assert.equal(isConptyBrokerObserved(r),false);
});
test('a positive cannot omit, overlap, invent or leave a helper outside both Sessions',()=>{
 for(const mutate of [r=>{r.before.pop();},r=>{r.workerPids.B=1;},r=>{r.fixturePids.B[0]=3;},r=>{r.before[10].image='C:/unknown.exe';},r=>{for(const rows of [r.before,r.after,r.cleanup.held])rows[10].inA=false;},r=>{r.before[10].inB=true;}]){const r=fixture();mutate(r);assert.equal(isConptyBrokerObserved(r),false);}
});
test('Stop needs complete held-A wait receipts, exact77, B live, shared deadline and stable identities',()=>{
 for(const mutate of [r=>{r.stopWaits.pop();},r=>{r.stopWaits[0].finalWait=258;},r=>{r.stopWaits[0].pid=999;},r=>{r.after[0].exitCode=0;},r=>{r.after[1].alive=false;},r=>{r.stopMs=3000;},r=>{r.fixtureAgeMs=6000;},r=>{r.stopWaits[0].elapsedMs=9;},r=>{r.after[0].createdFileTime='99999';},r=>{r.sessionActiveAfterStop=1;}]){const r=fixture();mutate(r);assert.equal(isConptyBrokerObserved(r),false);}
});
test('negative omits only A containment, survives2s and verifies exact98 cleanup',()=>{
 for(const mutate of [r=>{r.stopMs=1999;},r=>{r.before[0].inA=true;},r=>{r.after[0].alive=false;},r=>{r.workerBeforeResume.B=false;},r=>{r.cleanup.held[0].exitCode=0;},r=>{r.cleanup.verified=false;},r=>{r.cleanup.active=1;}]){const r=fixture(true);mutate(r);assert.equal(isExpectedConptyBrokerRefusal(r),false);}
});
test('malformed or incomplete observations cannot qualify',()=>{
 for(const r of [null,{},[],{negative:false,status:'PASS'}, {...fixture(),before:[null]}])assert.equal(isConptyBrokerObserved(r),false);
});
