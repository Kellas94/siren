import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

for(const path of ['preload.cjs','windows/preload.cjs'])test(`${path} bounds native preparation and keeps the draining nonce private`,async()=>{
 const callbacks=new Map(),exposed={},calls=[];
 const electron={contextBridge:{exposeInMainWorld:(name,value)=>exposed[name]=value},ipcRenderer:{on:(name,fn)=>callbacks.set(name,fn),removeListener:(name,fn)=>{if(callbacks.get(name)===fn)callbacks.delete(name)},sendSync:()=>({}),send(){},invoke:async(...args)=>{calls.push(args);return {ok:true}}}};
 vm.runInNewContext(await readFile(new URL('../src/'+path,import.meta.url),'utf8'),{require:()=>electron});
 assert.ok(exposed.sirenViewControl,'Actual preload preparation bridge missing');
 assert.equal(exposed.sirenViewControl.acknowledge,undefined);
 assert.equal(exposed.sirenViewControl.nonce,undefined);
 assert.equal((await exposed.sirenViewControl.saveWorkspace({})).code,'VIEW_NOT_PREPARING');
 let resolve,entered=false;const remove=exposed.sirenViewControl.onPrepare(()=>{entered=true;return new Promise(done=>resolve=done)});
 const listener=callbacks.get('siren:view-prepare');assert.equal(typeof listener,'function');
 await listener({}, {requestId:'bad',nonce:'bad'});assert.equal(entered,false);assert.equal(calls.length,0);
 const ticket={requestId:'12345678-1234-4234-8234-123456789abc',nonce:'22345678-1234-4234-8234-123456789abc'};
 const pending=listener({},ticket);assert.equal(entered,true);
 await exposed.sirenViewControl.saveWorkspace({projectId:'owned'});
 assert.equal(calls.at(-1)[0],'siren:workspace-flush');assert.equal(calls.at(-1)[1],'saveProject');assert.equal(calls.at(-1)[2].nonce,ticket.nonce);
 resolve({ok:true,receipts:['renderer-cannot-supply-proofs']});await pending;
 assert.equal(calls.at(-1)[0],'siren:view-ack');assert.deepEqual(Object.keys(calls.at(-1)[1]).sort(),['ok','requestId']);
 assert.equal((await exposed.sirenViewControl.saveWorkspace({})).code,'VIEW_NOT_PREPARING');
 remove();assert.equal(callbacks.has('siren:view-prepare'),false);
});
