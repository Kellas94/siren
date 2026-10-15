// Regression of genuine independent TD-1/TD-2 findings; execute exact current MAIN functions with real registry/graph and inert native dependencies.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {mainTerminalRollbackFixture} from './helpers/main-terminal-rollback-fixture.mjs';
import {inertTick} from './fixtures/terminal-production-inert.mjs';
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const between=(start,end)=>{const a=main.indexOf(start),b=main.indexOf(end,a+start.length);assert(a>=0&&b>a);return main.slice(a,b);};
const rollbackStart=main.match(/const rollbackNativePreparation\s*=\s*async[^{}]*=>\s*\{/)?.[0];assert(rollbackStart,'actual MAIN rollback function');
const rollback=between(rollbackStart,'const prepareNativeWorkspace=');
const selection=between('const changeSelection = async action => {','const captureLegacyExportAccess =');
const retirement=between('const retireNativeViews = async () => {','const invokeNativeWindow=');
async function setup({mainRollback=false}={}){
 // Reuse the maintained actual-MAIN scope fixture: genuine registry-bound MAIN
 // identity and exact private scope predicates, with inert native events only.
 // The existing OPEN callback now always uses its real fromTerminal binding.
 const f=await mainTerminalRollbackFixture({holdRollback:false}),{s,runtime,context}=f;
 context.workspaceBarrier=null;
 context.prepareNativeWorkspace=async()=>runtime.prepareTransition();
 context.retireNativeViews=async()=>s.registry.invalidateEpochAsync({preserveWorkspace:true});
 vm.runInContext(selection+'\nglobalThis.select=changeSelection;',context,{timeout:1000});
 return {s,runtime,context,writes:context.writes,actual:f.actual,async close(){for(const g of s.composition.state.groups)if(g.id)s.composition.completeNative(g.id);await f.finish();}};
}
test('direct candidate rollback control reopens genuine same-project access after preparation',async()=>{
 const h=await setup();try{await h.runtime.prepareTransition();assert.equal(h.actual().mainAuthorities().manager.stats().inputClosed,true);await h.runtime.rollbackTransition();assert.equal(h.actual().mainAuthorities().manager.stats().inputClosed,false);assert(h.actual().mainAuthorities().access.currentRouter());}finally{await h.close();}
});
for(const withBarrier of [true,false])test('MAIN rollback resumes candidate input '+(withBarrier?'with barrier':'after barrier already retired'),async()=>{
 const h=await setup();try{await h.runtime.prepareTransition();assert.equal(h.actual().mainAuthorities().manager.stats().inputClosed,true);h.context.workspaceBarrier=withBarrier?{dispose(){}}:null;await h.context.rollback();assert.equal(h.actual().mainAuthorities().manager.stats().inputClosed,false,'same-project rollback leaves genuine Terminal input fenced');}finally{await h.close();}
});
test('cancelled MAIN project selection preserves existing genuine session instead of Stop before dialog action',async()=>{
 const h=await setup();try{
  const router=h.actual().mainAuthorities().access.currentRouter(),scope=h.s.registry.capture(h.s.mainEvent);let operation=0;
  const route=(method,extra={})=>router.route({event:h.s.mainEvent,method,payload:{operationId:'independent_'+ ++operation,epoch:scope.epoch,...extra}});
  const picked=await route('terminalPickCwd');assert.equal(picked.ok,true,picked.code);
  const made=await route('terminalCreate',{cwdId:picked.value.cwdId,profileId:'powershell',cols:120,rows:40});assert.equal(made.ok,true,made.code);
  let entered=false,done=false;const selecting=h.context.select(async()=>{entered=true;return {ok:false,code:'CANCELLED'};}).finally(()=>{done=true;});
  for(let i=0;i<150&&!done;i++){for(const g of h.s.composition.state.groups)if(g.id&&h.s.composition.state.trace.some(row=>row.name==='native-stop'&&row.sessionId===g.id))h.s.composition.completeNative(g.id);await inertTick();}
  assert.equal(done,true,'bounded inert shutdown completion');assert.deepEqual(await selecting,{ok:false,code:'CANCELLED'});assert.equal(entered,true);
  assert.equal(h.s.composition.state.trace.filter(row=>row.name==='native-stop').length,0,'cancelled picker already stopped session before action returned CANCELLED');
  assert.equal(h.actual().mainAuthorities().manager.stats().inputClosed,false);
  const fresh=h.s.registry.capture(h.s.mainEvent);assert.ok(fresh.epoch>scope.epoch,'rollback obtains the post-retirement workspace epoch');
  const listed=await h.actual().mainAuthorities().access.currentRouter().route({event:h.s.mainEvent,method:'terminalList',payload:{operationId:'after_cancel',epoch:fresh.epoch}});
  assert.equal(listed.ok,true);assert.ok(listed.value.some(row=>row.sessionId===made.value.sessionId));
 }finally{await h.close();}
});

test('rollback while MAIN is busy leaves input fenced until current readiness is restored',async()=>{
 const h=await setup();try{
  // An unclaimed busy flag is not a MAIN rollback token. Exercise the existing
  // public-ready candidate path; owned MAIN restoration is covered separately.
  await h.runtime.prepareTransition();h.writes.selectionTransition=true;await h.runtime.rollbackTransition();
  assert.equal(h.actual().mainAuthorities().manager.stats().inputClosed,true);
  h.writes.selectionTransition=false;await h.context.rollback();assert.equal(h.actual().mainAuthorities().manager.stats().inputClosed,false);
 }finally{await h.close();}
});

for(const throwing of [false,true])test('a committed project change stops the old session after the action '+(throwing?'even when its result throws':'before returning success'),async()=>{
 const h=await setup();try{
  const router=h.actual().mainAuthorities().access.currentRouter(),scope=h.s.registry.capture(h.s.mainEvent);
  const route=(method,extra={})=>router.route({event:h.s.mainEvent,method,payload:{operationId:'committed_'+method.toLowerCase(),epoch:scope.epoch,...extra}});
  const picked=await route('terminalPickCwd');assert.equal(picked.ok,true);
  assert.equal((await route('terminalCreate',{cwdId:picked.value.cwdId,profileId:'powershell',cols:120,rows:40})).ok,true);
  let done=false;const selecting=h.context.select(async()=>{
   assert.equal(h.s.composition.state.trace.filter(row=>row.name==='native-stop').length,0,'dialog/action runs before old work is stopped');
   h.context.bootstrap.selectionGeneration++;h.s.state.project='project2';
   if(throwing)throw Error('Result failed after selecting project2');return {ok:true};
  }).then(value=>({value}),error=>({error})).finally(()=>{done=true;});
  for(let i=0;i<150&&!done;i++){for(const g of h.s.composition.state.groups)if(g.id&&h.s.composition.state.trace.some(row=>row.name==='native-stop'&&row.sessionId===g.id))h.s.composition.completeNative(g.id);await inertTick();}
  assert.equal(done,true);const result=await selecting;
  if(throwing)assert.match(result.error?.message??'',/after selecting/);else assert.equal(result.value.ok,true);
  assert.equal(h.s.composition.state.trace.filter(row=>row.name==='native-stop').length,1);assert.equal(h.runtime.snapshot().project,null);
  assert.equal(h.writes.selectionTransition,false);assert.equal(h.writes.selectionQuiesced,false);
 }finally{await h.close();}
});

test('real MAIN rollback hook releases editor preparation without recursively issuing a second OPEN',async()=>{
 const h=await setup({mainRollback:true});try{
  await h.runtime.prepareTransition();const before=h.actual().mainAuthorities().access.stats().controllerGeneration;
  await h.context.rollback();const access=h.actual().mainAuthorities().access;
  assert.equal(access.stats().inputFenced,false);assert.equal(access.stats().retainedWorkers,0);assert.equal(access.stats().controllerGeneration,before+1);
  assert.ok(access.currentRouter());assert.equal(h.actual().mainAuthorities().manager.stats().inputClosed,false);
 }finally{await h.close();}
});

test('cancelled selection with the actual MAIN rollback binding reopens the fresh workspace epoch',async()=>{
 const h=await setup({mainRollback:true});try{
  const before=h.s.registry.capture(h.s.mainEvent).epoch;
  assert.equal((await h.context.select(async()=>({ok:false,code:'CANCELLED'}))).code,'CANCELLED');
  assert.ok(h.s.registry.capture(h.s.mainEvent).epoch>before);assert.ok(h.actual().mainAuthorities().access.currentRouter());
  assert.equal(h.actual().mainAuthorities().manager.stats().inputClosed,false);assert.equal(h.s.composition.state.trace.filter(row=>row.name==='native-stop').length,0);
 }finally{await h.close();}
});
