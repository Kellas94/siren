// Prospective diagnostic DATA only. No filesystem, environment, provider or process
// access. Consistent supplied DATA is not proof that a witness was captured honestly.
import {createHash} from 'node:crypto';
import {types} from 'node:util';

const roles=['electron-executable','electron-distribution','provider-js','provider-native','creator-addon','creator-launcher','helper','source','engine'];
const arms=['pathext-omitted','pathext-trusted'];
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const token=value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value);
const integer=(value,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const text=(value,max)=>typeof value==='string'&&value.length<=max&&value.isWellFormed();
const fail=code=>{throw new Error(code);};
const requireThat=(condition,code)=>{if(!condition)fail(code);};
const freeze=Object.freeze;
const emptySha256='e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
function record(value,keys){
 requireThat(value!==null&&typeof value==='object'&&!types.isProxy(value)&&!Array.isArray(value),'DATA_SHAPE');
 const proto=Object.getPrototypeOf(value);requireThat(proto===Object.prototype||proto===null,'DATA_SHAPE');
 // No value access until exact field count and data descriptors are checked.
 const own=Reflect.ownKeys(value);requireThat(own.length===keys.length,'DATA_SHAPE');
 const out=Object.create(null);
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);
  requireThat(d?.enumerable&&Object.hasOwn(d,'value'),'DATA_SHAPE');out[key]=d.value;}
 return out;
}
function list(value,max,min=0){
 requireThat(value!==null&&typeof value==='object'&&!types.isProxy(value)&&Array.isArray(value),'DATA_SHAPE');
 requireThat(Object.getPrototypeOf(value)===Array.prototype,'DATA_SHAPE');
 const n=Object.getOwnPropertyDescriptor(value,'length')?.value;
 requireThat(integer(n,max)&&n>=min,'DATA_CAP');
 requireThat(Reflect.ownKeys(value).length===n+1,'DATA_SHAPE');
 const out=[];
 for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));
  requireThat(d?.enumerable&&Object.hasOwn(d,'value'),'DATA_SHAPE');out.push(d.value);}
 return out;
}
function guarded(work){try{return work();}catch(error){return freeze({ok:false,code:error.message,verdict:'ADVERSE',...identity()});}}
function identity(){return {nativeAttested:false,oldRuntimeEquivalent:false,rootCauseProved:false,lockQualified:false,generalCommandsQualified:false};}

// Framing: ASCII domain + NUL; u32BE row count; each string is u32BE
// UTF8 length + bytes, each byte count is u64BE, each SHA is raw 32 bytes.
// Environment order is significant. Runtime files must already be path-sorted.
function digest(domain,rows){
 const chunks=[Buffer.from(domain+'\0')],count=Buffer.alloc(4);count.writeUInt32BE(rows.length);chunks.push(count);
 for(const row of rows)for(const [type,value] of row){
  if(type==='bytes'){const b=Buffer.alloc(8);b.writeBigUInt64BE(BigInt(value));chunks.push(b);}
  else if(type==='hash')chunks.push(Buffer.from(value,'hex'));
  else{const b=Buffer.from(value,'utf8'),n=Buffer.alloc(4);n.writeUInt32BE(b.length);chunks.push(n,b);}
 }
 return createHash('sha256').update(Buffer.concat(chunks)).digest('hex');
}
function environment(value){
 const entries=list(value,512),seen=new Set();let total=0;
 const result=entries.map(raw=>{const e=record(raw,['key','bytes','sha256']);
  requireThat(text(e.key,128)&&/^(?:[A-Za-z_][A-Za-z0-9_]*|(?:ProgramFiles|CommonProgramFiles)\(x86\))$/i.test(e.key),'ENV_KEY');
  requireThat(integer(e.bytes,32768)&&hash(e.sha256)&&(e.bytes!==0||e.sha256===emptySha256),'ENV_VALUE');
  const folded=e.key.toUpperCase();requireThat(!seen.has(folded),'ENV_DUPLICATE');seen.add(folded);
  requireThat(folded!=='PATHEXT'||e.key==='PATHEXT','ENV_PATHEXT_ALIAS');
  // Includes key, '=', value and a terminating NUL; no alias/path normalization.
  total+=Buffer.byteLength(e.key)+e.bytes+2;requireThat(total<=262144,'ENV_CAP');return freeze(e);
 });
 const sha256=digest('SIREN_FRESH_ENV_V1',result.map(e=>[['text',e.key],['bytes',e.bytes],['hash',e.sha256]]));
 return freeze({entries:freeze(result),sha256});
}
function files(value){
 const rows=list(value,8192,1),seen=new Set();let previous='',total=0;
 const result=rows.map(raw=>{const f=record(raw,['path','role','bytes','sha256']);
  requireThat(text(f.path,1024)&&/^[A-Za-z0-9_./-]+$/.test(f.path)&&!f.path.startsWith('/')&&
   f.path.split('/').every(part=>part!==''&&part!=='.'&&part!=='..'&&part.length<=255&&!part.endsWith('.')&&
    !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(part)),'RUNTIME_PATH');
  requireThat(f.path>previous&&!seen.has(f.path.toUpperCase()),'RUNTIME_DUPLICATE_OR_ORDER');previous=f.path;seen.add(f.path.toUpperCase());
  requireThat(roles.includes(f.role)&&integer(f.bytes,8*1024**3)&&hash(f.sha256)&&(f.bytes!==0||f.sha256===emptySha256),'RUNTIME_FILE');
  total+=f.bytes;requireThat(total<=128*1024**3,'RUNTIME_CAP');return freeze(f);
 });
 const sha256=digest('SIREN_FRESH_RUNTIME_V1',result.map(f=>[['text',f.path],['text',f.role],['bytes',f.bytes],['hash',f.sha256]]));
 return freeze({files:freeze(result),sha256});
}
function runtime(value){
 const r=record(value,['schema','scope','runtimeId','files','sha256']);
 requireThat(r.schema===1&&r.scope==='WITHIN_JOB_FRESH'&&token(r.runtimeId),'RUNTIME_CONTEXT');
 const data=files(r.files);requireThat(roles.every(role=>data.files.some(f=>f.role===role)),'RUNTIME_INCOMPLETE');
 requireThat(hash(r.sha256)&&r.sha256===data.sha256,'RUNTIME_HASH');r.files=data.files;return freeze(r);
}
function equalEnvironment(a,b){return a.length===b.length&&a.every((e,i)=>e.key===b[i].key&&e.bytes===b[i].bytes&&e.sha256===b[i].sha256);}
function plan(value){
 const p=record(value,['schema','runId','attempt','commit','runtime','sourceSha256','derivativeSha256','target','iterations','intervalMs','nominalBudgetMs','normalizedScriptSha256','trustedPathext','arms']);
 requireThat(p.schema===1&&typeof p.runId==='string'&&/^[1-9][0-9]{0,19}$/.test(p.runId)&&integer(p.attempt,100)&&p.attempt>0&&
  typeof p.commit==='string'&&/^[a-f0-9]{40}$/.test(p.commit),'PLAN_CONTEXT');
 requireThat(hash(p.sourceSha256)&&hash(p.derivativeSha256)&&hash(p.normalizedScriptSha256),'PLAN_HASH');
 requireThat(p.target==="Write-Output 'SIREN_PIPELINE_CONTROL'"&&p.iterations===300&&p.intervalMs===50&&p.nominalBudgetMs===15000,'TARGET_OR_BOUND_CHANGED');
 p.runtime=runtime(p.runtime);
 requireThat(p.runtime.files.some(f=>f.role==='provider-js'&&f.sha256===p.derivativeSha256),'DERIVATIVE_NOT_IN_RUNTIME');
 const trusted=record(p.trustedPathext,['source','bytes','sha256']);
 requireThat(trusted.source==='CURRENT_RUNNER_PATHEXT'&&integer(trusted.bytes,1024)&&trusted.bytes>0&&hash(trusted.sha256),'TRUSTED_PATHEXT');p.trustedPathext=freeze(trusted);
 p.arms=freeze(list(p.arms,2,2).map((raw,i)=>{const a=record(raw,['armId','token','env','envSha256','cwdSha256','commandLineSha256']);
  requireThat(a.armId===arms[i]&&token(a.token)&&hash(a.cwdSha256)&&hash(a.commandLineSha256),'ARM_CONTEXT');
  const e=environment(a.env);requireThat(hash(a.envSha256)&&a.envSha256===e.sha256,'ENV_HASH');a.env=e.entries;return freeze(a);
 }));
 const [omitted,trustedArm]=p.arms;requireThat(omitted.token!==trustedArm.token,'ARM_TOKEN_REUSE');
 requireThat(!omitted.env.some(e=>e.key==='PATHEXT'),'PATHEXT_NOT_OMITTED');
 const selected=trustedArm.env.find(e=>e.key==='PATHEXT');requireThat(selected&&selected.bytes===trusted.bytes&&selected.sha256===trusted.sha256,'TRUSTED_PATHEXT');
 requireThat(equalEnvironment(omitted.env,trustedArm.env.filter(e=>e.key!=='PATHEXT')),'SECOND_TREATMENT');
 requireThat(['PATH','TEMP','TMP'].every(key=>omitted.env.some(e=>e.key===key)),'ENV_REQUIRED');
 const frozen=freeze(p);
 // Plan framing is a single fixed-order canonical validated DATA JSON string.
 const planSha256=digest('SIREN_FRESH_PLAN_V1',[[['text',JSON.stringify(frozen)]]]);
 return freeze({plan:frozen,planSha256});
}
function shell(value){
 const s=record(value,['pid','imageSha256','birthTicks']);requireThat(integer(s.pid,0xffffffff)&&s.pid>0&&hash(s.imageSha256)&&
  typeof s.birthTicks==='string'&&/^[1-9][0-9]{0,18}$/.test(s.birthTicks)&&BigInt(s.birthTicks)<=3155378975999999999n,'SHELL_IDENTITY');return freeze(s);
}
function witness(value,declared){
 const {plan:p,planSha256}=declared;
 const w=record(value,['schema','runId','attempt','commit','armId','token','planSha256','workerPid','creatorPid','shell','heldShell','runtimeSha256','derivativeSha256','boundary','argumentCount','commandLineSha256','cwdSha256','env','envSha256','useConptyDll','returnStatus','argumentsUnchanged','clock','beforeConnectMs','afterConnectMs']);
 const a=p.arms.find(arm=>arm.armId===w.armId);
 requireThat(w.schema===1&&a&&w.runId===p.runId&&w.attempt===p.attempt&&w.commit===p.commit&&w.token===a.token&&w.planSha256===planSha256,'WITNESS_CONTEXT');
 requireThat(w.runtimeSha256===p.runtime.sha256&&w.derivativeSha256===p.derivativeSha256,'WITNESS_RUNTIME_DRIFT');
 requireThat(w.boundary==='JS_NATIVE_CONNECT_ARGUMENTS'&&w.argumentCount===6&&w.useConptyDll===false&&w.returnStatus==='RETURNED'&&w.argumentsUnchanged===true,'CONNECT_BOUNDARY');
 requireThat(w.commandLineSha256===a.commandLineSha256&&w.cwdSha256===a.cwdSha256,'CONNECT_ARGUMENT_DRIFT');
 const env=environment(w.env);requireThat(w.envSha256===env.sha256&&w.envSha256===a.envSha256&&equalEnvironment(env.entries,a.env),'CONNECT_ENV_DRIFT');w.env=env.entries;
 w.shell=shell(w.shell);w.heldShell=shell(w.heldShell);
 requireThat(w.shell.pid===w.heldShell.pid&&w.shell.imageSha256===w.heldShell.imageSha256&&w.shell.birthTicks===w.heldShell.birthTicks,'HELD_PID_MISMATCH');
 requireThat(p.runtime.files.some(f=>f.role==='engine'&&f.sha256===w.shell.imageSha256),'SHELL_IMAGE_DRIFT');
 requireThat(integer(w.workerPid,0xffffffff)&&w.workerPid>0&&integer(w.creatorPid,0xffffffff)&&w.creatorPid>0&&new Set([w.workerPid,w.creatorPid,w.shell.pid]).size===3,'PROCESS_IDENTITY');
 requireThat(w.clock==='PROCESS_MONOTONIC'&&typeof w.beforeConnectMs==='number'&&Number.isFinite(w.beforeConnectMs)&&w.beforeConnectMs>=0&&
  typeof w.afterConnectMs==='number'&&Number.isFinite(w.afterConnectMs)&&w.afterConnectMs>=w.beforeConnectMs,'CONNECT_CLOCK');return freeze(w);
}

export function hashFreshRuntimeFiles(value){return guarded(()=>freeze({ok:true,...files(value)}));}
export function hashFreshEnvironment(value){return guarded(()=>freeze({ok:true,...environment(value)}));}
export function validateFreshRuntime(value){return guarded(()=>freeze({ok:true,runtime:runtime(value),...identity()}));}
export function validateFreshPairPlan(value){return guarded(()=>freeze({ok:true,...plan(value),...identity()}));}
export function validateConnectWitness(value,declared){return guarded(()=>freeze({ok:true,witness:witness(value,plan(declared)),...identity()}));}
export function compareFreshPair(value){return guarded(()=>{
 const input=record(value,['plan','witnesses','outcomes']),declared=plan(input.plan),p=declared.plan;
 const ws=list(input.witnesses,2,2).map((raw,i)=>{const w=witness(raw,declared);requireThat(w.armId===arms[i],'WITNESS_ORDER');return w;});
 requireThat(new Set(ws.flatMap(w=>[w.workerPid,w.creatorPid,w.shell.pid])).size===6,'FRESH_PROCESS_REUSE');
 let complete=true;
 const outcomes=list(input.outcomes,2,2).map((raw,i)=>{const o=record(raw,['armId','token','workerPid','status','diskComplete','privateMarkers','backendMarkers','unavailableCount','cleanup','nativeStop','externalJoin','runtimeAfterSha256']);
  requireThat(o.armId===arms[i]&&o.token===p.arms[i].token&&o.workerPid===ws[i].workerPid,'OUTCOME_CONTEXT');
  requireThat(['COMPLETE','FAILED'].includes(o.status)&&['diskComplete','privateMarkers','backendMarkers','nativeStop','externalJoin'].every(key=>typeof o[key]==='boolean')&&integer(o.unavailableCount,4096),'OUTCOME_SHAPE');
  requireThat(o.cleanup==='VERIFIED'&&o.nativeStop&&o.externalJoin,'CLEANUP_ADVERSE');
  requireThat(o.runtimeAfterSha256===p.runtime.sha256,'RUNTIME_AFTER_DRIFT');
  const markers=o.diskComplete&&o.privateMarkers&&o.backendMarkers&&o.unavailableCount===0;
  requireThat(o.status!=='COMPLETE'||markers,'FALSE_COMPLETION');
  complete&&=o.status==='COMPLETE'&&markers;return freeze(o);
 });
 return freeze({ok:complete,code:complete?'DATA_CONSISTENT':'COMMAND_ADVERSE',verdict:complete?'SYNTHETIC_DATA_CONSISTENT':'ADVERSE',
  planSha256:declared.planSha256,outcomes:freeze(outcomes),cleanupConsistent:true,...identity()});
});}
