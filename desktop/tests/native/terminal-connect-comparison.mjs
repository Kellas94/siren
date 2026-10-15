// Supplied canonical DATA comparison. Never authenticates capture or grants input.
import {createHash} from 'node:crypto';
import {decodeTerminalConnectRawJson} from './terminal-connect-raw-json.mjs';
import {hashFreshEnvironment} from './terminal-fresh-pair-model.mjs';

const EXPECTED_KEYS=['schema','creatorPid','shellPid','commandLine','cwd','env','useConptyDll'];
const ENV_KEYS=new Set(['SystemRoot','PATH','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)','ProgramData','ComSpec','USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH','SystemDrive','windir','PATHEXT']);
const sha=value=>createHash('sha256').update(value,'utf8').digest('hex');
const pid=value=>Number.isInteger(value)&&value>0&&value<=0xffffffff;
const fail=()=>{throw 0;};
const outcome=(ok,code)=>Object.freeze({ok,code,semanticMatch:ok,evidenceClass:'SUPPLIED_CONNECT_ARGUMENT_COMPARISON',nativeAdmission:false,inputAuthorized:false});
function scalar(value,units,bytes,nonempty=false){
 if(typeof value!=='string'||value.length>units||nonempty&&!value.length||!value.isWellFormed()||value.includes('\0')||Buffer.byteLength(value,'utf8')>bytes)fail();
 return value;
}
function expectation(text){
 if(typeof text!=='string'||text.length>1048576||!text.isWellFormed()||Buffer.byteLength(text,'utf8')>1048576)fail();
 const e=JSON.parse(text);
 if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).length!==EXPECTED_KEYS.length||!Object.keys(e).every((key,i)=>key===EXPECTED_KEYS[i])||e.schema!==1||!pid(e.creatorPid)||!pid(e.shellPid)||e.creatorPid===e.shellPid||e.useConptyDll!==false||!Array.isArray(e.env)||e.env.length<1||e.env.length>20)fail();
 scalar(e.commandLine,32767,131068,true);scalar(e.cwd,32767,131068,true);
 const rows=[],seen=new Set();let totalBytes=0,blockCodeUnits=1;
 for(const pair of e.env){
  scalar(pair,32900,131600);const equals=pair.indexOf('=');if(equals<1||equals>128)fail();
  const key=pair.slice(0,equals),value=pair.slice(equals+1);
  if(!ENV_KEYS.has(key)||seen.has(key.toUpperCase()))fail();seen.add(key.toUpperCase());
  scalar(value,32768,32768);const bytes=Buffer.byteLength(value,'utf8');
  if(key==='PATHEXT'&&(bytes<1||bytes>1024))fail();
  totalBytes+=Buffer.byteLength(key,'utf8')+bytes+2;blockCodeUnits+=pair.length+1;
  if(totalBytes>262144||blockCodeUnits>32767)fail();
  rows.push({key,bytes,sha256:sha(value)});
 }
 // Closed shape and scalar validation precede canonical reserialization, so
 // nested hostile JSON cannot reach a recursive stringifier through this API.
 if(JSON.stringify(e)!==text)fail();
 const hashed=hashFreshEnvironment(rows);if(!hashed.ok)fail();
 return {creatorPid:e.creatorPid,shellPid:e.shellPid,snapshot:{env:hashed.entries,envSha256:hashed.sha256,totalBytes,blockCodeUnits,commandLineBytes:Buffer.byteLength(e.commandLine,'utf8'),commandLineSha256:sha(e.commandLine),cwdBytes:Buffer.byteLength(e.cwd,'utf8'),cwdSha256:sha(e.cwd),useConptyDll:false}};
}
export function compareFreshConnectJson(rawJson,expectedJson,...extra){
 if(extra.length)return outcome(false,'ARGUMENTS_REFUSED');
 let expected;try{expected=expectation(expectedJson);}catch{return outcome(false,'EXPECTATION_REFUSED');}
 const decoded=decodeTerminalConnectRawJson(rawJson);if(!decoded.ok)return outcome(false,'RAW_JSON_REFUSED');
 const raw=decoded.observation;
 if(raw.count!==1||raw.duplicate||raw.phase!=='RETURNED'||raw.argumentCount!==6||raw.creatorPid!==expected.creatorPid||raw.returnedPid!==expected.shellPid||raw.returnStatus!=='RETURNED'||raw.pidAssignment!=='ASSIGNED'||raw.argumentsUnchanged!==true||raw.captureCodes.length||raw.clock!=='PROCESS_MONOTONIC'||raw.beforeConnectMs===null||raw.afterConnectMs===null||raw.afterConnectMs<raw.beforeConnectMs)return outcome(false,'CONNECT_ADVERSE');
 const snapshot=JSON.stringify(expected.snapshot);
 if(JSON.stringify(raw.before)!==snapshot||JSON.stringify(raw.after)!==snapshot)return outcome(false,'ARGUMENT_SNAPSHOT_MISMATCH');
 return outcome(true,'SUPPLIED_ARGUMENTS_MATCH');
}
