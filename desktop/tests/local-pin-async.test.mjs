import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp } from './fixtures/temporary.mjs';
import { LocalPinAccess } from '../src/account/local-pin.mjs';

function storage(prefix=Buffer.alloc(0)) {
 const key=randomBytes(32);return {isEncryptionAvailable:()=>true,
 encryptString(text){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv),b=Buffer.concat([c.update(text,'utf8'),c.final()]);return Buffer.concat([prefix,iv,c.getAuthTag(),b]);},
 decryptString(bytes){const b=bytes.subarray(prefix.length),d=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(12,28));return Buffer.concat([d.update(b.subarray(28)),d.final()]).toString('utf8');}};
}
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
async function fixture({fault}={}) {
 const root=await mkdtemp(join(tmpdir(),'siren-pin-async-')),legacy=storage(Buffer.from('v10')),native=storage();let encrypts=0,decrypts=0;
 const protector={isEncryptionAvailable:()=>true,async encryptString(text){encrypts++;return native.encryptString(text);},async decryptString(bytes){decrypts++;return native.decryptString(bytes);}};
 const access=new LocalPinAccess(root,legacy,{protector,fault});await access.initialize();
 return {root,legacy,native,protector,access,path:join(root,'Access/local-pin.bin'),counts:()=>({encrypts,decrypts})};
}
const input={pin:'0317',confirmation:'0317'};

test('new PIN waits for asynchronous protection and stores an explicit dedicated-provider envelope',async()=>{
 const f=await fixture(),entered=deferred(),release=deferred(),encrypt=f.protector.encryptString;
 f.protector.encryptString=async text=>{entered.resolve();await release.promise;return encrypt(text);};
 const pending=f.access.setup(input);await Promise.race([entered.promise,pending.then(()=>{throw Error('Setup completed without asynchronous protection');})]);
 assert.equal(f.access.busy,true);assert.equal(f.access.state().unlocked,false);assert.equal(f.access.state().configured,false);
 await assert.rejects(readFile(f.path),{code:'ENOENT'});release.resolve();assert.equal((await pending).ok,true);await f.access.drain();assert.equal(f.access.busy,false);
 const bytes=await readFile(f.path);assert.equal(bytes.subarray(0,10).toString('ascii'),'SIRENPIN2\0');
 const restarted=new LocalPinAccess(f.root,f.legacy,{protector:f.protector});await restarted.initialize();assert.equal(restarted.state().pinLength,4);assert.equal((await restarted.unlock({pin:input.pin})).ok,true);assert.ok(f.counts().decrypts>=2);
});

test('unknown legacy/new envelope versions refuse without invoking either decrypt backend or resetting bytes',async()=>{
 for(const header of [Buffer.from('v12'),Buffer.from('SIRENPIN3\0')]){
  const f=await fixture(),old=new LocalPinAccess(f.root,f.legacy);await old.initialize();await old.setup(input);const original=await readFile(f.path),bytes=Buffer.concat([header,original.subarray(3)]);await writeFile(f.path,bytes);
  let legacyReads=0;const decrypt=f.legacy.decryptString;f.legacy.decryptString=b=>{legacyReads++;return decrypt(b);};
  const again=new LocalPinAccess(f.root,f.legacy,{protector:f.protector});await again.initialize();assert.equal(again.state().blocked,true);assert.equal(legacyReads,0);assert.equal(f.counts().decrypts,0);assert.equal((await again.setup(input)).ok,false);assert.deepEqual(await readFile(f.path),bytes);
 }
});

test('post-rename readback uncertainty retains an existing configured record and fails closed',async()=>{
 const f=await fixture({fault:async phase=>{if(phase==='after-rename')throw Error('Owned readback uncertainty');}});
 assert.equal((await f.access.setup(input)).code,'PIN_STORAGE_UNAVAILABLE');assert.equal(f.access.state().configured,true);assert.equal(f.access.state().unlocked,false);assert.equal(f.access.state().blocked,true);
 const bytes=await readFile(f.path);assert.equal((await f.access.setup(input)).ok,false);assert.deepEqual(await readFile(f.path),bytes);
 const restarted=new LocalPinAccess(f.root,f.legacy,{protector:f.protector});await restarted.initialize();assert.equal((await restarted.unlock({pin:input.pin})).ok,true);
});

test('Lock revokes protection in progress before any PIN publication and drain waits for the operation',async()=>{
 const f=await fixture(),entered=deferred(),release=deferred(),encrypt=f.protector.encryptString;
 f.protector.encryptString=async text=>{entered.resolve();await release.promise;return encrypt(text);};
 const pending=f.access.setup(input);await Promise.race([entered.promise,pending.then(()=>{throw Error('Setup bypassed protection');})]);f.access.cancelPending();let drained=false;const drain=f.access.drain().then(()=>{drained=true;});
 await Promise.resolve();assert.equal(drained,false);release.resolve();assert.equal((await pending).code,'PIN_LOCKED');await drain;
 assert.equal(f.access.state().unlocked,false);assert.equal(f.access.state().configured,false);await assert.rejects(readFile(f.path),{code:'ENOENT'});
});

test('Lock during asynchronous load refuses even a wrong-PIN counter write',async()=>{
 const f=await fixture();assert.equal((await f.access.setup(input)).ok,true);f.access.lock();const before=await readFile(f.path),entered=deferred(),release=deferred(),decrypt=f.protector.decryptString;
 f.protector.decryptString=async bytes=>{entered.resolve();await release.promise;return decrypt(bytes);};
 const pending=f.access.unlock({pin:'9999'});await Promise.race([entered.promise,pending.then(()=>{throw Error('Unlock bypassed dedicated decryption');})]);f.access.lock();release.resolve();assert.equal((await pending).code,'PIN_LOCKED');assert.deepEqual(await readFile(f.path),before);assert.equal(f.access.state().unlocked,false);
});

test('legacy wrong-PIN counters stay legacy; only authenticated unlock migrates exact verifier to the new envelope',async()=>{
 const f=await fixture(),old=new LocalPinAccess(f.root,f.legacy);await old.initialize();assert.equal((await old.setup(input)).ok,true);
 const prior=JSON.parse(f.legacy.decryptString(await readFile(f.path))),access=new LocalPinAccess(f.root,f.legacy,{protector:f.protector});await access.initialize();
 assert.equal((await access.unlock({pin:'9999'})).code,'WRONG_PIN');const failed=JSON.parse(f.legacy.decryptString(await readFile(f.path)));assert.equal(failed.failures,1);assert.equal(f.counts().encrypts,0);
 assert.equal((await access.unlock({pin:input.pin})).ok,true);const bytes=await readFile(f.path);assert.equal(bytes.subarray(0,10).toString('ascii'),'SIRENPIN2\0');const next=JSON.parse(f.native.decryptString(bytes.subarray(10)));
 for(const key of ['salt','verifier','pinLength','kdf'])assert.equal(next[key],prior[key]);assert.equal(next.failures,0);
});

test('revocation at atomic pre-rename leaves no record; accepted rename retains exact record but never grants a revoked session',async()=>{
 for(const stage of ['before-rename','after-rename']){
  const entered=deferred(),release=deferred(),f=await fixture({fault:async phase=>{if(phase===stage){entered.resolve();await release.promise;}}});
  const pending=f.access.setup(input);await Promise.race([entered.promise,pending.then(()=>{throw Error('Setup bypassed publication phase guard');})]);f.access.lock();release.resolve();assert.equal((await pending).code,'PIN_LOCKED');assert.equal(f.access.state().unlocked,false);
  if(stage==='before-rename'){await assert.rejects(readFile(f.path),{code:'ENOENT'});assert.equal(f.access.state().configured,false);}
  else{const bytes=await readFile(f.path);assert.equal(bytes.subarray(0,10).toString('ascii'),'SIRENPIN2\0');assert.equal(f.access.state().configured,true);}
 }
});
