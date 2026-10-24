// Explicit inert VM require/cache/native controls. No addon or Electron load.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {types} from 'node:util';
const url=new URL('../src/terminal/desktop-native-filesystem.mjs',import.meta.url),source=await readFile(url,'utf8');
const nativePath=fileURLToPath(new URL('../../native/terminal-filesystem-candidate/build/Release/siren_terminal_filesystem_candidate.node',url));
const guarded=value=>Object.defineProperty(value,'then',{value:undefined});
const receipt=()=>guarded({retired:true,actualSettled:true,pending:0});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture(change=()=>{}){
 const s={loads:0,resolves:0,inspections:0,retirements:0,factories:0,instances:[],calls:[],cache:Object.create(null),onFactory:null,onQuery:null,onRequire:null};
 s.addon={createFilesystemInspector:function(){assert.equal(this,s.addon);s.factories++;const n={getSystemDirectory(){assert.equal(this,n);s.inspections++;s.calls.push(['query',n]);return s.onQuery?s.onQuery(n):Promise.resolve('C:\\Windows\\System32');},inspectDirectory(){return Promise.reject(Error('unused'));},inspectFile(){return Promise.reject(Error('unused'));},retire(){assert.equal(this,n);s.retirements++;s.calls.push(['retire',n]);return s.onRetire?s.onRetire(n):Promise.resolve(receipt());}};s.instances.push(n);s.onFactory?.(n);return n;}};
 s.require=function(path){assert.equal(path,nativePath);s.loads++;s.onRequire?.();const existing=Object.getOwnPropertyDescriptor(s.require.cache,path);if(existing&&Object.hasOwn(existing,'value'))return existing.value.exports;s.record={filename:path,loaded:true,exports:s.addon};s.require.cache[path]=s.record;return s.addon;};
 s.require.cache=s.cache;s.require.resolve=path=>{s.resolves++;assert.equal(path,nativePath);return path;};
 change(s);
 const body=source.replace(/^import .*;\r?\n/gm,'').replaceAll('export ','').replaceAll('import.meta.url',JSON.stringify(url.href));
 s.load=vm.runInThisContext('(function(types,createRequire,fileURLToPath,URL){'+body+'\nreturn loadDesktopNativeFilesystemProvider;})')(types,()=>s.require,fileURLToPath,URL);
 s.options={assertResourcesCurrent:()=>true};return s;
}

for(const kind of ['canonical','case-alias','filename-alias'])test('BEHAVIOR RED preloaded '+kind+' cache cannot be accepted as a fresh native load',async()=>{
 const s=fixture(x=>{const key=kind==='canonical'?nativePath:kind==='case-alias'?nativePath.toUpperCase():nativePath+'.alias';x.cache[key]={filename:kind==='filename-alias'?nativePath: key,loaded:true,exports:x.addon};});
 await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);assert.equal(s.loads,0);assert.equal(s.factories,0);
});

test('BEHAVIOR RED replaced bound factory cannot authorize a later native query or a new inspector',async()=>{
 const s=fixture(),a=await s.load(s.options),original=s.addon.createFilesystemInspector;
 s.addon.createFilesystemInspector=()=>{throw Error('replacement');};
 await assert.rejects(a.getSystemDirectory(),/FS_CACHE_REFUSED/);
 s.addon.createFilesystemInspector=original;await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);assert.equal(s.inspections,0);assert.equal(s.loads,1);await a.retire();assert.equal(s.retirements,1);
});

test('same captured binding gives distinct project inspectors and preserves original receivers',async()=>{
 const s=fixture(),a=await s.load(s.options),b=await s.load(s.options);assert.equal(s.loads,1);assert.equal(s.factories,2);assert.notEqual(s.instances[0],s.instances[1]);assert.equal(await a.getSystemDirectory(),'C:\\Windows\\System32');assert.equal(await b.getSystemDirectory(),'C:\\Windows\\System32');assert.equal(a.nativeExecutionAdmitted,false);assert.equal(b.nativeExecutionAdmitted,false);await a.retire();assert.equal(await b.getSystemDirectory(),'C:\\Windows\\System32');await b.retire();assert.equal(s.retirements,2);assert.equal(s.calls.filter(r=>r[0]==='retire').length,2);
});

for(const kind of ['cache-object','canonical-record','exports-object','factory','extra-export','loaded-flag','filename','case-alias','filename-alias','exports-alias'])test('sticky stale '+kind+' fences all instances and never blocks captured retirement',async()=>{
 const s=fixture(),a=await s.load(s.options),b=await s.load(s.options),oldCache=s.require.cache,oldRecord=s.record,oldExports=s.record.exports,oldFactory=s.addon.createFilesystemInspector;
 if(kind==='cache-object')s.require.cache=Object.assign(Object.create(null),s.cache);
 if(kind==='canonical-record')s.cache[nativePath]={...s.record};
 if(kind==='exports-object')s.record.exports={createFilesystemInspector:oldFactory};
 if(kind==='factory')s.addon.createFilesystemInspector=function(){};
 if(kind==='extra-export')s.addon.extra=()=>{};
 if(kind==='loaded-flag')s.record.loaded=false;
 if(kind==='filename')s.record.filename=nativePath+'.other';
 if(kind==='case-alias')s.cache[nativePath.toUpperCase()]={...s.record};
 if(kind==='filename-alias')s.cache[nativePath+'.alias']={filename:nativePath.toUpperCase(),loaded:true,exports:{}};
 if(kind==='exports-alias')s.cache[nativePath+'.alias']={filename:nativePath+'.other',loaded:true,exports:s.addon};
 await assert.rejects(a.getSystemDirectory(),/FS_CACHE_REFUSED/);assert.equal(s.inspections,0);
 s.require.cache=oldCache;for(const key of Reflect.ownKeys(oldCache))if(key!==nativePath)delete oldCache[key];oldCache[nativePath]=oldRecord;oldRecord.filename=nativePath;oldRecord.loaded=true;oldRecord.exports=oldExports;s.addon.createFilesystemInspector=oldFactory;delete s.addon.extra;
 await assert.rejects(b.getSystemDirectory(),/FS_CACHE_REFUSED/);await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);assert.equal(s.loads,1);await a.retire();await b.retire();assert.equal(s.retirements,2);
});

test('cache changed during a held query cannot publish late DATA, retirement still joins actual work',async()=>{
 const held=deferred(),retirement=deferred(),s=fixture(x=>{x.onQuery=()=>held.promise;x.onRetire=()=>retirement.promise;}),a=await s.load(s.options),q=a.getSystemDirectory();let done=false;s.record.exports={};const p=a.retire();p.then(()=>done=true);await Promise.resolve();assert.equal(done,false);held.resolve('C:\\Windows\\System32');await assert.rejects(q,/FS_RETIRED/);retirement.resolve(receipt());assert.equal((await p).actualSettled,true);assert.equal(s.retirements,1);await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);
});

test('cache changed during a query await refuses its late result before any retirement',async()=>{
 const held=deferred(),s=fixture(x=>x.onQuery=()=>held.promise),a=await s.load(s.options),q=a.getSystemDirectory();s.record.loaded=false;held.resolve('C:\\Windows\\System32');await assert.rejects(q,/FS_CACHE_REFUSED/);await a.retire();assert.equal(s.retirements,1);
});

test('factory cache mutation retains the allocated inspector until actual retirement settles',async()=>{
 const held=deferred(),s=fixture(x=>{x.onFactory=()=>{x.record.exports={};};x.onRetire=()=>held.promise;});let done=false;const p=s.load(s.options);p.catch(()=>done=true);await Promise.resolve();assert.equal(s.factories,1);assert.equal(s.retirements,1);assert.equal(done,false);held.resolve(receipt());await assert.rejects(p,/FS_CACHE_REFUSED/);await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);assert.equal(s.loads,1);
});

test('resource guard mutation and reentry cannot authorize a stale native query',async()=>{
 const s=fixture();let armed=false,nested;s.options.assertResourcesCurrent=()=>{if(armed){s.record.loaded=false;nested=s.load(s.options).catch(e=>e);}return true;};const a=await s.load(s.options);armed=true;await assert.rejects(a.getSystemDirectory(),/FS_CACHE_REFUSED/);assert.equal((await nested).message,'FS_CACHE_REFUSED');assert.equal(s.inspections,0);await a.retire();
});

test('first require reentry refuses without second require and invalidates the incomplete binding',async()=>{
 let nested;const s=fixture(x=>{x.onRequire=()=>{nested=x.load(x.options).catch(e=>e);};});await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);assert.equal((await nested).message,'FS_CACHE_REFUSED');assert.equal(s.loads,1);assert.equal(s.factories,0);await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);
});

test('factory reentry uses the captured binding and creates another independent inspector',async()=>{
 let nested;const s=fixture(x=>{x.onFactory=()=>{if(x.factories===1)nested=x.load(x.options);};}),a=await s.load(s.options),b=await nested;assert.equal(s.loads,1);assert.equal(s.factories,2);await a.retire();await b.retire();assert.equal(s.retirements,2);
});

for(const kind of ['cache-proxy','entry-getter','filename-getter','exports-getter','factory-getter'])test('untrusted '+kind+' refuses without getter/proxy callouts',async()=>{
 let hits=0;const s=fixture(x=>{
  if(kind==='cache-proxy')x.require.cache=new Proxy(x.cache,{ownKeys(){hits++;throw Error('trap');}});
  if(kind==='entry-getter')Object.defineProperty(x.cache,nativePath,{enumerable:true,get(){hits++;throw Error('getter');}});
  if(kind==='filename-getter')x.cache[nativePath+'.alias']=Object.defineProperty({exports:{}},'filename',{get(){hits++;return nativePath;}});
  if(kind==='exports-getter'){const original=x.require;x.require=path=>{const addon=original(path);Object.defineProperty(x.cache[path],'exports',{configurable:true,get(){hits++;return x.addon;}});return addon;};x.require.cache=x.cache;x.require.resolve=original.resolve;}
  if(kind==='factory-getter')Object.defineProperty(x.addon,'createFilesystemInspector',{get(){hits++;return ()=>{};}});
 });await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED|FS_NATIVE_REFUSED/);assert.equal(hits,0);assert.equal(s.factories,0);
});

test('wrong exact resolution refuses before native require and stays refused after resolution repair',async()=>{
 const s=fixture(x=>x.require.resolve=()=>nativePath+'.js');await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);s.require.resolve=()=>nativePath;await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);assert.equal(s.loads,0);
});

test('external resource prerequisite remains mandatory, independent of a valid cache',async()=>{
 const s=fixture();for(const options of [undefined,{assertResourcesCurrent:()=>Promise.resolve(true)},{assertResourcesCurrent:()=>false}])await assert.rejects(s.load(options),/FS_RESOURCE_REFUSED/);assert.equal(s.loads,0);const a=await s.load(s.options);let current=false;await assert.rejects(s.load({assertResourcesCurrent:()=>current}),/FS_RESOURCE_REFUSED/);assert.equal(s.factories,1);await a.retire();
});

test('GUARD RED throwing factory still checks cache and preserves older inspector retirement',async()=>{
 const s=fixture(),a=await s.load(s.options);s.onFactory=()=>{s.record.loaded=false;throw Error('private factory failure');};await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);s.record.loaded=true;s.onFactory=null;await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);assert.equal(s.factories,2);await a.retire();assert.equal(s.retirements,1);assert.equal(s.loads,1);
});

test('GUARD RED rejected native query still observes cache invalidation before later restoration',async()=>{
 const held=deferred(),s=fixture(x=>x.onQuery=()=>held.promise),a=await s.load(s.options),b=await s.load(s.options),q=a.getSystemDirectory();s.record.loaded=false;held.reject(Object.assign(Error('private'),{code:'FS_CHANGED'}));await assert.rejects(q,/FS_CACHE_REFUSED/);s.record.loaded=true;await assert.rejects(b.getSystemDirectory(),/FS_CACHE_REFUSED/);await a.retire();await b.retire();assert.equal(s.retirements,2);assert.equal(s.inspections,1);
});

test('EXIT RED synchronous query throw cannot hide cache mutation behind a safe native error',async()=>{
 const s=fixture(),a=await s.load(s.options),b=await s.load(s.options);s.onQuery=()=>{s.record.loaded=false;throw Object.assign(Error('private'),{code:'FS_CHANGED'});};await assert.rejects(a.getSystemDirectory(),/FS_CHANGED|FS_CACHE_REFUSED/);s.record.loaded=true;s.onQuery=null;await assert.rejects(b.getSystemDirectory(),/FS_CACHE_REFUSED/);await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);assert.equal(s.factories,2);assert.equal(s.inspections,1);await a.retire();await b.retire();assert.equal(s.retirements,2);
});

test('EXIT RED malformed native return cannot hide cache mutation behind settlement setup refusal',async()=>{
 let reads=0;const s=fixture(),a=await s.load(s.options),b=await s.load(s.options);s.onQuery=()=>{s.record.loaded=false;return Object.defineProperty({},'then',{get(){reads++;throw Error('must not read');}});};await assert.rejects(a.getSystemDirectory(),/FS_NATIVE_REFUSED|FS_CACHE_REFUSED/);assert.equal(reads,0);s.record.loaded=true;s.onQuery=null;await assert.rejects(b.getSystemDirectory(),/FS_CACHE_REFUSED/);await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);assert.equal(s.factories,2);await a.retire();await b.retire();assert.equal(s.retirements,2);
});

for(const mode of ['false','throw'])test('EXIT RED resource guard '+mode+' cannot hide cache mutation before restoration',async()=>{
 let armed=false;const s=fixture();s.options.assertResourcesCurrent=()=>{if(armed){s.record.loaded=false;if(mode==='throw')throw Error('private');return false;}return true;};const a=await s.load(s.options),b=await s.load(s.options);armed=true;await assert.rejects(a.getSystemDirectory(),/FS_RESOURCE_REFUSED|FS_CACHE_REFUSED/);armed=false;s.record.loaded=true;await assert.rejects(b.getSystemDirectory(),/FS_CACHE_REFUSED/);await assert.rejects(s.load(s.options),/FS_CACHE_REFUSED/);assert.equal(s.inspections,0);assert.equal(s.factories,2);await a.retire();await b.retire();assert.equal(s.retirements,2);
});

for(const mode of ['false','throw'])test('EXIT PRESERVATION valid-cache resource guard '+mode+' does not poison another provider or later creation',async()=>{
 let armed=false;const s=fixture();s.options.assertResourcesCurrent=()=>{if(armed){if(mode==='throw')throw Error('private');return false;}return true;};const a=await s.load(s.options),b=await s.load(s.options);armed=true;await assert.rejects(a.getSystemDirectory(),/FS_RESOURCE_REFUSED/);armed=false;assert.equal(await b.getSystemDirectory(),'C:\\Windows\\System32');const c=await s.load(s.options);assert.equal(await c.getSystemDirectory(),'C:\\Windows\\System32');assert.equal(s.loads,1);assert.equal(s.factories,3);await a.retire();await b.retire();await c.retire();assert.equal(s.retirements,3);
});
