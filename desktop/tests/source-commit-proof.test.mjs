import test from 'node:test';
import assert from 'node:assert/strict';
import {rm, readFile, writeFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';

async function fixture(t, options={}) {
  const root=await mkdtemp(join(tmpdir(),'siren-commit-proof-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const projects=new ProjectStore(root), snapshot=await projects.createProject({label:'Owned proof',json:'{"workpapers":[]}'});
  const projectId=snapshot.project.id, repository=new SourceRepository(root,options);
  const ref=await repository.importSource({projectId,bytes:Buffer.from('a😀\r\nb'),provenance:{agentId:'agent-a'}});
  const request={projectId,sourceId:ref.sourceId,operationId:'save-one',expectedVersion:ref.version,sha256:ref.sha256};
  return {root,projects,snapshot,repository,projectId,ref,request};
}

test('draft with a materialized blob is not a native commit; proof never writes or updates Docs',async t=>{
  const f=await fixture(t), dir=await f.repository.sourceDirectory(f.projectId,f.ref.sourceId);
  const before=await f.projects.readProject(f.projectId);
  assert.equal((await f.repository.getCommitReceipt(f.request)).code,'UNKNOWN_COMMIT');
  // Blob existence alone cannot stand in for a selected commit journal.
  await writeFile(join(dir,'blobs',`${f.ref.sha256}.bin`),Buffer.from('a😀\r\nb'));
  assert.equal((await f.repository.getCommitReceipt(f.request)).code,'UNKNOWN_COMMIT');
  assert.deepEqual(await f.projects.readProject(f.projectId),before);
  assert.deepEqual(await readdir(join(dir,'commits')),[]);
});

test('fresh native proof resolves exact selected historical commits without substituting latest source',async t=>{
  const f=await fixture(t), receipt=await f.repository.commitSource(f.request);
  const newer=await f.repository.applyEdit({projectId:f.projectId,edit:{sourceId:f.ref.sourceId,expectedVersion:1,operationId:'edit-two',start:0,end:1,insertedText:'Z'}});
  await f.repository.commitSource({...f.request,expectedVersion:newer.version,operationId:'save-two'});
  const fresh=new SourceRepository(f.root);
  assert.deepEqual(await fresh.getCommitReceipt(f.request),receipt);
  for(const changed of [{expectedVersion:2},{sha256:'f'.repeat(64)},{operationId:'edit-two'}]) {
    const result=await fresh.getCommitReceipt({...f.request,...changed});
    assert.equal(result.ok,false);
    assert.equal(result.code,changed.operationId?'UNKNOWN_COMMIT':'COMMIT_RECEIPT_MISMATCH');
  }
  assert.deepEqual(await f.projects.readProject(f.projectId),f.snapshot);
});

test('recovery-degraded remains degraded in a fresh proof rather than accepting claimed durable status',async t=>{
  const f=await fixture(t,{checkpoint:async()=>{throw new Error('Owned checkpoint fault');}});
  const receipt=await f.repository.commitSource(f.request);
  assert.equal(receipt.durability,'recovery-degraded');
  assert.deepEqual(await new SourceRepository(f.root).getCommitReceipt(f.request),receipt);
});

test('corrupted committed blob or commit journal cannot yield a proof',async t=>{
  for(const target of ['blob','journal']) {
    const f=await fixture(t); await f.repository.commitSource(f.request);
    const dir=await f.repository.sourceDirectory(f.projectId,f.ref.sourceId);
    const path=target==='blob'?join(dir,'blobs',`${f.ref.sha256}.bin`):join(dir,'commits',(await readdir(join(dir,'commits')))[0]);
    const bytes=await readFile(path); bytes[0]^=1; await writeFile(path,bytes);
    assert.equal((await new SourceRepository(f.root).getCommitReceipt(f.request)).code,'CORRUPT_SOURCE');
  }
});

test('proof copies its request before awaits and rechecks native access before publication',async t=>{
  const f=await fixture(t); await f.repository.commitSource(f.request);
  let calls=0, denied=false;
  const request={...f.request}, reader=new SourceRepository(f.root,{canWrite:async()=>{
    calls++; request.sha256='f'.repeat(64); return !denied;
  }});
  assert.equal((await reader.getCommitReceipt(request)).ok,true);
  assert.ok(calls>=2);
  calls=0;
  reader.canWrite=async()=>{calls++;if(calls===2)denied=true;return !denied;};
  assert.equal((await reader.getCommitReceipt(f.request)).code,'ACCESS_REFUSED');
});
