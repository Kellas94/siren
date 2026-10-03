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
