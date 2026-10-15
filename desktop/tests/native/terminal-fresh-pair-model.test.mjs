// Synthetic DATA only. No runtime, provider, command, or environment is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {hashFreshRuntimeFiles,hashFreshEnvironment,validateFreshRuntime,validateFreshPairPlan,validateConnectWitness,compareFreshPair} from './terminal-fresh-pair-model.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const H=sha('synthetic'), token='1'.repeat(32), commit='2'.repeat(40);
const roles=['electron-executable','electron-distribution','provider-js','provider-native','creator-addon','creator-launcher','helper','source','engine'];
const clone=value=>JSON.parse(JSON.stringify(value));
// Independent fixture framing: ASCII domain+NUL, u32 count, then length-prefixed
// UTF8 strings, u64 byte counts, and raw 32-byte SHA256. No model helper is used.
function frame(domain,rows){
 const chunks=[Buffer.from(domain+'\0')],count=Buffer.alloc(4);count.writeUInt32BE(rows.length);chunks.push(count);
 for(const row of rows)for(const value of row){
  if(typeof value==='number'){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(value));chunks.push(b);}
  else if(value?.hash){chunks.push(Buffer.from(value.hash,'hex'));}
  else{const b=Buffer.from(value),n=Buffer.alloc(4);n.writeUInt32BE(b.length);chunks.push(n,b);}
 }
 return sha(Buffer.concat(chunks));
}
const envHash=entries=>frame('SIREN_FRESH_ENV_V1',entries.map(e=>[e.key,e.bytes,{hash:e.sha256}]));
const runtimeHash=files=>frame('SIREN_FRESH_RUNTIME_V1',files.map(f=>[f.path,f.role,f.bytes,{hash:f.sha256}]));
const entry=(key,value)=>({key,bytes:Buffer.byteLength(value),sha256:sha(value)});
function fixture(){
 const files=roles.map((role,i)=>({path:`runtime/${i}.bin`,role,bytes:i+1,sha256:sha(role==='provider-js'?'same-derivative':role)}));
 const runtime={schema:1,scope:'WITHIN_JOB_FRESH',runtimeId:token,files,sha256:runtimeHash(files)};
 const base=[entry('PATH','synthetic-path'),entry('TEMP','synthetic-temp'),entry('TMP','synthetic-tmp')];
 const trusted=entry('PATHEXT','synthetic-trusted-scalar');
 const arms=[{armId:'pathext-omitted',token:'3'.repeat(32),env:base,envSha256:envHash(base),cwdSha256:sha('cwd0'),commandLineSha256:sha('cmd0')},
  {armId:'pathext-trusted',token:'4'.repeat(32),env:[...base,trusted],envSha256:envHash([...base,trusted]),cwdSha256:sha('cwd1'),commandLineSha256:sha('cmd1')}];
 const plan={schema:1,runId:'12345',attempt:1,commit,runtime,sourceSha256:H,derivativeSha256:sha('same-derivative'),
  target:"Write-Output 'SIREN_PIPELINE_CONTROL'",iterations:300,intervalMs:50,nominalBudgetMs:15000,
  normalizedScriptSha256:sha('original-normalized-script'),trustedPathext:{source:'CURRENT_RUNNER_PATHEXT',bytes:trusted.bytes,sha256:trusted.sha256},arms};
 return {runtime,plan};
}
function witnesses(plan){
 const checked=validateFreshPairPlan(plan);assert.equal(checked.ok,true);
 return plan.arms.map((arm,i)=>({schema:1,runId:plan.runId,attempt:1,commit,armId:arm.armId,token:arm.token,
  planSha256:checked.planSha256,workerPid:100+i*10,creatorPid:101+i*10,
  shell:{pid:102+i*10,imageSha256:sha('engine'),birthTicks:String(100000+i)},
  heldShell:{pid:102+i*10,imageSha256:sha('engine'),birthTicks:String(100000+i)},
  runtimeSha256:plan.runtime.sha256,derivativeSha256:plan.derivativeSha256,
  boundary:'JS_NATIVE_CONNECT_ARGUMENTS',argumentCount:6,commandLineSha256:arm.commandLineSha256,cwdSha256:arm.cwdSha256,
  env:clone(arm.env),envSha256:arm.envSha256,useConptyDll:false,returnStatus:'RETURNED',argumentsUnchanged:true,
  clock:'PROCESS_MONOTONIC',beforeConnectMs:20,afterConnectMs:21}));
}
function pair(){
 const {plan}=fixture(),ws=witnesses(plan);
 const outcomes=plan.arms.map((arm,i)=>({armId:arm.armId,token:arm.token,workerPid:ws[i].workerPid,
  status:'COMPLETE',diskComplete:true,privateMarkers:true,backendMarkers:true,unavailableCount:0,
  cleanup:'VERIFIED',nativeStop:true,externalJoin:true,runtimeAfterSha256:plan.runtime.sha256}));
 return {plan,witnesses:ws,outcomes};
}

test('fresh inventory accepts explicit nine-role DATA and recomputes exact digest',()=>{
 const {runtime}=fixture();assert.equal(validateFreshRuntime(runtime).ok,true);
 assert.equal(hashFreshRuntimeFiles(runtime.files).sha256,runtime.sha256);
});
test('omission and trusted PATHEXT vectors admit exactly the declared treatment',()=>{
 const {plan}=fixture();assert.equal(validateFreshPairPlan(plan).ok,true);
 assert.equal(hashFreshEnvironment(plan.arms[0].env).sha256,plan.arms[0].envSha256);
});
test('complete paired synthetic DATA never asserts native authority or historical equality',()=>{
 const result=compareFreshPair(pair());assert.equal(result.ok,true);assert.equal(result.verdict,'SYNTHETIC_DATA_CONSISTENT');
 assert.equal(result.nativeAttested,false);assert.equal(result.oldRuntimeEquivalent,false);assert.equal(result.rootCauseProved,false);
});

test('empty runtime files require the actual SHA of empty bytes',()=>{
 const {runtime}=fixture();runtime.files[0].bytes=0;runtime.files[0].sha256=sha('');runtime.sha256=runtimeHash(runtime.files);
 assert.equal(validateFreshRuntime(runtime).ok,true);
});
test('empty env values require the actual SHA of empty bytes',()=>{
 const empty=entry('EMPTY','');assert.equal(hashFreshEnvironment([empty]).ok,true);
 empty.sha256=H;assert.equal(hashFreshEnvironment([empty]).ok,false);
});
for(const [name,edit] of [
 ['missing distribution',r=>r.files.splice(1,1)],
 ['bad digest',r=>r.sha256=H],
 ['duplicate path',r=>r.files[1].path=r.files[0].path],
 ['case alias',r=>r.files[1].path=r.files[0].path.toUpperCase()],
 ['parent traversal',r=>r.files[0].path='../outside.bin'],
 ['Windows reserved path',r=>r.files[0].path='CON/file.bin'],
 ['zero bytes forged hash',r=>{r.files[0].bytes=0;r.sha256=runtimeHash(r.files);}],
 ['foreign scope',r=>r.scope='OLD_RUNTIME_REUSED'],
 ['extra authority field',r=>r.nativeAttested=true],
 ['unsafe size',r=>r.files[0].bytes=Number.MAX_SAFE_INTEGER],
])test(`inventory refuses ${name}`,()=>{
 const {runtime}=fixture();edit(runtime);if(name!=='bad digest')runtime.sha256=runtimeHash(runtime.files);
 assert.equal(validateFreshRuntime(runtime).ok,false);
});

for(const [name,edit,code] of [
 ['PATH changed',p=>p.arms[1].env[0].sha256=H,'SECOND_TREATMENT'],
 ['TEMP changed',p=>p.arms[1].env[1].sha256=H,'SECOND_TREATMENT'],
 ['TMP changed',p=>p.arms[1].env[2].sha256=H,'SECOND_TREATMENT'],
 ['PSModulePath added',p=>p.arms[1].env.push(entry('PSModulePath','anything')),'SECOND_TREATMENT'],
 ['nonselected order changed',p=>p.arms[1].env.reverse(),'SECOND_TREATMENT'],
 ['case normalization',p=>p.arms[1].env[0].key='Path','SECOND_TREATMENT'],
 ['selected value changed',p=>p.arms[1].env[3].sha256=H,'TRUSTED_PATHEXT'],
 ['selected alias',p=>p.arms[1].env[3].key='PathExt','ENV_PATHEXT_ALIAS'],
 ['selected unexpectedly present',p=>p.arms[0].env.push(entry('PATHEXT','synthetic-trusted-scalar')),'PATHEXT_NOT_OMITTED'],
 ['guessed provenance',p=>p.trustedPathext.source='DEFAULT_EXTENSION_LIST','TRUSTED_PATHEXT'],
 ['empty scalar',p=>p.trustedPathext.bytes=0,'TRUSTED_PATHEXT'],
 ['oversize scalar',p=>p.trustedPathext.bytes=1025,'TRUSTED_PATHEXT'],
 ['duplicate key',p=>p.arms[1].env.push(entry('path','other')),'ENV_DUPLICATE'],
 ['target rewritten',p=>p.target="Microsoft.PowerShell.Utility\\Write-Output 'SIREN_PIPELINE_CONTROL'",'TARGET_OR_BOUND_CHANGED'],
 ['wait changed',p=>p.nominalBudgetMs=30000,'TARGET_OR_BOUND_CHANGED'],
 ['iteration changed',p=>p.iterations=301,'TARGET_OR_BOUND_CHANGED'],
 ['extra field',p=>p.allOSStateInventoried=true,'DATA_SHAPE'],
 ['foreign arm',p=>p.arms[0].armId='qualified','ARM_CONTEXT'],
 ['token reused',p=>p.arms[1].token=p.arms[0].token,'ARM_TOKEN_REUSE'],
 ['derivative absent',p=>p.derivativeSha256=H,'DERIVATIVE_NOT_IN_RUNTIME'],
])test(`plan refuses ${name}`,()=>{
 const {plan}=fixture();plan.arms[1].env=clone(plan.arms[1].env);edit(plan);
 for(const a of plan.arms)a.envSha256=envHash(a.env);
 assert.equal(validateFreshPairPlan(plan).code,code);
});

for(const [name,edit,code] of [
 ['foreign run',w=>w.runId='777','WITNESS_CONTEXT'],
 ['foreign commit',w=>w.commit='a'.repeat(40),'WITNESS_CONTEXT'],
 ['foreign token',w=>w.token='a'.repeat(32),'WITNESS_CONTEXT'],
 ['foreign plan',w=>w.planSha256=H,'WITNESS_CONTEXT'],
 ['extra authority',w=>w.kernelAttested=true,'DATA_SHAPE'],
 ['missing argument',w=>w.argumentCount=5,'CONNECT_BOUNDARY'],
 ['fallback flag',w=>w.useConptyDll=true,'CONNECT_BOUNDARY'],
 ['not returned',w=>w.returnStatus='PENDING','CONNECT_BOUNDARY'],
 ['mutated arguments',w=>w.argumentsUnchanged=false,'CONNECT_BOUNDARY'],
 ['command hash changed',w=>w.commandLineSha256=H,'CONNECT_ARGUMENT_DRIFT'],
 ['cwd hash changed',w=>w.cwdSha256=H,'CONNECT_ARGUMENT_DRIFT'],
 ['env changed',w=>w.env[0].sha256=H,'CONNECT_ENV_DRIFT'],
 ['runtime drift',w=>w.runtimeSha256=H,'WITNESS_RUNTIME_DRIFT'],
 ['derivative drift',w=>w.derivativeSha256=H,'WITNESS_RUNTIME_DRIFT'],
 ['held PID mismatch',w=>w.heldShell.pid++,'HELD_PID_MISMATCH'],
 ['held birth mismatch',w=>w.heldShell.birthTicks='999','HELD_PID_MISMATCH'],
 ['image mismatch',w=>w.heldShell.imageSha256=H,'HELD_PID_MISMATCH'],
 ['worker equals shell',w=>w.workerPid=w.shell.pid,'PROCESS_IDENTITY'],
 ['infinite clock',w=>w.afterConnectMs=Infinity,'CONNECT_CLOCK'],
 ['backwards clock',w=>w.afterConnectMs=19,'CONNECT_CLOCK'],
])test(`connect witness refuses ${name}`,()=>{
 const {plan}=fixture(),w=witnesses(plan)[0];edit(w);assert.equal(validateConnectWitness(w,plan).code,code);
});

for(const [name,edit,code] of [
 ['duplicate arm',p=>p.witnesses[1]=clone(p.witnesses[0]),'WITNESS_ORDER'],
 ['second worker reused',p=>p.witnesses[1].workerPid=p.witnesses[0].workerPid,'FRESH_PROCESS_REUSE'],
 ['missing witness',p=>p.witnesses.pop(),'DATA_CAP'],
 ['extra arm',p=>p.witnesses.push(clone(p.witnesses[0])),'DATA_CAP'],
 ['foreign outcome',p=>p.outcomes[1].token='a'.repeat(32),'OUTCOME_CONTEXT'],
 ['missing outcome',p=>p.outcomes.pop(),'DATA_CAP'],
 ['missing disk proof',p=>p.outcomes[0].diskComplete=false,'FALSE_COMPLETION'],
 ['missing private markers',p=>p.outcomes[0].privateMarkers=false,'FALSE_COMPLETION'],
 ['missing backend markers',p=>p.outcomes[0].backendMarkers=false,'FALSE_COMPLETION'],
 ['callback unavailable',p=>p.outcomes[0].unavailableCount=1,'FALSE_COMPLETION'],
 ['pending native cleanup',p=>p.outcomes[0].cleanup='PENDING','CLEANUP_ADVERSE'],
 ['native stop false',p=>p.outcomes[0].nativeStop=false,'CLEANUP_ADVERSE'],
 ['external join false',p=>p.outcomes[0].externalJoin=false,'CLEANUP_ADVERSE'],
 ['runtime after drift',p=>p.outcomes[0].runtimeAfterSha256=H,'RUNTIME_AFTER_DRIFT'],
 ['forged summary type',p=>p.outcomes[0].nativeStop='true','OUTCOME_SHAPE'],
 ['missing flag',p=>delete p.outcomes[0].externalJoin,'DATA_SHAPE'],
])test(`pair refuses ${name}`,()=>{const p=pair();edit(p);assert.equal(compareFreshPair(p).code,code);});

test('a declared failed original arm stays adverse despite consistent cleanup summaries',()=>{
 const p=pair();p.outcomes[0].status='FAILED';p.outcomes[0].diskComplete=false;
 const result=compareFreshPair(p);assert.equal(result.ok,false);assert.equal(result.code,'COMMAND_ADVERSE');
 assert.equal(result.cleanupConsistent,true);assert.equal(result.outcomes[0].status,'FAILED');
});
test('accepted copies are detached and deeply immutable',()=>{
 const {plan}=fixture(),result=validateFreshPairPlan(plan);assert.equal(result.ok,true);
 plan.arms[0].env[0].sha256=H;assert.notEqual(result.plan.arms[0].env[0].sha256,H);
 assert.throws(()=>result.plan.arms[0].env[0].sha256=H,TypeError);
 assert.equal(Object.isFrozen(result.plan.runtime.files[0]),true);
});
test('plain null-prototype DATA is accepted without toJSON or callback hooks',()=>{
 const {runtime}=fixture();assert.equal(validateFreshRuntime(Object.assign(Object.create(null),runtime)).ok,true);
 let called=0;runtime.then=()=>{called++;};assert.equal(validateFreshRuntime(runtime).ok,false);assert.equal(called,0);
});
test('Proxy traps and accessor payloads are never executed by any parser',()=>{
 let calls=0;const evil=new Proxy({}, {get(){calls++;throw Error();},getPrototypeOf(){calls++;throw Error();},ownKeys(){calls++;throw Error();}});
 const {plan}=fixture();for(const run of [()=>hashFreshRuntimeFiles(evil),()=>hashFreshEnvironment(evil),()=>validateFreshRuntime(evil),()=>validateFreshPairPlan(evil),()=>validateConnectWitness(evil,plan),()=>compareFreshPair(evil)])assert.equal(run().ok,false);
 const r=fixture().runtime;Object.defineProperty(r,'files',{enumerable:true,get(){calls++;throw Error();}});assert.equal(validateFreshRuntime(r).ok,false);
 const arr=[];arr.length=513;Object.defineProperty(arr,'0',{enumerable:true,get(){calls++;throw Error();}});assert.equal(hashFreshEnvironment(arr).code,'DATA_CAP');
 const many=[];many.length=8193;Object.defineProperty(many,'0',{enumerable:true,get(){calls++;throw Error();}});assert.equal(hashFreshRuntimeFiles(many).code,'DATA_CAP');
 assert.equal(calls,0);
});
test('caps reject aggregate env bytes and sparse, symbolic, non-enumerable or enriched arrays',()=>{
 assert.equal(hashFreshEnvironment(Array.from({length:8},(_,i)=>({key:`K${i}`,bytes:32768,sha256:H}))).code,'ENV_CAP');
 for(const enrich of [a=>a.length=2,a=>a[Symbol('extra')]=1,a=>Object.defineProperty(a,'0',{value:a[0],enumerable:false}),a=>a.extra=1]){
  const a=[entry('PATH','x')];enrich(a);assert.equal(hashFreshEnvironment(a).ok,false);
 }
});
test('framing distinguishes order, key boundaries, byte counts and hashes',()=>{
 const a=[entry('A','bc'),entry('AB','c')],b=[...a].reverse();
 assert.notEqual(hashFreshEnvironment(a).sha256,hashFreshEnvironment(b).sha256);
 const c=clone(a);c[0].bytes++;assert.notEqual(hashFreshEnvironment(a).sha256,hashFreshEnvironment(c).sha256);
 const d=clone(a);d[0].sha256=H;assert.notEqual(hashFreshEnvironment(a).sha256,hashFreshEnvironment(d).sha256);
});
test('length framing matches an independent Python stdlib literal vector',()=>{
 assert.equal(hashFreshEnvironment([entry('PATH','x')]).sha256,'02825897a0fc02a020c1218fc9f31c83ff48d8684e05d136942ee9acb06fc6cf');
});
test('every malformed boundary reports explicit adverse scope without authority',()=>{
 for(const result of [hashFreshRuntimeFiles(null),hashFreshEnvironment(null),validateFreshRuntime(null),validateFreshPairPlan(null),validateConnectWitness(null,null),compareFreshPair(null)]){
  assert.equal(result.ok,false);assert.equal(result.verdict,'ADVERSE');assert.equal(result.nativeAttested,false);
  assert.equal(result.oldRuntimeEquivalent,false);assert.equal(result.rootCauseProved,false);
 }
});
