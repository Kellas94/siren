import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('actual startup retains readonly identity refusal and records bounded diagnostics without native paths',async()=>{
 const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
 const start=main.indexOf('const processIdentity ='),end=main.indexOf('const journal =',start);
 assert.ok(start>=0&&end>start);const warnings=[];
 const context=vm.createContext({process:{pid:123},console:{warn:value=>warnings.push(value)},inspectWindowsProcess:async(pid,options)=>{
  assert.equal(pid,123);assert.equal(typeof options?.onFailure,'function');
  options.onFailure({name:'Error',code:'ETIMEDOUT',killed:true,signal:'SIGTERM',path:'PRIVATE_NATIVE_PATH'});
  options.onFailure({name:'PRIVATE_NATIVE_PATH',code:'PRIVATE_NATIVE_PATH with spaces',killed:false,signal:'PRIVATE_NATIVE_PATH'});
  return undefined;
 }});
 await vm.runInContext('(async()=>{'+main.slice(start,end)+'return processIdentity;})()',context).then(result=>assert.equal(result,undefined));
 assert.equal(warnings.length,2);assert.equal(warnings.some(s=>s.includes('PRIVATE_NATIVE_PATH')),false);
 assert.deepEqual(JSON.parse(warnings[0].slice(warnings[0].indexOf('{'))),{category:'Error',code:'ETIMEDOUT',killed:true,signal:'SIGTERM'});
 assert.deepEqual(JSON.parse(warnings[1].slice(warnings[1].indexOf('{'))),{category:'UNKNOWN',code:null,killed:false,signal:null});
});
