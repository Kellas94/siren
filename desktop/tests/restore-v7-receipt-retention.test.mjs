import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {pointerExpression,stablePointerExpression} from './native/pointer.mjs';
import {waitForNativeCondition} from './native/condition.mjs';
const api=await import('./native/restore-v7/receipt-retention.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
async function fixture(t){assert.equal(typeof api.retainReceipt,'function','PRIMARY_RECEIPT_FALLBACK_NOT_IMPLEMENTED');const root=await mkdtemp(join(tmpdir(),'siren-receipt-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
test('Node exit-receipt write refusal preserves original spawn error and fallback',async t=>{
 const root=await fixture(t),path=join(root,'exit.json'),fallback=join(root,'fallback.json');await mkdir(path);
 const receipt={primaryError:{type:'Error',code:'ENOENT',message:'original spawn refusal'},finalErrors:[]},emitted=[];
 await api.retainReceipt(path,receipt,fallback,{emit:s=>emitted.push(s)});
 const raw=JSON.parse(await readFile(fallback,'utf8'));assert.deepEqual(raw.primaryError,receipt.primaryError);assert.equal(raw.primaryError.code,'ENOENT');assert.equal(raw.finalErrors.length,1);assert.equal(raw.fallbackDiagnosticOnly,true);assert.equal(emitted.length,1);assert.match(emitted[0],/original spawn refusal/);
});
test('Node receipt refusal becomes primary when no earlier error exists',async t=>{
 const root=await fixture(t),path=join(root,'exit.json');await mkdir(path);const receipt={primaryError:null,finalErrors:[]};
 await api.retainReceipt(path,receipt,join(root,'fallback.json'),{emit:()=>{}});assert.equal(receipt.primaryError.stage,'result-retention');assert.equal(receipt.finalErrors.length,0);
});
test('both Node receipt paths failing retain first error and separate retention failures',async t=>{
 const root=await fixture(t),path=join(root,'exit.json'),fallback=join(root,'fallback.json');await mkdir(path);await mkdir(fallback);
 const receipt={primaryError:{message:'first refusal'},finalErrors:[]},emitted=[];
 await api.retainReceipt(path,receipt,fallback,{emit:s=>emitted.push(s)});assert.equal(receipt.primaryError.message,'first refusal');assert.equal(receipt.finalErrors.length,2);assert.equal(emitted.length,1);assert.equal(JSON.parse(emitted[0]).finalErrors.length,2);
});
test('successful Node exit receipt preserves exact original metadata',async t=>{
 const root=await fixture(t),path=join(root,'exit.json'),receipt={primaryError:null,finalErrors:[],code:0,signal:null};
 await api.retainReceipt(path,receipt,join(root,'fallback.json'),{emit:()=>assert.fail('No fallback expected')});assert.deepEqual(JSON.parse(await readFile(path,'utf8')),receipt);
});

const actorSource=await readFile(new URL('./native/restore-v7/actor-package.mjs',import.meta.url),'utf8');
const actorBegin=actorSource.indexOf('async function openRecoveredViews(number){'),actorEnd=actorSource.indexOf('async function quit(',actorBegin);
assert(actorBegin>=0&&actorEnd>actorBegin);
function recoveredNavigation({appearsAt=100,alreadyHome=false}={}){
 let clock=0,present=alreadyHome||appearsAt===0;const trace=[],verified=Error('CONTROL_REACHED_VERIFY');
 const element={parentElement:null,getBoundingClientRect:()=>({x:1,y:1,width:20,height:20,left:1,right:21,top:1,bottom:21}),getAnimations:()=>[],contains:node=>node===element};
 const context=vm.createContext({document:{querySelector:()=>present?element:null,elementFromPoint:()=>present?element:null},innerWidth:100,innerHeight:100,requestAnimationFrame:fn=>queueMicrotask(fn),location:{href:alreadyHome?'siren://app/home.html':'siren://app/app.html'},window:{sirenHomeView:{}},stablePointerExpression,phase:async value=>trace.push(value),ctx:{projects:{readProject:async()=>({})}},route:{},restored:{project:{id:'owned'}},result:{},verifyRestored:async()=>{trace.push('verify');throw verified;}});
 const evaluate=expression=>vm.runInContext(expression,context,{timeout:1000});
 const driver={evaluate,waitFor:expression=>waitForNativeCondition(evaluate,expression,{clock:()=>clock,delay:async ms=>{clock+=ms;if(clock>=appearsAt)present=true;}}),click:async selector=>{const point=await evaluate(pointerExpression(selector));assert.equal(point.hit,true);trace.push('click:'+selector);context.location.href='siren://app/home.html';}};
 context.driver=driver;const open=vm.runInContext('('+actorSource.slice(actorBegin,actorEnd).trim()+')',context,{timeout:1000});
 return {run:()=>open(1),trace,verified,getClock:()=>clock};
}
test('recovered package navigation waits through absent Home control using actual managed predicate loop',async()=>{
 const s=recoveredNavigation();await assert.rejects(s.run(),e=>e===s.verified);assert.equal(s.getClock(),100);assert.deepEqual(s.trace,['recovered-views-1','click:#desktopHome','verify']);
});
test('permanently absent Home control exhausts one existing wait budget without a click or verification',async()=>{
 const s=recoveredNavigation({appearsAt:Infinity});await assert.rejects(s.run(),/UI condition not met:/);assert.equal(s.getClock(),30000);assert.deepEqual(s.trace,['recovered-views-1']);
});
test('already-Home package route preserves navigation and reaches verification without workspace click',async()=>{
 const s=recoveredNavigation({alreadyHome:true});await assert.rejects(s.run(),e=>e===s.verified);assert.equal(s.getClock(),0);assert.deepEqual(s.trace,['recovered-views-1','verify']);
});
