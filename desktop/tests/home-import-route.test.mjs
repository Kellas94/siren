import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {join,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdir,readFile,writeFile,realpath} from 'node:fs/promises';
import {mkdtemp} from './fixtures/temporary.mjs';
import {HomeAuthority} from '../src/navigation/authority.mjs';
import {invokeHome} from '../src/navigation/ipc.mjs';
import {navigationFields} from '../src/navigation/contracts.mjs';
import {validateImportedProject} from '../src/projects/import-validation.mjs';
import {parseLegacyImport} from '../src/projects/migration.mjs';
import {readOwnedBytes} from '../src/projects/io.mjs';
import {EventEmitter} from 'node:events';
import {HomeTransitionReceipts} from '../src/navigation/transition-receipts.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {atomicWrite} from '../src/projects/atomic.mjs';
import {readdir} from 'node:fs/promises';
import {admitImportedProject} from '../src/projects/import-admission.mjs';
import {assertImportComplete} from '../src/projects/import-status.mjs';
import {createImportedSourceBundleCopy} from '../src/navigation/source-bundle-copy.mjs';
import {actualSourceBundle} from './fixtures/source-bundle.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
async function fixture({realSelection=false}={}){
 const root=await mkdtemp(join(tmpdir(),'siren-home-import-route-')),file=join(root,'chosen.siren'),rendererRoot=join(root,'generated');await mkdir(rendererRoot);
 const bytes=Buffer.from(JSON.stringify({type:'siren-project',version:'1.131.0',state:{diagrams:[{id:'diagram-a',source:'flowchart TD\n A[ORIGINAL]-->B'}],activeDiagramId:'diagram-a',workpapers:[]}}));await writeFile(file,bytes);await writeFile(join(rendererRoot,'build.json'),JSON.stringify({importValidation:{entrySha256:'a'.repeat(64)}}));
 let unlocked=true,disposed=false;const frame={url:'siren://app/home.html'},wc=new EventEmitter(),window=new EventEmitter();Object.assign(wc,{id:20,mainFrame:frame,isDestroyed:()=>false,getURL:()=>wc.mainFrame.url,isLoadingMainFrame:()=>false,send(){}});Object.assign(window,{id:21,webContents:wc,isDestroyed:()=>false});
 const projects=new ProjectStore(root),recovery=new RecoveryStore(root),handlers=new Map(),selected=[];let context;
 const authority=new HomeAuthority({workspace:window,state:()=>({unlocked,projectId:context?.selectedId??null,mode:'normal',generation:context?.bootstrap?.selectionGeneration??0})});
 class IPCRegistry extends WindowRegistry {activateWorkspace(options){return super.activateWorkspace(structuredClone(options));}}
 const registry=new IPCRegistry({authorize:()=>context?.selectedId?{projectId:context.selectedId,mode:'normal',access:'write',entityIds:[]}:null,createWindow:()=>assert.fail('Import selection creates no satellite')});registry.bindWorkspace(window);
 const transitions=new HomeTransitionReceipts({registry,authority,projects});
 context=vm.createContext({window,nativeReadonly:false,mode:'normal',writes:new Set(),homeAuthority:authority,homeTransitions:transitions,invokeHome:args=>invokeHome({...args,payload:structuredClone(args.payload)}),navigationFields:(...args)=>navigationFields(...args.map((v,i)=>i? v:structuredClone(v))),
  dialog:{showOpenDialog:async()=>({canceled:false,filePaths:[file]})},rendererRoot,readOwnedBytes,realpath,join,basename,Buffer,validateImportedProject,parseLegacyImport,admitImportedProject,assertImportComplete,createImportedSourceBundleCopy,writerOptions:{},legacyExportEpoch:0,BrowserWindow:class{},createImportValidator:()=>({validate:async text=>text,dispose:async()=>{disposed=true;}}),
  // Selection is tested separately with the actual ProjectStore/receipt owner.
  selectHomeProject:async(input,scope,options)=>{assert.equal(scope.isCurrent(),true);selected.push({input,options});return {ok:true,epoch:1};},ipcMain:{handle:(name,fn)=>handlers.set(name,fn)}});
 if(realSelection){
  delete context.selectHomeProject;
  Object.assign(context,{dataRoot:root,projects,recovery,atomicWrite,bootstrap:{selectionGeneration:0},selectedId:null,snapshot:null,reason:null,pinTransition:false,accountTransition:false,accountQuiesced:false,localPin:{state:()=>({unlocked})},grants:new Set(),account:{accountId:null,policy:{opened(){}}},nativeShellFailure:false,windowRegistry:registry,retireNativeViews:()=>registry.invalidateEpoch({preserveWorkspace:true}),rollbackNativePreparation:async()=>{},prepareNativeWorkspace:()=>assert.fail('First import has no editor to flush')});
  const between=(a,b)=>{const start=main.indexOf(a),end=main.indexOf(b,start);assert.ok(start>=0&&end>start);return main.slice(start,end);};
  vm.runInContext(between('const selected = async (next,{isCurrent}={}) => {','const changeSelection =')+between('const selectHomeProject=',"ipcMain.handle('siren:home'"),context);
 }
 const start=main.indexOf("ipcMain.handle('siren:home-import'"),end=main.indexOf('const desktopCommand =',start);assert.ok(start>=0&&end>start);vm.runInContext(main.slice(start,end),context);
 return {root,projects,recovery,bytes,file,context,selected,disposed:()=>disposed,lock:()=>{unlocked=false;authority.invalidate();},call:(payload={})=>handlers.get('siren:home-import')({sender:wc,senderFrame:frame},payload)};
}

test('actual Home import hands off to genuine durable native selection and saved recovery',async()=>{
 const f=await fixture({realSelection:true}),result=await f.call();assert.equal(result.ok,true);
 const pointer=JSON.parse(await readFile(join(f.root,'session-selection.json'))),snapshot=await f.projects.readProject(pointer.projectId);
 assert.equal(snapshot.project.id,f.context.selectedId);assert.equal(snapshot.project.label,'chosen.siren');
 assert.ok(snapshot.json.includes('ORIGINAL'));assert.deepEqual(Object.keys(result).sort(),['epoch','ok']);
 assert.ok((await f.recovery.scan(snapshot.project.id)).valid.some(point=>point.kind==='saved'&&point.snapshot.json===snapshot.json&&point.snapshot.sha256===snapshot.sha256));
 assert.deepEqual(await readFile(f.file),f.bytes);
});
test('actual Home import uses a native chooser and isolated validator, returning metadata without source text',async()=>{
 const f=await fixture(),result=await f.call();assert.equal(result.ok,true);assert.deepEqual(Object.keys(result).sort(),['epoch','ok']);assert.equal(f.disposed(),true);
 assert.equal(f.selected.length,1);assert.equal(f.selected[0].input.label,'chosen.siren');assert.ok(f.selected[0].options.json.includes('ORIGINAL'));assert.deepEqual(await readFile(f.file),f.bytes);
});
test('Home import cancellation, extra identity fields and Lock during chooser do not select a project',async()=>{
 for(const condition of ['cancel','extra','lock']){
  const f=await fixture();if(condition==='cancel')f.context.dialog.showOpenDialog=async()=>({canceled:true});if(condition==='lock')f.context.dialog.showOpenDialog=async()=>{f.lock();return {canceled:false,filePaths:[f.file]};};
  const result=await f.call(condition==='extra'?{path:f.file}:{});assert.equal(result.ok,false);assert.equal(f.selected.length,0);assert.deepEqual(await readFile(f.file),f.bytes);
 }
});
test('actual Home door selects a source-bundle copy with exact source bytes and saved checkpoint',async()=>{
 const f=await fixture({realSelection:true}),source=await actualSourceBundle(f.root);await writeFile(f.file,source.bundle);
 f.context.recovery=new RecoveryStore(f.root,{sources:new SourceRepository(f.root)});
 f.context.createImportValidator=()=>({validate:()=>assert.fail('No legacy validation for bundles'),validateBundleMetadata:async text=>text,dispose:async()=>{}});
 const result=await f.call();assert.equal(result.ok,true);const pointer=JSON.parse(await readFile(join(f.root,'session-selection.json'))),snapshot=await f.projects.readProject(pointer.projectId);
 assert.equal(snapshot.schema,2);assert.notEqual(snapshot.project.id,source.snapshot.project.id);assert.deepEqual(await source.sources.exportSource({projectId:snapshot.project.id,...snapshot.sourceRefs[0]}),source.bytes);
 assert.equal(await f.context.recovery.hasSavedSnapshot(snapshot),true);assert.deepEqual(await readFile(f.file),source.bundle);
});
test('Home copy cannot adopt a new epoch after Lock and rollback while its own preparation was pending',async()=>{
 const f=await fixture({realSelection:true}),source=await actualSourceBundle(f.root);await writeFile(f.file,source.bundle);
 f.context.recovery=new RecoveryStore(f.root,{sources:new SourceRepository(f.root)});f.context.snapshot=source.snapshot;f.context.selectedId=source.snapshot.project.id;
 f.context.createImportValidator=()=>({validateBundleMetadata:async text=>text,dispose:async()=>{}});
 const before=await readdir(join(f.root,'Projects'));f.context.prepareNativeWorkspace=async()=>{f.context.legacyExportEpoch+=2;};
 const result=await f.call();assert.equal(result.ok,false);assert.equal(f.context.selectedId,source.snapshot.project.id);assert.deepEqual(await readdir(join(f.root,'Projects')),before);
});
test('actual Home open refuses an incomplete copy even when its selected manifest is readable',async()=>{
 const f=await fixture({realSelection:true}),project=await f.projects.createProject({label:'Incomplete',json:'{}'});
 await writeFile(join(f.root,'Projects',project.project.id,'source-import-status.json'),JSON.stringify({schema:1,projectId:project.project.id,state:'incomplete'}));
 const select=vm.runInContext('selectHomeProject',f.context),result=await select({projectId:project.project.id},{transition:{},isCurrent:()=>true});
 assert.equal(result.ok,false);assert.equal(f.context.selectedId,null);await assert.rejects(readFile(join(f.root,'session-selection.json')),{code:'ENOENT'});
});
