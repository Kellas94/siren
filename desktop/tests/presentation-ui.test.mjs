import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile(new URL('../src/ui/presentation/notes-export.js',import.meta.url),'utf8')+'\n'+await readFile(new URL('../src/ui/presentation/window.js',import.meta.url),'utf8');
const tick=async()=>{for(let n=0;n<15;n++)await new Promise(resolve=>setImmediate(resolve));};
async function fixture(){
 const nodes=new Map(),callbacks={},calls=[];
 class Element{
  textContent='';dataset={};disabled=false;value='';children=[];listeners={};
  replaceChildren(...children){this.children=children;this.textContent='';}
  append(...children){this.children.push(...children);}
  setAttribute(name,value){this[name]=value;}
  addEventListener(name,fn){this.listeners[name]=fn;}
  removeEventListener(name){delete this.listeners[name];}
 }
 const ids=['editDeck','viewStatus','publicSlide','viewTitle','slideList','presenterNotes','position','audienceDisplay','closeView','fullscreen','previousSlide','nextSlide','refreshDeck','openAudience','exportNotes','revealNotesExport'];for(const id of ids)nodes.set(id,new Element());
 const body=new Element();body.dataset.role='presenter';
 const state={ok:true,sequence:0,deck:{deckId:'deck-a',version:'a'.repeat(64),title:'Actual deck',slides:[{id:'slide-a',title:'Public title',notes:'PRIVATE_CURRENT_NOTES'}]},slideId:'slide-a'};
 const bridge={editDeck:async()=>({ok:true}),getPresenter:async()=>state,getDisplays:async()=>({ok:true,displays:[]}),getPreview:async()=>({ok:true,frame:{epoch:1,sequence:calls.length,slideId:'slide-a',deckVersion:'v1',publicSlide:{kind:'text',title:'Public title',body:'Public body'}}}),navigate:async()=>{calls.push('navigate');return{ok:true,slideId:'slide-a'};},refreshDeck:async()=>({ok:true}),openAudience:async()=>({ok:true}),onFrame:fn=>callbacks.frame=fn,onFullscreen:fn=>callbacks.fullscreen=fn};
 const document={body,documentElement:{style:{}},getElementById:id=>nodes.get(id),createElement:()=>new Element(),querySelectorAll:()=>['previousSlide','nextSlide','refreshDeck','openAudience','audienceDisplay','fullscreen','closeView'].map(id=>nodes.get(id)),addEventListener:(name,fn)=>callbacks[name]=fn};
 const exportBridge={exportNotes:async request=>{calls.push(request);return{ok:true,exportId:'00000000-0000-4000-8000-000000000001',filename:'presentation-notes-00000000-0000-4000-8000-000000000001.txt',bytes:123,sha256:'c'.repeat(64),deckId:'deck-a',deckVersion:state.deck.version};},revealExport:async()=>({ok:true})};
 vm.runInNewContext(script,{document,window:{addEventListener:(name,fn)=>callbacks[name]=fn,SirenAppearancePalette:[{id:'kpmg',mode:'light'},{id:'matrix',mode:'dark'},{id:'dark',mode:'dark'},{id:'light',mode:'light'}],sirenPresenterExport:exportBridge,sirenPresentation:bridge,sirenWindow:{getView:async()=>({ok:true,view:{role:'presenter',epoch:1,windowId:'owned'}}),onReady:()=>{},closeView:async()=>({ok:true})},sirenViewControl:{onPrepare:fn=>callbacks.prepare=fn,onResume:fn=>callbacks.resume=fn}}});
 for(let n=0;n<20&&body.dataset.publicReady!=='true';n++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(body.dataset.publicReady,'true');return{nodes,body,bridge,exportBridge,callbacks,calls,state};
}

test('Presenter theme changes coalesce while busy, use latest slide and leave deck immutable',async()=>{
 const f=await fixture(),before=JSON.stringify(f.state),requests=[];let release;
 f.bridge.navigate=async request=>{requests.push(request);if(requests.length===1)await new Promise(resolve=>release=resolve);return {ok:true,slideId:request.slideId};};
 const change=(theme,mode)=>f.callbacks['siren-appearance']({detail:{theme,mode}});
 change('kpmg','light');await tick();assert.equal(requests.length,1);
 change('matrix','dark');change('kpmg','light');change('matrix','dark');assert.equal(requests.length,1);release();await tick();assert.equal(requests.length,2);assert.equal(requests[1].sequence,requests[0].sequence+1);assert.equal(requests[1].slideId,'slide-a');assert.equal(JSON.stringify(f.state),before);
 change('matrix','dark');change('unknown','light');change('matrix','light');await tick();assert.equal(requests.length,2);
});

test('failed appearance render is not retried and Lock retires queued appearance work',async()=>{
 const f=await fixture();let count=0;f.bridge.navigate=async()=>{count++;return {ok:false};};const change=(theme,mode)=>f.callbacks['siren-appearance']({detail:{theme,mode}});
 change('kpmg','light');await tick();assert.equal(count,1);change('kpmg','light');await tick();assert.equal(count,1);
 let release;f.bridge.navigate=async()=>{count++;await new Promise(resolve=>release=resolve);return {ok:true,slideId:'slide-a'};};change('matrix','dark');await tick();change('kpmg','light');await f.callbacks.prepare();release();await tick();assert.equal(count,2);assert.equal(f.body.dataset.publicReady,'false');
});

test('pagehide retires theme refresh without another native navigation',async()=>{const f=await fixture(),before=f.calls.length;f.callbacks.pagehide();f.callbacks['siren-appearance']({detail:{theme:'matrix',mode:'dark'}});await tick();assert.equal(f.calls.length,before);});
test('real Presenter UI retains visible notes/slide and releases controls on thrown refresh or Audience transport',async()=>{
 for(const [id,method]of [['refreshDeck','refreshDeck'],['openAudience','openAudience']]){
  const f=await fixture(),slide=f.nodes.get('publicSlide').children[0];f.bridge[method]=async()=>{throw Error('Owned transport unavailable');};
  await assert.doesNotReject(f.nodes.get(id).listeners.click());
  assert.equal(f.nodes.get('publicSlide').children[0],slide);assert.equal(f.nodes.get('presenterNotes').textContent,'PRIVATE_CURRENT_NOTES');
  assert.equal(f.nodes.get(id).disabled,false);assert.match(f.nodes.get('viewStatus').textContent,/unavailable/);assert.equal(f.calls.length,1);
 }
});

test('actual Presenter window mounts captured export and prepares by hiding private notes then joining pending action',async()=>{
 const f=await fixture();assert.equal(typeof f.nodes.get('exportNotes').listeners.click,'function','Actual Presenter must mount notes export');let enter,release;const entered=new Promise(r=>enter=r);f.exportBridge.exportNotes=request=>{enter(request);return new Promise(r=>release=r);};
 f.nodes.get('exportNotes').listeners.click();const request=await entered;assert.deepEqual(JSON.parse(JSON.stringify(request)),{deckVersion:'a'.repeat(64)});assert.equal(f.nodes.get('exportNotes').disabled,true);
 let prepared=false;const pending=Promise.resolve(f.callbacks.prepare()).then(result=>{assert.equal(result.ok,true);prepared=true;});assert.equal(f.body.inert,true);assert.equal(f.nodes.get('presenterNotes').textContent,'');await new Promise(r=>setImmediate(r));assert.equal(prepared,false);release({ok:false});await pending;assert.equal(f.nodes.get('revealNotesExport').hidden,true);assert.equal(f.body.dataset.presentationReady,'false');
});

test('Presenter playback keys preserve native button/select defaults and text editing, while canvas shortcuts still navigate',async()=>{
 const f=await fixture();let prevented=0;const event=target=>({key:' ',target,ctrlKey:false,altKey:false,metaKey:false,preventDefault:()=>prevented++});
 for(const tag of ['BUTTON','SELECT','INPUT','TEXTAREA'])f.callbacks.keydown(event({tagName:tag,isContentEditable:false,closest:()=>({})}));
 f.callbacks.keydown(event({tagName:'DIV',isContentEditable:true,closest:()=>null}));await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,1);assert.equal(prevented,0);
 f.callbacks.keydown(event({tagName:'DIV',isContentEditable:false,closest:()=>null}));await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,2);assert.equal(prevented,1);
});
test('Lock during actual refresh follow-up read cannot repopulate private notes or render a late slide',async()=>{
 const f=await fixture();let release,entered;const readEntered=new Promise(resolve=>entered=resolve);
 f.bridge.getPresenter=()=>{entered();return new Promise(resolve=>release=resolve);};
 const refresh=f.nodes.get('refreshDeck').listeners.click();await readEntered;assert.equal(f.nodes.get('refreshDeck').disabled,true);
 assert.equal(f.callbacks.prepare().ok,true);assert.equal(f.body.inert,true);assert.equal(f.nodes.get('presenterNotes').textContent,'');
 release({...f.state,deck:{...f.state.deck,title:'Late private deck',slides:[{id:'late',title:'Late slide',notes:'LATE_PRIVATE_NOTES'}]}});await refresh;
 assert.equal(f.nodes.get('presenterNotes').textContent,'');assert.equal(f.nodes.get('slideList').children.length,0);assert.equal(f.nodes.get('publicSlide').children.length,0);
 assert.equal(f.body.dataset.presentationReady,'false');assert.equal(f.calls.length,1);assert.equal(f.nodes.get('refreshDeck').disabled,true);
});
