import {buildDiagramMetadata} from '../build/diagram-metadata.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const transfer=await readFile(new URL('../src/ui/windows/diagram-transfer.js',import.meta.url),'utf8');
const controller=await readFile(new URL('../src/ui/windows/diagram.js',import.meta.url),'utf8');
const annotations=buildDiagramMetadata()+'\n'+await readFile(new URL('../src/ui/diagram/annotations.js',import.meta.url),'utf8');
const historyView=await readFile(new URL('../src/ui/diagram/history-view.js',import.meta.url),'utf8');
const walkthrough=await readFile(new URL('../src/ui/diagram/walkthrough.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const elements=new Map(),created=[],events=new Map(),intervals=[];let shelfResolve,shelfCalls=0,refreshes=0,prepare,resume;
 const element=()=>{const node={style:{},dataset:{},hidden:false,addEventListener(){},removeEventListener(){},before(){},append(){},replaceChildren(){},setAttribute(){},removeAttribute(){},remove(){}};created.push(node);return node;};
 const get=id=>{const dynamic=created.find(node=>node.id===id);if(dynamic)return dynamic;if(!elements.has(id))elements.set(id,element());return elements.get(id);};
 const view={windowId:'12345678-1234-4234-8234-123456789abc',role:'diagram'},shelf=new Promise(resolve=>{shelfResolve=resolve;});
 const part=()=>({paint(){},commit:()=>true,isEditing:()=>false,pause(){},dispose(){}});
 const document={getElementById:get,createElement:element,body:{dataset:{}},documentElement:{style:{}}};
 const window={SirenPresentationAuthoring:{create:()=>({paint(){},reset(){},dispose(){}})},sirenDeckNavigation:{onAuthoring:()=>()=>{}},sirenWindow:{getView:async()=>({ok:true,view}),onReady(){}},sirenWindowDock:{getShelf:()=>{shelfCalls++;return shelf;}},addEventListener:(name,fn)=>events.set(name,fn),
  SirenNativeDiagramStyleView:{create:part},SirenNativeDiagramBuildView:{create:part},SirenNativeGuidedView:{create:part},SirenNativeDiagramSession:{create:()=>({invalidate(){},refresh(){refreshes++;return Promise.resolve(true);},pause:async()=>false,resume(){},dispose(){}})},
  SirenNativeViewIdentity:{clear(){}},sirenDiagramRead:{},sirenDiagramEdit:{onReferenceChanged:()=>()=>{}},sirenViewControl:{onPrepare(fn){prepare=fn;},onResume(fn){resume=fn;}}};
 const context={window,document,setInterval:fn=>{intervals.push(fn);return 1;},clearInterval(){},clearTimeout(){},matchMedia:()=>({matches:false,addEventListener(){}}),ResizeObserver:class{observe(){}disconnect(){}}};
 runInNewContext(transfer,context);runInNewContext(annotations+'\n'+historyView+'\n'+walkthrough+'\n'+controller,context);
 return {window,document,get,view,events,intervals,prepare:()=>prepare(),resume:()=>resume(),refreshes:()=>refreshes,shelfCalls:()=>shelfCalls,resolve:value=>shelfResolve(value)};
}
test('actual Diagram controller waits for its native placement before reading or exposing content',async()=>{
 const f=fixture();await tick();assert.equal(f.shelfCalls(),1);assert.equal(f.refreshes(),0,'Source readiness must not precede header placement');
 let ready=false;f.window.SirenNativeDiagramTransfer.whenPlaced().then(value=>{ready=value;});
 f.resolve({ok:true,items:[{...f.view,placement:'attached'}]});await tick();
 assert.equal(ready,true);assert.equal(f.document.body.dataset.nativePlacement,'attached');assert.equal(f.get('transferView').hidden,false);assert.equal(f.refreshes(),1);
 f.intervals[0]();await tick();assert.equal(f.refreshes(),1,'Placement polling must not reload a working draft');
});
test('foreign or invalid shelf placement never admits Diagram source readiness',async()=>{
 for(const item of [{windowId:'foreign',role:'diagram',placement:'attached'},{windowId:'12345678-1234-4234-8234-123456789abc',role:'code',placement:'attached'},{windowId:'12345678-1234-4234-8234-123456789abc',role:'diagram',placement:'floating'}]){
  const f=fixture();f.resolve({ok:true,items:[item]});await tick();assert.equal(f.refreshes(),0);assert.equal(f.document.body.dataset.nativePlacement,undefined);assert.equal(f.get('transferView').hidden,true);
  f.events.get('unload')();assert.equal(await f.window.SirenNativeDiagramTransfer.whenPlaced(),false);
 }
});
test('placement arriving during pause or after retirement cannot start a source read',async()=>{
 for(const phase of ['paused','retired']){
  const f=fixture();await tick();if(phase==='paused')await f.prepare();else f.events.get('pagehide')();
  f.resolve({ok:true,items:[{...f.view,placement:'detached'}]});await tick();assert.equal(f.refreshes(),0,phase);
  if(phase==='paused'){f.resume();await tick();assert.equal(f.refreshes(),1,'A surviving empty view reconnects after legitimate resume');}
 }
});
