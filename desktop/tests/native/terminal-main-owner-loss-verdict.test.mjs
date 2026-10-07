import test from 'node:test';
import assert from 'node:assert/strict';
import {isMainOwnerLossComplete,isExpectedMainOwnerLossRefusal} from './terminal-main-owner-loss-verdict.mjs';
const process=(pid,alive=true,exitCode=259)=>({pid,image:'fixed.exe',createdFileTime:String(100000+pid),alive,exitCode});
function receipt(negative=false){
 const held=Array.from({length:11},(_,i)=>process(i+1)),after=structuredClone(held),cleaned=structuredClone(held);
 after[0].alive=false;after[0].exitCode=101;
 if(!negative)for(const p of after.slice(1)){p.alive=false;p.exitCode=0;}
 for(const p of cleaned){p.alive=false;p.exitCode=after.find(a=>a.pid===p.pid).alive?98:after.find(a=>a.pid===p.pid).exitCode;}
 return {status:negative?'EXPECTED_OWNED_FAMILY_SURVIVED':'MAIN_OWNER_LOSS_PASSED',guardEnabled:!negative,main:held[0],mainExit:{...after[0]},held,before:structuredClone(held),after,cleanup:{verified:true,active:0,held:cleaned},groups:[{hostPid:2,fixturePids:{root:3,branch:4,grandchild:5,detached:6},requiredPids:[2,3,4,5,6]},{hostPid:7,fixturePids:{root:8,branch:9,grandchild:10,detached:11},requiredPids:[7,8,9,10,11]}],requiredPids:held.slice(1).map(p=>p.pid),canaryPids:[4,5,6,9,10,11],mainTerminationCode:101,safetyJobStillOpenAtObservation:true,fixtureAgeMs:2800,observeMs:2000,mainExitObserved:true,outerExitObserved:true,outerExitCode:negative?1:0};
}
test('main owner loss requires held identities gone before external safety cleanup',()=>{
 assert.equal(isMainOwnerLossComplete(receipt(),false),true);
 for(const mutate of [r=>r.after[5].alive=true,r=>r.after[4].createdFileTime='999',r=>r.after[3].image='other.exe',r=>r.mainExit.exitCode=0,r=>r.mainExitObserved=false,r=>r.safetyJobStillOpenAtObservation=false,r=>r.fixtureAgeMs=12000,r=>r.requiredPids.pop(),r=>r.outerExitObserved=false,r=>r.cleanup.active=1,r=>r.cleanup.held[5].alive=true]){const r=receipt();mutate(r);assert.equal(isMainOwnerLossComplete(r,false),false);}
});
test('omitted root guard negative retains causal canaries until explicit safety98 cleanup',()=>{
 assert.equal(isExpectedMainOwnerLossRefusal(receipt(true),true),true);
 for(const mutate of [r=>r.canaryPids.pop(),r=>r.after[5].alive=false,r=>r.cleanup.held[4].exitCode=0,r=>r.guardEnabled=true,r=>r.outerExitCode=0,r=>r.mainExit.exitCode=0,r=>r.observeMs=0,r=>r.before[5].alive=false,r=>r.cleanup.verified=false]){const r=receipt(true);mutate(r);assert.equal(isExpectedMainOwnerLossRefusal(r,true),false);}
 assert.equal(isExpectedMainOwnerLossRefusal(receipt(),true),false);
});
