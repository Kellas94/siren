// Fault-inject actual harness wiring. No Electron, native addon or process is launched.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {setImmediate as turn} from 'node:timers/promises';
import vm from 'node:vm';
for(const name of ['terminal-ownership-addon.mjs','terminal-job-lifetime.mjs']){
const runner=await readFile(new URL('./'+name,import.meta.url),'utf8');
const predicate=runner.match(/receipt.status=(.*);/)[1];
const passed={native:{main:{status:'PRIMITIVE_PASSED'},host:{status:'PRIMITIVE_PASSED'},hostExitCode:0},exitObserved:true,addonUnchanged:true,metricsUnchanged:true};
const verdict=receipt=>vm.runInNewContext(predicate,{receipt,code:0});
test('receipt refuses either expired deadline and unobserved exit',()=>{
  assert.equal(verdict(passed),'PREREQUISITE_PASSED');
  for(const receipt of [{...passed,outerDeadlineExceeded:true},{...passed,native:{...passed.native,deadlineExceeded:true}},{...passed,exitObserved:false},{...passed,addonUnchanged:false}])assert.equal(verdict(receipt),'FAILED');
});
function clock(){const timers=[];return {timers,setTimeout(fn,ms){const row={fn,ms,cleared:false,unref(){return this;}};timers.push(row);return row;},clearTimeout(row){if(row)row.cleared=true;}};}
async function mainHarness(kill){
  const template=runner.match(/await writeFile\(join\(output,'main\.mjs'\),(\x60[\s\S]*?\x60),\{flag:'wx'\}\);/)[1];
  const main=vm.runInNewContext(template,{config:{output:'unused',addon:'unused'},exercise:async()=>({status:'PRIMITIVE_PASSED'})}).replace(/^import .*;\r?\n/gm,'');
  const host=new EventEmitter();host.stdout=new EventEmitter();host.stderr=new EventEmitter();host.kill=kill;
  const timer=clock(),writes=[],exits=[];let ready;
  vm.runInNewContext(main,{...timer,app:{setPath(){},whenReady(){return {then(fn){ready=fn;}};},exit(code){exits.push(code);}},utilityProcess:{fork(){return host;}},writeFile:async(path,bytes)=>{writes.push(JSON.parse(bytes));}});
  await ready();return {host,timer,writes,exits};
}
test('ordinary utility success remains admissible as prerequisite only',async()=>{
  const h=await mainHarness(()=>true);h.host.emit('message',{status:'PRIMITIVE_PASSED'});h.host.emit('exit',0);await turn();
  assert.deepEqual(h.exits,[0]);assert.equal(h.writes[0].admitted,false);
});
test('utility deadline cannot be rescued by late success',async()=>{
  const h=await mainHarness(()=>false);assert.equal(h.timer.timers[0].ms,25000);h.timer.timers[0].fn();
  h.host.emit('message',{status:'PRIMITIVE_PASSED'});h.host.emit('exit',0);await turn();
  assert.deepEqual(h.exits,[1]);assert.equal(h.writes[0].deadlineExceeded,true);
});
test('utility kill error still reaches bounded failed writeback',async()=>{
  const h=await mainHarness(()=>{throw Error('OWNED_KILL_FAILED');});
  assert.doesNotThrow(()=>h.timer.timers[0].fn());const grace=h.timer.timers.find(t=>t.ms===3000);assert.ok(grace);grace.fn();await turn();
  assert.deepEqual(h.exits,[1]);assert.equal(h.writes[0].deadlineExceeded,true);
});
async function outerHarness(kill){
  const body=runner.slice(runner.indexOf('const code=await new Promise'),runner.indexOf('receipt.exitCode=code;'));
  const child=new EventEmitter();child.kill=kill;const receipt={},timer=clock();let settled=false,value;
  const promise=vm.runInNewContext('(async()=>{'+body+'return code;})()',{child,receipt,...timer});
  promise.then(v=>{settled=true;value=v;},e=>{settled=true;value=e;});await turn();
  return {child,receipt,timer,settled:()=>settled,value:()=>value};
}
test('outer normal exit is observed',async()=>{
  const h=await outerHarness(()=>true);h.child.emit('exit',0);await turn();assert.equal(h.settled(),true);assert.equal(h.value(),0);
});
test('outer kill false without exit settles failed within grace',async()=>{
  const h=await outerHarness(()=>false);assert.equal(h.timer.timers[0].ms,40000);h.timer.timers[0].fn();
  const grace=h.timer.timers.find(t=>t.ms===3000);assert.ok(grace,'timeout must arm finite grace');grace.fn();await turn();
  assert.equal(h.settled(),true);assert.equal(h.value(),null);assert.equal(h.receipt.outerDeadlineExceeded,true);assert.equal(h.receipt.exitObserved,false);
});
test('outer kill throw does not lose deadline writeback',async()=>{
  const h=await outerHarness(()=>{throw Error('OWNED_KILL_FAILED');});assert.doesNotThrow(()=>h.timer.timers[0].fn());
  const grace=h.timer.timers.find(t=>t.ms===3000);assert.ok(grace);grace.fn();await turn();assert.equal(h.settled(),true);assert.equal(h.value(),null);
});
}
