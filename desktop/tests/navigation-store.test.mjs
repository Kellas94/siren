import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { mkdtemp } from './fixtures/temporary.mjs';
import { NavigationStore } from '../src/navigation/store.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';

async function fixture(options={}) {
  const root=await mkdtemp(join(tmpdir(),'siren-navigation-'));
  return {root,store:new NavigationStore(root,options),path:join(root,'UI','navigation.json')};
}
const request=(projectId='project-a',extra={})=>({projectId,label:'Test project',location:{surface:'code',entityId:'source-a',sourceRef:{sourceId:'source-a',version:7,sha256:'a'.repeat(64)},cursor:{anchor:12,head:4}},visitedAt:'2026-10-03T07:00:00.000Z',...extra});
async function hashes(root) {
  const result={};
  async function walk(dir) {for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else result[relative(root,path)]=createHash('sha256').update(await readFile(path)).digest('hex');}}
  await walk(root);return result;
}
test('navigation_metadata_preserves_content source bytes revisions and checkpoints',async()=>{
  const {root,store}=await fixture();const projects=new ProjectStore(root);
  const original=await projects.createProject({label:'Owned fixture',json:'{"docs":"planted private text","diagrams":["flowchart TD\\nA-->B"]}'});
  const sources=new SourceRepository(root);const imported=await sources.importSource({projectId:original.project.id,sourceId:'source-a',bytes:Buffer.from('print("exact source")\r\n'),provenance:{kind:'test'}});
  const before=await hashes(join(root,'Projects'));
  const result=await store.record(request(original.project.id,{location:{surface:'code',entityId:'source-a',sourceRef:{sourceId:imported.sourceId,version:imported.version,sha256:imported.sha256}}}));
  assert.equal(result.ok,true);assert.deepEqual(await hashes(join(root,'Projects')),before);
  const afterProject=await projects.readProject(original.project.id);assert.equal(afterProject.revision,original.revision);assert.deepEqual(afterProject,original);
  const fresh=new NavigationStore(root);assert.equal((await fresh.locations())[0].sourceRef.sha256,imported.sha256);
});
test('64 locations accepted 65th refused existing updates preserve every other location',async()=>{
  const {root,store,path}=await fixture();
  for(let i=0;i<64;i++)assert.equal((await store.record(request(`project-${i}`))).ok,true);
  const prior=await readFile(path);const refused=await store.record(request('project-64'));
  assert.equal(refused.code,'NAVIGATION_LIMIT');assert.equal(refused.ok,false);assert.deepEqual(await readFile(path),prior);
  const before=await store.read();assert.equal((await store.record(request('project-0',{label:'Latest',visitedAt:'2026-10-03T08:00:00.000Z'}))).ok,true);
  const actual=await new NavigationStore(root).read();assert.equal(actual.entries.length,64);assert.equal(actual.entries[0].projectId,'project-0');
  assert.deepEqual(actual.entries.filter(x=>x.projectId!=='project-0'),before.entries.filter(x=>x.projectId!=='project-0'));
});
test('complete-file byte budget accepts 64 KiB and ignores but preserves +1',async()=>{
  const {root,path}=await fixture();await mkdir(join(root,'UI'));
  const json=JSON.stringify({schema:1,entries:[]});const bytes=Buffer.from(json+' '.repeat(64*1024-Buffer.byteLength(json)));
  assert.equal(bytes.length,64*1024);await writeFile(path,bytes);
  const exact=new NavigationStore(root);assert.deepEqual(await exact.read(),{schema:1,entries:[]});assert.equal(exact.diagnostic,null);
  const excess=Buffer.concat([bytes,Buffer.from(' ')]);await writeFile(path,excess);const invalid=new NavigationStore(root);
  assert.deepEqual(await invalid.read(),{schema:1,entries:[]});assert.equal(invalid.diagnostic.code,'NAVIGATION_LIMIT');
  const refused=await invalid.record(request());assert.equal(refused.ok,false);assert.deepEqual(await readFile(path),excess);
});
test('oversized serialized record refuses before write and preserves prior exact bytes',async()=>{
  const {store,path}=await fixture();assert.equal((await store.record(request())).ok,true);const prior=await readFile(path);
  const layouts=Array.from({length:16},(_,i)=>({role:'code',entityId:'e'.repeat(128),version:1,normalBounds:{x:0,y:0,width:960,height:640},displayId:'d'.repeat(128),maximized:false,fullscreen:false}));
  let refusal;
  for(let i=0;i<64;i++){const before=await readFile(path);const result=await store.record(request(`heavy-${i}`,{label:'é'.repeat(256),location:{surface:'code',layouts}}));if(!result.ok){refusal=result;assert.deepEqual(await readFile(path),before);break;}}
  assert.equal(refusal?.code,'NAVIGATION_LIMIT');assert.ok((await readFile(path)).length<=64*1024);assert.ok(prior.length>0);
});
test('invalid input and readonly access preserve the existing navigation file',async()=>{
  let writable=true;const {store,path}=await fixture({canWrite:()=>writable});await store.record(request());const prior=await readFile(path);
  for(const extra of [{label:'a'.repeat(257)},{location:{surface:'code',secret:'private'}},{visitedAt:'invalid'}]){assert.equal((await store.record(request('project-a',extra))).ok,false);assert.deepEqual(await readFile(path),prior);}
  writable=false;assert.equal((await store.record(request('project-b'))).code,'ACCESS_REFUSED');assert.deepEqual(await readFile(path),prior);
});
test('corrupt metadata is ignored with diagnostic without replacing it or project mode',async()=>{
  const {root,path}=await fixture();await mkdir(join(root,'UI'));const bytes=Buffer.from('{broken metadata');await writeFile(path,bytes);const store=new NavigationStore(root);
  assert.deepEqual(await store.read(),{schema:1,entries:[]});assert.equal(store.diagnostic.code,'INVALID_NAVIGATION');assert.equal((await store.record(request())).ok,false);assert.deepEqual(await readFile(path),bytes);
});
test('concurrent native metadata intents serialize without losing another project',async()=>{
  const {root,store}=await fixture();const other=new NavigationStore(root);
  const results=await Promise.all(Array.from({length:12},(_,i)=>(i%2?other:store).record(request(`project-${i}`))));
  assert.ok(results.every(x=>x.ok));assert.equal((await new NavigationStore(root).read()).entries.length,12);
});
test('torn write refuses with prior bytes and post-rename failure never claims verified acknowledgement',async()=>{
  let fail='';const {root,store,path}=await fixture({fault:async phase=>{if(phase===fail)throw Error('owned I/O fault');}});await store.record(request());const prior=await readFile(path);
  fail='before-rename';const refused=await store.record(request('project-b'));assert.equal(refused.ok,false);assert.deepEqual(await readFile(path),prior);
  fail='after-rename';const uncertain=await store.record(request('project-c'));assert.equal(uncertain.ok,false);assert.equal(uncertain.code,'NAVIGATION_WRITE_FAILED');
  assert.equal((await new NavigationStore(root).read()).entries.some(x=>x.projectId==='project-c'),true);
});
test('permission revoked at final selection fence refuses before atomic replacement',async()=>{
  let writable=true,armed=false;const {store,path}=await fixture({canWrite:()=>writable,fault:async phase=>{if(armed&&phase==='before-rename')writable=false;}});await store.record(request());const prior=await readFile(path);armed=true;
  const result=await store.record(request('project-b'));assert.equal(result.code,'ACCESS_REFUSED');assert.deepEqual(await readFile(path),prior);
});
test('failed actual readback and invalid UTF8 cannot produce a successful receipt',async()=>{
  let corrupt=false;const {root,store,path}=await fixture({fault:async phase=>{if(corrupt&&phase==='after-rename')await writeFile(path,Buffer.from([0xff,0xfe]));}});
  assert.equal((await store.record(request())).ok,true);corrupt=true;
  const result=await store.record(request('project-b'));assert.equal(result.ok,false);assert.equal(result.code,'NAVIGATION_WRITE_FAILED');
  const fresh=new NavigationStore(root);assert.deepEqual(await fresh.read(),{schema:1,entries:[]});assert.equal(fresh.diagnostic.code,'INVALID_NAVIGATION');
  const prior=await readFile(path);assert.equal((await fresh.record(request())).ok,false);assert.deepEqual(await readFile(path),prior);
});
test('caller mutation while permission awaits cannot alter copied metadata',async()=>{
  let release,entered;const enteredPromise=new Promise(resolve=>{entered=resolve;});const gate=new Promise(resolve=>{release=resolve;});let first=true;
  const {store}=await fixture({canWrite:async()=>{if(first){first=false;entered();await gate;}return true;}});
  const input=request();const saving=store.record(input);await enteredPromise;input.location.sourceRef.version=99;input.label='Injected after capture';release();assert.equal((await saving).ok,true);
  const saved=(await store.read()).entries[0];assert.equal(saved.label,'Test project');assert.equal(saved.location.sourceRef.version,7);
});
