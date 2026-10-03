import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { SourceRepository } from '../src/sources/repository.mjs';
import { WindowRegistry } from '../src/windows/registry.mjs';
import { WorkspaceCoordinator } from '../src/windows/coordinator.mjs';

class NativeWindow extends EventEmitter {
  constructor(id,url){super();this.id=id;this.destroyed=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:id+1000,mainFrame:{url},getURL:()=>this.webContents.mainFrame.url,isDestroyed:()=>this.destroyed});}
  isDestroyed(){return this.destroyed;}
  isMinimized(){return false;}
  restore(){}
  focus(){}
  close(){this.destroy();}
  destroy(){this.destroyed=true;this.webContents.emit('destroyed');this.emit('closed');}
}
async function fixture(options={}) {
  const root=await mkdtemp(join(tmpdir(),'siren-owner-intents-')),projects=new ProjectStore(root),repo=new SourceRepository(root);
  const project=await projects.createProject({label:'Shared native owner',json:'{"workpapers":[{"id":"doc-a","content":"Independent linked Docs bytes"}]}'});
  const a=await repo.importSource({projectId:project.project.id,bytes:Buffer.from('a😀b\r\nc')}),b=await repo.importSource({projectId:project.project.id,bytes:Buffer.from('second source\n')});
  const windows=[];const native={projectId:project.project.id,mode:'normal',access:'write',entityIds:[a.sourceId,b.sourceId,'doc-a']};
  const registry=new WindowRegistry({authorize:()=>native,createWindow:async input=>{const window=new NativeWindow(windows.length+1,input.mainFrameUrl);windows.push(window);return window;}});
  await registry.openView({role:'code',entityId:a.sourceId});await registry.openView({role:'code',entityId:b.sourceId});
  const grants=windows.map(window=>registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame}));
  let fault=async()=>{};
  const coordinator=new WorkspaceCoordinator({registry,sources:({canWrite})=>new SourceRepository(root,{canWrite,fault:phase=>fault(phase)}),access:()=>native.mode==='normal',...options});
  return {root,projects,project,repo,a,b,windows,grants,registry,native,coordinator,setFault:value=>{fault=value;}};
}
const intent=(ref,id,text)=>({kind:'source',method:'applyEdit',payload:{sourceId:ref.sourceId,operationId:id,expectedVersion:ref.version,start:0,end:1,insertedText:text}});
const gate=()=>{let enter,release;const entered=new Promise(resolve=>{enter=resolve;}),waiting=new Promise(resolve=>{release=resolve;});let used=false;return {entered,release,fault:async()=>{if(!used){used=true;enter();await waiting;}}};};

test('different sources serialize through one owner and preserve exact independent texts and linked Docs',async()=>{
  const f=await fixture();const [first,second]=await Promise.all([f.coordinator.invoke(f.grants[0],intent(f.a,'edit-a','X')),f.coordinator.invoke(f.grants[1],intent(f.b,'edit-b','Y'))]);
  assert.equal(first.ok,true);assert.equal(second.ok,true);
  assert.deepEqual(await f.repo.exportSource({projectId:f.project.project.id,sourceId:f.a.sourceId,version:2}),Buffer.from('X😀b\r\nc'));
  assert.deepEqual(await f.repo.exportSource({projectId:f.project.project.id,sourceId:f.b.sourceId,version:2}),Buffer.from('Yecond source\n'));
  assert.deepEqual(await f.projects.readProject(f.project.project.id),f.project);
});

test('same entity stale updates and duplicate operation IDs retain native conflict semantics across fresh repositories',async()=>{
  const f=await fixture(),request=intent(f.a,'first-edit','X');const [first,stale]=await Promise.all([f.coordinator.invoke(f.grants[0],request),f.coordinator.invoke(f.grants[0],intent(f.a,'stale-edit','wrong'))]);
  assert.equal(first.ok,true);assert.equal(stale.code,'REVISION_CONFLICT');assert.deepEqual(await f.coordinator.invoke(f.grants[0],request),first);
  assert.equal((await f.coordinator.invoke(f.grants[0],intent(f.a,'first-edit','different'))).code,'OPERATION_CONFLICT');
  assert.deepEqual(await f.repo.exportSource({projectId:f.project.project.id,sourceId:f.a.sourceId,version:2}),Buffer.from('X😀b\r\nc'));
});

test('pause refuses new admission while accepted in-flight work drains with its actual receipt',async()=>{
  const f=await fixture(),g=gate();f.setFault(g.fault);const pending=f.coordinator.invoke(f.grants[0],intent(f.a,'in-flight','X'));await g.entered;
  f.coordinator.pause('home');assert.equal((await f.coordinator.invoke(f.grants[1],intent(f.b,'late-edit','Y'))).code,'WORKSPACE_PAUSED');const drained=f.coordinator.drain();g.release();const receipt=await pending;assert.equal(receipt.ok,true);assert.deepEqual(await drained,[receipt]);
  f.coordinator.resume();assert.equal((await f.coordinator.invoke(f.grants[1],intent(f.b,'after-resume','Y'))).ok,true);
});

test('a paused owner admits only bounded source flushes from the captured native frame',async()=>{
  const f=await fixture();f.coordinator.pause('lock');
  const ticket=f.coordinator.beginViewFlush(f.grants[0],{maxOperations:2,maxBytes:1024});
  assert.equal(typeof ticket,'string');
  const fresh=()=>f.registry.capture({sender:f.windows[0].webContents,senderFrame:f.windows[0].webContents.mainFrame});
  assert.equal((await f.coordinator.invoke(f.grants[1],intent(f.b,'stolen-ticket','Y'),ticket)).code,'FLUSH_REFUSED');
  assert.equal((await f.coordinator.invoke({...f.grants[0]},intent(f.a,'forged-ticket','X'),ticket)).code,'ACCESS_REFUSED');
  assert.equal((await f.coordinator.invoke(fresh(),intent(f.a,'accepted-queue','X'),ticket)).ok,true);
  const commit={kind:'source',method:'commitSource',payload:{sourceId:f.a.sourceId,expectedVersion:2,operationId:'final-flush-commit'}};
  const saved=await f.coordinator.invoke(fresh(),commit,ticket);assert.equal(saved.durability,'committed');
  assert.equal((await f.coordinator.invoke(fresh(),intent({...f.a,version:2},'excess-ticket','Z'),ticket)).code,'FLUSH_BUDGET');
  const result=await f.coordinator.finishViewFlush(fresh(),ticket);assert.equal(result.ok,true);assert.deepEqual(result.receipts.map(r=>r.operationId),['accepted-queue','final-flush-commit']);
  assert.equal((await f.coordinator.invoke(fresh(),commit,ticket)).code,'FLUSH_REFUSED');
  assert.equal((await f.coordinator.finishViewFlush(fresh(),ticket)).code,'FLUSH_REFUSED');
  assert.deepEqual(await f.repo.exportSource({projectId:f.project.project.id,sourceId:f.a.sourceId,version:2}),Buffer.from('X😀b\r\nc'));
});

test('a flush ticket is not a successful save when only a draft or a failed operation was received',async()=>{
  const f=await fixture();f.coordinator.pause('select');
  const first=f.coordinator.beginViewFlush(f.grants[0]);
  await f.coordinator.invoke(f.grants[0],intent(f.a,'draft-only','X'),first);
  assert.equal((await f.coordinator.finishViewFlush(f.grants[0],first)).code,'FLUSH_NOT_COMMITTED');
  const second=f.coordinator.beginViewFlush(f.grants[0]);
  assert.equal((await f.coordinator.invoke(f.grants[0],intent(f.a,'stale-flush','wrong'),second)).code,'REVISION_CONFLICT');
  assert.equal((await f.coordinator.finishViewFlush(f.grants[0],second)).code,'FLUSH_FAILED');
});

test('flush sealing waits for native selection and prevents additional work while it waits',async()=>{
  const f=await fixture(),g=gate();f.coordinator.pause('quit');const ticket=f.coordinator.beginViewFlush(f.grants[0]);f.setFault(g.fault);
  const commit={kind:'source',method:'commitSource',payload:{sourceId:f.a.sourceId,expectedVersion:1,operationId:'held-commit'}};
  const pending=f.coordinator.invoke(f.grants[0],commit,ticket);await g.entered;
  let done=false;const sealing=f.coordinator.finishViewFlush(f.grants[0],ticket).then(value=>{done=true;return value;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(done,false);
  assert.equal((await f.coordinator.invoke(f.grants[0],intent(f.a,'after-seal','Z'),ticket)).code,'FLUSH_REFUSED');
  g.release();assert.equal((await pending).ok,true);assert.equal((await sealing).ok,true);
});

test('flush admission rejects reads, foreign sources, byte overflow and stale pause generations',async()=>{
  const f=await fixture();f.coordinator.pause('lock');const ticket=f.coordinator.beginViewFlush(f.grants[0],{maxOperations:2,maxBytes:256});
  assert.equal((await f.coordinator.invoke(f.grants[0],{kind:'source',method:'getMetrics',payload:{sourceId:f.a.sourceId}},ticket)).code,'FLUSH_REFUSED');
  assert.equal((await f.coordinator.invoke(f.grants[0],intent(f.b,'foreign-flush','Z'),ticket)).code,'ACCESS_REFUSED');
  assert.equal((await f.coordinator.invoke(f.grants[0],intent(f.a,'overflow-flush','X'.repeat(512)),ticket)).code,'FLUSH_BUDGET');
  f.coordinator.resume();f.coordinator.pause('lock-again');
  assert.equal((await f.coordinator.invoke(f.grants[0],intent(f.a,'obsolete-flush','Z'),ticket)).code,'FLUSH_REFUSED');
  assert.equal((await f.coordinator.finishViewFlush(f.grants[0],ticket)).code,'FLUSH_REFUSED');
  assert.throws(()=>f.coordinator.beginViewFlush({...f.grants[0]}),{code:'ACCESS_REFUSED'});
});

test('resuming authority inside a flush write fences publication and cannot seal a stale success',async()=>{
  const f=await fixture(),g=gate();f.coordinator.pause('lock');const ticket=f.coordinator.beginViewFlush(f.grants[0]);f.setFault(g.fault);
  const pending=f.coordinator.invoke(f.grants[0],intent(f.a,'retired-flush-write','X'),ticket);await g.entered;
  f.coordinator.resume();f.coordinator.pause('new-lock');g.release();
  assert.equal((await pending).code,'ACCESS_REFUSED');assert.equal((await f.coordinator.finishViewFlush(f.grants[0],ticket)).code,'FLUSH_REFUSED');
  assert.equal((await f.repo.getMetrics({projectId:f.project.project.id,sourceId:f.a.sourceId})).version,1);
  assert.deepEqual(await f.repo.exportSource({projectId:f.project.project.id,sourceId:f.a.sourceId,version:1}),Buffer.from('a😀b\r\nc'));
});

test('captured frame revocation inside source write prevents late selection and receipt disclosure',async()=>{
  const f=await fixture(),g=gate();f.setFault(g.fault);const pending=f.coordinator.invoke(f.grants[0],intent(f.a,'revoked-edit','X'));await g.entered;
  f.registry.invalidateEpoch();g.release();assert.equal((await pending).code,'ACCESS_REFUSED');
  assert.deepEqual(await f.repo.exportSource({projectId:f.project.project.id,sourceId:f.a.sourceId,version:1}),Buffer.from('a😀b\r\nc'));
  assert.equal((await f.repo.getMetrics({projectId:f.project.project.id,sourceId:f.a.sourceId})).version,1);
});

test('bounded owner queue includes pending native I/O and does not admit cloned grants or foreign entities',async()=>{
  const f=await fixture({maxPending:1}),g=gate();f.setFault(g.fault);const pending=f.coordinator.invoke(f.grants[0],intent(f.a,'held-edit','X'));await g.entered;
  f.coordinator.maxPending=1000;f.coordinator.maxQueueBytes=Number.MAX_SAFE_INTEGER;
  assert.equal((await f.coordinator.invoke(f.grants[1],intent(f.b,'over-budget','Y'))).code,'OWNER_BUDGET');g.release();assert.equal((await pending).ok,true);
  assert.equal((await f.coordinator.invoke({...f.grants[0]},intent({...f.a,version:2},'forged-grant','Z'))).code,'ACCESS_REFUSED');
  assert.equal((await f.coordinator.invoke(f.grants[0],intent(f.b,'foreign-source','Z'))).code,'ACCESS_REFUSED');
});

test('same native frame cannot submit a queued source edit after its access policy becomes readonly',async()=>{
  const f=await fixture(),g=gate();f.setFault(g.fault);
  const first=f.coordinator.invoke(f.grants[0],intent(f.a,'pending-permission','X'));await g.entered;
  const queued=f.coordinator.invoke(f.grants[1],intent(f.b,'queued-permission','Y'));f.native.mode='readonly';f.native.access='read';g.release();
  assert.equal((await first).code,'ACCESS_REFUSED');assert.equal((await queued).code,'ACCESS_REFUSED');
  assert.deepEqual(await f.repo.exportSource({projectId:f.project.project.id,sourceId:f.b.sourceId,version:1}),Buffer.from('second source\n'));
  assert.equal((await f.repo.getMetrics({projectId:f.project.project.id,sourceId:f.b.sourceId})).version,1);
});

test('queued payload is copied before awaits and a renderer getter is never evaluated',async()=>{
  const f=await fixture(),g=gate();f.setFault(g.fault);const first=f.coordinator.invoke(f.grants[0],intent(f.a,'first-gated','X'));await g.entered;
  const queued=intent(f.b,'copied-edit','Y');const second=f.coordinator.invoke(f.grants[1],queued);queued.payload.insertedText='MUTATED';g.release();assert.equal((await first).ok,true);assert.equal((await second).ok,true);
  assert.deepEqual(await f.repo.exportSource({projectId:f.project.project.id,sourceId:f.b.sourceId,version:2}),Buffer.from('Yecond source\n'));
  let read=0;const bad={kind:'source',method:'applyEdit',get payload(){read++;throw Error('Getter evaluated');}};assert.equal((await f.coordinator.invoke(f.grants[0],bad)).code,'REQUEST_REFUSED');assert.equal(read,0);
});

test('subscriptions contain only verified scoped source receipts and stop on dispose or native revocation',async()=>{
  const f=await fixture();const own=[],other=[];
  const unsubscribe=f.coordinator.subscribe(f.grants[0],f.a.sourceId,receipt=>own.push(receipt));f.coordinator.subscribe(f.grants[1],f.b.sourceId,receipt=>other.push(receipt));
  const first=await f.coordinator.invoke(f.grants[0],intent(f.a,'notify-edit','X'));assert.deepEqual(own,[first]);assert.deepEqual(other,[]);assert.equal(JSON.stringify(own).includes('Independent linked Docs bytes'),false);assert.equal('text' in own[0],false);
  unsubscribe();await f.coordinator.invoke(f.grants[0],intent({...f.a,version:2},'second-edit','Z'));assert.equal(own.length,1);
  f.registry.invalidateEpoch();assert.throws(()=>f.coordinator.subscribe(f.grants[0],f.a.sourceId,()=>{}),{code:'ACCESS_REFUSED'});
});
