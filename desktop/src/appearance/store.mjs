import {mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {ownedDirectory,ownedFile} from '../projects/paths.mjs';
import {readOwnedBytes} from '../projects/io.mjs';
import {atomicWrite} from '../projects/atomic.mjs';
import {appearanceRequest} from './contracts.mjs';
import {navigationFields} from '../navigation/contracts.mjs';
const writers=new Map(),fail=code=>({ok:false,code});
/** Appearance only. No entity names, sources, credentials or arbitrary paths. */
export class AppearanceStore{
 constructor(root,{canWrite=()=>true,fault=async()=>{}}={}){this.root=resolve(root);this.canWrite=canWrite;this.fault=fault;}
 async directory(create=false){await ownedDirectory(this.root);const path=join(this.root,'UI');if(create)try{await mkdir(path);}catch(e){if(e.code!=='EEXIST')throw e;}return ownedDirectory(path);}
 async read(){
  try{const path=await ownedFile(join(await this.directory(),'appearance.json'));
   const data=navigationFields(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await readOwnedBytes(path,1024))),['schema','theme'],['schema','theme']);
   if(data.schema!==1)throw Error();return {ok:true,...appearanceRequest({theme:data.theme})};
  }catch(e){return e.code==='ENOENT'?{ok:true,theme:'system'}:fail('INVALID_APPEARANCE');}
 }
 async set(input,{isCurrent=()=>true}={}){
  let data;try{data=appearanceRequest(input);}catch{return fail('REQUEST_REFUSED');}
  const writable=async()=>{try{return isCurrent()===true&&await this.canWrite()===true&&isCurrent()===true;}catch{return false;}};
  const key=this.root.toLowerCase();const task=(writers.get(key)??Promise.resolve()).catch(()=>{}).then(async()=>{
   try{if(!await writable())return fail('ACCESS_REFUSED');const previous=await this.read();if(!previous.ok)return previous;
    const directory=await this.directory(true);if(!await writable())return fail('ACCESS_REFUSED');
    await atomicWrite(join(directory,'appearance.json'),Buffer.from(JSON.stringify({schema:1,...data})),{fault:async phase=>{
     await this.fault(phase);if(phase==='before-rename'){await this.directory();if(!await writable())throw Object.assign(Error(),{code:'ACCESS_REFUSED'});}
    }});
    return await writable()?{ok:true,...data}:fail('ACCESS_REFUSED');
   }catch(e){return fail(e.code==='ACCESS_REFUSED'?'ACCESS_REFUSED':'APPEARANCE_WRITE_FAILED');}
  });writers.set(key,task);return task.finally(()=>{if(writers.get(key)===task)writers.delete(key);});
 }
}
