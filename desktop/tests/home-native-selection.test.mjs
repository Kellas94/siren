import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {EventEmitter} from 'node:events';
import {readFile,mkdir,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {atomicWrite} from '../src/projects/atomic.mjs';
import {HomeAuthority} from '../src/navigation/authority.mjs';
import {HomeTransitionReceipts} from '../src/navigation/transition-receipts.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {invokeHome} from '../src/navigation/ipc.mjs';
import {createHomeProjectCopy} from '../src/navigation/project-copies.mjs';
import {RecoveryStore} from '../src/recovery/checkpoints.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const between=(a,b)=>{const start=main.indexOf(a),end=main.indexOf(b,start);assert.ok(start>=0&&end>start);return main.slice(start,end);};
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'siren-main-home-select-')),projects=new ProjectStore(root),primary=new EventEmitter();
 primary.id=200;primary.isDestroyed=()=>false;const wc=primary.webContents=new EventEmitter();Object.assign(wc,{id:201,mainFrame:{url:'siren://app/home.html'},getURL:()=>wc.mainFrame.url,isDestroyed:()=>false,send(){}});
 const context=vm.createContext({createHomeProjectCopy,writerOptions:{},dataRoot:root,join,Buffer,atomicWrite,projects,window:primary,bootstrap:{selectionGeneration:0},selectedId:null,snapshot:null,mode:'normal',nativeReadonly:false,reason:null,pinTransition:false,accountTransition:false,accountQuiesced:false,localPin:{state:()=>({unlocked:true})},writes:new Set(),grants:new Set(),account:{accountId:null,policy:{opened(){}}},nativeShellFailure:false,recovery:{checkpointProject:()=>assert.fail('Normal creation must not manufacture an import checkpoint')},rollbackNativePreparation:async()=>{},prepareNativeWorkspace:()=>assert.fail('No selection has no editor to flush')});
 class IPCRegistry extends WindowRegistry{activateWorkspace(options){return super.activateWorkspace(structuredClone(options));}}
 const registry=new IPCRegistry({authorize:()=>context.selectedId?{projectId:context.selectedId,mode:'normal',access:'write',entityIds:[]}:null,createWindow:()=>assert.fail('No satellite required')});registry.bindWorkspace(primary);
 const authority=new HomeAuthority({workspace:primary,state:()=>({projectId:context.selectedId,mode:context.mode,generation:context.bootstrap.selectionGeneration,unlocked:true})});
 const transitions=new HomeTransitionReceipts({registry,authority,projects});Object.assign(context,{windowRegistry:registry,homeAuthority:authority,homeTransitions:transitions,retireNativeViews:()=>registry.invalidateEpoch({preserveWorkspace:true})});
 vm.runInContext(between('const selected = async next => {','const changeSelection =')+between('const selectHomeProject=','ipcMain.handle(\'siren:home\'')+';globalThis.create=(scope,input)=>selectHomeProject(input,scope,{create:true,desktop:input.format==="desktop"});',context);
 const event=()=>({sender:wc,senderFrame:wc.mainFrame});return {root,projects,registry,authority,transitions,context,event,invoke:(format)=>invokeHome({event:event(),method:'createProject',payload:{label:'Actual Home Ș😀',...(format?{format}:{})},authority,transitions,services:{createProject:(input,scope)=>context.create(scope,input)}})};
}
test('actual native Home creation selects an owned durable project and acknowledges metadata only',async()=>{
 const f=await fixture();assert.equal((await f.invoke()).ok,true);
 const pointer=JSON.parse(await readFile(join(f.root,'session-selection.json'))),stored=await f.projects.readProject(pointer.projectId);
 assert.equal(stored.project.label,'Actual Home Ș😀');assert.equal(stored.json,'{"kind":"siren-desktop","schema":1,"storage":{}}');
 assert.equal(stored.project.id,f.context.selectedId);assert.ok(f.registry.capturePrimary(f.event()));assert.equal(f.context.writes.selectionTransition,false);
});
test('actual failed Home selector retains no selected snapshot or false metadata acknowledgement',async()=>{
 const f=await fixture();await mkdir(join(f.root,'session-selection.json'));
 assert.equal((await f.invoke()).ok,false);assert.equal(f.context.selectedId,null);assert.equal(f.context.snapshot,null);assert.equal(f.registry.capturePrimary(f.event()),null);
 assert.equal(f.context.writes.selectionTransition,false);assert.equal((await readdir(join(f.root,'Projects'))).length,1,'Unselected owned creation is retained after selector failure');
});

test('actual desktop New selects the source-aware copy through durable native Home acknowledgement',async()=>{
 const f=await fixture();f.context.recovery=new RecoveryStore(f.root,{sources:new SourceRepository(f.root)});assert.equal((await f.invoke('desktop')).ok,true);
 const pointer=JSON.parse(await readFile(join(f.root,'session-selection.json'))),stored=await f.projects.readProject(pointer.projectId);assert.equal(stored.schema,2);assert.equal(stored.project.label,'Actual Home Ș😀');assert.deepEqual(stored,f.context.snapshot);assert.equal(f.context.bootstrap.readonly,true,'Legacy envelope stays fenced for source-aware projects');assert.ok(f.registry.capturePrimary(f.event()));assert.equal(await f.context.recovery.hasSavedSnapshot(stored),true);assert.equal(f.context.writes.selectionQuiesced,false);
});
