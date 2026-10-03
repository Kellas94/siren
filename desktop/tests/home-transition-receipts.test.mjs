import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {HomeTransitionReceipts} from '../src/navigation/transition-receipts.mjs';
import {HomeAuthority} from '../src/navigation/authority.mjs';
import {invokeHome} from '../src/navigation/ipc.mjs';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {NativeReadonlyViewSeals} from '../src/windows/readonly-seals.mjs';
import {NativeAllViewControl} from '../src/windows/control.mjs';
import {NativeAllWorkspaceBarrier} from '../src/windows/source-barrier.mjs';
import {PrimaryPersistence} from '../src/windows/primary.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {DomainRepository} from '../src/windows/domain.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';

async function fixture(){
 const f=await sourceReadFixture();f.windows[0].destroy();
 await f.registry.openView({role:'code',entityId:f.refs[0].sourceId,version:1});
 const primary=new EventEmitter();primary.id=900;primary.isDestroyed=()=>false;
 const wc=primary.webContents=new EventEmitter();wc.id=901;wc.mainFrame={url:'siren://app/app.html'};wc.getURL=()=>wc.mainFrame.url;wc.isDestroyed=()=>false;wc.isLoadingMainFrame=()=>false;
 f.registry.bindWorkspace(primary);f.registry.activateWorkspace();
 const event=()=>({sender:wc,senderFrame:wc.mainFrame});
 const authority=new HomeAuthority({workspace:primary,state:()=>({unlocked:f.isUnlocked(),projectId:f.selected.project.id,mode:'readonly',generation:1})});
 const receipts=new HomeTransitionReceipts({registry:f.registry,authority});
 const readonlyViews=new NativeReadonlyViewSeals({registry:f.registry,isReadonly:grant=>['code','docs'].includes(grant.role),snapshotFor:()=>f.projects.readProject(f.selected.project.id),sources:({canWrite})=>new SourceRepository(f.root,{canWrite})});
 const owner=new WorkspaceCoordinator({registry:f.registry,readonlyViews,sources:()=>f.sources,access:()=>true,domains:new DomainRepository({projects:()=>f.projects,sources:()=>f.sources,validatePatch:()=>false}),primary:new PrimaryPersistence({projects:()=>f.projects,recovery:new RecoveryStore(f.root,{sources:f.sources})})});
 const control=new NativeAllViewControl({registry:f.registry,owner,send:(own,ticket)=>{void(async()=>{if(own.sender===wc)assert.equal((await owner.invoke(f.registry.capturePrimary(own),{kind:'workspace',method:'sealReadonly',payload:{}},ticket.nonce)).ok,true);await control.acknowledge(own,{requestId:ticket.requestId,ok:true});})();}});
 const barrier=new NativeAllWorkspaceBarrier({registry:f.registry,owner,control,cover:()=>{}});
 async function navigate(scope){
  authority.invalidate();const prepared=await barrier.prepare('authentic-home');assert.equal(prepared.ok,true);
  const started=barrier.beginWorkspaceNavigation(prepared.proof,{entryUrl:'siren://app/home.html'});assert.equal(started.ok,true);
  wc.mainFrame={url:'siren://app/home.html'};
  const completed=barrier.finishWorkspaceNavigation(prepared.proof,started.navigation);assert.equal(completed.ok,true);
  assert.equal(receipts.complete(scope.transition,{barrier:{isCompletedNavigation:()=>true},proof:prepared.proof,view:completed.view}).ok,false);
  assert.equal(receipts.complete(scope.transition,{barrier,proof:prepared.proof,view:{...completed.view}}).ok,false);
  const receipt=receipts.complete(scope.transition,{barrier,proof:prepared.proof,view:completed.view});
  assert.equal(barrier.release(prepared.proof),true);return receipt;
 }
 return {...f,authority,receipts,event,navigate,barrier,control};
}
test('Home metadata acknowledgement follows a genuine prepared native handoff while the old grant stays retired',async()=>{
 const f=await fixture(),old=f.authority.capture(f.event());
 try{
  const result=await invokeHome({event:f.event(),method:'continueWork',payload:{},authority:f.authority,transitions:f.receipts,services:{continueWork:(_input,scope)=>f.navigate(scope)}});
  assert.equal(result.ok,true);assert.deepEqual(Object.keys(result).sort(),['epoch','ok']);assert.equal(f.authority.isCurrent(old),false);
  assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 }finally{f.barrier.dispose();f.control.dispose();}
});
test('copied completion metadata cannot acknowledge a retired Home request',async()=>{
 const f=await fixture();
 try{
  const result=await invokeHome({event:f.event(),method:'continueWork',payload:{},authority:f.authority,transitions:f.receipts,services:{continueWork:async(_input,scope)=>({...await f.navigate(scope)})}});
  assert.equal(result.code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 }finally{f.barrier.dispose();f.control.dispose();}
});
test('a renderer success label and URL change without a native handoff remain refused',async()=>{
 const f=await fixture();
 try{
  const result=await invokeHome({event:f.event(),method:'continueWork',payload:{},authority:f.authority,transitions:f.receipts,services:{continueWork:async()=>{f.authority.invalidate();return {ok:true,epoch:1}}}});
  assert.equal(result.code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 }finally{f.barrier.dispose();f.control.dispose();}
});
test('Lock after native completion refuses publication of its metadata receipt',async()=>{
 const f=await fixture();
 try{
  const result=await invokeHome({event:f.event(),method:'continueWork',payload:{},authority:f.authority,transitions:f.receipts,services:{continueWork:async(_input,scope)=>{const receipt=await f.navigate(scope);f.lock();return receipt;}}});
  assert.equal(result.code,'ACCESS_REFUSED');assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
 }finally{f.barrier.dispose();f.control.dispose();}
});
