// Owner stress evidence: real trusted analysis workers, literal Python DATA only.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildAnalysisWorker} from '../../build/analysis.mjs';
import {AnalysisService} from '../../src/sources/analysis.mjs';
const out=resolve('../code-functional-stress-20261012');
await mkdir(out,{recursive:true});
const built=await buildAnalysisWorker({baselinePath:resolve('baseline/R78.html'),outputDirectory:resolve(out,'worker')});
const hash=b=>createHash('sha256').update(b).digest('hex');
const outcomes=[];
async function inspect(name,text,extra,check,right){
 const a=Buffer.from(text),b=right===undefined?null:Buffer.from(right),events=[];
 const ref={sourceId:'source-a',version:1,sha256:hash(a)},rightRef=b?{sourceId:'source-b',version:2,sha256:hash(b)}:undefined;
 const before=process.memoryUsage(),start=performance.now();
 const service=new AnalysisService({workerPath:built.workerPath,workerSha256:built.sha256,loadSource:async(_ref,{side})=>side==='right'?b:a,onActivity:e=>events.push(e)});
 try{
  const answer=await service.submit({...ref,kind:b?'diff':'index',jobId:name,...(rightRef?{rightRef}:{}),...extra});
  check(answer,events);
  assert.equal(service.isIdle(),true);assert.equal(hash(a),ref.sha256);if(b)assert.equal(hash(b),rightRef.sha256);
  outcomes.push({name,status:answer.status,reason:answer.reason??null,coverage:answer.coverage,utf8Bytes:a.length,utf16Units:text.length,rightBytes:b?.length??null,elapsedMs:performance.now()-start,mainProcessBefore:before,mainProcessAfter:process.memoryUsage(),workerStarted:events.some(e=>e.phase==='worker-started'),workerExited:events.some(e=>e.phase==='worker-exited')});
 }finally{assert.equal(await service.dispose(),true);}
}
const prefix='# stored literal Python source Ș😀\r\n'.repeat(299997);
const ending='def final_step():\r\n    return "DO_NOT_EXECUTE"\r\n';
const large=prefix+ending;
await inspect('overview-300k-unicode',large,{},r=>{assert.equal(r.status,'partial');assert.equal(r.coverage.truncated,true);assert.equal(r.coverage.totalUnits,large.length);assert.ok(r.coverage.to<=2*1024*1024);});
await inspect('selected-eof-300k-unicode',large,{range:{from:prefix.length,to:large.length}},r=>{assert.equal(r.status,'complete');assert.equal(r.result.definitions.length,1);const d=r.result.definitions[0];assert.equal(d.name,'final_step');assert.equal(d.line,299998);assert.equal(large.slice(d.nameFrom,d.nameTo),'final_step');assert.equal(r.coverage.from,prefix.length);assert.equal(r.coverage.to,large.length);});
const structure='class Example:\n    async def run(self, value):\n        match value:\n            case {"item": item}:\n                return [x for x in item if x]\n\n'.repeat(5000);
await inspect('complex-python-definition-cap',structure,{},r=>{assert.equal(r.status,'partial');assert.equal(r.reason,'INDEX_BUDGET');assert.equal(r.coverage.limited,true);assert.ok(r.result.definitions.length<=2000);for(const d of r.result.definitions)assert.equal(structure.slice(d.nameFrom,d.nameTo),d.name);});
const denseA='old = "Ș😀"\n'.repeat(100000),denseB='new = "Ș😀"\n'.repeat(100000);
await inspect('dense-changed-100k',denseA,{},r=>{assert.equal(r.status,'partial');assert.equal(r.reason,'DIFF_APPROXIMATION');assert.equal(r.result.approximate,true);assert.equal(r.result.hunks.length,1);assert.ok(r.result.hunks[0].left.preview.length+r.result.hunks[0].right.preview.length<=32768);},denseB);
const tooLarge='x'.repeat(32*1024*1024+1);
await inspect('byte-limit-plus-one',tooLarge,{},(r,events)=>{assert.equal(r.status,'budget-exceeded');assert.equal(r.reason,'SOURCE_BYTES_BUDGET');assert.equal(events.some(e=>e.phase==='worker-started'),false);});
const sourcePaths=['src/sources/analysis.mjs','src/sources/analysis-worker.mjs','src/sources/diff-worker.mjs','src/sources/map-worker.mjs','build/analysis.mjs','tests/native/code-functional-stress-20261012.mjs'];
const inputs=[];for(const path of sourcePaths){const b=await readFile(resolve(path));inputs.push({path:'desktop/'+path,bytes:b.length,sha256:hash(b)});}
const report={author:'/root',scope:'Five actual local trusted-worker/service stress cases; Python DATA not executed; no native UI, p95 or total worker RSS claim',node:process.version,platform:process.platform,arch:process.arch,worker:{sha256:built.sha256},inputs,outcomes};
await writeFile(resolve(out,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:outcomes.length,results:outcomes.map(({name,status,reason,elapsedMs,utf8Bytes,utf16Units})=>({name,status,reason,elapsedMs,utf8Bytes,utf16Units})),nativeUiQualified:false}));
