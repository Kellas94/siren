import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const script=await readFile(new URL('../src/ui/presentation/window.js',import.meta.url),'utf8');
async function fixture(){
 const nodes=new Map(),callbacks={},calls=[];
 class Element{
  textContent='';dataset={};disabled=false;value='';children=[];listeners={};
  replaceChildren(...children){this.children=children;this.textContent='';}
  append(...children){this.children.push(...children);}
  setAttribute(name,value){this[name]=value;}
  addEventListener(name,fn){this.listeners[name]=fn;}
 }
 const ids=['viewStatus','publicSlide','viewTitle','slideList','presenterNotes','position','audienceDisplay','closeView','fullscreen','previousSlide','nextSlide','refreshDeck','openAudience'];for(const id of ids)nodes.set(id,new Element());
 const body=new Element();body.dataset.role='presenter';
 const state={ok:true,sequence:0,deck:{version:'v1',title:'Actual deck',slides:[{id:'slide-a',title:'Public title',notes:'PRIVATE_CURRENT_NOTES'}]},slideId:'slide-a'};
 const bridge={getPresenter:async()=>state,getDisplays:async()=>({ok:true,displays:[]}),getPreview:async()=>({ok:true,frame:{epoch:1,sequence:calls.length,slideId:'slide-a',deckVersion:'v1',publicSlide:{kind:'text',title:'Public title',body:'Public body'}}}),navigate:async()=>{calls.push('navigate');return{ok:true,slideId:'slide-a'};},refreshDeck:async()=>({ok:true}),openAudience:async()=>({ok:true}),onFrame:fn=>callbacks.frame=fn,onFullscreen:fn=>callbacks.fullscreen=fn};
 const document={body,documentElement:{style:{}},getElementById:id=>nodes.get(id),createElement:()=>new Element(),querySelectorAll:()=>['previousSlide','nextSlide','refreshDeck','openAudience','audienceDisplay','fullscreen','closeView'].map(id=>nodes.get(id)),addEventListener:()=>{}};
 vm.runInNewContext(script,{document,window:{sirenPresentation:bridge,sirenWindow:{getView:async()=>({ok:true,view:{role:'presenter',epoch:1,windowId:'owned'}}),onReady:()=>{},closeView:async()=>({ok:true})},sirenViewControl:{onPrepare:fn=>callbacks.prepare=fn,onResume:fn=>callbacks.resume=fn}}});
 for(let n=0;n<20&&body.dataset.publicReady!=='true';n++)await new Promise(resolve=>setImmediate(resolve));
 assert.equal(body.dataset.publicReady,'true');return{nodes,body,bridge,callbacks,calls,state};
}
test('real Presenter UI retains visible notes/slide and releases controls on thrown refresh or Audience transport',async()=>{
 for(const [id,method]of [['refreshDeck','refreshDeck'],['openAudience','openAudience']]){
  const f=await fixture(),slide=f.nodes.get('publicSlide').children[0];f.bridge[method]=async()=>{throw Error('Owned transport unavailable');};
  await assert.doesNotReject(f.nodes.get(id).listeners.click());
  assert.equal(f.nodes.get('publicSlide').children[0],slide);assert.equal(f.nodes.get('presenterNotes').textContent,'PRIVATE_CURRENT_NOTES');
  assert.equal(f.nodes.get(id).disabled,false);assert.match(f.nodes.get('viewStatus').textContent,/unavailable/);assert.equal(f.calls.length,1);
 }
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
