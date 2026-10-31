import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {clickSearchAfterStatusCommit, sendObservedRegisterKey} from './native/docs-status-commit.mjs';
import * as statusControls from './native/docs-status-commit.mjs';

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

function keyboardFixture({count=1,disabled=false,initial='type',reaches=true,popupOpen=false,mutates=true,rejectKey=null,activeType='select-one'}={}) {
 const options=['','draft','in-review','approved'].map(value=>({value,disabled:false}));
 const status={id:'homeDocsFilter-status',tagName:'SELECT',type:'select-one',size:0,isConnected:true,disabled,value:'',selectedIndex:0,options,matches:()=>popupOpen,getAttribute:name=>name==='aria-label'?'Status':null,dataset:{registerFilter:'status'}};
 const type={id:'homeDocsFilter-type',tagName:'SELECT',type:'select-one'},references={id:'homeDocsFilter-links',tagName:'SELECT',type:'select-one'},summary={tagName:'SUMMARY'},search={id:'homeLibrarySearch',tagName:'BUTTON',type:'submit'};
 let active=initial==='status'?status:initial==='search'?search:type;
 const register={open:true},packets=[],clicks=[],document={get activeElement(){return active;},querySelectorAll:selector=>selector==='#homeDocsFilter-status'?Array(count).fill(status):selector==='.home-docs-filters'?[register]:[],getElementById:()=>status};
 const driver={evaluate:async expression=>vm.runInNewContext(expression,{document,performance}),click:async selector=>clicks.push(selector),send:async(method,packet)=>{
  packets.push({method,...packet});if(packet.key===rejectKey&&packet.type==='keyDown')throw Error('actual packet rejected');if(packet.type!=='keyDown')return;
  if(packet.key==='Tab') {if(!reaches)return;if(active===status)active=references;else if(active===search)active=summary;else if(active===summary)active=type;else {active=status;status.type=activeType;}}
  else if(active===status&&mutates&&['End','Home'].includes(packet.key)){status.selectedIndex=packet.key==='End'?3:0;status.value=options[status.selectedIndex].value;}
 }};
 return {driver,status,packets,clicks};
}
const choose=(...args)=>statusControls.chooseStatusWithTrustedTabs(...args);
test('bounded genuine Tab route observes Status before End and commits with Tab, never popup click or Enter',async()=>{
 const {driver,packets,clicks}=keyboardFixture({initial:'search'}),result={};
 await choose(driver,result,'approved');await clickSearchAfterStatusCommit(driver,result,'approved');
 assert.deepEqual(packets.filter(p=>p.type==='keyDown').map(p=>p.key),['Tab','Tab','Tab','End','Tab']);assert.deepEqual(clicks,['#homeLibrarySearch']);
 assert.ok(result.registerKeyboardObservations.some(s=>s.stage==='before-selection-key'&&s.activeIsStatus&&s.activeType==='select-one'&&s.label==='Status'&&s.popupOpen===false));
});
test('reset navigates genuinely to Status, uses Home and Tab, then retains exact empty Search guard',async()=>{
 const {driver,status,packets,clicks}=keyboardFixture();status.value='approved';status.selectedIndex=3;
 await choose(driver,{},'');await clickSearchAfterStatusCommit(driver,{},'');
 assert.deepEqual(packets.filter(p=>p.type==='keyDown').map(p=>p.key),['Tab','Home','Tab']);assert.deepEqual(clicks,['#homeLibrarySearch']);
});
for(const [name,options] of [['missing',{count:0}],['duplicate',{count:2}],['disabled',{disabled:true}]])test('keyboard route refuses '+name+' Status before keys or Search',async()=>{
 const {driver,packets,clicks}=keyboardFixture(options);await assert.rejects(choose(driver,{},'approved'),{code:'DOCS_STATUS_KEYBOARD_UNAVAILABLE'});assert.deepEqual(packets,[]);assert.deepEqual(clicks,[]);
});
test('wrong active element is observed across at most twelve Tabs; selection keys and Search remain unsent',async()=>{
 const {driver,packets,clicks}=keyboardFixture({reaches:false}),result={};await assert.rejects(choose(driver,result,'approved'),{code:'DOCS_STATUS_FOCUS_UNREACHED'});
 assert.equal(packets.filter(p=>p.type==='keyDown').length,12);assert.ok(packets.every(p=>p.key==='Tab'));assert.deepEqual(clicks,[]);assert.ok(result.registerKeyboardObservations.length<=16);
});
test('wrong active select type refuses selection keys',async()=>{
 const {driver,packets}=keyboardFixture({activeType:'select-multiple'});await assert.rejects(choose(driver,{},'approved'),{code:'DOCS_STATUS_KEYBOARD_UNAVAILABLE'});assert.ok(packets.every(p=>p.key==='Tab'));
});
for(const popupOpen of [true,null])test('open or unknown popup state refuses closed-select keyboard route: '+popupOpen,async()=>{
 const {driver,packets}=keyboardFixture({popupOpen});await assert.rejects(choose(driver,{},'approved'),{code:'DOCS_STATUS_NOT_CLOSED'});assert.deepEqual(packets,[]);
});
test('unchanged actual value guard still refuses wrong selection after acknowledged End/Tab',async()=>{
 const {driver,packets,clicks}=keyboardFixture({mutates:false}),result={};await choose(driver,result,'approved');await assert.rejects(clickSearchAfterStatusCommit(driver,result,'approved'),{code:'DOCS_STATUS_NOT_COMMITTED'});
 assert.ok(packets.some(p=>p.key==='End'));assert.deepEqual(clicks,[]);assert.equal(result.registerSelections[0].value,'');
});
test('real packet failure stops before commit/Search and preserves actual rejection',async()=>{
 const {driver,packets,clicks}=keyboardFixture({rejectKey:'End'}),result={};await assert.rejects(choose(driver,result,'approved'),/actual packet rejected/);
 assert.deepEqual(packets.map(p=>[p.key,p.type]),[['Tab','keyDown'],['Tab','keyUp'],['End','keyDown']]);assert.equal(result.registerLastKeyFailure.key,'End');assert.deepEqual(clicks,[]);
});
