import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
import {isMainOwnerLossComplete,isExpectedMainOwnerLossRefusal} from './terminal-main-owner-loss-verdict.mjs';
const source=await readFile(new URL('./terminal-main-owner-loss.mjs',import.meta.url),'utf8');
async function harness(kill){
 const body=source.slice(source.indexOf('const exitCode=await new Promise'),source.indexOf('receipt.outerExitCode=exitCode;'));
 const child=new EventEmitter();child.kill=kill;const receipt={},timers=[];
 const context={child,receipt,setTimeout(fn,ms){const t={fn,ms};timers.push(t);return t;},clearTimeout(t){if(t)t.cleared=true;}};
 return {child,receipt,timers,run:vm.runInNewContext('(async()=>{'+body+'return exitCode;})()',context)};
}
test('external observer requires an observed ordinary exit',async()=>{const h=await harness(()=>true);h.child.emit('exit',0);assert.equal(await h.run,0);assert.equal(h.receipt.outerExitObserved,true);});
test('synchronous OS spawn refusal writes FAILED and never invents an observed exit',async()=>{
 const start=source.indexOf('let child;');assert.ok(start>=0,'Missing caught spawn boundary');
 const body=source.slice(start,source.indexOf('child.stdout.on(')),receipt={},writes=[];
 const refused=Object.assign(Error('SIGNING_POLICY_REFUSED'),{code:'UNKNOWN'});
 const run=vm.runInNewContext('(async()=>{'+body+'})()',{receipt,spawn(){throw refused;},observer:'observer.exe',executable:'electron.exe',application:'app',output:'out',fixture:'fixture.exe',negative:false,process:{env:{}},join:(...p)=>p.join('/'),writeFile:async(...args)=>writes.push(args),console:{log(){}}});
 await assert.rejects(run,e=>e===refused);assert.equal(receipt.status,'FAILED');assert.equal(receipt.outerExitObserved,false);assert.equal(receipt.outerExitCode,null);assert.equal(receipt.processError.code,'UNKNOWN');assert.equal(writes.length,1);assert.equal(JSON.parse(writes[0][1]).status,'FAILED');
});
test('observer kill refusal/throw settles unverified after fixed grace',async()=>{
 for(const kill of [()=>false,()=>{throw Error('REFUSED');}]){const h=await harness(kill);assert.equal(h.timers[0].ms,20000);h.timers[0].fn();h.timers.find(t=>t.ms===3000).fn();assert.equal(await h.run,null);assert.equal(h.receipt.outerExitObserved,false);assert.equal(h.receipt.outerDeadlineExceeded,true);}
});
test('late exit, changed inputs, missing runtime and truncated output cannot rescue observer verdict',async()=>{
 const tests=await readFile(new URL('./terminal-main-owner-loss-verdict.test.mjs',import.meta.url),'utf8');
 const fixture=tests.slice(tests.indexOf('const process='),tests.indexOf("test('main owner loss"));
 const sample=vm.runInNewContext('(function(){'+fixture+'return receipt;})()',{structuredClone});
 const predicate=source.match(/receipt.qualified=(.*);/)[1];
 const qualify=r=>vm.runInNewContext(predicate,{receipt:r,negative:false,isMainOwnerLossComplete,isExpectedMainOwnerLossRefusal});
 const good={observer:sample(),inputsUnchanged:true,runtimeVerified:true};assert.equal(qualify(good),true);
 const h=await harness(()=>false);h.timers[0].fn();h.child.emit('exit',0);await h.run;
 for(const mutant of [{...good,outerDeadlineExceeded:true},{...good,outputTruncated:true},{...good,inputsUnchanged:false},{...good,runtimeVerified:false},{...good,observer:{...good.observer,outerExitObserved:false}},{...good,...h.receipt}])assert.equal(qualify(mutant),false);
});
