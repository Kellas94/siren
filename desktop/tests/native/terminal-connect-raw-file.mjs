// Inactive read-only raw JSON file DATA. Never authenticates native capture.
import {lstat,open,opendir} from 'node:fs/promises';
import {constants,realpathSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {TextDecoder} from 'node:util';
import {decodeTerminalConnectRawJson} from './terminal-connect-raw-json.mjs';

const LIMIT=32768;
const privateRefusals=new WeakMap();
const FIELDS=['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'];
const same=(a,b)=>FIELDS.every(key=>a[key]===b[key]);
const refuse=code=>Object.freeze({ok:false,code,evidenceClass:'READ_ONLY_RAW_JSON_FILE_DATA',nativeAdmission:false,inputAuthorized:false});
const fail=code=>{const error=Object.freeze({});privateRefusals.set(error,code);throw error;};
function root(value){
 if(typeof value!=='string'||value.length>32768||!value.isWellFormed()||value.includes('\0')||!path.isAbsolute(value)||path.resolve(value)!==value)fail('RAW_FILE_ARGUMENT_REFUSED');
 const parsed=path.parse(value),parts=value.slice(parsed.root.length).split(path.sep);
 if(value===parsed.root||parts.length>64||parts.some(p=>!p||p==='.'||p==='..'||/[<>:"|?*\x00-\x1f]/.test(p)||/[ .]$/.test(p)||/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p)))fail('RAW_FILE_ARGUMENT_REFUSED');
 if(process.platform==='win32'&&!/^[A-Z]:\\/.test(value))fail('RAW_FILE_ARGUMENT_REFUSED');
 return value;
}
async function exactMember(directory,required){
 const seen=new Set();let found=false,count=0;
 for await(const entry of await opendir(directory,{bufferSize:32})){
  if(++count>8192||typeof entry.name!=='string'||Buffer.byteLength(entry.name,'utf8')>1024)fail('RAW_FILE_PATH_REFUSED');
  const folded=entry.name.toUpperCase();if(seen.has(folded))fail('RAW_FILE_PATH_REFUSED');seen.add(folded);
  if(entry.name===required)found=true;
 }
 if(!found)fail('RAW_FILE_PATH_REFUSED');
}
async function chain(target,anchor){
 const parts=path.relative(anchor,target).split(path.sep),saved=[];
 let current=anchor;
 for(let i=-1;i<parts.length;i++){
  if(i>=0)current=path.join(current,parts[i]);
  const stat=await lstat(current,{bigint:true}),last=i===parts.length-1;
  if(stat.isSymbolicLink()||(last?!stat.isFile()||stat.nlink!==1n:!stat.isDirectory()))fail('RAW_FILE_PATH_REFUSED');
  if(path.normalize(realpathSync(current))!==current)fail('RAW_FILE_PATH_REFUSED');
  saved.push({path:current,stat});
  if(!last)await exactMember(current,parts[i+1]);
 }
 return saved;
}
export async function readTerminalConnectRawFile(jobRoot,creatorPid,...extra){
 try{
  if(extra.length||typeof creatorPid!=='number'||!Number.isInteger(creatorPid)||creatorPid<1||creatorPid>0xffffffff)fail('RAW_FILE_ARGUMENT_REFUSED');
  const canonical=root(jobRoot),target=path.join(canonical,'fresh-evidence','connect',String(creatorPid)+'.json');
  // Parent separately owns the canonical anchor and its ancestors. Inspect
  // the anchor and every descendant, without broadening filesystem grants.
  const before=await chain(target,canonical),file=before.at(-1).stat;
  if(file.size<0n||file.size>BigInt(LIMIT))fail('RAW_FILE_SIZE_REFUSED');
  const handle=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));
  let bytes;
  try{
   if(!same(file,await handle.stat({bigint:true})))fail('RAW_FILE_IDENTITY_CHANGED');
   const immediate=await chain(target,canonical);
   if(before.length!==immediate.length||before.some((entry,i)=>!same(entry.stat,immediate[i].stat)))fail('RAW_FILE_IDENTITY_CHANGED');
   // One bounded read buffer, including one sentinel byte. No readFile allocation.
   const buffer=Buffer.alloc(LIMIT+1);let offset=0;
   while(offset<buffer.length){
    const {bytesRead}=await handle.read(buffer,offset,buffer.length-offset,offset);
    if(!Number.isInteger(bytesRead)||bytesRead<0||bytesRead>buffer.length-offset)fail('RAW_FILE_READ_REFUSED');
    if(!bytesRead)break;offset+=bytesRead;
   }
   if(offset>LIMIT)fail('RAW_FILE_SIZE_REFUSED');
   if(BigInt(offset)!==file.size||!same(file,await handle.stat({bigint:true})))fail('RAW_FILE_IDENTITY_CHANGED');
   const after=await chain(target,canonical);
   if(before.length!==after.length||before.some((entry,i)=>!same(entry.stat,after[i].stat)))fail('RAW_FILE_IDENTITY_CHANGED');
   bytes=buffer.subarray(0,offset);
  }finally{await handle.close();}
  const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes),decoded=decodeTerminalConnectRawJson(text);
  if(!decoded.ok)fail('RAW_FILE_JSON_REFUSED');
  return Object.freeze({ok:true,evidenceClass:'READ_ONLY_RAW_JSON_FILE_DATA',rawBytes:bytes.length,rawSha256:createHash('sha256').update(bytes).digest('hex'),decoded,nativeAdmission:false,inputAuthorized:false,filesystemGuarantee:'Node-visible canonical anchor/descendant links and stable handle/path identities only; parent must establish ownership and ancestor safety above anchor. Not atomic reparse/ancestor-race or capture authentication.'});
 }catch(error){return refuse(privateRefusals.get(error)??'RAW_FILE_UNAVAILABLE');}
}
