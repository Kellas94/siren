// Bounded supplied JSON DATA only; no native/creator/provider or file writer.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {types} from 'node:util';
import {win32 as windowsPath} from 'node:path';
const api=await import('./terminal-connect-raw-json.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const decode=(...args)=>{assert.equal(typeof api.decodeTerminalConnectRawJson,'function','Missing bounded raw JSON decoder');return api.decodeTerminalConnectRawJson(...args);};
function raw(){return {schema:1,boundary:'JS_NATIVE_CONNECT_ARGUMENTS',argumentCount:6,creatorPid:42,clock:'PROCESS_MONOTONIC',count:0,duplicate:false,phase:'UNSEEN',before:null,after:null,beforeConnectMs:null,afterConnectMs:null,returnStatus:'NOT_CALLED',pidAssignment:'NOT_ATTEMPTED',returnedPid:null,argumentsUnchanged:null,captureCodes:[]};}
function snapshot(){return {env:[{key:'PATH',bytes:3,sha256:'a'.repeat(64)}],envSha256:'b'.repeat(64),totalBytes:9,blockCodeUnits:10,commandLineBytes:5,commandLineSha256:'c'.repeat(64),cwdBytes:4,cwdSha256:'d'.repeat(64),useConptyDll:false};}
test('canonical raw DATA is frozen and never grants native admission or input',()=>{const r=decode(JSON.stringify(raw()));assert.equal(r.ok,true);assert.deepEqual(r.observation,raw());assert.equal(r.nativeAdmission,false);assert.equal(r.inputAuthorized,false);assert.equal(r.evidenceClass,'SUPPLIED_CANONICAL_RAW_JSON_DATA');assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.observation)&&Object.isFrozen(r.observation.captureCodes));});
test('invalid primitive and extra arguments refuse without coercion hooks',()=>{let hooks=0;for(const x of [null,42,Buffer.from('{}'),{toString(){hooks++;return '{}';}},new Proxy({},{get(){hooks++;throw 0;}})])assert.equal(decode(x).ok,false);assert.equal(decode(JSON.stringify(raw()),1).ok,false);assert.equal(hooks,0);});
test('code-unit and UTF8 byte limits refuse before parsing supplied JSON',()=>{for(const s of [' '.repeat(32769),'é'.repeat(20000),'\ud800','{"x":'+ '['.repeat(33000)])assert.equal(decode(s).ok,false);});
test('malformed duplicate whitespace and noncanonical numeric JSON refuse',()=>{const s=JSON.stringify(raw());for(const x of ['{',s+'\n',' '+s,s.replace('"schema":1','"schema":1,"schema":1'),s.replace('"creatorPid":42','"creatorPid":4.2e1'),s.replace('"count":0','"count":-0')])assert.equal(decode(x).ok,false);});
test('unknown missing and reordered fields refuse',()=>{const r=raw();for(const x of [{...r,rawEnvironment:'SECRET'},Object.fromEntries(Object.entries(r).slice(1)),Object.fromEntries(Object.entries(r).reverse()),[]])assert.equal(decode(JSON.stringify(x)).ok,false);});
test('bounded snapshot shape freezes rows without authenticating their asserted hashes',()=>{const r={...raw(),count:1,phase:'RETURNED',before:snapshot(),after:snapshot(),beforeConnectMs:1,afterConnectMs:2,returnStatus:'RETURNED',pidAssignment:'ASSIGNED',returnedPid:84,argumentsUnchanged:true};const d=decode(JSON.stringify(r));assert.equal(d.ok,true);assert.equal(d.nativeAdmission,false);assert.equal(d.inputAuthorized,false);assert.ok(Object.isFrozen(d.observation.before.env[0]));assert.deepEqual(d.observation,r);});
test('unknown duplicate environment keys invalid digests and row caps refuse',()=>{for(const mutate of [s=>s.env.push({...s.env[0]}),s=>s.env[0].key='SECRET',s=>s.env[0].sha256='x'.repeat(64),s=>s.env[0].bytes=32769,s=>s.env[0].rawValue='PRIVATE',s=>s.env=[{key:'PATHEXT',bytes:0,sha256:'a'.repeat(64)}],s=>s.envSha256='A'.repeat(64),s=>s.blockCodeUnits=32768,s=>s.commandLineBytes=0]){const r=raw();r.before=snapshot();mutate(r.before);assert.equal(decode(JSON.stringify(r)).ok,false);}});
test('known adverse init and duplicate records survive as adverse DATA',()=>{for(const r of [{...raw(),argumentCount:null,creatorPid:null,clock:null,phase:'OBSERVER_INITIALIZATION_FAILED',returnStatus:'NOT_OBSERVED',pidAssignment:'NOT_OBSERVED',captureCodes:['OBSERVER_INIT_FAILED']},{...raw(),count:2,duplicate:true,phase:'NATIVE_THROW',returnStatus:'THREW',captureCodes:['DUPLICATE_CONNECT']}]){const d=decode(JSON.stringify(r));assert.equal(d.ok,true);assert.deepEqual(d.observation,r);assert.equal(d.inputAuthorized,false);}});
test('unknown repeated or excessive capture codes refuse without reflecting secret values',()=>{for(const codes of [['PRIVATE'],['OBSERVER_ERROR','OBSERVER_ERROR'],['OBSERVER_ERROR','PID_REFUSED','KEY_REFUSED','CLOCK_REFUSED']]){const d=decode(JSON.stringify({...raw(),captureCodes:codes}));assert.equal(d.ok,false);assert.equal(JSON.stringify(d).includes('PRIVATE'),false);}});
test('invalid scalar types ranges and open enum values refuse',()=>{for(const [key,value] of [['schema',2],['argumentCount',7],['creatorPid',0],['count',3],['duplicate',1],['phase','SECRET'],['clock','WALL_CLOCK'],['beforeConnectMs',-1],['returnStatus','SUCCESS'],['pidAssignment','YES'],['returnedPid',4294967296],['argumentsUnchanged','true']])assert.equal(decode(JSON.stringify({...raw(),[key]:value})).ok,false);});
test('JSON string keys cannot become prototype or serialization authority',()=>{for(const field of ['__proto__','constructor','toJSON']){const s=JSON.stringify(raw()).replace('{','{"'+field+'":{"polluted":true},');assert.equal(decode(s).ok,false);}assert.equal({}.polluted,undefined);});
test('syntactically inconsistent clocks or mismatched asserted PIDs remain DATA not permission',()=>{const r={...raw(),count:1,phase:'RETURNED',beforeConnectMs:5,afterConnectMs:2,creatorPid:999,returnedPid:999,argumentsUnchanged:false};const d=decode(JSON.stringify(r));assert.equal(d.ok,true);assert.deepEqual(d.observation,r);assert.equal(d.inputAuthorized,false);});
test('code-unit cap precedes UTF8 scan and byte cap precedes JSON allocation',()=>{
 const source=readFileSync(new URL('./terminal-connect-raw-json.mjs',import.meta.url),'utf8').replace('export function decodeTerminalConnectRawJson','function decodeTerminalConnectRawJson');
 for(const [input,scans] of [['x'.repeat(32769),0],['é'.repeat(20000),1]]){
  let scanned=0,parsed=0;
  const context=vm.createContext({input,Buffer:{byteLength(s,encoding){scanned++;return Buffer.byteLength(s,encoding);}},JSON:{parse(s){parsed++;return JSON.parse(s);},stringify:JSON.stringify}});
  const r=vm.runInContext(source+'\ndecodeTerminalConnectRawJson(input);',context,{timeout:500});
  assert.equal(r.ok,false);assert.equal(scanned,scans);assert.equal(parsed,0);
 }
});
test('deep but byte-bounded invalid JSON shape refuses without recursive serialization',()=>{assert.equal(decode('{"schema":'+'['.repeat(10000)+'0'+']'.repeat(10000)+'}').ok,false);});
test('actual isolated fixed transport serialization agrees with reader for normal and adverse records',async()=>{
 const {generateTerminalCreatorTransportDerivative}=await import('./terminal-creator-transport-derivative.mjs');
 const original=readFileSync(new URL('../../../terminal-creator-transport-derivative-20261011/production-creator-entry.original.txt',import.meta.url),'utf8');
 const generated=generateTerminalCreatorTransportDerivative(original);assert.equal(generated.ok,true);
 const values=[raw(),{...raw(),before:snapshot(),after:snapshot(),count:1,phase:'RETURNED',returnStatus:'RETURNED',pidAssignment:'ASSIGNED',returnedPid:84,argumentsUnchanged:true},{...raw(),argumentCount:null,creatorPid:null,clock:null,phase:'OBSERVER_INITIALIZATION_FAILED',returnStatus:'NOT_OBSERVED',pidAssignment:'NOT_OBSERVED',captureCodes:['OBSERVER_INIT_FAILED']},{...raw(),count:2,duplicate:true,captureCodes:['DUPLICATE_CONNECT']}];
 for(const value of values){
  const writes=[],context=vm.createContext({Buffer,URL});context.raw=vm.runInContext('('+JSON.stringify(value)+')',context,{timeout:500});
  const agent={readConnectObservation(){return context.raw;}};
  const require=name=>{if(name==='node:util')return {types};if(name==='node:fs')return {writeFileSync(...args){writes.push(args);}};if(name==='node:path')return windowsPath;if(name==='node:process')return {platform:'win32',pid:42};assert.equal(name,'C:\\job\\fresh-runtime\\execution\\desktop\\runtime\\terminal-provider\\node_modules\\node-pty\\lib\\windowsPtyAgent.js');return agent;};
  require.resolve=name=>name;
  Object.assign(context,{require,moduleUrl:'file:///C:/job/fresh-runtime/execution/desktop/src/terminal/diagnostic-creator-entry.mjs',fileURLToPath:url=>windowsPath.normalize(decodeURIComponent(url.pathname).slice(1).replaceAll('/','\\'))});
  vm.runInContext('var transport=('+generated.initializerSource+')(require,moduleUrl,fileURLToPath);transport.acquire();transport.write();',context,{timeout:500});
  assert.equal(writes.length,1);assert.equal(writes[0][0],'C:\\job\\fresh-evidence\\connect\\42.json');assert.equal(writes[0][2].flag,'wx');
  const decoded=decode(writes[0][1]);assert.equal(decoded.ok,true);assert.deepEqual(decoded.observation,value);assert.equal(decoded.inputAuthorized,false);
 }
});
