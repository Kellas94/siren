import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, basename, join } from 'node:path';
import * as protocol from '../src/account/pin-protocol.mjs';
const source=(await readFile(new URL('../src/account/pin-worker.mjs',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
function observe(text,{operation='encrypt',requireKey=true,busy=false,flags}={}){
 const profile=resolve('owned-pin-fixture','Access','PinProtection'),request={schema:1,nonce:'a'.repeat(32),operation,requireKey,...(operation==='encrypt'?{text:'synthetic verifier'}:{cipher64:'YQ=='})},input=protocol.encodePinFrame(request),seen={exit:null,ready:0,path:0};let offset=0;
 const stopped=Error('Owned worker stopped'),app={exit(code){seen.exit=code;throw stopped;},setPath(){seen.path++;},disableHardwareAcceleration(){},requestSingleInstanceLock:()=>!busy,on(){},whenReady(){seen.ready++;return {then(){return {catch(){}};}};}};
 const context=vm.createContext({Buffer,process:{argv:flags??['electron','--siren-pin-worker-v1='+profile]},app,safeStorage:{},resolve,dirname,basename,join,...protocol,
  lstatSync(path){if(['Local State','Preferences'].includes(basename(path)))throw Object.assign(Error('Owned missing fixture'),{code:'ENOENT'});return {isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>false};},realpathSync:path=>path,
  readSync(_fd,bytes,start,length){const n=Math.min(length,input.length-offset);input.copy(bytes,start,offset,offset+n);offset+=n;return n;},writeSync(){throw Error('Unexpected secret output');}});
 try{vm.runInContext(text,context);}catch(error){if(error!==stopped)throw error;}return seen;
}
test('actual worker refuses missing required key before native readiness; only first new encryption may create a key',()=>{
 for(const operation of ['encrypt','decrypt'])assert.deepEqual(observe(source,{operation}),{exit:23,ready:0,path:0});
 assert.deepEqual(observe(source,{requireKey:false}),{exit:null,ready:1,path:2});
});
test('actual worker rejects unknown and duplicate worker flags, and occupied profiles before readiness',()=>{
 for(const flags of [['electron','--siren-pin-worker-v2=X'],['electron','--siren-pin-worker-v1=X','--siren-pin-worker-v1=X']])assert.deepEqual(observe(source,{flags}),{exit:23,ready:0,path:0});
 assert.deepEqual(observe(source,{requireKey:false,busy:true}),{exit:23,ready:0,path:2});
});
test('required-key test has a negative control against the former parent-only guard',()=>{
 const old=source.replace("||name==='Local State'&&request.requireKey",'');assert.notEqual(old,source);assert.equal(observe(old,{operation:'encrypt'}).ready,1);
});
