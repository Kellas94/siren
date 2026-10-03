import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('satellite native metadata observer rejects source text, authority, accessors and invalid refs and unsubscribes exactly',async()=>{
 const code=await readFile(new URL('../src/windows/preload.cjs',import.meta.url),'utf8'),api={},listeners=new Map(),removed=[];
 const context=vm.createContext({require:()=>({contextBridge:{exposeInMainWorld:(name,value)=>{api[name]=value;}},ipcRenderer:{on:(name,callback)=>listeners.set(name,callback),invoke:async()=>({ok:true}),removeListener:(...args)=>removed.push(args)}})});vm.runInContext(code,context);
 const notices=[],off=api.sirenSourceEdit.onReferenceChanged(value=>notices.push(value)),listener=listeners.get('siren:working-source-changed');context.emit=value=>listener({},value);
 const ref={sourceId:'native-source',version:2,sha256:'a'.repeat(64)};
 vm.runInContext(`emit(${JSON.stringify(ref)})`,context);assert.equal(notices.length,1);assert.equal(Object.isFrozen(notices[0]),true);assert.deepEqual({...notices[0]},ref);
 for(const value of [{...ref,text:'PRIVATE_CODE'},{...ref,projectId:'foreign'},{...ref,nonce:'fake'}, {...ref,version:0},{...ref,sha256:'bad'}])vm.runInContext(`emit(${JSON.stringify(value)})`,context);
 vm.runInContext('globalThis.touched=false;const x={sourceId:"native-source",version:3};Object.defineProperty(x,"sha256",{enumerable:true,get(){touched=true;return "a".repeat(64);}});emit(x);emit(Object.create({sourceId:"native-source",version:3,sha256:"a".repeat(64)}));',context);
 assert.equal(context.touched,false);assert.equal(notices.length,1);off();assert.equal(removed.length,1);assert.equal(removed[0][0],'siren:working-source-changed');assert.equal(removed[0][1],listener);
});

async function noticesFixture({reload=async()=>true}={}){
 const code=await readFile(new URL('../src/ui/code/source-changes.js',import.meta.url),'utf8'),timers=new Map(),window={},reloads=[],retained=[];let serial=0,callback=null,current=true;
 const state={ready:true,dirty:false,pending:0,saving:false,fenced:false,sourceRef:{sourceId:'owned-source',version:1,sha256:'1'.repeat(64)}};
 vm.runInNewContext(code,{window,setTimeout:fn=>{const id=++serial;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id)});
 const controller=window.SirenNativeSourceChanges.create({subscribe:fn=>{callback=fn;return()=>{callback=null;}},sourceIdFor:()=>state.sourceRef.sourceId,stateFor:()=>({...state}),isCurrent:()=>current,onReload:async()=>{reloads.push(true);return reload();},onRetained:ref=>retained.push(ref),onClear:()=>{}});
 return {state,controller,reloads,retained,change:ref=>callback?.(ref),tick:()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn();}},timers,retire:()=>{current=false;}};
}

test('other-window notices coalesce and refresh only a clean idle view, ignoring unrelated and old versions',async()=>{
 const f=await noticesFixture();for(const version of [2,3,4])f.change({sourceId:'owned-source',version,sha256:String(version).repeat(64)});
 assert.equal(f.timers.size,1);f.tick();assert.equal(f.reloads.length,1);
 f.change({sourceId:'foreign',version:8,sha256:'a'.repeat(64)});f.change({...f.state.sourceRef});f.tick();assert.equal(f.reloads.length,1);
 f.controller.dispose();
});

test('failed clean refresh retains its notice without an unbounded retry loop; a newer native version may try once',async()=>{
 const f=await noticesFixture({reload:async()=>false});
 f.change({sourceId:'owned-source',version:2,sha256:'2'.repeat(64)});f.tick();
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(f.reloads.length,1);assert.equal(f.retained.length,1);assert.equal(f.timers.size,0);
 f.controller.reconcile();f.tick();assert.equal(f.reloads.length,1);
 f.change({sourceId:'owned-source',version:3,sha256:'3'.repeat(64)});f.tick();
 for(let i=0;i<10;i++)await Promise.resolve();
 assert.equal(f.reloads.length,2);assert.equal(f.retained.at(-1).version,3);assert.equal(f.timers.size,0);
 f.controller.dispose();
});

test('dirty, pending, fenced or retiring view preserves local work and never silently reloads it',async()=>{
 const f=await noticesFixture(),ref={sourceId:'owned-source',version:2,sha256:'2'.repeat(64)};
 f.state.dirty=true;f.change(ref);f.tick();assert.equal(f.reloads.length,0);assert.equal(f.retained.length,1);
 f.state.dirty=false;f.state.pending=1;f.controller.reconcile();f.tick();assert.equal(f.reloads.length,0);
 f.state.pending=0;f.state.fenced=true;f.controller.reconcile();f.tick();assert.equal(f.reloads.length,0);
 f.state.fenced=false;f.controller.reconcile();assert.equal(f.timers.size,1);f.retire();f.tick();assert.equal(f.reloads.length,0);
 f.controller.dispose();f.change(ref);f.tick();assert.equal(f.reloads.length,0);
});
