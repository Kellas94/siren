import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {PrimaryPersistence} from '../src/windows/primary.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';

test('readonly navigation attests the exact selected envelope without creating a recovery point or content revision',async()=>{
 const f=await sourceReadFixture(),recovery=new RecoveryStore(f.root,{sources:f.sources});
 const primary=new PrimaryPersistence({projects:()=>f.projects,recovery});
 const before=await recovery.scan();
 const receipt=await primary.sealReadonly({projectId:f.selected.project.id,readonly:true,checkpoint:false,isCurrent:()=>true});
 assert.equal(receipt.ok,true);assert.deepEqual(await recovery.scan(),before);
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 const verified=await primary.verify(receipt,{projectId:f.selected.project.id,purpose:'readonly',isCurrent:()=>true});
 assert.equal(verified.ok,true);assert.equal(verified.durability,'readonly');assert.deepEqual(await recovery.scan(),before);
});
test('a selected navigation seal cannot verify a changed envelope or a locked scope',async()=>{
 const f=await sourceReadFixture(),recovery=new RecoveryStore(f.root,{sources:f.sources});
 const primary=new PrimaryPersistence({projects:()=>f.projects,recovery});
 const receipt=await primary.sealReadonly({projectId:f.selected.project.id,readonly:true,checkpoint:false,isCurrent:()=>true});
 assert.equal((await primary.verify(receipt,{projectId:f.selected.project.id,purpose:'readonly',isCurrent:()=>false})).code,'ACCESS_REFUSED');
 const {writeFile}=await import('node:fs/promises'),{join}=await import('node:path');
 await writeFile(join(f.root,'Projects',f.selected.project.id,'current.json'),'owned torn selected pointer');
 assert.equal((await primary.verify(receipt,{projectId:f.selected.project.id,purpose:'readonly',isCurrent:()=>true})).ok,false);
 assert.equal((await recovery.scan()).valid.length,0);
});
test('an unchanged acknowledged primary save reuses its independently verified recovery point',async()=>{
 const f=await sourceReadFixture(),recovery=new RecoveryStore(f.root);
 const original=await f.projects.createProject({label:'Exact navigation save',json:'{}'});
 const primary=new PrimaryPersistence({projects:()=>f.projects,recovery}),scope={projectId:original.project.id,isCurrent:()=>true};
 const first=await primary.save({projectId:original.project.id,baseRevision:1,json:'{"saved":"exact"}',purpose:'workspace'},scope);assert.equal(first.ok,true);
 const before=await recovery.scan(),selected=await f.projects.readProject(original.project.id);
 const second=await primary.save({projectId:original.project.id,baseRevision:2,json:selected.json,purpose:'workspace'},scope);
 assert.deepEqual(second,first);assert.deepEqual(await recovery.scan(),before);assert.deepEqual(await f.projects.readProject(original.project.id),selected);
});
