import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/windows/preload.cjs',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const exposed={},ipc=new EventEmitter(),calls=[];ipc.invoke=async(...args)=>{calls.push(args);return {ok:true};};
 vm.runInNewContext(source,{require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(name,api)=>exposed[name]=api},ipcRenderer:ipc};},Object,Reflect,Number,Promise});
 const ticket={requestId:'12345678-1234-1234-1234-123456789abc',sourceRef:{sourceId:'source-b',version:2,sha256:'b'.repeat(64)},range:{from:0,to:4}};
 return {api:exposed.sirenSourceAnalysis,ipc,calls,ticket};
}
test('actual preload keeps claim/complete private and correlates one B callback to its exact ticket',async()=>{
 const f=fixture();assert.equal(f.api.claimComparison,undefined);assert.equal(f.api.completeComparison,undefined);const received=[];
 f.api.onComparisonReveal(async(ticket,claim)=>{received.push(ticket);assert.equal((await claim()).ok,true);assert.equal((await claim()).ok,false);return {ok:true};});
 f.ipc.emit('siren:source-comparison-reveal',{},f.ticket);await tick();assert.equal(received.length,1);assert.deepEqual(f.calls.map(call=>[call[1],call[2].requestId,call[2].ok]),[['claimComparison',f.ticket.requestId,undefined],['completeComparison',f.ticket.requestId,true]]);
 assert.ok(Object.isFrozen(received[0]));assert.ok(Object.isFrozen(received[0].sourceRef));assert.ok(Object.isFrozen(received[0].range));
});
test('malformed ticket fields have no hooks and unsubscribe prevents late successful completion',async()=>{
 const f=fixture();let traps=0,resolve;const unsubscribe=f.api.onComparisonReveal(()=>new Promise(done=>resolve=done));
 f.ipc.emit('siren:source-comparison-reveal',{},Object.defineProperty({...f.ticket},'range',{enumerable:true,get(){traps++;return f.ticket.range;}}));await tick();assert.equal(traps,0);assert.equal(f.calls.length,0);
 f.ipc.emit('siren:source-comparison-reveal',{},f.ticket);unsubscribe();resolve({ok:true});await tick();assert.equal(f.calls[0][1],'completeComparison');assert.equal(f.calls[0][2].ok,false);
 f.ipc.emit('siren:source-comparison-reveal',{},f.ticket);await tick();assert.equal(f.calls.length,1);
});
