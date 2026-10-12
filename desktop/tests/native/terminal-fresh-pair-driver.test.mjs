import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as path from 'node:path';
import * as url from 'node:url';
import * as crypto from 'node:crypto';
import * as util from 'node:util';
import {EventEmitter} from 'node:events';
const here=import.meta.url;
// Explicit prospective raw-binding observer delta; historical snapshots remain unchanged.
function withoutRawBinding(text){const a=text.indexOf('// FRESH_RAW_BINDING_DIAGNOSTIC_BEGIN'),b=text.indexOf('// FRESH_RAW_BINDING_DIAGNOSTIC_END')+'// FRESH_RAW_BINDING_DIAGNOSTIC_END\n'.length;assert.ok(a>0&&b>a);text=text.slice(0,a)+text.slice(b);const pattern=/rawBindingFailure=(rawRecordFailure\(record\)|'RAW_[A-Z_]+'|null);/g;assert.equal([...text.matchAll(pattern)].length,23);text=text.replace(pattern,'');assert.equal(text.split('result.bindingFailure=rawBindingFailure;').length,2);return text.replace('result.bindingFailure=rawBindingFailure;','');}

function source(name){return readFileSync(new URL(name,here),'utf8');}
test('new inactive fixed driver exists with genuine private receipt seam',async()=>{
 const text=source('./terminal-fresh-pair-driver.mjs'),calls=[];
 const context=vm.createContext({Buffer,URL,process:{platform:'linux',arch:'x64',versions:{node:'24.16.0'},argv:[],env:{}}});
 const module=new vm.SourceTextModule(text,{context,initializeImportMeta(meta){meta.url=new URL('./terminal-fresh-pair-driver.mjs',here).href;meta.main=false;}});
 const linked=new Map();await module.link(async name=>{
  const data=name==='node:assert/strict'?{default:assert}:name==='node:crypto'?crypto:name==='node:path'?{...path,default:path.win32}:name==='node:url'?url:name==='node:util'?util:name==='node:fs/promises'?Object.fromEntries(['readFile','writeFile','mkdir'].map(k=>[k,async()=>{calls.push(k);throw 0;}])):name==='node:child_process'?{spawn(){calls.push('spawn');throw 0;},execFile(){calls.push('exec');throw 0;}}:name.endsWith('terminal-fresh-runtime-provision.mjs')?{async recheckProvisionedFreshRuntime(){calls.push('private-recheck');return false;}}:name.endsWith('terminal-fresh-environment.mjs')?{captureFreshPairLaunchEnvironment(){calls.push('capture');throw 0;}}:name.endsWith('terminal-connect-raw-file.mjs')?{readTerminalConnectRawFile(){calls.push('raw');throw 0;}}:name.endsWith('terminal-resolution-observation.mjs')?{createOriginalResolutionFixture(){calls.push('fixture');throw 0;}}:null;
  assert.ok(data,'unanticipated dependency '+name);if(!linked.has(name))linked.set(name,new vm.SyntheticModule(Object.keys(data),function(){for(const [k,v]of Object.entries(data))this.setExport(k,v);},{context}));return linked.get(name);
 });await module.evaluate({timeout:500});assert.deepEqual(calls,[]);assert.equal(typeof module.namespace.runFreshTerminalPair,'function');
 const result=await module.namespace.runFreshTerminalPair({ok:true});assert.equal(result.ok,false);assert.equal(result.nativeAdmission,false);assert.ok(!calls.includes('spawn'));assert.ok(!calls.includes('exec'));assert.ok(!calls.includes('writeFile'));
});
test('fresh worker retains actual original command wait and cleanup boundaries',()=>{
 const worker=source('./terminal-fresh-pair-worker.mjs');
 assert.ok(worker.includes('for(let i=0;i<300;i++)'));
 assert.ok(worker.includes('await delay(50)'));
 assert.ok(worker.includes('assertCleanupObservation(observation)'));
 assert.ok(worker.includes('terminalInput'));
});

function workerFragments(){
 const text=source('./terminal-fresh-pair-worker.mjs'),start=text.indexOf('function argsToCommandLine(file, args) {'),end=text.indexOf('// FRESH_BOUNDARY_HELPERS_END');
 assert.ok(start>0&&end>start);const stdin=new EventEmitter();stdin.setEncoding=()=>{};const writes=[],timers=new Map();let tick=0,id=0;
 const context=vm.createContext({assert,types:util.types,Buffer,createHash:crypto.createHash,performance:{now:()=>++tick},process:{pid:100,stdin,stdout:{write:s=>writes.push(s)}},setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:key=>timers.delete(key)});
 new vm.Script(text.slice(start,end)).runInContext(context,{timeout:500});return{context,stdin,writes,timers};
}
function rawFixture(){
 const env=[{key:'PATH',bytes:1,sha256:'a'.repeat(64)}],snapshot={env,envSha256:'b'.repeat(64),totalBytes:8,blockCodeUnits:8,commandLineBytes:3,commandLineSha256:crypto.createHash('sha256').update('cmd').digest('hex'),cwdBytes:3,cwdSha256:crypto.createHash('sha256').update('cwd').digest('hex'),useConptyDll:false};
 return{record:{ok:true,rawSha256:'c'.repeat(64),decoded:{observation:{schema:1,boundary:'JS_NATIVE_CONNECT_ARGUMENTS',argumentCount:6,creatorPid:101,returnedPid:102,count:1,duplicate:false,phase:'RETURNED',returnStatus:'RETURNED',pidAssignment:'ASSIGNED',argumentsUnchanged:true,captureCodes:[],clock:'PROCESS_MONOTONIC',beforeConnectMs:1,afterConnectMs:2,before:snapshot,after:snapshot}}},expected:{creatorPid:101,shellPid:102,env,cwd:'cwd',commandLine:'cmd'}};
}
test('isolated fresh raw binding rejects wrong PID command cwd environment duplicate and partial records',()=>{
 const {context}=workerFragments();const mutations=[r=>r.decoded.observation.creatorPid++,r=>r.decoded.observation.returnedPid++,r=>r.decoded.observation.argumentCount=5,r=>r.decoded.observation.count=2,r=>r.decoded.observation.duplicate=true,r=>r.decoded.observation.captureCodes=['OBSERVER_ERROR'],r=>r.decoded.observation.phase='NATIVE_THROW',r=>r.decoded.observation.before.cwdSha256='d'.repeat(64),r=>r.decoded.observation.before.commandLineSha256='d'.repeat(64),r=>r.decoded.observation.before.env=[],r=>r.decoded.observation.afterConnectMs=0,r=>r.decoded.observation.before=null];
 {const {record,expected}=rawFixture();context.data=JSON.stringify({record,expected});vm.runInContext('var pair=JSON.parse(data)',context);assert.doesNotThrow(()=>vm.runInContext('assertFreshBoundary(pair.record,pair.expected)',context,{timeout:500}));}
 for(const mutate of mutations){const {record,expected}=rawFixture();mutate(record);context.data=JSON.stringify({record,expected});vm.runInContext('var pair=JSON.parse(data)',context);assert.throws(()=>vm.runInContext('assertFreshBoundary(pair.record,pair.expected)',context,{timeout:500}));}
});
test('isolated byte-pinned node-pty quoting bodies predict fixed shell command without provider evaluation',()=>{
 const {context}=workerFragments(),original=readFileSync(new URL('../../../terminal-connect-derivative-20261011/original-data/windowsPtyAgent.js.source.txt',here),'utf8');
 const selected=original.slice(original.indexOf('function argsToCommandLine(file, args) {')).replace('exports.argsToCommandLine = argsToCommandLine;','').split('//# sourceMappingURL')[0];
 assert.ok(source('./terminal-fresh-pair-worker.mjs').includes(selected));
 assert.equal(vm.runInContext("argsToCommandLine('C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe',['-NoLogo','-NoProfile'])",context),'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoLogo -NoProfile');
 assert.equal(vm.runInContext("argsToCommandLine('C:\\\\Program Files\\\\powershell.exe',['-NoLogo','-NoProfile'])",context),'"C:\\Program Files\\powershell.exe" -NoLogo -NoProfile');
});
function challenge(){return{schema:1,type:'FRESH_PREINPUT_CHALLENGE',workerPid:100,creatorPid:101,shellPid:102,armId:'pathext-omitted',token:'a'.repeat(32),nonce:'b'.repeat(32),rawSha256:'c'.repeat(64)};}
function permit(c){return{schema:1,type:'FRESH_PREINPUT_PERMIT',workerPid:c.workerPid,armId:c.armId,token:c.token,nonce:c.nonce,rawSha256:c.rawSha256};}
test('isolated child pipe needs complete exact one-shot parent permit and late duplicate revokes gate',async()=>{
 const f=workerFragments(),c=challenge();f.context.challenge=c;const pending=vm.runInContext('freshParentPermit(challenge)',f.context,{timeout:500});assert.equal(f.writes.length,1);assert.ok(f.writes[0].endsWith('\n'));const text=JSON.stringify(permit(c))+'\n';f.stdin.emit('data',text.slice(0,11));f.stdin.emit('data',text.slice(11));const reply=await pending;assert.equal(reply.isCurrent(),true);assert.ok(reply.endedMs>=reply.startedMs);f.stdin.emit('data',text);assert.equal(reply.isCurrent(),false);assert.equal(f.timers.size,0);
});
test('isolated child pipe rejects malformed wrong nonce extra frame closed channel and finite timeout',async()=>{
 for(const mode of ['malformed','nonce','extra','closed','timeout']){const f=workerFragments(),c=challenge();f.context.challenge=c;const pending=vm.runInContext('freshParentPermit(challenge)',f.context,{timeout:500});let text=JSON.stringify(permit(c))+'\n';if(mode==='malformed')text='{\n';if(mode==='nonce')text=text.replace('b'.repeat(32),'d'.repeat(32));if(mode==='extra')text+='{}\n';if(mode==='closed')f.stdin.emit('end');else if(mode==='timeout')[...f.timers.values()][0]();else f.stdin.emit('data',text);await assert.rejects(pending);assert.equal(f.timers.size,0);}
});
function driverFragments(){const text=source('./terminal-fresh-pair-driver.mjs'),a=text.indexOf('// DRIVER_INERT_HELPERS_BEGIN'),b=text.indexOf('// DRIVER_INERT_HELPERS_END');const context=vm.createContext({assert,sha:value=>crypto.createHash('sha256').update(value).digest('hex')});new vm.Script(text.slice(a,b)).runInContext(context,{timeout:500});return context;}
test('isolated actual-parent challenge binds worker pid arm token and closed DATA shape',()=>{
 const context=driverFragments();for(const change of [null,c=>c.workerPid++,c=>c.armId='pathext-trusted',c=>c.token='d'.repeat(32),c=>c.creatorPid=c.shellPid,c=>c.extra=true]){const c=challenge();if(change)change(c);context.line='SIREN_FRESH_PREINPUT '+JSON.stringify(c);context.expected={workerPid:100,armId:'pathext-omitted',token:'a'.repeat(32)};if(change)assert.throws(()=>vm.runInContext('consumeFreshChallenge(line,expected)',context));else assert.doesNotThrow(()=>vm.runInContext('consumeFreshChallenge(line,expected)',context));}
});
test('literal derivation exactly reconstructs current worker and leaves wait body unchanged',()=>{
 const base=new URL('../../../terminal-fresh-driver-20261011/',here),map=JSON.parse(readFileSync(new URL('worker-derivation.json',base),'utf8'));let original=readFileSync(new URL('historical-worker.original.txt',base),'utf8');const initial=original;
 assert.equal(crypto.createHash('sha256').update(Buffer.from(original)).digest('hex'),map.original.sha256);
 for(const row of map.changes){assert.equal(original.split(row.originalAnchor).length,2);original=original.replace(row.originalAnchor,row.replacement);}
 // Prospective worker observability is explicit; historical source/derivation remain immutable.
 let current=withoutRawBinding(source('./terminal-fresh-pair-worker.mjs'));const startupOrder=" }return rows.sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0);";assert.equal(current.split(startupOrder).length,2);current=current.replace(startupOrder,' }return rows;');const begin=current.indexOf('// FRESH_WORKER_DIAGNOSTIC_BEGIN'),end=current.indexOf('// FRESH_WORKER_DIAGNOSTIC_END')+'// FRESH_WORKER_DIAGNOSTIC_END\n'.length;assert.ok(begin>0&&end>begin);current=current.slice(0,begin)+current.slice(end);current=current.replace("import {promisify,types} from 'node:util';","import {promisify} from 'node:util';");
 for(const phase of ['module-import','fixture-preparation','window-registry','native-loader','utility-host-start','utility-host-ready','initial-access','profile-discovery','held-identities','external-observer-start','external-observer-ready','fixture-absence','preinput-engine','preinput-raw-read','preinput-raw-binding','preinput-parent-permit','preinput-held-recheck']){const assignment="observationPhase='"+phase+"';";assert.equal(current.split(assignment).length,2);current=current.replace(assignment,'');}
 const capture='result.failureDiagnostic=freshWorkerFailure(error,observationPhase,result.milestones.at(-1)?.name??null);';assert.equal(current.split(capture).length,2);current=current.replace(capture,'');assert.equal(original,current);
 const wait=text=>text.slice(text.indexOf(' const waitFile='),text.indexOf(' const absent='));assert.equal(wait(original),wait(initial));
});
test('isolated historical native/external cleanup DATA rejects unknown joins living processes and missing receipts',()=>{
 const context=driverFragments(),base=JSON.parse(readFileSync(new URL('../../../terminal-fresh-driver-20261011/historical-cleanup.data.json',here),'utf8'));
 for(const mutate of [null,r=>r.graph.actualSettled=false,r=>r.graph.unknown=true,r=>r.external.after[0].wait=258,r=>r.sessionReceipts[0].snapshot.active=1,r=>r.hostReceipt.snapshot.held[0].alive=true,r=>r.sessionReceipts=[],r=>r.utilityExit=0,r=>r.external.before.pop()]){const value=structuredClone(base);if(mutate)mutate(value);context.data=JSON.stringify(value);vm.runInContext('var cleanup=JSON.parse(data)',context);if(mutate)assert.throws(()=>vm.runInContext('requireFreshCleanup(cleanup)',context));else assert.doesNotThrow(()=>vm.runInContext('requireFreshCleanup(cleanup)',context));}
});
test('isolated command classification preserves bounded adverse for distinct arm only and refuses provenance/timing errors',()=>{
 const context=driverFragments(),timing={workerPid:100,heldShellPid:102,token:'a'.repeat(32),pollCount:300,pollDelayMs:50,nominalWaitMs:15000,inputSubmittedMs:1,inputReturnedMs:2,inputAcceptedMs:3,waitStartedMs:4,nominalDeadlineMs:15004,waitEndedMs:15010,completionObserved:false,completedWithinNominalDeadline:null};
 const base={status:'FAILED',error:{message:'FIXTURE_FILE_DEADLINE:C:\\fixture'},commandTiming:timing};
 for(const mutate of [null,r=>r.error.message='FRESH_PREINPUT_PIPE_REFUSED',r=>r.commandTiming.workerPid++,r=>r.commandTiming.heldShellPid++,r=>r.commandTiming.token='b'.repeat(32),r=>r.commandTiming.pollCount=301,r=>r.commandTiming.nominalDeadlineMs++,r=>r.commandTiming.waitEndedMs=100,r=>r.commandTiming.inputReturnedMs=null]){const value=structuredClone(base);if(mutate)mutate(value);context.data=JSON.stringify(value);vm.runInContext('var observed=JSON.parse(data)',context);context.expected={workerPid:100,shellPid:102,token:'a'.repeat(32)};if(mutate)assert.throws(()=>vm.runInContext('classifyFreshCommand(observed,expected)',context));else assert.equal(vm.runInContext('classifyFreshCommand(observed,expected)',context),'BOUNDED_TARGET_ADVERSE');}
});
test('isolated cleanup gate precedes any distinct-arm advance even when original command timeout is valid',()=>{
 const context=driverFragments(),base=JSON.parse(readFileSync(new URL('../../../terminal-fresh-driver-20261011/historical-cleanup.data.json',here),'utf8'));
 for(const mutate of [null,r=>r.graph.unknown=true,r=>r.sessionReceipts=[],r=>r.external.after[0].wait=258]){
  const cleanup=structuredClone(base);if(mutate)mutate(cleanup);const timing={workerPid:100,heldShellPid:cleanup.beforeSession.shell.pid,token:'a'.repeat(32),pollCount:300,pollDelayMs:50,nominalWaitMs:15000,inputSubmittedMs:1,inputReturnedMs:2,inputAcceptedMs:3,waitStartedMs:4,nominalDeadlineMs:15004,waitEndedMs:15010,completionObserved:false,completedWithinNominalDeadline:null};
  context.data=JSON.stringify({cleanup,observed:{status:'FAILED',error:{message:'FIXTURE_FILE_DEADLINE:C:\\fixture'},commandTiming:timing},expected:{workerPid:100,shellPid:cleanup.beforeSession.shell.pid,token:'a'.repeat(32)}});vm.runInContext('var bound=JSON.parse(data);var advanced=0',context);
  const code='requireFreshCleanup(bound.cleanup);classifyFreshCommand(bound.observed,bound.expected);advanced++';if(mutate)assert.throws(()=>vm.runInContext(code,context));else assert.doesNotThrow(()=>vm.runInContext(code,context));assert.equal(vm.runInContext('advanced',context),mutate?0:1);
 }
});
