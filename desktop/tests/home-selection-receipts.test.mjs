import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {atomicWrite} from '../src/projects/atomic.mjs';
import {HomeAuthority} from '../src/navigation/authority.mjs';
import {HomeTransitionReceipts} from '../src/navigation/transition-receipts.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {invokeHome} from '../src/navigation/ipc.mjs';

async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'siren-home-selection-')),projects=new ProjectStore(root);
 let projectId=null,generation=0,unlocked=true;
 const primary=new EventEmitter();primary.id=100;primary.isDestroyed=()=>false;primary.webContents=new EventEmitter();
 const wc=primary.webContents;Object.assign(wc,{id:200,mainFrame:{url:'siren://app/home.html'},getURL:()=>wc.mainFrame.url,isDestroyed:()=>false,isLoadingMainFrame:()=>false});
 const registry=new WindowRegistry({authorize:()=>projectId&&unlocked?{projectId,mode:'normal',access:'write',entityIds:[]}:null,createWindow:()=>assert.fail('No satellite required')});registry.bindWorkspace(primary);
 const authority=new HomeAuthority({workspace:primary,state:()=>({projectId,generation,unlocked,mode:'normal'})});
 const transitions=new HomeTransitionReceipts({registry,authority,projects}),event=()=>({sender:wc,senderFrame:wc.mainFrame});
 const next=await projects.createProject({label:'Selected without autoscratch',json:'{"diagrams":[]}'});
 const select=async({pointer=true}={})=>{authority.invalidate();registry.invalidateEpoch({preserveWorkspace:true});if(pointer)await atomicWrite(join(root,'session-selection.json'),Buffer.from(JSON.stringify({schema:1,projectId:next.project.id})));projectId=next.project.id;generation++;wc.mainFrame={url:'siren://app/home.html'};registry.activateWorkspace({entryUrl:wc.getURL()});};
 return {projects,next,authority,transitions,event,select,lock:()=>{unlocked=false;}};
}
test('first-use Home selection acknowledges only an actual durable project and fresh native scope',async()=>{
 const f=await fixture(),old=f.authority.capture(f.event());
 const result=await invokeHome({event:f.event(),method:'createProject',payload:{label:'selected'},authority:f.authority,transitions:f.transitions,services:{createProject:async(_input,scope)=>{assert.ok(scope.transition);await f.select();return f.transitions.completeSelection(scope.transition);}}});
 assert.equal(result.ok,true);assert.deepEqual(Object.keys(result).sort(),['epoch','ok']);assert.equal(f.authority.isCurrent(old),false);assert.deepEqual(await f.projects.readProject(f.next.project.id),f.next);
});
test('memory selection without an owned durable pointer cannot confirm Home selection',async()=>{
 const f=await fixture();
 const result=await invokeHome({event:f.event(),method:'openProject',payload:{projectId:f.next.project.id},authority:f.authority,transitions:f.transitions,services:{openProject:async(_input,scope)=>{await f.select({pointer:false});assert.equal((await f.transitions.completeSelection(scope.transition)).ok,false);return {ok:true,epoch:2};}}});
 assert.equal(result.code,'ACCESS_REFUSED');
});
test('copied selection metadata and Lock after a genuine selection do not publish success',async()=>{
 for(const mode of ['copy','lock']){
  const f=await fixture();const result=await invokeHome({event:f.event(),method:'createProject',payload:{label:'selected'},authority:f.authority,transitions:f.transitions,services:{createProject:async(_input,scope)=>{await f.select();const receipt=await f.transitions.completeSelection(scope.transition);assert.equal(receipt.ok,true);if(mode==='lock')f.lock();return mode==='copy'?{...receipt}:receipt;}}});assert.equal(result.code,'ACCESS_REFUSED');
 }
});

test('only genuine Continue selection permits a finite follow-up and Lock retires that scope',async()=>{
 const f=await fixture(),grant=f.authority.capture(f.event()),ticket=f.transitions.begin(grant,'continueWork');
 await f.select();const receipt=await f.transitions.completeSelection(ticket);assert.equal(receipt.ok,true);
 assert.equal(f.transitions.selectionIsCurrent(ticket,{...receipt}),false);
 assert.equal(f.transitions.selectionIsCurrent({...ticket},receipt),false);
 assert.equal(f.transitions.selectionIsCurrent(ticket,receipt),true);f.lock();
 assert.equal(f.transitions.selectionIsCurrent(ticket,receipt),false);f.transitions.cancel(ticket);
});
