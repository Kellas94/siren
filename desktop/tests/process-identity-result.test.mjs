import test from 'node:test';
import assert from 'node:assert/strict';
import * as implementation from '../src/recovery/processes.mjs';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const actual={pid:123,path:'C:\\Owned\\Știință-日本-😀\\node.exe',startedAt:'2026-10-04T17:00:00.1234567Z'};
function decode(text,pid=123){assert.equal(typeof implementation.decodeWindowsProcessResult,'function','Native process replies need an exact decoder');return implementation.decodeWindowsProcessResult(text,pid);}
test('native process reply preserves exact Unicode executable and creation time for the requested PID',()=>{
 assert.deepEqual(decode(' \r\n'+JSON.stringify(actual)+'\r\n'),actual);
 assert.deepEqual(decode(JSON.stringify({...actual,path:'\\\\?\\C:\\Owned\\node.exe'})),{...actual,path:'\\\\?\\C:\\Owned\\node.exe'});
});
test('only explicit missing and exact unknown replies remain missing or unknown',()=>{
 assert.equal(decode('null'),null);assert.equal(decode('{"unknown":true}'),undefined);
 for(const value of [true,false,123,[],{},'PRIVATE_NATIVE_PATH',{unknown:false},{unknown:true,path:actual.path}])assert.throws(()=>decode(JSON.stringify(value)),{code:'PROCESS_RESULT_INVALID'});
});
test('malformed empty oversized and mismatched process replies cannot grant ownership',()=>{
 for(const text of ['', ' \r\n','PRIVATE_BODY',JSON.stringify(actual).slice(0,-1),' '.repeat(16385)])assert.throws(()=>decode(text),{code:'PROCESS_RESULT_INVALID'});
 for(const value of [{...actual,pid:124},{...actual,pid:'123'},{...actual,path:'relative.exe'},{...actual,path:'C:relative.exe'},{...actual,path:'C:\\bad\npath\\node.exe'},{...actual,startedAt:'not-a-time'},{...actual,startedAt:'2026-99-04T17:00:00Z'},{...actual,startedAt:'2026-02-31T17:00:00Z'},{...actual,extra:'PRIVATE_BODY'}])assert.throws(()=>decode(JSON.stringify(value)),{code:'PROCESS_RESULT_INVALID'});
});
test('identity reply refusal exposes only a finite reason without response text',()=>{
 const cases=[['','EMPTY_RESPONSE'],['PRIVATE_NATIVE_PATH_AND_BODY','INVALID_JSON'],[JSON.stringify({...actual,pid:124}),'PID_MISMATCH'],[JSON.stringify({...actual,path:'PRIVATE_NATIVE_PATH'}),'INVALID_PATH']];
 for(const [text,reason] of cases){let failure;try{decode(text);}catch(error){failure=error;}assert.equal(failure?.code,'PROCESS_RESULT_INVALID');assert.equal(failure?.reason,reason);assert.equal(failure?.message.includes('PRIVATE_NATIVE_PATH'),false);assert.equal(failure?.message.includes('PRIVATE_BODY'),false);}
});

test('drive-relative and current-drive-rooted paths cannot identify an executable',()=>{
 for(const path of ['/tmp/node.exe','\\Owned\\node.exe','C:\\Owned\\bad\ud800.exe'])assert.throws(()=>decode(JSON.stringify({...actual,path})),{code:'PROCESS_RESULT_INVALID'});
 assert.deepEqual(decode(JSON.stringify({...actual,path:'\\\\server\\share\\Owned\\node.exe'})),{...actual,path:'\\\\server\\share\\Owned\\node.exe'});
});

test('actual inspector distinguishes query and decode refusals, reports byte counts and never retries',async()=>{
 const source=await readFile(new URL('../src/recovery/processes.mjs',import.meta.url),'utf8'),marker='export async function inspectWindowsProcess(',body=source.slice(source.indexOf(marker)).replace('export ','');
 for(const [reply,phase,reason,expectedStdout,expectedStderr] of [[{stdout:'',stderr:'PRIVATE_BODY'},'decode','EMPTY_RESPONSE',0,12],[{stdout:'PRIVATE_NATIVE_PATH',stderr:''},'decode','INVALID_JSON',19,0],[Object.assign(Error('PRIVATE_BODY'),{code:'EPERM',stdout:'PRIVATE_NATIVE_PATH',stderr:'PRIVATE_BODY'}),'query','QUERY_FAILED',19,12]]){
  let calls=0;const events=[];const inspect=runInNewContext('('+body+')',{process:{platform:'win32'},Buffer,decodeWindowsProcessResult:implementation.decodeWindowsProcessResult,run:async(file,args,options)=>{calls++;assert.equal(file,'powershell.exe');assert.equal(options.timeout,10000);assert.equal(options.maxBuffer,16384);assert.match(args[3],/Get-Process -Id 123 /);if(reply instanceof Error)throw reply;return reply;}});
  assert.equal(await inspect(123,{onFailure:event=>events.push(event)}),undefined);assert.equal(calls,1);assert.equal(events.length,1);
  assert.equal(events[0].phase,phase);assert.equal(events[0].reason,reason);assert.equal(events[0].stdoutBytes,expectedStdout);assert.equal(events[0].stderrBytes,expectedStderr);assert.equal(JSON.stringify(events).includes('PRIVATE_BODY'),false);assert.equal(JSON.stringify(events).includes('PRIVATE_NATIVE_PATH'),false);
 }
});

test('native stderr cannot turn a refused query into missing process or grant live ownership',async()=>{
 const source=await readFile(new URL('../src/recovery/processes.mjs',import.meta.url),'utf8'),marker='export async function inspectWindowsProcess(',body=source.slice(source.indexOf(marker)).replace('export ','');
 for(const stdout of ['null',JSON.stringify(actual)]){
  let calls=0;const failures=[];const inspect=runInNewContext('('+body+')',{process:{platform:'win32'},Buffer,decodeWindowsProcessResult:implementation.decodeWindowsProcessResult,run:async(file,args,options)=>{calls++;assert.equal(options.timeout,10000);return {stdout,stderr:'PRIVATE_QUERY_ERROR'};}});
  assert.equal(await inspect(123,{onFailure:f=>failures.push(f)}),undefined);assert.equal(calls,1);assert.equal(failures.length,1);assert.equal(failures[0].phase,'decode');assert.equal(failures[0].reason,'NATIVE_STDERR');assert.equal(failures[0].stderrBytes,19);assert.equal(JSON.stringify(failures).includes('PRIVATE_QUERY_ERROR'),false);
 }
});
