import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {deriveClassicMainLossObserver} from './terminal-main-owner-loss-observer-derive.mjs';
import {isMainOwnerLossComplete,isExpectedMainOwnerLossRefusal} from './terminal-main-owner-loss-verdict.mjs';
const row=(pid,alive=true,exitCode=259)=>({pid,image:'fixed.exe',createdFileTime:String(100000+pid),alive,exitCode});
function sample(negative=false){
 const held=Array.from({length:11},(_,i)=>row(i+1)),after=held.map(p=>p.pid===1?row(1,false,101):negative?{...p}:row(p.pid,false,0));
 const result={status:negative?'EXPECTED_OWNED_FAMILY_SURVIVED':'MAIN_OWNER_LOSS_PASSED',guardEnabled:!negative,main:held[0],mainExit:after[0],held,before:structuredClone(held),after,cleanup:{verified:true,active:0,held:after.map(p=>p.alive?row(p.pid,false,98):{...p})},groups:[{hostPid:2,fixturePids:{root:3,branch:4,grandchild:5,detached:6},requiredPids:[2,3,4,5,6]},{hostPid:7,fixturePids:{root:8,branch:9,grandchild:10,detached:11},requiredPids:[7,8,9,10,11]}],requiredPids:held.slice(1).map(p=>p.pid),canaryPids:[4,5,6,9,10,11],mainTerminationCode:101,safetyJobStillOpenAtObservation:true,fixtureAgeMs:2800,observeMs:2000,mainExitObserved:true,outerExitObserved:true,outerExitCode:negative?1:0};
 if(!negative)for(const g of result.groups)g.captured={killOnClose:true,breakaway:false,inheritable:false,active:g.requiredPids.length,held:held.filter(p=>g.requiredPids.includes(p.pid)).map(p=>({...p}))};return result;
}
test('positive captured members must exactly match the declared required group',()=>{
 const r=sample(),extra=row(99);r.held.push(extra);r.before.push({...extra});r.after.push({...extra});r.cleanup.held.push(row(99,false,98));r.groups[0].captured.held.push({...extra});r.groups[0].captured.active++;assert.equal(isMainOwnerLossComplete(r),false);
});
test('capture limit flags, accounting and native identities cannot be ignored',()=>{
 for(const mutate of [g=>delete g.captured,g=>g.captured.killOnClose=false,g=>g.captured.breakaway=true,g=>g.captured.inheritable=true,g=>g.captured.active--,g=>g.captured.held.pop(),g=>g.captured.held[1].alive=false,g=>g.captured.held[1].createdFileTime='999',g=>g.captured.held[1].image='different.exe',g=>g.captured.held[1].pid=99,g=>g.captured.held[1]={...g.captured.held[0]}]){const r=sample();mutate(r.groups[0]);assert.equal(isMainOwnerLossComplete(r),false);}
});
test('finite valid original positive and negative remain eligible',()=>{assert.equal(isMainOwnerLossComplete(sample()),true);assert.equal(isExpectedMainOwnerLossRefusal(sample(true)),true);});
test('Safety may legitimately include processes outside the two captured groups',()=>{const r=sample(),extra=row(99);r.held.push(extra);r.before.push({...extra});r.after.push({...extra});r.cleanup.held.push(row(99,false,98));assert.equal(isMainOwnerLossComplete(r),true);});
const observer=await readFile(new URL('../fixtures/terminal-main-owner-observer.cs',import.meta.url),'utf8');
test('derived classic positive waits for every held Safety process before capturing exit codes',()=>{
 const s=deriveClassicMainLossObserver(observer);
 assert.match(s,/while\(!AllSafetyExited\(held,safety\)&&observation.ElapsedMilliseconds<3000\)/);
 assert.match(s,/Require\(AllSafetyExited\(held,safety\)&&observation.ElapsedMilliseconds<3000/);
 const body=s.match(/static bool AllSafetyExited\(List<Held> held,IntPtr safety\) \{([^}]+)\}/)?.[1];assert.ok(body);
 const code=body.replace('foreach(var p in held)','for(const p of held)');
 const completed=vm.runInNewContext('(held,safety)=>{'+code+'}',{WaitForSingleObject:p=>p.wait,Active:s=>s.active});
 assert.equal(completed([{handle:{wait:0}},{handle:{wait:258}}],{active:0}),false,'non-required helper still exiting');
 assert.equal(completed([{handle:{wait:0}},{handle:{wait:0}}],{active:1}),false);
 assert.equal(completed([{handle:{wait:0}},{handle:{wait:0xffffffff}}],{active:0}),false,'failed wait is not completion');
 assert.equal(completed([{handle:{wait:0}},{handle:{wait:0}}],{active:0}),true);
});
test('classic derivation refuses base drift and preserves the original negative and cleanup paths',()=>{
 assert.throws(()=>deriveClassicMainLossObserver(observer+'\n'),/CLASSIC_MAIN_LOSS_OBSERVER_DRIFT/);
 const s=deriveClassicMainLossObserver(observer),helper='    static bool AllSafetyExited(List<Held> held,IntPtr safety) {foreach(var p in held)if(WaitForSingleObject(p.handle,0)!=0)return false;return Active(safety)==0;}\n';
 assert.equal(s.replace('\n'+helper,'').replaceAll('AllSafetyExited(held,safety)','AllExited(held,required)'),observer);
});
test('classic runner compiles and hash-binds the derived observer instead of modifying the pinned base',async()=>{
 const s=await readFile(new URL('./terminal-main-owner-loss.mjs',import.meta.url),'utf8');
 assert.match(s,/deriveClassicMainLossObserver\(await readFile/);
 assert.match(s,/receipt.inputs.push\(\{path:observerSource,bytes:observerBytes.length,sha256:hash\(observerBytes\)\}\)/);
 assert.match(s,/\[\[observerSource,observer/);
});
test('workflow retains the actual classic derived observer source for independent readback',async()=>{
 const workflow=await readFile(new URL('../../../.github/workflows/terminal-prerequisite.yml',import.meta.url),'utf8');
 assert.ok(workflow.includes('desktop/evidence/terminal-main-owner-loss/*/observer-derived.cs'));
});
