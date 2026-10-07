import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { allowedAppFile } from '../scripts/package.mjs';

test('actual package entry admits both fixed startup branches and the private protocol without a renderer bridge',async()=>{
 const metadata=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));assert.equal(metadata.main,'src/start.mjs');
 for(const path of ['src/start.mjs','src/account/pin-worker.mjs','src/account/pin-protection.mjs','src/account/pin-protocol.mjs'])assert.equal(allowedAppFile(path,new Set()),true,path);
 const text=await readFile(new URL('../src/start.mjs',import.meta.url),'utf8');
 for(const [argv,expected]of [[['electron','.'],'./main.mjs'],[['electron','.','--siren-pin-worker-v1=X'],'./account/pin-worker.mjs'],[['electron','--siren-pin-worker-unknown'],'./account/pin-worker.mjs']]){
  const calls=[],context=vm.createContext({process:{argv},dispatch:async path=>calls.push(path)});
  await vm.runInContext('(async()=>{'+text.replaceAll('import(','dispatch(')+'})()',context);assert.deepEqual(calls,[expected]);
 }
 const worker=await readFile(new URL('../src/account/pin-worker.mjs',import.meta.url),'utf8');assert.doesNotMatch(worker,/import.*(?:main\.mjs|BrowserWindow|ipcMain|net)/);assert.match(worker,/requestSingleInstanceLock/);
});
