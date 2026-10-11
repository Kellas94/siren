// Prospective finite diagnostic controls. Conditional VM IO/process seams only;
// no actual native receipt, provider, Electron, compiler, shell or child launch.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import * as crypto from 'node:crypto';
import * as url from 'node:url';
import * as util from 'node:util';
const driver=readFileSync(new URL('./terminal-fresh-pair-driver.mjs',import.meta.url),'utf8');
const provision=readFileSync(new URL('./terminal-fresh-runtime-provision.mjs',import.meta.url),'utf8');
async function isolated(fault){
 const calls=[],saved=[];let hooks=0;
 const opaque=new Proxy({},{get(){hooks++;throw 0;},getOwnPropertyDescriptor(){hooks++;throw 0;}});
 const receipt={ok:true,status:'FRESH_RUNTIME_BUILT_RETAINED_NOT_SESSION_ADMISSION',root:'C:\\repo',jobRoot:'C:\\job',retainedRuntime:'C:\\job\\retained\\fresh-runtime',projectDirectory:'C:\\job\\project-\u0218iren-\u0394',run:'123',attempt:'1',commit:'a'.repeat(40)};
 if(fault==='project')receipt.projectDirectory='C:\\wrong';
 const process={platform:fault==='context'?'linux':'win32',arch:'x64',versions:{node:'24.16.0'},pid:10,execPath:'C:\\node\\node.exe',env:{GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Kellas94/siren',GITHUB_REF:'refs/heads/probe/terminal-session-20261010',GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40)}};
 const fs={async mkdir(p){calls.push(['mkdir',p]);if(fault==='directory')throw opaque;},async readFile(p,encoding){calls.push(['read',p]);if(fault==='pin'||fault==='pin-save')throw opaque;return encoding?'for(let i=0;i<300;i++) await delay(50)':Buffer.from('same pinned inert DATA');},async writeFile(p,data){calls.push(['write',p]);if(fault==='plan'&&p.endsWith('parent-plan.json')||(fault==='save'||fault==='pin-save')&&p.endsWith('pair-result.json'))throw opaque;saved.push([p,p.endsWith('.json')?JSON.parse(data):data]);}};
 const child={spawn(){calls.push(['spawn']);throw opaque;},execFile(file,args,options,callback){calls.push(['helper',args[0]]);if(fault==='engine')callback(opaque);else callback(null,args[0]==='system'?JSON.stringify('C:\\Windows\\System32'):JSON.stringify({file:true,reparse:false,canonicalPath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'}),'');}};
 child.execFile[util.promisify.custom]=(...args)=>new Promise((resolve,reject)=>child.execFile(...args,(error,stdout,stderr)=>error?reject(error):resolve({stdout,stderr})));
 const env={captureFreshPairLaunchEnvironment(){calls.push(['capture']);if(fault==='environment')throw opaque;const arm={env:[],envSha256:'b'.repeat(64),environment:{}};return {ok:true,omitted:arm,trusted:arm,trustedPathext:{}};}};
 const fixture={createOriginalResolutionFixture({projectDirectory,token}){calls.push(['fixture']);if(fault==='fixture')throw opaque;return{scriptPath:path.win32.join(projectDirectory,'fixed.ps1'),script:'inert DATA',expected:token};}};
 const context=vm.createContext({Buffer,URL,process,performance:{now:()=>1},setTimeout(){throw Error('No real timers in this conditional control');},clearTimeout(){}});
 const module=new vm.SourceTextModule(driver,{context,importModuleDynamically:async()=>{const m=new vm.SyntheticModule(['validateHostAsyncReceipt'],function(){this.setExport('validateHostAsyncReceipt',()=>{throw 0;});},{context});await m.link(()=>{throw 0;});await m.evaluate();return m;}});
 await module.link(name=>{const data=name==='node:assert/strict'?{default:assert}:name==='node:crypto'?crypto:name==='node:path'?{...path,default:path.win32}:name==='node:url'?url:name==='node:util'?util:name==='node:fs/promises'?fs:name==='node:child_process'?child:name.endsWith('terminal-fresh-runtime-provision.mjs')?{async recheckProvisionedFreshRuntime(){calls.push(['recheck']);if(fault==='private-throw')throw opaque;return fault!=='private';}}:name.endsWith('terminal-fresh-environment.mjs')?env:name.endsWith('terminal-connect-raw-file.mjs')?{readTerminalConnectRawFile(){throw 0;}}:fixture;return new vm.SyntheticModule(Object.keys(data),function(){for(const [k,v]of Object.entries(data))this.setExport(k,v);},{context});});
 await module.evaluate({timeout:500});assert.deepEqual(calls,[],'Import stays inert');return{api:module.namespace,receipt,calls,saved,hooks:()=>hooks};
}
test('actual driver reports only the literal first failing prelaunch boundary and never inspects thrown hooks',async()=>{
 for(const [fault,stage]of [['private','PRIVATE_RETENTION'],['private-throw','PRIVATE_RETENTION'],['context','HOSTED_CONTEXT'],['directory','RESULT_DIRECTORY'],['pin','RETAINED_INPUT_PINS'],['engine','ENGINE_IDENTITY'],['environment','COMMON_ENVIRONMENT'],['project','COMMON_PROJECT'],['fixture','FIXTURE_PREPARATION'],['plan','PLAN_RETENTION']]){const f=await isolated(fault),r=await f.api.runFreshTerminalPair(f.receipt);assert.equal(r.ok,false);assert.equal(r.failureStage,stage,fault);assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);assert.equal(f.hooks(),0);assert.equal(f.calls.some(x=>x[0]==='spawn'),false);assert.equal(JSON.stringify(r).includes('secret'),false);const retained=f.saved.find(([name])=>name.endsWith('pair-result.json'));if(retained)assert.equal(retained[1].failureStage,stage);}
});
test('actual driver extra args and consumed attempt stay refused with distinct literal stages',async()=>{
 const f=await isolated('private');const first=await f.api.runFreshTerminalPair(f.receipt,'extra');assert.equal(first.failureStage,'ARGUMENTS');assert.equal(f.calls.length,0);const again=await f.api.runFreshTerminalPair(f.receipt);assert.equal(again.code,'ATTEMPT_CONSUMED');assert.equal(again.failureStage,'ATTEMPT_CONSUMED');assert.equal(f.calls.length,0);
});
function projection(){const a=provision.indexOf('// FRESH_DIAGNOSTIC_PROJECTION_BEGIN'),b=provision.indexOf('// FRESH_DIAGNOSTIC_PROJECTION_END');assert.ok(a>0&&b>a,'Missing bounded CLI diagnostic projection');const context=vm.createContext({types:util.types,Buffer});new vm.Script(provision.slice(a,b)).runInContext(context,{timeout:500});return context;}
test('actual CLI projection retains only allowlisted scalar fields and bounded phase DATA',()=>{
 const c=projection();c.value={ok:false,status:'FRESH_PAIR_FAILED_NOT_ADMITTED',code:'FIXED_PAIR_GATE_UNAVAILABLE',failureStage:'RETAINED_INPUT_PINS',secret:'NEVER_PRINT',env:{TOKEN:'NEVER_PRINT'},error:{stack:'NEVER_PRINT'}};c.kind='pair';const r=vm.runInContext('freshDiagnosticSummary(value,kind)',c,{timeout:500});assert.deepEqual(Object.keys(r),['schema','kind','ok','status','code','failureStage','actualSessions','phases']);assert.equal(r.failureStage,'RETAINED_INPUT_PINS');assert.equal(r.actualSessions,null);assert.equal(JSON.stringify(r).includes('NEVER_PRINT'),false);
 c.value={ok:true,status:'FRESH_RUNTIME_BUILT_RETAINED_NOT_SESSION_ADMISSION',realSessions:0,phases:[{name:'historical-source-stage',exit:0,stdout:'NEVER_PRINT',args:['NEVER_PRINT']}]};c.kind='build';const b=vm.runInContext('freshDiagnosticSummary(value,kind)',c);assert.equal(b.actualSessions,0);assert.deepEqual(JSON.parse(JSON.stringify(b.phases)),[{name:'historical-source-stage',exit:0,status:'EXITED'}]);assert.equal(JSON.stringify(b).includes('NEVER_PRINT'),false);
});
test('actual CLI projection refuses getters proxies unknown labels and excessive rows without hooks',()=>{
 const c=projection();let hooks=0;const trap=new Proxy({},{get(){hooks++;throw 0;},getOwnPropertyDescriptor(){hooks++;throw 0;}});for(const value of [trap,{ok:true,status:'SECRET_STATUS',failureStage:'SECRET_STAGE'},Object.defineProperty({ok:false,status:'FAILED_NOT_SESSION_ADMISSION'},'failureStage',{get(){hooks++;return 'SECRET_STAGE';}}),{ok:false,status:'FAILED_NOT_SESSION_ADMISSION',phases:Array(12).fill({name:'historical-source-stage',exit:0})},{ok:false,status:'FAILED_NOT_SESSION_ADMISSION',phases:[trap]}]){c.value=value;c.kind='build';const r=vm.runInContext('freshDiagnosticSummary(value,kind)',c,{timeout:500});assert.equal(JSON.stringify(r).includes('SECRET'),false);assert.ok(Buffer.byteLength(JSON.stringify(r))<=8192);}assert.equal(hooks,0);
});

test('projection safely refuses revoked array proxies before array inspection',()=>{
 const c=projection();for(const kind of ['build','pair']){const item=Proxy.revocable([],{});item.revoke();c.value={ok:false,status:kind==='build'?'FAILED_NOT_SESSION_ADMISSION':'FRESH_PAIR_FAILED_NOT_ADMITTED',[kind==='build'?'phases':'arms']:item.proxy};c.kind=kind;let result;assert.doesNotThrow(()=>{result=vm.runInContext('freshDiagnosticSummary(value,kind)',c,{timeout:500});});assert.equal(result.status,'DIAGNOSTIC_UNAVAILABLE');}
});

test('retention failure preserves the earliest driver refusal without retry or successful result',async()=>{
 const f=await isolated('pin-save'),r=await f.api.runFreshTerminalPair(f.receipt);assert.equal(r.ok,false);assert.equal(r.code,'PAIR_RESULT_RETENTION_FAILED');assert.equal(r.failureStage,'RETAINED_INPUT_PINS');assert.equal(r.retentionFailureStage,'PAIR_RESULT_RETENTION');assert.equal(f.hooks(),0);assert.equal(f.calls.filter(x=>x[0]==='write'&&x[1].endsWith('pair-result.json')).length,1);assert.equal(f.calls.some(x=>x[0]==='spawn'),false);
});
test('projection exact record caps retain eleven build phases and two arms but refuse any extra',()=>{
 const c=projection();for(const kind of ['build','pair'])for(const extra of [0,1]){const cap=kind==='build'?11:2,row=kind==='build'?{name:'historical-source-stage',exit:0}:{armId:'pathext-omitted',exit:{code:0},status:'FAILED'};c.value={ok:false,status:kind==='build'?'FAILED_NOT_SESSION_ADMISSION':'FRESH_PAIR_FAILED_NOT_ADMITTED',[kind==='build'?'phases':'arms']:Array(cap+extra).fill(row)};c.kind=kind;const r=vm.runInContext('freshDiagnosticSummary(value,kind)',c);assert.equal(r.phases.length,extra?0:cap);if(extra)assert.equal(r.status,'DIAGNOSTIC_UNAVAILABLE');}
});
