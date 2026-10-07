import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {NativeAllWorkspaceBarrier} from '../src/windows/source-barrier.mjs';
import {NativeAllViewControl} from '../src/windows/control.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {PrimaryPersistence} from '../src/windows/primary.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';

async function fixture({initialProjectId='owned',satellites=true}={}){
  let serial=1,projectId=initialProjectId,mode='normal';const windows=[];
  function create(url){
    const window=new EventEmitter();window.id=serial++;let destroyed=false,minimized=false;
    Object.assign(window,{isDestroyed:()=>destroyed,isMinimized:()=>minimized,restore:()=>{minimized=false;},focus(){},close:()=>window.destroy(),destroy:()=>{destroyed=true;window.emit('closed');}});
    const wc=window.webContents=new EventEmitter();Object.assign(wc,{id:100+window.id,mainFrame:{url},isDestroyed:()=>destroyed,getURL:()=>wc.mainFrame.url,isLoadingMainFrame:()=>window.loading===true});
    window.load=url=>{wc.emit('did-start-navigation',{url,isMainFrame:true});wc.mainFrame={url};wc.emit('did-finish-load');};window.minimize=()=>{minimized=true;};windows.push(window);return window;
  }
  const main=create('siren://app/app.html');
  const registry=new WindowRegistry({authorize:()=>({projectId,mode,access:mode==='normal'?'write':'read',entityIds:['doc-a','source-a']}),createWindow:async record=>create(record.mainFrameUrl)});
  registry.bindWorkspace(main);registry.activateWorkspace();
  if(satellites){await registry.openView({role:'docs',entityId:'doc-a'});await registry.openView({role:'code',entityId:'source-a'});windows[2].minimize();}
  const event=window=>({sender:window.webContents,senderFrame:window.webContents.mainFrame});
  const captures=windows.map(window=>registry.capture(event(window)));
  return {registry,main,windows,event,captures,changeProject:value=>{projectId=value;},changeMode:value=>{mode=value;}};
}

test('prepared same-project entry rotation retires only the old primary capture and preserves minimized satellites',async()=>{
  const f=await fixture(),roster=f.registry.freezeRoster();
  const ticket=f.registry.beginWorkspaceNavigation(roster,{entryUrl:'siren://app/home.html'});
  assert.equal(f.registry.isCurrent(f.captures[0]),false);assert.equal(f.registry.capture(f.event(f.main)),null);
  assert.equal(f.registry.isCurrent(f.captures[1]),true);assert.equal(f.registry.isCurrent(f.captures[2]),true);
  assert.equal(f.registry.releaseRoster(roster),false);
  await assert.rejects(f.registry.openView({role:'docs',entityId:'doc-a'}),{code:'ROSTER_FROZEN'});
  f.main.load('siren://app/home.html');
  const activated=f.registry.finishWorkspaceNavigation(ticket);
  assert.equal(activated.role,'workspace');assert.notEqual(activated.windowId,f.captures[0].windowId);
  assert.deepEqual(f.registry.capture(f.event(f.main)).entityIds,[]);
  assert.equal(f.registry.isCurrent(f.captures[0]),false);assert.equal(f.registry.isCurrent(f.captures[1]),true);assert.equal(f.registry.isCurrent(f.captures[2]),true);
  assert.equal(f.windows[2].isMinimized(),true);assert.equal(f.windows.some(window=>window.isDestroyed()),false);
  assert.equal(f.registry.releaseRoster(roster),true);
  const nextRoster=f.registry.freezeRoster(),next=f.registry.beginWorkspaceNavigation(nextRoster,{entryUrl:'siren://app/app.html'});
  f.main.load('siren://app/app.html');f.registry.finishWorkspaceNavigation(next);
  assert.deepEqual(f.registry.capture(f.event(f.main)).entityIds,['doc-a','source-a']);assert.equal(f.registry.isCurrent(f.captures[1]),true);
  assert.equal(f.registry.releaseRoster(nextRoster),true);
});

test('matching target URL is insufficient while the genuine native document is still loading',async()=>{
  const f=await fixture(),roster=f.registry.freezeRoster(),ticket=f.registry.beginWorkspaceNavigation(roster,{entryUrl:'siren://app/home.html'});
  f.main.load('siren://app/home.html');f.main.loading=true;
  assert.throws(()=>f.registry.finishWorkspaceNavigation(ticket),{code:'ACCESS_REFUSED'});assert.equal(f.registry.capture(f.event(f.main)),null);
  f.main.loading=false;const record=f.registry.finishWorkspaceNavigation(ticket);assert.equal(f.registry.isWorkspaceNavigationCurrent(record),true);
  f.changeProject('other');assert.equal(f.registry.isWorkspaceNavigationCurrent(record),false);
});

async function persistenceFixture(){
  const root=await mkdtemp(join(tmpdir(),'siren-entry-persistence-')),projects=new ProjectStore(root);
  const selected=await projects.createProject({label:'Entry persistence',json:'{"retained":"exact private text 😀"}'});
  const f=await fixture({initialProjectId:selected.project.id,satellites:false});
  const freeze=f.registry.freezeRoster.bind(f.registry);let capturedRoster;
  f.registry.freezeRoster=()=>{capturedRoster=freeze();return capturedRoster;};
  const primary=new PrimaryPersistence({projects:({canWrite})=>new ProjectStore(root,{canSave:canWrite}),recovery:new RecoveryStore(root)});
  const owner=new WorkspaceCoordinator({registry:f.registry,primary,sources:({canWrite})=>new SourceRepository(root,{canWrite}),access:()=>true});
  const control=new NativeAllViewControl({registry:f.registry,owner,send:(event,request)=>{void(async()=>{
    const grant=f.registry.capturePrimary(event);
    const receipt=await owner.invoke(grant,{kind:'workspace',method:'saveProject',payload:{projectId:selected.project.id,baseRevision:selected.revision,json:selected.json,purpose:'workspace'}},request.nonce);
    await control.acknowledge(event,{requestId:request.requestId,ok:receipt.ok===true,...(receipt.ok?{}:{code:receipt.code})});
  })();}});
  const barrier=new NativeAllWorkspaceBarrier({registry:f.registry,owner,control,cover:()=>{}});
  return {...f,root,projects,selected,owner,control,barrier,getRoster:()=>capturedRoster};
}

test('native barrier permits entry retirement only after real persisted preparation and holds writes until the fresh entry is complete',async()=>{
  const f=await persistenceFixture();
  assert.equal(f.barrier.beginWorkspaceNavigation({},{entryUrl:'siren://app/home.html'}).code,'NAVIGATION_REFUSED');
  const prepared=await f.barrier.prepare('home');assert.equal(prepared.ok,true);
  assert.equal(f.barrier.beginWorkspaceNavigation({...prepared.proof},{entryUrl:'siren://app/home.html'}).code,'NAVIGATION_REFUSED');
  const started=f.barrier.beginWorkspaceNavigation(prepared.proof,{entryUrl:'siren://app/home.html'});assert.equal(started.ok,true);
  assert.equal(f.barrier.release(prepared.proof),false);assert.equal(f.registry.capture(f.event(f.main)),null);
  f.main.load('siren://app/home.html');const finished=f.barrier.finishWorkspaceNavigation(prepared.proof,started.navigation);assert.equal(finished.ok,true);
  assert.equal(f.registry.isWorkspaceNavigationCurrent(finished.view),true);assert.equal(f.registry.isWorkspaceNavigationCurrent({...finished.view}),false);
  assert.equal(f.barrier.release(prepared.proof),true);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
  f.control.dispose();f.barrier.dispose();
});

test('a failed load cannot lift the paused owner or reuse its old proof; disposal retires navigation authority without resuming writes',async()=>{
  const f=await persistenceFixture(),prepared=await f.barrier.prepare('home');assert.equal(prepared.ok,true);
  const started=f.barrier.beginWorkspaceNavigation(prepared.proof,{entryUrl:'siren://app/home.html'});assert.equal(started.ok,true);
  f.main.load('siren://app/home.html?bad=1');f.main.load('siren://app/home.html');
  assert.equal(f.barrier.finishWorkspaceNavigation(prepared.proof,started.navigation).code,'NAVIGATION_REFUSED');assert.equal(f.barrier.release(prepared.proof),false);
  assert.equal(f.registry.capture(f.event(f.main)),null);f.barrier.dispose();f.control.dispose();
  assert.equal(f.registry.cancelWorkspaceNavigation(started.navigation),false);assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});

test('new native work, Lock or consumed roster after entry completion prevents the prepared transition from resuming the owner',async()=>{
  for(const change of ['work','lock','roster']){
    const f=await persistenceFixture(),prepared=await f.barrier.prepare('home');
    const started=f.barrier.beginWorkspaceNavigation(prepared.proof,{entryUrl:'siren://app/home.html'});f.main.load('siren://app/home.html');
    const finished=f.barrier.finishWorkspaceNavigation(prepared.proof,started.navigation);assert.equal(finished.ok,true);
    if(change==='work'){f.owner.resume();f.owner.pause('new transition');}else if(change==='lock')f.registry.invalidateEpoch({preserveWorkspace:true});else{
      // A different trusted native actor consumed the roster. Its old owner
      // receipt cannot now manufacture successful unpause.
      assert.equal(f.registry.releaseRoster(f.getRoster()),true);
    }
    assert.equal(f.barrier.release(prepared.proof),false);
    if(change==='roster'){
      const current=f.registry.capturePrimary(f.event(f.main));
      assert.equal((await f.owner.saveWorkspace(current,{projectId:f.selected.project.id,baseRevision:f.selected.revision,json:'{"mustNotSave":true}',purpose:'workspace'})).code,'WORKSPACE_PAUSED');
    }
    f.barrier.dispose();f.control.dispose();assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
  }
});

test('forged/stale roster, copied tickets and reused tickets cannot rotate or activate the bound workspace',async()=>{
  const f=await fixture();assert.throws(()=>f.registry.beginWorkspaceNavigation({epoch:1,grants:f.captures},{entryUrl:'siren://app/home.html'}),{code:'ACCESS_REFUSED'});
  const roster=f.registry.freezeRoster();assert.throws(()=>f.registry.beginWorkspaceNavigation({...roster},{entryUrl:'siren://app/home.html'}),{code:'ACCESS_REFUSED'});
  const ticket=f.registry.beginWorkspaceNavigation(roster,{entryUrl:'siren://app/home.html'});f.main.load('siren://app/home.html');
  assert.throws(()=>f.registry.finishWorkspaceNavigation({...ticket}),{code:'ACCESS_REFUSED'});
  f.registry.finishWorkspaceNavigation(ticket);assert.throws(()=>f.registry.finishWorkspaceNavigation(ticket),{code:'ACCESS_REFUSED'});
});

test('Lock, changed selected project, policy change and satellite loss refuse navigation completion without a fresh primary grant',async()=>{
  for(const change of ['lock','project','mode','closed']){
    const f=await fixture(),roster=f.registry.freezeRoster(),ticket=f.registry.beginWorkspaceNavigation(roster,{entryUrl:'siren://app/home.html'});
    if(change==='lock')f.registry.invalidateEpoch({preserveWorkspace:true});
    if(change==='project')f.changeProject('other');if(change==='mode')f.changeMode('readonly');if(change==='closed')f.windows[1].destroy();
    f.main.load('siren://app/home.html');assert.throws(()=>f.registry.finishWorkspaceNavigation(ticket),{code:'ACCESS_REFUSED'});assert.equal(f.registry.capture(f.event(f.main)),null);
  }
});

test('only the expected finite target can complete rotation; unexpected navigation remains fenced even after returning to it',async()=>{
  for(const url of ['siren://app/home.html?x=1','https://example.invalid/','siren://app/app.html']){
    const f=await fixture(),roster=f.registry.freezeRoster(),ticket=f.registry.beginWorkspaceNavigation(roster,{entryUrl:'siren://app/home.html'});
    f.main.load(url);f.main.load('siren://app/home.html');assert.throws(()=>f.registry.finishWorkspaceNavigation(ticket),{code:'ACCESS_REFUSED'});
    assert.equal(f.registry.capture(f.event(f.main)),null);assert.equal(f.registry.cancelWorkspaceNavigation(ticket),true);assert.equal(f.registry.cancelWorkspaceNavigation(ticket),false);
  }
});

test('rotation validates native option descriptors before retiring any existing view',async()=>{
  const f=await fixture(),roster=f.registry.freezeRoster();let ran=false;
  const hostile={};Object.defineProperty(hostile,'entryUrl',{enumerable:true,get:()=>{ran=true;return 'siren://app/home.html';}});
  for(const options of [hostile,{entryUrl:null},{entryUrl:'siren://app/home.html',projectId:'owned'}])assert.throws(()=>f.registry.beginWorkspaceNavigation(roster,options),{code:'ACCESS_REFUSED'});
  assert.equal(ran,false);assert.equal(f.registry.isRosterCurrent(roster),true);assert.equal(f.registry.isCurrent(f.captures[0]),true);
});
