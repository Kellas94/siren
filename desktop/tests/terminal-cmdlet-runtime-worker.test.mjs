// Inert DATA/helper and selected-boundary tests only. Never import/link worker.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,SourceTextModule} from 'node:vm';
import {PassThrough} from 'node:stream';
let source='';try{source=readFileSync(new URL('./native/terminal-cmdlet-runtime-worker.mjs',import.meta.url),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
function helpers(){
 const start=source.indexOf('// INERT_HELPERS_BEGIN'),end=source.indexOf('// INERT_HELPERS_END');
 assert.ok(start>=0&&end>start,'worker DATA helpers are not implemented');
 return runInNewContext(source.slice(start,end)+';({assertFixedControl,requireCmdletCompletion,requireHistoryMarkers,createReadyLineConsumer,assertReadyIdentities,assertSessionClosed,assertExternalJoin,assertCleanupObservation})',{assert,Buffer});
}
const fixture=control=>({control,expected:'a'.repeat(32),expectedConsole:'SIREN_CMDLET_COMPLETE_'+'a'.repeat(32),expectedPipeline:control==='write-output'?'SIREN_PIPELINE_CONTROL':null,input:"& 'C:\\project țară 日本語\\single-cmdlet.ps1'\r"});
const identity=(pid,image='C:\\fixed.exe')=>({pid,image,createdFileTime:String(1000+pid)});
const expected=()=>[identity(1),identity(2),identity(3,'C:\\conhost.exe'),identity(4,'C:\\powershell.exe')];
const external=(code=77)=>({status:'EXACT_HELD_PROCESSES_EXITED',before:expected().map(p=>({...p,wait:258,exitCode:259})),after:expected().map(p=>({...p,wait:0,exitCode:code}))});
const before=()=>({root:identity(2),shell:identity(4,'C:\\powershell.exe'),held:expected().slice(1)});
const receipt=(code=77)=>({closed:true,snapshot:{active:0,root:{...identity(2),alive:false,exitCode:code},shell:{...identity(4,'C:\\powershell.exe'),alive:false,exitCode:code},held:expected().slice(1).map(p=>({...p,alive:false,exitCode:code}))}});

test('control gate refuses every non-fixed control before any host work',()=>{
 const h=helpers();for(const value of [undefined,null,'','Start-Sleep','write-output; exit',{},1])assert.throws(()=>h.assertFixedControl(value));
 for(const value of ['start-sleep','write-output'])assert.equal(h.assertFixedControl(value),value);
});
test('disk completion requires matching started/completed token and after-target stage',()=>{
 const h=helpers(),f=fixture('start-sleep'),proof={started:f.expected,stage:'after-start-sleep',completed:f.expected};
 h.requireCmdletCompletion(f,proof);
 for(const key of ['started','stage','completed'])assert.throws(()=>h.requireCmdletCompletion(f,{...proof,[key]:key==='stage'?'before-start-sleep':'wrong'}));
});
test('write-output requires the actual pipeline marker as well as direct Console completion',()=>{
 const h=helpers(),f=fixture('write-output');assert.throws(()=>h.requireHistoryMarkers(f,f.expectedConsole));assert.throws(()=>h.requireHistoryMarkers(f,'SIREN_PIPELINE_CONTROL'));
 assert.deepEqual(Array.from(h.requireHistoryMarkers(f,'\r\nSIREN_PIPELINE_CONTROL\r\n'+f.expectedConsole+'\r\n')),['SIREN_PIPELINE_CONTROL',f.expectedConsole]);
});
test('sleep requires token-bound Console marker and no submitted-input echo may qualify',()=>{
 const h=helpers(),f=fixture('start-sleep');assert.throws(()=>h.requireHistoryMarkers(f,'SIREN_CMDLET_COMPLETE_'+'b'.repeat(32)));
 assert.deepEqual(Array.from(h.requireHistoryMarkers(f,f.expectedConsole)),[f.expectedConsole]);
 assert.throws(()=>h.requireHistoryMarkers({...f,input:f.input+f.expectedConsole},f.expectedConsole));
});
test('READY reader waits for complete UTF8 JSON split inside a multibyte path',async()=>{
 const h=helpers(),stream=new PassThrough();stream.setEncoding('utf8');let observed,error;
 const consume=h.createReadyLineConsumer(v=>observed=v,e=>error=e);stream.on('data',consume);
 const text=JSON.stringify({status:'READY',identities:[identity(1,'C:\\țară 日本語.exe')]}),bytes=Buffer.from(text),split=bytes.indexOf(Buffer.from('日'))+1;
 stream.write(bytes.subarray(0,split));assert.equal(observed,undefined);stream.write(bytes.subarray(split));assert.equal(observed,undefined);stream.write('\r\n');
 assert.equal(error,undefined);assert.equal(observed.identities[0].image,'C:\\țară 日本語.exe');
});
test('READY reader rejects complete malformed or oversized records',()=>{
 const h=helpers();let observed,error;const consume=h.createReadyLineConsumer(v=>observed=v,e=>error=e);
 consume('{"status":');assert.equal(error,undefined);consume('invalid}\n');assert.equal(observed,undefined);assert.match(error.message,/OBSERVER_READY_JSON/);
 let overflow;h.createReadyLineConsumer(()=>assert.fail('oversized READY accepted'),e=>overflow=e)('x'.repeat(262145));assert.match(overflow.message,/OBSERVER_READY_OVERFLOW/);
});
test('READY identities reject missing duplicate reused or already-exited process identities',()=>{
 const h=helpers(),ready={status:'READY',identities:external().before};h.assertReadyIdentities(expected(),ready);
 for(const rows of [ready.identities.slice(1),[...ready.identities.slice(0,3),ready.identities[0]],ready.identities.map((p,i)=>i===0?{...p,createdFileTime:'999'}:p),ready.identities.map((p,i)=>i===0?{...p,wait:0}:p)])assert.throws(()=>h.assertReadyIdentities(expected(),{...ready,identities:rows}));
});
test('Session native receipt cannot qualify an alive different missing or wrong-code held member',()=>{
 const h=helpers();h.assertSessionClosed(before(),receipt(),77);
 for(const mutate of [r=>r.closed=false,r=>r.snapshot.active=1,r=>r.snapshot.held.pop(),r=>r.snapshot.root.createdFileTime='999',r=>r.snapshot.held[0].alive=true,r=>r.snapshot.held[0].exitCode=98]){const r=receipt();mutate(r);assert.throws(()=>h.assertSessionClosed(before(),r,77));}
});
test('external join requires exact four live-before and same held identities exited with requested code',()=>{
 const h=helpers();h.assertExternalJoin(expected(),external(),{code:0,signal:null},77);h.assertExternalJoin(expected(),external(98),{code:0,signal:null},98);
 for(const mutate of [r=>r.before.pop(),r=>r.after[0].createdFileTime='999',r=>r.after[0].wait=258,r=>r.after[0].exitCode=0,r=>r.after.push(r.after[0]),r=>r.before[0].exitCode=77]){const r=external();mutate(r);assert.throws(()=>h.assertExternalJoin(expected(),r,{code:0,signal:null},77));}
 assert.throws(()=>h.assertExternalJoin(expected(),external(),{code:2,signal:null},77));
});
const cleanup=code=>({code,graph:{actualSettled:true,unknown:false,hostNativeJoined:false,sessionCleanupJoined:false},beforeSession:before(),sessionReceipts:[receipt(code)],hostReceipt:{closed:true,code,snapshot:{active:0,root:{...identity(1),alive:false,exitCode:code},held:[{...identity(1),alive:false,exitCode:code}]}},checked:{ok:true,actualSettlementEstablished:false},expected:expected(),external:external(code),externalExit:{code:0,signal:null},utilityExit:code});
test('cleanup remains unknown without actual Session host external and utility observations',()=>{
 const h=helpers();h.assertCleanupObservation(cleanup(77));h.assertCleanupObservation(cleanup(98));
 for(const key of ['graph','beforeSession','sessionReceipts','hostReceipt','checked','external','externalExit','utilityExit']){const c=cleanup(98);delete c[key];assert.throws(()=>h.assertCleanupObservation(c),key);}
 for(const mutate of [c=>c.graph.unknown=true,c=>c.hostReceipt.snapshot.root.alive=true,c=>c.utilityExit=0,c=>c.sessionReceipts=[]]){const c=cleanup(98);mutate(c);assert.throws(()=>h.assertCleanupObservation(c));}
});
test('full hosted worker parses without linking or evaluating privileged imports',()=>{
 assert.ok(source,'worker source is missing');new SourceTextModule(source); // no link/evaluate
});
test('one input waits for the held-handle observer READY and before-command evidence',async()=>{
 const start=source.indexOf('  const observed=await bounded(observerReady,'),end=source.indexOf('  await waitFile(fixture.completedPath',start);assert.ok(start>0&&end>start);
 let release;const observerReady=new Promise(resolve=>release=resolve),flow=[];
 const f=fixture('start-sleep');Object.assign(f,{startedPath:'started',completedPath:'completed'});
 const h=helpers(),promise=runInNewContext('(async()=>{'+source.slice(start,end)+';return input;})()',{
  observerReady,bounded:async p=>p,expected:expected(),assertReadyIdentities:h.assertReadyIdentities,fixture:f,assert,
  absent:async path=>flow.push('absent:'+path),beforeSession:before(),beforeHost:{root:identity(1)},
  milestone:async(name,data)=>{flow.push(name);assert.equal(data.commandInputSequence,0);assert.equal(data.runningCommandLock,false);},
  first:{caller:{sender:'original'},grant:{epoch:1},lease:{leaseId:'lease1',generation:1},router:{route:async q=>{assert.equal(q.method,'terminalInput');assert.equal(q.payload.inputSequence,0);assert.equal(q.payload.data,f.input);flow.push('input');return{ok:true};}}},
  request:(_grant,fields)=>fields,save:async name=>flow.push(name),observationPhase:'setup'
 });
 await Promise.resolve();assert.deepEqual(flow,[],'no input/evidence may precede READY');release({status:'READY',identities:external().before});await promise;
 assert.deepEqual(flow,['absent:started','absent:completed','before-command','input','command-input-receipt.json']);
});
test('adverse capture uses the previously observed owner to preserve history when ownership snapshot fails',async()=>{
 const start=source.indexOf(' async function captureFailureEvidence(){'),end=source.indexOf(' async function collectCleanup(',start);assert.ok(start>0&&end>start);
 const saved=[],f={startedPath:'started',stagePath:'stage',completedPath:'completed',scriptPath:'script'},result={};
 const capture=runInNewContext(source.slice(start,end)+';captureFailureEvidence',{
  result,fixture:f,readFile:async path=>{if(path==='completed')throw Object.assign(Error('missing'),{code:'ENOENT'});return{started:'token',stage:'before-start-sleep',script:'\uFEFFfixed script'}[path];},
  pin:async()=>({bytes:15,sha256:'fixed'}),save:async(name,value)=>saved.push({name,value}),
  members:{ownership:{snapshot:()=>{throw Error('snapshot unavailable');}},backend:{readHistory:async q=>{assert.equal(q.ownerId,'known-owner');return{chunk:{data:'original fixed error'}};}}},native:{snapshotSession:()=>({alive:true})},nativeState:{sessions:[{}]},sessionId:'session1',sessionOwnerId:'known-owner',bounded:async p=>p
 });
 await capture();assert.deepEqual(saved.map(r=>r.name),['failure-fixture-state.json','failure-script.json','failure-native-session.json','failure-history.json']);
 assert.equal(saved[0].value.stage.value,'before-start-sleep');assert.equal(saved[0].value.completed.error,'ENOENT');assert.equal(saved[1].value.body,'\uFEFFfixed script');
 assert.equal(result.failureObservationErrors[0].name,'failure-ownership.json');
});
test('failure path saves adverse observations before shutdown and never promotes unknown cleanup',async()=>{
 const start=source.indexOf(' }catch(error){\n  observationPhase='),end=source.indexOf(' }finally{\n  try{',start);assert.ok(start>0&&end>start);
 const body=source.slice(start+' }catch(error){'.length,end),flow=[],result={status:'STARTED'};
 await runInNewContext('(async()=>{'+body+'})()',{
  observationPhase:'single-cmdlet-command',result,error:Error('original cmdlet deadline'),run:'123',
  captureFailureEvidence:async()=>flow.push('failure-data'),graph:{shutdown:async q=>{assert.equal(q.code,98);flow.push('shutdown');return{actualSettled:false,unknown:true};}},bounded:async p=>p,
  collectCleanup:async(graph,code)=>{flow.push('actual-cleanup-observation');assert.equal(code,98);return{graph,verified:false};},save:async(name,value)=>{flow.push(name);assert.equal(value.verified,false);}
 });
 assert.deepEqual(flow,['failure-data','shutdown','actual-cleanup-observation','failure-cleanup-observation.json']);assert.equal(result.status,'FAILED');assert.equal(result.cleanupVerified,false);assert.equal(result.error.message,'original cmdlet deadline');
});
