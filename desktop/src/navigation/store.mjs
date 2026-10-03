import { lstat, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { ownedDirectory, ownedFile } from '../projects/paths.mjs';
import { readOwnedBytes } from '../projects/io.mjs';
import { atomicWrite } from '../projects/atomic.mjs';
import { NAVIGATION_BYTES, normalizeNavigationRequest, normalizeRecord } from './contracts.mjs';

const writers=new Map();
const empty=()=>({schema:1,entries:[]});
const refusal=code=>({ok:false,code});
const error=code=>Object.assign(new Error(code),{code});
function serialize(root,body) {
  const key=root.toLowerCase();
  const operation=(writers.get(key) ?? Promise.resolve()).catch(()=>{}).then(body);
  writers.set(key,operation);
  return operation.finally(()=>{if(writers.get(key)===operation)writers.delete(key);});
}
/** Root is native Data. No content paths, credentials or renderer grants live here. */
export class NavigationStore {
  constructor(root,{canWrite=()=>true,fault=async()=>{}}={}) {
    this.root=resolve(root);this.canWrite=canWrite;this.fault=fault;this.diagnostic=null;
  }
  async directory(create=false) {
    await ownedDirectory(this.root);
    const path=join(this.root,'UI');
    if(create)try{await mkdir(path);}catch(cause){if(cause.code!=='EEXIST')throw cause;}
    return ownedDirectory(path);
  }
  async load() {
    try {
      await ownedDirectory(this.root);
      const directory=await this.directory();
      const path=await ownedFile(join(directory,'navigation.json'));
      if((await lstat(path)).size>NAVIGATION_BYTES)throw error('NAVIGATION_LIMIT');
      const bytes=await readOwnedBytes(path,NAVIGATION_BYTES);
      const state=normalizeRecord(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
      this.diagnostic=null;return {state};
    } catch(cause) {
      if(cause.code==='ENOENT'){this.diagnostic=null;return {state:empty()};}
      const code=cause.code==='NAVIGATION_LIMIT' || /File (exceeds read limit|grew beyond read limit)/.test(cause.message) ? 'NAVIGATION_LIMIT' : 'INVALID_NAVIGATION';
      this.diagnostic={code};return {state:empty(),refused:true};
    }
  }
  async read() {return (await this.load()).state;}
  async locations() {return (await this.read()).entries.map(entry=>entry.location);}
  async record(input,{isCurrent=()=>true}={}) {
    let entry;try{entry=normalizeNavigationRequest(input);}catch(cause){return refusal(cause.code ?? 'INVALID_NAVIGATION');}
    const writable=async()=>{
      try {return isCurrent()===true && await this.canWrite()===true && isCurrent()===true;}catch{return false;}
    };
    return serialize(this.root,async()=>{
      try {
        if(!await writable())return refusal('ACCESS_REFUSED');
        const loaded=await this.load();if(loaded.refused)return refusal(this.diagnostic.code);
        const entries=[entry,...loaded.state.entries.filter(item=>item.projectId!==entry.projectId)];
        if(entries.length>64)return refusal('NAVIGATION_LIMIT');
        entries.sort((a,b)=>b.visitedAt.localeCompare(a.visitedAt));
        const bytes=Buffer.from(JSON.stringify(normalizeRecord({schema:1,entries})));
        if(bytes.length>NAVIGATION_BYTES)return refusal('NAVIGATION_LIMIT');
        if(!await writable())return refusal('ACCESS_REFUSED');
        const directory=await this.directory(true);
        const path=join(directory,'navigation.json');
        await atomicWrite(path,bytes,{fault:async phase=>{
          await this.fault(phase);
          if(phase==='before-rename') {
            await this.directory();
            if(!await writable())throw error('ACCESS_REFUSED');
          }
        }});
        // Access can change after a durable replacement. Refuse outward success;
        // never invent a rollback or a verified receipt from the failed call.
        if(!await writable())return refusal('ACCESS_REFUSED');
        this.diagnostic=null;return {ok:true};
      } catch(cause) {return refusal(cause.code==='ACCESS_REFUSED'?'ACCESS_REFUSED':'NAVIGATION_WRITE_FAILED');}
    });
  }
}
