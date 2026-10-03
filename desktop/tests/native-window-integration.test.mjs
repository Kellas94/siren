import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';
import { WindowRegistry } from '../src/windows/registry.mjs';
import { invokeWindow } from '../src/windows/ipc.mjs';
import { nativeViewFactory } from '../src/windows/factory.mjs';
import { workspaceEntities } from '../src/windows/entities.mjs';
import { failure } from '../src/ipc.mjs';
const main = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const slice = (a,b) => { const start = main.indexOf(a); const stop = main.indexOf(b,start); assert.ok(start>=0 && stop>start); return main.slice(start,stop); };
const sourceId = '11111111-1111-4111-8111-111111111111';
function fixture() {
  let serial = 10; const handles = []; let unlocked = true; let failLoad = false; let failDestroy = false; let delayLoad; let failAdmission; let failJournal=false; let closeErrors=0;
  class NativeWindow extends EventEmitter {
    destroyed = false; shown = false;
    constructor(options = {}) { super(); this.id=serial++; this.options=options; handles.push(this); const wc = new EventEmitter();
      wc.id=this.id+100; wc.mainFrame={url:''}; wc.isDestroyed=()=>this.destroyed; wc.getURL=()=>wc.mainFrame.url; wc.setWindowOpenHandler=()=>{}; wc.executeJavaScript=async()=>{}; wc.send=()=>{if(failAdmission==='send' && options.show===false) throw new Error('Owned send failure private-path');}; this.webContents=wc;
    }
    isDestroyed() { return this.destroyed; } isMinimized() { return false; } restore() {} focus() {} close() { let cancelled=false; this.emit('close',{preventDefault(){cancelled=true;}}); if(!cancelled)this.destroy(); }
    destroy() { if (failDestroy && this.options.show===false) throw new Error('Owned boundary destruction failed'); this.destroyed=true; this.webContents.emit('destroyed'); this.emit('closed'); }
    show() { if(failAdmission==='show') throw new Error('Owned show failure private-path'); this.shown=true; }
    async loadURL(url) { this.webContents.mainFrame.url=url; if(delayLoad) await delayLoad; if(failLoad) throw new Error('Owned load failure'); }
  }
  const owner = new NativeWindow(); owner.webContents.mainFrame.url='siren://app/app.html'; const handlers=new Map();
  const snapshot = { schema:2, project:{id:'owned_project'}, revision:2, json:JSON.stringify({workpapers:[{id:'doc_a'},{id:'doc_b'}]}), sourceRefs:[{sourceId,version:1,sha256:'a'.repeat(64)}] };
  const context = vm.createContext({ WindowRegistry,invokeWindow,nativeViewFactory,workspaceEntities,failure,resolve,here:'/owned/src',BrowserWindow:NativeWindow,window:owner,
    screen:{getPrimaryDisplay:()=>({id:1}),getAllDisplays:()=>[{id:1,workArea:{x:0,y:40,width:1280,height:800}}]},
    localPin:{state:()=>({unlocked})},selectedId:'owned_project',snapshot,mode:'normal',nativeReadonly:false,accountQuiesced:false,pinTransition:false,writes:new Set(),bootstrap:{mode:'normal',snapshot,readonly:true},
    ipcMain:{on:(name,fn)=>handlers.set(name,fn),handle:(name,fn)=>handlers.set(name,fn)},
    app:{getVersion:()=> 'fixture'},processIdentity:{owned:true},sessionId:'fixture',journal:{recordSession:async()=>{if(failJournal)throw new Error('Owned journal failure');}},dialog:{showErrorBox:()=>{closeErrors++;}},
  });
  vm.runInContext(slice('const nativeShells =','const desktopCommand =') + '\n' + slice("ipcMain.on('siren:bootstrap'",'let readyRecorded') + '\n' + slice("ipcMain.handle('siren:windows'",'window.webContents.setWindowOpenHandler') + '\n' + slice('let closing =','app.on(\'window-all-closed\'') + ';globalThis.registry=windowRegistry;globalThis.retire=retireNativeViews;',context);
  const event=()=>({sender:owner.webContents,senderFrame:owner.webContents.mainFrame});
  const bootstrap=()=>{const request=event(); handlers.get('siren:bootstrap')(request); return request.returnValue;};
  const invoke=(method,payload,eventOverride=event())=>handlers.get('siren:windows')(eventOverride,method,payload);
  return {context,owner,handles,event,bootstrap,invoke,setLocked:value=>{unlocked=!value;},setFaults:(load,destroy)=>{failLoad=load;failDestroy=destroy;},setDelay:promise=>{delayLoad=promise;},setAdmission:kind=>{failAdmission=kind;},failJournal:()=>{failJournal=true;},closeErrors:()=>closeErrors};
}
test('actual main binds exact native owner, scoped shell entries and locked null bootstrap',async()=>{
  const f=fixture(); f.setLocked(true); assert.equal(f.bootstrap().snapshot,null); assert.equal(f.context.registry.listViews().length,0);
  assert.equal((await f.invoke('openView',{role:'docs',entityId:'doc_a'})).code,'SENDER_REFUSED');
  f.setLocked(false); assert.equal(f.bootstrap().snapshot.project.id,'owned_project');
  const docs=await f.invoke('openView',{role:'docs',entityId:'doc_a'}); const code=await f.invoke('openView',{role:'code',entityId:sourceId,version:1});
  assert.equal(docs.ok,true); assert.equal(code.ok,true); assert.equal(f.handles.slice(1).every(w=>w.shown),true);
  assert.equal((await f.invoke('openView',{role:'code',entityId:sourceId,version:2})).ok,false);
  assert.equal((await f.invoke('openView',{role:'code',entityId:'doc_a'})).ok,false);
  const satellite=f.handles[1]; const sender={sender:satellite.webContents,senderFrame:satellite.webContents.mainFrame};
  assert.equal((await f.invoke('listViews',undefined,sender)).code,'ACCESS_REFUSED');
  assert.equal(f.context.registry.listViews().length,3);
  f.context.retire(); assert.equal(f.owner.isDestroyed(),false); assert.equal(f.handles.slice(1).every(w=>w.isDestroyed()),true); assert.equal(f.context.registry.listViews().length,0);
});
test('main failed factory destruction fences every later open and data bootstrap until native handles are destroyed',async()=>{
  const f=fixture(); f.bootstrap(); f.setFaults(true,true);
  assert.equal((await f.invoke('openView',{role:'docs',entityId:'doc_a'})).code,'WINDOW_DESTROY_FAILED');
  f.setFaults(false,false);
  assert.equal((await f.invoke('openView',{role:'docs',entityId:'doc_b'})).code,'PROJECT_BUSY');
  assert.equal(f.bootstrap().snapshot,null); assert.equal(f.handles[1].isDestroyed(),false);
  f.context.retire(); assert.equal(f.handles[1].isDestroyed(),true); assert.equal(f.bootstrap().snapshot.project.id,'owned_project');
});
test('actual main revokes a hidden in-flight native factory before a transition can admit or show it',async()=>{
  const f=fixture(); f.bootstrap(); let release; f.setDelay(new Promise(r=>{release=r;}));
  const pending=f.invoke('openView',{role:'docs',entityId:'doc_a'}); assert.equal(f.handles.length,2); assert.equal(f.handles[1].shown,false);
  f.context.retire(); release(); assert.equal((await pending).ok,false); assert.equal(f.handles[1].isDestroyed(),true); assert.equal(f.handles[1].shown,false); assert.equal(f.context.registry.listViews().length,0);
});
test('actual ready/send/show failures dispose the admitted shell or fence retained native handles',async()=>{
  for (const kind of ['send','show']) for (const cannotDestroy of [false,true]) {
    const f=fixture(); f.bootstrap(); f.setAdmission(kind); f.setFaults(false,cannotDestroy);
    const result=await f.invoke('openView',{role:'docs',entityId:'doc_a'});
    assert.equal(result.code,cannotDestroy?'WINDOW_DESTROY_FAILED':'OPERATION_FAILED'); assert.equal(JSON.stringify(result).includes('private-path'),false);
    assert.equal(f.context.registry.caller({sender:f.handles[1].webContents,senderFrame:f.handles[1].webContents.mainFrame}),null);
    if(cannotDestroy) assert.equal((await f.invoke('openView',{role:'docs',entityId:'doc_b'})).code,'PROJECT_BUSY');
    else assert.equal(f.handles[1].isDestroyed(),true);
  }
});
test('actual clean-close journal failure retains the owner and restores its trusted grant after shell retirement',async()=>{
  const f=fixture(); f.bootstrap(); await f.invoke('openView',{role:'docs',entityId:'doc_a'}); f.failJournal();
  f.owner.close(); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(f.closeErrors(),1); assert.equal(f.owner.isDestroyed(),false); assert.equal(f.handles[1].isDestroyed(),true);
  assert.equal(f.context.registry.caller(f.event()).role,'workspace');
  assert.equal((await f.invoke('openView',{role:'docs',entityId:'doc_b'})).ok,true);
});
