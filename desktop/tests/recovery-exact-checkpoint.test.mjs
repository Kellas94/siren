import test from 'node:test';
import assert from 'node:assert/strict';
import {rm,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'siren-exact-checkpoint-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const projects=new ProjectStore(root),sources=new SourceRepository(root),initial=await projects.createProject({label:'Exact recovery',json:'{}'});
 const ref=await sources.importSource({projectId:initial.project.id,bytes:Buffer.from('def exact():\n return "😀"\n')});
 const request={projects,repository:sources,projectId:initial.project.id,baseRevision:1,sourceRefs:[ref],metadata:{name:'original'},operationId:'exact-original'};
 assert.equal((await commitManifest(request)).ok,true);const snapshot=await projects.readProject(initial.project.id),recovery=new RecoveryStore(root,{sources});
 return {root,projects,sources,snapshot,recovery,ref};
}
test('exact durability verifies the saved candidate and its source bytes, without rebuilding unrelated recovery histories',async t=>{
 const f=await fixture(t);assert.equal(typeof f.recovery.hasSavedSnapshot,'function');
 for(let i=0;i<4;i++)await f.recovery.checkpointProject({snapshot:f.snapshot,kind:i===3?'saved':'emergency'});
 const before=await f.projects.readProject(f.snapshot.project.id);let metrics=0,exports=0;
 const sources={getMetrics:async request=>{metrics++;return f.sources.getMetrics(request);},exportSource:async request=>{exports++;return f.sources.exportSource(request);}};
 const actual=new RecoveryStore(f.root,{sources});actual.scan=()=>{throw Error('Whole history must not be replayed for a single exact receipt');};
 assert.equal(await actual.hasSavedSnapshot(f.snapshot),true);assert.equal(metrics,1);assert.equal(exports,1);assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),before);
 const blob=join(await f.sources.sourceDirectory(f.snapshot.project.id,f.ref.sourceId),'blobs',f.ref.sha256+'.bin');await writeFile(blob,'damaged referenced source');
 assert.equal(await actual.hasSavedSnapshot(f.snapshot),false);
});
test('missing, emergency-only, damaged and replaced checkpoint records never establish saved durability or trust catalog labels',async t=>{
 const f=await fixture(t);assert.equal(typeof f.recovery.hasSavedSnapshot,'function');assert.equal(await f.recovery.hasSavedSnapshot(f.snapshot),false);
 await f.recovery.checkpointProject({snapshot:f.snapshot,kind:'emergency'});assert.equal(await f.recovery.hasSavedSnapshot(f.snapshot),false);
 const point=await f.recovery.checkpointProject({snapshot:f.snapshot,kind:'saved'}),path=join(f.root,'Recovery',f.snapshot.project.id,point.id+'.json'),original=await readFile(path);
 await writeFile(path,'{damaged exact checkpoint');assert.equal(await f.recovery.hasSavedSnapshot(f.snapshot),false);assert.equal(await readFile(path,'utf8'),'{damaged exact checkpoint');
 await writeFile(path,original);const read=f.recovery.readProjectPoint.bind(f.recovery);f.recovery.readProjectPoint=async(...args)=>({...await read(...args),kind:'emergency'});
 assert.equal(await f.recovery.hasSavedSnapshot(f.snapshot),false);assert.deepEqual(await f.projects.readProject(f.snapshot.project.id),f.snapshot);
});
