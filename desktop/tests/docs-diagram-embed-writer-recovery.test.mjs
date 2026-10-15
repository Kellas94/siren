// Actual asset store and exclusiveWriter on a disposable filesystem.
// Process inspection is deterministic fixture data; no native process is run.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import {join,dirname,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {DiagramEmbedAssetStore} from '../src/documents/diagram-embed-assets.mjs';
const prior={pid:111,path:'C:\\SIREN\\electron.exe',startedAt:'2026-10-10T10:00:00.000Z'};
const owner={pid:222,path:'C:\\SIREN\\electron.exe',startedAt:'2026-10-11T10:00:00.000Z'};
async function fixture(t,observed){
 const root=await mkdtemp(join(tmpdir(),'siren-embed-writer-'));
 t.after(async()=>{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.match(basename(root),/^siren-embed-writer-/);await rm(root,{recursive:true,force:true});});
 const directory=join(root,'project-a');await mkdir(directory);const calls=[];
 const projects={directory:async id=>{assert.equal(id,'project-a');return directory;},writerOptions:{ownerIdentity:owner,inspectProcess:async pid=>{calls.push(pid);return observed;}}};
 return {directory,lock:join(directory,'writer.lock'),calls,store:new DiagramEmbedAssetStore({projects})};
}
const put=(store,isCurrent=()=>true)=>store.put({projectId:'project-a',kind:'diagram-source',bytes:Buffer.from('{"source":"flowchart LR; A-->B"}'),isCurrent});
test('asset write records the complete trusted project writer identity',async t=>{
 const f=await fixture(t,null);let captured;
 await put(f.store,()=>{if(existsSync(f.lock))captured=JSON.parse(readFileSync(f.lock,'utf8'));return true;});
 assert.deepEqual(captured,owner);assert.equal(existsSync(f.lock),false);assert.deepEqual(f.calls,[]);
});
test('confirmed dead asset writer can be reclaimed and its unpublished staging retired',async t=>{
 const f=await fixture(t,null),stage=join(f.directory,'diagram-embed-staging');await mkdir(stage);
 const abandoned=join(stage,'pending-00000000-0000-0000-0000-000000000001.tmp');await writeFile(abandoned,'old incomplete bytes');await writeFile(f.lock,JSON.stringify(prior));
 const ref=await put(f.store);assert.deepEqual(f.calls,[prior.pid]);assert.equal(existsSync(f.lock),false);assert.equal(existsSync(abandoned),false);
 assert.equal((await f.store.read({projectId:'project-a',ref,isCurrent:()=>true})).length,ref.bytes);
});
for(const [label,observation]of [['live',prior],['unknown',undefined]])test(label+' prior writer is refused and its lock remains exact',async t=>{
 const f=await fixture(t,observation),original=Buffer.from(JSON.stringify(prior));await writeFile(f.lock,original);
 await assert.rejects(put(f.store),{code:'WRITER_BUSY'});assert.deepEqual(f.calls,[prior.pid]);assert.deepEqual(await readFile(f.lock),original);
});
test('reused PID with a different start identity can reclaim only the old writer',async t=>{
 const f=await fixture(t,{...prior,startedAt:'2026-10-11T09:00:00.000Z'});await writeFile(f.lock,JSON.stringify(prior));
 await put(f.store);assert.deepEqual(f.calls,[prior.pid]);assert.equal(existsSync(f.lock),false);
});
test('legacy PID-only orphan remains refused without inventing process provenance',async t=>{
 const f=await fixture(t,null),original=Buffer.from(JSON.stringify({pid:prior.pid}));await writeFile(f.lock,original);
 await assert.rejects(put(f.store),{code:'WRITER_BUSY'});assert.deepEqual(await readFile(f.lock),original);assert.deepEqual(f.calls,[]);
});
