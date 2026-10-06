import {assertImportComplete} from '../src/projects/import-status.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
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
import {createHomeDocument,normalizeHomeDocument} from '../src/navigation/document-create.mjs';
import {commitManifest} from '../src/sources/manifest.mjs';
import {workspaceMetadata,workspaceEntities} from '../src/windows/entities.mjs';
import {atomicWrite} from '../src/projects/atomic.mjs';
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const between=(a,b)=>{const from=main.indexOf(a),to=main.indexOf(b,from);assert.ok(from>=0&&to>from,'Actual native document handler must exist');return main.slice(from,to);};
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'siren-home-native-document-')),projects=new ProjectStore(root),sources=new SourceRepository(root),recovery=new RecoveryStore(root,{sources});
 const made=await createHomeProjectCopy({root,label:'Native documents',isCurrent:()=>true,recovery});assert.equal(made.ok,true);const original=made.snapshot;await atomicWrite(join(root,'session-selection.json'),Buffer.from(JSON.stringify({schema:1,projectId:original.project.id,accountId:null})));
 const window=new EventEmitter(),wc=new EventEmitter();Object.assign(wc,{id:200,mainFrame:{url:'siren://app/home.html'},isDestroyed:()=>false,getURL:()=>wc.mainFrame.url,send(){}});Object.assign(window,{id:100,webContents:wc,isDestroyed:()=>false});let unlocked=true,prepared=0;
 const context=vm.createContext({assertImportComplete,dataRoot:root,writerOptions:{},join,Buffer,atomicWrite,projects,recovery,createHomeProjectCopy,createHomeDocument,window,bootstrap:{selectionGeneration:0},selectedId:original.project.id,snapshot:original,mode:'normal',nativeReadonly:false,reason:null,pinTransition:false,accountTransition:false,accountQuiesced:false,localPin:{state:()=>({unlocked})},writes:new Set(),grants:new Set([original.project.id]),account:{accountId:null,policy:{opened(){}}},nativeShellFailure:false,rollbackNativePreparation:async()=>{},prepareNativeWorkspace:async()=>{prepared++;}});
 class IPCRegistry extends WindowRegistry{activateWorkspace(options){return super.activateWorkspace(structuredClone(options));}}
 const registry=new IPCRegistry({createWindow:()=>assert.fail('Create document itself creates no satellite'),authorize:()=>unlocked?{projectId:context.selectedId,mode:'normal',access:'write',entityIds:Object.values(workspaceEntities(context.snapshot)).flat()}:null});registry.bindWorkspace(window);registry.activateWorkspace({entryUrl:'siren://app/home.html'});
 const authority=new HomeAuthority({workspace:window,state:()=>({projectId:context.selectedId,mode:context.mode,generation:context.bootstrap.selectionGeneration,unlocked})}),transitions=new HomeTransitionReceipts({registry,authority,projects}),handlers=new Map();
 Object.assign(context,{homeAuthority:authority,homeTransitions:transitions,windowRegistry:registry,retireNativeViews:()=>registry.invalidateEpoch({preserveWorkspace:true}),invokeHome:args=>invokeHome({...args,payload:structuredClone(args.payload)}),normalizeHomeDocument:input=>normalizeHomeDocument(structuredClone(input)),navigationFields:(input,...rest)=>navigationFields(structuredClone(input),...rest),ipcMain:{handle:(name,fn)=>handlers.set(name,fn)}});
 vm.runInContext(between('const selected = async (next,{isCurrent}={}) => {','const changeSelection =')+between('const selectHomeProject=',"ipcMain.handle('siren:home'")+between("ipcMain.handle('siren:home-document-create'","ipcMain.handle('siren:home-source-import'"),context);
 const event={sender:wc,senderFrame:wc.mainFrame};return {root,projects,sources,recovery,original,context,registry,event,prepared:()=>prepared,lock:()=>{unlocked=false;authority.invalidate();},call:(payload={title:'New notes Ș😀'},own=event)=>handlers.get('siren:home-document-create')(own,payload)};
}
test('actual native document handler prepares first and acknowledges durable same-project reselection with no new caller authority',async()=>{
 const f=await fixture(),result=await f.call();assert.equal(result.ok,true);assert.deepEqual(Object.keys(result).sort(),['epoch','ok']);assert.equal(f.prepared(),1);const pointer=JSON.parse(await readFile(join(f.root,'session-selection.json'))),saved=await f.projects.readProject(pointer.projectId),before=workspaceMetadata(f.original),after=workspaceMetadata(saved);
 assert.equal(saved.project.id,f.original.project.id);assert.deepEqual(f.context.snapshot,saved);assert.equal(f.context.bootstrap.selectionGeneration,1);assert.equal(saved.revision,f.original.revision+1);assert.deepEqual(after.workpapers.slice(0,-1),before.workpapers);assert.equal(after.workpapers.at(-1).title,'New notes Ș😀');assert.equal(await f.recovery.hasSavedSnapshot(saved),true);assert.ok(f.registry.capturePrimary(f.event));assert.equal(f.context.writes.selectionTransition,false);
});
test('forged frame, caller identities, locked or readonly mode refuse before preparation and manifest writes',async()=>{
 for(const kind of ['identity','frame','lock','readonly','invalid-title']){const f=await fixture();if(kind==='lock')f.lock();if(kind==='readonly')f.context.nativeReadonly=true;const result=await f.call(kind==='identity'?{title:'Injected',projectId:f.original.project.id}:kind==='invalid-title'?{title:'x'.repeat(161)}:undefined,kind==='frame'?{sender:f.event.sender,senderFrame:{...f.event.senderFrame}}:f.event);assert.equal(result.ok,false,kind);assert.equal(f.prepared(),0);assert.deepEqual(await f.projects.readProject(f.original.project.id),f.original);assert.equal(f.context.bootstrap.selectionGeneration,0);}
});
test('creation derives the genuinely saved post-preparation document rather than stale bootstrap content',async()=>{
 const f=await fixture();let saved;f.context.prepareNativeWorkspace=async()=>{const metadata=JSON.parse(f.original.json),workspace=workspaceMetadata(f.original);workspace.workpapers[0].title='Saved during preparation';metadata.storage['t-industries-siren-v23-state']=JSON.stringify(workspace);assert.equal((await commitManifest({projects:f.projects,repository:f.sources,recovery:f.recovery,projectId:f.original.project.id,baseRevision:f.original.revision,sourceRefs:[],metadata,operationId:'document-preparation'})).ok,true);saved=await f.projects.readProject(f.original.project.id);};
 assert.equal((await f.call()).ok,true);const final=await f.projects.readProject(f.original.project.id);assert.equal(final.revision,saved.revision+1);assert.equal(workspaceMetadata(final).workpapers[0].title,'Saved during preparation');assert.equal(workspaceMetadata(final).workpapers.length,2);
});
test('Lock at the actual document selector refuses selection and retains the complete original project',async()=>{
 const f=await fixture();f.context.writerOptions.fault=async phase=>{if(phase==='before-select')f.lock();};const result=await f.call();assert.equal(result.ok,false);assert.deepEqual(await f.projects.readProject(f.original.project.id),f.original);assert.equal(f.context.bootstrap.selectionGeneration,0);assert.equal(f.context.writes.selectionTransition,false);
});
