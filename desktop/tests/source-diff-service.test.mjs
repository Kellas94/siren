import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {buildAnalysisWorker} from '../build/analysis.mjs';
import {AnalysisService} from '../src/sources/analysis.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');let built,root;
test.before(async()=>{root=await mkdtemp(resolve('evidence/diff-service-'));built=await buildAnalysisWorker({baselinePath:resolve('baseline/R78.html'),outputDirectory:root});});
test.after(async()=>{if(root)await rm(root,{recursive:true,force:true});});
function fixture(t,left,right,options={}){
 const a=Buffer.from(left),b=Buffer.from(right),ref={sourceId:'source-a',version:1,sha256:hash(a)},rightRef={sourceId:'source-b',version:2,sha256:hash(b)},reads=[],activities=[];
 const service=new AnalysisService({workerPath:built.workerPath,workerSha256:built.sha256,loadSource:async(r,{side})=>{reads.push(side);return side==='right'?b:a;},onActivity:state=>activities.push(state),...options});t.after(()=>service.dispose());
 return {a,b,ref,rightRef,service,reads,activities,submit:extra=>service.submit({...ref,rightRef,kind:'diff',jobId:'comparison',...extra})};
}
test('actual owned diff worker compares two immutable hashes and exact EOF changes in 300k-line source',async t=>{
 const left=Array.from({length:300000},(_,i)=>`value_${i}=${i}\n`).join(''),right=left+'# exact EOF Ș😀\n',f=fixture(t,left,right),r=await f.submit();
 assert.equal(r.status,'complete');assert.deepEqual(r.rightRef,f.rightRef);assert.deepEqual(f.reads,['left','right']);assert.equal(r.result.hunks.length,1);assert.equal(r.result.hunks[0].left.from,left.length);assert.equal(r.result.hunks[0].right.preview,'# exact EOF Ș😀\n');assert.equal(hash(f.a),f.ref.sha256);assert.equal(hash(f.b),f.rightRef.sha256);assert.equal(f.service.isIdle(),true);
});
test('missing/forged right ref, right corruption and left-buffer mutation during second read cannot publish a diff',async t=>{
 const f=fixture(t,'old\n','new\n');assert.equal((await f.submit({rightRef:undefined})).reason,'REQUEST_REFUSED');assert.equal(f.reads.length,0);
 const bad=fixture(t,'old\n','new\n',{loadSource:async(_ref,{side})=>Buffer.from(side==='right'?'CORRUPTED':'old\n')});assert.equal((await bad.submit()).reason,'SOURCE_HASH_MISMATCH');assert.deepEqual(bad.activities,[{phase:'job-admitted'},{phase:'job-finished',status:'error'}]);
 const shared=Buffer.from('old\n'),mutating=fixture(t,'old\n','new\n',{loadSource:async(_ref,{side})=>{if(side==='right'){shared[0]=120;return Buffer.from('new\n');}return shared;}});assert.equal((await mutating.submit()).reason,'SOURCE_HASH_MISMATCH');assert.deepEqual(mutating.activities,[{phase:'job-admitted'},{phase:'job-finished',status:'error'}]);
});
test('cancellation during right-version read waits for actual I/O and starts no late worker',{timeout:1500},async t=>{
 let begin,release;const started=new Promise(resolve=>{begin=resolve;}),gate=new Promise(resolve=>{release=resolve;});const f=fixture(t,'old\n','new\n',{loadSource:async(_ref,{side})=>{if(side==='right'){begin();await gate;}return Buffer.from(side==='right'?'new\n':'old\n');}});
 const pending=f.submit();let cancelling;try{await Promise.race([started,pending.then(result=>{if(result.status==='unsupported')throw Error('DIFF_NOT_IMPLEMENTED');})]);cancelling=f.service.cancel('comparison');assert.equal(f.service.isIdle(),false);assert.deepEqual(f.activities,[{phase:'job-admitted'}]);}finally{release();}await cancelling;assert.equal((await pending).status,'cancelled');assert.equal(f.service.isIdle(),true);assert.deepEqual(f.activities,[{phase:'job-admitted'},{phase:'job-finished',status:'cancelled'}]);
});
