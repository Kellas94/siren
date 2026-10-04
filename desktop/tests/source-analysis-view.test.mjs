import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/ui/code/analysis.js',import.meta.url),'utf8');
function fixture(){
 class Element{children=[];dataset={};listeners={};value='';classList={toggle(){}};append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(key,value){this[key]=value;}addEventListener(name,fn){this.listeners[name]=fn;}removeEventListener(){}focus(){}}
 const button=new Element(),panel=new Element();panel.id='panel';const document={createElement:()=>new Element(),getElementById:()=>new Element(),addEventListener(){},removeEventListener(){}},window={};
 vm.runInNewContext(source,{window,document,crypto:{randomUUID:()=> 'job-a'}});
 let state={ready:true,sourceRef:{sourceId:'source-a',version:1,sha256:'a'.repeat(64)}},resolve,result;const selected=[],cancelled=[],submitted=[];
 const editor={getStatus:()=>state,getState:()=>({doc:{length:500},selection:{main:{from:2,to:40}}}),select:(...range)=>selected.push(range)};
 const right={windowId:'window-b',sourceRef:{sourceId:'source-b',version:2,sha256:'b'.repeat(64)}};
 const bridge={submit:payload=>{submitted.push(payload);return new Promise(done=>{resolve=done;});},cancel:async payload=>{cancelled.push(payload);return {ok:true};},listComparisons:async()=>({ok:true,items:[right]})};
 const view=window.SirenNativeAnalysis.create({button,panel,editorFor:()=>editor,bridge});
 const all=()=>{const nodes=[];const visit=e=>{nodes.push(e);e.children.forEach(visit);};visit(panel);return nodes;},node=id=>all().find(x=>x.id===id);
 const answer=()=>({ok:true,sourceId:'source-a',version:1,jobId:'job-a',status:'partial',coverage:{from:0,to:400,totalUnits:500,truncated:true,syntaxErrors:0,limited:false},result:{definitions:Array.from({length:100},(_,i)=>({name:i?'f'+i:'<img src=x>',kind:'function',line:i+1,from:i,to:i+5,nameFrom:i,nameTo:i+5,parent:null}))}});
 return {view,panel,button,node,all,selected,cancelled,submitted,right,setState:value=>{state={...state,...value};},finish:async(value=answer())=>{resolve(value);await new Promise(done=>setTimeout(done,0));},run:()=>node('analyzeSource').listeners.click()};
}
test('actual structure controller pages 64 literal labels and navigates exact offsets only for current immutable ref',async()=>{
 const f=fixture();f.run();await f.finish();assert.equal(f.node('analysisDefinitions').children.length,64);assert.match(f.node('analysisStatus').textContent,/Partial analysis/);
 const first=f.node('analysisDefinitions').children[0];assert.equal(first.children[0].textContent,'<img src=x>');first.listeners.click();assert.deepEqual(f.selected,[[0,5]]);
 f.all().find(x=>x.textContent==='Next').listeners.click();assert.equal(f.node('analysisDefinitions').children.length,36);
 f.setState({sourceRef:{sourceId:'source-a',version:2,sha256:'b'.repeat(64)}});first.listeners.click();assert.equal(f.selected.length,1);f.view.reconcile();assert.equal(f.node('analysisDefinitions').children.length,0);
});

test('comparison uses a real window choice, paints literal A/B snapshots and explicit approximation, and navigates only current A',async()=>{
 const f=fixture();f.node('analysisScope').value='compare';f.node('analysisScope').listeners.change();await new Promise(done=>setTimeout(done,0));
 assert.equal(f.node('analysisCompareWindow').children.length,1);f.node('analysisCompareWindow').value='window-b';f.run();await new Promise(done=>setTimeout(done,0));
 assert.equal(f.submitted[0].kind,'diff');assert.equal(f.submitted[0].rightWindowId,'window-b');assert.deepEqual(JSON.parse(JSON.stringify(f.submitted[0].rightRef)),f.right.sourceRef);
 await f.finish({ok:true,sourceId:'source-a',version:1,jobId:'job-a',rightRef:f.right.sourceRef,status:'partial',coverage:{left:{from:0,to:500,totalUnits:500},right:{from:0,to:600,totalUnits:600},approximate:true,previewTruncated:true},result:{identical:false,approximate:true,previewTruncated:true,hunks:[{left:{from:8,to:20,fromLine:2,toLine:3,preview:'<script>A</script>'},right:{from:8,to:24,fromLine:2,toLine:4,preview:'new B'},approximate:true}]}});
 assert.match(f.node('analysisStatus').textContent,/Approximate/);assert.match(f.node('analysisStatus').textContent,/preview limited/i);
 const item=f.node('analysisDefinitions').children[0];assert.ok(item.children.some(e=>e.textContent==='<script>A</script>'));item.children.find(e=>e.textContent==='Show in A').listeners.click();assert.deepEqual(f.selected,[[8,20]]);
 f.setState({sourceRef:{sourceId:'source-a',version:2,sha256:'c'.repeat(64)}});item.children.find(e=>e.textContent==='Show in A').listeners.click();assert.equal(f.selected.length,1);f.view.reconcile();assert.equal(f.node('analysisDefinitions').children.length,0);
});
test('late cancelled/Lock/stale replies never repopulate the real panel',async()=>{
 for(const cause of ['cancel','pause','version']){
  const f=fixture();f.run();if(cause==='cancel')f.node('cancelAnalysis').listeners.click();if(cause==='pause')f.view.pause();if(cause==='version'){f.setState({dirty:true});f.view.reconcile();}
  await f.finish();assert.equal(f.node('analysisDefinitions').children.length,0);assert.equal(f.cancelled.length,1);
 }
});
test('dirty/pending edits refuse analysis; selected range request contains immutable metadata and offsets, never text/path',async()=>{
 const f=fixture();f.setState({dirty:true});f.view.reconcile();f.run();assert.equal(f.submitted.length,0);assert.match(f.node('analysisStatus').textContent,/Save source/);f.setState({dirty:false});f.view.reconcile();f.node('analysisScope').value='selection';f.run();assert.deepEqual(JSON.parse(JSON.stringify(f.submitted[0].range)),{from:2,to:40});assert.equal(f.submitted[0].text,undefined);await f.finish();
});

test('Cancel keeps its click target after completion and becomes Clear, so a finishing job cannot redirect the click',async()=>{
 const f=fixture();f.run();await f.finish();const action=f.node('cancelAnalysis');assert.equal(action.hidden,false);assert.equal(action.textContent,'Clear');assert.equal(action.disabled,false);action.listeners.click();assert.equal(f.node('analysisDefinitions').children.length,0);assert.equal(f.submitted.length,1);
});

test('starting a fresh job enables the genuine Cancel control even after changing analysis scope',async()=>{
 const f=fixture();f.node('analysisScope').value='selection';f.node('analysisScope').listeners.change();f.run();const action=f.node('cancelAnalysis');assert.equal(action.disabled,false);assert.equal(action.textContent,'Cancel');action.listeners.click();await f.finish();assert.equal(f.node('analysisDefinitions').children.length,0);assert.equal(f.cancelled.length,1);
});

test('selected map sends only genuine range metadata, draws literal bounded nesting and supports collapse/navigation',async()=>{
 const f=fixture();f.node('analysisScope').value='map';f.node('analysisScope').listeners.change();f.run();assert.equal(f.submitted[0].kind,'map');assert.deepEqual(JSON.parse(JSON.stringify(f.submitted[0].range)),{from:2,to:40});
 await f.finish({ok:true,sourceId:'source-a',version:1,jobId:'job-a',status:'complete',coverage:{from:2,to:40,totalUnits:500,truncated:false,syntaxErrors:0,limited:false},result:{semantics:'syntax-containment',nodes:[{id:0,kind:'selection',label:'Selected code',from:2,to:40,line:1,parent:null},{id:1,kind:'function',label:'<img src=x>',from:3,to:39,line:1,parent:0},{id:2,kind:'call',label:'run()',from:8,to:13,line:2,parent:1}],edges:[{from:0,to:1,kind:'contains'},{from:1,to:2,kind:'contains'}]}});
 assert.equal(f.node('analysisDefinitions').children.length,3);assert.match(f.node('analysisStatus').textContent,/syntax nesting/);const row=f.node('analysisDefinitions').children[1],select=row.children.find(node=>node.dataset.mapNodeId==='1');assert.equal(select.children[0].textContent,'<img src=x>');select.listeners.click();assert.deepEqual(f.selected,[[3,39]]);
 row.children.find(node=>node.dataset.collapseId==='1').listeners.click();assert.equal(f.node('analysisDefinitions').children.length,2);f.node('analysisDefinitions').children[1].children.find(node=>node.dataset.collapseId==='1').listeners.click();assert.equal(f.node('analysisDefinitions').children.length,3);
});
