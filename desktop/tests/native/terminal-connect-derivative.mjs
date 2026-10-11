// Pure source/DATA generator. It never reads an environment, filesystem or provider.
import {createHash} from 'node:crypto';
const ORIGINAL_SHA='8636d16b38266112204061a22b135734177c242837982fd3a4055be726efa64a';
const ALLOWLIST=Object.freeze(['SystemRoot','PATH','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)','ProgramData','ComSpec','USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH','SystemDrive','windir','PATHEXT']);
const PROVENANCE=Object.freeze({workerSha256:'15927e2abc7e60e1b4222937f8283ebdb6d7fd2965d15a362f78d635becac609',profilesSha256:'7e13976cb5caafd5ee7c0bd3fdd0bf9be276592cc2ce116455a31b53c63e9a43',selectedKeyAddition:'PATHEXT',originalAllowlistSource:'terminal-resolution-original-worker.mjs:194'});
const sha=raw=>createHash('sha256').update(raw).digest('hex');

// This function is converted to source only. Its body runs only as an isolated
// fragment in pure tests; no full retained module is ever evaluated here.
function terminalConnectObserver(){
 'use strict';
 const crypto=require('node:crypto'),types=require('node:util').types,performance=require('node:perf_hooks').performance;
 const hash=crypto.createHash.bind(crypto),now=performance.now.bind(performance),creatorPid=require('node:process').pid;
 const allow=new Set(['SystemRoot','PATH','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)','ProgramData','ComSpec','USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH','SystemDrive','windir','PATHEXT']);
 const slot={schema:1,boundary:'JS_NATIVE_CONNECT_ARGUMENTS',argumentCount:6,creatorPid,clock:'PROCESS_MONOTONIC',count:0,duplicate:false,phase:'UNSEEN',before:null,after:null,beforeConnectMs:null,afterConnectMs:null,returnStatus:'NOT_CALLED',pidAssignment:'NOT_ATTEMPTED',returnedPid:null,argumentsUnchanged:null,captureCodes:[]};
 let firstEnv=null,firstReceiver=null,beforeValid=false,afterValid=false;
 const codes=new Set(['SCALAR_REFUSED','VECTOR_REFUSED','RECEIVER_REFUSED','FLAG_REFUSED','PAIR_REFUSED','KEY_REFUSED','VALUE_REFUSED','BLOCK_REFUSED','PID_REFUSED','CLOCK_REFUSED','DUPLICATE_CONNECT','OBSERVER_ERROR']);
 const issue=code=>{const fixed=codes.has(code)?code:'OBSERVER_ERROR';if(slot.captureCodes.length<3&&!slot.captureCodes.includes(fixed))slot.captureCodes.push(fixed);};
 const invalid=code=>{throw code;};
 const digest=raw=>hash('sha256').update(raw).digest('hex');
 function scalar(value,limit,empty=false){
  if(typeof value!=='string'||!value.isWellFormed()||value.includes('\0')||value.length>limit||!empty&&!value.length)invalid('SCALAR_REFUSED');
  const bytes=Buffer.byteLength(value,'utf8');if(bytes>limit*4)invalid('SCALAR_REFUSED');return {bytes,sha256:digest(Buffer.from(value,'utf8'))};
 }
 function capture(env,commandLine,cwd,receiver){
  if(types.isProxy(env)||!Array.isArray(env)||Object.getPrototypeOf(env)!==Array.prototype)invalid('VECTOR_REFUSED');
  const length=Object.getOwnPropertyDescriptor(env,'length')?.value;if(!Number.isSafeInteger(length)||length<1||length>512||Reflect.ownKeys(env).length!==length+1)invalid('VECTOR_REFUSED');
  if(!receiver||types.isProxy(receiver)||typeof receiver!=='object')invalid('RECEIVER_REFUSED');
  const flag=Object.getOwnPropertyDescriptor(receiver,'_useConptyDll');if(!flag||!Object.hasOwn(flag,'value')||typeof flag.value!=='boolean')invalid('FLAG_REFUSED');
  const rows=[],seen=new Set();let totalBytes=0,blockCodeUnits=1;
  for(let i=0;i<length;i++){
   const descriptor=Object.getOwnPropertyDescriptor(env,String(i));if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))invalid('VECTOR_REFUSED');
   const pair=descriptor.value;if(typeof pair!=='string'||pair.length>32900||!pair.isWellFormed()||pair.includes('\0'))invalid('PAIR_REFUSED');
   const equals=pair.indexOf('=');if(equals<1||equals>128)invalid('PAIR_REFUSED');
   const key=pair.slice(0,equals),value=pair.slice(equals+1),upper=key.toUpperCase();
   if(!/^[A-Za-z_][A-Za-z0-9_()]{0,127}$/.test(key)||!allow.has(key)||seen.has(upper)||upper==='PATHEXT'&&key!=='PATHEXT')invalid('KEY_REFUSED');seen.add(upper);
   if(value.length>32768)invalid('VALUE_REFUSED');const bytes=Buffer.byteLength(value,'utf8');if(bytes>32768||key==='PATHEXT'&&(bytes<1||bytes>1024))invalid('VALUE_REFUSED');
   totalBytes+=Buffer.byteLength(key,'utf8')+bytes+2;blockCodeUnits+=pair.length+1;
   if(totalBytes>262144||blockCodeUnits>32767)invalid('BLOCK_REFUSED');
   rows.push({key,bytes,sha256:digest(Buffer.from(value,'utf8'))});
  }
  const framing=[Buffer.from('SIREN_FRESH_ENV_V1\0','ascii')],count=Buffer.alloc(4);count.writeUInt32BE(rows.length);framing.push(count);
  for(const row of rows){const key=Buffer.from(row.key,'utf8'),len=Buffer.alloc(4),bytes=Buffer.alloc(8);len.writeUInt32BE(key.length);bytes.writeBigUInt64BE(BigInt(row.bytes));framing.push(len,key,bytes,Buffer.from(row.sha256,'hex'));}
  const command=scalar(commandLine,32767),directory=scalar(cwd,32767);
  return {env:rows,envSha256:digest(Buffer.concat(framing)),totalBytes,blockCodeUnits,commandLineBytes:command.bytes,commandLineSha256:command.sha256,cwdBytes:directory.bytes,cwdSha256:directory.sha256,useConptyDll:flag.value};
 }
 function clock(){const time=now();if(!Number.isFinite(time)||time<0)invalid('CLOCK_REFUSED');return time;}
 function begin(env,commandLine,cwd,receiver){
  try{
   if(slot.count){slot.count=2;slot.duplicate=true;issue('DUPLICATE_CONNECT');return null;}
   slot.count=1;slot.phase='CAPTURING';firstEnv=env;firstReceiver=receiver;
   try{slot.before=capture(env,commandLine,cwd,receiver);slot.beforeConnectMs=clock();beforeValid=true;}catch(error){slot.phase='BEFORE_CAPTURE_INVALID';issue(error);}
   return 1;
  }catch{issue('OBSERVER_ERROR');return null;}
 }
 function finish(ticket,env,commandLine,cwd,receiver,returned,assigned){
  try{
   if(ticket!==1)return;
   slot.returnStatus=returned?'RETURNED':'THREW';slot.pidAssignment=returned?(assigned?'ASSIGNED':'FAILED'):'NOT_ATTEMPTED';
   if(assigned){const pid=Object.getOwnPropertyDescriptor(receiver,'_innerPid');if(pid&&Object.hasOwn(pid,'value')&&Number.isSafeInteger(pid.value)&&pid.value>0&&pid.value<=0xffffffff)slot.returnedPid=pid.value;else issue('PID_REFUSED');}
   try{slot.afterConnectMs=clock();slot.after=capture(env,commandLine,cwd,receiver);if(beforeValid&&slot.afterConnectMs<slot.beforeConnectMs)invalid('CLOCK_REFUSED');afterValid=true;}catch(error){issue(error);}
   if(!beforeValid)slot.phase='BEFORE_CAPTURE_INVALID';else if(!returned)slot.phase='NATIVE_THROW';else if(!assigned)slot.phase='RETURN_PID_UNREADABLE';else if(!afterValid||slot.returnedPid===null)slot.phase='AFTER_CAPTURE_INVALID';else slot.phase='RETURNED';
   if(beforeValid&&afterValid){slot.argumentsUnchanged=firstEnv===env&&firstReceiver===receiver&&slot.before.envSha256===slot.after.envSha256&&slot.before.commandLineSha256===slot.after.commandLineSha256&&slot.before.cwdSha256===slot.after.cwdSha256&&slot.before.useConptyDll===slot.after.useConptyDll;}else slot.argumentsUnchanged=null;
  }catch{issue('OBSERVER_ERROR');slot.phase='AFTER_CAPTURE_INVALID';slot.argumentsUnchanged=null;}
  finally{firstEnv=null;firstReceiver=null;}
 }
 function copy(value){if(value===null||typeof value!=='object')return value;if(Array.isArray(value))return Object.freeze(value.map(copy));const result={};for(const key of Object.keys(value))result[key]=copy(value[key]);return Object.freeze(result);}
 function read(){if(arguments.length)return null;return copy(slot);}
 return Object.freeze({begin,finish,read});
}

// Initialization must be as nonthrowing as capture. Failure remains permanently
// adverse; no guessed process identity, environment hash, PID or clock is used.
function initializeTerminalConnectObserver(factory){
 try{return factory();}
 catch{
  let count=0;
  return Object.freeze({
   begin:function(){count=Math.min(2,count+1);return null;},
   finish:function(){},
   read:function(){if(arguments.length)return null;return Object.freeze({schema:1,boundary:'JS_NATIVE_CONNECT_ARGUMENTS',argumentCount:null,creatorPid:null,clock:null,count,duplicate:count>1,phase:'OBSERVER_INITIALIZATION_FAILED',before:null,after:null,beforeConnectMs:null,afterConnectMs:null,returnStatus:'NOT_OBSERVED',pidAssignment:'NOT_OBSERVED',returnedPid:null,argumentsUnchanged:null,captureCodes:Object.freeze(['OBSERVER_INIT_FAILED'])});}
  });
 }
}

export function generateTerminalConnectDerivative(original){
 if(arguments.length!==1||typeof original!=='string'||original.length>12388||Buffer.byteLength(original,'utf8')!==12388||sha(original)!==ORIGINAL_SHA)return Object.freeze({ok:false,code:'ORIGINAL_SOURCE_REFUSED'});
 const raw=Buffer.from(original,'utf8'),offsets=[0,588,3694,3850,3892,12388];
 const observerSource='\r\n// SIREN prospective diagnostic observer; not a runtime admission.\r\nvar __sirenConnectObserver = ('+initializeTerminalConnectObserver.toString()+')('+terminalConnectObserver.toString()+');\r\nObject.defineProperty(exports,"readConnectObservation",{enumerable:true,value:function(){if(arguments.length)return null;return __sirenConnectObserver.read();}});\r\n';
 const before='            var __sirenConnectTicket = __sirenConnectObserver.begin(env, commandLine, cwd, this);\r\n            var __sirenNativeReturned = false, __sirenPidAssigned = false;\r\n            try {\r\n';
 const middle='                __sirenNativeReturned = true;\r\n';
 const after='                __sirenPidAssigned = true;\r\n            } finally {\r\n                __sirenConnectObserver.finish(__sirenConnectTicket, env, commandLine, cwd, this, __sirenNativeReturned, __sirenPidAssigned);\r\n            }\r\n';
 const insertions=[observerSource,before,middle,after],pieces=[],preserved=[],inserted=[];let position=0;
 for(let i=0;i<5;i++){
  const segment=raw.subarray(offsets[i],offsets[i+1]);preserved.push(Object.freeze({originalStart:offsets[i],derivativeStart:position,bytes:segment.length,sha256:sha(segment)}));pieces.push(segment);position+=segment.length;
  if(i<4){const addition=Buffer.from(insertions[i],'utf8');inserted.push(Object.freeze({afterOriginalByte:offsets[i+1],derivativeStart:position,bytes:addition.length,sha256:sha(addition)}));pieces.push(addition);position+=addition.length;}
 }
 const derivative=Buffer.concat(pieces).toString('utf8'),callFragment=before+raw.subarray(offsets[2],offsets[3]).toString('utf8')+middle+raw.subarray(offsets[3],offsets[4]).toString('utf8')+after;
 return Object.freeze({ok:true,originalSha256:ORIGINAL_SHA,derivativeSha256:sha(derivative),derivative,observerSource,callFragment,allowlist:ALLOWLIST,provenance:PROVENANCE,map:Object.freeze({preserved:Object.freeze(preserved),inserted:Object.freeze(inserted)})});
}
