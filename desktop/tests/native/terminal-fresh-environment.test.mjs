// Isolated parent-environment capture with finite VM process DATA, not native proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as crypto from 'node:crypto';
import * as util from 'node:util';
import * as path from 'node:path';
const moduleURL=new URL('./terminal-fresh-environment.mjs',import.meta.url);
let source=null;
try{source=readFileSync(moduleURL,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
async function isolated(environment,platform='win32'){
 assert.notEqual(source,null,'Missing one-attempt fresh launch-environment capture');
 const context=vm.createContext({Buffer,process:{platform,env:environment}});
 const model=new vm.SourceTextModule(readFileSync(new URL('./terminal-fresh-pair-model.mjs',import.meta.url),'utf8'),{context});
 const own=new vm.SourceTextModule(source,{context});
 const modules=new Map();
 const linker=async name=>{
  if(name==='./terminal-fresh-pair-model.mjs')return model;
  const data={'node:crypto':crypto,'node:util':util,'node:path':path}[name];
  assert.ok(data,'Unexpected import '+name);
  if(!modules.has(name))modules.set(name,new vm.SyntheticModule(Object.keys(data),function(){for(const key of Object.keys(data))this.setExport(key,data[key]);},{context}));
  return modules.get(name);
 };
 await own.link(linker);await own.evaluate();
 assert.equal(typeof own.namespace.captureFreshPairLaunchEnvironment,'function');
 return own.namespace.captureFreshPairLaunchEnvironment;
}
const base=()=>({PATHEXT:'.COM;.EXE;.BAT;.CMD',TEMP:'C:\\Temp',TMP:'C:\\Temp',USERNAME:'user',USERPROFILE:'C:\\Users\\user',ProgramFiles:'C:\\Program Files','ProgramFiles(x86)':'C:\\Program Files (x86)'});
const clean=value=>JSON.parse(JSON.stringify(value));
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
test('captures one common immutable environment and changes only PATHEXT',async()=>{
 const capture=await isolated({...base(),PATH:'IGNORED_RUNNER_PATH',SystemRoot:'IGNORED_RUNNER_ROOT',NODE_OPTIONS:'SECRET',PRIVATE_TOKEN:'SECRET'});
 const r=capture('C:\\Windows\\System32');assert.equal(r.ok,true);
 assert.deepEqual(clean(r.omitted.environment),{SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32;C:\\Windows',USERPROFILE:'C:\\Users\\user',TEMP:'C:\\Temp',TMP:'C:\\Temp',ProgramFiles:'C:\\Program Files','ProgramFiles(x86)':'C:\\Program Files (x86)',USERNAME:'user'});
 assert.deepEqual(clean(r.trusted.environment),{...clean(r.omitted.environment),PATHEXT:base().PATHEXT});
 assert.deepEqual(clean(r.trusted.vector.filter(row=>!row.startsWith('PATHEXT='))),clean(r.omitted.vector));
 assert.deepEqual(clean(r.trusted.env.filter(row=>row.key!=='PATHEXT')),clean(r.omitted.env));
 assert.equal(r.trustedPathext.sha256,digest(base().PATHEXT));assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);
 for(const object of [r,r.omitted,r.omitted.environment,r.omitted.vector,r.omitted.env,r.omitted.env[0],r.trusted,r.trustedPathext])assert.ok(Object.isFrozen(object));
 assert.equal(capture('C:\\Windows\\System32').ok,false);
});
test('source values are detached after capture',async()=>{
 const env=base();const capture=await isolated(env);const r=capture('C:\\Windows\\System32');assert.equal(r.ok,true);
 env.TEMP='C:\\CHANGED';env.PATHEXT='.CHANGED';assert.equal(r.omitted.environment.TEMP,'C:\\Temp');assert.equal(r.trusted.environment.PATHEXT,base().PATHEXT);
 assert.equal(r.trusted.env.find(x=>x.key==='TEMP').sha256,digest('C:\\Temp'));
});
test('selected getter or Proxy environments refuse without invoking traps',async()=>{
 let calls=0;const env=base();Object.defineProperty(env,'TEMP',{enumerable:true,get(){calls++;throw 0;}});
 const a=await isolated(env);assert.equal(a('C:\\Windows\\System32').ok,false);
 const b=await isolated(new Proxy(base(),{getOwnPropertyDescriptor(){calls++;throw 0;},get(){calls++;throw 0;}}));assert.equal(b('C:\\Windows\\System32').ok,false);assert.equal(calls,0);
});
test('invalid system directory and extras do not coerce caller values and consume attempt',async()=>{
 let calls=0;
 for(const value of [null,{},new String('C:\\Windows\\System32'),{toString(){calls++;throw 0;}},'C:/Windows/System32','c:\\Windows\\System32','C:\\Windows\\..\\Windows\\System32','\\\\host\\Windows\\System32','C:\\Windows\\System32\\','C:\\Windows\\SysWOW64','C:\\Windows\\System32\0']){
  const capture=await isolated(base());assert.equal(capture(value).ok,false);assert.equal(capture('C:\\Windows\\System32').ok,false);
 }
 const capture=await isolated(base());assert.equal(capture('C:\\Windows\\System32',{}).ok,false);assert.equal(calls,0);
});
test('requires actual Windows anchor and trusted PATHEXT plus TEMP and TMP',async()=>{
 const bad=[{...base(),PATHEXT:''},{...base(),PATHEXT:undefined},{...base(),PATHEXT:42},{...base(),TEMP:undefined},{...base(),TMP:''}];
 for(const env of bad){const capture=await isolated(env);assert.equal(capture('C:\\Windows\\System32').ok,false);}
 const capture=await isolated(base(),'linux');assert.equal(capture('C:\\Windows\\System32').ok,false);
});
test('refuses malformed, NUL, per-scalar UTF8 and full Windows-block excess',async()=>{
 for(const env of [{...base(),TEMP:'x\0y'},{...base(),USERNAME:'\ud800'},{...base(),PATHEXT:'x'.repeat(1025)},{...base(),PATHEXT:'é'.repeat(513)},{...base(),TEMP:'é'.repeat(16385)},{...base(),TEMP:'x'.repeat(20000),TMP:'y'.repeat(20000)}]){
  const capture=await isolated(env);assert.equal(capture('C:\\Windows\\System32').ok,false);
 }
});
test('preserves Unicode, equals signs and exact empty/absent optional-field behavior',async()=>{
 const capture=await isolated({...base(),USERNAME:'Ștefan=Δ',USERDOMAIN:'',APPDATA:undefined,LOCALAPPDATA:null});
 const r=capture('C:\\Windows\\System32');assert.equal(r.ok,true);assert.equal(r.omitted.environment.USERNAME,'Ștefan=Δ');
 assert.equal(r.omitted.env.find(x=>x.key==='USERNAME').sha256,digest('Ștefan=Δ'));assert.equal(Object.hasOwn(r.omitted.environment,'USERDOMAIN'),false);assert.equal(Object.hasOwn(r.omitted.environment,'APPDATA'),false);assert.equal(Object.hasOwn(r.omitted.environment,'LOCALAPPDATA'),false);
});
test('fixed refusal never reflects raw values or environmental exceptions',async()=>{
 const env=base();Object.defineProperty(env,'PATHEXT',{get(){throw Error('SECRET');}});
 const capture=await isolated(env);const result=capture('C:\\Windows\\System32');assert.equal(result.ok,false);assert.equal(JSON.stringify(result).includes('SECRET'),false);assert.equal(result.nativeAdmission,false);assert.equal(result.inputAuthorized,false);
});
test('all original optional fields retain fixed order while unknown getters are untouched',async()=>{
 const env=base();const fields=['USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)','ProgramData','ComSpec','USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH','SystemDrive','windir'];
 for(const key of fields)env[key]='value='+key;
 let calls=0;Object.defineProperty(env,'NODE_OPTIONS',{get(){calls++;throw 0;}});
 const r=(await isolated(env))('C:\\Windows\\System32');assert.equal(r.ok,true);
 assert.deepEqual(clean(Object.keys(r.omitted.environment)),['SystemRoot','PATH',...fields]);assert.equal(r.trusted.vector.length,20);assert.equal(r.trusted.env.length,20);assert.equal(calls,0);
});
test('exact PATHEXT UTF8 bound is accepted, with its original bytes and whitespace',async()=>{
 const pathext=' '+'.EXE;'.repeat(204)+'abc';assert.equal(Buffer.byteLength(pathext),1024);
 const r=(await isolated({...base(),PATHEXT:pathext}))('C:\\Windows\\System32');assert.equal(r.ok,true);assert.equal(r.trusted.environment.PATHEXT,pathext);assert.equal(r.trustedPathext.bytes,1024);assert.equal(r.trustedPathext.sha256,digest(pathext));
});
test('actual isolated connect observer agrees with both captured environment vectors',async()=>{
 const {generateTerminalConnectDerivative}=await import('./terminal-connect-derivative.mjs');
 const original=readFileSync(new URL('../../../terminal-connect-derivative-20261011/original-data/windowsPtyAgent.js.source.txt',import.meta.url),'utf8');
 const generated=generateTerminalConnectDerivative(original);assert.equal(generated.ok,true);
 const captured=(await isolated({...base(),USERNAME:'Ștefan=Δ'}))('C:\\Windows\\System32');assert.equal(captured.ok,true);
 for(const arm of [captured.omitted,captured.trusted]){
  let clock=0;const context=vm.createContext({Buffer,exports:{},require(name){if(name==='node:crypto')return crypto;if(name==='node:util')return util;if(name==='node:perf_hooks')return {performance:{now:()=>++clock}};if(name==='node:process')return {pid:42};assert.fail('Unexpected observer import '+name);}});
  context.vector=vm.runInContext(JSON.stringify(arm.vector),context);
  vm.runInContext(generated.observerSource+'\nvar receiver={_useConptyDll:false,_innerPid:84};var ticket=__sirenConnectObserver.begin(vector,"powershell.exe -NoLogo","C:\\\\project",receiver);__sirenConnectObserver.finish(ticket,vector,"powershell.exe -NoLogo","C:\\\\project",receiver,true,true);',context,{timeout:500});
  const observation=context.exports.readConnectObservation();assert.equal(observation.phase,'RETURNED');
  for(const snapshot of [observation.before,observation.after]){assert.deepEqual(clean(snapshot.env),clean(arm.env));assert.equal(snapshot.envSha256,arm.envSha256);assert.equal(snapshot.totalBytes,arm.totalBytes);assert.equal(snapshot.blockCodeUnits,arm.blockCodeUnits);}
 }
});
