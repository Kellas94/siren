import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {NativePresentationIPC} from '../src/windows/presentation-ipc.mjs';
async function fixture(){
 const windows=[];let active=true,calls=[],openHook=()=>{};
 const registry=new WindowRegistry({authorize:r=>active?{projectId:'own',mode:'normal',access:r.role==='audience'?'presentation':'read',entityIds:['diagram-a']}:null,createWindow:async options=>{const w=new EventEmitter();w.id=windows.length+1;w.dead=false;w.isDestroyed=()=>w.dead;w.isMinimized=()=>false;w.restore=w.focus=w.close=()=>{};w.destroy=()=>{w.dead=true;w.webContents.emit('destroyed');w.emit('closed');};const wc=w.webContents=new EventEmitter();Object.assign(wc,{id:w.id+100,getURL:()=>wc.mainFrame.url,mainFrame:{url:options.mainFrameUrl},isDestroyed:()=>w.dead});windows.push(w);return w;}});
 for(const role of ['presenter','audience','docs'])await registry.openView({role,entityId:'diagram-a'});
 const event=i=>({sender:windows[i].webContents,senderFrame:windows[i].webContents.mainFrame}),session={getPresenter:()=>({ok:true,deck:{deckId:'diagram-a',slides:[{notes:'PRIVATE_PRESENTER'}]}}),getPreview:()=>({ok:true,frame:{publicSlide:{kind:'text',body:'Public'}}}),getFrame:()=>({ok:true,frame:{publicSlide:{kind:'text',body:'Public'}}}),acknowledge:()=>({ok:true}),navigate:async(_g,p)=>{calls.push(p);return {ok:true};},refreshDeck:async()=>({ok:true}),bindAudience:()=>({ok:true})};
 const ipc=new NativePresentationIPC({registry,sessionFor:()=>session,displays:()=>[{id:'1',label:'Owned display',privatePath:'FORBIDDEN'}],setFullscreen:(_g,enabled)=>{calls.push(enabled);return {ok:true};},openAudience:async()=>{const view=await registry.openView({role:'audience',entityId:'diagram-a'});await openHook();return {view,grant:registry.capture(event(windows.length-1))};}});
 return {ipc,registry,windows,event,calls,setActive:value=>active=value,setOpenHook:value=>openHook=value};
}
test('Audience has only public-frame/ACK and own fullscreen methods; Presenter notes never cross roles',async()=>{
 const f=await fixture();for(const method of ['getPresenter','getPreview','navigate','refreshDeck','openAudience','getDisplays'])assert.equal((await f.ipc.invoke({event:f.event(1),method,payload:{}})).ok,false);
 assert.equal(JSON.stringify(await f.ipc.invoke({event:f.event(1),method:'getFrame'})).includes('PRIVATE'),false);assert.equal((await f.ipc.invoke({event:f.event(0),method:'getFrame'})).ok,false);
 assert.equal((await f.ipc.invoke({event:f.event(0),method:'getPresenter'})).deck.slides[0].notes,'PRIVATE_PRESENTER');
});
test('unregistered, subframe, same-URL replaced and other module callers cannot invoke presentation',async()=>{
 const f=await fixture();for(const event of [f.event(2),{sender:f.windows[0].webContents,senderFrame:{url:f.event(0).senderFrame.url}},{sender:{},senderFrame:{}}])assert.equal((await f.ipc.invoke({event,method:'getPresenter'})).ok,false);
 const old=f.event(0);f.windows[0].webContents.mainFrame={url:old.senderFrame.url};assert.equal((await f.ipc.invoke({event:old,method:'getPresenter'})).ok,false);
});
test('display projection removes adapter private fields and fullscreen accepts no caller-supplied identity',async()=>{
 const f=await fixture();assert.deepEqual(await f.ipc.invoke({event:f.event(0),method:'getDisplays'}),{ok:true,displays:[{id:'1',label:'Owned display'}]});
 for(const payload of [{enabled:true,windowId:'other'},{enabled:'yes'}])assert.equal((await f.ipc.invoke({event:f.event(1),method:'setFullscreen',payload})).ok,false);
 assert.equal((await f.ipc.invoke({event:f.event(1),method:'setFullscreen',payload:{enabled:true}})).ok,true);assert.deepEqual(f.calls,[true]);
});
test('opening Audience binds native grants and refuses role/project/deck fields from the renderer',async()=>{
 const f=await fixture();assert.equal((await f.ipc.invoke({event:f.event(0),method:'openAudience',payload:{displayId:'1'}})).view.role,'audience');
 for(const payload of [{deckId:'outside'},{role:'presenter'},{displayId:'../../outside'}])assert.equal((await f.ipc.invoke({event:f.event(0),method:'openAudience',payload})).ok,false);
});
test('revocation while an Audience factory is pending destroys its owned view instead of returning success',async()=>{
 const f=await fixture();f.setOpenHook(()=>f.windows[0].destroy());const result=await f.ipc.invoke({event:f.event(0),method:'openAudience',payload:{}});assert.equal(result.ok,false);assert.equal(f.windows.at(-1).isDestroyed(),true);
});
