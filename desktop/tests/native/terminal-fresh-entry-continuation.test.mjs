// Maintained owner adaptation: stable historical negative fixture; original evidence unchanged.
// SOURCE_ONLY conditional orchestration: literal context and CLI fragments only.
// No full provisioner/provider execution, real filesystem writes, or native witnesses.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {types} from 'node:util';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('./terminal-fresh-runtime-provision.mjs',import.meta.url),'utf8');
const entry='C:\\repo\\desktop\\tests\\native\\terminal-fresh-runtime-provision.mjs';
const root='C:\\repo';
function hosted(mode='build'){
 return {platform:'win32',arch:'x64',versions:{node:'24.16.0'},argv:['node',entry,...(mode==='build'?[]:['--fixed-pathext-pair'])],env:{GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'Kellas94/siren',GITHUB_REF:'refs/heads/probe/terminal-session-20261010',GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'a'.repeat(40),RUNNER_TEMP:'C:\\temp'}};
}
function captured(process){
 const start=source.indexOf('function context(extra){'),end=source.indexOf('\nasync function regular(',start);
 assert.ok(start>0&&end>start,'literal context anchors required');
 const ctx=vm.createContext({process,path:path.win32,URL,check(value,code){if(!value)throw Error(code);},canonical(value){assert.equal(typeof value,'string');return value;},fileURLToPath:value=>String(value).includes('terminal-fresh-runtime-provision.mjs')?entry:root});
 const fragment=source.slice(start,end).replaceAll('import.meta.url',JSON.stringify('file:///C:/repo/desktop/tests/native/terminal-fresh-runtime-provision.mjs'));
 new vm.Script(fragment).runInContext(ctx,{timeout:500});
 return vm.runInContext('context([])',ctx,{timeout:500});
}
async function cli({mode='build',ok=true,pairOk=true,adverse=false,mutate=false,main=true,throwAt=null,statusOverride=null}={}){
 const start=source.indexOf('if(import.meta.main===true)');assert.ok(start>0,'literal CLI anchor required');
 const pairImport="import {runFreshTerminalPair} from './terminal-fresh-pair-driver.mjs';";
 assert.equal(source.split(/\r?\n/).filter(line=>line===pairImport).length,1,'exact fixed static driver binding required');
 const calls=[],links=[],process=hosted(mode),receipt=Object.freeze({ok,status:ok?'FRESH_RUNTIME_BUILT_RETAINED_NOT_SESSION_ADMISSION':'FAILED_NOT_SESSION_ADMISSION',jobRoot:'C:\\temp\\job'});
 // The stub is an explicit conditional seam, not a genuine provision receipt authority.
 const context=vm.createContext({types,Buffer,process,console:{log:value=>calls.push(['log',value])},flags:{nativeAdmission:false,inputAuthorized:false},async provisionFreshTerminalRuntime(){calls.push(['build']);context.entryMode=mode==='build'?'build':'fixed-pathext-pair';if(mutate)process.argv=mode==='build'?['node',entry,'--fixed-pathext-pair']:['node',entry];return receipt;}});
 context.entryMode=null;
 // Link only the literal static declaration to one strict synthetic export.
 // Actual driver/dependencies are never imported. Static link failures precede
 // the CLI try/catch; they are not bounded dynamic-import continuation results.
 const module=new vm.SourceTextModule(pairImport+'\n'+source.slice(start),{context,initializeImportMeta(meta){meta.main=main;},importModuleDynamically(){throw Error('unexpected dynamic CLI import');}});
 await module.link(specifier=>{
  links.push(specifier);assert.equal(specifier,'./terminal-fresh-pair-driver.mjs','only fixed same-root driver binding');
  if(throwAt==='link')throw Error('private test static link error');
  return new vm.SyntheticModule(throwAt==='missing-export'?[]:['runFreshTerminalPair'],function(){
   if(throwAt==='missing-export')return;
   this.setExport('runFreshTerminalPair',async received=>{assert.equal(received,receipt,'exact original receipt identity');calls.push(['pair']);if(throwAt==='pair')throw Error('private test pair error');return Object.freeze({ok:pairOk,status:statusOverride??(adverse?'FRESH_PAIR_COMPLETE_WITH_ADVERSE_ARM_NOT_ADMITTED':'FRESH_PAIR_OBSERVED_NOT_ADMITTED'),...(adverse?{hasAdverseArm:true}:{}),nativeAdmission:false});});
  },{context});
 });
 await module.evaluate({timeout:500});return {calls,links,process,receipt};
}
test('actual context captures default build mode',()=>assert.equal(captured(hosted()).mode,'build'));
test('actual context admits only exact fixed opt-in mode',()=>assert.equal(captured(hosted('pair')).mode,'fixed-pathext-pair'));
test('actual context rejects foreign entry unknown flag and extra arguments',()=>{for(const modify of [p=>p.argv[1]='C:\\other.mjs',p=>p.argv.push('--other'),p=>p.argv.push('--fixed-pathext-pair','extra'),p=>p.argv.push('--FIXED-PATHEXT-PAIR')]){const p=hosted();modify(p);assert.throws(()=>captured(p),/CONTEXT_REFUSED/);}});
test('actual provision fragment captures validated private mode before first awaited work',async()=>{
 const start=source.indexOf('export async function provisionFreshTerminalRuntime('),end=source.indexOf('\nexport async function recheckProvisionedFreshRuntime(',start);assert.ok(start>0&&end>start);
 for(const mode of ['build','fixed-pathext-pair']){
  let release,manifestMode;const pending=new Promise((_,reject)=>{release=()=>reject(Error('conditional stop before actual I/O'));});
  const ctx=vm.createContext({context:()=>({mode}),manifest:(_root,selected)=>{manifestMode=selected;return pending;},freeze:v=>v,flags:{nativeAdmission:false},failures:new WeakMap()});
  new vm.Script('let attempted=false,entryMode=null;\n'+source.slice(start,end).replace(/^export /,'')).runInContext(ctx,{timeout:500});
  const operation=vm.runInContext('provisionFreshTerminalRuntime()',ctx,{timeout:500});
  try{assert.equal(vm.runInContext('entryMode',ctx,{timeout:500}),mode);assert.equal(manifestMode,mode,'actual provision forwards captured mode before build');}finally{release();await operation;}
 }
});
test('conditional default CLI remains build-only',async()=>{const f=await cli();assert.deepEqual(f.calls.map(x=>x[0]),['build','log']);assert.deepEqual(f.links,['./terminal-fresh-pair-driver.mjs']);assert.notEqual(f.process.exitCode,1);});
test('conditional imported entry is inert',async()=>{const f=await cli({main:false});assert.deepEqual(f.calls,[]);assert.deepEqual(f.links,['./terminal-fresh-pair-driver.mjs']);});
test('conditional opt-in CLI calls statically bound same-instance driver with exact receipt once',async()=>{const f=await cli({mode:'pair'});assert.deepEqual(f.links,['./terminal-fresh-pair-driver.mjs']);assert.equal(f.calls.filter(x=>x[0]==='pair').length,1);assert.notEqual(f.process.exitCode,1,'actual successful driver omits optional adverse flag');});
test('conditional failed build never calls driver and exits adverse',async()=>{const f=await cli({mode:'pair',ok:false});assert.deepEqual(f.links,['./terminal-fresh-pair-driver.mjs']);assert.equal(f.calls.some(x=>x[0]==='pair'),false);assert.equal(f.process.exitCode,1);});
test('conditional failed pair has nonzero exit without retry',async()=>{const f=await cli({mode:'pair',pairOk:false});assert.equal(f.process.exitCode,1);assert.equal(f.calls.filter(x=>x[0]==='pair').length,1);});
test('conditional adverse completed pair stays nonzero',async()=>{const f=await cli({mode:'pair',pairOk:true,adverse:true});assert.equal(f.process.exitCode,1);assert.equal(f.calls.filter(x=>x[0]==='pair').length,1);});
test('conditional captured opt-in survives later argv removal',async()=>assert.equal((await cli({mode:'pair',mutate:true})).calls.filter(x=>x[0]==='pair').length,1));
test('conditional default cannot be enabled by later argv insertion',async()=>assert.equal((await cli({mutate:true})).calls.filter(x=>x[0]==='pair').length,0));
test('conditional pair errors exit nonzero without raw exception text or retry',async()=>{const f=await cli({mode:'pair',throwAt:'pair'});assert.equal(f.process.exitCode,1);assert.deepEqual(f.links,['./terminal-fresh-pair-driver.mjs']);assert.equal(f.calls.filter(x=>x[0]==='pair').length,1);assert.equal(JSON.stringify(f.calls).includes('private test'),false);});
test('conditional static link refusal rejects before the CLI continuation catch',async()=>assert.rejects(cli({mode:'pair',throwAt:'link'}),/private test static link error/));
test('actual VM linking refuses a missing named driver export before CLI evaluation',async()=>assert.rejects(cli({throwAt:'missing-export'}),/does not provide an export named 'runFreshTerminalPair'/));
test('conditional unknown successful pair status remains adverse',async()=>assert.equal((await cli({mode:'pair',statusOverride:'UNKNOWN'})).process.exitCode,1));

const pairNames=['terminal-fresh-runtime-provision','terminal-fresh-runtime-inventory','terminal-fresh-runtime-retention','terminal-connect-derivative','terminal-creator-transport-derivative','terminal-connect-raw-json','terminal-connect-raw-file','terminal-fresh-environment','terminal-fresh-pair-model','terminal-connect-comparison','terminal-fresh-pair-driver','terminal-fresh-pair-worker','terminal-resolution-observation','terminal-discovery-fixture','terminal-cmdlet-fixture','terminal-session-command','terminal-fresh-parent-permit'].map(n=>'desktop/tests/native/'+n+'.mjs');
async function sourceManifest({pair=false,omit=null,omitDiagnostic=null,mode='fixed-pathext-pair'}={}){
 const original=JSON.parse(readFileSync(new URL('../../../terminal-fresh-entry-continuation-20261011/before/02-terminal-fresh-runtime-provision-inputs.json.txt',import.meta.url),'utf8'));
 const rows=new Map(original.inputs.map(r=>[r.path,r]));if(pair)for(const name of pairNames)if(!rows.has(name)){const b=readFileSync(new URL('../../../'+name,import.meta.url));rows.set(name,{path:name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')});}
 const m={...original,inputs:[...rows.values()].filter(r=>r.path!==omit),diagnostics:(pair?pairNames:original.diagnostics).filter(n=>n!==omit&&n!==omitDiagnostic)},text=JSON.stringify(m)+'\n',manifestPath=path.win32.join(root,'desktop/tests/native/terminal-fresh-runtime-provision-inputs.json');
 const start=source.indexOf('async function manifest(root'),end=source.indexOf('\nfunction buildEnvironment(',start);assert.ok(start>0&&end>start);
 const constants=source.split(/\r?\n/).filter(s=>s.startsWith('const SCOPE=')||s.startsWith('const REQUIRED=')||s.startsWith('const FIXED=')||s.startsWith('const PAIR_DIAGNOSTICS='));
 const ctx=vm.createContext({path:path.win32,check(v){if(!v)throw Error('SOURCE_REFUSED');},relative:s=>typeof s==='string'&&!s.includes('..'),async readFile(p){assert.equal(p,manifestPath);return text;},async pin(p){if(p===manifestPath)return{path:p,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')};const name=path.win32.relative(root,p).replaceAll('\\','/');const row=m.inputs.find(r=>r.path===name);assert.ok(row);return{...row,path:p};}});
 new vm.Script(constants.join('\n')+'\n'+source.slice(start,end)).runInContext(ctx,{timeout:500});ctx.root=root;ctx.mode=mode;return vm.runInContext('manifest(root,mode)',ctx,{timeout:500});
}
test('literal manifest accepts the frozen build-only fixture in default mode',async()=>assert.ok(await sourceManifest({mode:'build'})));
test('literal opt-in manifest refuses the frozen incomplete 20-input fixture before build',async()=>assert.rejects(sourceManifest(),/SOURCE_REFUSED/));
test('actual opt-in manifest accepts complete fixed 17-file source closure',async()=>assert.ok(await sourceManifest({pair:true})));
test('actual opt-in manifest refuses each of all17 missing diagnostic inputs',async()=>{const accepted=[];for(const omit of pairNames){try{await sourceManifest({pair:true,omit});accepted.push(omit);}catch(e){assert.match(e.message,/SOURCE_REFUSED/);}}assert.deepEqual(accepted,[]);});
test('actual opt-in manifest refuses each of all17 unstaged pinned modules',async()=>{for(const omitDiagnostic of pairNames)await assert.rejects(sourceManifest({pair:true,omitDiagnostic}),/SOURCE_REFUSED/);});

test('current 27-input manifest pins every current retained diagnostic source exactly',()=>{
 const m=JSON.parse(readFileSync(new URL('./terminal-fresh-runtime-provision-inputs.json',import.meta.url),'utf8'));
 assert.equal(m.inputs.length,27);assert.equal(m.diagnostics.length,17);
 assert.deepEqual(new Set(m.diagnostics),new Set(pairNames));
 for(const row of m.inputs){
  const b=readFileSync(new URL('../../../'+row.path,import.meta.url));
  assert.equal(b.length,row.bytes,row.path);
  assert.equal(createHash('sha256').update(b).digest('hex'),row.sha256,row.path);
 }
});
