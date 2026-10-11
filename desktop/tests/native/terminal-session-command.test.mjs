import test from 'node:test';
import assert from 'node:assert/strict';
import {createLockContinuationFixture} from './terminal-session-command.mjs';

test('fixed PowerShell fixture waits for main release before producing completion proof',()=>{
 const f=createLockContinuationFixture({projectDirectory:"C:\\probe țară\\O'Brien",token:'a'.repeat(32)});
 assert.equal(f.input,"& 'C:\\probe țară\\O''Brien\\lock-continuation.ps1'\r");
 assert.ok(f.script.indexOf('WriteAllText($started')<f.script.indexOf('for ($i=0;'));
 assert.ok(f.script.indexOf('File]::Exists($release)')<f.script.indexOf('WriteAllText($completed'));
 assert.match(f.script,/\$i -lt 300/);assert.match(f.script,/Start-Sleep -Milliseconds 100/);
 assert.match(f.script,/throw 'SIREN_TEST_RELEASE_TIMEOUT'/);
 assert.match(f.script,/O''Brien/);assert.equal(f.expected,'a'.repeat(32));
 assert.match(f.forbiddenInput,/WriteAllText/);assert.ok(f.forbiddenInput.endsWith('\r'));
 assert.notEqual(f.completedPath,f.forbiddenPath);assert.notEqual(f.releasePath,f.startedPath);
 assert.equal(Object.isFrozen(f),true);
});
test('fixture refuses nonlocal, ambiguous, control-bearing paths and nonliteral tokens',()=>{
 for(const projectDirectory of ['relative','\\\\server\\project','C:\\a\\..\\b','C:\\a\nWrite-Host bad','C:\\CON','C:\\trailing.','C:\\x;bad\\NUL.txt','C:\\a:stream','C:\\a\\','C:\\a\\\\b']){
  assert.throws(()=>createLockContinuationFixture({projectDirectory,token:'b'.repeat(32)}),TypeError,projectDirectory);
 }
 for(const token of ['', 'abc', 'G'.repeat(32), 'a'.repeat(31)+'\n',{},null])assert.throws(()=>createLockContinuationFixture({projectDirectory:'C:\\probe',token}),TypeError);
});
test('command injection characters are literal inside escaped PowerShell strings',()=>{
 const f=createLockContinuationFixture({projectDirectory:"D:\\x';$(exit 9);#",token:'c'.repeat(32)});
 assert.equal(f.input,"& 'D:\\x'';$(exit 9);#\\lock-continuation.ps1'\r");
 assert.match(f.script,/x'';\$\(exit 9\);#/);
});
