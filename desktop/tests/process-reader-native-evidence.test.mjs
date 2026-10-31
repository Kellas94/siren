// Pure synthetic diagnostics controls; no native/product/process import or execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {streamEvidence,observeProcessReference,finishProcessEvidence} from './process-reader-native-evidence.mjs';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const state=()=>({status:'COMPLETE',phase:'independent-powershell-reference',observations:[]});
const options={windowsHide:true,timeout:10000,maxBuffer:16384};
test('reference preserves actual rejection identity and available child fields without inferring timeout',async()=>{
 const result=state(),failure=Object.assign(new Error('known reference failure'),{code:7,killed:true,signal:'SIGTERM',cmd:'owned-command',stdout:'Ș日本😀',stderr:'synthetic diagnostics'});
 await assert.rejects(observeProcessReference(result,()=>{const pending=Promise.reject(failure);pending.child={pid:721,exitCode:7,signalCode:'SIGTERM',killed:true};return pending;},'powershell.exe',['owned'],options,1494),error=>error===failure);
 const r=result.reference;assert.equal(r.outcome,'REJECTED');assert.equal(r.ownedPid,1494);assert.equal(r.phase,'independent-powershell-reference');assert.deepEqual(r.configuration,options);assert.deepEqual(r.args,['owned']);assert.equal(r.command,'powershell.exe');assert.ok(r.elapsedMs>=0);assert.equal(r.error.name,'Error');assert.equal(r.error.code,7);assert.equal(r.error.killed,true);assert.equal(r.error.signal,'SIGTERM');assert.equal(r.childBefore.pid,721);assert.equal(r.childAfter.exitCode,7);assert.equal(r.childAfter.killed,true);assert.equal(r.error.stdout.sha256,digest(Buffer.from(failure.stdout)));assert.equal(Buffer.from(r.error.stdout.base64,'base64').toString(),failure.stdout);assert.equal(Object.hasOwn(r,'timedOut'),false);
});
test('reference success returns the original response and preserves stdout/stderr independently',async()=>{
 const result=state(),reply={stdout:'{"pid":1494}',stderr:''};assert.equal(await observeProcessReference(result,async()=>reply,'powershell.exe',['owned'],options,1494),reply);assert.equal(result.reference.outcome,'RESOLVED');assert.equal(result.reference.stderr.bytes,0);assert.equal(result.reference.stderr.sha256,digest(Buffer.alloc(0)));assert.equal(result.reference.stdout.bytes,Buffer.byteLength(reply.stdout));
});
test('stream bounds distinguish absent empty bytes and explicit truncation with full and retained digests',()=>{
 assert.equal(streamEvidence(undefined).availability,'not-provided');assert.equal(streamEvidence(undefined).bytes,null);assert.equal(streamEvidence('').availability,'available');assert.equal(streamEvidence('').bytes,0);assert.equal(streamEvidence(17).availability,'unsupported-type');
 const bytes=Buffer.alloc(20000,149),r=streamEvidence(bytes);assert.equal(r.bytes,20000);assert.equal(r.retainedBytes,16384);assert.equal(r.truncated,true);assert.equal(r.sha256,digest(bytes));assert.equal(r.retainedSha256,digest(bytes.subarray(0,16384)));assert.deepEqual(Buffer.from(r.base64,'base64'),bytes.subarray(0,16384));
});
test('clean finalization writes COMPLETE once and returns original result',async()=>{
 const result=state(),calls=[];assert.equal(await finishProcessEvidence(result,null,async()=>calls.push('cleanup'),async value=>{calls.push('write');assert.equal(value.status,'COMPLETE');},()=>assert.fail('unexpected report')),result);assert.deepEqual(calls,['cleanup','write']);assert.deepEqual(result.finalErrors,[]);
});
test('primary alone is thrown unchanged after cleanup and saved ADVERSE evidence',async()=>{
 const result=state(),primary=new Error('primary');let saved;await assert.rejects(finishProcessEvidence(result,primary,async()=>{},async value=>{saved=JSON.parse(JSON.stringify(value));},()=>assert.fail('unexpected report')),error=>error===primary);assert.equal(saved.status,'ADVERSE');assert.equal(saved.primaryError.error.message,'primary');assert.deepEqual(saved.finalErrors,[]);
});
test('cleanup-only failure is ADVERSE and thrown after evidence save',async()=>{
 const result=state(),cleanup=new Error('cleanup');let saved;await assert.rejects(finishProcessEvidence(result,null,async()=>{throw cleanup;},async value=>{saved=JSON.parse(JSON.stringify(value));},()=>{}),error=>error===cleanup);assert.equal(saved.status,'ADVERSE');assert.equal(saved.primaryError.stage,'cleanup');assert.equal(saved.finalErrors[0].stage,'cleanup');
});
test('result-write-only failure is ADVERSE and fallback exposes actual first error',async()=>{
 const result=state(),write=new Error('write');let fallback;await assert.rejects(finishProcessEvidence(result,null,async()=>{},async()=>{throw write;},value=>{fallback=value;}),error=>error===write);assert.equal(result.status,'ADVERSE');assert.equal(fallback.primaryError.stage,'result-write');assert.equal(fallback.finalErrors[0].stage,'result-write');
});
test('simultaneous primary cleanup and write failures preserve primary identity and both secondary stages',async()=>{
 const result=state(),primary=new Error('primary'),cleanup=new Error('cleanup'),write=new Error('write');let fallback;await assert.rejects(finishProcessEvidence(result,primary,async()=>{throw cleanup;},async()=>{throw write;},value=>{fallback=value;}),error=>error===primary);assert.equal(fallback.primaryError.error.message,'primary');assert.deepEqual(fallback.finalErrors.map(x=>x.stage),['cleanup','result-write']);assert.equal(result.status,'ADVERSE');
});
test('fallback-report failure cannot replace the original primary or hide secondary failures',async()=>{
 const result=state(),primary=new Error('primary');await assert.rejects(finishProcessEvidence(result,primary,async()=>{},async()=>{throw Error('write');},()=>{throw Error('report');}),error=>error===primary);assert.deepEqual(result.finalErrors.map(x=>x.stage),['result-write','fallback-report']);assert.equal(result.status,'ADVERSE');
});