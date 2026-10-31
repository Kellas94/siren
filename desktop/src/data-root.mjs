import { mkdir, open, unlink, realpath, lstat } from 'node:fs/promises';
import { resolve, join, win32 } from 'node:path';
import { randomUUID } from 'node:crypto';
import { types } from 'node:util';

const boundaryRefused=()=>{throw Error('DATA_ROOT_BOUNDARY_REFUSED');};
function dataOptions(value,keys){
  if(!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw TypeError('DATA_ROOT_OPTIONS_REFUSED');
  const result=Object.create(null);
  for(const key of Reflect.ownKeys(value)){
    const d=Object.getOwnPropertyDescriptor(value,key);
    if(!keys.includes(key)||!d?.enumerable||!Object.hasOwn(d,'value'))throw TypeError('DATA_ROOT_OPTIONS_REFUSED');
    result[key]=d.value;
  }
  return result;
}
function dosPath(value,volume=false){
  if(typeof value!=='string'||value.length>32763||!value.isWellFormed()||! /^[A-Za-z]:\\/.test(value)||/[\x00-\x1f\x7f-\x9f/<>"|?*~]/.test(value)||value.slice(2).includes(':')||win32.normalize(value)!==value)return false;
  if(value.length===3)return volume;
  return value.slice(3).split('\\').every(part=>part.length>0&&part!=='.'&&part!=='..'&&!/[ .]$/.test(part)&&!/^(?:con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)(?:\.|$)/i.test(part));
}
function protectedRoot(options){
  if(options===undefined)return null;
  const value=dataOptions(options,['protectedRuntimeRoot']);
  if(!Object.hasOwn(value,'protectedRuntimeRoot'))return null;
  if(!dosPath(value.protectedRuntimeRoot))boundaryRefused();
  return value.protectedRuntimeRoot;
}
function method(value,name){
  for(let owner=value;owner;owner=Object.getPrototypeOf(owner)){
    if(types.isProxy(owner))boundaryRefused();
    const d=Object.getOwnPropertyDescriptor(owner,name);
    if(d){if(!Object.hasOwn(d,'value')||typeof d.value!=='function'||types.isProxy(d.value))boundaryRefused();return d.value;}
  }
  boundaryRefused();
}
function identity(stats){
  if(!stats||typeof stats!=='object'||types.isProxy(stats)||Reflect.apply(method(stats,'isDirectory'),stats,[])!==true||Reflect.apply(method(stats,'isSymbolicLink'),stats,[])!==false)boundaryRefused();
  const result={};
  for(const key of ['dev','ino']){
    const d=Object.getOwnPropertyDescriptor(stats,key),v=d?.value;
    if(!d||!Object.hasOwn(d,'value')||!(typeof v==='bigint'&&v>=0n||Number.isSafeInteger(v)&&v>=0))boundaryRefused();
    result[key]=v;
  }
  return result;
}
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.canonical===b.canonical;
async function directoryObservation(prefix){
  let before;
  try{before=await lstat(prefix,{bigint:true});}
  catch(error){if(error&&!types.isProxy(error)&&Object.getOwnPropertyDescriptor(error,'code')?.value==='ENOENT')return null;boundaryRefused();}
  const first=identity(before);
  try{
    const canonical=await realpath(prefix);
    if(!dosPath(canonical,true)||canonical.toLowerCase()!==prefix.toLowerCase())boundaryRefused();
    const after=identity(await lstat(prefix,{bigint:true}));
    if(first.dev!==after.dev||first.ino!==after.ino)boundaryRefused();
    return {...after,canonical:canonical.toLowerCase()};
  }catch{boundaryRefused();}
}
async function guardDataRoot(target,runtime,previous=null,allowMissing=true){
  if(!dosPath(target)||!dosPath(runtime))boundaryRefused();
  const a=target.toLowerCase(),b=runtime.toLowerCase();
  if(a===b||a.startsWith(b+'\\')||b.startsWith(a+'\\'))boundaryRefused();
  const current=new Map();
  async function walk(value,missing){
    const root=win32.parse(value).root,names=value.slice(root.length).split('\\'),prefixes=[root,...names.map((_,i)=>win32.join(root,...names.slice(0,i+1)))];
    for(let i=0;i<prefixes.length;i++){
      const prefix=prefixes[i],row=await directoryObservation(prefix);
      if(!row){if(missing&&i>0)break;boundaryRefused();}
      const key=prefix.toLowerCase(),known=current.get(key)??previous?.get(key);
      if(known&&!same(known,row))boundaryRefused();current.set(key,row);
    }
  }
  await walk(runtime,false);await walk(target,allowMissing);
  if(previous)for(const [key,row] of previous)if(!current.has(key)||!same(row,current.get(key)))boundaryRefused();
  return current;
}

export async function writableDataRoot(path,options) {
  const runtime=protectedRoot(options),target=runtime===null?resolve(path):path;
  let observed;
  if(runtime!==null){observed=await guardDataRoot(target,runtime);observed=await guardDataRoot(target,runtime,observed);}
  await mkdir(target, { recursive: true });
  // This is an observed namespace boundary, not an atomic filesystem transaction.
  if(runtime!==null)await guardDataRoot(target,runtime,observed,false);
  else{
    if ((await lstat(target)).isSymbolicLink()) throw new Error('Reparse data root refused');
    const canonical = await realpath(target);
    if (canonical.toLowerCase() !== target.toLowerCase()) throw new Error('Aliased data root refused');
  }
  const probe = join(target, `.siren-write-probe-${randomUUID()}`);
  const handle = await open(probe, 'wx', 0o600);
  try { await handle.writeFile('SIREN root probe'); await handle.sync(); } finally { await handle.close(); await unlink(probe); }
  return target;
}

export async function chooseDataRoot(options) {
  const {preferred,choose,...privateOptions}=dataOptions(options,['preferred','choose','protectedRuntimeRoot']);
  const runtime=protectedRoot(privateOptions);
  let candidate = preferred;
  for (;;) {
    try { return await (runtime===null?writableDataRoot(candidate):writableDataRoot(candidate,{protectedRuntimeRoot:runtime})); }
    catch { candidate = await choose(); if (!candidate) return null; }
  }
}
