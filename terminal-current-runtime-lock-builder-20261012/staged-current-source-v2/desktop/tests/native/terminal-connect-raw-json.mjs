// Bounded parsing of supplied raw JSON DATA. This never authenticates capture.
const LIMIT=32768;
const RAW=['schema','boundary','argumentCount','creatorPid','clock','count','duplicate','phase','before','after','beforeConnectMs','afterConnectMs','returnStatus','pidAssignment','returnedPid','argumentsUnchanged','captureCodes'];
const SNAPSHOT=['env','envSha256','totalBytes','blockCodeUnits','commandLineBytes','commandLineSha256','cwdBytes','cwdSha256','useConptyDll'];
const ROW=['key','bytes','sha256'];
const KEYS=new Set(['SystemRoot','PATH','USERPROFILE','APPDATA','LOCALAPPDATA','TEMP','TMP','ProgramFiles','ProgramFiles(x86)','CommonProgramFiles','CommonProgramFiles(x86)','ProgramData','ComSpec','USERNAME','USERDOMAIN','HOMEDRIVE','HOMEPATH','SystemDrive','windir','PATHEXT','PSModulePath']);
const CODES=new Set(['SCALAR_REFUSED','VECTOR_REFUSED','RECEIVER_REFUSED','FLAG_REFUSED','PAIR_REFUSED','KEY_REFUSED','VALUE_REFUSED','BLOCK_REFUSED','PID_REFUSED','CLOCK_REFUSED','DUPLICATE_CONNECT','OBSERVER_ERROR','OBSERVER_INIT_FAILED']);
const PHASES=new Set(['UNSEEN','CAPTURING','BEFORE_CAPTURE_INVALID','NATIVE_THROW','RETURN_PID_UNREADABLE','AFTER_CAPTURE_INVALID','RETURNED','OBSERVER_INITIALIZATION_FAILED']);
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const pid=v=>v===null||integer(v,1,0xffffffff);
const clock=v=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0;
const digest=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function record(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const actual=Object.keys(value);
 return actual.length===keys.length&&actual.every((key,i)=>key===keys[i]);
}
function snapshot(s){
 if(s===null)return true;
 if(!record(s,SNAPSHOT)||!Array.isArray(s.env)||s.env.length<1||s.env.length>21)return false;
 const seen=new Set();
 for(const row of s.env){
  if(!record(row,ROW)||typeof row.key!=='string'||!KEYS.has(row.key)||seen.has(row.key.toUpperCase())||!integer(row.bytes,0,32768)||!digest(row.sha256)||row.key==='PATHEXT'&&!integer(row.bytes,1,1024))return false;
  seen.add(row.key.toUpperCase());
 }
 return digest(s.envSha256)&&integer(s.totalBytes,0,262144)&&integer(s.blockCodeUnits,1,32767)&&integer(s.commandLineBytes,1,131068)&&digest(s.commandLineSha256)&&integer(s.cwdBytes,1,131068)&&digest(s.cwdSha256)&&typeof s.useConptyDll==='boolean';
}
function shape(r){
 return record(r,RAW)&&r.schema===1&&r.boundary==='JS_NATIVE_CONNECT_ARGUMENTS'&&[6,null].includes(r.argumentCount)&&pid(r.creatorPid)&&[null,'PROCESS_MONOTONIC'].includes(r.clock)&&integer(r.count,0,2)&&typeof r.duplicate==='boolean'&&PHASES.has(r.phase)&&snapshot(r.before)&&snapshot(r.after)&&clock(r.beforeConnectMs)&&clock(r.afterConnectMs)&&['NOT_CALLED','RETURNED','THREW','NOT_OBSERVED'].includes(r.returnStatus)&&['NOT_ATTEMPTED','ASSIGNED','FAILED','NOT_OBSERVED'].includes(r.pidAssignment)&&pid(r.returnedPid)&&[true,false,null].includes(r.argumentsUnchanged)&&Array.isArray(r.captureCodes)&&r.captureCodes.length<=3&&r.captureCodes.every(code=>typeof code==='string'&&CODES.has(code))&&new Set(r.captureCodes).size===r.captureCodes.length;
}
function freeze(value){
 if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value);}
 return value;
}
const refused=()=>Object.freeze({ok:false,code:'RAW_JSON_REFUSED',evidenceClass:'SUPPLIED_CANONICAL_RAW_JSON_DATA',nativeAdmission:false,inputAuthorized:false});
export function decodeTerminalConnectRawJson(text,...extra){
 try{
  // The cheap code-unit cap precedes UTF8 scanning, parsing and enumeration.
  if(extra.length||typeof text!=='string'||text.length>LIMIT||!text.isWellFormed()||Buffer.byteLength(text,'utf8')>LIMIT)return refused();
  const observation=JSON.parse(text);
  // Fixed writer order and exact canonical representation also reject duplicate
  // keys, numeric spellings/escapes, whitespace and unknown serialization fields.
  if(!shape(observation)||JSON.stringify(observation)!==text)return refused();
  return freeze({ok:true,evidenceClass:'SUPPLIED_CANONICAL_RAW_JSON_DATA',observation,nativeAdmission:false,inputAuthorized:false});
 }catch{return refused();}
}
