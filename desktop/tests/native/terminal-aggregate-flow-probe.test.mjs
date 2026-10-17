import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {fixedShellFlowProbe} from './terminal-shell-flow-probe.mjs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {runAggregateFlowMain,preserveFirstFailure} from './terminal-aggregate-flow-main.mjs';
let probe,derive;try{({fixedAggregateFlowProbe:probe,deriveAggregateFlowSources:derive}=await import('./terminal-aggregate-flow-derive.mjs'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const failureRecord={schema:1,admitted:false,status:'FAILED',scope:'AGGREGATE_MAIN_FIRST_FAILURE',mainPid:123,phase:'fresh-and-drain',ageMs:65000,error:{code:'ERR_ASSERTION',message:'AGGREGATE_WAIT_DEADLINE',messageTruncated:false}};

test('aggregate primary error is durably attempted before cleanup and write refusal cannot replace it',async()=>{for(const writeFails of [false,true]){const order=[],original=Object.assign(Error('AGGREGATE_WAIT_DEADLINE'),{code:'ERR_ASSERTION'});let answer;try{throw original;}catch(error){answer=await preserveFirstFailure({persist:async(path,value)=>{order.push('persist');assert.equal(path,'failure.json');assert.deepEqual(value,failureRecord);if(writeFails)throw Object.assign(Error('disk denied'),{code:'EACCES'});},path:'failure.json',mainPid:123,phase:'fresh-and-drain',ageMs:65000,error});assert.equal(error,original);}finally{order.push('cleanup');}assert.deepEqual(order,['persist','cleanup']);assert.equal(answer.saved,!writeFails);if(writeFails)assert.equal(answer.error.code,'EACCES');assert.equal(original.message,'AGGREGATE_WAIT_DEADLINE');}});
test('primary receipt bounds Unicode/control messages and reports truncation without source data',async()=>{let value;const original={code:'ERR_ASSERTION',message:'Ș😀\0'.repeat(4000)};const r=await preserveFirstFailure({persist:async(_path,row)=>{value=row;},path:'failure.json',mainPid:1,phase:'fresh',ageMs:1,error:original});assert.equal(r.saved,true);assert.ok(Buffer.byteLength(JSON.stringify(value))<=4096);assert.equal(value.error.message.isWellFormed(),true);assert.equal(value.error.messageTruncated,true);assert.equal(original.message.length,16000);});
test('serialized aggregate main receives durable error helper before cleanup and failure gates remain before qualification',async()=>{
 const m=await import('./terminal-aggregate-flow-derive.mjs'),desktop=new URL('../../',import.meta.url),input=await readFile(new URL('./terminal-shell-flow.mjs',import.meta.url),'utf8'),runner=m.deriveAggregateFlowRunner({runner:input,desktop}),body=runAggregateFlowMain.toString();
 assert.ok(runner.includes('import {runAggregateFlowMain,preserveFirstFailure}'));assert.ok(runner.includes('runAggregateFlowMain.toString()'));assert.ok(runner.includes('preserveFirstFailure.toString()'));
 const original=body.indexOf('result.error='),persist=body.indexOf('await preserveFailure('),cleanup=body.indexOf('native.stopSession(s.session,98)'),finalResult=body.indexOf("'native-result.json'");assert.ok(original>=0&&persist>original&&cleanup>persist&&finalResult>cleanup);assert.ok(body.includes('result.failureReceiptError'));
 const native=runner.indexOf('if(receipt.native?.error)'),primary=runner.indexOf('if(receipt.aggregateMainFailure)'),missing=runner.indexOf("assert.deepEqual(receipt.missingRecords,[],'FLOW_STAGE_RECORDS_MISSING')"),qualify=runner.indexOf('receipt.qualified=');assert.ok(native>=0&&primary>native&&missing>primary&&qualify>missing);
 const serialized='void ('+body+')({},'+preserveFirstFailure.toString()+');',parse=spawnSync(process.execPath,['--input-type=module','--check'],{input:serialized,encoding:'utf8',timeout:10000,windowsHide:true});assert.equal(parse.status,0,parse.stderr);
});

test('aggregate failure roster is captured before unchanged membership refusals without modifying historical fixture',async()=>{
 const names={host:'terminal-host-guard/host.cc',fixture:'terminal-job-list.cs',extension:'terminal-session-composition.inc',observerBase:'terminal-main-owner-observer.cs',observerStage:'terminal-shell-flow-observer.cs'},input=Object.fromEntries(await Promise.all(Object.entries(names).map(async([key,path])=>[key,await readFile(new URL('../fixtures/'+path,import.meta.url),'utf8')]))),original={...input},d=derive(input),s=d.observerStage;
 assert.deepEqual(input,original);assert.equal(createHash('sha256').update(input.observerStage).digest('hex'),'8532bc685672120197054613e4f1082ee396074c7b09296d7c8fa9c8c3f7629c');
 assert.equal(s.split('SameFlowMembers(safety,held,electron,fixture,long.Parse(identity.created),result);').length-1,2);
 const capture=s.indexOf('result["membershipFailure"]'),diagnosticCatch=s.indexOf('catch(Exception diagnostic)'),count=s.indexOf('Require(next.Count==held.Count,"FLOW_MEMBERSHIP_CHANGED")'),identity=s.indexOf('Require(old.image==p.image&&old.created==p.created,"FLOW_HELD_SET_CHANGED")');assert.ok(capture>=0&&diagnosticCatch>capture&&count>diagnosticCatch&&identity>count);
 assert.match(s,/PRE_CLEANUP_ADJACENT_NOT_ATOMIC/);assert.match(s,/diagnostic\["expected"\]=Observe\(held\)/);assert.match(s,/diagnostic\["actual"\]=Observe\(next\)/);assert.match(s,/diagnostic\["adjacentActive"\]=Active\(safety\)/);assert.match(s,/if\(next==null\)result\["membershipDiagnosticUnavailable"\]="LIVE_ROSTER_HOLD_FAILED";throw;/);assert.match(s,/finally\{if\(next!=null\)foreach\(var p in next\)CloseHandle\(p.handle\);\}/);
});

test('staged diagnostic runner resolves readback absolutely and preserves causal refusal gates',async()=>{
 const m=await import('./terminal-aggregate-flow-derive.mjs'),desktop=new URL('../../',import.meta.url),input=await readFile(new URL('./terminal-shell-flow.mjs',import.meta.url),'utf8'),runner=m.deriveAggregateFlowRunner({runner:input,desktop});
 const imported=runner.match(/import \{readAggregateFlowRecords as readShellFlowRecords\} from "([^"]+)";/);assert.ok(imported,'AGGREGATE_ONLY_READBACK_IMPORT_REQUIRED');assert.equal(imported[1],new URL('./terminal-shell-flow-readback.mjs',import.meta.url).href);assert.ok((await readFile(new URL(imported[1]))).length>0);
 const parse=spawnSync(process.execPath,['--input-type=module','--check'],{input:runner,encoding:'utf8',timeout:10000,windowsHide:true});assert.equal(parse.status,0,parse.stderr);
 const readback=runner.indexOf('Object.assign(receipt,await readShellFlowRecords'),cause=runner.indexOf('if(receipt.native?.error)'),missing=runner.indexOf("assert.deepEqual(receipt.missingRecords,[],'FLOW_STAGE_RECORDS_MISSING')"),qualify=runner.indexOf('receipt.qualified=');assert.ok(readback>=0&&cause>readback&&missing>cause&&qualify>missing);
 assert.ok(runner.includes("'terminal-shell-flow-readback'"));assert.ok(runner.includes('isAggregateFlowObserved(receipt)'));
 const base=await readFile(new URL('./build-terminal-composition-eight.mjs',import.meta.url),'utf8'),builder=m.deriveAggregateFlowBuilder({builder:base,desktop,runnerPath:'C:/fixed/aggregate-runner.mjs'});assert.ok(builder.includes("'tests/native/terminal-shell-flow-readback.mjs'"));
});
test('CI runner and builder transformations bind aggregate modules, shared fixture, and finite source records',async()=>{const m=await import('./terminal-aggregate-flow-derive.mjs');assert.equal(typeof m.deriveAggregateFlowRunner,'function');assert.equal(typeof m.deriveAggregateFlowBuilder,'function');const desktop=new URL('../../',import.meta.url);const input=await readFile(new URL('./terminal-shell-flow.mjs',import.meta.url),'utf8'),runner=m.deriveAggregateFlowRunner({runner:input,desktop});assert.match(runner,/ISOLATED_WINDOWS_CI_ONLY/);assert.match(runner,/runAggregateFlowMain/);assert.match(runner,/deliveryUrl/);assert.match(runner,/observerStage:'terminal-shell-flow-observer.cs'/);assert.equal(runner.includes('copiedFixture'),false);assert.equal(runner.includes("join(output,'Șiren flow α'"),false);assert.match(runner,/AGGREGATE_FLOW_OBSERVED_NOT_ADMITTED/);assert.throws(()=>m.deriveAggregateFlowRunner({runner:input+'\n',desktop}),/DRIFT/);const base=await readFile(new URL('./build-terminal-composition-eight.mjs',import.meta.url),'utf8'),builder=m.deriveAggregateFlowBuilder({builder:base,desktop,runnerPath:'C:/fixed/aggregate-runner.mjs'});assert.match(builder,/terminal_aggregate_flow/);assert.match(builder,/terminal-aggregate-flow-delivery.mjs/);assert.match(builder,/src\/terminal\/credits.mjs/);assert.match(builder,/observerStage:await readFile\(join\(desktop,'tests\/fixtures\/terminal-shell-flow-observer.cs'/);assert.match(builder,/C:\/fixed\/aggregate-runner.mjs/);});
test('aggregate probe keeps old source immutable, extends duration and records shared high-resolution clock boundaries',()=>{assert.equal(typeof probe,'function');const old=fixedShellFlowProbe(),p=probe();assert.equal(old.minimumFloodMs,60000);assert.match(old.script,/minimumMs=60000/);assert.equal(p.minimumFloodMs,62000);assert.match(p.script,/ElapsedMilliseconds -lt 62000/);assert.match(p.script,/startedQpc=\$startedQpc; finishedQpc=\$finishedQpc; qpcFrequency=\[Diagnostics.Stopwatch\]::Frequency/);assert.match(p.script,/Split-Path \$PSScriptRoot -Parent/);assert.equal(p.naturalDeadlineMs,110000);assert.equal(p.generatedByteCap,134217728);assert.deepEqual(p.markers,old.markers);assert.equal(p.freshCommand,old.freshCommand);});
test('separate aggregate sources preserve Session32, enlarge bounded Host/Safety128 and retain pre-bootstrap ninth refusal',async()=>{assert.equal(typeof derive,'function');const paths={host:'terminal-host-guard/host.cc',fixture:'terminal-job-list.cs',extension:'terminal-session-composition.inc',observerBase:'terminal-main-owner-observer.cs',observerStage:'terminal-shell-flow-observer.cs'};const input=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([k,p])=>[k,await readFile(new URL('../fixtures/'+p,import.meta.url),'utf8')])));const original={...input},d=derive(input);assert.deepEqual(input,original);assert.match(d.host,/NumberOfProcessIdsInList>128/);assert.match(d.host,/SESSION_CAPACITY_REFUSED/);assert.match(d.observerBase,/count>=1&&count<=128/);assert.match(d.observerStage,/slots.Length==8/);assert.match(d.observerStage,/SetEquals\(expectedHost\)/);assert.match(d.observerStage,/AGGREGATE_FLOW_SAFETY_OBSERVED_NOT_ADMITTED/);assert.match(d.fixture,/Thread.Sleep\(110000\)/);for(const k of Object.keys(input))assert.throws(()=>derive({...input,[k]:input[k]+'\n'}),/DRIFT/);});

// Regression controls for bounded aggregate sampling; no native execution.
import vm from 'node:vm';
import {isAggregateStreamObserved} from './terminal-aggregate-flow-verdict.mjs';

{
// Execute only record() extracted from maintained QA source, with inert replies.
const source=await readFile(new URL('./terminal-aggregate-flow-main.mjs',import.meta.url),'utf8');
const begin=source.indexOf('  function record(s,reply,tail){'),end=source.indexOf('  async function observe(s,tail=true)',begin);
assert(begin>=0&&end>begin);assert.equal(source.indexOf('  function record(s,reply,tail){',begin+1),-1);
let age=0;
const record=vm.runInNewContext('('+source.slice(begin,end).trim()+')',{assert,hash:s=>createHash('sha256').update(s).digest('hex'),now:()=>++age,age:0},{timeout:1000});
const stats=()=>({retainedUtf8Bytes:0,allocatedBytes:0,nextSequence:0,inputWrites:1,open:false});
const reply=(t=stats(),chunks=[],gap=null)=>({result:{nextSequence:t.nextSequence,chunks,gap},stats:t});
const slot=()=>({cursor:0,last:null,scanner:{seen:[],append(sequence,data){this.seen.push({sequence,data});}},record:{samples:[]}});

test('many identical empty polls retain one observation and stay within unchanged hard sample budget',()=>{
 const s=slot();for(let i=0;i<1000;i++)record(s,reply(),false);
 assert.equal(s.record.samples.length,1);assert.equal(s.cursor,0);assert.equal(s.last.inputWrites,1);assert.equal(s.scanner.seen.length,0);
});
test('first empty observation is retained and changed input/Lock/statistic transitions remain observable',()=>{
 const s=slot();record(s,reply(),false);for(const delta of [{open:true},{inputWrites:2},{retainedUtf8Bytes:1},{allocatedBytes:1}])record(s,reply({...stats(),...delta}),false);
 assert.equal(s.record.samples.length,5);assert.equal(s.record.samples[1].stats.open,true);assert.equal(s.record.samples[2].stats.inputWrites,2);
});
test('identical stats never suppress actual chunks or gap/reset evidence',()=>{
 const s=slot(),t={...stats(),nextSequence:1,retainedUtf8Bytes:1,allocatedBytes:1};record(s,reply(t),false);
 record(s,reply({...t},[{sequence:0,utf8Bytes:1,data:'x'}]),false);
 record(s,reply({...t},[],{fromSequence:0,resumeSequence:1,droppedUtf8Bytes:1,resetParser:true}),false);
 assert.equal(s.record.samples.length,3);assert.equal(s.scanner.seen.length,1);assert.equal(s.record.samples[1].chunks[0].sha256,createHash('sha256').update('x').digest('hex'));assert.equal(s.record.samples[2].gap.resetParser,true);
});
test('tail selection evidence remains recorded even when stats are identical',()=>{
 const s=slot(),t={...stats(),nextSequence:65536};const r=reply(t);r.result.nextSequence=0;
 record(s,r,true);record(s,r,true);assert.equal(s.record.samples.length,2);assert.equal(s.record.samples[1].tailGap.toSequence,32768);assert.equal(s.cursor,32768);
});
test('more than100 evidence-bearing observations still refuse; no cap or verdict relaxation',()=>{
 const s=slot();for(let i=0;i<100;i++)record(s,reply({...stats(),inputWrites:i}),false);
 assert.equal(s.record.samples.length,100);assert.throws(()=>record(s,reply({...stats(),inputWrites:100}),false),/samples.length<=100/);
});
test('last retained stats still exactly match final stats after repeated empty final polls',()=>{
 const s=slot();record(s,reply(),false);const final={...stats(),open:true,inputWrites:2};record(s,reply(final),false);
 for(let i=0;i<800;i++)record(s,reply({...final}),false);
 assert.equal(s.record.samples.length,2);assert.equal(JSON.stringify(s.record.samples.at(-1).stats),JSON.stringify(final));
});
}

{
const main=await readFile(new URL('./terminal-aggregate-flow-main.mjs',import.meta.url),'utf8');
const begin=main.indexOf('  function record(s,reply,tail){'),end=main.indexOf('  async function observe(s,tail=true)',begin);
assert(begin>=0&&end>begin);let tick=0;
const record=vm.runInNewContext('('+main.slice(begin,end).trim()+')',{assert,hash:s=>createHash('sha256').update(s).digest('hex'),now:()=>++tick,age:0},{timeout:1000});
const maintained=await readFile(new URL('./terminal-aggregate-flow-verdict.test.mjs',import.meta.url),'utf8');
const f=maintained.indexOf('function fixture(){'),fend=maintained.indexOf("\ntest('stream oracle",f);assert(f>=0&&fend>f);
const fixture=vm.runInNewContext('('+maintained.slice(f,fend).trim()+')',{hash:'a'.repeat(64)},{timeout:1000});
const freshSlot=()=>({cursor:0,last:null,record:{samples:[]},scanner:{append(){}}});

test('complete real-stat changes remain recorded even with empty output',()=>{
 const base=JSON.parse(JSON.stringify(fixture().completedWhileLocked));Object.assign(base,{generation:0,resizeCalls:0,inputAttemptSha256:'a'.repeat(64),inputWriteSha256:'a'.repeat(64)});
 const changes={generation:1,resizeCalls:1,unavailable:true,open:true,inputAttemptSha256:'b'.repeat(64),inputWriteSha256:'b'.repeat(64),receivedUtf8Bytes:5000001,nextSequence:5000001,retainedUtf8Bytes:4194303,droppedUtf8Bytes:805697,firstSequence:805697,allocatedBytes:4194303,inputWrites:2,inputWriteAttempts:2,inputUtf8Bytes:101,blockCount:8};
 for(const [key,value] of Object.entries(changes)){
  const s=freshSlot(),reply=stats=>({result:{nextSequence:0,chunks:[],gap:null},stats});record(s,reply({...base}),false);record(s,reply({...base,[key]:value}),false);
  assert.equal(s.record.samples.length,2,key);assert.equal(s.record.samples[1].stats[key],value,key);
 }
});
test('mixed retained bytes gap tail selection and duplicate polls pass unchanged strict conservation oracle',()=>{
 const r=JSON.parse(JSON.stringify(fixture())),s=freshSlot(),locked=r.completedWhileLocked,final=r.finalStats;
 const send=(stats,sequence,data,gap,tail)=>record(s,{result:{nextSequence:sequence+data.length,chunks:data?[{sequence,data,utf8Bytes:data.length}]:[],gap},stats:{...stats}},tail);
 // Initial dropped ring prefix plus a tail selection, then the remaining tail.
 send(locked,805696,'x'.repeat(32768),{fromSequence:0,resumeSequence:805696,droppedUtf8Bytes:805696,resetParser:true},true);
 assert.equal(s.cursor,4967232);
 send(locked,4967232,'y'.repeat(32768),null,false);assert.equal(s.cursor,5000000);
 for(let i=0;i<1000;i++)send(locked,5000000,'',null,false);
 send(final,5000000,'z',null,false);for(let i=0;i<1000;i++)send(final,5000001,'',null,false);
 r.samples=JSON.parse(JSON.stringify(s.record.samples));assert.equal(r.samples.length,3);assert.equal(isAggregateStreamObserved(r,70000),true);
 for(const change of [v=>{v.samples[0].gap=null;},v=>{v.samples[0].tailGap=null;},v=>{v.samples[1].chunks[0].sequence++;},v=>{v.samples.at(-1).stats.inputWrites=3;}]){
  const bad=structuredClone(r);change(bad);assert.equal(isAggregateStreamObserved(bad,70000),false,change.toString());
 }
});
}
