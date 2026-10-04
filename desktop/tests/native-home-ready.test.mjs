import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
const module=await import('./native/home-ready.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
test('native module readiness waits for actual enabled Home after a held metadata handoff, without clicking or extending the condition deadline',async()=>{
 assert.equal(typeof module.waitForHomeModule,'function');let time=0,calls=0;
 const home={hidden:false,getAttribute:()=>calls>=3?'false':'true'},control={disabled:true},document={body:{inert:false},getElementById:id=>id==='homeRoot'?home:id==='homeModule-docs'?control:null};
 await module.waitForHomeModule({evaluate:async expression=>{calls++;control.disabled=calls<3;return runInNewContext(expression,{document});}},'docs',{clock:()=>time,delay:async ms=>{time+=ms;}});assert.equal(calls,3);assert.equal(time,200);
 calls=0;time=0;home.hidden=true;await assert.rejects(module.waitForHomeModule({evaluate:async expression=>{calls++;return runInNewContext(expression,{document});}},'docs',{clock:()=>time,delay:async ms=>{time+=ms;}}),/UI condition not met/);assert.equal(time,30000);assert.equal(calls,300);
});
test('native Home readiness refuses unknown roles before evaluating any injected expression and preserves genuine observation errors',async()=>{
 assert.equal(typeof module.waitForHomeModule,'function');for(const role of ['unknown','docs\"; forged()',null])await assert.rejects(module.waitForHomeModule({evaluate:()=>assert.fail('Forbidden observation')},role),/Home module role/);
 const error=Error('Owned target failed');await assert.rejects(module.waitForHomeModule({evaluate:async()=>{throw error;}},'code'),cause=>cause===error);
});
