import {app,BrowserWindow,protocol,net,ipcMain} from 'electron';
import {readFile,writeFile} from 'node:fs/promises';
import {join,resolve,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {WorkspaceCoordinator} from '../../src/windows/coordinator.mjs';
import {NativeViewControl} from '../../src/windows/control.mjs';
import {NativeWorkspaceBarrier} from '../../src/windows/source-barrier.mjs';
import {DomainRepository} from '../../src/windows/domain.mjs';
import {createImportValidator} from '../../src/projects/import-validator-window.mjs';
import {SourceRepository} from '../../src/sources/repository.mjs';
import {ProjectStore} from '../../src/projects/store.mjs';
const desktop=fileURLToPath(new URL('../../',import.meta.url)),root=resolve(process.argv.find(v=>v.startsWith('--siren-domain-fixture='))?.slice('--siren-domain-fixture='.length)||'');
const rel=relative(join(desktop,'evidence/domain-workspaces'),root);if(!rel||rel.startsWith('..')||isAbsolute(rel))throw Error('OWNED_DOMAIN_FIXTURE_REQUIRED');
app.setPath('userData',join(root,'owned-profile'));app.on('window-all-closed',()=>{});
protocol.registerSchemesAsPrivileged([{scheme:'siren',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
const hash=b=>createHash('sha256').update(b).digest('hex');
app.whenReady().then(async()=>{
 const result={status:'ADVERSE',pid:process.pid,scope:'Isolated native domain service, real frozen validators and four protocol fixtures; no production editor, primary workspace, Lock or physical monitors',started:new Date().toISOString(),cases:[],versions:process.versions};let registry,owner,control,barrier,validator;
 const progress=()=>writeFile(join(root,'native-progress.json'),JSON.stringify(result,null,2));
 try{
  const prepared=JSON.parse(await readFile(join(root,'prepared.json'),'utf8')),data=join(root,'owned-data'),projectId=prepared.project.project.id,windows=[];
  for(const role of ['docs','diagram'])assert.equal(hash(await readFile(join(root,'generated/windows/'+role+'.html'))),prepared.htmlSHA256);
  assert.equal(hash(await readFile(join(root,'owned-preload.cjs'))),prepared.preloadSHA256);
  protocol.handle('siren',async request=>{const url=new URL(request.url);if(url.hostname!=='app'||!['/windows/docs.html','/windows/diagram.html'].includes(url.pathname))return new Response('Refused',{status:403});return net.fetch(pathToFileURL(join(root,'generated',url.pathname.slice(1))).href);});
  // This finite owned factory qualifies the registry/domain protocol only. The
  // production factory does not yet admit Diagram and is not represented here.
  registry=new WindowRegistry({authorize:()=>({projectId,mode:'normal',access:'write',entityIds:['doc-a','doc-b','diagram-a','diagram-b']}),createWindow:async record=>{const window=new BrowserWindow({show:false,width:900,height:600,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,preload:join(root,'owned-preload.cjs')}});window.webContents.setWindowOpenHandler(()=>({action:'deny'}));await window.loadURL(record.mainFrameUrl);windows.push(window);return window;}});
  validator=await createImportValidator({BrowserWindow,entryPath:join(root,'validator/import-validation.html'),entrySha256:prepared.build.entrySha256});
  let fault=async()=>{};
  const domains=new DomainRepository({projects:({canWrite})=>new ProjectStore(data,{canSave:canWrite,fault:p=>fault(p)}),sources:({canWrite})=>new SourceRepository(data,{canWrite}),validatePatch:input=>validator.validatePatch(input)});
  owner=new WorkspaceCoordinator({registry,domains,sources:({canWrite})=>new SourceRepository(data,{canWrite}),access:()=>true});
  control=new NativeViewControl({registry,owner,send:(event,request)=>event.sender.send('owned:prepare',request)});
  ipcMain.handle('owned:intent',(event,intent,nonce)=>owner.invoke(registry.capture(event),intent,nonce));
  ipcMain.handle('owned:ack',(event,input)=>control.acknowledge(event,input));
  ipcMain.handle('owned:read',event=>{const grant=registry.capture(event);return owner.invoke(grant,{kind:grant.role,method:grant.role==='docs'?'readDocument':'readDiagram',payload:{entityId:grant.entityIds[0]}});});
  for(const [role,entityId] of [['docs','doc-a'],['docs','doc-b'],['diagram','diagram-a'],['diagram','diagram-b']])await registry.openView({role,entityId});
  const evaluate=(i,code)=>windows[i].webContents.executeJavaScript(code),edit=(i,action,payload,operation)=>evaluate(i,`owned.edit(${JSON.stringify(action)},${JSON.stringify(payload)},${JSON.stringify(operation)})`);
  for(let i=0;i<4;i++)await evaluate(i,'owned.start()');
  const original=JSON.parse(prepared.project.json);
  const docs=await Promise.all([edit(0,'rename',{title:'Exact Docs A'},'rename-a'),edit(1,'rename',{title:'Exact Docs B'},'rename-b')]);assert.equal(docs.every(x=>x.ok),true);
  const sources=['flowchart TD\nA[Exact 😀]-->C\nstyle A fill:#ff0000','sequenceDiagram\nA->>B: Exact after'];
  const diagrams=await Promise.all(sources.map((source,i)=>edit(i+2,'replace-source',{source},'source-'+i)));assert.equal(diagrams.every(x=>x.ok),true);
  let selected=await new ProjectStore(data).readProject(projectId),workspace=JSON.parse(selected.json);
  assert.deepEqual(workspace.diagrams.map(x=>x.source),sources);assert.deepEqual(workspace.workpapers.map(x=>x.title),['Exact Docs A','Exact Docs B']);
  for(let i=0;i<2;i++){assert.deepEqual(workspace.workpapers[i].blocks,original.workpapers[i].blocks);assert.deepEqual(workspace.workpapers[i].agent,original.workpapers[i].agent);assert.deepEqual(workspace.workpapers[i].releases,original.workpapers[i].releases);}
  assert.deepEqual(workspace.diagrams[0].nodeStyles,original.diagrams[0].nodeStyles);assert.deepEqual(workspace.diagrams[0].future,original.diagrams[0].future);assert.deepEqual(selected.sourceRefs,prepared.project.sourceRefs);
  assert.deepEqual(await new SourceRepository(data).exportSource({projectId,sourceId:prepared.source.sourceId,version:1}),Buffer.from('print("😀")\r\n'));
  result.cases.push({name:'four real scoped frames preserve concurrent Docs and Diagram changes, colors, source bytes and imported provenance',status:'COMPLETE'});await progress();
  const request={kind:'diagram',method:'applyDiagram',payload:{diagramId:'diagram-a',operationId:'stale-diagram',expectedVersion:1,action:'replace-source',payload:{source:'wrong'}}};
  assert.equal((await evaluate(2,`owned.invoke(${JSON.stringify(request)})`)).code,'REVISION_CONFLICT');assert.equal((await evaluate(3,`owned.invoke(${JSON.stringify({...request,payload:{...request.payload,expectedVersion:2}})})`)).code,'ACCESS_REFUSED');
  const bad={...request,payload:{...request.payload,operationId:'bad-style',expectedVersion:2,action:'update-style',payload:{fontSize:500}}};assert.equal((await evaluate(2,`owned.invoke(${JSON.stringify(bad)})`)).code,'DOMAIN_VALIDATION_FAILED');
  const validStyle=await edit(2,'update-style',{fontSize:18},'valid-style');assert.equal(validStyle.ok,true);
  const blocks=[...original.workpapers[0].blocks,{id:'new-paragraph',kind:'text',html:'<p>Exact documentation 😀</p>'}];assert.equal((await edit(0,'replace-blocks',{blocks},'new-block')).ok,true);
  selected=await new ProjectStore(data).readProject(projectId);workspace=JSON.parse(selected.json);assert.deepEqual(workspace.workpapers[0].blocks,blocks);
  result.cases.push({name:'actual frozen semantic validation accepts exact edits and refuses stale, foreign or invalid style requests',status:'COMPLETE'});await progress();
  windows[3].minimize();assert.equal(windows[3].isMinimized(),true);
  barrier=new NativeWorkspaceBarrier({registry,owner,control,cover:grant=>registry.eventFor(grant).sender.send('owned:cover')});
  const preparedRoster=await barrier.prepare('owned-domain-roster');assert.equal(preparedRoster.ok,true);assert.equal(preparedRoster.proof.refs.length,4);assert.equal(barrier.isPrepared(preparedRoster.proof),true);
  for(let i=0;i<4;i++){assert.equal(await evaluate(i,'owned.paused'),true);assert.equal(await evaluate(i,'document.querySelector("textarea").disabled'),true);assert.equal(await evaluate(i,'document.body.dataset.covered'),'true');}
  assert.equal(barrier.isPrepared({...preparedRoster.proof}),false);await assert.rejects(registry.openView({role:'diagram',entityId:'diagram-a'}),{code:'ROSTER_FROZEN'});
  assert.equal(barrier.release(preparedRoster.proof),true);for(let i=0;i<4;i++)assert.equal(await evaluate(i,'owned.resume()'),true);barrier.dispose();barrier=null;
  assert.deepEqual(await new ProjectStore(data).readProject(projectId),selected);
  result.cases.push({name:'all four native frames including minimized Diagram seal and reconcile the latest saved versions',status:'COMPLETE',refs:preparedRoster.proof.refs});await progress();
  let enter,release;const entered=new Promise(resolve=>enter=resolve),gate=new Promise(resolve=>release=resolve);fault=async phase=>{if(phase==='before-select'){enter();await gate;throw Object.assign(Error('Owned durable refusal'),{code:'MANIFEST_WRITE_FAILED'});}};
  const pending=edit(1,'rename',{title:'Retained unsaved draft'},'failed-draft');await entered;
  barrier=new NativeWorkspaceBarrier({registry,owner,control,cover:grant=>registry.eventFor(grant).sender.send('owned:cover')});const preparing=barrier.prepare('owned-domain-failure');release();assert.equal((await pending).ok,false);assert.equal((await preparing).ok,false);
  assert.equal(await evaluate(1,'owned.dirty'),true);assert.equal(await evaluate(1,'document.querySelector("textarea").value.includes("Retained unsaved draft")'),true);assert.equal(await evaluate(1,'owned.resume()'),false);
  assert.deepEqual(await new ProjectStore(data).readProject(projectId),selected);assert.equal(registry.listViews().length,4);assert.equal(await evaluate(0,'owned.paused'),true);
  result.cases.push({name:'real durable write refusal retains the local draft and selected originals and refuses the entire roster',status:'COMPLETE'});result.status='COMPLETE';
 }catch(cause){result.error={message:cause.message,code:cause.code,stack:cause.stack};}
 finally{try{barrier?.dispose();control?.dispose();registry?.invalidateEpoch();await validator?.dispose();}catch(cause){result.cleanupError=cause.message;result.status='ADVERSE';}for(const window of BrowserWindow.getAllWindows())try{window.destroy();}catch{}result.remainingWindows=BrowserWindow.getAllWindows().length;result.finished=new Date().toISOString();await writeFile(join(root,'native-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,error:result.error?.message,remainingWindows:result.remainingWindows}));app.exit(result.status==='COMPLETE'&&result.remainingWindows===0?0:1);}
});

