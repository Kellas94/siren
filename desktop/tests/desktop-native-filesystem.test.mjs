import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {types} from 'node:util';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createHook} from 'node:async_hooks';
import {CwdAuthority} from '../src/terminal/cwd.mjs';
import {createShellProfileCatalogue} from '../src/terminal/profiles.mjs';
const url=new URL('../src/terminal/desktop-native-filesystem.mjs',import.meta.url);
let source;try{source=await readFile(url,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;source='';}
function isolated(load,guard=()=>true){
 assert(source,'Missing concrete fixed native filesystem adapter');
 const body=source.replace(/^import .*;\r?\n/gm,'').replaceAll('export ','').replaceAll('import.meta.url',JSON.stringify(url.href));
 return vm.runInThisContext('(function(types,createRequire,fileURLToPath,URL){'+body+'\nreturn loadDesktopNativeFilesystemProvider;})')(types,()=>load,fileURLToPath,URL);
}
const guarded=value=>Object.defineProperty(value,'then',{value:undefined});
const retired=()=>guarded({retired:true,actualSettled:true,pending:0});
function fake(){let calls=[],retireCount=0;const native={getSystemDirectory:async()=>{calls.push('system');return 'C:\\Windows\\System32';},inspectDirectory:async p=>{calls.push(p);return directory(p);},inspectFile:async p=>{calls.push(p);return file(p);},retire:()=>{retireCount++;return Promise.resolve(retired());}};return {native,calls,get retireCount(){return retireCount;}};}
const identity=p=>'0000000000000001:'+createHash('sha256').update(p.toLowerCase()).digest('hex').slice(0,32);
const ancestry=p=>{const parts=p.slice(3).split('\\').filter(Boolean);return ['C:\\',...parts.map((_,i)=>'C:\\'+parts.slice(0,i+1).join('\\'))].map(path=>({path,identity:identity(path),directory:true,reparse:false}));};
const directory=p=>guarded({canonicalPath:p,identity:identity(p),directory:true,reparse:false,ancestors:ancestry(p)});
const file=p=>guarded({canonicalPath:p,identity:identity(p),file:true,reparse:false,ancestors:ancestry(p.slice(0,p.lastIndexOf('\\')))});
test('adapter is inert on import and refuses absent prerequisite before loader',async()=>{let loads=0;const load=isolated(()=>{loads++;throw Error('must not load');});await assert.rejects(load(),/FS_RESOURCE_REFUSED/);assert.equal(loads,0);assert(!source.includes('process.env'));assert(!source.includes('import('));});
test('fixed native module export and instance methods are captured without getters',async()=>{const f=fake();let selected;const load=isolated(p=>{selected=p;return {createFilesystemInspector:()=>f.native};});const adapter=await load({assertResourcesCurrent:()=>true});assert.equal(selected,fileURLToPath(new URL('../../native/terminal-filesystem-candidate/build/Release/siren_terminal_filesystem_candidate.node',url)));f.native.inspectDirectory=()=>{throw Error('override');};assert.equal((await adapter.inspectDirectory('C:\\Data')).canonicalPath,'C:\\Data');assert.equal(adapter.nativeExecutionAdmitted,false);assert(Object.isFrozen(adapter));let reads=0;await assert.rejects(isolated(()=>({get createFilesystemInspector(){reads++;return ()=>f.native;}}))({assertResourcesCurrent:()=>true}),/FS_NATIVE_REFUSED/);assert.equal(reads,0);});
test('private resource guard reentry and late failure cannot publish DATA',async()=>{const f=fake();let current=true;const adapter=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>current});f.native.inspectDirectory=()=>{throw Error('captured');};current=false;await assert.rejects(adapter.inspectDirectory('C:\\Data'),/FS_RESOURCE_REFUSED/);assert.deepEqual(f.calls,[]);await adapter.retire();assert.equal(f.retireCount,1);});
test('retirement is stable, rejects later queries and waits actual native promise',async()=>{const f=fake();let resolve;const done=new Promise(r=>resolve=r);f.native.retire=()=>{f.calls.push('retire');return done;};const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});const p=a.retire();assert.equal(a.retire(),p);await assert.rejects(a.getSystemDirectory(),/FS_RETIRED/);let settled=false;p.then(()=>settled=true);await Promise.resolve();assert.equal(settled,false);resolve(retired());assert.equal((await p).actualSettled,true);assert.deepEqual(f.calls,['retire']);});
test('actual CwdAuthority refuses protected roots and changed identities through adapter',async()=>{const f=fake();let changed=false;f.native.inspectDirectory=async p=>{const d=directory(p);if(changed&&p==='C:\\Data')d.identity='replaced';return d;};const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});const grant={windowId:'window',projectId:'project',epoch:1,role:'terminal'};let chosen='C:\\Private\\child';const cwd=new CwdAuthority({pickDirectory:async()=>({canceled:false,filePaths:[chosen]}),protectedRoots:['C:\\Private'],inspectDirectory:a.inspectDirectory,authorize:()=>true,captureAdmission:()=>({isCurrent:()=>true})});await assert.rejects(cwd.pick(grant),/CWD_REFUSED/);chosen='C:\\Data';const token=await cwd.pick(grant);assert.equal(await cwd.resolve(grant,token.cwdId),chosen);changed=true;await assert.rejects(cwd.resolve(grant,token.cwdId),/CWD_REFUSED/);await cwd.retireCwd().actualSettled;await a.retire();});
test('actual seeded catalogue uses native Modules ancestry and preserves private-deny priority',async()=>{const f=fake();const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});const options={getSystemDirectory:a.getSystemDirectory,inspectExecutable:a.inspectExecutable,inspectModuleDirectory:a.inspectModuleDirectory,authorize:()=>true,captureAdmission:()=>({isCurrent:()=>true}),readEnvironment:async()=>({SYSTEMROOT:'C:\\Windows',PATH:'C:\\Windows\\System32',PSModulePath:'untrusted'}),modulePathPolicy:'system-seeded'};const c=createShellProfileCatalogue(options);const shell=await c.resolveShellProfile('powershell');assert.equal(shell.env.PSModulePath,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules');assert(f.calls.includes(shell.env.PSModulePath));c.revoke();const denied=createShellProfileCatalogue({...options,privateEnvironmentKeys:['PSModulePath']});await assert.rejects(denied.resolveShellProfile('powershell'),/PROFILE_UNAVAILABLE/);c.dispose();denied.dispose();await a.retire();});

test('hostile configuration and native receiver descriptors never execute getters or proxy traps',async()=>{let hooks=0,loads=0;const load=isolated(()=>{loads++;return {createFilesystemInspector:()=>fake().native};});const rev=Proxy.revocable({},{});rev.revoke();for(const o of [rev.proxy,{get assertResourcesCurrent(){hooks++;return ()=>true;}},{assertResourcesCurrent:()=>true,path:'arbitrary'},{assertResourcesCurrent:new Proxy(()=>true,{apply(){hooks++;return true;}})}])await assert.rejects(load(o),/FS_RESOURCE_REFUSED/);assert.equal(loads,0);assert.equal(hooks,0);const f=fake();Object.defineProperty(f.native,'inspectDirectory',{get(){hooks++;return ()=>{};}});await assert.rejects(isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true}),/FS_NATIVE_REFUSED/);assert.equal(hooks,0);assert.equal(f.retireCount,1);});
test('resource changes while native query held refuse late DATA and retire retains pending work',async()=>{let release,current=true;const f=fake();f.native.inspectDirectory=()=>new Promise(r=>release=r);const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>current});const p=a.inspectDirectory('C:\\Data');current=false;release(directory('C:\\Data'));await assert.rejects(p,/FS_RESOURCE_REFUSED/);await a.retire();let joined=false;const g=fake();g.native.inspectDirectory=()=>new Promise(r=>release=r);g.native.retire=()=>new Promise(r=>{const original=release;release=value=>{original(value);joined=true;r(retired());};});const b=await isolated(()=>({createFilesystemInspector:()=>g.native}))({assertResourcesCurrent:()=>true});const q=b.inspectDirectory('C:\\Data');const done=b.retire();assert.equal(joined,false);release(directory('C:\\Data'));await assert.rejects(q,/FS_RETIRED/);assert.equal((await done).actualSettled,true);});
test('unknown retirement cannot become settled proof or silently retry',async()=>{for(const value of [{retired:true,actualSettled:false,pending:0},{retired:true,actualSettled:true,pending:1},{retired:true,actualSettled:true,pending:0,extra:1}]){const f=fake();f.native.retire=()=>Promise.resolve(guarded(value));const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});const p=a.retire();await assert.rejects(p,/FS_RETIREMENT_UNKNOWN/);assert.equal(a.retire(),p);await assert.rejects(a.inspectExecutable('C:\\test.exe'),/FS_RETIRED/);}});
test('native errors are fixed safe codes; promise descriptor hooks are refused without reads',async()=>{const f=fake();f.native.inspectFile=()=>Promise.reject(Error('sensitive native path'));const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});await assert.rejects(a.inspectExecutable('C:\\test.exe'),e=>e.message==='FS_NATIVE_REFUSED');await a.retire();let reads=0;const g=fake();g.native.inspectDirectory=()=>{const p=Promise.resolve(directory('C:\\Data'));Object.defineProperty(p,'constructor',{get(){reads++;return Promise;}});return p;};const b=await isolated(()=>({createFilesystemInspector:()=>g.native}))({assertResourcesCurrent:()=>true});await assert.rejects(b.inspectDirectory('C:\\Data'),/FS_NATIVE_REFUSED/);assert.equal(reads,0);await b.retire();});
test('polluted inherited then getter never executes during load, query or retirement transport',async()=>{let hooks=0;const original=Object.getOwnPropertyDescriptor(Object.prototype,'then');try{Object.defineProperty(Object.prototype,'then',{configurable:true,get(){hooks++;throw Error('forbidden inherited then');}});const f=fake();const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});const d=await a.inspectDirectory('C:\\Data');assert.equal(Object.getPrototypeOf(d),null);assert.equal(Object.hasOwn(d,'then'),false);assert(Object.isFrozen(d));assert(Object.isFrozen(d.ancestors));assert.equal(Object.getPrototypeOf(d.ancestors[0]),null);const r=await a.retire();assert.equal(Object.getPrototypeOf(r),null);assert.equal(Object.hasOwn(r,'then'),false);assert.equal(hooks,0);}finally{if(original)Object.defineProperty(Object.prototype,'then',original);else delete Object.prototype.then;}});
test('malformed native transport guards/descriptors refuse without getters or raw values',async()=>{
 for(const variant of ['missing','mutable','enumerable','getter','row-getter','extra','proxy']){
  let hooks=0;const f=fake();
  f.native.inspectDirectory=()=>{
   const d={canonicalPath:'C:\\Data',identity:identity('C:\\Data'),directory:true,reparse:false,ancestors:ancestry('C:\\Data')};
   if(variant==='extra')d.extra='private';
   if(variant==='row-getter')Object.defineProperty(d.ancestors[0],'identity',{enumerable:true,get(){hooks++;return identity('C:\\');}});
   if(variant==='proxy')d.ancestors=new Proxy(d.ancestors,{get(){hooks++;throw Error('secret');}});
   if(variant==='getter'){
    // A fulfilled Promise already holds the value; mutation occurs BEFORE the
    // adapter's delivery callback, without executing a getter in the fixture.
    Object.defineProperty(d,'then',{value:undefined,configurable:true});const p=Promise.resolve(d);
    Object.defineProperty(d,'then',{get(){hooks++;return undefined;},configurable:true});return p;
   }
   if(variant!=='missing')Object.defineProperty(d,'then',{value:undefined,writable:variant==='mutable',enumerable:variant==='enumerable'});
   return Promise.resolve(d);
  };
  const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});
  await assert.rejects(a.inspectDirectory('C:\\Data'),/FS_NATIVE_REFUSED/);assert.equal(hooks,0);await a.retire();
 }
});
test('extra adapter retirement args cannot retire a live native inspector',async()=>{const f=fake();const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});await assert.rejects(a.retire('ignored'),/FS_ARGUMENT_REFUSED/);assert.equal(f.retireCount,0);assert.equal(await a.getSystemDirectory(),'C:\\Windows\\System32');await a.retire();});
test('closed native exports and receiver rosters refuse unrelated hooks without invocation',async()=>{for(const variant of ['export-extra','instance-extra']){const f=fake();const addon={createFilesystemInspector:()=>f.native};if(variant==='export-extra')Object.defineProperty(addon,'extra',{get(){throw Error('private');}});else f.native.extra=()=>{throw Error('private');};await assert.rejects(isolated(()=>addon)({assertResourcesCurrent:()=>true}),/FS_NATIVE_REFUSED/);}});
test('actual adapter import/default makes no native load attempt',async()=>{const actual=await import(url);assert.deepEqual(Object.keys(actual),['loadDesktopNativeFilesystemProvider']);await assert.rejects(actual.loadDesktopNativeFilesystemProvider(),/FS_RESOURCE_REFUSED/);await assert.rejects(actual.loadDesktopNativeFilesystemProvider({path:'override'}),/FS_RESOURCE_REFUSED/);});
test('post-load prerequisite failure prevents factory; post-factory failure joins retirement before refusal',async()=>{for(const stage of [2,3]){let checks=0,factories=0,retirements=0,release;const f=fake();f.native.retire=()=>{retirements++;return new Promise(r=>release=r);};const p=isolated(()=>({createFilesystemInspector:()=>{factories++;return f.native;}}))({assertResourcesCurrent:()=>++checks!==stage});let ended=false;p.catch(()=>ended=true);await Promise.resolve();assert.equal(factories,stage===2?0:1);if(stage===3){assert.equal(retirements,1);assert.equal(ended,false);release(retired());}await assert.rejects(p,/FS_RESOURCE_REFUSED/);}});
test('catalogue engine/Modules replacement and Lock while directory held cannot mint a current shell',async()=>{const f=fake();let changed=false,release;f.native.inspectDirectory=async p=>{const d=directory(p);if(changed&&p.endsWith('Modules')){d.identity=identity('replacement');d.ancestors.at(-1).identity=d.identity;}return d;};const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});const config={getSystemDirectory:a.getSystemDirectory,inspectExecutable:a.inspectExecutable,inspectModuleDirectory:a.inspectModuleDirectory,readEnvironment:async()=>({SYSTEMROOT:'C:\\Windows',PATH:'C:\\Windows\\System32'}),authorize:()=>true,captureAdmission:()=>({isCurrent:()=>true}),modulePathPolicy:'system-seeded'};const c=createShellProfileCatalogue(config);await c.resolveShellProfile('powershell');changed=true;await assert.rejects(c.resolveShellProfile('powershell'),/PROFILE_UNAVAILABLE/);c.dispose();const g=fake();g.native.inspectDirectory=()=>new Promise(r=>release=r);const b=await isolated(()=>({createFilesystemInspector:()=>g.native}))({assertResourcesCurrent:()=>true});const d=createShellProfileCatalogue({...config,inspectModuleDirectory:b.inspectModuleDirectory});const pending=d.resolveShellProfile('powershell');for(let i=0;i<30&&!release;i++)await Promise.resolve();assert(release);d.revoke();release(directory('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'));await assert.rejects(pending,/SENDER_REFUSED/);d.dispose();await a.retire();await b.retire();});
test('native source has a read-only fixed surface and isolated worker/cleanup lifetime contract (source evidence only)',async()=>{
 const cc=await readFile(new URL('../native/terminal-filesystem-candidate/filesystem.cc',import.meta.url),'utf8'),gyp=JSON.parse(await readFile(new URL('../native/terminal-filesystem-candidate/binding.gyp',import.meta.url),'utf8'));
 assert.deepEqual(gyp.targets[0].libraries,['kernel32.lib']);assert.deepEqual(gyp.targets[0].sources,['filesystem.cc']);
 assert(!/\b(?:WriteFile|DeleteFile\w*|CreateProcess\w*|ShellExecute\w*|SetFile\w*|AdjustTokenPrivileges|GetEnvironmentVariable\w*|napi_coerce_\w*|napi_get_value_external|napi_call_function|napi_set_named_property|napi_set_element)\s*\(/.test(cc));
 assert.match(cc,/CreateFileW\(extended\.c_str\(\),FILE_READ_ATTRIBUTES,FILE_SHARE_READ\|FILE_SHARE_WRITE\|FILE_SHARE_DELETE,nullptr,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT\|FILE_FLAG_BACKUP_SEMANTICS,nullptr\)/);
 const execute=cc.slice(cc.indexOf('void Execute('),cc.indexOf('void Complete('));assert(!/\bnapi_\w+\s*\(/.test(execute));
 assert.match(cc,/napi_check_object_type_tag/);assert.match(cc,/FileIdInfo/);assert.match(cc,/GetSystemDirectoryW/);assert.match(cc,/kPending = 8, kAncestors = 128, kHandles = 129/);
 assert.match(cc,/names\.size\(\)>=kHandles/);assert.match(cc,/shared_ptr<Environment>/);assert.match(cc,/shared_ptr<Inspector>/);assert.match(cc,/napi_add_async_cleanup_hook/);
 const cleanup=cc.slice(cc.indexOf('void Cleanup('),cc.indexOf('napi_value Factory('));assert.match(cleanup,/napi_cancel_async_work/);assert(!/delete\s+w|work\.clear|pending\s*=\s*0/.test(cleanup));
 assert.match(cc,/if\(!delivered\|\|w->handlesUnknown\)s->deliveryUnknown=true/);assert.match(cc,/if\(s->deliveryUnknown\)return Throw\(env,"FS_INTERNAL"\)/);
 assert.match(cc,/"then",nullptr,nullptr,nullptr,nullptr,undefined,napi_default/);
});
test('partial factory resource failure cannot conceal unknown inspector retirement',async()=>{let checks=0;const f=fake();f.native.retire=()=>Promise.resolve(guarded({retired:true,actualSettled:false,pending:1}));await assert.rejects(isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>++checks!==3}),/FS_RETIREMENT_UNKNOWN/);});
test('malformed canonical system paths refuse at adapter before DATA publication',async()=>{for(const path of ['abc','C:relative','\\\\server\\share','C:/Windows/System32','C:\\Windows\\..\\System32','C:\\Windows\\System32\\','C:\\Windows\\NUL','C:\\Windows\\name.','C:\\PROGRA~1']){const f=fake();f.native.getSystemDirectory=()=>Promise.resolve(path);const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});await assert.rejects(a.getSystemDirectory(),/FS_NATIVE_REFUSED/);await a.retire();}});
test('wrong Promise constructor/species descriptor shapes refuse before inherited descriptor getters (isolated realm)',async()=>{
 const body=source.replace(/^import .*;\r?\n/gm,'').replaceAll('export ','').replaceAll('import.meta.url',JSON.stringify(url.href));
 for(const key of ['constructor','species']){
  const result=await vm.runInNewContext(`(async()=>{
   const types=utility,createRequire=()=>()=>({createFilesystemInspector:()=>native}),fileURLToPath=()=> 'fixed-candidate',URL=Url;
   ${body}
   const native={getSystemDirectory(){return pending;},inspectDirectory(){},inspectFile(){},retire(){}};
   const a=await loadDesktopNativeFilesystemProvider({assertResourcesCurrent:()=>true});
   const pending=Promise.resolve('C:\\\\Windows\\\\System32');let hooks=0;
   const target=${JSON.stringify(key)}==='constructor'?Promise.prototype:Promise;
   const property=${JSON.stringify(key)}==='constructor'?'constructor':Symbol.species;
   const original=Object.getOwnPropertyDescriptor(target,property);
   const bad=Object.create(null);bad.configurable=true;
   if(${JSON.stringify(key)}==='constructor')bad.get=()=>{hooks++;return Promise;};else {bad.value=Promise;bad.writable=true;}
   const poison=Object.create(null);poison.configurable=true;poison.get=()=>{hooks++;return Promise;};
   Object.defineProperty(target,property,bad);
   Object.defineProperty(Object.prototype,${JSON.stringify(key)}==='constructor'?'value':'get',poison);
   let p;try{p=a.getSystemDirectory();}finally{delete Object.prototype[${JSON.stringify(key)}==='constructor'?'value':'get'];Object.defineProperty(target,property,original);}
   let code='accepted';try{await p;}catch(e){code=e.message;}return JSON.stringify({code,hooks});
  })()`,{utility:types,Url:URL});
  assert.deepEqual(JSON.parse(result),{code:'FS_NATIVE_REFUSED',hooks:0});
 }
});
test('hostile native rejection records never execute descriptor getters or coercion',async()=>{for(const kind of ['accessor','foreign','proxy']){let hooks=0;let error;if(kind==='accessor')error=Object.defineProperty({},'code',{get(){hooks++;return 'FS_CHANGED';}});else if(kind==='foreign')error={code:{toString(){hooks++;return 'FS_CHANGED';}}};else {const rev=Proxy.revocable({},{});rev.revoke();error=rev.proxy;}const f=fake();f.native.inspectFile=()=>Promise.reject(error);const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});await assert.rejects(a.inspectExecutable('C:\\test.exe'),e=>e.message==='FS_NATIVE_REFUSED');assert.equal(hooks,0);await a.retire();}});
test('actual Node async_hooks reentry shares one adapter retirement and one native invocation (no addon)',async()=>{const f=fake();const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});let enabled=true,second;const hook=createHook({init(_id,type){if(enabled&&type==='PROMISE'){enabled=false;second=a.retire();}}});let p;try{hook.enable();p=a.retire();}finally{hook.disable();}assert.equal(second,p);await p;assert.equal(f.retireCount,1);});
test('synchronous native refusals retain only recognised own DATA codes',async()=>{
 const codes=['FS_ARGUMENT_REFUSED','FS_CAPACITY','FS_RETIRED','FS_OPEN_FAILED','FS_REPARSE_REFUSED','FS_TYPE_REFUSED','FS_CANONICAL_REFUSED','FS_IDENTITY_FAILED','FS_CHANGED','FS_SYSTEM_DIRECTORY_FAILED','FS_INTERNAL'];
 for(const [nativeName,publicName,args] of [['getSystemDirectory','getSystemDirectory',[]],['inspectDirectory','inspectDirectory',['C:\\Data']],['inspectFile','inspectExecutable',['C:\\test.exe']],['inspectDirectory','inspectModuleDirectory',['C:\\Data']]])for(const code of codes){
  const f=fake();f.native[nativeName]=()=>{throw Object.assign(Error('not exposed native details'),{code});};
  const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});
  await assert.rejects(a[publicName](...args),error=>error.message===code);assert.equal(a.nativeExecutionAdmitted,false);await a.retire();
 }
});
test('synchronous hostile native errors and malformed return transport remain generic without hooks',async()=>{
 let hooks=0;const revoked=Proxy.revocable({},{});revoked.revoke();
 const accessor=Object.defineProperty({},'code',{get(){hooks++;return 'FS_CAPACITY';}});
 const inherited=Object.create({code:'FS_CAPACITY'}),foreign={code:{toString(){hooks++;return 'FS_CAPACITY';}}};
 for(const thrown of [revoked.proxy,accessor,inherited,foreign,{code:'SECRET_NATIVE_DETAIL'},'FS_CAPACITY',null]){
  const f=fake();f.native.inspectFile=()=>{throw thrown;};const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});
  await assert.rejects(a.inspectExecutable('C:\\test.exe'),error=>error.message==='FS_NATIVE_REFUSED');await a.retire();
 }
 for(const returned of [{code:'FS_CAPACITY'},Object.defineProperty({},'then',{get(){hooks++;return ()=>{};}})]){
  const f=fake();f.native.inspectDirectory=()=>returned;const a=await isolated(()=>({createFilesystemInspector:()=>f.native}))({assertResourcesCurrent:()=>true});
  await assert.rejects(a.inspectDirectory('C:\\Data'),error=>error.message==='FS_NATIVE_REFUSED');await a.retire();
 }
 assert.equal(hooks,0);
});
