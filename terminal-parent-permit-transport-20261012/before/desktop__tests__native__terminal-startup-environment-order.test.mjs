// SOURCE_ONLY: actual startup codec and isolated capture/observer fragments.
// No provider, process or historical archive is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import * as crypto from 'node:crypto';
import * as util from 'node:util';
import * as path from 'node:path';
import {validateStartupEnvelope} from '../../src/terminal/startup-protocol.mjs';
import {generateTerminalConnectDerivative} from './terminal-connect-derivative.mjs';
import {hashFreshEnvironment} from './terminal-fresh-pair-model.mjs';
const clean=value=>JSON.parse(JSON.stringify(value));
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const original=readFileSync(new URL('../../../terminal-connect-derivative-20261011/original-data/windowsPtyAgent.js.source.txt',import.meta.url),'utf8');
async function capture(){
 const environment={PATHEXT:'.COM;.EXE;.BAT;.CMD',TEMP:'C:\\Temp',TMP:'C:\\Temp',USERPROFILE:'C:\\Users\\Ștefan',USERNAME:'Ștefan=Δ',ProgramFiles:'C:\\Program Files',SystemDrive:'C:',windir:'C:\\Windows'};
 const context=vm.createContext({Buffer,process:{platform:'win32',env:environment}});
 const model=new vm.SourceTextModule(readFileSync(new URL('./terminal-fresh-pair-model.mjs',import.meta.url),'utf8'),{context});
 const own=new vm.SourceTextModule(readFileSync(new URL('./terminal-fresh-environment.mjs',import.meta.url),'utf8'),{context});
 const modules=new Map();
 await own.link(async name=>{
  if(name==='./terminal-fresh-pair-model.mjs')return model;
  const data={'node:crypto':crypto,'node:util':util,'node:path':path}[name];assert.ok(data,name);
  if(!modules.has(name))modules.set(name,new vm.SyntheticModule(Object.keys(data),function(){for(const key of Object.keys(data))this.setExport(key,data[key]);},{context}));
  return modules.get(name);
 });await own.evaluate();const r=own.namespace.captureFreshPairLaunchEnvironment('C:\\Windows\\System32');assert.equal(r.ok,true);return r;
}
function startup(arm){
 const r=validateStartupEnvelope({version:1,sessionId:'session1',channelId:'channel1',projectId:'project1',startupId:'startup1',admissionEpoch:1,profileId:'powershell',cwd:'C:\\project',shell:{executable:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',args:['-NoLogo','-NoProfile'],env:clean(arm.environment)},cols:120,rows:40});
 assert.ok(r);return r.shell.env;
}
function rows(env){return Object.entries(env).map(([key,value])=>({key,bytes:Buffer.byteLength(value),sha256:hash(value)}));}
function observed(env){
 const generated=generateTerminalConnectDerivative(original);assert.equal(generated.ok,true);let clock=0;
 const context=vm.createContext({Buffer,exports:{},require(name){if(name==='node:crypto')return crypto;if(name==='node:util')return util;if(name==='node:perf_hooks')return{performance:{now:()=>++clock}};if(name==='node:process')return{pid:42};assert.fail(name);}});
 context.vector=vm.runInContext(JSON.stringify(Object.entries(env).map(([k,v])=>k+'='+v)),context);
 vm.runInContext(generated.observerSource+'\nvar receiver={_useConptyDll:false,_innerPid:84};var ticket=__sirenConnectObserver.begin(vector,"powershell.exe -NoLogo","C:\\\\project",receiver);__sirenConnectObserver.finish(ticket,vector,"powershell.exe -NoLogo","C:\\\\project",receiver,true,true);',context,{timeout:500});
 const result=context.exports.readConnectObservation();assert.equal(result.phase,'RETURNED');return result.before;
}
for(const name of ['omitted','trusted']){
 test(name+': startup expectation matches actual canonical codec and connect observer',async()=>{
  const arm=(await capture())[name],canonical=startup(arm),witness=observed(canonical);
  assert.notDeepEqual(clean(arm.env),rows(canonical),'Original launch order reproduces the rejected expectation');
  assert.deepEqual(clean(arm.startupEnv),rows(canonical));
  assert.deepEqual(clean(witness.env),clean(arm.startupEnv));assert.equal(witness.envSha256,arm.startupEnvSha256);
  assert.deepEqual(clean(arm.vector),Object.entries(clean(arm.environment)).map(([k,v])=>k+'='+v),'Launch capture is unchanged');
  assert.ok(Object.isFrozen(arm.startupEnv)&&arm.startupEnv.every(Object.isFrozen));
 });
 test(name+': changed value, missing key and reordered canonical witness remain adverse',async()=>{
  const arm=(await capture())[name];assert.ok(arm.startupEnv,'Missing startup boundary expectation');
  const expected=clean(arm.startupEnv),changed=structuredClone(expected),missing=expected.slice(1),reordered=[...expected].reverse();
  changed.find(r=>r.key==='TEMP').sha256=hash('different');
  for(const adverse of [changed,missing,reordered])assert.throws(()=>assert.deepEqual(adverse,expected));
  assert.equal(expected.some(r=>r.key==='PATHEXT'),name==='trusted');
  assert.equal(expected.find(r=>r.key==='USERNAME').sha256,hash('Ștefan=Δ'));
 });
}
test('worker profile check and both parent comparisons use the same startup boundary order',()=>{
 const driver=readFileSync(new URL('./terminal-fresh-pair-driver.mjs',import.meta.url),'utf8');
 const worker=readFileSync(new URL('./terminal-fresh-pair-worker.mjs',import.meta.url),'utf8');
 assert.ok(driver.includes('expectedEnvironment:arm.startupEnv'));
 assert.ok(driver.includes('requireParentRaw(raw,c,{env:arm.startupEnv,'));
 assert.ok(driver.includes('startupEnv:p.arm.startupEnv,startupEnvSha256:p.arm.startupEnvSha256'));
 const fragment=worker.slice(worker.indexOf('function freshEnvironmentRows('),worker.indexOf('function assertFreshBoundary('));
 const run=vm.runInNewContext('('+fragment.trim()+')',{assert,Buffer,createHash:crypto.createHash});
 assert.deepEqual(clean(run({SystemRoot:'C:\\Windows',PATH:'x',TEMP:'t'})).map(r=>r.key),['PATH','SystemRoot','TEMP']);
 assert.ok(worker.includes("rawBindingFailure='RAW_ENVIRONMENT';assert.deepEqual(r.before.env,expected.env);"),'Original strict raw comparison remains intact');
});
test('actual parent strict comparison accepts owned startup rows without a serialization-only prototype repair',()=>{
 const source=readFileSync(new URL('./terminal-fresh-environment.mjs',import.meta.url),'utf8').replace(/^import .+;\r?\n/gm,'').replace('export function captureFreshPairLaunchEnvironment','function captureFreshPairLaunchEnvironment');
 const makeArm=Function('createHash','types','path','hashFreshEnvironment',source+'\nreturn arm;')(crypto.createHash,util.types,path.win32,hashFreshEnvironment);
 const arm=makeArm({SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32',TEMP:'C:\\Temp',TMP:'C:\\Temp'});
 const driver=readFileSync(new URL('./terminal-fresh-pair-driver.mjs',import.meta.url),'utf8');
 const fragment=driver.slice(driver.indexOf('function requireParentRaw('),driver.indexOf('function consumeFreshChallenge('));
 const check=Function('assert','sha','return ('+fragment.trim()+');')(assert,hash);
 const before={useConptyDll:false,env:rows(startup(arm)),cwdSha256:hash('C:\\project'),commandLineSha256:hash('powershell.exe')};
 const record={ok:true,rawSha256:'a'.repeat(64),decoded:{observation:{creatorPid:42,returnedPid:84,argumentCount:6,count:1,duplicate:false,phase:'RETURNED',returnStatus:'RETURNED',pidAssignment:'ASSIGNED',argumentsUnchanged:true,captureCodes:[],before,after:structuredClone(before)}}};
 const challenge={rawSha256:record.rawSha256,creatorPid:42,shellPid:84};
 assert.equal(check(record,challenge,{env:arm.startupEnv,cwd:'C:\\project',commandLine:'powershell.exe'}),true);
});
