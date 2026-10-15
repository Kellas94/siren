import assert from 'node:assert/strict';
import {test} from 'node:test';
import {isExpectedLifetimeRefusal,isLifetimeComplete} from './terminal-job-lifetime-verdict.mjs';
const identity={addonSha256:'positive',metricsSha256:'metrics'};
const runtime={versions:{electron:'44.5.1',modules:'149',napi:'10'},arch:'x64'};
const common={exitObserved:true,exitCode:0,addonUnchanged:true,metricsUnchanged:true,addonSha256:'positive',addonReadbackSha256:'positive',metricsSha256:'metrics',metricsReadbackSha256:'metrics'};
const observations={opened:2129,closed:2129,verifiedDestroyed:2129,simultaneouslyHeldOpen:128};
const positive={...common,status:'PREREQUISITE_PASSED',native:{main:{status:'PRIMITIVE_PASSED',runtime,observations},host:{status:'PRIMITIVE_PASSED',runtime,observations},hostExitCode:0}};
const negative={...common,status:'FAILED',exitCode:1,native:{main:{status:'FAILED',runtime,observations:{opened:1,closed:1,verifiedDestroyed:0,afterCanaryClose:{ownerOpen:false,objectExists:true}},error:{message:'JOB_LIFETIME_RETAINED'}}}};
test('OS retained-object negative is accepted only as expected failure',()=>{
 assert.equal(isExpectedLifetimeRefusal(negative,identity),true);assert.equal(isExpectedLifetimeRefusal(positive,identity),false);
 const mutate=[r=>r.exitCode=0,r=>r.exitObserved=false,r=>r.outerDeadlineExceeded=true,r=>r.native.deadlineExceeded=true,r=>r.addonUnchanged=false,r=>r.metricsUnchanged=false,r=>r.addonSha256='other',r=>r.addonReadbackSha256='other',r=>r.metricsSha256='other',r=>r.metricsReadbackSha256='other',r=>r.native.main.error.message='MODULE_NOT_FOUND',r=>r.native.main.observations.afterCanaryClose.objectExists=false,r=>r.native.main.observations.opened=2,r=>r.native.main.runtime.versions.electron='other'];
 for(const change of mutate){const r=structuredClone(negative);change(r);assert.equal(isExpectedLifetimeRefusal(r,identity),false);}
});
test('positive requires both actual runtimes, all closed objects and binary identities',()=>{
 assert.equal(isLifetimeComplete(positive,identity),true);assert.equal(isLifetimeComplete(negative,identity),false);
 for(const change of [r=>r.native.host.observations.verifiedDestroyed--,r=>r.native.main.observations.closed--,r=>r.native.hostExitCode=1,r=>r.outerDeadlineExceeded=true,r=>r.metricsReadbackSha256='other',r=>r.native.main.runtime.arch='ia32']){const r=structuredClone(positive);change(r);assert.equal(isLifetimeComplete(r,identity),false);}
});
