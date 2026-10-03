import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {nativeSourceContext as nativeContext,mainSlice as slice} from './fixtures/source-main-context.mjs';
test('actual native main owner allows verified selected schema-2 reads in readonly while preserving legacy write gates',async()=>{
  const f=await nativeContext(),grant=f.registry.capture(f.event(0));
  const result=await f.context.owner.invoke(grant,{kind:'source',method:'getMetrics',payload:{sourceId:f.refs[0].sourceId,version:1}});
  assert.equal(result.ok,true);assert.equal(result.sha256,f.refs[0].sha256);
  const denied=await f.context.owner.invoke(grant,{kind:'source',method:'applyEdit',payload:{sourceId:f.refs[0].sourceId,expectedVersion:1,operationId:'must-not-edit',start:0,end:0,insertedText:'bad'}});
  assert.equal(denied.ok,false);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('actual main source gate refuses PIN transitions, shell failures, quiescence, legacy source IDs and unselected source refs',async()=>{
  for(const change of ['pinTransition','nativeShellFailure','accountQuiesced','selectionQuiesced','legacy','refs']){
    const f=await nativeContext(),grant=f.registry.capture(f.event(0));
    if(change==='selectionQuiesced')f.context.writes.selectionQuiesced=true;else if(change==='legacy')f.context.snapshot={...f.selected,schema:1};else if(change==='refs')f.context.snapshot={...f.selected,sourceRefs:[]};else f.context[change]=true;
    assert.equal((await f.context.owner.invoke(grant,{kind:'source',method:'getMetrics',payload:{sourceId:f.refs[0].sourceId,version:1}})).code,'ACCESS_REFUSED',change);
    assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
  }
});
test('actual main mounts the finite read-only source channel and tracks its pending operation in the shared write/drain set',async()=>{
  const f=await nativeContext();vm.runInContext(slice("ipcMain.handle('siren:sources'","ipcMain.handle('siren:windows'"),f.context);
  const handler=f.handlers.get('siren:sources');assert.equal(typeof handler,'function');
  const pending=handler(f.event(0),'getMetrics',{sourceId:f.refs[0].sourceId,version:1});assert.equal(f.context.writes.size,1);
  assert.equal((await pending).ok,true);assert.equal(f.context.writes.size,0);
  assert.equal((await handler(f.event(0),'applyEdit',{})).code,'REQUEST_REFUSED');assert.equal(f.context.writes.size,0);
  assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('both actual preloads expose only two source getters through the finite native channel',async()=>{
  for(const name of ['preload.cjs','windows/preload.cjs']){
    const source=await readFile(new URL('../src/'+name,import.meta.url),'utf8'),exposed={},calls=[];
    const electron={contextBridge:{exposeInMainWorld:(name,value)=>{exposed[name]=value;}},ipcRenderer:{sendSync:()=>({}),send(){},on(){},removeListener(){},invoke:(...args)=>{calls.push(args);return Promise.resolve({ok:false,code:'UNAVAILABLE'});}}};
    vm.runInNewContext(source,{require:()=>electron});
    assert.deepEqual(Object.keys(exposed.sirenSource||{}).sort(),['getMetrics','readRange']);
    await exposed.sirenSource.getMetrics({sourceId:'owned',version:1});assert.equal(calls.at(-1)[0],'siren:sources');assert.equal(calls.at(-1)[1],'getMetrics');
    assert.equal(exposed.sirenSource.applyEdit,undefined);assert.equal(exposed.sirenSource.commitSource,undefined);
  }
});

test('actual main confines a Code window to its admitted version even when another version is selected in the same project',async()=>{
  const f=await nativeContext(),ref=f.refs[0];
  const edited=await f.sources.applyEdit({projectId:f.selected.project.id,edit:{sourceId:ref.sourceId,expectedVersion:1,operationId:'later-code-version',start:0,end:0,insertedText:'later'}});
  assert.equal(edited.ok,true);
  const current=await f.sources.getMetrics({projectId:f.selected.project.id,sourceId:ref.sourceId,version:2});
  f.context.snapshot={...f.selected,sourceRefs:[...f.refs,{sourceId:ref.sourceId,version:2,sha256:current.sha256}]};
  await f.registry.openView({role:'code',entityId:ref.sourceId,version:1});
  const grant=f.registry.capture(f.event(2));assert.deepEqual(f.registry.sourceScope(grant),{sourceId:ref.sourceId,version:1});
  assert.equal(f.registry.sourceScope({...grant}),null);
  vm.runInContext(slice("ipcMain.handle('siren:sources'","ipcMain.handle('siren:windows'"),f.context);
  const handler=f.handlers.get('siren:sources');
  assert.equal((await handler(f.event(2),'getMetrics',{sourceId:ref.sourceId,version:1})).sha256,ref.sha256);
  assert.equal((await handler(f.event(2),'getMetrics',{sourceId:ref.sourceId,version:2})).code,'ACCESS_REFUSED');
  assert.equal((await handler(f.event(2),'getMetrics',{sourceId:ref.sourceId})).code,'REQUEST_REFUSED');
});
