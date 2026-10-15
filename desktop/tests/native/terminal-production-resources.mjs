// SOURCE_ONLY fixed-resource preparation. Inspected code is NEVER imported.
// Caller sourceRoot is an inspection input, not product runtime authority.
import {lstat,realpath,opendir,open,mkdir} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {builtinModules} from 'node:module';
import {types} from 'node:util';
import vm from 'node:vm';

const ROOTS=Object.freeze(['desktop/src/terminal/production-backend.mjs','desktop/src/terminal/production-ownership.mjs','desktop/src/terminal/production-creator-entry.mjs']);
const AUX=Object.freeze(['desktop/native/terminal-creator-three-lane/ownership.cc','desktop/native/terminal-creator-three-lane/peer-endpoints.inc','desktop/native/terminal-creator-three-lane/binding.gyp','desktop/runtime/terminal-provider/package.json','desktop/runtime/terminal-provider/package-lock.json']);
const GRAPH_ROOTS=Object.freeze([...ROOTS,'desktop/src/terminal/shutdown-graph.mjs']);
const GRAPH_AUX=Object.freeze([...AUX,...['ownership.cc','peer-endpoints.inc','binding.gyp'].map(name=>'desktop/native/terminal-host-roster-candidate/'+name)]);
const LAUNCHER_RELATIVE='desktop/src/terminal/production-creator-launcher.mjs';
const LAUNCHER=Buffer.from("import {runProductionCreatorEntry} from './production-creator-entry.mjs';\nawait runProductionCreatorEntry();\n");
const LIMITS=Object.freeze({files:128,fileBytes:1024*1024,totalBytes:8*1024*1024,pathDepth:64,directoryEntries:4096,tokenUpperBoundPerFile:65536,totalTokenUpperBound:1048576,rawBackticksPerFile:64,dynamicTriviaSteps:4*1024*1024});
// Diagnostic host parser only. No inspected module is linked or evaluated.
// Captured once; missing --experimental-vm-modules refuses capture before I/O.
const ParseModule=vm.SourceTextModule;
const requestsGetter=typeof ParseModule==='function'?Object.getOwnPropertyDescriptor(ParseModule.prototype,'moduleRequests')?.get:null;
const BUILTINS=new Set(builtinModules.map(n=>n.replace(/^node:/,'')));
const captures=new WeakMap(),prepared=new WeakMap();
const sha=b=>createHash('sha256').update(b).digest('hex');
const frozen=Object.freeze;
const fail=message=>{throw Error('PRODUCTION_RESOURCES_REFUSED: '+message);};
const compare=(a,b)=>a<b?-1:a>b?1:0;
const identity=(a,b)=>['dev','ino','mode','nlink'].every(k=>a[k]===b[k]);
const stable=(a,b)=>identity(a,b)&&['size','mtimeNs','ctimeNs'].every(k=>a[k]===b[k]);
function record(v,keys){
 if(!v||typeof v!=='object'||types.isProxy(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail('plain DATA options required');
 const own=Reflect.ownKeys(v);if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))fail('exact DATA options required');
 const r=Object.create(null);for(const k of own){const d=Object.getOwnPropertyDescriptor(v,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))fail('DATA options required');r[k]=d.value;}return r;
}
function component(v){
 if(!v||v==='.'||v==='..'||v.normalize('NFC')!==v||/[<>:"|?*\x00-\x1f\x7f]/.test(v)||/[. ]$/.test(v)||/~\d/.test(v)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(v))fail('ambiguous path component');
}
function absolute(v){
 if(typeof v!=='string'||!v.isWellFormed()||v.length>32768||!path.isAbsolute(v))fail('absolute inspection path required');
 if(process.platform==='win32'&&!/^[A-Za-z]:[\\/]/.test(v))fail('local drive path required');
 if(process.platform==='win32'&&v[0]!==v[0].toUpperCase())fail('drive case alias');
 const parsed=path.parse(v),suffix=v.slice(parsed.root.length);if(!suffix)fail('filesystem root refused');
 const parts=suffix.split(process.platform==='win32'?/[\\/]/:/\//);if(parts.length>LIMITS.pathDepth)fail('path budget');parts.forEach(component);
 const resolved=path.resolve(v);if(resolved!==path.normalize(v))fail('path alias');return resolved;
}
function relative(v){
 if(typeof v!=='string'||!v||v.length>32768||v.includes('\\')||path.posix.isAbsolute(v))fail('relative resource path required');
 const parts=v.split('/');if(parts.length>LIMITS.pathDepth)fail('path budget');parts.forEach(component);return parts;
}
function contained(root,target){const r=path.relative(root,target);return r!==''&&!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r);}
async function checked(target,{directory=false,file=false}={}){
 const parsed=path.parse(target),parts=target.slice(parsed.root.length).split(path.sep);let current=parsed.root,last;
 for(let i=-1;i<parts.length;i++){
  if(i>=0){const names=await namesAt(current);if(!names.includes(parts[i]))fail('missing path or case alias');current=path.join(current,parts[i]);}
  let s;try{s=await lstat(current,{bigint:true});}catch{fail('missing or inaccessible path: '+current);}
  if(s.isSymbolicLink()||(i<parts.length-1&&!s.isDirectory()))fail('Node-visible link or non-directory ancestor');
  if(i===parts.length-1)last=s;
 }
 if(directory&&!last?.isDirectory()||file&&(!last?.isFile()||last.nlink!==1n))fail('regular unlinked resource required');
 let canonical;try{canonical=await realpath(target);}catch{fail('canonical path unavailable');}
 if(path.normalize(canonical)!==target)fail('canonical path alias');return last;
}
async function namesAt(directory){
 let handle;try{handle=await opendir(directory,{bufferSize:32});}catch{fail('missing resource ancestor');}
 const names=[];
 try{for(;;){const entry=await handle.read();if(!entry)break;if(names.length===LIMITS.directoryEntries)fail('directory entry budget');names.push(entry.name);}}
 finally{await handle.close();}return names;
}
async function exactChild(root,rel){
 let current=root;
 for(const part of relative(rel)){
  const names=await namesAt(current);
  if(!names.includes(part))fail('missing resource or case alias: '+rel);
  current=path.join(current,part);
 }
 return current;
}
async function readExact(root,rel,budget=null,expected=null){
 const target=await exactChild(root,rel),before=await checked(target,{file:true});
 if(before.size>BigInt(LIMITS.fileBytes))fail('file byte budget');
 if(budget&&(budget.files+1>LIMITS.files||budget.bytes+Number(before.size)>LIMITS.totalBytes))fail('closure byte/file budget');
 if(expected&&!stable(before,expected.stat))fail('resource identity or metadata changed: '+rel);
 let h;try{h=await open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));}catch{fail('resource open refused');}
 let bytes;
 try{
  if(!stable(before,await h.stat({bigint:true})))fail('resource changed before read');
  bytes=Buffer.alloc(Number(before.size));let offset=0;
  while(offset<bytes.length){const n=await h.read(bytes,offset,bytes.length-offset,offset);if(!n.bytesRead)fail('resource shortened');offset+=n.bytesRead;}
  if((await h.read(Buffer.alloc(1),0,1,bytes.length)).bytesRead)fail('resource grew');
  if(!stable(before,await h.stat({bigint:true})))fail('resource changed during read');
 }finally{await h.close();}
 if(!stable(before,await checked(target,{file:true})))fail('resource changed after read');
 if(expected&&(!bytes.equals(expected.bytes)||sha(bytes)!==expected.row.sha256))fail('resource bytes changed: '+rel);
 if(budget){budget.files++;budget.bytes+=bytes.length;}
 return {bytes,stat:before,target,row:frozen({relativePath:rel,bytes:bytes.length,sha256:sha(bytes)})};
}
function sourceText(bytes){
 let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{fail('invalid UTF-8 source');}
 if(!Buffer.from(text).equals(bytes))fail('non-roundtrip source text');return text;
}

// V8 is the static-request authority. Raw conservative refusals below are
// deliberately stricter than JS grammar, and are never a dependency lexer.
function moduleSpecs(text,budget){
 let units=0,ticks=0;
 for(let index=0;index<text.length;index++){
  const c=text[index];
  if(!/\s/.test(c)&&(++units>LIMITS.tokenUpperBoundPerFile||++budget.tokens>LIMITS.totalTokenUpperBound))fail('source token budget (conservative non-whitespace code-unit upper bound)');
  if(c.charCodeAt(0)===96&&++ticks>LIMITS.rawBackticksPerFile)fail('template depth budget (conservative raw backtick bound)');
 }
 // Visit EVERY raw occurrence. Looking like a comment in a quoted string
 // must never let a raw scan skip a later real import. Work is bounded even
 // when many occurrences independently traverse overlapping comment text.
 let cursor=0,steps=0;
 const step=n=>{steps+=n;if(steps>LIMITS.dynamicTriviaSteps)fail('dynamic import trivia budget');};
 function trivia(j){
  for(;;){
   if(j<text.length&&/\s/.test(text[j])){step(1);j++;continue;}
   if(text[j]==='/'&&text[j+1]==='*'){
    const end=text.indexOf('*/',j+2);if(end<0)fail('unsupported raw import comment context');step(end+2-j);j=end+2;continue;
   }
   if(text[j]==='/'&&text[j+1]==='/'){
    step(2);j+=2;while(j<text.length&&!/[\r\n\u2028\u2029]/.test(text[j])){step(1);j++;}continue;
   }
   return j;
  }
 }
 for(;;){
  const at=text.indexOf('import',cursor);if(at<0)break;cursor=at+6;let j=trivia(cursor);
  if(text[j]==='(')fail('dynamic import text unsupported (including harmless lookalikes)');
  if(text[j]==='.'){
   j=trivia(j+1);
   // Dynamic import.source is accepted by the pinned V8 parser without any
   // static moduleRequests. Refuse ALL non-meta dotted forms, including future
   // phases and escaped spellings. import.meta itself does not load a module.
   if(text.slice(j,j+4)!=='meta'||/[A-Za-z0-9_$\\]/.test(text[j+4]??''))fail('non-meta import expression unsupported');
  }
 }
 let parsed,requests;
 try{parsed=new ParseModule(text,{identifier:'siren-production-source-inspection'});requests=requestsGetter.call(parsed);}
 catch{fail('unsupported or invalid source module syntax');}
 if(parsed.status!=='unlinked'||!Array.isArray(requests))fail('non-evaluating module parser contract');
 return requests.map(r=>{
  if(!r||Reflect.ownKeys(r).some(k=>!['specifier','attributes','phase'].includes(k))||typeof r.specifier!=='string'||r.phase!=='evaluation'||!r.attributes||Reflect.ownKeys(r.attributes).length)fail('unsupported static module request');
  return r.specifier;
 });
}
function resolveSpecifier(from,spec){
 if(spec.startsWith('node:')){if(!BUILTINS.has(spec.slice(5)))fail('unknown node builtin');return null;}
 if(!spec.startsWith('./')&&!spec.startsWith('../'))fail('external non-node module refused');
 let rest=spec;if(rest.startsWith('./'))rest=rest.slice(2);else while(rest.startsWith('../'))rest=rest.slice(3);
 if(!rest||!rest.endsWith('.mjs'))fail('explicit .mjs source required');relative(rest);
 if(!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.mjs$/.test(rest))fail('module path alias');
 const rel=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec));
 if(rel.startsWith('../')||!rel.startsWith('desktop/src/'))fail('module escapes production source boundary');relative(rel);return rel;
}

/** Capture bounded exact static ESM closure and explicit inert native/lock bytes. */
export async function captureProductionResources(options,...extra){
 return captureResources(options,extra,ROOTS,AUX,'siren-terminal-production-resources/v1');
}
/** Fixed additive graph profile; callers cannot supply roots or native paths. */
export async function captureShutdownGraphResources(options,...extra){
 return captureResources(options,extra,GRAPH_ROOTS,GRAPH_AUX,'siren-terminal-shutdown-graph-resources/v1');
}
async function captureResources(options,extra,roots,aux,schema){
 if(extra.length)fail('extra arguments refused');if(typeof ParseModule!=='function'||typeof requestsGetter!=='function')fail('non-evaluating V8 moduleRequests parser unavailable; use supported Node with --experimental-vm-modules');const {sourceRoot:input}=record(options,['sourceRoot']),sourceRoot=absolute(input),rootStat=await checked(sourceRoot,{directory:true});
 const budget={files:0,bytes:0,tokens:0},files=new Map(),aliases=new Set(),queue=[...roots];
 while(queue.length){
  const rel=queue.shift();if(files.has(rel))continue;
  const item=await readExact(sourceRoot,rel,budget);const alias=item.stat.ino===0n?null:item.stat.dev+':'+item.stat.ino;
  if(alias&&aliases.has(alias))fail('source inode alias');if(alias)aliases.add(alias);files.set(rel,item);
  for(const s of moduleSpecs(sourceText(item.bytes),budget)){const next=resolveSpecifier(rel,s);if(next&&!files.has(next)&&!queue.includes(next)){if(queue.length+files.size>=LIMITS.files)fail('closure file budget');queue.push(next);}}
 }
 for(const rel of aux){if(files.has(rel))fail('explicit resource alias');const item=await readExact(sourceRoot,rel,budget),alias=item.stat.ino===0n?null:item.stat.dev+':'+item.stat.ino;if(alias&&aliases.has(alias))fail('resource inode alias');if(alias)aliases.add(alias);files.set(rel,item);}
 if(!identity(rootStat,await checked(sourceRoot,{directory:true})))fail('source root identity changed');
 const entries=frozen([...files.values()].map(x=>x.row).sort((a,b)=>compare(a.relativePath,b.relativePath)));
 const parser=frozen({hostNode:process.versions.node,staticRequests:'vm.SourceTextModule.moduleRequests',inspection:'constructor-only/unlinked',dynamicImports:'raw calls and all non-meta import-dot forms refused',conservativeBounds:true});
 const handle=frozen({schema,sourceOnly:true,nativeExecutionAdmitted:false,sourceRootInspectionOnly:true,compiledNativeInventory:false,installedProviderInventory:false,providerGraphValidated:false,entries,limits:LIMITS,totalBytes:budget.bytes,parser});
 captures.set(handle,{sourceRoot,rootStat,files});await recheckProductionResources(handle);return handle;
}
/** A copied/forged manifest is not a privately branded inspection capability. */
export async function recheckProductionResources(capture,...extra){
 const state=capture&&typeof capture==='object'&&!types.isProxy(capture)&&captures.get(capture);if(extra.length||!state)fail('private capture required');
 if(!identity(state.rootStat,await checked(state.sourceRoot,{directory:true})))fail('source root identity changed');
 for(const [rel,item]of state.files)await readExact(state.sourceRoot,rel,null,item);return true;
}
/** Inspection-only separation check using the private source root, not manifest DATA. */
export async function assertProductionResourceSeparation(capture,applicationDirectory,...extra){
 const state=capture&&typeof capture==='object'&&!types.isProxy(capture)&&captures.get(capture);if(extra.length||!state)fail('private capture required');
 const target=absolute(applicationDirectory);await recheckProductionResources(capture);await checked(target,{directory:true});
 if(target===state.sourceRoot||contained(state.sourceRoot,target)||contained(target,state.sourceRoot))fail('source and execution trees must be separate');
 return true;
}
async function dirs(root,rel){
 let cursor=root;for(const part of relative(rel)){cursor=path.join(cursor,part);try{await mkdir(cursor,{mode:0o700});}catch(e){if(e.code!=='EEXIST')throw e;}await checked(cursor,{directory:true});}return cursor;
}
async function exclusive(root,rel,bytes){
 const parts=relative(rel),name=parts.pop(),parent=parts.length?await dirs(root,parts.join('/')):root,target=path.join(parent,name);
 let h;try{h=await open(target,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|(constants.O_NOFOLLOW??0),0o600);}catch{fail('exclusive output create refused');}
 try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}
 const item=await readExact(root,rel);if(!item.bytes.equals(bytes))fail('output bytes changed');return item;
}
function expectedDirectories(outputs){
 const dirs=new Map([['',new Set()]]);
 for(const rel of outputs.keys()){
  const parts=relative(rel);let parent='';
  for(let i=0;i<parts.length;i++){
   dirs.get(parent).add(parts[i]);if(i===parts.length-1)break;
   parent=parent?parent+'/'+parts[i]:parts[i];if(!dirs.has(parent))dirs.set(parent,new Set());
  }
 }
 if(dirs.size>(LIMITS.files*2+2)*LIMITS.pathDepth)fail('prepared directory budget');return dirs;
}
async function membership(root,outputs,baselines=null){
 const result=new Map();
 for(const [rel,expected]of expectedDirectories(outputs)){
  const target=rel?path.join(root,...rel.split('/')):root,s=await checked(target,{directory:true});
  if(baselines&&!identity(s,baselines.get(rel)))fail('prepared directory identity changed');
  const names=await namesAt(target);if(names.length!==expected.size||names.some(n=>!expected.has(n)))fail('unexpected or missing prepared member: '+(rel||'<root>'));
  result.set(rel,s);
 }
 return result;
}
/** Creates only source snapshots and a fixed inert resource launcher. No build. */
export async function prepareProductionResources(options,...extra){
 if(extra.length)fail('extra arguments refused');const p=record(options,['capture','parentDirectory']),state=p.capture&&typeof p.capture==='object'&&!types.isProxy(p.capture)&&captures.get(p.capture);if(!state)fail('private capture required');
 const parent=absolute(p.parentDirectory);await checked(parent,{directory:true});if(parent===state.sourceRoot||contained(state.sourceRoot,parent))fail('output within source inspection root');await recheckProductionResources(p.capture);
 const directory=path.join(parent,'siren-terminal-production-resources-'+randomUUID());await mkdir(directory,{mode:0o700});await checked(directory,{directory:true});
 const applicationDirectory=await dirs(directory,'application'),originalsDirectory=await dirs(directory,'originals'),outputs=new Map();
 for(const [rel,item]of state.files){outputs.set('application/'+rel,await exclusive(directory,'application/'+rel,item.bytes));outputs.set('originals/'+rel,await exclusive(directory,'originals/'+rel,item.bytes));}
 const launcherRelative='application/'+LAUNCHER_RELATIVE,launcher=await exclusive(directory,launcherRelative,LAUNCHER);outputs.set(launcherRelative,launcher);
 const manifest=frozen({schema:p.capture.schema,sourceOnly:true,nativeExecutionAdmitted:false,sourceRootInspectionOnly:true,compiledNativeInventory:false,installedProviderInventory:false,providerGraphValidated:false,entries:p.capture.entries,parser:p.capture.parser,launcher:frozen({relativePath:LAUNCHER_RELATIVE,bytes:LAUNCHER.length,sha256:sha(LAUNCHER)}),boundaries:frozen({filesystem:'Node-visible link, hardlink, canonical/exact path-component and byte guards; no native Windows handle/reparse/ancestor race proof',privacy:'unique tree; POSIX modes where supported; no Windows ACL confidentiality claim',inspection:'sourceRoot is caller inspection input, never product runtime authority'})});
 outputs.set('resource-manifest.json',await exclusive(directory,'resource-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n')));
 await recheckProductionResources(p.capture);
 const handle=frozen({schema:manifest.schema,sourceOnly:true,nativeExecutionAdmitted:false,directory,applicationDirectory,originalsDirectory,launcherPath:path.join(applicationDirectory,...LAUNCHER_RELATIVE.split('/')),manifestPath:path.join(directory,'resource-manifest.json'),manifest});
 const directoryStats=await membership(directory,outputs);
 prepared.set(handle,{directory,stat:await checked(directory,{directory:true}),capture:p.capture,outputs,directoryStats});await recheckPreparedProductionResources(handle);return handle;
}
/** Rechecks all copied originals, resources, fixed launcher and own manifest. */
export async function recheckPreparedProductionResources(handle,...extra){
 const state=handle&&typeof handle==='object'&&!types.isProxy(handle)&&prepared.get(handle);if(extra.length||!state)fail('private prepared resource required');
 if(!identity(state.stat,await checked(state.directory,{directory:true})))fail('prepared root identity changed');await recheckProductionResources(state.capture);
 await membership(state.directory,state.outputs,state.directoryStats);
 for(const [rel,item]of state.outputs)await readExact(state.directory,rel,null,item);
 await membership(state.directory,state.outputs,state.directoryStats);return true;
}
