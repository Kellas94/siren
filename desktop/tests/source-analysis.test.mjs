import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {buildAnalysisWorker} from '../build/analysis.mjs';
import {AnalysisService} from '../src/sources/analysis.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
let built;
test.before(async()=>{const root=await mkdtemp(resolve('evidence/analysis-worker-'));built={root,...await buildAnalysisWorker({baselinePath:resolve('baseline/R78.html'),outputDirectory:root})};});
test.after(async()=>{if(built)await rm(built.root,{recursive:true,force:true});});
function fixture(t,text,options={}){
 const bytes=Buffer.from(text),sourceId='source-a',version=1,sha256=hash(bytes);let current=true,reads=0;
 const service=new AnalysisService({workerPath:built.workerPath,workerSha256:built.sha256,loadSource:async ref=>{reads++;assert.equal(ref.sha256,sha256);return bytes;},...options});
 t.after(()=>service.dispose());
 const submit=(extra={})=>service.submit({sourceId,version,sha256,kind:'index',jobId:'job-a',...extra},{isCurrent:()=>current});
 return {bytes,sha256,service,submit,reads:()=>reads,invalidate:()=>{current=false;}};
}
test('actual patched worker indexes decorated classes/async functions/match/multiline and Unicode ranges without executing source',async t=>{
 const text='@decorator\nclass Șiren:\n    @decorator\n    async def run(self, value):\n        match value:\n            case Point():\n                return """first\nsecond"""\n\ndef danger():\n    raise RuntimeError("DO_NOT_EXECUTE")\n';
 const f=fixture(t,text),r=await f.submit();assert.equal(r.status,'complete');assert.deepEqual(r.result.definitions.map(x=>[x.kind,x.name,x.async]),[['class','Șiren',false],['function','run',true],['function','danger',false]]);
 for(const def of r.result.definitions)assert.equal(text.slice(def.nameFrom,def.nameTo),def.name);
 assert.equal(r.result.definitions[1].parent,0);assert.equal(r.result.definitions[1].line,4);assert.equal(r.coverage.to,text.length);assert.equal(hash(f.bytes),f.sha256);assert.equal(f.service.isIdle(),true);
});
test('malformed Python reports partial syntax coverage; arbitrary source stays literal',async t=>{
 const f=fixture(t,'def good():\n    pass\ndef broken(:\n    pass\n');const r=await f.submit();assert.equal(r.status,'partial');assert.ok(r.result.errors.length>0);assert.ok(r.result.definitions.some(x=>x.name==='good'));assert.equal(hash(f.bytes),f.sha256);
});
test('finite UTF16 prefix/range and definition limits label partial coverage, never full support for truncated source',async t=>{
 const text=Array.from({length:200},(_,i)=>`def f${i}():\n    return ${i}\n`).join(''),f=fixture(t,text);
 const r=await f.submit({budget:{maxUnits:256,maxDefinitions:3}});assert.equal(r.status,'partial');assert.equal(r.coverage.totalUnits,text.length);assert.ok(r.coverage.to<=256);assert.ok(r.result.definitions.length<=3);assert.equal(r.coverage.truncated,true);
 const offset=text.indexOf('def f180'),range=await f.submit({jobId:'range',range:{from:offset,to:offset+text.slice(offset).indexOf('def f181')}});assert.equal(range.result.definitions[0].name,'f180');assert.equal(range.result.definitions[0].line,361);assert.equal(text.slice(range.result.definitions[0].nameFrom,range.result.definitions[0].nameTo),'f180');
});
test('invalid payload/getters/surrogate ranges/duplicate jobs are refused before additional I/O',async t=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});const f=fixture(t,'😀\ndef ok():\n pass\n',{loadSource:async()=>{await gate;return Buffer.from('😀\ndef ok():\n pass\n');}});
 const first=f.submit();assert.equal((await f.submit()).reason,'DUPLICATE_JOB');
 assert.equal((await f.submit({jobId:'bad',budget:{maxUnits:3000000}})).status,'unsupported');
 assert.equal((await f.submit({jobId:'bad',path:'C:/secret'})).reason,'REQUEST_REFUSED');
 let invoked=false;assert.equal((await f.service.submit({get sourceId(){invoked=true;return 'source-a';}})).reason,'REQUEST_REFUSED');assert.equal(invoked,false);release();await first;
 assert.equal((await f.submit({jobId:'surrogate',range:{from:1,to:2}})).reason,'INVALID_RANGE');
});
test('cancel during genuine load retains job until I/O drains and rejects its late result',async t=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});const f=fixture(t,'def ok():\n pass\n',{loadSource:async()=>{await gate;return Buffer.from('def ok():\n pass\n');}});
 const pending=f.submit();assert.equal(f.service.isIdle(),false);const cancelled=f.service.cancel('job-a');await delay(10);assert.equal(f.service.isIdle(),false);release();await cancelled;assert.equal((await pending).status,'cancelled');assert.equal(f.service.isIdle(),true);
});

test('finite job evidence records pre-worker cancellation only after genuine held source I/O drains',async t=>{
 let release;const gate=new Promise(resolve=>{release=resolve;}),events=[];
 const f=fixture(t,'def ok():\n pass\n',{onActivity:event=>events.push(structuredClone(event)),loadSource:async()=>{await gate;return Buffer.from('def ok():\n pass\n');}}),pending=f.submit();
 try{
  assert.deepEqual(events,[{phase:'job-admitted'}]);const cancelled=f.service.cancel('job-a');await delay(10);
  assert.equal(f.service.isIdle(),false);assert.deepEqual(events,[{phase:'job-admitted'}]);release();await cancelled;
  assert.equal((await pending).status,'cancelled');assert.deepEqual(events,[{phase:'job-admitted'},{phase:'job-finished',status:'cancelled'}]);assert.equal(f.service.isIdle(),true);
 }finally{release();await pending;}
});
test('stale results and corruption after a successful immutable read are refused, never cached',async t=>{
 const text='def ok():\n pass\n',bytes=Buffer.from(text);let loaded=bytes,current=true;
 const f=fixture(t,text,{loadSource:async()=>loaded});assert.equal((await f.submit()).status,'complete');loaded=Buffer.from(text+'# changed');assert.equal((await f.submit({jobId:'changed'})).reason,'SOURCE_HASH_MISMATCH');
 loaded=bytes;f.invalidate();assert.equal((await f.submit({jobId:'stale'})).status,'cancelled');
});
test('hard deadline kills actual worker and cancellation/drain leaves no owned threads',async t=>{
 const f=fixture(t,'('.repeat(500000)+')'.repeat(500000)),start=performance.now();
 const r=await f.submit({budget:{wallMs:1}});assert.equal(r.status,'budget-exceeded');assert.equal(f.service.isIdle(),true);assert.ok(performance.now()-start<1000,'Actual termination must finish, not just return a timer');
 await f.service.dispose();assert.equal((await f.submit({jobId:'after'})).status,'cancelled');
});
test('worker artifact bytes are bound to build receipt and tampered identity never starts a worker',async t=>{
 const bytes=await readFile(built.workerPath);assert.equal(hash(bytes),built.sha256);assert.match(bytes.toString(),/MIT/);assert.match(bytes.toString(),/Local Code parser licenses/);
 const f=fixture(t,'def ok():\n pass\n',{workerSha256:'0'.repeat(64)});assert.equal((await f.submit()).reason,'WORKER_IDENTITY_REFUSED');assert.equal(f.service.isIdle(),true);
});
test('BOM/CRLF immutable offsets and long-token/node budgets remain exact and explicit',async t=>{
 const text='\uFEFF# original\r\ndef actual():\r\n    return "Ș😀"\r\n',f=fixture(t,text),r=await f.submit();assert.ok(r.result.definitions.some(x=>x.name==='actual'));const def=r.result.definitions.find(x=>x.name==='actual');assert.equal(text.slice(def.nameFrom,def.nameTo),'actual');assert.equal(def.line,2);assert.equal(hash(f.bytes),f.sha256);
 const limited=await f.submit({jobId:'small',budget:{maxNodes:2}});assert.equal(limited.status,'partial');assert.equal(limited.reason,'INDEX_BUDGET');assert.ok(limited.result.visited<=3);
 const long=fixture(t,'def '+ 'x'.repeat(10000)+'():\n    pass\n');const token=await long.submit();assert.equal(token.status,'partial');assert.equal(token.result.definitions.length,0);assert.equal(hash(long.bytes),long.sha256);
});
test('actual worker crash is joined and deadline-expired worker can be replaced by a fresh successful job',async t=>{
 const path=join(built.root,'owned-crash.cjs'),code='throw Error("Owned worker crash");';await writeFile(path,code);
 const f=fixture(t,'def ok():\n    pass\n',{workerPath:path,workerSha256:hash(Buffer.from(code))});assert.equal((await f.submit()).status,'error');assert.equal(f.service.isIdle(),true);
 const fresh=fixture(t,'def replacement():\n    pass\n');assert.equal((await fresh.submit({budget:{wallMs:1}})).status,'budget-exceeded');assert.equal((await fresh.submit({jobId:'replacement'})).status,'complete');assert.equal(fresh.service.isIdle(),true);
});
test('oversized worker artifact is refused by bounded owned-file read before worker creation',async t=>{
 const path=join(built.root,'oversized-worker.cjs');await writeFile(path,Buffer.alloc(2*1024*1024+1));let started=false;
 const f=fixture(t,'def ok():\n    pass\n',{workerPath:path,workerSha256:'0'.repeat(64),onActivity:({phase})=>{if(phase==='worker-started')started=true;}});assert.equal((await f.submit()).reason,'WORKER_IDENTITY_REFUSED');assert.equal(started,false);assert.equal(f.service.isIdle(),true);
});
