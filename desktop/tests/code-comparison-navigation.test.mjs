import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,rm} from 'node:fs/promises';
import {NativeSourceAnalysis} from '../src/windows/source-analysis.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
const source=await readFile(new URL('../src/ui/code/analysis.js',import.meta.url),'utf8');
const refOnly=({sourceId,version,sha256})=>({sourceId,version,sha256});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const held=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
function ui(){
 class Element{children=[];dataset={};listeners={};value='';classList={toggle(){}};append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(key,value){this[key]=value;}addEventListener(name,fn){this.listeners[name]=fn;}removeEventListener(){}focus(){}}
 const button=new Element(),panel=new Element(),window={},document={createElement:()=>new Element(),getElementById:()=>new Element(),addEventListener(){},removeEventListener(){}};panel.id='analysis';
 vm.runInNewContext(source,{window,document,crypto:{randomUUID:()=> 'comparison-a'}});
 let state={ready:true,sourceRef:{sourceId:'source-a',version:1,sha256:'a'.repeat(64)}},finish;const selected=[],revealed=[];
 const editor={getStatus:()=>state,getState:()=>({doc:{length:100},selection:{main:{from:0,to:0}}}),select:(...range)=>selected.push(range)};
 const right={windowId:'window-b',sourceRef:{sourceId:'source-b',version:2,sha256:'b'.repeat(64)}};
 const bridge={listComparisons:async()=>({ok:true,items:[right]}),submit:()=>new Promise(resolve=>finish=resolve),cancel:async()=>({ok:true}),revealComparison:async payload=>{revealed.push(payload);return {ok:true};}};
 const view=window.SirenNativeAnalysis.create({button,panel,editorFor:()=>editor,bridge});
 const all=()=>{const nodes=[];const visit=node=>{nodes.push(node);node.children.forEach(visit);};visit(panel);return nodes;},node=id=>all().find(n=>n.id===id);
 return {view,node,all,selected,revealed,right,setState:value=>state={...state,...value},async compare(){node('analysisScope').value='compare';node('analysisScope').listeners.change();await tick();node('analysisCompareWindow').value=right.windowId;node('analyzeSource').listeners.click();finish({ok:true,sourceId:'source-a',version:1,jobId:'comparison-a',status:'complete',rightRef:{...right.sourceRef},coverage:{},result:{identical:false,hunks:[{left:{from:1,to:3,fromLine:1,toLine:1,preview:'A'},right:{from:4,to:8,fromLine:1,toLine:1,preview:'B'}}]}});await tick();}};
}
async function fixture(t,options={}){
 const f=await sourceReadFixture();t.after(()=>rm(f.root,{recursive:true,force:true}));
 await f.registry.openView({role:'code',entityId:f.refs[1].sourceId});const deliveries=[],focused=[],delivered=held();let currentRight=f.refs[1],gate=null;
 const referenceFor=grant=>grant.entityIds[0]===f.refs[0].sourceId?f.refs[0]:currentRight;
 const navigation={enabled:()=>true,send:(event,payload)=>{deliveries.push({event,payload});delivered.resolve(payload);},focus:(grant,scope)=>{if(!scope.isCurrent())return false;focused.push(grant.windowId);return scope.isCurrent();},...options};
 const service=new NativeSourceAnalysis({registry:f.registry,owner:f.owner,referenceFor,windowsFor:()=>f.windows,workerPath:'unused-static-worker',workerSha256:'a'.repeat(64),navigation,
  repositoryFactory:({canWrite})=>{const repo=new SourceRepository(f.root,{canWrite});return {getMetrics:async request=>{if(gate)await gate.promise;return repo.getMetrics(request);}};}});
 t.after(()=>service.dispose());const request={sourceRef:refOnly(f.refs[0]),rightWindowId:f.registry.capture(f.event(2)).windowId,rightRef:refOnly(f.refs[1]),range:{from:0,to:7}};
 return {...f,service,request,deliveries,focused,delivery:pending=>Promise.race([delivered.promise,pending.then(answer=>assert.fail('navigation ended before delivery: '+JSON.stringify(answer)))]),invoke:(method,payload=request,event=f.event(0))=>service.invoke({event,method,payload}),stale:()=>currentRight={...f.refs[1],version:2},hold:()=>gate=held(),release:()=>{gate?.resolve();gate=null;}};
}
test('comparison exposes both saved-range actions and sends B exact immutable metadata only',async()=>{
 const f=ui();await f.compare();const a=f.all().find(n=>n.textContent==='Show in A'),b=f.all().find(n=>n.textContent==='Show in B');assert.ok(b,'Show in B must be a real accessible button');
 a.listeners.click();assert.deepEqual(f.selected,[[1,3]]);await b.listeners.click();await tick();assert.deepEqual(JSON.parse(JSON.stringify(f.revealed)),[{sourceRef:{sourceId:'source-a',version:1,sha256:'a'.repeat(64)},rightWindowId:'window-b',rightRef:f.right.sourceRef,range:{from:4,to:8}}]);assert.equal(b.type,'button');
});
test('retained B button cannot dispatch after A dirty, pause or a new choice',async()=>{
 for(const cause of ['dirty','pause','choice']){const f=ui();await f.compare();const b=f.all().find(n=>n.textContent==='Show in B');assert.ok(b);if(cause==='dirty')f.setState({dirty:true});if(cause==='pause')f.view.pause();if(cause==='choice')f.node('analysisCompareWindow').listeners.change();await b.listeners.click();await tick();assert.equal(f.revealed.length,0,cause);}
});
test('actual registry/repository validates exact B bounds, then only B can claim and complete targeted focus',async t=>{
 const f=await fixture(t),pending=f.invoke('revealComparison');await tick();await f.delivery(pending);const ticket=f.deliveries[0].payload;
 assert.equal(f.deliveries[0].event.sender,f.event(2).sender);assert.deepEqual(ticket.range,{from:0,to:7});
 assert.equal((await f.invoke('claimComparison',{requestId:ticket.requestId},f.event(0))).ok,false);
 assert.equal((await f.invoke('claimComparison',{requestId:ticket.requestId},f.event(2))).ok,true);
 assert.equal((await f.invoke('completeComparison',{requestId:ticket.requestId,ok:true},f.event(2))).ok,true);
 assert.equal((await pending).ok,true);assert.deepEqual(f.focused,[f.request.rightWindowId]);assert.equal(f.service.isIdle(),true);
});
test('wrong saved B hash and out-of-bounds offsets never reach the renderer',async t=>{
 const f=await fixture(t);for(const request of [{...f.request,rightRef:{...f.request.rightRef,sha256:'f'.repeat(64)}},{...f.request,range:{from:0,to:1000}},{...f.request,range:{from:2,to:1}},{...f.request,range:{from:0,to:NaN}}])assert.equal((await f.invoke('revealComparison',request)).ok,false);
 assert.equal(f.deliveries.length,0);assert.equal(f.focused.length,0);
});
test('a stale B after delivery cannot claim or focus even if an old completion arrives',async t=>{
 const f=await fixture(t),pending=f.invoke('revealComparison');await f.delivery(pending);const ticket=f.deliveries[0].payload;f.stale();assert.equal((await f.invoke('claimComparison',{requestId:ticket.requestId},f.event(2))).ok,false);assert.equal((await f.invoke('completeComparison',{requestId:ticket.requestId,ok:true},f.event(2))).ok,false);f.service.pause();assert.equal((await pending).ok,false);assert.equal(f.focused.length,0);
});
test('Lock cancels public navigation but drain retains actual held metadata I/O until settlement',async t=>{
 const f=await fixture(t),gate=f.hold(),pending=f.invoke('revealComparison');await tick();f.service.pause();f.lock();assert.equal((await pending).ok,false);assert.equal(f.service.isIdle(),false);let drained=false;const drain=f.service.drain().then(()=>drained=true);await tick();assert.equal(drained,false);gate.resolve();f.release();await drain;assert.equal(f.service.isIdle(),true);assert.equal(f.deliveries.length,0);
});
test('target refusal remains failure and never focuses or implicitly saves',async t=>{
 const f=await fixture(t),pending=f.invoke('revealComparison');await f.delivery(pending);const {requestId}=f.deliveries[0].payload;await f.invoke('claimComparison',{requestId},f.event(2));await f.invoke('completeComparison',{requestId,ok:false},f.event(2));assert.equal((await pending).ok,false);assert.equal(f.focused.length,0);
});
test('completion before claim, replay and a third genuine Code window never gain the target ticket',async t=>{
 const f=await fixture(t),pending=f.invoke('revealComparison');await f.delivery(pending);const {requestId}=f.deliveries[0].payload;
 await f.registry.openView({role:'code',entityId:f.refs[1].sourceId});assert.equal((await f.invoke('claimComparison',{requestId},f.event(3))).ok,false);
 assert.equal((await f.invoke('completeComparison',{requestId,ok:true},f.event(2))).ok,false);assert.equal(f.focused.length,0);
 assert.equal((await f.invoke('claimComparison',{requestId},f.event(2))).ok,true);await f.invoke('completeComparison',{requestId,ok:true},f.event(2));assert.equal((await pending).ok,true);
 assert.equal((await f.invoke('claimComparison',{requestId},f.event(2))).ok,false);assert.equal((await f.invoke('completeComparison',{requestId,ok:true},f.event(2))).ok,false);assert.equal(f.focused.length,1);
});
test('public timeout retains held actual metadata and prevents duplicate work until it settles',async t=>{
 const f=await fixture(t),gate=f.hold(),pending=f.invoke('revealComparison');assert.equal((await pending).code,'COMPARISON_NAVIGATION_TIMEOUT');assert.equal(f.service.isIdle(),false);
 assert.equal((await f.invoke('revealComparison')).code,'COMPARISON_NAVIGATION_BUSY');gate.resolve();f.release();await f.service.drain();assert.equal(f.service.isIdle(),true);assert.equal(f.deliveries.length,0);
});
test('accessor/proxy/extra navigation inputs never execute caller hooks or reach I/O',async t=>{
 const f=await fixture(t);let hooks=0;const bad=[Object.defineProperty({...f.request},'range',{enumerable:true,get(){hooks++;return f.request.range;}}),new Proxy(f.request,{getPrototypeOf(){hooks++;return Object.prototype;}}),{...f.request,path:'arbitrary'}, {...f.request,range:{from:0,to:7,extra:1}}];
 for(const input of bad)assert.equal((await f.invoke('revealComparison',input)).code,'REQUEST_REFUSED');assert.equal(hooks,0);assert.equal(f.deliveries.length,0);
});
test('focus callback retirement cannot publish success and a failed send releases only after its loader unwinds',async t=>{
 let service;const f=await fixture(t,{focus:()=>{service.pause();return true;}});service=f.service;const pending=f.invoke('revealComparison');await f.delivery(pending);const {requestId}=f.deliveries[0].payload;await f.invoke('claimComparison',{requestId},f.event(2));assert.equal((await f.invoke('completeComparison',{requestId,ok:true},f.event(2))).ok,false);assert.equal((await pending).ok,false);await f.service.drain();assert.equal(f.service.isIdle(),true);
 const other=await fixture(t,{send:()=>{throw Error('inert delivery refusal');}});assert.equal((await other.invoke('revealComparison')).code,'COMPARISON_NAVIGATION_FAILED');await other.service.drain();assert.equal(other.service.isIdle(),true);
});
test('eight held real-scope navigation cells refuse a ninth and release only after original loads settle',async t=>{
 const f=await fixture(t),pairs=[[0,2]];
 for(let i=1;i<9;i++){const left=f.windows.length;await f.registry.openView({role:'code',entityId:f.refs[0].sourceId});const right=f.windows.length;await f.registry.openView({role:'code',entityId:f.refs[1].sourceId});pairs.push([left,right]);}
 const gate=f.hold(),pending=[];
 for(const [left,right] of pairs.slice(0,8))pending.push(f.invoke('revealComparison',{...f.request,rightWindowId:f.registry.capture(f.event(right)).windowId},f.event(left)));
 const [left,right]=pairs[8];assert.equal((await f.invoke('revealComparison',{...f.request,rightWindowId:f.registry.capture(f.event(right)).windowId},f.event(left))).code,'COMPARISON_NAVIGATION_BUSY');
 f.service.pause();assert.ok((await Promise.all(pending)).every(receipt=>receipt.ok===false));assert.equal(f.service.isIdle(),false);gate.resolve();f.release();await f.service.drain();assert.equal(f.service.isIdle(),true);assert.equal(f.deliveries.length,0);
});
