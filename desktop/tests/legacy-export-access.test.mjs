import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile,readdir,rm,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {atomicWrite as actualWrite} from '../src/projects/atomic.mjs';
import {failure} from '../src/ipc.mjs';

const main=(await readFile(new URL('../src/main.mjs',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const start=main.includes('const captureLegacyExportAccess =')?main.indexOf('const captureLegacyExportAccess ='):main.indexOf('const exportBytes =');
const helpers=main.slice(start,main.indexOf('// Unlock never creates',start));
const prepareStart=main.indexOf("const prepareNativeWorkspace=async(reason='native-workspace-transition')=>{");
const prepare=main.slice(prepareStart,main.indexOf("ipcMain.handle('siren:view-ack'",prepareStart));
const method=(from,to)=>main.slice(main.indexOf(from),main.indexOf(to,main.indexOf(from)));
const project=method('  exportProject: async id => {','  getRecovery:');
const diagnostics=method('  exportDiagnostics: async () => {','  getAccess:');
const lock=method('  lockPin: async () => {','  requestClose:');
const recovery=method('  exportRecovery: async id => {','\n};\nconst nativeDisplays');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};

async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'siren-export-access-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const destination=join(root,'chosen.siren-backup'),entered=deferred(),choice=deferred();
 let unlocked=true,chooserCalls=0,writeCalls=0,hook=async()=>{};
 const frame={url:'siren://app/app.html'},contents={mainFrame:frame,isDestroyed:()=>false,getURL:()=>frame.url,send(){},executeJavaScript:async()=>{}};
 const saved={schema:1,json:'{"private":"Exact Ș😀\\r\\n"}'};
 const context=vm.createContext({Buffer,failure,legacyExportEpoch:0,selectedId:'owned-project',mode:'normal',bootstrap:{selectionGeneration:1},pinTransition:false,accountTransition:false,accountQuiesced:false,nativeReadonly:false,grants:new Set(['owned-project']),writes:new Set(),snapshot:null,window:{webContents:contents,isDestroyed:()=>false},localPin:{state:()=>({unlocked})},homeAuthority:{invalidate(){}},nativeShells:new Map(),windowRegistry:{listViews:()=>[]},projects:{readProject:async()=>saved},recovery:{exportSourceSnapshot:async()=>Buffer.from('exact source bundle')},recoveryAccess:{export:async()=>Buffer.from('exact recovery bytes')},dialog:{showSaveDialog:async()=>{chooserCalls++;entered.resolve();return choice.promise;}},atomicWrite:async(path,bytes,options={})=>{writeCalls++;return actualWrite(path,bytes,{...options,fault:async phase=>{await hook(phase);await options.fault?.(phase);}});}});
 Object.assign(context,{buildDiagnostics:input=>input,app:{getVersion:()=> 'test'},process:{versions:{electron:'test',chrome:'test',node:'test'},platform:'win32',arch:'x64'},osRelease:()=> 'test',account:{getAccess:async()=>({state:'offline'})},updates:{getUpdate:()=>({phase:'idle'})}});
 context.recovery.scan=async()=>({valid:[],invalid:[]});context.projects.listProjects=async()=>[];
 context.localPin.lock=()=>{unlocked=false;};context.retireNativeViews=async()=>{};context.rollbackNativePreparation=async()=>{};
 vm.runInContext(helpers+'\n'+prepare+'\nconst exportServices={'+lock+diagnostics+project+recovery+'};',context);
 return {root,destination,entered,choice,context,contents,saved,setUnlocked:value=>{unlocked=value;},setHook:value=>{hook=value;},chooserCalls:()=>chooserCalls,writeCalls:()=>writeCalls,call:(name,...args)=>vm.runInContext('exportServices',context)[name](...args),prepare:()=>vm.runInContext('prepareNativeWorkspace',context)()};
}

for(const name of ['exportProject','exportRecovery']){
 test(name+': chooser result after Lock cannot publish private bytes',async t=>{
  const f=await fixture(t),operation=f.call(name,'owned-project');await f.entered.promise;f.setUnlocked(false);f.choice.resolve({canceled:false,filePath:f.destination});
  const result=await operation;assert.equal(result.ok,false);assert.equal(result.code,'ACCESS_REFUSED');assert.equal(f.writeCalls(),0);assert.deepEqual(await readdir(f.root),[]);
 });
 test(name+': actual preparation permanently revokes chooser even after unlock/rollback',async t=>{
  const f=await fixture(t),operation=f.call(name,'owned-project');await f.entered.promise;
  await f.prepare();f.setUnlocked(false);f.setUnlocked(true);f.choice.resolve({canceled:false,filePath:f.destination});
  const result=await operation;assert.equal(result.ok,false);assert.equal(result.code,'ACCESS_REFUSED');assert.equal(f.writeCalls(),0);assert.deepEqual(await readdir(f.root),[]);
 });
 test(name+': unchanged authority preserves exact export and cancellation',async t=>{
  const f=await fixture(t),operation=f.call(name,'owned-project');await f.entered.promise;f.choice.resolve({canceled:false,filePath:f.destination});assert.equal((await operation).ok,true);
  assert.deepEqual(await readFile(f.destination),Buffer.from(name==='exportProject'?f.saved.json:'exact recovery bytes'));assert.equal(f.context.writes.size,0);
  const cancel=await fixture(t),cancelOperation=cancel.call(name,'owned-project');await cancel.entered.promise;cancel.choice.resolve({canceled:true});assert.equal((await cancelOperation).code,'CANCELLED');assert.equal(cancel.writeCalls(),0);
 });
}

test('authority lost during project read never opens a destination chooser',async t=>{
 const f=await fixture(t);f.context.projects.readProject=async()=>{await f.prepare();return f.saved;};
 // Resolving in advance keeps the original defective implementation bounded.
 f.choice.resolve({canceled:false,filePath:f.destination});const result=await f.call('exportProject','owned-project');
 assert.equal(result.ok,false);assert.equal(result.code,'ACCESS_REFUSED');assert.equal(f.chooserCalls(),0);assert.equal(f.writeCalls(),0);
});

for(const mutation of ['selection','frame','mode'])test('a changed '+mutation+' invalidates pending export',async t=>{
 const f=await fixture(t),operation=f.call('exportProject','owned-project');await f.entered.promise;
 if(mutation==='selection')f.context.bootstrap.selectionGeneration++;
 if(mutation==='frame')f.contents.mainFrame={url:'siren://app/app.html'};
 if(mutation==='mode')f.context.mode='readonly';
 f.choice.resolve({canceled:false,filePath:f.destination});assert.equal((await operation).code,'ACCESS_REFUSED');assert.equal(f.writeCalls(),0);
});

test('access loss before atomic publication preserves an existing destination and removes its owned staging file',async t=>{
 const f=await fixture(t);await writeFile(f.destination,'original destination');
 f.setHook(async phase=>{if(phase==='before-rename'){assert.equal(f.context.writes.size,1,'actual write must be part of the native drain');f.setUnlocked(false);}});
 const operation=f.call('exportProject','owned-project');await f.entered.promise;f.choice.resolve({canceled:false,filePath:f.destination});
 const result=await operation;assert.equal(result.ok,false);assert.equal(result.code,'ACCESS_REFUSED');assert.equal(await readFile(f.destination,'utf8'),'original destination');assert.deepEqual(await readdir(f.root),['chosen.siren-backup']);assert.equal(f.context.writes.size,0);
});

test('a refused export destination leaves no full backup staging copy beside it',async t=>{
 const f=await fixture(t),operation=f.call('exportProject','owned-project');await f.entered.promise;await mkdir(f.destination);f.choice.resolve({canceled:false,filePath:f.destination});
 await assert.rejects(operation);assert.deepEqual(await readdir(f.root),['chosen.siren-backup']);assert.equal(f.context.writes.size,0);
});

test('an export still loading recovery bytes is revoked before a chooser can open',async t=>{
 const f=await fixture(t);f.context.recoveryAccess.export=async()=>{await f.prepare();return Buffer.from('private recovery');};f.choice.resolve({canceled:false,filePath:f.destination});
 assert.equal((await f.call('exportRecovery','owned-project')).code,'ACCESS_REFUSED');assert.equal(f.chooserCalls(),0);assert.equal(f.writeCalls(),0);
});

test('a chooser does not enter the native writes drain and readonly exports remain available',async t=>{
 const f=await fixture(t);f.context.mode='readonly';const operation=f.call('exportProject','owned-project');await f.entered.promise;
 assert.equal(f.context.writes.size,0,'Lock must not wait on an unanswered OS dialog');f.choice.resolve({canceled:false,filePath:f.destination});assert.equal((await operation).ok,true);
});

test('diagnostics use the same revoked chooser boundary',async t=>{
 const f=await fixture(t),operation=f.call('exportDiagnostics');await f.entered.promise;await f.prepare();f.choice.resolve({canceled:false,filePath:f.destination});
 assert.equal((await operation).code,'ACCESS_REFUSED');assert.equal(f.writeCalls(),0);assert.deepEqual(await readdir(f.root),[]);
});

test('actual Lock service drains publication already committed before Lock',async t=>{
 const f=await fixture(t),renamed=deferred(),readback=deferred();
 f.setHook(async phase=>{if(phase==='after-rename'){renamed.resolve();await readback.promise;}});
 const operation=f.call('exportProject','owned-project');await f.entered.promise;f.choice.resolve({canceled:false,filePath:f.destination});await renamed.promise;
 assert.equal(f.context.writes.size,1);let locked=false;const locking=f.call('lockPin').then(result=>{locked=true;return result;});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(locked,false,'actual Lock service must wait for accepted durable publication');readback.resolve();assert.equal((await operation).ok,true);assert.equal((await locking).ok,true);
 assert.equal(f.context.localPin.state().unlocked,false);assert.equal(f.context.writes.size,0);assert.equal(await readFile(f.destination,'utf8'),f.saved.json);
});

test('actual Lock succeeds when its revoked before-rename export was cleaned safely',async t=>{
 const f=await fixture(t);await writeFile(f.destination,'original destination');let locking;
 f.setHook(async phase=>{if(phase==='before-rename')locking=f.call('lockPin');});
 const operation=f.call('exportProject','owned-project');await f.entered.promise;f.choice.resolve({canceled:false,filePath:f.destination});
 assert.equal((await operation).code,'ACCESS_REFUSED');assert.equal((await locking).ok,true);assert.equal(f.context.localPin.state().unlocked,false);
 assert.equal(await readFile(f.destination,'utf8'),'original destination');assert.deepEqual(await readdir(f.root),['chosen.siren-backup']);
});

test('unconfirmed export cleanup remains a real drain failure and cannot confirm Lock',async t=>{
 const f=await fixture(t),parent=join(f.root,'output'),moved=join(f.root,'moved-output');await mkdir(parent);const destination=join(parent,'backup');let locking;
 f.setHook(async phase=>{if(phase==='before-rename'){await rename(parent,moved);await writeFile(parent,'changed destination parent');locking=f.call('lockPin');}});
 const operation=f.call('exportProject','owned-project');await f.entered.promise;f.choice.resolve({canceled:false,filePath:destination});
 await assert.rejects(operation,{code:'PENDING_CLEANUP_FAILED'});assert.equal((await locking).code,'SAVE_FAILED');assert.equal(f.context.localPin.state().unlocked,true);
 const retained=await readdir(moved);assert.equal(retained.length,1);assert.match(retained[0],/^pending-[a-f0-9-]+\.tmp$/);assert.equal(await readFile(join(moved,retained[0]),'utf8'),f.saved.json);
 assert.equal(await readFile(parent,'utf8'),'changed destination parent');assert.equal(f.context.writes.size,0);
});
