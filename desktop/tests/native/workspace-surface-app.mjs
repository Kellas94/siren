import {app,BrowserWindow,BaseWindow,WebContentsView,protocol,net,ipcMain} from 'electron';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {createWorkspaceSurface} from '../../src/windows/surface.mjs';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {SourceReadService} from '../../src/sources/read-ipc.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
import {resolveLocalResource} from '../../src/protocol.mjs';
const desktop=fileURLToPath(new URL('../../',import.meta.url));
const root=resolve(process.argv.find(v=>v.startsWith('--siren-surface-fixture='))?.slice('--siren-surface-fixture='.length)||'');
const rel=relative(join(desktop,'evidence/workspace-surface'),root);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('OWNED_SURFACE_FIXTURE_REQUIRED');
app.setPath('userData',join(root,'owned-profile'));app.on('window-all-closed',()=>{});
protocol.registerSchemesAsPrivileged([{scheme:'siren',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const hash=b=>createHash('sha256').update(b).digest('hex');
app.whenReady().then(async()=>{
 const result={status:'ADVERSE',pid:process.pid,scope:'Isolated native surface foundation: real Code editor and Docs draft model, exact renderer/frame/draft/undo preservation, native caller binding and confirmed async retirement. No production dock UI, common dirty save/Lock, restart, physical monitors or release qualification.',started:new Date().toISOString(),cases:[],versions:process.versions};
 const surfaces=[];let host,registry,owner,readers;
 const progress=()=>writeFile(join(root,'native-progress.json'),JSON.stringify(result,null,2));
 try{
  const prepared=JSON.parse(await readFile(join(root,'prepared.json'),'utf8')),data=join(root,'owned-data'),projectId=prepared.project.project.id;
  for(const [file,sha] of Object.entries(prepared.fixtureHashes))assert.equal(hash(await readFile(join(root,file))),sha);
  protocol.handle('siren',async request=>{try{return await net.fetch(pathToFileURL(await resolveLocalResource({url:request.url,rendererRoot:join(root,'generated')})).href);}catch{return new Response('Refused',{status:403});}});
  host=new BrowserWindow({show:false,width:1100,height:800,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});await host.loadURL('siren://app/app.html');
  registry=new WindowRegistry({authorize:()=>({projectId,mode:'normal',access:'write',entityIds:[prepared.a.sourceId,prepared.b.sourceId,'doc_a','doc_b']}),
   createWindow:async options=>{
    let surface;surface=createWorkspaceSurface({BaseWindow,WebContentsView,host,
     windowOptions:{width:900,height:700,title:'Owned '+options.role},webPreferences:{preload:join(root,'owned-preload.cjs')},
     isCurrent:()=>!!registry.caller({sender:surface.webContents,senderFrame:surface.webContents.mainFrame}),onFailure:error=>{result.surfaceFailure=error.code;}});
    surfaces.push(surface);const wc=surface.webContents;wc.setWindowOpenHandler(()=>({action:'deny'}));
    wc.on('will-navigate',event=>{if(event.url!==options.mainFrameUrl)event.preventDefault();});
    wc.on('will-frame-navigate',event=>{if(!event.isMainFrame||event.url!==options.mainFrameUrl)event.preventDefault();});wc.on('will-attach-webview',event=>event.preventDefault());
    await wc.loadURL(options.mainFrameUrl);return surface.window;
   }});
  registry.bindWorkspace(host);registry.activateWorkspace();
  const factory=({canWrite,readers})=>new SourceRepository(data,{canWrite,...(readers?{readers}:{})});
  owner=new WorkspaceCoordinator({registry,sources:factory,access:()=>true});readers=new SourceReadService({registry,repositoryFactory:factory,access:()=>true});
  ipcMain.handle('owned:fixture',async event=>{const grant=registry.capture(event);if(grant?.role!=='code'||!registry.isCurrent(grant))return {ok:false};return {...(grant.entityIds[0]===prepared.a.sourceId?prepared.a:prepared.b)};});
  ipcMain.handle('owned:document',event=>{const grant=registry.capture(event);if(grant?.role!=='docs'||!registry.isCurrent(grant))return {ok:false};
   const document=JSON.parse(prepared.project.json).workpapers.find(doc=>doc.id===grant.entityIds[0]);assert.ok(document);
   const sha256=hash(Buffer.from(JSON.stringify(document)));return {ok:true,document,readonly:false,sha256,version:sha256,projectRevision:prepared.project.revision};});
  ipcMain.handle('owned:source',(event,method,payload)=>['openRead','readChunk','closeRead'].includes(method)?readers.invoke({event,method,payload}):owner.invoke(registry.capture(event),{kind:'source',method,payload}));
  const views=[];for(const request of [{role:'code',entityId:prepared.a.sourceId},{role:'code',entityId:prepared.b.sourceId},{role:'docs',entityId:'doc_a'},{role:'docs',entityId:'doc_b'}])views.push(await registry.openView(request));
  const evaluate=(i,script)=>surfaces[i].webContents.executeJavaScript(script);
  const wait=async(i,script)=>{const deadline=Date.now()+15000;while(Date.now()<deadline){if(await evaluate(i,script))return;await new Promise(done=>setTimeout(done,25));}throw Error('OWNED_SURFACE_READY_TIMEOUT');};
  for(let i=0;i<4;i++){await evaluate(i,'owned.start()');surfaces[i].window.show();assert.equal(await evaluate(i,'typeof require'),'undefined');}
  for(let i=0;i<2;i++){assert.equal(surfaces[i].focus(),true);await evaluate(i,'owned.select(0)');await surfaces[i].webContents.insertText(i?'Second ':'First ');await wait(i,'owned.status().pending===0');await evaluate(i,'owned.select(2,5)');}
  for(let i=2;i<4;i++){await evaluate(i,`(()=>{const field=document.querySelector('textarea');field.value='Unsaved Docs ${i} 😀';field.dispatchEvent(new Event('input',{bubbles:true}));field.setSelectionRange(2,8);})()`);assert.equal((await evaluate(i,'owned.inspect()')).status.dirty,true);}
  result.cases.push({name:'two genuine Code editors and two Docs draft models start isolated and retain different working edits',status:'COMPLETE'});await progress();
  async function dataHashes(){const out={};async function walk(dir=''){for(const entry of await readdir(join(data,dir),{withFileTypes:true})){const file=dir?dir+'/'+entry.name:entry.name;if(entry.isDirectory())await walk(file);else if(entry.isFile())out[file]=hash(await readFile(join(data,file)));}}await walk();return out;}
  const beforeData=await dataHashes(),identities=[];
  for(let i=0;i<4;i++){
   const surface=surfaces[i],wc=surface.webContents,frame=wc.mainFrame,before=await evaluate(i,'owned.inspect()'),grant=registry.capture({sender:wc,senderFrame:frame});let navigation=0;
   const listener=()=>navigation++;wc.on('did-start-navigation',listener);
   for(let cycle=0;cycle<3;cycle++){
    assert.equal(surface.attach(),true);assert.equal(surface.focus(),true);assert.equal(host.contentView.children.includes(surface.view),true);assert.equal(surface.window.contentView.children.includes(surface.view),false);
    assert.equal(BrowserWindow.fromWebContents(wc),host);assert.equal(registry.isCurrent(grant),true);assert.equal(registry.caller({sender:wc,senderFrame:frame}).role,views[i].role);
    assert.equal(registry.caller({sender:wc,senderFrame:{url:frame.url}}),null);assert.deepEqual(await evaluate(i,'owned.inspect()'),before);
    assert.equal(surface.detach(),true);assert.equal(surface.focus(),true);assert.equal(surface.window.contentView.children.includes(surface.view),true);assert.equal(host.contentView.children.includes(surface.view),false);
    assert.equal(surface.webContents,wc);assert.equal(wc.mainFrame,frame);assert.deepEqual(await evaluate(i,'owned.inspect()'),before);
   }
   wc.off('did-start-navigation',listener);assert.equal(navigation,0);identities.push({role:views[i].role,webContentsId:wc.id,windowId:views[i].windowId,identity:before.identity,cycles:3,navigation});
  }
  assert.deepEqual(await dataHashes(),beforeData);assert.deepEqual(await new ProjectStore(data).readProject(projectId),prepared.project);
  result.cases.push({name:'12 actual attach/detach cycles preserve exact frame, identity, text, selection, draft state and on-disk data; native role remains scoped under the host',status:'COMPLETE',identities});await progress();
  for(let i=0;i<2;i++){
   const edited=(await evaluate(i,'owned.inspect()')).text;assert.equal(surfaces[i].attach(),true);
   await evaluate(i,'document.querySelector("[data-command=undo]").click()');await wait(i,'owned.status().pending===0');
   assert.equal((await evaluate(i,'owned.inspect()')).text,i?'def example():\n    return 42\n':'a😀b\r\nc');
   assert.equal(surfaces[i].detach(),true);await evaluate(i,'document.querySelector("[data-command=redo]").click()');await wait(i,'owned.status().pending===0');assert.equal((await evaluate(i,'owned.inspect()')).text,edited);
  }
  result.cases.push({name:'real Code undo after attaching and redo after detaching preserve both independent editor histories',status:'COMPLETE'});await progress();
  const self=surfaces[3],event={sender:self.webContents,senderFrame:self.webContents.mainFrame},caller=registry.caller(event);self.attach();
  assert.equal(await registry.closeView(views[3].windowId,{caller:event}),true);assert.equal(self.isDestroyed(),true);
  assert.equal(registry.confirmClosedCaller(event,caller),true);assert.equal(registry.confirmClosedCaller(event,caller),false);
  result.cases.push({name:'actual self-close confirms both renderer and shell destruction with a one-use native receipt',status:'COMPLETE'});await progress();
  const external=surfaces[2];external.attach();external.window.destroy();
  const rendererAliveAtShellClose=!external.webContents.isDestroyed();assert.equal(rendererAliveAtShellClose,true,'Probe must exercise the split native lifetimes');
  assert.throws(()=>registry.activateWorkspace(),error=>error.code==='ACCESS_REFUSED');
  assert.equal(host.contentView.children.includes(external.view),false);await external.dispose();
  assert.equal(external.isDestroyed(),true);
  result.cases.push({name:'direct native shell destruction retains/fences its still-alive renderer until actual disposal, with confidential view removed immediately',status:'COMPLETE',rendererAliveAtShellClose});await progress();
  surfaces[0].attach();surfaces[1].window.minimize();const old=registry.capture({sender:surfaces[0].webContents,senderFrame:surfaces[0].webContents.mainFrame});
  await registry.invalidateEpochAsync({preserveWorkspace:true});assert.equal(registry.isCurrent(old),false);assert.deepEqual(registry.listViews(),[]);
  assert.equal(host.contentView.children.length,0);for(const surface of surfaces)assert.equal(surface.isDestroyed(),true);
  assert.equal(BaseWindow.getAllWindows().length,1);assert.equal(host.isDestroyed(),false);assert.deepEqual(await new ProjectStore(data).readProject(projectId),prepared.project);
  result.cases.push({name:'awaited native epoch retirement removes attached and minimized views and proves every renderer and shell gone while preserving host and original Docs',status:'COMPLETE'});result.status='COMPLETE';
 }catch(error){result.error={message:error.message,code:error.code,stack:error.stack};}
 finally{
  readers?.dispose();
  for(const surface of surfaces)try{await surface.dispose();}catch(error){result.cleanupError=error.code;result.status='ADVERSE';}
  if(host&&!host.isDestroyed())host.destroy();result.remainingWindows=BaseWindow.getAllWindows().length;
  if(result.remainingWindows||result.surfaceFailure)result.status='ADVERSE';
  result.finished=new Date().toISOString();await writeFile(join(root,'native-result.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:result.status,cases:result.cases.length,error:result.error?.message}));app.exit(result.status==='COMPLETE'?0:1);
 }
});
