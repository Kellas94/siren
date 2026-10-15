// Supplied JSON comparison only; neither fixture is a native witness.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as crypto from 'node:crypto';
import * as util from 'node:util';
import * as path from 'node:path';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const api=await import('./terminal-connect-comparison.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const compare=(...args)=>{assert.equal(typeof api.compareFreshConnectJson,'function','Missing fixed connect comparison');return api.compareFreshConnectJson(...args);};
const sha=value=>createHash('sha256').update(value).digest('hex');
function expected(){return {schema:1,creatorPid:42,shellPid:84,commandLine:'"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoLogo -NoProfile',cwd:'C:\\project Ș',env:['SystemRoot=C:\\Windows','PATH=C:\\Windows\\System32;C:\\Windows','TEMP=C:\\Temp','TMP=C:\\Temp'],useConptyDll:false};}
function snapshot(e){
 const env=e.env.map(pair=>{const i=pair.indexOf('=');return {key:pair.slice(0,i),bytes:Buffer.byteLength(pair.slice(i+1)),sha256:sha(pair.slice(i+1))};});
 const count=Buffer.alloc(4);count.writeUInt32BE(env.length);const chunks=[Buffer.from('SIREN_FRESH_ENV_V1\0'),count];
 for(const row of env){const key=Buffer.from(row.key),length=Buffer.alloc(4),size=Buffer.alloc(8);length.writeUInt32BE(key.length);size.writeBigUInt64BE(BigInt(row.bytes));chunks.push(length,key,size,Buffer.from(row.sha256,'hex'));}
 return {env,envSha256:sha(Buffer.concat(chunks)),totalBytes:e.env.reduce((n,pair)=>n+Buffer.byteLength(pair)+1,0),blockCodeUnits:e.env.reduce((n,pair)=>n+pair.length+1,1),commandLineBytes:Buffer.byteLength(e.commandLine),commandLineSha256:sha(e.commandLine),cwdBytes:Buffer.byteLength(e.cwd),cwdSha256:sha(e.cwd),useConptyDll:e.useConptyDll};
}
function observation(e=expected()){return {schema:1,boundary:'JS_NATIVE_CONNECT_ARGUMENTS',argumentCount:6,creatorPid:e.creatorPid,clock:'PROCESS_MONOTONIC',count:1,duplicate:false,phase:'RETURNED',before:snapshot(e),after:snapshot(e),beforeConnectMs:1,afterConnectMs:2,returnStatus:'RETURNED',pidAssignment:'ASSIGNED',returnedPid:e.shellPid,argumentsUnchanged:true,captureCodes:[]};}
function call(raw=observation(),e=expected()){return compare(JSON.stringify(raw),JSON.stringify(e));}
test('matching canonical declarations are consistent DATA, never native or input permission',()=>{const r=call();assert.equal(r.ok,true);assert.equal(r.semanticMatch,true);assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);assert.ok(Object.isFrozen(r));assert.equal(JSON.stringify(r).includes('C:\\Temp'),false);});
test('changed command, cwd, ordered environment value or key refuses comparison',()=>{for(const mutate of [e=>e.commandLine+=' ',e=>e.cwd+='2',e=>e.env[1]+=';X',e=>e.env.reverse(),e=>e.env.push('USERNAME=user')]){const e=expected();mutate(e);assert.equal(call(observation(),e).ok,false);}});
test('before or after snapshot drift and lying aggregate hashes refuse',()=>{for(const mutate of [s=>s.env[0].sha256='a'.repeat(64),s=>s.env[0].bytes++,s=>s.envSha256='b'.repeat(64),s=>s.totalBytes++,s=>s.blockCodeUnits++,s=>s.commandLineBytes++,s=>s.cwdBytes++,s=>s.cwdSha256='c'.repeat(64),s=>s.useConptyDll=true])for(const side of ['before','after']){const raw=observation();mutate(raw[side]);assert.equal(call(raw).ok,false);}});
test('partial, initfailed, duplicate, changed, thrown and missing-PID records stay adverse',()=>{for(const mutate of [r=>r.count=0,r=>r.count=2,r=>r.duplicate=true,r=>r.phase='UNSEEN',r=>r.before=null,r=>r.after=null,r=>r.returnStatus='THREW',r=>r.pidAssignment='FAILED',r=>r.returnedPid=null,r=>r.argumentsUnchanged=false,r=>r.captureCodes=['OBSERVER_ERROR']]){const raw=observation();mutate(raw);const r=call(raw);assert.equal(r.ok,false);assert.equal(r.inputAuthorized,false);}});
test('creator/shell mismatches, reused IDs and backwards or absent clocks refuse',()=>{for(const mutate of [r=>r.creatorPid=43,r=>r.returnedPid=85,r=>r.beforeConnectMs=null,r=>r.afterConnectMs=null,r=>r.afterConnectMs=0,r=>r.clock=null]){const r=observation();mutate(r);assert.equal(call(r).ok,false);}const e={...expected(),shellPid:42};assert.equal(call(observation(e),e).ok,false);});
test('only primitive canonical JSON arguments, exact fields and no extras accepted',()=>{let hooks=0;const object={toString(){hooks++;throw 0;}};for(const args of [[object,JSON.stringify(expected())],[JSON.stringify(observation()),object],[JSON.stringify(observation()),JSON.stringify(expected()),false]])assert.equal(compare(...args).ok,false);assert.equal(hooks,0);for(const text of ['{',JSON.stringify(expected())+'\n',JSON.stringify({...expected(),extra:1}),JSON.stringify(expected()).replace('"schema":1','"schema":1,"schema":1')])assert.equal(compare(JSON.stringify(observation()),text).ok,false);});
test('unknown, case alias, duplicate, empty or excessive environment vectors refuse',()=>{for(const env of [[],['path=x'],['PRIVATE=x'],['PATH=x','PATH=y'],Array(21).fill('PATH=x'),['PATH=x\0y'],['PATHEXT='],['PATHEXT='+'x'.repeat(1025)],['PATH='+'x'.repeat(32768)]])assert.equal(call(observation(),{...expected(),env}).ok,false);});
test('exact Unicode and equals-value bytes match, including trusted PATHEXT addition',()=>{const e=expected();e.env.push('USERNAME=Ștefan=Δ','PATHEXT=.COM;.EXE;.BAT;.CMD');assert.equal(call(observation(e),e).ok,true);const omitted=expected();omitted.env.push('USERNAME=Ștefan=Δ');assert.equal(call(observation(e),omitted).ok,false);});
test('oversized or malformed expected strings refuse before any native interpretation',()=>{for(const text of ['x'.repeat(1048577),'é'.repeat(524289),'\ud800'])assert.equal(compare(JSON.stringify(observation()),text).ok,false);for(const commandLine of ['', 'x\0y','\ud800','x'.repeat(32768)])assert.equal(call(observation(),{...expected(),commandLine}).ok,false);});
test('raw refusal and deeply nested invalid expected JSON never become semantic match',()=>{assert.equal(compare('x'.repeat(32769),JSON.stringify(expected())).code,'RAW_JSON_REFUSED');assert.equal(compare(JSON.stringify(observation()),'{"schema":'+'['.repeat(10000)+'0'+']'.repeat(10000)+'}').code,'EXPECTATION_REFUSED');});
test('Windows block bound is exact independently of non-native declaration validity',()=>{const e={...expected(),env:['TEMP='+'x'.repeat(32760)]};assert.equal(snapshot(e).blockCodeUnits,32767);assert.equal(call(observation(e),e).ok,true);e.env[0]+='x';assert.equal(call(observation(e),e).ok,false);});
test('actual isolated parent capture and observer feed both arm comparisons without native execution',async()=>{
 const context=vm.createContext({Buffer,process:{platform:'win32',env:{TEMP:'C:\\Temp',TMP:'C:\\Temp',USERNAME:'Ștefan=Δ',PATHEXT:'.COM;.EXE;.BAT;.CMD'}}});
 const own=new vm.SourceTextModule(readFileSync(new URL('./terminal-fresh-environment.mjs',import.meta.url),'utf8'),{context});
 const model=new vm.SourceTextModule(readFileSync(new URL('./terminal-fresh-pair-model.mjs',import.meta.url),'utf8'),{context});const imports=new Map();
 await own.link(async name=>{if(name==='./terminal-fresh-pair-model.mjs')return model;const data={'node:crypto':crypto,'node:util':util,'node:path':path}[name];assert.ok(data);if(!imports.has(name))imports.set(name,new vm.SyntheticModule(Object.keys(data),function(){for(const key of Object.keys(data))this.setExport(key,data[key]);},{context}));return imports.get(name);});await own.evaluate();
 const capture=own.namespace.captureFreshPairLaunchEnvironment('C:\\Windows\\System32');assert.equal(capture.ok,true);
 const {generateTerminalConnectDerivative}=await import('./terminal-connect-derivative.mjs');const original=readFileSync(new URL('../../../terminal-connect-derivative-20261011/original-data/windowsPtyAgent.js.source.txt',import.meta.url),'utf8');const generated=generateTerminalConnectDerivative(original);assert.equal(generated.ok,true);
 for(const arm of [capture.omitted,capture.trusted]){
  let clock=0;const sandbox=vm.createContext({Buffer,exports:{},require(name){if(name==='node:crypto')return crypto;if(name==='node:util')return util;if(name==='node:perf_hooks')return {performance:{now:()=>++clock}};if(name==='node:process')return {pid:42};assert.fail('Unexpected observer import');}});
  const e={...expected(),env:JSON.parse(JSON.stringify(arm.vector))};sandbox.declaration=vm.runInContext('('+JSON.stringify(e)+')',sandbox);
  vm.runInContext(generated.observerSource+'\nvar receiver={_useConptyDll:false,_innerPid:84};var ticket=__sirenConnectObserver.begin(declaration.env,declaration.commandLine,declaration.cwd,receiver);__sirenConnectObserver.finish(ticket,declaration.env,declaration.commandLine,declaration.cwd,receiver,true,true);',sandbox,{timeout:500});
  const raw=sandbox.exports.readConnectObservation();assert.equal(compare(JSON.stringify(raw),JSON.stringify(e)).ok,true);assert.equal(compare(JSON.stringify(raw),JSON.stringify({...e,cwd:e.cwd+'x'})).ok,false);
 }
});
