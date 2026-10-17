// Real owned filesystem behavior; cleanup ENOENT is synthetic, not historical EPERM.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rename,lstat} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {exclusiveWriter} from '../src/projects/atomic.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {SourceRepository} from '../src/sources/repository.mjs';

async function fixture() {
 const root=await mkdtemp(join(tmpdir(),'siren-writer-errors-'));
 const retained=join(root,'retained');await mkdir(retained);
 return {root,lock:join(root,'writer.lock'),retired:join(retained,'writer.lock')};
}
async function absent(path) {
 try {await lstat(path);return false;}catch(error){if(error.code==='ENOENT')return true;throw error;}
}
async function rejected(action) {
 let caught=false,actual;
 try {await action();}catch(error){caught=true;actual=error;}
 assert.equal(caught,true,'writer failure must reject');return actual;
}
async function moveOwnLock(f) {
 const bytes=await readFile(f.lock);await rename(f.lock,f.retired);
 assert.deepEqual(await readFile(f.retired),bytes);return bytes;
}
function cleanupError(error,f) {
 assert.equal(error.code,'ENOENT');assert.equal(error.syscall,'lstat');
 assert.equal(resolve(error.path),resolve(f.lock));
}
function combined(error,primary,f) {
 assert.ok(error instanceof AggregateError,'both failures must remain inspectable');
 assert.equal(error.cause,primary);assert.equal(error.errors.length,2);
 assert.equal(error.errors[0],primary);cleanupError(error.errors[1],f);
}
async function reacquire(f) {
 assert.equal(await exclusiveWriter(f.root,async()=> 'REACQUIRED'),'REACQUIRED');
 assert.equal(await absent(f.lock),true);
}

test('successful body retains its result and retires its writer lock',async()=>{
 const f=await fixture(),value=Object.freeze({value:'saved'});
 assert.equal(await exclusiveWriter(f.root,async()=>value),value);
 assert.equal(await absent(f.lock),true);await reacquire(f);
});
test('body-only frozen failure keeps object identity and code',async()=>{
 const f=await fixture(),primary=Object.freeze(Object.assign(Error('primary'),{code:'ACCESS_REFUSED'}));
 assert.equal(await rejected(()=>exclusiveWriter(f.root,async()=>{throw primary;})),primary);
 assert.equal(await absent(f.lock),true);await reacquire(f);
});
test('cleanup-only failure rejects a successful body and releases in-memory exclusion',async()=>{
 const f=await fixture();let retained;
 const error=await rejected(()=>exclusiveWriter(f.root,async()=>{retained=await moveOwnLock(f);return 'BODY_OK';}));
 cleanupError(error,f);assert.deepEqual(await readFile(f.retired),retained);await reacquire(f);
});
test('body and cleanup failures preserve frozen primary cause, caller code and cleanup detail',async()=>{
 const f=await fixture(),primary=Object.freeze(Object.assign(Error('primary'),{code:'ACCESS_REFUSED'}));
 const error=await rejected(()=>exclusiveWriter(f.root,async()=>{await moveOwnLock(f);throw primary;}));
 combined(error,primary,f);assert.equal(error.code,'ACCESS_REFUSED');
 assert.equal(Object.isFrozen(primary),true);assert.equal(Object.hasOwn(primary,'cause'),false);
 assert.equal(Object.hasOwn(primary,'errors'),false);await reacquire(f);
});
for(const [label,primary] of [['undefined',undefined],['null',null],['false',false],['zero',0],['empty-string','']]) {
 test('body-only '+label+' rejection remains the exact thrown value',async()=>{
  const f=await fixture();assert.equal(await rejected(()=>exclusiveWriter(f.root,async()=>{throw primary;})),primary);
  assert.equal(await absent(f.lock),true);await reacquire(f);
 });
 test('double failure retains '+label+' as primary and does not substitute cleanup code',async()=>{
  const f=await fixture(),error=await rejected(()=>exclusiveWriter(f.root,async()=>{await moveOwnLock(f);throw primary;}));
  combined(error,primary,f);assert.equal(error.code,undefined);await reacquire(f);
 });
}
test('frozen non-Error rejection retains its primary code and exact value in combined failure',async()=>{
 const f=await fixture(),primary=Object.freeze({code:'INVALID_EDIT',detail:'synthetic value'});
 const error=await rejected(()=>exclusiveWriter(f.root,async()=>{await moveOwnLock(f);throw primary;}));
 combined(error,primary,f);assert.equal(error.code,'INVALID_EDIT');await reacquire(f);
});
test('throwing primary code getter cannot mask combined failures or retain writer exclusion',async()=>{
 const f=await fixture(),metadataError=Error('metadata getter failed');
 const primary=Object.freeze(Object.defineProperty(Error('primary'), 'code', {get(){throw metadataError;}}));
 const error=await rejected(()=>exclusiveWriter(f.root,async()=>{await moveOwnLock(f);throw primary;}));
 combined(error,primary,f);assert.notEqual(error,metadataError);assert.equal(error.code,undefined);await reacquire(f);
});
test('throwing Proxy code access cannot mask the exact primary and cleanup failures',async()=>{
 const f=await fixture(),metadataError=Error('proxy metadata failed');
 const primary=new Proxy(Object.freeze({detail:'primary object'}),{get(target,key,receiver){
  if(key==='code')throw metadataError;return Reflect.get(target,key,receiver);
 }});
 const error=await rejected(()=>exclusiveWriter(f.root,async()=>{await moveOwnLock(f);throw primary;}));
 combined(error,primary,f);assert.notEqual(error,metadataError);assert.equal(error.code,undefined);await reacquire(f);
});
test('active writer remains exclusive while its lock name is absent, then releases after failure',async()=>{
 const f=await fixture();let nestedEntered=false;
 const error=await rejected(()=>exclusiveWriter(f.root,async()=>{
  await moveOwnLock(f);
  const nested=await rejected(()=>exclusiveWriter(f.root,async()=>{nestedEntered=true;}));
  assert.equal(nested.code,'WRITER_BUSY');assert.equal(nestedEntered,false);return 'OUTER';
 }));
 cleanupError(error,f);await reacquire(f);
});
for(const mode of ['untrusted','unknown','live'])test(mode+' prior writer remains fail-closed with exact lock bytes',async()=>{
 const f=await fixture(),prior={pid:111,path:'synthetic.exe',startedAt:'prior'},bytes=Buffer.from(JSON.stringify(prior));
 await writeFile(f.lock,bytes,{flag:'wx'});let entered=false,inspections=0;
 const options=mode==='untrusted'?undefined:{ownerIdentity:{pid:222,path:'synthetic.exe',startedAt:'current'},
  inspectProcess:async()=>{inspections++;return mode==='unknown'?undefined:prior;}};
 for(let i=0;i<2;i++) {
  const error=await rejected(()=>exclusiveWriter(f.root,async()=>{entered=true;},options));
  assert.equal(error.code,'WRITER_BUSY');assert.equal(entered,false);assert.deepEqual(await readFile(f.lock),bytes);
 }
 assert.equal(inspections,mode==='untrusted'?0:2);
});
test('SourceRepository reports primary denial when edit body and lock cleanup both fail',async()=>{
 const f=await fixture(),projects=new ProjectStore(f.root),initial=await projects.createProject({label:'Synthetic caller',json:'{}'});
 let armed=false,retired;
 const primary=Object.freeze(Object.assign(Error('synthetic edit denial'),{code:'ACCESS_REFUSED'}));
 const repository=new SourceRepository(f.root,{fault:async phase=>{
  if(armed&&phase==='source-version-verified') {
   const directory=await projects.directory(initial.project.id);
   retired=join(f.root,'retained','caller-writer.lock');await rename(join(directory,'writer.lock'),retired);throw primary;
  }
 }});
 const ref=await repository.importSource({projectId:initial.project.id,bytes:Buffer.from('x=1\n')});armed=true;
 const result=await repository.applyEdit({projectId:initial.project.id,edit:{sourceId:ref.sourceId,operationId:'synthetic-double',expectedVersion:1,start:0,end:0,insertedText:'# edit\n'}});
 assert.equal(result.ok,false);assert.equal(result.code,'ACCESS_REFUSED');
 assert.equal(await absent(retired),false);
 const selected=await repository.exportSource({projectId:initial.project.id,sourceId:ref.sourceId,version:1});
 assert.deepEqual(selected,Buffer.from('x=1\n'));
});
