import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile } from 'node:fs/promises';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { NavigationStore } from '../src/navigation/store.mjs';
import { ProjectCatalog } from '../src/navigation/catalog.mjs';
import { HomeService } from '../src/navigation/service.mjs';
import { invokeHome } from '../src/navigation/ipc.mjs';
import { HomeAuthority } from '../src/navigation/authority.mjs';

async function fixture(onDiagnostic){
  const root=await mkdtemp(join(tmpdir(),'siren-home-service-'));let current=true;
  const projects=new ProjectStore(root),navigation=new NavigationStore(root,{canWrite:()=>current}),catalog=new ProjectCatalog(root);
  const snapshot=await projects.createProject({label:'Owned project',json:'{"docs":"PLANTED_PRIVATE_CONTENT","diagrams":[]}'});
  const state={projectId:snapshot.project.id,mode:'normal',readonly:false,views:[],capabilities:{diagrams:false,docs:false,code:false,present:false}};
  const scope={projectId:state.projectId,mode:state.mode,isCurrent:()=>current};
  const resolveEntity=async({location})=>location.entityId==='source-a'?{ok:true,location}:{ok:false,code:'ENTITY_UNAVAILABLE'};
  const service=new HomeService({navigation,catalog,projects,resolveEntity,selection:{state:()=>state},clock:()=> '2026-10-03T08:00:00.000Z',onDiagnostic});
  return {root,projects,navigation,catalog,snapshot,state,scope,service,setCurrent:value=>{current=value;}};
}
test('Home state lists only cached metadata without reading project or source contents',async()=>{
  const f=await fixture();await f.navigation.record({projectId:f.snapshot.project.id,label:f.snapshot.project.label,location:{surface:'code',entityId:'source-a'},visitedAt:'2026-10-03T07:00:00.000Z'});
  f.projects.readProject=async()=>{throw Error('Unwanted content load');};
  const state=await f.service.getHomeState({},f.scope);assert.equal(state.projects.length,1);assert.equal(state.continuation.availability,'cached');assert.equal(state.continuation.location.entityId,'source-a');assert.equal(JSON.stringify(state).includes('PLANTED_PRIVATE_CONTENT'),false);
});
test('Home state permits empty selection and retains cached Continue without granting source access',async()=>{
  const f=await fixture();await f.navigation.record({projectId:f.snapshot.project.id,label:'Previous work',location:{surface:'code',entityId:'source-a'},visitedAt:'2026-10-03T07:00:00.000Z'});
  f.state.projectId=null;f.scope.projectId=null;
  const state=await f.service.getHomeState({},f.scope);assert.equal(state.selectedProjectId,null);assert.equal(state.continuation.location.projectId,f.snapshot.project.id);
  const frame={url:'siren://app/home.html'},sender={isDestroyed:()=>false,mainFrame:frame,getURL:()=>frame.url};
  const authority=new HomeAuthority({workspace:{isDestroyed:()=>false,webContents:sender},state:()=>({unlocked:true,projectId:null,mode:'normal',generation:1})});
  const result=await invokeHome({event:{sender,senderFrame:frame},method:'getHomeState',payload:{},authority,services:{getHomeState:f.service.getHomeState.bind(f.service)}});
  assert.equal(result.ok,true);assert.equal(result.state.continuation.availability,'cached');
});
test('recording resolved location uses verified native label timestamp and preserves snapshot',async()=>{
  const f=await fixture();const result=await f.service.recordLocation({surface:'code',entityId:'source-a'},f.scope);assert.deepEqual(result,{ok:true});
  const entry=(await f.navigation.read()).entries[0];assert.equal(entry.label,'Owned project');assert.equal(entry.visitedAt,'2026-10-03T08:00:00.000Z');assert.equal(entry.projectId,f.snapshot.project.id);assert.deepEqual(await f.projects.readProject(entry.projectId),f.snapshot);
});
test('unknown entity readonly state and stale source reference cannot overwrite prior navigation',async()=>{
  const f=await fixture();await f.service.recordLocation({surface:'code',entityId:'source-a'},f.scope);const path=join(f.root,'UI','navigation.json'),before=await readFile(path);
  const unknown=await f.service.recordLocation({surface:'code',entityId:'missing'},f.scope);assert.equal(unknown.code,'ENTITY_UNAVAILABLE');assert.deepEqual(await readFile(path),before);
  f.state.readonly=true;assert.equal((await f.service.recordLocation({surface:'code',entityId:'source-a'},f.scope)).code,'ACCESS_REFUSED');assert.deepEqual(await readFile(path),before);
  f.state.readonly=false;const bad=new HomeService({navigation:f.navigation,catalog:f.catalog,projects:f.projects,selection:{state:()=>f.state},resolveEntity:async({location})=>({ok:true,location:{...location,sourceRef:{...location.sourceRef,version:8}}})});
  const changed=await bad.recordLocation({surface:'code',entityId:'source-a',sourceRef:{sourceId:'source-a',version:7,sha256:'a'.repeat(64)}},f.scope);assert.equal(changed.code,'SOURCE_VERSION_UNAVAILABLE');assert.deepEqual(await readFile(path),before);
});
test('Lock during catalog or domain resolution suppresses metadata and persistence',async()=>{
  const f=await fixture();const catalog={list:async()=>{f.setCurrent(false);return [];}};
  const service=new HomeService({navigation:f.navigation,catalog,projects:f.projects,selection:{state:()=>f.state},resolveEntity:async()=>({ok:false})});
  await assert.rejects(service.getHomeState({},f.scope),{code:'ACCESS_REFUSED'});
  f.setCurrent(true);const before=await f.navigation.read();const stale=new HomeService({navigation:f.navigation,catalog:f.catalog,projects:f.projects,selection:{state:()=>f.state},resolveEntity:async({location})=>{f.setCurrent(false);return {ok:true,location};}});
  assert.equal((await stale.recordLocation({surface:'code',entityId:'source-a'},f.scope)).code,'ACCESS_REFUSED');assert.deepEqual(await f.navigation.read(),before);
});

test('project change inside atomic navigation replacement cannot publish stale metadata',async()=>{
  const f=await fixture();await f.service.recordLocation({surface:'code',entityId:'source-a'},f.scope);
  const path=join(f.root,'UI','navigation.json'),before=await readFile(path);
  // App remains unlocked/writable; the old captured project scope is stale.
  f.navigation.fault=async phase=>{if(phase==='before-rename')f.state.projectId='other-project';};
  const result=await f.service.recordLocation({surface:'code',entityId:'source-a',cursor:{anchor:4,head:4}},f.scope);
  assert.equal(result.code,'ACCESS_REFUSED');assert.deepEqual(await readFile(path),before);
});

test('caller mutation during domain resolution cannot alter the recorded source version or cursor',async()=>{
  const f=await fixture();let unblock,entered;
  const waiting=new Promise(resolve=>{entered=resolve;});
  f.service.resolveEntity=async({location})=>{entered();await new Promise(resolve=>{unblock=resolve;});return {ok:true,location};};
  const input={surface:'code',entityId:'source-a',sourceRef:{sourceId:'source-a',version:7,sha256:'a'.repeat(64)},cursor:{anchor:2,head:2}};
  const operation=f.service.recordLocation(input,f.scope);await waiting;input.sourceRef.version=8;input.cursor.head=99;unblock();
  assert.deepEqual(await operation,{ok:true});const stored=(await f.navigation.read()).entries[0].location;
  assert.equal(stored.sourceRef.version,7);assert.deepEqual(stored.cursor,{anchor:2,head:2});
});

test('resolver cannot silently substitute an immutable version by mutating its request',async()=>{
  const f=await fixture();await f.service.recordLocation({surface:'code',entityId:'source-a'},f.scope);
  const before=await f.navigation.read();
  f.service.resolveEntity=async({location})=>{location.sourceRef.version=8;return {ok:true,location};};
  const result=await f.service.recordLocation({surface:'code',entityId:'source-a',sourceRef:{sourceId:'source-a',version:7,sha256:'a'.repeat(64)}},f.scope);
  assert.equal(result.code,'SOURCE_VERSION_UNAVAILABLE');assert.deepEqual(await f.navigation.read(),before);
});

test('Continue diagnostics follow genuine durable navigation stages without private metadata',async()=>{
  const events=[],f=await fixture(event=>events.push(event));
  assert.deepEqual(await f.service.recordLocation({surface:'code',entityId:'source-a'},f.scope),{ok:true});
  assert.deepEqual(events.map(event=>event.stage),['started','admitted','project-read-start','project-read','resolve-start','resolved','persist-start','verified']);
  for(const event of events){
    assert.deepEqual(Object.keys(event).sort(),['elapsedMs','operation','stage']);
    assert.equal(event.operation,1);assert.ok(Number.isSafeInteger(event.elapsedMs)&&event.elapsedMs>=0);
  }
  assert.equal((await f.navigation.read()).entries[0].location.entityId,'source-a');
  for(const privateValue of ['Owned project','PLANTED_PRIVATE_CONTENT',f.snapshot.project.id,'source-a'])assert.equal(JSON.stringify(events).includes(privateValue),false);
  await f.service.recordLocation({surface:'code',entityId:'source-a'},f.scope);
  assert.equal(events.at(-1).operation,2);
});

test('Continue diagnostics expose the held read boundary and refuse Lock before persistence',async()=>{
  const events=[],f=await fixture(event=>events.push(event));const before=await f.navigation.read();
  const original=f.projects.readProject.bind(f.projects);let entered,release;
  const ready=new Promise(resolve=>{entered=resolve;});
  f.projects.readProject=async id=>{entered();await new Promise(resolve=>{release=resolve;});return original(id);};
  const operation=f.service.recordLocation({surface:'code',entityId:'source-a'},f.scope);await ready;
  assert.deepEqual(events.map(event=>event.stage),['started','admitted','project-read-start']);
  f.setCurrent(false);release();assert.equal((await operation).code,'ACCESS_REFUSED');
  assert.equal(events.at(-1).stage,'refused');assert.equal(events.at(-1).code,'ACCESS_REFUSED');
  assert.equal(events.some(event=>event.stage==='persist-start'),false);assert.deepEqual(await f.navigation.read(),before);
});

test('Continue diagnostics retain refusals and sanitize unexpected storage errors',async()=>{
  const events=[],f=await fixture(event=>events.push(event));const before=await f.navigation.read();
  f.state.readonly=true;assert.equal((await f.service.recordLocation({surface:'code',entityId:'source-a'},f.scope)).code,'ACCESS_REFUSED');
  assert.deepEqual(events.map(event=>event.stage),['started','refused']);
  f.state.readonly=false;events.length=0;
  f.navigation.record=async()=>({ok:false,code:'PRIVATE_STORAGE_PATH_AND_SECRET'});
  const receipt=await f.service.recordLocation({surface:'code',entityId:'source-a'},f.scope);
  assert.equal(receipt.code,'PRIVATE_STORAGE_PATH_AND_SECRET');
  assert.equal(events.at(-1).code,'NAVIGATION_WRITE_FAILED');assert.equal(events.at(-1).stage,'refused');
  assert.equal(JSON.stringify(events).includes('PRIVATE_STORAGE_PATH_AND_SECRET'),false);
  assert.equal(events.some(event=>event.stage==='verified'),false);assert.deepEqual(await f.navigation.read(),before);
});

test('a failed diagnostic sink cannot change a real navigation receipt or persistence',async()=>{
  let calls=0;const f=await fixture(()=>{calls++;throw Error('diagnostic sink unavailable');});
  assert.deepEqual(await f.service.recordLocation({surface:'code',entityId:'source-a'},f.scope),{ok:true});
  assert.equal(calls,8);assert.equal((await f.navigation.read()).entries[0].location.entityId,'source-a');
});
