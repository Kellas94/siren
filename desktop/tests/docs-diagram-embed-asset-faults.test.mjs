// Actual production class in an inert filesystem state model, only for deterministic IO faults.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {join,dirname,basename} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DIAGRAM_EMBED_ASSET_BYTES,normalizeDiagramEmbedAssetRef} from '../src/documents/diagram-embeds.mjs';
const code=await readFile(new URL('../src/documents/diagram-embed-assets.mjs',import.meta.url),'utf8');
function fixture(fault){
 const files=new Map();let nextId=0,failed=false,revoked=false;
 const ioError=code=>Object.assign(Error(code),{code}),get=p=>{const entry=files.get(p);if(!entry)throw ioError('ENOENT');return entry;};
 const stats=p=>{const e=get(p);return {dev:1,ino:e.id,nlink:e.links,size:e.bytes.length,isFile:()=>true,isSymbolicLink:()=>false};};
 const context={Buffer,join,randomUUID,DIAGRAM_EMBED_ASSET_BYTES,normalizeDiagramEmbedAssetRef,validId:()=>true,digest:b=>createHash('sha256').update(b).digest('hex'),ownedDirectory:async p=>p,childDirectory:async(p,n)=>join(p,n),ownedFile:async p=>{get(p);return p;},exclusiveWriter:async(_p,fn)=>fn(),lstat:async p=>stats(p),readOwnedBytes:async p=>Buffer.from(get(p).bytes),
 opendir:async dir=>({async *[Symbol.asyncIterator](){for(const p of files.keys())if(dirname(p)===dir)yield{name:basename(p),isFile:()=>true,isSymbolicLink:()=>false};}}),
 open:async p=>{if(files.has(p))throw ioError('EEXIST');const e={id:++nextId,links:1,bytes:Buffer.alloc(0)};files.set(p,e);return {stat:async()=>stats(p),writeFile:async b=>{e.bytes=Buffer.from(b);if(fault==='write'&&!failed){failed=true;e.bytes=e.bytes.subarray(0,2);throw ioError('EIO');}},sync:async()=>{if(fault==='sync'&&!failed){failed=true;throw ioError('EIO');}},close:async()=>{}};},
 link:async(a,b)=>{if(files.has(b))throw ioError('EEXIST');const e=get(a);files.set(b,e);e.links++;if(fault==='after-link')revoked=true;},
 unlink:async p=>{const e=get(p);files.delete(p);e.links--;}
 };
 runInNewContext(code.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')+'\nglobalThis.Store=DiagramEmbedAssetStore;',context);
 return {store:new context.Store({projects:{directory:async()=> 'owned-project'}}),files,current:()=>!revoked};
}
for(const fault of ['write','sync'])test(fault+' failure leaves no final asset and permits unrelated insertion',async()=>{
 const f=fixture(fault);await assert.rejects(f.store.put({projectId:'project-a',kind:'svg',bytes:Buffer.from('first bytes'),isCurrent:f.current}),{code:'EIO'});
 assert.deepEqual([...f.files.keys()].filter(p=>p.endsWith('.blob')),[],'Incomplete bytes must never occupy the final namespace');
 const ref=await f.store.put({projectId:'project-a',kind:'svg',bytes:Buffer.from('later bytes'),isCurrent:f.current});assert.equal((await f.store.read({projectId:'project-a',ref:{...ref},isCurrent:f.current})).toString(),'later bytes');
});
test('revocation during final publication returns no grant and leaves only a complete single-link orphan',async()=>{
 const f=fixture('after-link');await assert.rejects(f.store.put({projectId:'project-a',kind:'svg',bytes:Buffer.from('complete bytes'),isCurrent:f.current}),{code:'ACCESS_REFUSED'});
 const finals=[...f.files.entries()].filter(([p])=>p.endsWith('.blob'));assert.equal(finals.length,1);assert.equal(finals[0][1].bytes.toString(),'complete bytes');assert.equal(finals[0][1].links,1);assert.equal([...f.files.keys()].some(p=>p.endsWith('.tmp')),false);
 const ref=await f.store.put({projectId:'project-a',kind:'svg',bytes:Buffer.from('complete bytes'),isCurrent:()=>true});assert.equal(ref.sha256,basename(finals[0][0]).slice(0,-5));
});
