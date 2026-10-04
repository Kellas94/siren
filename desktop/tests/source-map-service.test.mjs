import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {buildAnalysisWorker} from '../build/analysis.mjs';
import {AnalysisService} from '../src/sources/analysis.mjs';
let root,build;const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test.before(async()=>{root=await mkdtemp(resolve('evidence/map-service-'));build=await buildAnalysisWorker({baselinePath:resolve('baseline/R78.html'),outputDirectory:root});});
test.after(async()=>{if(root)await rm(root,{recursive:true,force:true});});
function fixture(t,text){const bytes=Buffer.from(text),ref={sourceId:'source-map',version:7,sha256:hash(bytes)},reads=[];const service=new AnalysisService({workerPath:build.workerPath,workerSha256:build.sha256,loadSource:async request=>{reads.push(request);return bytes;}});t.after(()=>service.dispose());return {bytes,ref,reads,submit:extra=>service.submit({...ref,kind:'map',jobId:'selected-map',range:{from:0,to:text.length},...extra})};}

test('actual patched worker maps selected Python syntax containment and exact navigation without claiming execution',async t=>{
 const text='class Agent:\r\n    async def run(self, items):\r\n        for item in items:\r\n            if item:\r\n                yield process(item)\r\n            else:\r\n                return None\r\n\r\ntry:\r\n    main()\r\nexcept ValueError:\r\n    log()\r\n',f=fixture(t,text),r=await f.submit();
 assert.equal(r.status,'complete');assert.equal(r.result.semantics,'syntax-containment');assert.ok(r.result.nodes.some(node=>node.kind==='class'));assert.ok(r.result.nodes.some(node=>node.kind==='function'));assert.ok(r.result.nodes.some(node=>node.kind==='loop'));assert.ok(r.result.nodes.some(node=>node.kind==='branch'));assert.ok(r.result.nodes.some(node=>node.kind==='call'&&node.label==='process(item)'));
 for(const node of r.result.nodes){assert.ok(node.from>=0&&node.to<=text.length);assert.equal(node.line,text.slice(0,node.from).split('\r\n').length);if(node.parent!==null){const parent=r.result.nodes.find(candidate=>candidate.id===node.parent);assert.ok(parent.from<=node.from&&parent.to>=node.to);assert.ok(r.result.edges.some(edge=>edge.from===parent.id&&edge.to===node.id&&edge.kind==='contains'));}}
 assert.equal(hash(f.bytes),f.ref.sha256);assert.equal(r.sourceId,f.ref.sourceId);
});

test('selected syntax map uses exact EOF ranges/lines beyond 300k and refuses a missing range before I/O',async t=>{
 const prefix=Array.from({length:300000},(_,i)=>`item_${i}=${i}\n`).join(''),tail='def selected_tail():\n    if ready():\n        return "Ș😀"\n',text=prefix+tail,f=fixture(t,text);
 assert.equal((await f.submit({range:undefined})).reason,'REQUEST_REFUSED');assert.equal(f.reads.length,0);
 const r=await f.submit({range:{from:prefix.length,to:text.length}});assert.equal(r.status,'complete');assert.equal(r.coverage.from,prefix.length);assert.equal(r.result.nodes.find(node=>node.kind==='function').line,300001);assert.ok(r.result.nodes.every(node=>node.from>=prefix.length));assert.equal(hash(f.bytes),f.ref.sha256);
});

test('finite map budgets, incomplete syntax and literal labels remain explicitly partial and retain immutable bytes',async t=>{
 const text='def a():\n    return "<img src=x>"\n\ndef b():\n    a()\n',f=fixture(t,text),r=await f.submit({budget:{maxGraphNodes:2}});
 assert.equal(r.status,'partial');assert.equal(r.reason,'GRAPH_BUDGET');assert.equal(r.result.nodes.length,2);assert.equal(r.result.edges.length,1);assert.equal(r.coverage.limited,true);assert.equal(hash(f.bytes),f.ref.sha256);
 assert.equal((await f.submit({budget:{maxGraphNodes:121}})).reason,'REQUEST_REFUSED');
 const broken=fixture(t,'def incomplete(:\n    return "literal"\n'),partial=await broken.submit();assert.equal(partial.status,'partial');assert.ok(partial.coverage.syntaxErrors>0);assert.equal(hash(broken.bytes),broken.ref.sha256);
});
