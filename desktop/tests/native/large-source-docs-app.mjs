import {app,BrowserWindow,protocol,net,ipcMain} from 'electron';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {nativeViewFactory} from '../../src/windows/factory.mjs';
import {invokeWindow} from '../../src/windows/ipc.mjs';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {DocsLinkService,documentVersion} from '../../src/windows/docs.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {resolveLocalResource} from '../../src/protocol.mjs';

const desktop=fileURLToPath(new URL('../../',import.meta.url));
const root=resolve(process.argv.find(value=>value.startsWith('--siren-docs-fixture='))?.slice('--siren-docs-fixture='.length)||'');
const rel=relative(join(desktop,'evidence/large-source-docs'),root);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('OWNED_DOCS_FIXTURE_REQUIRED');
app.setPath('userData',join(root,'owned-profile'));app.on('window-all-closed',()=>{});
protocol.registerSchemesAsPrivileged([{scheme:'siren',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.whenReady().then(async()=>{
  const result={status:'ADVERSE',pid:process.pid,started:new Date().toISOString(),cases:[],versions:process.versions};let registry;
  const progress=()=>writeFile(join(root,'native-progress.json'),JSON.stringify(result,null,2));
  try {
    const prepared=JSON.parse(await readFile(join(root,'prepared.json'),'utf8')),data=join(root,'owned-data'),projectId=prepared.project.project.id,repo=new SourceRepository(data),windows=[];
    protocol.handle('siren',async request=>{try{return await net.fetch(pathToFileURL(await resolveLocalResource({url:request.url,rendererRoot:join(root,'generated')})).href);}catch{return new Response('Refused',{status:403});}});
    const factory=nativeViewFactory({BrowserWindow,displays:()=>[{id:1,primary:true,workArea:{x:0,y:0,width:1200,height:800}}],preload:join(root,'owned-preload.cjs'),onCreated:window=>windows.push(window)});
    registry=new WindowRegistry({createWindow:factory,authorize:()=>({projectId,mode:'normal',access:'write',entityIds:[prepared.ref.sourceId,'doc-a','doc-b']})});
    let fault=async()=>{};
    const docs=new DocsLinkService({projects:({canWrite})=>new ProjectStore(data,{canSave:canWrite,fault:phase=>fault(phase)}),sources:({canWrite})=>new SourceRepository(data,{canWrite})});
    const coordinator=new WorkspaceCoordinator({registry,docs,access:()=>true,sources:({canWrite})=>new SourceRepository(data,{canWrite})});
    ipcMain.handle('siren:windows',(event,method,payload)=>invokeWindow({event,method,payload,registry}));
    ipcMain.handle('siren:owned-docs-intent',(event,intent)=>coordinator.invoke(registry.capture(event),intent));
    for(const [role,entityId] of [['code',prepared.ref.sourceId],['code',prepared.ref.sourceId],['docs','doc-a'],['docs','doc-b']])await registry.openView({role,entityId});
    const invoke=(index,input)=>windows[index].webContents.executeJavaScript(`window.sirenOwnedIntent.invoke(${JSON.stringify(input)})`);
    const edited=await invoke(0,{kind:'source',method:'applyEdit',payload:{sourceId:prepared.ref.sourceId,expectedVersion:1,operationId:'edit-native',start:0,end:5,insertedText:'hello'}});
    assert.equal(edited.ok,true);assert.equal(edited.durability,'draft');
    const link=(id,sourceReceipt,operationId='link-'+id,version=documentVersion(prepared.project,id))=>({kind:'docs',method:'commitCodeToDocs',payload:{documentId:id,rowId:'row-a',operationId,expectedDocumentVersion:version,sourceReceipt}});
    assert.equal((await invoke(0,link('doc-a',{...edited,durability:'committed'}))).code,'UNKNOWN_COMMIT');
    assert.deepEqual(await new ProjectStore(data).readProject(projectId),prepared.project);
    const sourceReceipt=await invoke(0,{kind:'source',method:'commitSource',payload:{sourceId:prepared.ref.sourceId,expectedVersion:2,operationId:'save-native'}});
    assert.equal(sourceReceipt.durability,'committed');
    result.cases.push({name:'native draft cannot masquerade as explicit committed source',status:'COMPLETE'});await progress();
    const notices=[[],[]];for(let index=0;index<2;index++)coordinator.subscribe(registry.capture({sender:windows[index+2].webContents,senderFrame:windows[index+2].webContents.mainFrame}),'doc-'+(index?'b':'a'),receipt=>notices[index].push(receipt));
    const [a,b]=await Promise.all([invoke(0,link('doc-a',sourceReceipt)),invoke(1,link('doc-b',sourceReceipt))]);
    assert.equal(a.ok,true);assert.equal(b.ok,true);assert.equal(a.projectRevision,3);assert.equal(b.projectRevision,4);
    assert.equal(notices[0].length,1);assert.equal(notices[1].length,1);assert.equal(JSON.stringify(notices).includes('hello'),false);
    const saved=await new ProjectStore(data).readProject(projectId),metadata=JSON.parse(saved.json),original=JSON.parse(prepared.project.json);
    for(let index=0;index<2;index++) {
      assert.equal(metadata.workpapers[index].blocks[0].rows[0].sourceRef.version,2);
      assert.deepEqual(metadata.workpapers[index].agent,original.workpapers[index].agent);
      assert.deepEqual(metadata.workpapers[index].releases,original.workpapers[index].releases);
      assert.equal(metadata.workpapers[index].blocks[0].rows[0].title,'Exact preserved title');
    }
    assert.deepEqual(await new SourceRepository(data).exportSource({projectId,sourceId:prepared.ref.sourceId,version:2}),Buffer.from('hello("😀")\r\n'));
    result.cases.push({name:'two Code and two Docs native windows retain concurrent explicit links and independent bytes',status:'COMPLETE'});await progress();
    assert.deepEqual(await invoke(0,link('doc-a',sourceReceipt)),a);
    assert.equal((await invoke(1,link('doc-a',sourceReceipt,'stale-native'))).code,'DOCUMENT_CONFLICT');
    assert.equal((await invoke(2,link('doc-b',sourceReceipt))).code,'ACCESS_REFUSED');
    assert.deepEqual(await new ProjectStore(data).readProject(projectId),saved);
    result.cases.push({name:'native historical duplicate stale-content and foreign-document guards',status:'COMPLETE'});await progress();
    const counts=notices.map(value=>value.length);
    // Retire access synchronously during the actual durable publication hook.
    fault=async phase=>{if(phase==='before-select')registry.invalidateEpoch();};
    const grant=registry.capture({sender:windows[0].webContents,senderFrame:windows[0].webContents.mainFrame});
    const retired=await coordinator.invoke(grant,link('doc-b',sourceReceipt,'revoked-native',documentVersion(saved,'doc-b')));
    assert.equal(retired.code,'ACCESS_REFUSED');assert.deepEqual(notices.map(value=>value.length),counts);
    assert.deepEqual(await new ProjectStore(data).readProject(projectId),saved);assert.equal(BrowserWindow.getAllWindows().length,0);
    result.cases.push({name:'retired native views cannot publish a late linked Docs selection or notice',status:'COMPLETE'});result.status='COMPLETE';
  }catch(cause){result.error={message:cause.message,code:cause.code,stack:cause.stack};}
  finally {
    try{registry?.invalidateEpoch();}catch{}
    for(const window of BrowserWindow.getAllWindows())try{window.destroy();}catch{}
    result.remainingWindows=BrowserWindow.getAllWindows().length;result.finished=new Date().toISOString();await writeFile(join(root,'native-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,error:result.error?.message}));app.exit(result.status==='COMPLETE'&&result.remainingWindows===0?0:1);
  }
});
