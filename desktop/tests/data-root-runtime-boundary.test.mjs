// Actual helper under controlled fs boundaries; no native filesystem qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import * as util from 'node:util';
import vm from 'node:vm';
const source=await readFile(new URL('../src/data-root.mjs',import.meta.url),'utf8');
const R='C:\\Control\\Runtime',DATA='C:\\Data',key=p=>p.toLowerCase();
const denied=/DATA_ROOT_(?:BOUNDARY|OPTIONS)_REFUSED/;
function parts(value){const root=path.win32.parse(value).root,names=value.slice(root.length).split('\\').filter(Boolean);return [root,...names.map((_,i)=>path.win32.join(root,...names.slice(0,i+1)))];}
async function fixture(){
 const calls=[],dirs=new Map(),faults=new Map(),counts=new Map();let serial=0,uuid=0;
 const s={calls,dirs,faults,onLstat:null,onRealpath:null,onMkdir:null,onOpen:null,onWrite:null};
 s.put=(name,extra={})=>{const row={path:name,canonical:name,dev:1n,ino:BigInt(++serial),directory:true,link:false,mtime:0,...extra};dirs.set(key(name),row);return row;};
 for(const p of ['C:\\','C:\\Control',R,DATA])s.put(p);
 const fs={
  async lstat(name,options){calls.push(['lstat',name,options]);const count=(counts.get(key(name))??0)+1;counts.set(key(name),count);s.onLstat?.(name,count);
   if(faults.has(key(name)))throw faults.get(key(name));const row=dirs.get(key(name));if(!row)throw Object.assign(Error('absent'),{code:'ENOENT'});
   return {dev:row.dev,ino:row.ino,isDirectory:()=>row.directory,isSymbolicLink:()=>row.link};},
  async realpath(name){calls.push(['realpath',name]);s.onRealpath?.(name);const row=dirs.get(key(name));if(!row)throw Object.assign(Error('absent'),{code:'ENOENT'});return row.canonical;},
  async mkdir(name,options){calls.push(['mkdir',name,options]);if(faults.get('mkdir:'+key(name)))throw faults.get('mkdir:'+key(name));for(const p of parts(name))if(!dirs.has(key(p)))s.put(p);s.onMkdir?.(name);},
  async open(name,flags,mode){calls.push(['open',name,flags,mode]);assert.equal(flags,'wx');assert.equal(mode,0o600);s.onOpen?.(name);return {
   async writeFile(body){calls.push(['write',name,body]);s.onWrite?.(name);},async sync(){calls.push(['sync',name]);},async close(){calls.push(['close',name]);}};},
  async unlink(name){calls.push(['unlink',name]);}
 };
 const imports=new Map();
 for(const [name,values] of [['node:fs/promises',fs],['node:path',path],['node:crypto',{randomUUID:()=>String(++uuid)}],['node:util',util]]){
  const keys=Object.keys(values);imports.set(name,new vm.SyntheticModule(keys,function(){for(const k of keys)this.setExport(k,values[k]);}));
 }
 const module=new vm.SourceTextModule(source,{identifier:new URL('../src/data-root.mjs',import.meta.url).href});
 await module.link(name=>{assert(imports.has(name),'fixed built-in import '+name);return imports.get(name);});await module.evaluate();s.api=module.namespace;
 s.effects=()=>calls.filter(c=>['mkdir','open','write','sync','close','unlink'].includes(c[0]));
 s.noWrites=()=>assert.deepEqual(s.effects(),[],'guarded refusal must precede helper mkdir/probe');
 return s;
}
const writable=(s,value,root=R)=>s.api.writableDataRoot(value,{protectedRuntimeRoot:root});

test('guarded equal, inside and ancestor roots refuse before helper writes',async()=>{
 for(const value of [R,R+'\\Data','c:\\control\\runtime\\inside','C:\\Control']){const s=await fixture();await assert.rejects(writable(s,value),denied);s.noWrites();}
});
test('guarded raw DOS spelling and invalid components refuse before reads or writes',async()=>{
 for(const value of ['relative','C:relative','C:\\','\\\\server\\share\\Data','\\\\?\\C:\\Data','C:/Data','C:\\Data\\..\\Other','C:\\Data\\.\\Other','C:\\Data\\','C:\\\\Data','C:\\PROGRA~1\\Data','C:\\Data:stream','C:\\NUL\\Data','C:\\Data.','C:\\Data ','C:\\Data\\bad\u0000']){
  const s=await fixture();await assert.rejects(writable(s,value),denied);s.noWrites();assert.equal(s.calls.length,0);
 }
});
test('component-prefix sibling remains disjoint and writable',async()=>{const s=await fixture();assert.equal(await writable(s,'C:\\Control\\Runtime2\\Data'),'C:\\Control\\Runtime2\\Data');assert.equal(s.calls.filter(c=>c[0]==='open').length,1);});
test('existing aliased ancestor with a missing suffix refuses before mkdir',async()=>{const s=await fixture();s.put('C:\\Alias',{canonical:R});await assert.rejects(writable(s,'C:\\Alias\\missing\\child'),denied);s.noWrites();});
test('reported junction and nondirectory prefixes refuse before mkdir',async()=>{
 for(const extra of [{link:true},{directory:false}]){const s=await fixture();s.put('C:\\Alias',extra);await assert.rejects(writable(s,'C:\\Alias\\missing'),denied);s.noWrites();}
});
test('protected tree and its ancestors must exist and remain canonical directories',async()=>{
 for(const change of [s=>s.dirs.delete(key(R)),s=>s.dirs.get(key('C:\\Control')).canonical='C:\\Elsewhere',s=>s.dirs.get(key(R)).directory=false]){const s=await fixture();change(s);await assert.rejects(writable(s,DATA),denied);s.noWrites();}
});
test('unknown prefix errors and unknown namespace identity refuse',async()=>{
 for(const change of [s=>s.faults.set(key(DATA),Object.assign(Error('denied'),{code:'EACCES'})),s=>{s.dirs.get(key(DATA)).ino=undefined;}]){const s=await fixture();change(s);await assert.rejects(writable(s,DATA),denied);s.noWrites();}
});
test('an absent volume root is not an allowed missing child suffix',async()=>{const s=await fixture();await assert.rejects(writable(s,'D:\\Missing\\Data'),denied);s.noWrites();});
test('namespace replacement around realpath refuses before helper effects',async()=>{const s=await fixture();let changed=false;s.onRealpath=p=>{if(p===DATA&&!changed){changed=true;s.dirs.get(key(DATA)).ino+=100n;}};await assert.rejects(writable(s,DATA),denied);s.noWrites();});
test('second preflight walk catches stale existing ancestors before mkdir',async()=>{const s=await fixture();s.onLstat=(p,n)=>{if(p==='C:\\Control'&&n===3)s.dirs.get(key(p)).ino+=100n;};await assert.rejects(writable(s,DATA+'\\new'),denied);s.noWrites();});
test('a previously missing prefix appearing as an alias is checked before mkdir',async()=>{const s=await fixture();s.onLstat=(p,n)=>{if(p==='C:\\New'&&n===2)s.put(p,{canonical:R});};await assert.rejects(writable(s,'C:\\New\\child'),denied);s.noWrites();});
test('safe missing descendants reach exclusive probe and retain cleanup',async()=>{
 const s=await fixture(),value=DATA+'\\fresh\\nested';assert.equal(await writable(s,value),value);
 assert.deepEqual(s.effects().map(c=>c[0]),['mkdir','open','write','sync','close','unlink']);assert.equal(s.calls.some(c=>c[0]==='lstat'&&c[1]===value),true);
});
test('post-mkdir stale identity blocks the probe',async()=>{const s=await fixture();s.onMkdir=()=>{s.dirs.get(key('C:\\Control')).ino+=100n;};await assert.rejects(writable(s,DATA+'\\new'),denied);assert.deepEqual(s.effects().map(c=>c[0]),['mkdir']);});
test('helper creation may change membership metadata without invalidating stable identities',async()=>{const s=await fixture();s.onMkdir=()=>{for(const row of s.dirs.values())row.mtime++;};assert.equal(await writable(s,DATA+'\\new'),DATA+'\\new');});
test('every preferred retry and chooser value retains the same protected root',async()=>{
 const s=await fixture();s.put('C:\\Alias',{canonical:R});const values=['C:\\Control','C:\\Alias\\new',DATA+'\\chosen'];let choices=0;
 const result=await s.api.chooseDataRoot({preferred:R+'\\inside',protectedRuntimeRoot:R,choose:async()=>values[choices++]});
 assert.equal(result,DATA+'\\chosen');assert.equal(choices,3);assert.deepEqual(s.calls.filter(c=>c[0]==='mkdir').map(c=>c[1]),[DATA+'\\chosen']);
});
test('guarded cancellation returns null with no implicit alternate writes',async()=>{const s=await fixture();let choices=0;assert.equal(await s.api.chooseDataRoot({preferred:R,protectedRuntimeRoot:R,choose:async()=>{choices++;return null;}}),null);assert.equal(choices,1);s.noWrites();});
test('ordinary omitted-option path retains its first mkdir and successful probe',async()=>{const s=await fixture();const value='ordinary-relative';assert.equal(await s.api.writableDataRoot(value),path.resolve(value));assert.equal(s.calls[0][0],'mkdir');assert.deepEqual(s.effects().map(c=>c[0]),['mkdir','open','write','sync','close','unlink']);});
test('ordinary chooser still retries explicitly and cancellation remains null',async()=>{
 const s=await fixture();const bad=DATA+'\\bad';s.faults.set('mkdir:'+key(bad),Object.assign(Error('readonly'),{code:'EACCES'}));let choices=0;
 assert.equal(await s.api.chooseDataRoot({preferred:bad,choose:async()=>{choices++;return null;}}),null);assert.equal(choices,1);
 assert.equal(await s.api.chooseDataRoot({preferred:bad,choose:async()=>DATA+'\\chosen'}),DATA+'\\chosen');
});
test('exclusive probe collision never writes or removes another file',async()=>{const s=await fixture();s.onOpen=()=>{throw Object.assign(Error('exists'),{code:'EEXIST'});};await assert.rejects(writable(s,DATA),/exists/);assert.deepEqual(s.effects().map(c=>c[0]),['mkdir','open']);});
test('probe write failure still closes and unlinks the owned probe',async()=>{const s=await fixture();s.onWrite=()=>{throw Error('write failed');};await assert.rejects(writable(s,DATA),/write failed/);assert.deepEqual(s.effects().map(c=>c[0]),['mkdir','open','write','close','unlink']);});
test('protected-root option is closed DATA and cannot select a verifier callback',async()=>{
 let hooks=0;const revoked=Proxy.revocable({},{});revoked.revoke();
 for(const options of [null,()=>R,{protectedRuntimeRoot:()=>R},{protectedRuntimeRoot:R,verify:()=>true},revoked.proxy,Object.defineProperty({},'protectedRuntimeRoot',{enumerable:true,get(){hooks++;return R;}})]){
  const s=await fixture();await assert.rejects(s.api.writableDataRoot(DATA,options),denied);s.noWrites();
 }assert.equal(hooks,0);
});
