import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from './fixtures/temporary.mjs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {commitManifest,manifestRequestHash} from '../src/sources/manifest.mjs';
import {digest} from '../src/projects/atomic.mjs';
import {parseSourceBundle} from '../src/sources/bundle-import.mjs';

async function exported(bytes=Buffer.from('\ufeff# Ș😀\r\nx=123\n')){
 const root=await mkdtemp(join(tmpdir(),'siren-bundle-import-')),projects=new ProjectStore(root),repository=new SourceRepository(root),recovery=new RecoveryStore(root,{sources:repository});
 const initial=await projects.createProject({label:'Actual exported source bundle',json:'{}'}),provenance=JSON.parse('{"agentId":"agent-a","future":{"keep":"EXACT"},"__proto__":{"dataOnly":true}}');
 const ref=await repository.importSource({projectId:initial.project.id,bytes,provenance});
 const metadata={kind:'siren-desktop',schema:2,storage:{'t-industries-siren-v23-state':JSON.stringify({diagrams:[],workpapers:[],codeFiles:[{id:'code-a',sourceRef:{sourceId:ref.sourceId,version:ref.version,sha256:ref.sha256}}]}),opaque:'  {"future": true}  '},future:{keep:['opaque']}};
 const receipt=await commitManifest({projects,repository,recovery,projectId:initial.project.id,baseRevision:1,sourceRefs:[ref],metadata,operationId:'bundle-parser-fixture'});assert.equal(receipt.ok,true);
 const snapshot=await projects.readProject(initial.project.id),wire=await recovery.exportSourceSnapshot(snapshot);
 return {root,projects,repository,recovery,snapshot,wire,value:JSON.parse(wire),bytes,ref,metadata};
}
const encode=value=>Buffer.from(JSON.stringify(value));
function rehash(value){const s=value.snapshot;s.sha256=digest(Buffer.from(s.json));s.requestHash=manifestRequestHash({projectId:s.project.id,baseRevision:s.revision-1,sourceRefs:s.sourceRefs,json:s.json,operationId:s.operationId});return value;}

test('a real RecoveryStore source export is admitted with exact bytes metadata and unknown provenance',async()=>{
 const f=await exported(),result=parseSourceBundle(f.wire);assert.ok(result);assert.deepEqual(result.snapshot,f.snapshot);assert.deepEqual(result.metadata,f.metadata);assert.deepEqual(result.sources[0].bytes,f.bytes);assert.deepEqual(result.sources[0].ref,f.ref);assert.equal(Object.hasOwn(result.sources[0].ref.provenance,'__proto__'),true);assert.equal({}.dataOnly,undefined);
});
test('only valid legacy JSON falls back; declared invalid bundles never fall back',()=>{
 for(const value of [{type:'siren-project',state:{diagrams:[]}},[],null,1])assert.equal(parseSourceBundle(encode(value)),null);
 assert.throws(()=>parseSourceBundle(Buffer.from('{bad')));
 for(const value of [{format:'siren-source-bundle'},{format:'siren-source-bundle',schema:1,snapshot:{},sources:[]}])assert.throws(()=>parseSourceBundle(encode(value)));
});
test('wire source aggregate reference and metadata budgets are checked using lower injected caps',async()=>{
 const f=await exported();for(const limits of [{wireBytes:f.wire.length-1},{sourceBytes:f.bytes.length-1},{decodedBytes:f.bytes.length-1},{references:0},{nodes:2},{depth:1},{provenanceBytes:2}])assert.throws(()=>parseSourceBundle(f.wire,{limits}));
 for(const limits of [{wireBytes:65*1024*1024},{sourceBytes:33*1024*1024},{decodedBytes:257*1024*1024},{mystery:1},{nodes:-1}])assert.throws(()=>parseSourceBundle(f.wire,{limits}));
});
test('snapshot hash source hash full provenance and actual metrics must agree',async()=>{
 const f=await exported();
 for(const mutate of [v=>{v.snapshot.sha256='0'.repeat(64);},v=>{v.sources[0].base64=Buffer.from('wrong').toString('base64');},v=>{v.sources[0].ref.provenance.future.keep='forged';},v=>{v.snapshot.sourceRefs[0].lines++;v.sources[0].ref.lines++;rehash(v);}]){const v=structuredClone(f.value);mutate(v);assert.throws(()=>parseSourceBundle(encode(v)));}
});
test('base64 is canonical rather than accepting whitespace junk excess padding or omitted padding',async()=>{
 const f=await exported(Buffer.from('f'));for(const base64 of ['Zg','Zg===',' Zg==','Zg==!','Zh==','Zg==\n']){const v=structuredClone(f.value);v.sources[0].base64=base64;assert.throws(()=>parseSourceBundle(encode(v)));}
});
test('operational unknown fields duplicates missing and extra records are refused without discarding opaque metadata',async()=>{
 const f=await exported();for(const mutate of [v=>{v.future=true;},v=>{v.sources[0].future=true;},v=>{v.sources[0].ref.future=true;},v=>{v.sources.push(structuredClone(v.sources[0]));},v=>{v.sources=[];}]){const v=structuredClone(f.value);mutate(v);assert.throws(()=>parseSourceBundle(encode(v)));}
 assert.deepEqual(parseSourceBundle(f.wire).metadata,f.metadata);
});
test('traversal identities and unknown metadata source pointers cannot be admitted',async()=>{
 const f=await exported();const traversal=structuredClone(f.value);traversal.snapshot.project.id='../escape';assert.throws(()=>parseSourceBundle(encode(traversal)));
 const dangling=structuredClone(f.value),metadata=JSON.parse(dangling.snapshot.json);metadata.future.sourceRef={sourceId:'unowned',version:1,sha256:'0'.repeat(64)};dangling.snapshot.json=JSON.stringify(metadata);rehash(dangling);assert.throws(()=>parseSourceBundle(encode(dangling)));
});
test('unsupported source encoding remains exact raw bytes and reference metrics',async()=>{
 const f=await exported(Buffer.from([0xff,0x00,0xc3,0x28])),result=parseSourceBundle(f.wire);assert.equal(result.sources[0].ref.encoding,'unsupported');assert.equal(result.sources[0].ref.lines,null);assert.deepEqual(result.sources[0].bytes,f.bytes);
});
test('parser owns input source bytes independently of the chosen wire buffer',async()=>{
 const f=await exported(),wire=Buffer.from(f.wire),result=parseSourceBundle(wire);wire.fill(0);assert.deepEqual(result.sources[0].bytes,f.bytes);
});
test('canonical base64 validation admits a bounded multi-megabyte real export without regex stack overflow',async()=>{
 const f=await exported(Buffer.alloc(2*1024*1024,0x78));assert.deepEqual(parseSourceBundle(f.wire).sources[0].bytes,f.bytes);
});

test('actual 300k-line Unicode Python export parses without regex stack overflow and retains exact bytes',async()=>{
 const bytes=Buffer.from('\ufeff'+Array.from({length:300000},(_,i)=>`item_${i} = "Ș😀"`).join('\r\n'));
 assert.equal(bytes.length,7088891);const f=await exported(bytes),before=Buffer.from(f.wire),result=parseSourceBundle(f.wire);
 assert.equal(result.sources[0].ref.lines,300000);assert.deepEqual(result.sources[0].bytes,bytes);assert.deepEqual(result.sources[0].ref,f.ref);assert.deepEqual(result.snapshot,f.snapshot);assert.deepEqual(result.metadata,f.metadata);assert.deepEqual(f.wire,before);assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);
});

test('flat base64 validation keeps empty and all padding shapes canonical and refuses malformed padding or unused bits',async()=>{
 for(const text of ['', 'f', 'fo', 'foo']){const f=await exported(Buffer.from(text));assert.deepEqual(parseSourceBundle(f.wire).sources[0].bytes,Buffer.from(text));}
 const f=await exported(Buffer.from('f'));
 for(const base64 of ['====','A===','Z=g=','=Zg=','Zg=Z','Zg======','Zg','Zg===',' Zg==','Zg==!','Zg==\n','Zg-_','Zh==','Zm9=']){
  const value=structuredClone(f.value);value.sources[0].base64=base64;assert.throws(()=>parseSourceBundle(encode(value)),{code:'BUNDLE_BASE64_INVALID'},base64);
 }
});
