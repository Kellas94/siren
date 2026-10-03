import {app,BrowserWindow,protocol,net,ipcMain} from 'electron';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {nativeViewFactory} from '../../src/windows/factory.mjs';
import {invokeWindow} from '../../src/windows/ipc.mjs';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {invokeSourceMutation} from '../../src/windows/source-bridge.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {resolveLocalResource} from '../../src/protocol.mjs';

const desktop=fileURLToPath(new URL('../../',import.meta.url));
const root=resolve(process.argv.find(value=>value.startsWith('--siren-owner-fixture='))?.slice('--siren-owner-fixture='.length)||'');
const rel=relative(join(desktop,'evidence'),root);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('OWNED_SOURCE_OWNER_FIXTURE_REQUIRED');
app.setPath('userData',join(root,'owned-profile'));app.on('window-all-closed',()=>{});
protocol.registerSchemesAsPrivileged([{scheme:'siren',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.whenReady().then(async()=>{
  const result={status:'ADVERSE',pid:process.pid,started:new Date().toISOString(),cases:[],nativeReceipts:[],versions:process.versions};let registry,coordinator;
  const progress=()=>writeFile(join(root,'native-progress.json'),JSON.stringify(result,null,2));
  try {
    const prepared=JSON.parse(await readFile(join(root,'prepared.json'),'utf8')),data=join(root,'owned-data'),repo=new SourceRepository(data),project=prepared.project,windows=[];
    protocol.handle('siren',async request=>{try{return await net.fetch(pathToFileURL(await resolveLocalResource({url:request.url,rendererRoot:join(root,'generated')})).href);}catch{return new Response('Refused',{status:403});}});
    const factory=nativeViewFactory({BrowserWindow,displays:()=>[{id:1,primary:true,workArea:{x:0,y:0,width:1200,height:800}}],preload:join(root,'owned-preload.cjs'),onCreated:window=>windows.push(window)});
    registry=new WindowRegistry({createWindow:factory,authorize:()=>({projectId:project.project.id,mode:'normal',access:'write',entityIds:[prepared.a.sourceId,prepared.b.sourceId]})});
    let fault=async()=>{};
    coordinator=new WorkspaceCoordinator({registry,access:()=>true,sources:({canWrite})=>new SourceRepository(data,{canWrite,fault:phase=>fault(phase)})});
    ipcMain.handle('siren:windows',(event,method,payload)=>invokeWindow({event,method,payload,registry}));
    ipcMain.handle('siren:owned-source-intent',async(event,intent)=>{
      const receipt=await invokeSourceMutation({event,method:intent?.method,payload:intent?.payload,registry,owner:coordinator,canEdit:()=>true});
      result.nativeReceipts.push({operationId:intent?.payload?.operationId,receipt});return receipt;
    });
    await registry.openView({role:'code',entityId:prepared.a.sourceId});await registry.openView({role:'code',entityId:prepared.b.sourceId});await registry.openView({role:'code',entityId:prepared.a.sourceId});
    const grants=windows.map(window=>registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame}));
    const notices=[[],[],[]];for(let index=0;index<3;index++)coordinator.subscribe(grants[index],index===1?prepared.b.sourceId:prepared.a.sourceId,receipt=>notices[index].push(receipt));
    const intent=(ref,operationId,insertedText)=>({kind:'source',method:'applyEdit',payload:{sourceId:ref.sourceId,expectedVersion:ref.version,operationId,start:0,end:1,insertedText}});
    const invoke=(index,input)=>windows[index].webContents.executeJavaScript(`window.sirenOwnedSource.invoke(${JSON.stringify(input)})`);
    const [first,second]=await Promise.all([invoke(0,intent(prepared.a,'native-edit-a','X')),invoke(1,intent(prepared.b,'native-edit-b','Y'))]);
    assert.equal(first.ok,true);assert.equal(second.ok,true);
    assert.deepEqual(await repo.exportSource({projectId:project.project.id,sourceId:prepared.a.sourceId,version:2}),Buffer.from('X😀b\r\nc'));
    assert.deepEqual(await repo.exportSource({projectId:project.project.id,sourceId:prepared.b.sourceId,version:2}),Buffer.from('Yecond source\n'));
    assert.equal(notices[0].length,1);assert.equal(notices[1].length,1);assert.equal(notices[2].length,1);assert.equal(notices[0][0].sourceId,prepared.a.sourceId);assert.deepEqual(notices[2],notices[0]);assert.equal('text' in notices[0][0],false);
    result.cases.push({name:'three actual native senders preserve independent sources and same-source scoped receipts',status:'COMPLETE'});
    await progress();
    assert.equal((await invoke(2,intent(prepared.a,'native-stale-a','wrong'))).code,'REVISION_CONFLICT');assert.deepEqual(await invoke(0,intent(prepared.a,'native-edit-a','X')),first);
    assert.equal((await invoke(0,intent(prepared.b,'native-foreign-b','wrong'))).code,'ACCESS_REFUSED');
    result.cases.push({name:'real IPC stale duplicate and foreign-entity refusal',status:'COMPLETE'});
    await progress();
    let enter,release,held=false;const entered=new Promise(resolve=>{enter=resolve;});fault=async()=>{if(!held){held=true;enter();await new Promise(resolve=>{release=resolve;});}};
    const pending=invoke(0,intent({...prepared.a,version:2},'native-in-flight','Z'));await entered;coordinator.pause('home');
    assert.equal((await invoke(1,intent({...prepared.b,version:2},'native-late','Q'))).code,'WORKSPACE_PAUSED');const draining=coordinator.drain();release();const third=await pending;assert.equal(third.ok,true);assert.deepEqual(await draining,[third]);coordinator.resume();fault=async()=>{};
    const committed=await invoke(0,{kind:'source',method:'commitSource',payload:{sourceId:prepared.a.sourceId,expectedVersion:3,operationId:'native-source-commit'}});assert.equal(committed.ok,true);assert.equal(committed.durability,'committed');
    assert.deepEqual(await new ProjectStore(data).readProject(project.project.id),project);
    result.cases.push({name:'pause drains actual pending write and explicit source commit leaves Docs untouched',status:'COMPLETE'});
    await progress();
    held=false;const revokedEntered=new Promise(resolve=>{enter=resolve;});fault=async()=>{if(!held){held=true;enter();await new Promise(resolve=>{release=resolve;});}};
    const revoked=invoke(0,intent({...prepared.a,version:3},'native-revoked','wrong')).then(value=>({value}),cause=>({rendererRefused:cause.message}));await revokedEntered;
    const beforeNotices=notices.map(items=>items.length),retiredContents=windows[0].webContents;registry.invalidateEpoch();const finalDrain=coordinator.drain();release();
    assert.equal((await finalDrain)[0].code,'ACCESS_REFUSED');
    // A destroyed renderer has no live Promise consumer. Native disposal and
    // guarded disk receipts are the oracle, not awaiting that retired frame.
    const retiredReply=await Promise.race([revoked,new Promise(resolve=>setImmediate(()=>resolve({retiredFrame:true})))]);
    assert.equal(windows[0].isDestroyed(),true);assert.equal(retiredContents.isDestroyed(),true);
    if(retiredReply.value)assert.notEqual(retiredReply.value.ok,true);
    result.retiredRendererReply=retiredReply;
    assert.equal(result.nativeReceipts.at(-1).receipt.code,'ACCESS_REFUSED');assert.deepEqual(notices.map(items=>items.length),beforeNotices);
    assert.equal((await repo.getMetrics({projectId:project.project.id,sourceId:prepared.a.sourceId})).version,3);
    assert.deepEqual(await repo.exportSource({projectId:project.project.id,sourceId:prepared.a.sourceId,version:3}),Buffer.from('Z😀b\r\nc'));
    assert.deepEqual(await new ProjectStore(data).readProject(project.project.id),project);assert.equal(BrowserWindow.getAllWindows().length,0);
    result.cases.push({name:'actual renderer retirement suppresses late write selection notifications and success',status:'COMPLETE'});result.status='COMPLETE';
  } catch(cause){result.error={message:cause.message,code:cause.code,stack:cause.stack};}
  finally {
    try{registry?.invalidateEpoch();}catch{}
    for(const window of BrowserWindow.getAllWindows())try{window.destroy();}catch{}
    result.remainingWindows=BrowserWindow.getAllWindows().length;result.finished=new Date().toISOString();await writeFile(join(root,'native-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,error:result.error?.message}));app.exit(result.status==='COMPLETE'&&result.remainingWindows===0?0:1);
  }
});
