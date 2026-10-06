import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile,writeFile,readdir,rm,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {atomicWrite as realWrite} from '../src/projects/atomic.mjs';
import {failure} from '../src/ipc.mjs';
import {HomeAuthority} from '../src/navigation/authority.mjs';
import {createHomeBackupExporter} from '../src/navigation/backup-export.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
const main=(await readFile(new URL('../src/main.mjs',import.meta.url),'utf8')).replaceAll('\r\n','\n');
const between=(a,b)=>{const s=main.indexOf(a),e=main.indexOf(b,s);assert.ok(s>=0&&e>s);return main.slice(s,e);};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'siren-home-publication-'));t.after(()=>rm(root,{recursive:true,force:true}));const projects=new ProjectStore(root),saved=await projects.createProject({label:'Actual',json:'{"saved":"Ș😀"}'}),destination=join(root,'backup Ș😀.siren-backup');
 const frame={url:'siren://app/home.html'},sender={mainFrame:frame,isDestroyed:()=>false,getURL:()=>sender.mainFrame.url},window={webContents:sender,isDestroyed:()=>false};
 let unlocked=true,hook=async()=>{};const entered=deferred(),choice=deferred(),handlers=new Map();let dialogs=0;
 const context=vm.createContext({Buffer,failure,projects,recovery:{},createHomeBackupExporter,window,selectedId:saved.project.id,mode:'normal',bootstrap:{selectionGeneration:1},legacyExportEpoch:0,pinTransition:false,accountTransition:false,accountQuiesced:false,workspaceBarrier:false,nativeShellFailure:false,writes:new Set(),localPin:{state:()=>({unlocked})},dialog:{showSaveDialog:async()=>{dialogs++;entered.resolve();return choice.promise;}},atomicWrite:(p,b,o)=>realWrite(p,b,{...o,fault:async phase=>{await hook(phase);await o.fault(phase);}}),ipcMain:{handle:(name,fn)=>handlers.set(name,fn)}});
 const authority=new HomeAuthority({workspace:window,state:()=>({projectId:context.selectedId,mode:context.mode,generation:context.bootstrap.selectionGeneration,unlocked})});context.homeAuthority=authority;
 vm.runInContext(between('const captureLegacyExportAccess =','// Unlock never creates')+between('const exportHomeBackup=',"ipcMain.handle('siren:home',"),context);
 return {root,saved,destination,context,authority,sender,entered,choice,dialogs:()=>dialogs,setHook:f=>{hook=f;},revoke:()=>{context.pinTransition=true;authority.invalidate();unlocked=false;},resume:()=>{context.pinTransition=false;unlocked=true;},call:(payload={},event={sender,senderFrame:sender.mainFrame})=>handlers.get('siren:home-export')(event,payload)};
}

test('actual main Home registration publishes exact saved bytes through tracked writer, without legacy URL widening',async t=>{
 const f=await fixture(t),operation=f.call();await f.entered.promise;assert.equal(f.context.writes.size,0);f.choice.resolve({canceled:false,filePath:f.destination});
 const result=await operation;assert.equal(result.ok,true);assert.equal(result.revision,1);assert.deepEqual(await readFile(f.destination),Buffer.from(f.saved.json));assert.equal(f.context.writes.size,0);
 assert.equal(vm.runInContext('captureLegacyExportAccess()()',f.context),false,'Home must not acquire the classic exporter grant');
});

for(const phase of ['before-flush','after-flush','before-rename'])test('actual Home publication revocation at '+phase+' preserves existing destination and cleans pending bytes',async t=>{
 const f=await fixture(t);await writeFile(f.destination,'existing');f.setHook(async p=>{if(p===phase){assert.equal(f.context.writes.size,1);f.revoke();}});
 const operation=f.call();await f.entered.promise;f.choice.resolve({canceled:false,filePath:f.destination});assert.equal((await operation).code,'ACCESS_REFUSED');
 assert.equal(await readFile(f.destination,'utf8'),'existing');assert.equal((await readdir(f.root)).some(n=>n.startsWith('pending-')),false);assert.equal(f.context.writes.size,0);
});

test('accepted rename remains in actual drain until readback; Lock cannot relabel committed output as cancellation',async t=>{
 const f=await fixture(t),committed=deferred(),finish=deferred();f.setHook(async phase=>{if(phase==='after-rename'){committed.resolve();await finish.promise;}});
 const operation=f.call();await f.entered.promise;f.choice.resolve({canceled:false,filePath:f.destination});await committed.promise;f.revoke();
 let drained=false;const drain=Promise.all([...f.context.writes]).then(()=>{drained=true;});await new Promise(r=>setImmediate(r));assert.equal(drained,false);assert.equal(await readFile(f.destination,'utf8'),f.saved.json);
 finish.resolve();await drain;assert.deepEqual(await operation,{ok:false,code:'EXPORT_COMMITTED'});assert.equal(f.context.writes.size,0);
});

test('failed readback after accepted rename and revocation reports uncertain output rather than clean access refusal',async t=>{
 const f=await fixture(t);f.setHook(async phase=>{if(phase==='after-rename'){f.revoke();throw Error('Owned readback interruption');}});
 const operation=f.call();await f.entered.promise;f.choice.resolve({canceled:false,filePath:f.destination});assert.equal((await operation).code,'BACKUP_WRITE_FAILED');
 assert.equal(await readFile(f.destination,'utf8'),f.saved.json);
});

test('unanswered chooser is not a writes drain; returning to same project cannot revive it',async t=>{
 const f=await fixture(t),operation=f.call();await f.entered.promise;assert.equal(f.context.writes.size,0);f.revoke();f.resume();f.choice.resolve({canceled:false,filePath:f.destination});
 assert.equal((await operation).code,'ACCESS_REFUSED');await assert.rejects(readFile(f.destination),{code:'ENOENT'});
});

test('actual main cancellation and single pending chooser leave snapshot and output untouched',async t=>{
 const f=await fixture(t),operation=f.call();await f.entered.promise;assert.equal((await f.call()).code,'EXPORT_BUSY');assert.equal(f.dialogs(),1);f.choice.resolve({canceled:true});assert.deepEqual(await operation,{ok:false,code:'CANCELLED'});await assert.rejects(readFile(f.destination),{code:'ENOENT'});
});

test('actual destination write failure is distinguished from unavailable saved data',async t=>{
 const f=await fixture(t);await mkdir(f.destination);const operation=f.call();await f.entered.promise;f.choice.resolve({canceled:false,filePath:f.destination});
 assert.deepEqual(await operation,{ok:false,code:'BACKUP_WRITE_FAILED'});assert.equal(f.context.writes.size,0);assert.equal((await readdir(f.root)).some(n=>n.startsWith('pending-')),false);
});

test('unconfirmed cleanup remains a rejected actual drain rather than successful Lock',async t=>{
 const f=await fixture(t),parent=join(f.root,'output'),moved=join(f.root,'moved');await mkdir(parent);const target=join(parent,'backup');let drain;
 f.setHook(async phase=>{if(phase==='before-rename'){await rename(parent,moved);await writeFile(parent,'changed parent');f.revoke();drain=Promise.all([...f.context.writes]);drain.catch(()=>{});}});
 const operation=f.call();await f.entered.promise;f.choice.resolve({canceled:false,filePath:target});assert.equal((await operation).code,'BACKUP_WRITE_FAILED');await assert.rejects(drain,{code:'PENDING_CLEANUP_FAILED'});
 const pending=await readdir(moved);assert.equal(pending.length,1);assert.match(pending[0],/^pending-/);assert.equal(await readFile(join(moved,pending[0]),'utf8'),f.saved.json);
});
