// Constructed post-crash filesystem states, not native crash receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,lstat,readdir,link,rm} from 'node:fs/promises';
import {join,dirname,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {DiagramEmbedAssetStore} from '../src/documents/diagram-embed-assets.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t,trusted=true){
 const root=await mkdtemp(join(tmpdir(),'siren-linked-stage-'));
 t.after(async()=>{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.match(basename(root),/^siren-linked-stage-/);await rm(root,{recursive:true,force:true});});
 const directory=join(root,'project-a'),staging=join(directory,'diagram-embed-staging'),assets=join(directory,'diagram-embed-assets');await mkdir(directory);await mkdir(staging);await mkdir(assets);
 const projects={directory:async()=>directory};if(trusted)projects.writerOptions={ownerIdentity:{pid:222,path:'C:\\SIREN\\electron.exe',startedAt:'2026-10-11T10:00:00.000Z'},inspectProcess:async()=>null};
 return {directory,staging,assets,store:new DiagramEmbedAssetStore({projects})};
}
async function pair(f,n,bytes='complete source',name=sha(Buffer.from(bytes))){
 const stage=join(f.staging,'pending-00000000-0000-0000-0000-'+String(n).padStart(12,'0')+'.tmp'),final=join(f.assets,name+'.blob');await writeFile(stage,bytes);await link(stage,final);return {stage,final,bytes:Buffer.from(bytes)};
}
const put=(f,bytes='fresh bytes',isCurrent=()=>true)=>f.store.put({projectId:'project-a',kind:'diagram-source',bytes:Buffer.from(bytes),isCurrent});
test('recover exact final-link pair, retain final bytes and admit unrelated insertion',async t=>{
 const f=await fixture(t),p=await pair(f,1);const saved=join(f.directory,'manifest.json');await writeFile(saved,'saved fixed/history');
 await put(f);assert.deepEqual(await readdir(f.staging),[]);assert.deepEqual(await readFile(p.final),p.bytes);assert.equal((await lstat(p.final)).nlink,1);assert.equal((await readFile(saved)).toString(),'saved fixed/history');
});
test('recovered pair can deduplicate the exact interrupted insertion',async t=>{
 const f=await fixture(t),p=await pair(f,1);const ref=await put(f,p.bytes.toString());assert.equal(ref.sha256,sha(p.bytes));assert.equal((await lstat(p.final)).nlink,1);assert.equal((await readdir(f.assets)).length,1);assert.deepEqual(await readdir(f.staging),[]);
});
test('every pair is validated before deleting any unpublished name',async t=>{
 const f=await fixture(t),a=await pair(f,1,'valid'),b=await pair(f,2,'invalid','a'.repeat(64));
 await assert.rejects(put(f));assert.deepEqual(await readFile(a.stage),a.bytes);assert.deepEqual(await readFile(b.stage),b.bytes);assert.equal((await lstat(a.final)).nlink,2);
});
test('unbound linked final blocks cleanup of an otherwise valid pair',async t=>{
 const f=await fixture(t),p=await pair(f,1);const other=join(f.assets,sha(Buffer.from('other'))+'.blob');await writeFile(other,'other');await link(other,join(f.directory,'outside-final'));
 await assert.rejects(put(f));assert.deepEqual(await readFile(p.stage),p.bytes);assert.equal((await lstat(p.final)).nlink,2);
});
test('same bytes on different two-link inodes cannot authorize recovery',async t=>{
 const f=await fixture(t),bytes=Buffer.from('same bytes'),stage=join(f.staging,'pending-00000000-0000-0000-0000-000000000001.tmp'),final=join(f.assets,sha(bytes)+'.blob');
 await writeFile(stage,bytes);await link(stage,join(f.directory,'stage-extra'));await writeFile(final,bytes);await link(final,join(f.directory,'final-extra'));
 await assert.rejects(put(f));assert.deepEqual(await readFile(stage),bytes);assert.equal((await lstat(final)).nlink,2);
});
test('three-link inode is refused without removing any name',async t=>{
 const f=await fixture(t),p=await pair(f,1);await link(p.stage,join(f.directory,'third-name'));await assert.rejects(put(f));assert.equal((await lstat(p.final)).nlink,3);assert.deepEqual(await readFile(p.stage),p.bytes);
});
test('untrusted writer cannot repair even a matching complete pair',async t=>{
 const f=await fixture(t,false),p=await pair(f,1);await assert.rejects(put(f));assert.deepEqual(await readFile(p.stage),p.bytes);assert.equal((await lstat(p.final)).nlink,2);
});
test('revoked writer never repairs or returns a linked asset',async t=>{
 const f=await fixture(t),p=await pair(f,1);await assert.rejects(put(f,'fresh',()=>false),{code:'ACCESS_REFUSED'});assert.equal((await lstat(p.final)).nlink,2);assert.deepEqual(await readFile(p.stage),p.bytes);
});
