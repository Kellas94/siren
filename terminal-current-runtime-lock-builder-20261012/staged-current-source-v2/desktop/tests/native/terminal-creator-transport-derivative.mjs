// Pure inactive source generator. No provider/entry/module member is evaluated.
import {createHash} from 'node:crypto';
const ORIGINAL_SHA='e298b2ca626d90a1e170d69ec017845db7892077854c74f6f68188e582f969a1';
const sha=raw=>createHash('sha256').update(raw).digest('hex');

// Emitted as source only; tests execute this isolated fragment with finite stubs.
function initializeCreatorConnectTransport(require,moduleUrl,fileURLToPath){
 'use strict';
 const unavailable=()=>Object.freeze({acquire(){},write(){}});
 try{
  const util=require('node:util'),fs=require('node:fs'),path=require('node:path'),processBuiltin=require('node:process');
  const types=Object.getOwnPropertyDescriptor(util,'types')?.value;
  const isProxy=Object.getOwnPropertyDescriptor(types,'isProxy')?.value;if(typeof isProxy!=='function')return unavailable();
  function own(object,key){if(!object||isProxy(object))throw 0;const d=Object.getOwnPropertyDescriptor(object,key);if(!d||!Object.hasOwn(d,'value'))throw 0;return d.value;}
  const writeFileSync=own(fs,'writeFileSync'),resolvePath=own(path,'resolve'),join=own(path,'join'),creatorPid=own(processBuiltin,'pid');
  if([writeFileSync,resolvePath,join].some(fn=>typeof fn!=='function'||isProxy(fn))||own(processBuiltin,'platform')!=='win32'||!Number.isSafeInteger(creatorPid)||creatorPid<1||creatorPid>0xffffffff)return unavailable();
  if(typeof moduleUrl!=='string'||typeof fileURLToPath!=='function')return unavailable();
  const resource=new URL(moduleUrl);if(resource.protocol!=='file:'||resource.href!==moduleUrl||resource.search||resource.hash||resource.host)return unavailable();
  const resourcePath=fileURLToPath(resource),suffix='\\fresh-runtime\\execution\\desktop\\src\\terminal\\diagnostic-creator-entry.mjs';
  const canonical=value=>typeof value==='string'&&value.isWellFormed()&&!value.includes('\0')&&value.length<=32768&&/^[A-Z]:\\/.test(value)&&Reflect.apply(resolvePath,path,[value])===value;
  if(!canonical(resourcePath)||!resourcePath.endsWith(suffix))return unavailable();
  const agentPath=fileURLToPath(new URL('../../runtime/terminal-provider/node_modules/node-pty/lib/windowsPtyAgent.js',resource));
  const outputDirectory=fileURLToPath(new URL('../../../../../fresh-evidence/connect',resource));
  if(!canonical(agentPath)||!canonical(outputDirectory))return unavailable();
  const outputPath=Reflect.apply(join,path,[outputDirectory,String(creatorPid)+'.json']);
  const resolve=own(require,'resolve');if(typeof resolve!=='function'||isProxy(resolve))return unavailable();
  let acquired=false,attempted=false,read=null;
  const rawKeys=['schema','boundary','argumentCount','creatorPid','clock','count','duplicate','phase','before','after','beforeConnectMs','afterConnectMs','returnStatus','pidAssignment','returnedPid','argumentsUnchanged','captureCodes'];
  const snapshotKeys=['env','envSha256','totalBytes','blockCodeUnits','commandLineBytes','commandLineSha256','cwdBytes','cwdSha256','useConptyDll'];
  const allow=new Set(['SystemRoot','PATH','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)','ProgramData','ComSpec','USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH','SystemDrive','windir','PATHEXT','PSModulePath']);
  const captureCodes=new Set(['SCALAR_REFUSED','VECTOR_REFUSED','RECEIVER_REFUSED','FLAG_REFUSED','PAIR_REFUSED','KEY_REFUSED','VALUE_REFUSED','BLOCK_REFUSED','PID_REFUSED','CLOCK_REFUSED','DUPLICATE_CONNECT','OBSERVER_ERROR','OBSERVER_INIT_FAILED']);
  function record(value,keys){
   if(!value||typeof value!=='object'||isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw 0;
   const actual=Reflect.ownKeys(value);if(actual.length!==keys.length||actual.some(key=>!keys.includes(key)))throw 0;
   const out=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))throw 0;out[key]=d.value;}return out;
  }
  function vector(value,limit){
   if(isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype)throw 0;
   const length=own(value,'length');if(!Number.isSafeInteger(length)||length<0||length>limit||Reflect.ownKeys(value).length!==length+1)throw 0;
   const out=[];for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))throw 0;out.push(d.value);}return out;
  }
  const integer=(value,min,max)=>Number.isSafeInteger(value)&&value>=min&&value<=max;
  const digest=value=>typeof value==='string'&&/^[0-9a-f]{64}$/.test(value);
  const nullablePid=value=>value===null||integer(value,1,0xffffffff);
  const clock=value=>value===null||typeof value==='number'&&Number.isFinite(value)&&value>=0;
  function snapshot(value){
   if(value===null)return null;const s=record(value,snapshotKeys),seen=new Set();
   s.env=vector(s.env,21).map(item=>{const row=record(item,['key','bytes','sha256']);if(typeof row.key!=='string'||!allow.has(row.key)||seen.has(row.key.toUpperCase())||!integer(row.bytes,0,32768)||!digest(row.sha256)||row.key==='PATHEXT'&&!integer(row.bytes,1,1024))throw 0;seen.add(row.key.toUpperCase());return row;});
   if(!s.env.length||!digest(s.envSha256)||!integer(s.totalBytes,0,262144)||!integer(s.blockCodeUnits,1,32767)||!integer(s.commandLineBytes,1,131068)||!digest(s.commandLineSha256)||!integer(s.cwdBytes,1,131068)||!digest(s.cwdSha256)||typeof s.useConptyDll!=='boolean')throw 0;return s;
  }
  function detached(value){
   const r=record(value,rawKeys);
   if(r.schema!==1||r.boundary!=='JS_NATIVE_CONNECT_ARGUMENTS'||![6,null].includes(r.argumentCount)||!nullablePid(r.creatorPid)||![null,'PROCESS_MONOTONIC'].includes(r.clock)||!integer(r.count,0,2)||typeof r.duplicate!=='boolean'||!['UNSEEN','CAPTURING','BEFORE_CAPTURE_INVALID','NATIVE_THROW','RETURN_PID_UNREADABLE','AFTER_CAPTURE_INVALID','RETURNED','OBSERVER_INITIALIZATION_FAILED'].includes(r.phase)||!clock(r.beforeConnectMs)||!clock(r.afterConnectMs)||!['NOT_CALLED','RETURNED','THREW','NOT_OBSERVED'].includes(r.returnStatus)||!['NOT_ATTEMPTED','ASSIGNED','FAILED','NOT_OBSERVED'].includes(r.pidAssignment)||!nullablePid(r.returnedPid)||![true,false,null].includes(r.argumentsUnchanged))throw 0;
   r.before=snapshot(r.before);r.after=snapshot(r.after);r.captureCodes=vector(r.captureCodes,3);if(r.captureCodes.some(code=>typeof code!=='string'||!captureCodes.has(code))||new Set(r.captureCodes).size!==r.captureCodes.length)throw 0;
   return r;
  }
  function acquire(){
   if(acquired)return;acquired=true;
   try{if(Reflect.apply(resolve,require,[agentPath])!==agentPath)return;const agent=require(agentPath),method=own(agent,'readConnectObservation');if(typeof method!=='function'||isProxy(method))return;read=method;}catch{}
  }
  function write(){
   if(attempted)return;attempted=true;
   try{if(!read)return;const raw=detached(Reflect.apply(read,undefined,[])),body=JSON.stringify(raw);if(typeof body!=='string'||Buffer.byteLength(body,'utf8')>32768)return;Reflect.apply(writeFileSync,fs,[outputPath,body,{encoding:'utf8',flag:'wx'}]);}catch{}
  }
  return Object.freeze({acquire,write});
 }catch{return unavailable();}
}

export function generateTerminalCreatorTransportDerivative(original){
 if(arguments.length!==1||typeof original!=='string'||Buffer.byteLength(original,'utf8')!==5194||sha(original)!==ORIGINAL_SHA)return Object.freeze({ok:false,code:'ORIGINAL_SOURCE_REFUSED'});
 const raw=Buffer.from(original),marker='export async function runProductionCreatorEntry',requireLine='const require=createRequire(import.meta.url);\n',loadLine="     const pty=loadProductionPtyProvider(),d=Object.getOwnPropertyDescriptor(pty,'spawn');if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='function')throw Error();const spawn=d.value;\n",spawnStart='     resolve(Object.freeze({spawn(executable,args,options){\n',spawnEnd='     }}));\n';
 const at=text=>{const start=raw.indexOf(text);if(start<0||raw.indexOf(text,start+1)!==-1)throw Error('PINNED_ANCHOR_REFUSED');return start;};
 const helper=initializeCreatorConnectTransport.toString(),initialize='const __sirenCreatorTransport=initializeCreatorConnectTransport(require,import.meta.url,fileURLToPath);\n',acquire='     __sirenCreatorTransport.acquire();\n',begin='      try{\n',end='      }finally{__sirenCreatorTransport.write();}\n';
 const edits=[{at:at(marker),text:'// Inactive prospective diagnostic-only transport.\n'+helper+'\n\n'},{at:at(requireLine)+Buffer.byteLength(requireLine),text:initialize},{at:at(loadLine)+Buffer.byteLength(loadLine),text:acquire},{at:at(spawnStart)+Buffer.byteLength(spawnStart),text:begin},{at:at(spawnEnd),text:end}];
 const pieces=[],preserved=[],inserted=[];let originalPosition=0,position=0;
 for(const edit of [...edits,{at:raw.length,text:''}]){const segment=raw.subarray(originalPosition,edit.at);preserved.push(Object.freeze({originalStart:originalPosition,derivativeStart:position,bytes:segment.length,sha256:sha(segment)}));pieces.push(segment);position+=segment.length;originalPosition=edit.at;if(edit.text){const addition=Buffer.from(edit.text);inserted.push(Object.freeze({afterOriginalByte:edit.at,derivativeStart:position,bytes:addition.length,sha256:sha(addition)}));pieces.push(addition);position+=addition.length;}}
 const derivative=Buffer.concat(pieces).toString('utf8'),body=raw.subarray(at(spawnStart)+Buffer.byteLength(spawnStart),at(spawnEnd)).toString('utf8');
 return Object.freeze({ok:true,originalSha256:ORIGINAL_SHA,derivativeSha256:sha(derivative),derivative,outputExtension:'.txt',nativeAdmission:false,initializerSource:helper,providerFragment:loadLine+acquire,spawnFragment:begin+body+end,map:Object.freeze({preserved:Object.freeze(preserved),inserted:Object.freeze(inserted)})});
}
