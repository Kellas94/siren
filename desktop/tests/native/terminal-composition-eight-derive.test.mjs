import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let deriveEightComposition;
try{({deriveEightComposition}=await import('./terminal-composition-eight-derive.mjs'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const inputs={host:await read('../fixtures/terminal-host-guard/host.cc'),fixture:await read('../fixtures/terminal-job-list.cs'),extension:await read('../fixtures/terminal-session-composition.inc'),observerBase:await read('../fixtures/terminal-main-owner-observer.cs'),observerStage:await read('../fixtures/terminal-session-composition-observer.cs')};
test('eight-session derivation admits the 65-member host capture without widening Session or admission limits',()=>{
 assert.equal(typeof deriveEightComposition,'function','MISSING_EIGHT_COMPOSITION_DERIVATION');
 const out=deriveEightComposition(inputs);
 assert.ok(out.host.includes('+128*sizeof(ULONG_PTR)'));
 assert.ok(out.host.includes('list->NumberOfProcessIdsInList>128'));
 assert.ok(out.host.includes('+32*sizeof(ULONG_PTR)'));
 assert.ok(out.host.includes('sessionCount.load()>=8'));
 assert.ok(out.host.indexOf('SESSION_CAPACITY_REFUSED')<out.host.indexOf('CreateProcessW('));
 assert.ok(!out.host.includes('COMPOSITION_PREVIOUS_STAGE_LIVE'));
 assert.ok(out.observerBase.includes('count<=128,"JOB_SET_REFUSED"'));
 assert.ok(out.observerStage.includes('required.Length<=128'));
 assert.ok(out.observerStage.includes('AllCapacityHeldExited(held)'));
 assert.ok(out.observerStage.includes('Active(safety)!=0||!AllCapacityHeldExited(held)'));
 assert.ok(out.fixture.includes('Thread.Sleep(5)'));
});
test('eight-session derivation refuses every drifted native input',()=>{
 assert.equal(typeof deriveEightComposition,'function','MISSING_EIGHT_COMPOSITION_DERIVATION');
 for(const key of Object.keys(inputs))assert.throws(()=>deriveEightComposition({...inputs,[key]:inputs[key]+' '}));
});
