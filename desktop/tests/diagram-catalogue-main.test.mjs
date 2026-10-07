import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {catalogueContext} from './fixtures/catalogue-context.mjs';
import {NativeDiagramCatalogue} from '../src/windows/diagram-catalogue.mjs';
import {mainSlice} from './fixtures/source-main-context.mjs';

test('actual main channel tracks the full append AND suspended admission; private flush cannot create',async()=>{
 const f=await catalogueContext(),handlers=new Map(),writes=new Set(),service=new NativeDiagramCatalogue(f.adapters);
 const realm=vm.createContext({ipcMain:{handle:(channel,fn)=>handlers.set(channel,fn)},diagramCatalogue:service,writes,nativeShellFailure:false});
 vm.runInContext(mainSlice("ipcMain.handle('siren:diagram-catalogue'","ipcMain.handle('siren:diagram-export'"),realm);
 const handler=handlers.get('siren:diagram-catalogue');assert.equal(typeof handler,'function');const payload={entryId:'starter:sequence',title:'Actual main transport',operationId:'main-catalogue-b'};
 assert.equal((await handler(f.event(0),'createDiagram',payload,'private-flush')).code,'FLUSH_REFUSED');assert.equal(writes.size,0);
 let entered,release;const ready=new Promise(r=>entered=r);f.setFactory(async()=>{entered();await new Promise(r=>release=r);});const pending=handler(f.event(0),'createDiagram',payload);await ready;assert.equal(writes.size,1);release();const receipt=await pending;assert.equal(receipt.ok,true);assert.equal(receipt.opening.ok,true);assert.equal(writes.size,0);
});
for(const path of ['preload.cjs','windows/preload.cjs'])test('actual '+path+' exposes only finite catalogue browse/create and no flushing identity',async()=>{
 const exposed={},calls=[],listeners=new Map();
 const electron={contextBridge:{exposeInMainWorld:(name,api)=>exposed[name]=api},ipcRenderer:{send(){},sendSync:()=>({}),on:(name,fn)=>listeners.set(name,fn),once(){},removeListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);},invoke:async(...args)=>{calls.push(args);return {ok:true};}}};
 vm.runInNewContext(await readFile(new URL('../src/'+path,import.meta.url),'utf8'),{require:()=>electron});
 const bridge=exposed.sirenDiagramCatalogue;assert.equal(Object.keys(bridge).sort().join(','),'createDiagram,getPage');assert.equal(Object.isFrozen(bridge),true);await bridge.getPage({cursor:0,limit:20});assert.deepEqual(calls.at(-1).slice(0,2),['siren:diagram-catalogue','getPage']);assert.equal(calls.at(-1).length,3);
 const input={entryId:'starter:flowchart',title:'Separate',operationId:'finite-preload'};await bridge.createDiagram(input,'cannot-forward-a-flush-ticket');assert.deepEqual(calls.at(-1),['siren:diagram-catalogue','createDiagram',input]);
 if(path==='preload.cjs'){let notices=0;const off=exposed.sirenHome.onCatalogChanged(()=>notices++);listeners.get('siren:home-catalogue-changed')({},'ignored-private-metadata');assert.equal(notices,1);off();assert.equal(listeners.has('siren:home-catalogue-changed'),false);}
});
