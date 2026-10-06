import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,readdir,readFile,writeFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdtemp} from './fixtures/temporary.mjs';
import {atomicWrite} from '../src/projects/atomic.mjs';
import {AppearanceStore} from '../src/appearance/store.mjs';
import {invokeShell} from '../src/appearance/ipc.mjs';
const refusal=code=>Object.assign(Error('Private filesystem details'),{code,path:'private-not-for-diagnostics'});
async function fixture(options={}){const root=await mkdtemp(join(tmpdir(),'siren-appearance-replace-'));const original=new AppearanceStore(root);assert.equal((await original.set({theme:'kpmg'})).ok,true);return {root,original,store:new AppearanceStore(root,options),path:join(root,'UI','appearance.json')};}
const pending=async root=>(await readdir(join(root,'UI'))).filter(x=>/^pending-[a-f0-9-]+\.tmp$/.test(x));

test('appearance staging cleanup removes only this uncommitted file, with generic atomic defaults unchanged',async()=>{
 for(const phase of ['before-flush','after-flush','before-rename']){
  const {root,path}=await fixture(),old=await readFile(path),sentinel=join(root,'UI','pending-unverified.tmp'),unrelated='pending-17b5a093-c5b6-40f0-876d-5138b3fc0bd6.tmp';await writeFile(sentinel,'retain');await writeFile(join(root,'UI',unrelated),'retain exact UUID staging');
  await assert.rejects(atomicWrite(path,Buffer.from('replacement'),{cleanupPending:true,fault:async p=>{if(p===phase)throw refusal('EIO');}}),{code:'EIO'});
  assert.deepEqual(await readFile(path),old);assert.deepEqual(await pending(root),[unrelated]);assert.equal(await readFile(sentinel,'utf8'),'retain');assert.equal(await readFile(join(root,'UI',unrelated),'utf8'),'retain exact UUID staging');
 }
 const {root,path}=await fixture();await assert.rejects(atomicWrite(path,Buffer.from('generic'),{fault:async p=>{if(p==='before-rename')throw refusal('EIO');}}));assert.equal((await pending(root)).length,1,'Other atomic callers retain their existing recovery semantics');
});

test('transient replace refusal reuses one flushed file and commits exact appearance on the second attempt',async()=>{
 const calls=[],waits=[];const f=await fixture({replaceFile:async(t,p)=>{calls.push({t,p,bytes:await readFile(t,'utf8')});if(calls.length===1)throw refusal('EPERM');return rename(t,p);},wait:async ms=>waits.push(ms)});
 assert.deepEqual(await f.store.set({theme:'dark'}),{ok:true,theme:'dark'});assert.equal(calls.length,2);assert.equal(calls[0].t,calls[1].t);assert.equal(calls[0].bytes,calls[1].bytes);assert.equal(calls[0].p,f.path);assert.deepEqual(waits,[20]);assert.deepEqual(await f.original.read(),{ok:true,theme:'dark'});assert.deepEqual(await pending(f.root),[]);
});

test('persistent replace refusal has three attempts, bounded delays, finite diagnostics and intact old bytes',async()=>{
 const calls=[],waits=[],events=[];const f=await fixture({replaceFile:async(t,p)=>{calls.push([t,p]);throw refusal('EPERM');},wait:async ms=>waits.push(ms),onDiagnostic:e=>events.push(e)}),old=await readFile(f.path);
 assert.equal((await f.store.set({theme:'dark'})).code,'APPEARANCE_WRITE_FAILED');assert.equal(calls.length,3);assert.equal(new Set(calls.map(c=>c[0])).size,1);assert.deepEqual(waits,[20,40]);assert.deepEqual(events,[{phase:'rename',code:'EPERM',attempts:3}]);assert.deepEqual(await readFile(f.path),old);assert.deepEqual(await pending(f.root),[]);
});

test('retirement or Lock during an inter-attempt delay prevents a subsequent rename',async()=>{
 for(const mode of ['retirement','lock']){let live=true,calls=0;const f=await fixture({replaceFile:async()=>{calls++;throw refusal('EPERM');},wait:async()=>{live=false;},canWrite:()=>mode==='lock'?live:true});const old=await readFile(f.path);
  assert.equal((await f.store.set({theme:'dark'},{isCurrent:()=>mode==='retirement'?live:true})).code,'ACCESS_REFUSED');assert.equal(calls,1);assert.deepEqual(await readFile(f.path),old);assert.deepEqual(await pending(f.root),[]);
 }
});

test('phase-hook refusals and unexpected rename errors are not retried',async()=>{
 for(const mode of ['hook','unexpected']){let calls=0,waits=0;const events=[];const f=await fixture({fault:async phase=>{if(mode==='hook'&&phase==='before-rename')throw refusal('EPERM');},replaceFile:async()=>{calls++;throw refusal('EIO');},wait:async()=>waits++,onDiagnostic:e=>events.push(e)}),old=await readFile(f.path);
  assert.equal((await f.store.set({theme:'dark'})).code,'APPEARANCE_WRITE_FAILED');assert.equal(calls,mode==='hook'?0:1);assert.equal(waits,0);assert.deepEqual(events,[mode==='hook'?{phase:'before-rename',code:'EPERM'}:{phase:'rename',code:'EIO',attempts:1}]);assert.deepEqual(await readFile(f.path),old);assert.deepEqual(await pending(f.root),[]);
 }
});

test('failure after committed rename is not replayed or described as retaining previous bytes',async()=>{
 let calls=0,waits=0;const f=await fixture({replaceFile:async(t,p)=>{calls++;return rename(t,p);},wait:async()=>waits++,fault:async p=>{if(p==='after-rename')throw refusal('EPERM');}});
 assert.equal((await f.store.set({theme:'dark'})).code,'APPEARANCE_WRITE_FAILED');assert.equal(calls,1);assert.equal(waits,0);assert.deepEqual(await f.original.read(),{ok:true,theme:'dark'});assert.deepEqual(await pending(f.root),[]);
});

test('durable readback mismatch refuses after one committed rename without deleting the target',async()=>{
 let calls=0,waits=0;const f=await fixture({replaceFile:async(t,p)=>{calls++;return rename(t,p);},wait:async()=>waits++,fault:async p=>{if(p==='after-rename')await writeFile(f.path,'changed after commit');}});
 assert.equal((await f.store.set({theme:'dark'})).code,'APPEARANCE_WRITE_FAILED');assert.equal(calls,1);assert.equal(waits,0);assert.equal(await readFile(f.path,'utf8'),'changed after commit');assert.deepEqual(await pending(f.root),[]);
});

test('target ownership changed during retry is refused before a second rename',async()=>{
 let calls=0;const f=await fixture({replaceFile:async()=>{calls++;throw refusal('EPERM');},wait:async()=>{await rename(f.path,join(f.root,'UI','retained-original.json'));await mkdir(f.path);}}),old=await readFile(f.path);
 assert.equal((await f.store.set({theme:'dark'})).code,'APPEARANCE_WRITE_FAILED');assert.equal(calls,1);assert.deepEqual(await readFile(join(f.root,'UI','retained-original.json')),old);assert.deepEqual(await readdir(f.path),[]);assert.deepEqual(await pending(f.root),[]);
});

test('generic atomic replacement still attempts once, and unsafe cleanup never masks the original failure',async()=>{
 const f=await fixture();let calls=0;await assert.rejects(atomicWrite(f.path,Buffer.from('default'),{replace:async()=>{calls++;throw refusal('EPERM');}}),{code:'EPERM'});assert.equal(calls,1);assert.equal((await pending(f.root)).length,1);
 const other=await fixture();let staged;await assert.rejects(atomicWrite(other.path,Buffer.from('new'),{cleanupPending:true,fault:async p=>{if(p==='before-rename'){staged=(await pending(other.root))[0];await rename(join(other.root,'UI',staged),join(other.root,'UI','retained-stage'));await mkdir(join(other.root,'UI',staged));throw refusal('EIO');}}}),{code:'EIO'});assert.deepEqual(await readdir(join(other.root,'UI',staged)),[]);assert.equal((await other.original.read()).theme,'kpmg');
});

test('root-serialized appearance writes keep a later choice behind a bounded EBUSY retry',async()=>{
 let entered,release;const gate=new Promise(resolve=>entered=resolve),resume=new Promise(resolve=>release=resolve),calls=[];
 const replaceFile=async(t,p)=>{calls.push({temporary:t,theme:JSON.parse(await readFile(t,'utf8')).theme});if(calls.length===1)throw refusal('EBUSY');return rename(t,p);};
 const f=await fixture({replaceFile,wait:async()=>{entered();await resume;}}),later=new AppearanceStore(f.root,{replaceFile});
 const first=f.store.set({theme:'dark'});await gate;const second=later.set({theme:'sakura'});await delay(0);assert.equal(calls.length,1);assert.equal((await f.original.read()).theme,'kpmg');release();
 assert.deepEqual(await first,{ok:true,theme:'dark'});assert.deepEqual(await second,{ok:true,theme:'sakura'});assert.deepEqual(calls.map(c=>c.theme),['dark','dark','sakura']);assert.equal(calls[0].temporary,calls[1].temporary);assert.notEqual(calls[1].temporary,calls[2].temporary);assert.equal((await f.original.read()).theme,'sakura');
});

test('real private-shell store transaction loses captured authority during retry and cannot commit',async()=>{
 let live=true,calls=0;const f=await fixture({replaceFile:async()=>{calls++;throw refusal('EPERM');},wait:async()=>{live=false;}}),old=await readFile(f.path),frame={},sender={},grant={role:'code'};
 const result=await invokeShell({event:{sender,senderFrame:frame},capture:()=>grant,isCurrent:()=>live,method:'setAppearance',payload:{theme:'dark'},store:f.store});
 assert.deepEqual(result,{ok:false,code:'ACCESS_REFUSED'});assert.equal(calls,1);assert.deepEqual(await readFile(f.path),old);assert.deepEqual(await pending(f.root),[]);
});

test('actual Windows denied Delete-sharing handle is released after a genuine rename EPERM, then production commit succeeds',{skip:process.platform!=='win32'},async()=>{
 const f=await fixture(),ready=join(f.root,'held.ready'),release=join(f.root,'release.ready');const quote=x=>"'"+x.replaceAll("'","''")+"'";
 const script=`$Target=${quote(f.path)};$Ready=${quote(ready)};$Release=${quote(release)};$s=[IO.FileStream]::new($Target,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::ReadWrite);try{[IO.File]::WriteAllText($Ready,'held');$w=[Diagnostics.Stopwatch]::StartNew();while(-not [IO.File]::Exists($Release)){if($w.ElapsedMilliseconds -gt 10000){throw 'fixture timeout'};Start-Sleep -Milliseconds 10}}finally{$s.Dispose()}`;
 const child=spawn('powershell.exe',['-NoProfile','-Command',script],{windowsHide:true,stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',b=>stderr+=b);const done=new Promise((yes,no)=>{child.once('error',no);child.once('exit',(code,signal)=>yes({code,signal}));});
 let first;try{for(let i=0;i<1000;i++){try{await readFile(ready);break;}catch{if(i===999)throw Error('Holder did not start: '+stderr);await delay(10);}}
  let calls=0;const store=new AppearanceStore(f.root,{replaceFile:async(t,p)=>{calls++;try{return await rename(t,p);}catch(e){first??={code:e.code,syscall:e.syscall};await writeFile(release,'release');assert.deepEqual(await done,{code:0,signal:null});throw e;}}});
  assert.deepEqual(await store.set({theme:'dark'}),{ok:true,theme:'dark'});assert.equal(calls,2);assert.deepEqual(first,{code:'EPERM',syscall:'rename'});assert.deepEqual(await f.original.read(),{ok:true,theme:'dark'});assert.deepEqual(await pending(f.root),[]);
 }finally{await writeFile(release,'release');await done;}
});
