import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
const module=await import('../src/windows/source-barrier.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
class NativeWindow extends EventEmitter {
  constructor(id,url){super();this.id=id;this.destroyed=false;this.minimized=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:id+1000,mainFrame:{url},getURL:()=>this.webContents.mainFrame.url,isDestroyed:()=>this.destroyed});}
  isDestroyed(){return this.destroyed;}isMinimized(){return this.minimized;}restore(){}focus(){}close(){this.destroy();}
  destroy(){this.destroyed=true;this.webContents.emit('destroyed');this.emit('closed');}
}
async function fixture({role='code',factory}={}) {
  const root=await mkdtemp(join(tmpdir(),'siren-source-barrier-')),projects=new ProjectStore(root),repo=new SourceRepository(root);
  const project=await projects.createProject({label:'Barrier fixture',json:'{"workpapers":[{"id":"doc-a","content":"original Docs"}]}'});
  const ref=await repo.importSource({projectId:project.project.id,bytes:Buffer.from('a😀b\r\nc')});const windows=[];
  const native={projectId:project.project.id,mode:'normal',access:'write',entityIds:[ref.sourceId,'doc-a']};
  const registry=new WindowRegistry({authorize:()=>native,createWindow:async options=>{const w=new NativeWindow(windows.length+1,options.mainFrameUrl);windows.push(w);if(factory)await factory(w);return w;}});
  const open=()=>registry.openView({role,entityId:role==='docs'?'doc-a':ref.sourceId});await open();await open();
  const grant=i=>registry.capture({sender:windows[i].webContents,senderFrame:windows[i].webContents.mainFrame});
  const owner=new WorkspaceCoordinator({registry,sources:({canWrite})=>new SourceRepository(root,{canWrite}),access:()=>true});
  const commit=(g,nonce,version,id)=>owner.invoke(g,{kind:'source',method:'commitSource',payload:{sourceId:ref.sourceId,expectedVersion:version,operationId:id}},nonce);
  const edit=(g,nonce,version,id,text)=>owner.invoke(g,{kind:'source',method:'applyEdit',payload:{sourceId:ref.sourceId,expectedVersion:version,operationId:id,start:0,end:1,insertedText:text}},nonce);
  return {root,projects,project,repo,ref,registry,windows,native,grant,owner,commit,edit,open};
}
test('registry exposes a private immutable roster fence',async()=>{
  const f=await fixture();assert.equal(typeof f.registry.freezeRoster,'function');assert.equal(typeof f.registry.isRosterCurrent,'function');assert.equal(typeof f.registry.releaseRoster,'function');
});
const rosterCheck=(name,fn)=>test(name,async()=>{if(typeof WindowRegistry.prototype.freezeRoster!=='function')return assert.fail('Native roster missing');await fn();});
rosterCheck('roster captures every real minimized frame and refuses cloned proofs or new opens',async()=>{
  const f=await fixture();f.windows[1].minimized=true;const roster=f.registry.freezeRoster();assert.equal(roster.grants.length,2);assert.equal(Object.isFrozen(roster.grants),true);
  assert.equal(f.registry.isRosterCurrent(roster),true);assert.equal(f.registry.isRosterCurrent({...roster}),false);
  await assert.rejects(f.open(),{code:'ROSTER_FROZEN'});assert.equal(f.windows.length,2);assert.throws(()=>f.registry.freezeRoster(),{code:'ROSTER_BUSY'});
  assert.equal(f.registry.releaseRoster({...roster}),false);assert.equal(f.registry.releaseRoster(roster),true);assert.equal(f.registry.isRosterCurrent(roster),false);await f.open();
});
rosterCheck('a pre-fence pending factory cannot join even after the fence is released',async()=>{
  let release,enter;const gate=new Promise(r=>release=r),entered=new Promise(r=>enter=r);let held=false;
  const f=await fixture({factory:async()=>{if(held){enter();await gate;}}});held=true;const opening=f.open();await entered;
  const roster=f.registry.freezeRoster();assert.equal(roster.grants.length,2);f.registry.releaseRoster(roster);release();
  await assert.rejects(opening,{code:'ACCESS_REFUSED'});assert.equal(f.windows[2].isDestroyed(),true);assert.equal(f.registry.listViews().length,2);
});
rosterCheck('retirement, policy change, same URL frame replacement and epoch changes invalidate the roster',async()=>{
  for(const change of [f=>f.windows[0].destroy(),f=>{f.native.projectId='other';},f=>{f.windows[0].webContents.mainFrame={url:f.windows[0].webContents.getURL()};},f=>f.registry.invalidateEpoch()]){
    const f=await fixture(),roster=f.registry.freezeRoster();change(f);assert.equal(f.registry.isRosterCurrent(roster),false);assert.equal(f.registry.releaseRoster(roster),true);
  }
});
test('native source receipt reconciliation exists',()=>assert.equal(typeof WorkspaceCoordinator.prototype.reconcileSourceReceipts,'function'));
const reconcileCheck=(name,fn)=>test(name,async()=>{assert.equal(typeof WorkspaceCoordinator.prototype.reconcileSourceReceipts,'function');await fn();});
reconcileCheck('an older per-view commit does not represent the final shared source draft',async()=>{
  const f=await fixture();f.owner.pause('test');const a=f.owner.beginViewFlush(f.grant(0)),b=f.owner.beginViewFlush(f.grant(1));
  const old=await f.commit(f.grant(0),a,1,'old-commit');await f.owner.finishViewFlush(f.grant(0),a);
  const draft=await f.edit(f.grant(1),b,1,'later-draft','X');f.owner.cancelViewFlush(f.grant(1),b);
  const result=await f.owner.reconcileSourceReceipts([f.grant(0),f.grant(1)],[old,draft],()=>true);
  assert.equal(result.code,'SOURCE_NOT_COMMITTED');assert.deepEqual(await f.projects.readProject(f.project.project.id),f.project);
});
reconcileCheck('two native commits reconcile to the genuinely latest shared selected version',async()=>{
  const f=await fixture();f.owner.pause('test');const a=f.owner.beginViewFlush(f.grant(0)),b=f.owner.beginViewFlush(f.grant(1));
  const old=await f.commit(f.grant(0),a,1,'old-commit');await f.owner.finishViewFlush(f.grant(0),a);
  const draft=await f.edit(f.grant(1),b,1,'later-draft','X'),saved=await f.commit(f.grant(1),b,2,'latest-commit');await f.owner.finishViewFlush(f.grant(1),b);
  const result=await f.owner.reconcileSourceReceipts([f.grant(0),f.grant(1)],[old,draft,saved],()=>true);
  assert.equal(result.ok,true);assert.deepEqual(result.refs,[{sourceId:f.ref.sourceId,version:2,sha256:saved.sha256,durability:'committed'}]);
  assert.deepEqual(await new SourceRepository(f.root).exportSource({projectId:f.project.project.id,sourceId:f.ref.sourceId,version:2}),Buffer.from('X😀b\r\nc'));
});
reconcileCheck('old-only, forged commit, cross-project and failed receipts cannot establish latest persistence',async()=>{
  const f=await fixture();f.owner.pause('test');const nonce=f.owner.beginViewFlush(f.grant(0)),old=await f.commit(f.grant(0),nonce,1,'old-commit');await f.edit(f.grant(0),nonce,1,'later','X');f.owner.cancelViewFlush(f.grant(0),nonce);
  assert.equal((await f.owner.reconcileSourceReceipts([f.grant(0)],[old],()=>true)).code,'SOURCE_VERSION_CHANGED');
  const metrics=await f.repo.getMetrics({projectId:f.project.project.id,sourceId:f.ref.sourceId});
  assert.equal((await f.owner.reconcileSourceReceipts([f.grant(0)],[{...old,version:2,sha256:metrics.sha256}],()=>true)).code,'SOURCE_PROOF_FAILED');
  assert.equal((await f.owner.reconcileSourceReceipts([{...f.grant(0)}],[old],()=>true)).code,'ACCESS_REFUSED');
  assert.equal((await f.owner.reconcileSourceReceipts([f.grant(0)],[{ok:false,code:'SOURCE_WRITE_FAILED'}],()=>true)).code,'SOURCE_FLUSH_FAILED');
});
reconcileCheck('reconciliation refuses live allowances and guards its asynchronous proof reads',async()=>{
  const f=await fixture();f.owner.pause('test');const g=f.grant(0),nonce=f.owner.beginViewFlush(g),saved=await f.commit(g,nonce,1,'saved');
  assert.equal((await f.owner.reconcileSourceReceipts([g],[saved],()=>true)).code,'OWNER_NOT_QUIESCENT');await f.owner.finishViewFlush(g,nonce);
  let calls=0;const result=await f.owner.reconcileSourceReceipts([g],[saved],()=>++calls<3);assert.equal(result.code,'ACCESS_REFUSED');
  f.owner.resume();assert.equal((await f.owner.reconcileSourceReceipts([g],[saved],()=>true)).code,'OWNER_NOT_QUIESCENT');
});
reconcileCheck('empty receipts or a missing Code entity cannot establish complete roster persistence',async()=>{
  const f=await fixture();f.owner.pause('test');assert.equal((await f.owner.reconcileSourceReceipts([f.grant(0)],[],()=>true)).code,'SOURCE_NOT_COMMITTED');
  const other=await f.repo.importSource({projectId:f.project.project.id,bytes:Buffer.from('another source')});f.native.entityIds.push(other.sourceId);await f.registry.openView({role:'code',entityId:other.sourceId});
  const nonce=f.owner.beginViewFlush(f.grant(0)),saved=await f.commit(f.grant(0),nonce,1,'first-only');await f.owner.finishViewFlush(f.grant(0),nonce);
  assert.equal((await f.owner.reconcileSourceReceipts([f.grant(0),f.grant(2)],[saved],()=>true)).code,'SOURCE_NOT_COMMITTED');
});
test('native source barrier exists',()=>assert.equal(typeof module.NativeSourceBarrier,'function'));
const barrierCheck=(name,fn)=>test(name,async()=>{assert.equal(typeof module.NativeSourceBarrier,'function');await fn();});
const barrier=(f,flush)=>new module.NativeSourceBarrier({registry:f.registry,owner:f.owner,control:{flushView:flush,cancelView:()=>({ok:true})},cover:()=>{}});
barrierCheck('every minimized Code view must flush before a native-only prepared proof can be issued',async()=>{
  const f=await fixture();f.windows[1].minimized=true;let count=0;
  const control=barrier(f,async g=>{const nonce=f.owner.beginViewFlush(g);await f.commit(g,nonce,1,'view-'+(++count));return f.owner.finishViewFlush(g,nonce);});
  const result=await control.prepare('lock');assert.equal(result.ok,true);assert.equal(count,2);assert.equal(control.isPrepared(result.proof),true);assert.equal(control.isPrepared({...result.proof}),false);
  await assert.rejects(f.open(),{code:'ROSTER_FROZEN'});assert.equal((await f.edit(f.grant(0),undefined,1,'late','bad')).code,'WORKSPACE_PAUSED');
  assert.equal((await control.prepare('quit')).code,'BARRIER_BUSY');f.windows[1].destroy();assert.equal(control.isPrepared(result.proof),false);assert.equal(control.release(result.proof),true);
});
barrierCheck('one failed or throwing view cannot produce a clean close and remains honestly fenced',async()=>{
  for(const refusal of [()=>({ok:false,code:'VIEW_TIMEOUT'}),()=>{throw Error('retired');}]){
    const f=await fixture();let count=0;const control=barrier(f,async g=>{if(++count===2)return refusal();const nonce=f.owner.beginViewFlush(g);await f.commit(g,nonce,1,'first');return f.owner.finishViewFlush(g,nonce);});
    const result=await control.prepare('quit');assert.equal(result.ok,false);assert.equal(Object.hasOwn(result,'proof'),false);assert.equal((await f.edit(f.grant(0),undefined,1,'late','bad')).code,'WORKSPACE_PAUSED');
    await assert.rejects(f.open(),{code:'ROSTER_FROZEN'});assert.deepEqual(await f.projects.readProject(f.project.project.id),f.project);control.dispose();
  }
});
barrierCheck('Docs or workspace routes are explicitly refused until their domain barriers are admitted',async()=>{
  const f=await fixture({role:'docs'});let flushed=false;const control=barrier(f,async()=>{flushed=true;return {ok:true,receipts:[]};});
  assert.equal((await control.prepare('lock')).code,'VIEW_ROLE_UNSUPPORTED');assert.equal(flushed,false);await f.open();control.dispose();
});
barrierCheck('retirement after view ACK but before final proof cannot become successful preparation',async()=>{
  const f=await fixture();let count=0;const control=barrier(f,async g=>{const nonce=f.owner.beginViewFlush(g);await f.commit(g,nonce,1,'view-'+(++count));const result=await f.owner.finishViewFlush(g,nonce);if(count===2)f.windows[0].destroy();return result;});
  const result=await control.prepare('select');assert.equal(result.ok,false);assert.equal(control.isPrepared(result.proof),false);control.dispose();
});
barrierCheck('resuming the owner or beginning another native allowance invalidates prepared authority',async()=>{
  for(const change of [f=>f.owner.resume(),f=>f.owner.beginViewFlush(f.grant(0))]) {
    const f=await fixture();let count=0;const control=barrier(f,async g=>{const nonce=f.owner.beginViewFlush(g);await f.commit(g,nonce,1,'view-'+(++count));return f.owner.finishViewFlush(g,nonce);});
    const result=await control.prepare('lock');assert.equal(result.ok,true);change(f);assert.equal(control.isPrepared(result.proof),false);control.dispose();
  }
});
barrierCheck('overall deadline cancels outstanding preparation and delayed success cannot issue a proof',async()=>{
  const f=await fixture();let release;const gate=new Promise(r=>release=r),cancelled=[];
  const control=new module.NativeSourceBarrier({registry:f.registry,owner:f.owner,timeoutMs:15,cover:()=>{},control:{flushView:()=>gate,cancelView:g=>cancelled.push(g)}});
  const result=await control.prepare('quit');assert.equal(result.code,'BARRIER_TIMEOUT');assert.equal(cancelled.length,2);
  release({ok:true,receipts:[]});await new Promise(r=>setImmediate(r));assert.equal(control.isPrepared(result.proof),false);assert.equal((await control.prepare('lock')).code,'BARRIER_BUSY');control.dispose();
});
