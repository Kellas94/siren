// Execute the actual outer native harness with controlled process events/clocks.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
const source=await readFile(new URL('./terminal-host-guard.mjs',import.meta.url),'utf8');
async function harness(kill){
 const body=source.slice(source.indexOf('const code=await new Promise'),source.indexOf('receipt.exitCode=code;'));
 const child=new EventEmitter();child.kill=kill;const receipt={},timers=[];
 const context={child,receipt,setTimeout(fn,ms){const timer={fn,ms};timers.push(timer);return timer;},clearTimeout(t){if(t)t.cleared=true;}};
 const run=vm.runInNewContext('(async()=>{'+body+'return code;})()',context);return {child,receipt,timers,run};
}
test('native host probe observes ordinary exit',async()=>{const h=await harness(()=>true);h.child.emit('exit',0);assert.equal(await h.run,0);assert.equal(h.receipt.exitObserved,true);});
test('failed native kill cannot hang or become observed cleanup',async()=>{
 for(const kill of [()=>false,()=>{throw Error('KILL_REFUSED');}]){
  const h=await harness(kill);h.timers[0].fn();assert.equal(h.receipt.outerDeadlineExceeded,true);const grace=h.timers.find(t=>t.ms===3000);assert.ok(grace);grace.fn();assert.equal(await h.run,null);assert.equal(h.receipt.exitObserved,false);
 }
});
test('late successful exit cannot rescue an expired probe',async()=>{
 const h=await harness(()=>false);h.timers[0].fn();h.child.emit('exit',0);assert.equal(await h.run,0);
 const predicate=source.match(/receipt.status=(.*);/)[1];
 const good={exitObserved:true,addonUnchanged:true,native:{status:'HOST_GUARD_PASSED',cleanup:[{verified:true},{verified:true}]}};
 assert.equal(vm.runInNewContext(predicate,{receipt:good,code:0}),'HOST_GUARD_PASSED');
 for(const r of [{...good,...h.receipt},{...good,exitObserved:false},{...good,addonUnchanged:false},{...good,native:{...good.native,cleanup:[{verified:true},{verified:false}]}}])assert.equal(vm.runInNewContext(predicate,{receipt:r,code:0}),'FAILED');
});
