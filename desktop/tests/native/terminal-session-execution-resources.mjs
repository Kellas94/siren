// Explicit test prerequisite: inspect a separate provisioned tree as DATA only.
// Hashes/membership do not grant load authority or prove native compatibility.
import {lstat,realpath,opendir,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {types,isDeepStrictEqual} from 'node:util';
import {recheckProductionResources,assertProductionResourceSeparation} from './terminal-production-resources.mjs';
import {captureTerminalProductionProviderGraph} from './terminal-production-provider-graph.mjs';

const SCHEMA='siren-terminal-session-execution-resources/v1';
const PROVIDER='desktop/runtime/terminal-provider';
const LAUNCHER='desktop/src/terminal/production-creator-launcher.mjs';
const LAUNCHER_BYTES=Buffer.from("import {runProductionCreatorEntry} from './production-creator-entry.mjs';\nawait runProductionCreatorEntry();\n");
const NATIVE=Object.freeze([
 'desktop/native/terminal-creator-three-lane/build/Release/siren_terminal_creator_three_lane.node',
 'desktop/native/terminal-host-roster-candidate/build/Release/siren_terminal_host_roster_candidate.node'
]);
const LIMITS=Object.freeze({files:2048,directories:2048,depth:64,fileBytes:16*1024*1024,totalBytes:128*1024*1024});
const captures=new WeakMap(),sha=b=>createHash('sha256').update(b).digest('hex');
const fail=message=>{throw Error('SESSION_EXECUTION_RESOURCES_REFUSED: '+message);};
const stable=(a,b)=>['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].every(k=>a[k]===b[k]);
const sorted=v=>[...v].sort();
function freeze(v){if(v&&typeof v==='object'&&!Object.isFrozen(v)){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
function options(value){
 if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail('exact DATA options');
 const keys=Reflect.ownKeys(value);if(keys.length!==2||!keys.includes('sourceCapture')||!keys.includes('applicationDirectory'))fail('fixed options required');
 const result=Object.create(null);for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('accessors refused');result[k]=d.value;}return result;
}
function component(name){
 if(!name||!name.isWellFormed()||name.normalize('NFC')!==name||name==='.'||name==='..'||/[<>:"|?*\\/\x00-\x1f\x7f]/.test(name)||/[. ]$/.test(name)||/~\d/.test(name)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))fail('ambiguous path');
}
function relative(value){const parts=value.split('/');if(parts.length>LIMITS.depth)fail('path depth');parts.forEach(component);return parts;}
function absolute(value){
 if(typeof value!=='string'||!value.isWellFormed()||value.length>32768||!path.isAbsolute(value))fail('absolute application directory required');
 if(process.platform==='win32'&&!/^[A-Z]:[\\/]/.test(value))fail('canonical local drive required');
 const parsed=path.parse(value);if(!value.slice(parsed.root.length))fail('filesystem root refused');
 const parts=value.slice(parsed.root.length).split(process.platform==='win32'?/[\\/]/:/\//);if(parts.length>LIMITS.depth)fail('root depth');parts.forEach(component);
 if(path.resolve(value)!==path.normalize(value))fail('path alias');return path.resolve(value);
}
async function checked(target,directory=false){
 const parsed=path.parse(target),parts=target.slice(parsed.root.length).split(path.sep);let current=parsed.root,last;
 for(let i=-1;i<parts.length;i++){
  if(i>=0)current=path.join(current,parts[i]);
  let stat;try{stat=await lstat(current,{bigint:true});}catch{fail('missing or inaccessible path: '+current);}
  if(stat.isSymbolicLink()||(i<parts.length-1&&!stat.isDirectory()))fail('Node-visible link/ancestor');last=stat;
 }
 if(directory?!last.isDirectory():!last.isFile()||last.nlink!==1n)fail('regular unlinked resource required');
 let canonical;try{canonical=await realpath(target);}catch{fail('canonical path unavailable');}
 if(path.normalize(canonical)!==target)fail('canonical alias');return last;
}
async function namesAt(target){
 const names=[],folded=new Set();for await(const entry of await opendir(target,{bufferSize:32})){
  component(entry.name);const fold=entry.name.toLowerCase();if(folded.has(fold))fail('case alias');folded.add(fold);names.push(entry.name);if(names.length>LIMITS.files+LIMITS.directories)fail('directory entry budget');
 }return names.sort();
}
async function inspect(p){
 const root=absolute(p.applicationDirectory);
 await assertProductionResourceSeparation(p.sourceCapture,root);
 if(p.sourceCapture.schema!=='siren-terminal-shutdown-graph-resources/v1')fail('genuine fixed graph profile required');
 await checked(root,true);
 const provider=await captureTerminalProductionProviderGraph({packagePath:path.join(root,...PROVIDER.split('/'),'package.json')});
 const expected=new Map();
 const add=r=>{relative(r.relativePath);const prev=expected.get(r.relativePath);if(prev&&!isDeepStrictEqual(prev,r))fail('conflicting source/provider bytes');expected.set(r.relativePath,r);};
 p.sourceCapture.entries.forEach(r=>add({relativePath:r.relativePath,bytes:r.bytes,sha256:r.sha256}));
 add({relativePath:LAUNCHER,bytes:LAUNCHER_BYTES.length,sha256:sha(LAUNCHER_BYTES)});
 for(const r of [provider.rootManifest,provider.lock,...provider.installationMetadata,...provider.packages.flatMap(pkg=>pkg.files)])add({relativePath:PROVIDER+'/'+r.relativePath,bytes:r.bytes,sha256:r.sha256});
 for(const rel of NATIVE){if(expected.has(rel))fail('native slot conflict');expected.set(rel,{relativePath:rel});}
 if(expected.size>LIMITS.files)fail('file count budget');
 const directories=new Map([['',new Set()]]);
 function directory(rel){if(!rel)return;const parts=relative(rel);let prefix='';for(const part of parts){directories.get(prefix).add(part);prefix=prefix?prefix+'/'+part:part;if(!directories.has(prefix))directories.set(prefix,new Set());}}
 for(const rel of expected.keys()){const parts=relative(rel),file=parts.pop(),dir=parts.join('/');directory(dir);directories.get(dir).add(file);}
 for(const rel of provider.directories)directory(PROVIDER+'/'+rel);
 if(directories.size>LIMITS.directories)fail('directory count budget');
 const snapshots=[],files=[];let totalBytes=0;
 for(const [rel,names]of directories){const target=rel?path.join(root,...relative(rel)):root,before=await checked(target,true),actual=await namesAt(target);if(!isDeepStrictEqual(actual,sorted(names)))fail('unexpected/missing directory membership: '+rel);snapshots.push({target,before,names:actual});}
 for(const [rel,expectedRow]of expected){
  const target=path.join(root,...relative(rel)),before=await checked(target);
  if(before.size>BigInt(LIMITS.fileBytes)||totalBytes+Number(before.size)>LIMITS.totalBytes)fail('file/total byte budget');
  const handle=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));let bytes;
  try{
   if(!stable(before,await handle.stat({bigint:true})))fail('changed before read');
   bytes=Buffer.alloc(Number(before.size));let offset=0;while(offset<bytes.length){const r=await handle.read(bytes,offset,bytes.length-offset,offset);if(!r.bytesRead)fail('shortened read');offset+=r.bytesRead;}
   if((await handle.read(Buffer.alloc(1),0,1,bytes.length)).bytesRead||!stable(before,await handle.stat({bigint:true})))fail('changed during read');
  }finally{await handle.close();}
  const row={relativePath:rel,bytes:bytes.length,sha256:sha(bytes)};
  if(NATIVE.includes(rel)){if(!bytes.length)fail('empty native artifact');}else if(!isDeepStrictEqual(row,expectedRow))fail('source/provider/launcher bytes changed: '+rel);
  totalBytes+=bytes.length;files.push(row);snapshots.push({target,before});
 }
 for(const s of snapshots){if(!stable(s.before,await checked(s.target,!!s.names)))fail('changed filesystem snapshot');if(s.names&&!isDeepStrictEqual(s.names,await namesAt(s.target)))fail('changed directory membership');}
 await recheckProductionResources(p.sourceCapture);
 files.sort((a,b)=>a.relativePath<b.relativePath?-1:a.relativePath>b.relativePath?1:0);
 return freeze({schema:SCHEMA,evidenceClass:'INERT_EXECUTION_TREE_INVENTORY',applicationDirectory:root,sourceSchema:p.sourceCapture.schema,sourceFiles:p.sourceCapture.entries.length,files,directories:sorted(directories.keys()),totalBytes,nativeBinaries:files.filter(r=>NATIVE.includes(r.relativePath)),provider,limits:LIMITS,binaryCompatibility:'UNVERIFIED',nativeExecutionAdmitted:false,productActivation:false,inspectedModulesExecuted:false,boundaries:{provenance:'Byte inventory only; no native build/signature/ABI or provider prebuild provenance established.',filesystem:'Node-visible links, hardlinks, canonical paths, stable reads and membership; no native Windows handle/reparse/ancestor race guarantee.',execution:'No modules, launchers, provider code or opaque native bytes evaluated or loaded.'}});
}
export async function captureTerminalSessionExecutionResources(value,...extra){
 if(extra.length)fail('extra arguments');const p=options(value),capture=await inspect(p);captures.set(capture,{p,capture});return capture;
}
export async function recheckTerminalSessionExecutionResources(capture,...extra){
 if(extra.length)fail('extra arguments');const saved=captures.get(capture);if(!saved)fail('private inventory handle required');
 if(!isDeepStrictEqual(await inspect(saved.p),saved.capture))fail('execution inventory changed');return true;
}
