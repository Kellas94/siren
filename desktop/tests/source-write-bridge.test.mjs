import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {WorkspaceCoordinator} from '../src/windows/coordinator.mjs';
import {invokeSourceMutation} from '../src/windows/source-bridge.mjs';

async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'siren-source-write-bridge-')),projects=new ProjectStore(root),repository=new SourceRepository(root);
 const project=await projects.createProject({label:'Native mutation fixture',json:'{"workpapers":[{"id":"doc-a","content":"Keep Docs unchanged"}]}'});
 const a=await repository.importSource({projectId:project.project.id,bytes:Buffer.from('a😀b\r\nc')}),b=await repository.importSource({projectId:project.project.id,bytes:Buffer.from('second\n')});
 let live=true,editable=true,factories=0,fault=async()=>{};const windows=[];
 const registry=new WindowRegistry({authorize:()=>live?{projectId:project.project.id,mode:'normal',access:'write',entityIds:[a.sourceId,b.sourceId,'doc-a']}:null,createWindow:async input=>{
  let destroyed=false;const window=new EventEmitter();window.id=windows.length+1;Object.assign(window,{isDestroyed:()=>destroyed,isMinimized:()=>false,restore(){},focus(){},close:()=>window.destroy(),destroy(){destroyed=true;window.emit('closed');}});
  const wc=window.webContents=new EventEmitter();Object.assign(wc,{id:window.id+100,mainFrame:{url:input.mainFrameUrl},getURL:()=>wc.mainFrame.url,isDestroyed:()=>destroyed});windows.push(window);return window;
 }});
 for(const input of [{role:'code',entityId:a.sourceId},{role:'code',entityId:b.sourceId},{role:'code',entityId:a.sourceId,version:1},{role:'docs',entityId:'doc-a'}])await registry.openView(input);
 const owner=new WorkspaceCoordinator({registry,access:grant=>registry.isCurrent(grant)&&live&&editable,sources:({canWrite})=>{factories++;return new SourceRepository(root,{canWrite,fault:phase=>fault(phase)});}});
 const event=i=>({sender:windows[i].webContents,senderFrame:windows[i].webContents.mainFrame});
 const call=(method,payload,i=0,extra={})=>invokeSourceMutation({event:event(i),method,payload,registry,owner,canEdit:()=>live&&editable,...extra});
 const edit=(ref,id,text)=>({sourceId:ref.sourceId,operationId:id,expectedVersion:1,start:0,end:1,insertedText:text});
 return {root,project,projects,repository,a,b,windows,registry,owner,event,call,edit,factories:()=>factories,lock:()=>{live=false;},readonly:()=>{editable=false;},fault:fn=>{fault=fn;}};
}

test('native source mutation bridge preserves two independent Unicode/CRLF sources and leaves Docs/project untouched',async()=>{
 const f=await fixture(),[a,b]=await Promise.all([f.call('applyEdit',f.edit(f.a,'edit-a','X')),f.call('applyEdit',f.edit(f.b,'edit-b','Y'),1)]);
 assert.equal(a.ok,true);assert.equal(b.ok,true);assert.equal(a.durability,'draft');
 assert.deepEqual(await f.repository.exportSource({projectId:f.project.project.id,sourceId:f.a.sourceId,version:2}),Buffer.from('X😀b\r\nc'));
 assert.deepEqual(await f.repository.exportSource({projectId:f.project.project.id,sourceId:f.b.sourceId,version:2}),Buffer.from('Yecond\n'));
 const saved=await f.call('commitSource',{sourceId:f.a.sourceId,expectedVersion:2,operationId:'source-save'});assert.equal(saved.ok,true);assert.equal(saved.durability,'committed');assert.equal(saved.sha256,a.sha256);
 assert.deepEqual(await f.projects.readProject(f.project.project.id),f.project);
});
test('native duplicate and stale mutation retain exact CAS semantics and immutable original',async()=>{
 const f=await fixture(),request=f.edit(f.a,'same-edit','X'),first=await f.call('applyEdit',request);
 assert.deepEqual(await f.call('applyEdit',request),first);
 assert.equal((await f.call('applyEdit',f.edit(f.a,'stale-edit','bad'))).code,'REVISION_CONFLICT');
 assert.equal((await f.call('applyEdit',{...request,insertedText:'different'})).code,'OPERATION_CONFLICT');
 assert.deepEqual(await f.repository.exportSource({projectId:f.project.project.id,sourceId:f.a.sourceId,version:1}),Buffer.from('a😀b\r\nc'));
 assert.deepEqual(await f.repository.exportSource({projectId:f.project.project.id,sourceId:f.a.sourceId,version:2}),Buffer.from('X😀b\r\nc'));
});
test('historical Code, Docs, foreign entity, copied sender and subframe cannot gain edit authority',async()=>{
 const f=await fixture(),p=f.edit(f.a,'refused-edit','wrong');
 for(const i of [2,3])assert.equal((await f.call('applyEdit',p,i)).code,'ACCESS_REFUSED');
 assert.equal((await f.call('applyEdit',f.edit(f.b,'foreign-edit','wrong'))).code,'ACCESS_REFUSED');
 for(const event of [{sender:{...f.event(0).sender},senderFrame:f.event(0).senderFrame},{sender:f.event(0).sender,senderFrame:{url:f.event(0).senderFrame.url}}])assert.equal((await f.call('applyEdit',p,0,{event})).code,'ACCESS_REFUSED');
 f.readonly();assert.equal((await f.call('applyEdit',p)).code,'ACCESS_REFUSED');assert.equal(f.factories(),0);
 assert.equal((await f.repository.getMetrics({projectId:f.project.project.id,sourceId:f.a.sourceId})).version,1);
});
test('mutation payloads cannot smuggle project/epoch/nonce, methods or getters before native repository admission',async()=>{
 const f=await fixture(),p=f.edit(f.a,'bad-payload','wrong');let getterRan=false;
 for(const extra of [{projectId:f.project.project.id},{epoch:1},{nonce:'stolen'},{flushNonce:'stolen'}])assert.equal((await f.call('applyEdit',{...p,...extra})).code,'REQUEST_REFUSED');
 const accessor={...p};Object.defineProperty(accessor,'insertedText',{enumerable:true,get(){getterRan=true;return 'wrong';}});
 assert.equal((await f.call('applyEdit',accessor)).code,'REQUEST_REFUSED');assert.equal(getterRan,false);
 for(const method of ['readProject','exportSource','getMetrics','constructor',null])assert.equal((await f.call(method,p)).code,'REQUEST_REFUSED');
 assert.equal(f.factories(),0);
});
test('Lock during pending edit suppresses successful disclosure and preserves the selected source',async()=>{
 const f=await fixture();let enter,release,used=false;const entered=new Promise(r=>{enter=r;}),gate=new Promise(r=>{release=r;});
 f.fault(async()=>{if(!used){used=true;enter();await gate;}});
 const pending=f.call('applyEdit',f.edit(f.a,'locked-edit','wrong'));let timer;
 try{await Promise.race([entered,new Promise((_r,reject)=>{timer=setTimeout(()=>reject(Error('Edit was refused before the owned write fault')),3000);})]);}finally{clearTimeout(timer);release();}
 f.lock();
 assert.equal((await pending).code,'ACCESS_REFUSED');assert.equal((await f.repository.getMetrics({projectId:f.project.project.id,sourceId:f.a.sourceId})).version,1);
 assert.deepEqual(await f.projects.readProject(f.project.project.id),f.project);
});
test('paused mutation requires the genuine frame drain ticket and seals an actual committed source',async()=>{
 const f=await fixture();f.owner.pause('native Lock');const grant=f.registry.capture(f.event(0)),nonce=f.owner.beginViewFlush(grant);
 const edit=f.edit(f.a,'drained-edit','X');assert.equal((await f.call('applyEdit',edit)).code,'WORKSPACE_PAUSED');
 assert.equal((await f.call('applyEdit',edit,0,{flushNonce:'copied-ticket'})).code,'FLUSH_REFUSED');
 const drafted=await f.call('applyEdit',edit,0,{flushNonce:nonce});assert.equal(drafted.ok,true);
 const saved=await f.call('commitSource',{sourceId:f.a.sourceId,operationId:'drained-commit',expectedVersion:2},0,{flushNonce:nonce});assert.equal(saved.ok,true);
 const sealed=await f.owner.finishViewFlush(f.registry.capture(f.event(0)),nonce);assert.equal(sealed.ok,true);assert.deepEqual(sealed.receipts,[drafted,saved]);
 assert.equal((await f.call('commitSource',{sourceId:f.a.sourceId,operationId:'drained-commit',expectedVersion:2},0,{flushNonce:nonce})).code,'FLUSH_REFUSED');
 assert.deepEqual(await f.projects.readProject(f.project.project.id),f.project);
});
