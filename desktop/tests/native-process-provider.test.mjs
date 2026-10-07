import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as provider from '../src/recovery/native-process.mjs';

test('process reader resolves only a fixed development or packaged resource',()=>{
 assert.equal(provider.processReaderPaths('file:///C:/SIREN/src/recovery/native-process.mjs').executable,'C:\\SIREN\\native\\generated\\process-identity.exe');
 assert.equal(provider.processReaderPaths('file:///C:/SIREN/resources/app.asar/src/recovery/native-process.mjs').executable,'C:\\SIREN\\resources\\siren-process-identity.exe');
});

test('reader admission rejects changed binary or source recipe and invokes no shell',async()=>{
 const source=await readFile(new URL('../native/process-identity.cs',import.meta.url));
 const binary=Buffer.alloc(1024);binary.write('MZok');const changed=Buffer.from(binary);changed[3]^=1;
 const metadata={schema:1,kind:'windows-process-reader',sourceSha256:provider.processReaderSourceSha256,binary:{bytes:binary.length,sha256:provider.hashProcessReader(binary)}};
 assert.equal(provider.processReaderSourceSha256,provider.hashProcessReader(Buffer.from(source.toString('utf8').replaceAll('\r\n','\n'))));
 assert.equal(provider.admitProcessReader(metadata,binary),true);
 for(const wrong of [{...metadata,sourceSha256:'0'.repeat(64)},{...metadata,binary:{...metadata.binary,bytes:1025}},{...metadata,binary:{...metadata.binary,sha256:'0'.repeat(64)}}])assert.throws(()=>provider.admitProcessReader(wrong,binary));
 assert.throws(()=>provider.admitProcessReader(metadata,changed));
 const calls=[];
 const result=await provider.runWindowsIdentity(123,{timeout:10000,maxBuffer:16384},{read:async path=>path.endsWith('.json')?Buffer.from(JSON.stringify(metadata)):binary,execute:async(file,args,options)=>{calls.push({file,args,options});return {stdout:'null',stderr:''};}});
 assert.equal(result.stdout,'null');assert.equal(calls.length,1);
 assert.equal(calls[0].file.endsWith('process-identity.exe'),true);assert.deepEqual(calls[0].args,['123']);assert.equal(calls[0].options.shell,false);assert.equal(calls[0].options.windowsHide,true);assert.equal(calls[0].options.timeout,10000);
 for(const pid of [0,-1,'123',Number.MAX_SAFE_INTEGER,1.2])await assert.rejects(provider.runWindowsIdentity(pid,{}));
});

test('missing or changed reader cannot invoke a process or fall back to PowerShell',async()=>{
 let executions=0;const execute=async()=>{executions++;return {stdout:'null',stderr:''};};
 await assert.rejects(provider.runWindowsIdentity(123,{timeout:10000,maxBuffer:16384},{read:async()=>{throw Object.assign(Error('MISSING'),{code:'ENOENT'});},execute}));
 await assert.rejects(provider.runWindowsIdentity(123,{timeout:10000,maxBuffer:16384},{read:async path=>path.endsWith('.json')?Buffer.from('{"schema":1,"kind":"windows-process-reader","sourceSha256":"changed"}'):Buffer.from('MZok'),execute}));
 assert.equal(executions,0);
});
