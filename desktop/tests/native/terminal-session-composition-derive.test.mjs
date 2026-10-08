import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let deriveSessionComposition;
try { ({deriveSessionComposition}=await import('./terminal-session-composition-derive.mjs')); } catch(e) { if(e.code!=='ERR_MODULE_NOT_FOUND')throw e; }
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const host=await read('../fixtures/terminal-host-guard/host.cc'),fixture=await read('../fixtures/terminal-job-list.cs');
test('composition preserves original host guard and adds a distinct native Session API',()=>{
 assert.equal(typeof deriveSessionComposition,'function','MISSING_NATIVE_SESSION_DERIVATION');
 const out=deriveSessionComposition({host,fixture,extension:'// inert extension\n'});
 assert.ok(out.host.includes('// inert extension\n}\nNAPI_MODULE_INIT()'));
 for(const name of ['createSession','watchRoot','captureSession','snapshotSession','stopSession','closeSession'])assert.ok(out.host.includes('"'+name+'"'));
 assert.equal(out.host.split('NAPI_MODULE_INIT()').length,2);
 assert.ok(out.fixture.includes('File.Exists(Path.Combine(directory,"root-exit.request"))'));
 assert.ok(out.fixture.includes('return 51;'));
 assert.ok(fixture.includes('Thread.Sleep(12000);return 0;'));
});
test('composition refuses changed base source or absent extension',()=>{
 assert.equal(typeof deriveSessionComposition,'function','MISSING_NATIVE_SESSION_DERIVATION');
 for(const changed of [{host:host+' ',fixture},{host,fixture:fixture+' '},{host,fixture,extension:''}])assert.throws(()=>deriveSessionComposition({extension:'// extension\n',...changed}));
});
test('derived fixture emits the exact readiness sentinel required by the unchanged PTY worker',async()=>{
 const worker=await read('./terminal-electron-broker-worker.mjs');
 const sentinel=worker.match(/ring\.includes\(Buffer\.from\('([^']+)'\)\)/)?.[1];assert.equal(sentinel,'SIREN_NATIVE_FIXED_READY');
 const out=deriveSessionComposition({host,fixture,extension:'// inert extension\n'});
 assert.equal(out.fixture.split('Console.WriteLine("'+sentinel+'");').length,2,'MISSING_FIXED_PTY_READINESS_SENTINEL');
 assert.ok(out.fixture.includes('Console.WriteLine("'+sentinel+'");return Fixture(args[0],args[1]);'));
 assert.equal(fixture.includes(sentinel),false,'ORIGINAL_FIXTURE_MUST_REMAIN_UNCHANGED');
});
