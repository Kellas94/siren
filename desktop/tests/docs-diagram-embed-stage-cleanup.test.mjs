// Actual filesystem and production writer; process observations are fixture data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,link,open,rm} from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {runInNewContext} from 'node:vm';
import {randomUUID,createHash} from 'node:crypto';
import {DiagramEmbedAssetStore} from '../src/documents/diagram-embed-assets.mjs';
import {DIAGRAM_EMBED_ASSET_BYTES,normalizeDiagramEmbedAssetRef} from '../src/documents/diagram-embeds.mjs';
const owner={pid:222,path:'C:\\SIREN\\electron.exe',startedAt:'2026-10-11T10:00:00.000Z'};
const prior={...owner,pid:111,startedAt:'2026-10-10T10:00:00.000Z'};
async function fixture(t,options={}){
 const trusted=options.trusted!==false,observed=Object.hasOwn(options,'observed')?options.observed:null;
 const root=await mkdtemp(join(tmpdir(),'siren-embed-cleanup-'));
 t.after(async()=>{assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.match(basename(root),/^siren-embed-cleanup-/);await rm(root,{recursive:true,force:true});});
 const directory=join(root,'project-a');await mkdir(directory);const stage=join(directory,'diagram-embed-staging');await mkdir(stage);
 const projects={directory:async id=>{assert.equal(id,'project-a');return directory;}};
 if(trusted)projects.writerOptions={ownerIdentity:owner,inspectProcess:async()=>observed};
 const store=new DiagramEmbedAssetStore({projects});
 return {directory,stage,lock:join(directory,'writer.lock'),store,stagePath:n=>join(stage,'pending-00000000-0000-0000-0000-'+String(n).padStart(12,'0')+'.tmp')};
}
const put=(f,bytes='fresh asset',isCurrent=()=>true)=>f.store.put({projectId:'project-a',kind:'svg',bytes:Buffer.from(bytes),isCurrent});
test('trusted recovered writer removes zero/partial stages, preserving saved metadata and immutable assets',async t=>{
 const f=await fixture(t);const ref=await put(f,'saved immutable capture');const saved=join(f.directory,'manifest.json');await writeFile(saved,'saved fixed/history metadata');
 await writeFile(f.stagePath(1),'');await writeFile(f.stagePath(2),'unfinished');await writeFile(f.lock,JSON.stringify(prior));
 let sawOwnedCleanup=false;await put(f,'new capture',()=>{if(existsSync(f.lock)&&existsSync(f.stagePath(1))){const identity=JSON.parse(readFileSync(f.lock,'utf8'));if(identity.pid===owner.pid){assert.deepEqual(identity,owner);sawOwnedCleanup=true;}}return true;});
 assert.equal(sawOwnedCleanup,true);assert.deepEqual(await readdir(f.stage),[]);assert.equal((await readFile(saved)).toString(),'saved fixed/history metadata');
 assert.equal((await f.store.read({projectId:'project-a',ref,isCurrent:()=>true})).toString(),'saved immutable capture');
});
test('deduplicated insertion also retires abandoned staging',async t=>{
 const f=await fixture(t),ref=await put(f);await writeFile(f.stagePath(1),'old partial');assert.deepEqual(await put(f),ref);assert.deepEqual(await readdir(f.stage),[]);
});
test('abandoned staging budget is recovered before admitting fresh bytes',async t=>{
 const f=await fixture(t);for(let i=0;i<64;i++){const h=await open(f.stagePath(i),'wx');try{await h.truncate(2097152);}finally{await h.close();}}
 const ref=await put(f);assert.ok(ref.bytes>0);assert.deepEqual(await readdir(f.stage),[]);
});
for(const [label,observed,lock]of [['live',prior,prior],['unknown',undefined,prior],['legacy',null,{pid:111}]])test(label+' lock refuses cleanup and preserves every byte',async t=>{
 const f=await fixture(t,{observed});await writeFile(f.lock,JSON.stringify(lock));await writeFile(f.stagePath(1),'do not touch');
 await assert.rejects(put(f),{code:'WRITER_BUSY'});assert.equal((await readFile(f.stagePath(1))).toString(),'do not touch');assert.deepEqual(JSON.parse(await readFile(f.lock)),lock);
});
test('fixture without trusted owner identity retains and counts unpublished stages',async t=>{
 const f=await fixture(t,{trusted:false});await writeFile(f.stagePath(1),'unproven owner');await put(f);assert.equal((await readFile(f.stagePath(1))).toString(),'unproven owner');
});
test('entire staging inventory is validated before any cleanup',async t=>{
 const f=await fixture(t);await writeFile(f.stagePath(1),'safe-looking');await writeFile(join(f.stage,'unknown.txt'),'unknown');
 await assert.rejects(put(f),{code:'DIAGRAM_EMBED_ASSET_CORRUPT'});assert.equal((await readFile(f.stagePath(1))).toString(),'safe-looking');assert.equal((await readFile(join(f.stage,'unknown.txt'))).toString(),'unknown');
});
test('multiple-link crash boundary is refused without deleting either name',async t=>{
 const f=await fixture(t);await writeFile(f.stagePath(1),'linked bytes');const external=join(f.directory,'other-name');await link(f.stagePath(1),external);
 await assert.rejects(put(f),{code:'DIAGRAM_EMBED_ASSET_CORRUPT'});assert.equal((await readFile(f.stagePath(1))).toString(),'linked bytes');assert.equal((await readFile(external)).toString(),'linked bytes');
});
test('revocation before cleanup preserves abandoned files and publishes nothing',async t=>{
 const f=await fixture(t);await writeFile(f.stagePath(1),'retained');await assert.rejects(put(f,'new',()=>!existsSync(f.lock)),{code:'ACCESS_REFUSED'});
 assert.equal((await readFile(f.stagePath(1))).toString(),'retained');assert.deepEqual(await readdir(join(f.directory,'diagram-embed-assets')),[]);
});
test('revocation during cleanup stops further deletion and admits no new asset',async t=>{
 const f=await fixture(t);await writeFile(f.stagePath(1),'one');await writeFile(f.stagePath(2),'two');
 await assert.rejects(put(f,'new',()=>existsSync(f.stagePath(1))&&existsSync(f.stagePath(2))),{code:'ACCESS_REFUSED'});
 assert.equal((await readdir(f.stage)).length,1);assert.deepEqual(await readdir(join(f.directory,'diagram-embed-assets')),[]);
});
const production=await readFile(new URL('../src/documents/diagram-embed-assets.mjs',import.meta.url),'utf8');
for(const change of ['inode','size','hardlink','symlink'])test(change+' substitution after inventory refuses unlink (inert IO model)',async()=>{
 const name='pending-00000000-0000-0000-0000-000000000001.tmp';let observations=0,deleted=false;
 const context={Buffer,join,randomUUID,DIAGRAM_EMBED_ASSET_BYTES,normalizeDiagramEmbedAssetRef,validId:()=>true,digest:b=>createHash('sha256').update(b).digest('hex'),ownedDirectory:async p=>p,childDirectory:async(p,n)=>join(p,n),exclusiveWriter:async(_p,body)=>body(),
 opendir:async dir=>({async *[Symbol.asyncIterator](){if(dir.endsWith('diagram-embed-staging'))yield{name,isFile:()=>true,isSymbolicLink:()=>false};}}),
 lstat:async()=>{const altered=++observations>1;return {dev:1,ino:altered&&change==='inode'?2:1,size:altered&&change==='size'?2:1,nlink:altered&&change==='hardlink'?2:1,mtimeMs:1,ctimeMs:1,isFile:()=>true,isSymbolicLink:()=>altered&&change==='symlink'};},
 unlink:async()=>{deleted=true;},open:async()=>{throw Error('New publication must not start');}};
 runInNewContext(production.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')+'\nglobalThis.Store=DiagramEmbedAssetStore;',context);
 const store=new context.Store({projects:{directory:async()=> 'owned-project',writerOptions:{ownerIdentity:owner,inspectProcess:async()=>null}}});
 await assert.rejects(store.put({projectId:'project-a',kind:'svg',bytes:Buffer.from('new'),isCurrent:()=>true}),{code:'PENDING_CLEANUP_FAILED'});assert.equal(deleted,false);
});
