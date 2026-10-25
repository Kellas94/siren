import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SourceTextModule,SyntheticModule,createContext} from 'node:vm';
import {fileURLToPath} from 'node:url';
import {types} from 'node:util';
const url=new URL('../src/terminal/desktop-native-host-loader.mjs',import.meta.url),source=await readFile(url,'utf8');
const dir=fileURLToPath(new URL('../../../',url)).replace(/[\\/]$/,''),nativePath=fileURLToPath(new URL('../../native/terminal-host-roster-candidate/build/Release/siren_terminal_host_roster_candidate.node',url));
const keys=['start','snapshot','createPeerListeners','createPeerSession','snapshotSession','watchRoot','captureSession','acceptPeerLane','peerRead','peerWrite','assertPeerCurrent','peerSnapshot','closePeerEndpoint','closePeerListeners','stopAndCloseSessionAsync','stopAndCloseHostAsync','captureHostShutdownPeerRoster','captureHostShutdownExpectation','mark'];
const plain=v=>Object.assign(Object.create(null),v);
async function fixture(options={}){
 const calls=[],resources=Object.freeze(plain({})),ownedTree=Object.freeze(plain({})),raw=plain({}),cache=plain({});let nativeReads=0,treeReads=0;
 for(const key of keys)Object.defineProperty(raw,key,{value:function(...args){calls.push({key,thisValue:this,args});return key==='mark'?1n:'raw-'+key;},writable:true,configurable:true});
 const process={platform:'win32',arch:'x64',type:'browser',versions:{electron:'44.5.1',modules:'149',napi:'10'},execPath:dir+'\\electron\\electron.exe',...options.process};
 const req=path=>{calls.push({load:path});assert.equal(path,nativePath);cache[path]=plain({filename:path,exports:raw,loaded:true});options.onLoad?.({raw,cache,path});return raw;};req.cache=cache;
 options.before?.({cache,raw});
 const context=createContext({URL,Object,Map,Promise,Reflect,Error,process});
 const dependencies={
  'node:module':{createRequire:()=>req},'node:url':{fileURLToPath},'node:util':{types},
  './desktop-native-runtime-resources.mjs':{desktopNativeRuntimeResourcePaths:r=>r===resources?{directory:dir,executable:dir+'\\electron\\electron.exe'}:null,recheckDesktopNativeRuntimeResources:async r=>{nativeReads++;return r===resources&&options.resourcesValid!==false;}},
  './desktop-native-owned-tree.mjs':{recheckDesktopNativeOwnedTree:async(r,h)=>{treeReads++;options.onTree?.({treeReads,cache,raw,process});return r===resources&&h===ownedTree&&options.treeValid!==false;}}
 };
 const module=new SourceTextModule(source,{context,identifier:url.href,initializeImportMeta:meta=>{meta.url=url.href;}});
 await module.link(async spec=>{const d=dependencies[spec];assert(d,'unexpected dependency '+spec);return new SyntheticModule(Object.keys(d),function(){for(const [k,v]of Object.entries(d))this.setExport(k,v);},{context});});await module.evaluate();
 const loader=module.namespace.createDesktopNativeHostLoader(plain({resources,ownedTree}));
 return {loader,module,resources,ownedTree,raw,cache,calls,req,process,reads:()=>({nativeReads,treeReads})};
}
test('import/factory are inert; fixed load retains 18 facade methods and separate mark without invoking raw start',async()=>{
 const f=await fixture();assert.equal(f.calls.length,0);const h=await f.loader.load();assert.equal(f.calls.length,1);assert.equal(f.calls[0].load,nativePath);assert.equal(Object.keys(h.native).length,18);assert(Object.isFrozen(h.native));assert.equal(h.mark(),1n);assert.equal(h.native.snapshot('opaque'),'raw-snapshot');assert.equal(f.calls.at(-1).thisValue,f.raw);assert.deepEqual(f.calls.at(-1).args,['opaque']);assert.equal(h.isCurrent(),true);assert.equal(h.snapshot().nativeExecutionAdmitted,false);assert.equal(h.snapshot().completeRuntimeClosure,false);assert.equal(h.snapshot().loadedModuleProvenanceVerified,false);assert.equal(f.reads().treeReads,2);
});
test('actual Node-like runtime is refused before loading; wrong MAIN version and image likewise',async()=>{
 for(const process of [{type:undefined},{platform:'linux'},{arch:'arm64'},{versions:{electron:'44.5.1',modules:'137',napi:'10'}},{execPath:'C:\\wrong.exe'}]){const f=await fixture({process});await assert.rejects(f.loader.load(),/HOST_LOADER_RESOURCE_REFUSED/);assert.equal(f.calls.length,0);assert.equal(f.loader.snapshot().state,'invalid');}
});
test('bad critical/tree recheck blocks load; another-resource and cloned-tree inputs cannot pass bridge',async()=>{
 for(const options of [{resourcesValid:false},{treeValid:false}]){const f=await fixture(options);await assert.rejects(f.loader.load(),/HOST_LOADER_RESOURCE_REFUSED/);assert.equal(f.calls.length,0);}
 const f=await fixture(),create=f.module.namespace.createDesktopNativeHostLoader;
 const a=create(plain({resources:plain({}),ownedTree:f.ownedTree}));await assert.rejects(a.load(),/HOST_LOADER_RESOURCE_REFUSED/);
 const b=create(plain({resources:f.resources,ownedTree:plain({})}));await assert.rejects(b.load(),/HOST_LOADER_RESOURCE_REFUSED/);assert.equal(f.calls.length,0);
});
test('unknown prior cache entry and case alias refuse without deleting or reloading',async()=>{
 for(const key of [nativePath,nativePath.toUpperCase()]){const sentinel={};const f=await fixture({before:({cache})=>{cache[key]=sentinel;}});await assert.rejects(f.loader.load(),/HOST_LOADER_CACHE_REFUSED/);assert.equal(f.calls.length,0);assert.equal(f.cache[key],sentinel);}
});
test('MAIN identity changed during first tree check refuses before native require',async()=>{
 const f=await fixture({onTree:({treeReads,process})=>{if(treeReads===1)process.type='renderer';}});
 await assert.rejects(f.loader.load(),/HOST_LOADER_RESOURCE_REFUSED/);assert.equal(f.calls.length,0);assert.equal(f.loader.snapshot().state,'invalid');
});
test('preexisting alias Module filename refuses before require even with distinct exports',async()=>{
 const sentinel=plain({filename:nativePath,exports:plain({prior:true}),loaded:true}),f=await fixture({before:({cache})=>{cache['C:\\unknown-alias.node']=sentinel;}});
 await assert.rejects(f.loader.load(),/HOST_LOADER_CACHE_REFUSED/);assert.equal(f.calls.length,0);assert.equal(f.cache['C:\\unknown-alias.node'],sentinel);
});
test('later alias Module filename permanently fences retained facade',async()=>{
 const f=await fixture(),h=await f.loader.load();f.cache['C:\\later-alias.node']=plain({filename:nativePath.toUpperCase(),exports:plain({})});assert.equal(h.isCurrent(),false);assert.throws(()=>h.native.start(),/HOST_LOADER_STALE/);
});
test('cache Module/export/filename/loaded mutation permanently fences the captured facade',async()=>{
 for(const mutate of [f=>{f.cache[nativePath]=plain({...f.cache[nativePath]});},f=>{f.cache[nativePath].exports=plain({});},f=>{f.cache[nativePath].filename='C:\\other.node';},f=>{f.cache[nativePath].loaded=false;},f=>{f.req.cache=plain({});},f=>{f.cache['C:\\alias.node']=plain({exports:f.raw});}]){
  const f=await fixture(),h=await f.loader.load();mutate(f);assert.equal(h.isCurrent(),false);assert.throws(()=>h.native.start('x'),/HOST_LOADER_STALE/);assert.equal(f.calls.filter(x=>x.key==='start').length,0);assert.equal(f.loader.snapshot().state,'invalid');
 }
});
test('method replacement or accessor is rejected without invoking it or using new method',async()=>{
 for(const accessor of [false,true]){const f=await fixture(),h=await f.loader.load();let hits=0;Object.defineProperty(f.raw,'start',accessor?{get(){hits++;throw Error('unexpected');}}:{value:()=>{hits++;}});assert.throws(()=>h.native.start(),/HOST_LOADER_STALE/);assert.equal(hits,0);}
});
test('post-load tree recheck detects cache substitution before facade publication',async()=>{
 const f=await fixture({onTree:({treeReads,cache})=>{if(treeReads===2)cache[nativePath]=plain({...cache[nativePath]});}});await assert.rejects(f.loader.load(),/HOST_LOADER_RESOURCE_REFUSED/);assert.equal(f.loader.snapshot().state,'invalid');assert.equal(f.calls.length,1);
});
test('one-attempt reservation is fenced before await; recheck temporarily prevents synchronous facade use',async()=>{
 const f=await fixture(),pending=f.loader.load();await assert.rejects(f.loader.load(),/HOST_LOADER_BUSY/);const h=await pending;await assert.rejects(f.loader.load(),/HOST_LOADER_BUSY/);const checking=f.loader.recheck();assert.equal(h.isCurrent(),false);assert.throws(()=>h.native.snapshot(),/HOST_LOADER_STALE/);assert.equal(await checking,true);assert.equal(h.isCurrent(),true);
});
test('strict options refuse accessors/proxy/extra fields without callout; extra args refuse',async()=>{
 const f=await fixture(),create=f.module.namespace.createDesktopNativeHostLoader;let hits=0;const bad=plain({ownedTree:f.ownedTree});Object.defineProperty(bad,'resources',{enumerable:true,get(){hits++;return f.resources;}});
 for(const value of [bad,new Proxy({},{}),plain({resources:f.resources,ownedTree:f.ownedTree,extra:true})])assert.throws(()=>create(value),/HOST_LOADER_REFUSED/);assert.equal(hits,0);await assert.rejects(f.loader.load('path'),/HOST_LOADER_BUSY/);assert.equal(f.calls.length,0);
});
