import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {clickSearchAfterStatusCommit, sendObservedRegisterKey} from './native/docs-status-commit.mjs';

function fixture(overrides={}) {
 const select={id:'homeDocsFilter-status',tagName:'SELECT',isConnected:true,disabled:false,value:'approved',selectedIndex:3,options:[{value:''},{value:'draft'},{value:'in-review'},{value:'approved'}],matches:()=>false,...overrides};
 const clicks=[], document={activeElement:select,querySelectorAll:()=>[select],getElementById:()=>select};
 return {select,clicks,driver:{evaluate:async expression=>vm.runInNewContext(expression,{document,performance}),click:async selector=>{clicks.push(selector);}}};
}
test('observes actual committed approved value before genuine Search click',async()=>{
 const {driver,clicks}=fixture(),result={};await clickSearchAfterStatusCommit(driver,result,'approved');
 assert.deepEqual(clicks,['#homeLibrarySearch']);assert.equal(result.registerSelections[0].value,'approved');assert.equal(result.registerSelections[0].popupOpen,false);
});
test('reset must be actually empty before Search',async()=>{
 const {driver,clicks}=fixture({value:'',selectedIndex:0});await clickSearchAfterStatusCommit(driver,{},'');assert.equal(clicks.length,1);
});
for(const [name,changes] of [
 ['uncommitted empty value',{value:'',selectedIndex:0}],['wrong selected option',{selectedIndex:1}],
 ['disabled select',{disabled:true}],['detached select',{isConnected:false}],['wrong element',{tagName:'INPUT'}],
])test('refuses Search after '+name+' and retains observation',async()=>{
 const {driver,clicks}=fixture(changes),result={};await assert.rejects(clickSearchAfterStatusCommit(driver,result,'approved'),{code:'DOCS_STATUS_NOT_COMMITTED'});
 assert.equal(clicks.length,0);assert.equal(result.registerSelections.length,1);
});
test('missing or duplicate controls refuse Search',async()=>{
 for(const count of [0,2]){const {driver,select,clicks}=fixture();driver.evaluate=async expression=>vm.runInNewContext(expression,{document:{activeElement:select,querySelectorAll:()=>Array(count).fill(select),getElementById:()=>select},performance});await assert.rejects(clickSearchAfterStatusCommit(driver,{},'approved'),{code:'DOCS_STATUS_NOT_COMMITTED'});assert.equal(clicks.length,0);}
});
test('unsupported passive popup state remains unknown, never forces a selection',async()=>{
 const {driver,clicks}=fixture({matches:()=>{throw Error('unsupported pseudo-class');}}),result={};await clickSearchAfterStatusCommit(driver,result,'approved');assert.equal(result.registerSelections[0].popupOpen,null);assert.equal(clicks.length,1);
});
test('protocol records preserve real key packets and their acknowledgements',async()=>{
 const packets=[],result={};await sendObservedRegisterKey({send:async(method,packet)=>packets.push({method,...packet})},result,'End','End',35);
 assert.deepEqual(packets.map(p=>[p.method,p.type,p.key,p.windowsVirtualKeyCode]),[['Input.dispatchKeyEvent','keyDown','End',35],['Input.dispatchKeyEvent','keyUp','End',35]]);
 assert.equal(result.registerKeyPackets.length,2);assert.ok(result.registerKeyPackets.every(p=>p.acknowledged&&p.ackAt>=p.sentAt));
});
test('protocol rejection stays rejected, records failure and does not dispatch keyUp',async()=>{
 const result={},calls=[];await assert.rejects(sendObservedRegisterKey({send:async(method,packet)=>{calls.push(packet.type);throw Error('CDP rejected');}},result,'Enter','Enter',13),/CDP rejected/);
 assert.deepEqual(calls,['keyDown']);assert.equal(result.registerKeyPackets[0].acknowledged,false);assert.equal(result.registerKeyPackets[0].error,'CDP rejected');
});
test('diagnostic packet retention is bounded without skipping actual delivery',async()=>{
 const result={},packets=[];for(let i=0;i<25;i++)await sendObservedRegisterKey({send:async(method,packet)=>packets.push(packet)},result,'End','End',35);
 assert.equal(packets.length,50);assert.equal(result.registerKeyPackets.length,32);assert.equal(result.registerKeyPacketsDropped,18);
});
test('last failed packet remains available after the bounded success journal fills',async()=>{
 const result={};for(let i=0;i<16;i++)await sendObservedRegisterKey({send:async()=>{}},result,'End','End',35);
 const failure=Error('rejected after saturation');await assert.rejects(sendObservedRegisterKey({send:async()=>{throw failure;}},result,'Enter','Enter',13),error=>error===failure);
 assert.equal(result.registerKeyPackets.length,32);assert.equal(result.registerKeyPacketsDropped,1);
 assert.equal(result.registerLastKeyFailure.key,'Enter');assert.equal(result.registerLastKeyFailure.type,'keyDown');
 assert.equal(result.registerLastKeyFailure.error,failure.message);assert.equal(result.registerLastKeyFailure.acknowledged,false);
 assert.ok(result.registerLastKeyFailure.ackAt>=result.registerLastKeyFailure.sentAt);
});
