import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { join,basename,resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { readFile,writeFile,mkdir,realpath,readdir } from 'node:fs/promises';
import { mkdtemp } from './fixtures/temporary.mjs';
import { ProjectStore } from '../src/projects/store.mjs';
import { RecoveryStore } from '../src/recovery/checkpoints.mjs';
import { readOwnedBytes } from '../src/projects/io.mjs';
import { parseLegacyImport } from '../src/projects/migration.mjs';
import { validateImportedProject } from '../src/projects/import-validation.mjs';
import { failure } from '../src/ipc.mjs';
import {admitImportedProject} from '../src/projects/import-admission.mjs';
import {assertImportComplete} from '../src/projects/import-status.mjs';
import {createImportedSourceBundleCopy} from '../src/navigation/source-bundle-copy.mjs';
import {actualSourceBundle} from './fixtures/source-bundle.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';

const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const method=main.slice(main.indexOf('  pickProject: async () => {'),main.indexOf('\n  saveProject:'));
async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'siren-main-hidden-import-')),rendererRoot=join(root,'generated');await mkdir(rendererRoot);
  await writeFile(join(rendererRoot,'build.json'),JSON.stringify({importValidation:{entrySha256:'a'.repeat(64)}}));
  const value={type:'siren-project',version:'1.131.0',state:{diagrams:[{id:'diagram-a',source:'flowchart TD\n A-->B'}],activeDiagramId:'diagram-a',workpapers:[]}};
  const file=join(root,'chosen.siren');await writeFile(file,JSON.stringify(value));
  const projects=new ProjectStore(root),original=await projects.createProject({label:'Original',json:'{"private":"original retained"}'});
  let disposed=false;
  const frame={url:'siren://app/app.html'},wc={mainFrame:frame,isDestroyed:()=>false,getURL:()=>frame.url,executeJavaScript:async()=>{throw Error('Workspace renderer must not validate import');}};
  const context=vm.createContext({dialog:{showMessageBox:async()=>({response:2}),showOpenDialog:async()=>({canceled:false,filePaths:[file]})},changeSelection:async action=>action(),projects,recovery:new RecoveryStore(root),selected:async snapshot=>{context.selectedId=snapshot.project.id;context.bootstrap.selectionGeneration++;return snapshot;},dataRoot:root,rendererRoot,selectedId:original.project.id,bootstrap:{selectionGeneration:1},localPin:{state:()=>({unlocked:true})},mode:'normal',nativeReadonly:false,window:{webContents:wc,isDestroyed:()=>false},readOwnedBytes,validateImportedProject,admitImportedProject,assertImportComplete,createImportedSourceBundleCopy,writerOptions:{},legacyExportEpoch:0,pinTransition:false,accountTransition:false,accountQuiesced:false,createImportValidator:async()=>({validate:async text=>text,dispose:async()=>{disposed=true;}}),BrowserWindow:class{},parseLegacyImport,basename,resolve,realpath,join,Buffer,failure});
  vm.runInContext('const services={\n'+method+'\n};',context);
  return {root,file,original,projects,context,services:vm.runInContext('services',context),disposed:()=>disposed};
}

test('actual native import service uses an isolated validator instead of executing the workspace renderer',async()=>{
  const f=await fixture(),before=await readFile(f.file);const snapshot=await f.services.pickProject();
  assert.notEqual(snapshot.project.id,f.original.project.id);assert.equal(f.disposed(),true);assert.deepEqual(await readFile(f.file),before);assert.deepEqual(await f.projects.readProject(f.original.project.id),f.original);
  const bag=JSON.parse(snapshot.json);const state=JSON.parse(bag.storage['t-industries-siren-v23-state']);assert.equal(state.diagrams[0].source,'flowchart TD\n A-->B');
});

test('access change while hidden import validation is pending creates no project or checkpoint',async()=>{
  const f=await fixture();const projectsBefore=await readdir(join(f.root,'Projects'));
  f.context.createImportValidator=async()=>({validate:async text=>{f.context.bootstrap.selectionGeneration++;return text;},dispose:async()=>{}});
  await assert.rejects(f.services.pickProject(),{code:'ACCESS_REFUSED'});assert.deepEqual(await readdir(join(f.root,'Projects')),projectsBefore);assert.equal(f.context.selectedId,f.original.project.id);assert.deepEqual(await f.projects.readProject(f.original.project.id),f.original);
});
test('actual legacy native chooser restores an emitted source bundle into a distinct durable copy',async()=>{
 const f=await fixture(),source=await actualSourceBundle(f.root);await writeFile(f.file,source.bundle);
 f.context.recovery=new RecoveryStore(f.root,{sources:new SourceRepository(f.root)});
 f.context.createImportValidator=async()=>({validate:()=>assert.fail('Bundle must use metadata admission'),validateBundleMetadata:async text=>text,dispose:async()=>{}});
 const result=await f.services.pickProject();assert.equal(result.schema,2);assert.notEqual(result.project.id,source.snapshot.project.id);
 assert.deepEqual(await source.sources.exportSource({projectId:result.project.id,...result.sourceRefs[0]}),source.bytes);
 assert.deepEqual(await readFile(f.file),source.bundle);assert.deepEqual(await f.projects.readProject(f.original.project.id),f.original);
 assert.equal(await f.context.recovery.hasSavedSnapshot(result),true);
});
test('legacy import scope is captured before chooser and revoked permanently by preparation epoch',async()=>{
 const f=await fixture(),before=await readdir(join(f.root,'Projects'));f.context.legacyExportEpoch=0;
 f.context.dialog.showOpenDialog=async()=>{f.context.legacyExportEpoch++;return {canceled:false,filePaths:[f.file]};};
 await assert.rejects(f.services.pickProject(),{code:'ACCESS_REFUSED'});assert.deepEqual(await readdir(join(f.root,'Projects')),before);
});
test('ordinary bundle import cannot bypass native readonly or recovery through private copy stores',async()=>{
 for(const mode of ['readonly','recovery']){
  const f=await fixture(),source=await actualSourceBundle(f.root);await writeFile(f.file,source.bundle);const before=await readdir(join(f.root,'Projects'));
  f.context.mode=mode;f.context.nativeReadonly=mode==='readonly';f.context.recovery=new RecoveryStore(f.root,{sources:new SourceRepository(f.root)});
  f.context.createImportValidator=()=>({validateBundleMetadata:async text=>text,dispose:async()=>{}});
  const result=await f.services.pickProject();assert.equal(result.ok,false);assert.equal(result.code,'ACCESS_REFUSED');assert.deepEqual(await readdir(join(f.root,'Projects')),before);assert.equal(f.context.selectedId,f.original.project.id);
 }
});
