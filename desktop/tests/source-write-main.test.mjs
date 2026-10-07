import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {nativeSourceContext,mainSlice} from './fixtures/source-main-context.mjs';

test('actual main mutation channel refuses normal readonly/historical/foreign views and tracks genuine admitted draft writes',async()=>{
 const f=await nativeSourceContext();vm.runInContext(mainSlice("ipcMain.handle('siren:source-readers'","const invokeNativeWindow="),f.context);
 const handler=f.handlers.get('siren:source-mutations'),ref=f.refs[0],edit={sourceId:ref.sourceId,expectedVersion:1,operationId:'actual-main-draft',start:0,end:1,insertedText:'X'};
 assert.equal((await handler(f.event(0),'applyEdit',edit)).code,'ACCESS_REFUSED');assert.equal((await handler(f.event(1),'applyEdit',edit)).code,'ACCESS_REFUSED');
 f.context.mode='normal';f.context.nativeReadonly=false;
 vm.runInContext('workingSources=new NativeWorkingSources({registry:windowRegistry,owner:workspaceOwner,enabled:workingEnabled,snapshotFor:()=>snapshot});globalThis.working=workingSources;',f.context);
 assert.equal((await f.context.working.admit(f.registry.capture(f.event(0)))).ok,true);
 const pending=handler(f.event(0),'applyEdit',edit);assert.equal(f.context.writes.size,1);const receipt=await pending;assert.equal(receipt.ok,true);assert.equal(f.context.writes.size,0);
 assert.deepEqual(await f.sources.exportSource({projectId:f.selected.project.id,sourceId:ref.sourceId,version:2}),Buffer.from('Xxact 😀\r\n'));
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 f.context.pinTransition=true;
 assert.equal((await f.handlers.get('siren:source-readers')(f.event(0),'getReference')).code,'ACCESS_REFUSED');
 f.context.working.dispose();assert.equal((await handler(f.event(0),'commitSource',{sourceId:ref.sourceId,expectedVersion:2,operationId:'retired-save'})).code,'ACCESS_REFUSED');
});

test('satellite preparation keeps the source drain nonce private and never exposes it in the public bridge',async()=>{
 const source=await readFile(new URL('../src/windows/preload.cjs',import.meta.url),'utf8'),exposed={},listeners=new Map(),calls=[];
 const electron={contextBridge:{exposeInMainWorld:(name,value)=>{exposed[name]=value;}},ipcRenderer:{on:(name,fn)=>listeners.set(name,fn),removeListener(){},invoke:async(...args)=>{calls.push(args);return {ok:true};}}};
 vm.runInNewContext(source,{require:()=>electron});
 assert.equal(exposed.sirenViewControl.nonce,undefined);assert.equal(exposed.sirenSource.nonce,undefined);
 const payload={sourceId:'owned',expectedVersion:1,operationId:'commit'};
 await exposed.sirenSource.commitSource(payload);assert.deepEqual(calls.at(-1),['siren:source-mutations','commitSource',payload,undefined]);
 exposed.sirenViewControl.onPrepare(async()=>{await exposed.sirenSource.commitSource(payload);return {ok:true};});
 const ticket={nonce:'11111111-1111-4111-8111-111111111111',requestId:'22222222-2222-4222-8222-222222222222'};
 await listeners.get('siren:view-prepare')({},ticket);
 const drained=calls.find(call=>call[0]==='siren:source-mutations'&&call[3]===ticket.nonce);assert.ok(drained);assert.equal(calls.at(-1)[0],'siren:view-ack');
 await exposed.sirenSource.commitSource(payload);assert.equal(calls.at(-1)[3],undefined);
});
