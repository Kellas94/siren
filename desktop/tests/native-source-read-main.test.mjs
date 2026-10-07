import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {nativeSourceContext,mainSlice} from './fixtures/source-main-context.mjs';
test('actual native main mounts bounded readonly source leases, keeps selected versions and tracks outstanding reads',async()=>{
 const f=await nativeSourceContext();
 vm.runInContext(mainSlice("ipcMain.handle('siren:source-readers'","const invokeNativeWindow="),f.context);
 const handler=f.handlers.get('siren:source-readers');assert.equal(typeof handler,'function');
 const context=await handler(f.event(0),'getReference');assert.equal(context.ok,true);assert.equal(context.readonly,true);assert.equal(context.sourceRef.sha256,f.refs[0].sha256);
 const opening=handler(f.event(0),'openRead',context.sourceRef);assert.equal(f.context.writes.size,1);
 const opened=await opening;assert.equal(opened.ok,true);assert.equal(f.context.writes.size,0);
 const p={sourceId:context.sourceRef.sourceId,version:context.sourceRef.version,readId:opened.readId};
 assert.equal((await handler(f.event(0),'readChunk',{...p,start:0,maxUnits:131072})).text,'exact 😀\r\n');
 assert.equal((await handler(f.event(1),'readChunk',{...p,start:0,maxUnits:2})).code,'ACCESS_REFUSED');
 assert.equal((await handler(f.event(0),'closeRead',p)).ok,true);assert.equal(f.context.writes.size,0);
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('actual native view retirement disposes read sessions before revoking native windows',async()=>{
 const f=await nativeSourceContext();
 vm.runInContext(mainSlice("ipcMain.handle('siren:source-readers'","const invokeNativeWindow="),f.context);
 const handler=f.handlers.get('siren:source-readers'),reference=(await handler(f.event(0),'getReference')).sourceRef,opened=await handler(f.event(0),'openRead',reference);assert.equal(opened.ok,true);
 vm.runInContext(mainSlice('const retireNativeViews','const navigation=')+';globalThis.retire=retireNativeViews;',f.context);
 const order=[];vm.runInContext('globalThis.reads=sourceReads',f.context);const dispose=f.context.reads.dispose.bind(f.context.reads),invalidate=f.registry.invalidateEpoch.bind(f.registry);
 f.context.reads.dispose=()=>{order.push('readers');dispose();};f.registry.invalidateEpoch=options=>{order.push('windows');invalidate(options);};f.context.nativeShells=new Map();
 await f.context.retire();assert.deepEqual(order,['readers','windows']);
 assert.equal((await handler(f.event(0),'getReference')).code,'ACCESS_REFUSED');assert.equal(f.context.writes.size,0);
});
test('both actual preloads expose finite readonly context/read session methods with no write channel',async()=>{
 for(const name of ['preload.cjs','windows/preload.cjs']){
  const source=await readFile(new URL('../src/'+name,import.meta.url),'utf8'),exposed={},calls=[];
  const electron={contextBridge:{exposeInMainWorld:(key,value)=>{exposed[key]=value;}},ipcRenderer:{sendSync:()=>({}),send(){},on(){},removeListener(){},invoke:(...args)=>{calls.push(args);return Promise.resolve({ok:false,code:'UNAVAILABLE'});}}};
  vm.runInNewContext(source,{require:()=>electron});
  assert.deepEqual(Object.keys(exposed.sirenSourceRead||{}).sort(),['closeRead','getReference','openRead','readChunk']);
  await exposed.sirenSourceRead.getReference();assert.deepEqual(calls.at(-1),['siren:source-readers','getReference',undefined]);
  assert.equal(exposed.sirenSourceRead.applyEdit,undefined);assert.equal(exposed.sirenSourceRead.commitSource,undefined);
 }
});
