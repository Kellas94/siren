import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {nativeSourceContext,mainSlice} from './fixtures/source-main-context.mjs';

test('production native Docs is mounted through the shared owner and receives only its selected document',async()=>{
 const f=await nativeSourceContext();
 vm.runInContext(mainSlice("ipcMain.handle('siren:docs-read'","ipcMain.handle('siren:windows'"),f.context);
 const handler=f.handlers.get('siren:docs-read');assert.equal(typeof handler,'function');
 const pending=handler(f.event(1),'getDocument');assert.equal(f.context.writes.size,1);const result=await pending;
 assert.equal(result.ok,true);assert.equal(result.readonly,true);assert.equal(result.document.id,'doc-a');assert.equal(f.context.writes.size,0);
 assert.equal((await handler(f.event(0),'getDocument')).code,'ACCESS_REFUSED');assert.equal((await handler(f.event(1),'applyDocument',{})).code,'REQUEST_REFUSED');
 f.context.pinTransition=true;assert.equal((await handler(f.event(1),'getDocument')).code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('both production preloads expose one readonly Docs method without an entity or mutation selector',async()=>{
 for(const name of ['preload.cjs','windows/preload.cjs']){
  const source=await readFile(new URL('../src/'+name,import.meta.url),'utf8'),exposed={},calls=[];
  const electron={contextBridge:{exposeInMainWorld:(key,value)=>{exposed[key]=value;}},ipcRenderer:{sendSync:()=>({}),send(){},on(){},removeListener(){},invoke:(...args)=>{calls.push(args);return Promise.resolve({ok:false});}}};
  vm.runInNewContext(source,{require:()=>electron});assert.deepEqual(Object.keys(exposed.sirenDocsRead||{}),['getDocument']);
  await exposed.sirenDocsRead.getDocument();assert.deepEqual(calls.at(-1),['siren:docs-read','getDocument']);
 }
});
