// Execute only the actual JS orchestration seam with inert native/FS doubles.
// This establishes JS ordering/refusal handling, never native ownership success.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
let source='';try{source=await readFile(new URL('./terminal-composition-eight.mjs',import.meta.url),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
async function exercise(acceptNinth=false){
 const begin=source.indexOf('const startup=now();'),end=source.indexOf('const rootStart=now();',begin);assert.ok(begin>=0&&end>begin,'MISSING_EIGHT_SESSION_ORCHESTRATION');
 const events=[],states=[],result={groups:[]},native={capture:()=>({active:65}),captureCompositionHost:()=>({active:65}),snapshot:()=>({active:65}),createSession(){events.push('ninth');assert.equal(states.length,8);if(!acceptNinth)throw Object.assign(Error('capacity'),{code:'SESSION_CAPACITY_REFUSED'});return 'ninth-owner';},stopSession(owner,code){events.push('stop-'+owner);assert.equal(code,77);},snapshotSession:owner=>({owner,active:owner==='A'?0:8})};
 const start=async label=>{events.push('start-'+label);const s={label,owner:label};states.push(s);result.groups.push({label});return s;};
 const context={now:()=>100,start,states,result,native,hostOwner:{},config:{output:'out',electron:'fixed',creator:'fixed'},join:(...p)=>p.join('/'),mkdir:async()=>{},readFile:async()=>{throw Object.assign(Error('absent'),{code:'ENOENT'});},assert,stage:async()=>{events.push('stage');},wait:async fn=>fn(),exited:()=>true};
 let error;try{await vm.runInNewContext('(async()=>{'+source.slice(begin,end)+'})()',context);}catch(e){error=e;}
 return {events,states,result,error};
}
test('eight owners stay open together before ninth refusal and StopA; all seven sibling snapshots recorded',async()=>{
 const r=await exercise();assert.equal(r.error,undefined);assert.deepEqual(r.events,['start-A','start-B','start-C','start-D','start-E','start-F','start-G','start-H','ninth','stage','stop-A']);assert.equal(r.result.groups.length,8);assert.equal(r.result.otherAlive.length,7);assert.equal(r.result.capacity.creatorEntered,false);assert.equal(r.result.capacity.code,'SESSION_CAPACITY_REFUSED');
});
test('unexpected ninth native owner fails and is retained in cleanup state',async()=>{
 const r=await exercise(true);assert.equal(r.error?.message,'NINTH_SESSION_STARTED');assert.equal(r.states.length,9);assert.equal(r.states[8].owner,'ninth-owner');assert.equal(r.events.includes('stage'),false);assert.equal(r.events.some(e=>e.startsWith('stop-')),false);
});
