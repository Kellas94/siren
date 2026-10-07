import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectCatalog } from '../src/navigation/catalog.mjs';

async function fixture(){const root=await mkdtemp(join(tmpdir(),'siren-home-catalog-'));await mkdir(join(root,'Projects'));return {root,catalog:new ProjectCatalog(root)};}
const record=(count)=>({schema:1,entries:Array.from({length:count},(_,i)=>({projectId:`project-${i}`,label:`Project ${i}`,location:{schema:1,projectId:`project-${i}`,surface:'code',entityId:'source-a'},visitedAt:`2026-10-03T07:${String(59-i).padStart(2,'0')}:00.000Z`}))});
async function project(root,id,bytes='not valid JSON'){await mkdir(join(root,'Projects',id));await writeFile(join(root,'Projects',id,'current.json'),bytes);}

test('home_never_reads_content_to_list_recents even a huge invalid pointer stays metadata only',async()=>{
  const {root,catalog}=await fixture();const planted='PLANTED_PRIVATE_SOURCE_AND_PIN';
  const bytes=Buffer.from(planted.repeat(20000));for(let i=0;i<15;i++)await project(root,`project-${i}`,bytes);
  const before=await readFile(join(root,'Projects','project-0','current.json'));
  const summaries=await catalog.list(record(15));assert.equal(summaries.length,12);assert.equal(summaries[0].availability,'cached');assert.equal(summaries[0].lastVisited,'2026-10-03T07:59:00.000Z');
  assert.equal(JSON.stringify(summaries).includes(planted),false);assert.deepEqual(await readFile(join(root,'Projects','project-0','current.json')),before);
  assert.deepEqual(Object.keys(summaries[0]),['projectId','label','availability','lastVisited']);
});
test('missing recent entries retain labels and timestamps with honest unavailable status',async()=>{
  const {catalog}=await fixture();const summaries=await catalog.list(record(2));
  assert.deepEqual(summaries.map(x=>x.availability),['missing','missing']);assert.equal(summaries[0].label,'Project 0');
});
test('cold owned projects have generic labels and no invented last-visited date',async()=>{
  const {root,catalog}=await fixture();await project(root,'cold-a','{"label":"Private unverified name"}');await project(root,'cold-b');
  const summaries=await catalog.list({schema:1,entries:[]});assert.equal(summaries.length,2);
  assert.ok(summaries.every(x=>x.label==='Local project'&&x.availability==='cached'&&!Object.hasOwn(x,'lastVisited')));
  assert.equal(JSON.stringify(summaries).includes('Private unverified name'),false);
});
test('recent summaries precede cold discovery without duplicate IDs or non-project files',async()=>{
  const {root,catalog}=await fixture();await project(root,'project-0');await project(root,'cold-a');await writeFile(join(root,'Projects','not-a-project'),'ignored');
  const summaries=await catalog.list(record(1));assert.equal(summaries[0].projectId,'project-0');assert.equal(summaries.length,2);assert.equal(new Set(summaries.map(x=>x.projectId)).size,2);
});
test('catalog strictly validates navigation input instead of projecting injected content',async()=>{
  const {catalog}=await fixture();const invalid=record(1);invalid.entries[0].text='secret';
  await assert.rejects(catalog.list(invalid),{code:'INVALID_NAVIGATION'});
  const getter=record(1);Object.defineProperty(getter.entries[0],'label',{get(){throw Error('executed getter');}});
  await assert.rejects(catalog.list(getter),{code:'INVALID_NAVIGATION'});
});
test('empty data root has no fabricated project or disk writes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'siren-empty-home-'));const catalog=new ProjectCatalog(root);
  assert.deepEqual(await catalog.list({schema:1,entries:[]}),[]);
  const {readdir}=await import('node:fs/promises');assert.deepEqual(await readdir(root),[]);
});
test('incomplete or corrupt source-import markers cannot advertise a usable project',async()=>{
 const {root,catalog}=await fixture();
 for(const [id,status] of [['incomplete',{schema:1,projectId:'incomplete',state:'incomplete'}],['corrupt',{state:'complete'}]]){
  await project(root,id);await writeFile(join(root,'Projects',id,'source-import-status.json'),JSON.stringify(status));
 }
 assert.deepEqual(await catalog.list({schema:1,entries:[]}),[]);
});
