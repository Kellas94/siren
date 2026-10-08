import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {join,isAbsolute} from 'node:path';
import {requireQualifiedConptyPlatform,requireSelectedOsConpty} from './terminal-conpty-platform.mjs';
const source=readFileSync(new URL('./terminal-electron-broker-worker.mjs',import.meta.url),'utf8').replace(/^import[^\n]*\n/gm,'');
async function observe({platform='win32',arch='x64',windowsVersion='10.0.26100',backend}={}){
 let loads=0,spawns=0;const errors=[];
 const fakeRequire=name=>{
  if(name==='node-pty/package.json')return{version:'1.1.0'};
  assert.equal(name,'node-pty');loads++;
  if(!backend)throw Error('UNQUALIFIED_PTY_LOAD');
  return{spawn(){spawns++;return{_agent:{_useConpty:backend.useConpty,_useConptyDll:backend.useConptyDll},onExit(){throw Error('POST_BACKEND_GUARD_REACHED');}};}};
 };
 let failure;try{await runInNewContext('(async()=>{'+source+'})()',{
  assert,join,isAbsolute,release:()=>windowsVersion,requireQualifiedConptyPlatform,requireSelectedOsConpty,
  process:{argv:['electron','worker','C:\\probe'],pid:321,platform,arch,env:{ELECTRON_RUN_AS_NODE:'1'},versions:{electron:'44.5.1',modules:'149'}},
  createRequire:()=>fakeRequire,readFile:async()=>Buffer.from(JSON.stringify({fixture:'C:\\fixed.exe',packagePath:'C:\\package.json'})),writeFile:async(_path,data)=>{errors.push(JSON.parse(data));},Buffer
 },{timeout:1000});}catch(error){failure=error.message;}
 return{failure,loads,spawns,errors};
}
test('actual worker refuses unsupported platforms before loading PTY or starting a child',async()=>{
 for(const options of [{windowsVersion:'10.0.18308'},{windowsVersion:'6.3.9600'},{platform:'linux'},{arch:'arm64'},{windowsVersion:'unknown'}]){
  const r=await observe(options);assert.equal(r.failure,'CONPTY_PLATFORM_REFUSED');assert.equal(r.loads,0);assert.equal(r.spawns,0);assert.equal(r.errors[0].message,r.failure);
 }
});
test('actual worker refuses observed fallback or bundled DLL before output/helper/input setup',async()=>{
 for(const backend of [{useConpty:false,useConptyDll:false},{useConpty:true,useConptyDll:true},{useConpty:true},{useConpty:'true',useConptyDll:false}]){
  const r=await observe({backend});assert.equal(r.failure,'CONPTY_BACKEND_REFUSED');assert.equal(r.loads,1);assert.equal(r.spawns,1);assert.equal(r.errors[0].message,r.failure);
 }
});
test('eligible platform and observed exact backend reach next worker setup',async()=>{
 const r=await observe({backend:{useConpty:true,useConptyDll:false}});assert.equal(r.failure,'POST_BACKEND_GUARD_REACHED');assert.equal(r.loads,1);assert.equal(r.spawns,1);
});
