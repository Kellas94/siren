import {assertImportComplete} from '../src/projects/import-status.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {mkdir,readFile,writeFile,realpath,readdir} from 'node:fs/promises';
import {join,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {HomeAuthority} from '../src/navigation/authority.mjs';
import {HomeTransitionReceipts} from '../src/navigation/transition-receipts.mjs';
import {invokeHome} from '../src/navigation/ipc.mjs';
import {navigationFields} from '../src/navigation/contracts.mjs';
import {createHomeProjectCopy} from '../src/navigation/project-copies.mjs';
import {importHomeSource} from '../src/navigation/source-import.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {workspaceMetadata,workspaceEntities} from '../src/windows/entities.mjs';
import {atomicWrite} from '../src/projects/atomic.mjs';
import {readOwnedBytes} from '../src/projects/io.mjs';
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const between=(a,b)=>{const from=main.indexOf(a),to=main.indexOf(b,from);assert.ok(from>=0&&to>from);return main.slice(from,to);};
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'siren-home-native-import-')),projects=new ProjectStore(root),sources=new SourceRepository(root),recovery=new RecoveryStore(root,{sources});
 const made=await createHomeProjectCopy({root,label:'Native import',isCurrent:()=>true,recovery});assert.equal(made.ok,true);const original=made.snapshot,file=join(root,'actual Ș😀.py'),bytes=Buffer.from('\uFEFFdef context():\r\n    return "Ș😀"\r\n');await writeFile(file,bytes);await atomicWrite(join(root,'session-selection.json'),Buffer.from(JSON.stringify({schema:1,projectId:original.project.id,accountId:null})));
 const window=new EventEmitter(),wc=new EventEmitter();Object.assign(wc,{id:200,mainFrame:{url:'siren://app/home.html'},isDestroyed:()=>false,getURL:()=>wc.mainFrame.url,send(){}});Object.assign(window,{id:100,webContents:wc,isDestroyed:()=>false});let unlocked=true,prepared=0;
 const context=vm.createContext({assertImportComplete,dataRoot:root,writerOptions:{},join,basename,Buffer,atomicWrite,readOwnedBytes,realpath,projects,recovery,createHomeProjectCopy,importHomeSource,window,bootstrap:{selectionGeneration:0},selectedId:original.project.id,snapshot:original,mode:'normal',nativeReadonly:false,reason:null,pinTransition:false,accountTransition:false,accountQuiesced:false,localPin:{state:()=>({unlocked})},writes:new Set(),grants:new Set([original.project.id]),account:{accountId:null,policy:{opened(){}}},nativeShellFailure:false,rollbackNativePreparation:async()=>{},prepareNativeWorkspace:async()=>{prepared++;}});
 class IPCRegistry extends WindowRegistry{activateWorkspace(options){return super.activateWorkspace(structuredClone(options));}}
 const registry=new IPCRegistry({createWindow:()=>assert.fail('Import creates no satellite directly'),authorize:()=>unlocked?{projectId:context.selectedId,mode:'normal',access:'write',entityIds:Object.values(workspaceEntities(context.snapshot)).flat()}:null});registry.bindWorkspace(window);registry.activateWorkspace({entryUrl:'siren://app/home.html'});
 const authority=new HomeAuthority({workspace:window,state:()=>({projectId:context.selectedId,mode:context.mode,generation:context.bootstrap.selectionGeneration,unlocked})}),transitions=new HomeTransitionReceipts({registry,authority,projects}),handlers=new Map();
 Object.assign(context,{homeAuthority:authority,homeTransitions:transitions,windowRegistry:registry,retireNativeViews:()=>registry.invalidateEpoch({preserveWorkspace:true}),invokeHome:args=>invokeHome({...args,payload:structuredClone(args.payload)}),navigationFields:(input,...rest)=>navigationFields(structuredClone(input),...rest),dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[file]})},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)}});
 vm.runInContext(between('const selected = async (next,{isCurrent}={}) => {','const changeSelection =')+between('const selectHomeProject=',"ipcMain.handle('siren:home'")+between("ipcMain.handle('siren:home-source-import'","ipcMain.handle('siren:home-convert'"),context);
 const event={sender:wc,senderFrame:wc.mainFrame};return {root,projects,sources,recovery,original,bytes,file,context,registry,event,prepared:()=>prepared,lock:()=>{unlocked=false;authority.invalidate();},call:(payload={},own=event)=>handlers.get('siren:home-source-import')(own,payload)};
}
test('actual native import handler reads only a chosen owned file, prepares before mutation and acknowledges genuine durable same-project reselection without source disclosure',async()=>{
 const f=await fixture(),result=await f.call();assert.equal(result.ok,true);assert.deepEqual(Object.keys(result).sort(),['epoch','ok']);assert.equal(f.prepared(),1);
 const pointer=JSON.parse(await readFile(join(f.root,'session-selection.json'))),saved=await f.projects.readProject(pointer.projectId);assert.equal(saved.project.id,f.original.project.id);assert.deepEqual(f.context.snapshot,saved);assert.equal(f.context.bootstrap.selectionGeneration,1);assert.equal(saved.revision,f.original.revision+1);const file=workspaceMetadata(saved).codeFiles[0];assert.equal(file.name,'actual Ș😀.py');assert.deepEqual(await f.sources.exportSource({projectId:saved.project.id,...file.sourceRef}),f.bytes);assert.deepEqual(await readFile(f.file),f.bytes);assert.equal(await f.recovery.hasSavedSnapshot(saved),true);assert.ok(f.registry.capturePrimary(f.event));assert.equal(f.context.writes.selectionTransition,false);
});
test('Cancel, caller paths/identities, forged frames and Lock during native chooser perform no writes or selection',async()=>{
 for(const kind of ['cancel','path','snapshot','frame','lock']){const f=await fixture(),before=await readdir(join(f.root,'Projects'));if(kind==='cancel')f.context.dialog.showOpenDialog=async()=>({canceled:true});if(kind==='lock')f.context.dialog.showOpenDialog=async()=>{f.lock();return {canceled:false,filePaths:[f.file]};};
  const result=await f.call(kind==='path'?{path:f.file}:kind==='snapshot'?{snapshot:f.original}:{},kind==='frame'?{sender:f.event.sender,senderFrame:{...f.event.senderFrame}}:f.event);assert.equal(result.ok,false,kind);assert.equal(f.prepared(),0);assert.deepEqual(await f.projects.readProject(f.original.project.id),f.original);assert.deepEqual(await readdir(join(f.root,'Projects')),before);assert.equal(f.context.bootstrap.selectionGeneration,0);}
});
test('actual import reads the post-preparation revision and preserves content genuinely saved before quiescence',async()=>{
 const f=await fixture();let saved;
 f.context.prepareNativeWorkspace=async()=>{const metadata=JSON.parse(f.original.json),workspace=workspaceMetadata(f.original);workspace.workpapers[0].title='Saved during preparation';metadata.storage['t-industries-siren-v23-state']=JSON.stringify(workspace);assert.equal((await commitManifest({projects:f.projects,repository:f.sources,recovery:f.recovery,projectId:f.original.project.id,baseRevision:f.original.revision,sourceRefs:[],metadata,operationId:'prepared-content'})).ok,true);saved=await f.projects.readProject(f.original.project.id);};
 assert.equal((await f.call()).ok,true);const final=await f.projects.readProject(f.original.project.id);assert.equal(final.revision,saved.revision+1);assert.equal(workspaceMetadata(final).workpapers[0].title,'Saved during preparation');assert.equal(workspaceMetadata(final).codeFiles.length,1);
});
test('frame retirement during source extraction refuses both manifest and native acknowledgement and retains complete selected data',async()=>{
 const f=await fixture();f.context.writerOptions={fault:async phase=>{if(phase==='source-blob-verified')f.context.window.webContents.mainFrame={url:'siren://app/home.html'};}};const result=await f.call();assert.equal(result.ok,false);assert.deepEqual(await f.projects.readProject(f.original.project.id),f.original);assert.equal(f.context.bootstrap.selectionGeneration,0);assert.equal(f.context.writes.selectionTransition,false);assert.equal(f.context.writes.selectionQuiesced,false);
});
