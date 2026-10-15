// Owner regression adapted from preserved peer causal framing; uses live source.
// SOURCE_ONLY causal event ordering. Evaluates only the literal one-arm block,
// never the complete driver/worker/provider. Fake process/IO/cleanup are inert
// prerequisites, not native witnesses. The earlier FD1 project guard is outside
// this selected fragment so this independently tests the retirement boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';

const read=name=>readFile(new URL('../../../'+name,import.meta.url),'utf8');
const source=await read('desktop/tests/native/terminal-fresh-pair-driver.mjs');
const cleanup=JSON.parse(await read('terminal-fresh-driver-20261011/historical-cleanup.data.json'));
const helpers=source.slice(source.indexOf('// DRIVER_INERT_HELPERS_BEGIN'),source.indexOf('// DRIVER_INERT_HELPERS_END'));
const start=source.indexOf('   const child=spawn(electron');
const endOffset=source.slice(start).search(/\r?\n  }\r?\n  result\.ok=true;/);
const finish=endOffset<0?-1:start+endOffset;
assert.ok(start>0&&finish>start);
const fragment=source.slice(start,finish);
const sha=value=>createHash('sha256').update(value).digest('hex');
const advance=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};

function setup(){
 const child=new EventEmitter();child.pid=100;
 child.stdout=new EventEmitter();child.stderr=new EventEmitter();
 child.stdout.setEncoding=child.stderr.setEncoding=()=>{};
 const sent=[];child.stdin=new EventEmitter();child.stdin.write=s=>sent.push(s);child.stdin.end=()=>{};child.kill=()=>{};
 const timers=new Map(),saved=[];let next=0;
 const armId='pathext-omitted',token='a'.repeat(32),run='123',commit='b'.repeat(40);
 const commandLine='fixed command',project='C:\\review\\job\\project-\u0218iren-\u0394';
 const env=[{key:'PATH',bytes:8,sha256:sha('C:\\tools')}];
 const challenge={schema:1,type:'FRESH_PREINPUT_CHALLENGE',workerPid:100,creatorPid:cleanup.beforeSession.root.pid,shellPid:cleanup.beforeSession.shell.pid,armId,token,nonce:'c'.repeat(32),rawSha256:'d'.repeat(64)};
 const before={env,useConptyDll:false,cwdSha256:sha(project),commandLineSha256:sha(commandLine)};
 const raw={ok:true,rawSha256:challenge.rawSha256,decoded:{observation:{creatorPid:challenge.creatorPid,returnedPid:challenge.shellPid,argumentCount:6,count:1,duplicate:false,phase:'RETURNED',returnStatus:'RETURNED',pidAssignment:'ASSIGNED',argumentsUnchanged:true,captureCodes:[],before,after:before}}};
 const observed={status:'SINGLE_CMDLET_DIAGNOSTIC_COMPLETE',run,commit,cleanupVerified:true,unavailable:[],commandCompleted:true,mandatoryMarkersObserved:true,externalProcessJoin:true,
  commandTiming:{workerPid:100,heldShellPid:challenge.shellPid,token,pollCount:300,pollDelayMs:50,nominalWaitMs:15000,nominalDeadlineMs:15004,inputSubmittedMs:1,inputReturnedMs:2,inputAcceptedMs:3,waitStartedMs:4,waitEndedMs:5,completedWithinNominalDeadline:true,completionObserved:true,completionObservedMs:5}};
 const fixture={expected:token};
 const context=vm.createContext({assert,Buffer,path:path.win32,sha,performance:{now:()=>1},
  spawn:()=>child,electron:'inert',entry:'inert',project,launchEnvironment:{},armId,fixture,
  armOut:'C:\\review\\job\\out',retainedJobRoot:'inert',commandLine,engine:{canonicalPath:'inert'},
  pins:[],controllerPins:[],parentNodePin:{path:'inert',bytes:1,sha256:'0'.repeat(64)},enginePin:{path:'inert',bytes:1,sha256:'0'.repeat(64)},
  pin:async()=>({path:'inert',bytes:1,sha256:'0'.repeat(64)}),samePin:(a,b)=>a.path===b.path&&a.bytes===b.bytes&&a.sha256===b.sha256,
  recheckProvisionedFreshRuntime:async()=>true,validateHostAsyncReceipt:()=>({ok:true}),
  setTimeout:fn=>{timers.set(++next,fn);return next;},clearTimeout:key=>timers.delete(key),
  save:async(name,value)=>saved.push({name,value:JSON.parse(JSON.stringify(value))}),
  readFile:async name=>Buffer.from(JSON.stringify(name.endsWith('worker-result.json')?observed:name.endsWith('command-input-receipt.json')?{ok:true}:cleanup))});
 context.encoded=JSON.stringify({raw,run,commit,env});
 vm.runInContext('var fixtureData=JSON.parse(encoded);var rawData=fixtureData.raw;var provision={run:fixtureData.run,commit:fixtureData.commit};var arm={env:fixtureData.env};var result={arms:[]};var flags={nativeAdmission:false,inputAuthorized:false};var readTerminalConnectRawFile=async()=>rawData;',context,{timeout:500});
 vm.runInContext(helpers,context,{timeout:500});
 let settled=false,value,error;
 const work=vm.runInContext('(async()=>{'+fragment+'\nreturn {launch,getPending:()=>pending,getChallenges:()=>challenges,getPipeFailed:()=>pipeFailed};})()',context,{timeout:500});
 work.then(v=>{settled=true;value=v;},e=>{settled=true;error=e;});
 const wire='SIREN_FRESH_PREINPUT '+JSON.stringify(challenge)+'\n';
 return {child,sent,timers,saved,wire,work,get settled(){return settled;},get value(){return value;},get error(){return error;}};
}
async function permit(h){h.child.stdout.emit('data',h.wire);await advance();assert.equal(h.sent.length,1);assert.equal(h.error,undefined);}

test('control literal arm can complete with all stdout delivered before exit continuation',async()=>{
 const h=setup();await permit(h);h.child.emit('exit',0,null);h.child.stdout.emit('end');h.child.stderr.emit('end');h.child.emit('close',0,null);
 const result=await h.work;assert.equal(result.launch.commandStatus,'COMPLETE');assert.equal(result.launch.actualCleanupVerified,true);assert.equal(result.getPipeFailed(),false);assert.equal(h.timers.size,0);
});

test('FD2 late duplicate after exit is consumed before final classification and refuses the arm',async()=>{
 const h=setup();await permit(h);h.child.emit('exit',0,null);await advance();
 assert.equal(h.settled,false,'process exit must not retire undrained stdout');
 h.child.stdout.emit('data',h.wire);h.child.stdout.emit('end');h.child.stderr.emit('end');h.child.emit('close',0,null);
 await assert.rejects(h.work,assert.AssertionError);
 assert.equal(h.timers.size,0);
 const saved=h.saved.find(row=>row.name.endsWith('-launch.json'));
 assert.equal(saved.value.pipeStatus,'REFUSED');
});

test('FD2 unterminated post-exit frame is retained and refuses the arm after close',async()=>{
 const h=setup();await permit(h);h.child.emit('exit',0,null);await advance();
 assert.equal(h.settled,false,'process exit must not retire undrained stdout');
 h.child.stdout.emit('data','SIREN_FRESH_PREINPUT {');h.child.stdout.emit('end');h.child.stderr.emit('end');h.child.emit('close',0,null);
 await assert.rejects(h.work,assert.AssertionError);
 assert.equal(h.timers.size,0);
 const saved=h.saved.find(row=>row.name.endsWith('-launch.json'));
 assert.equal(saved.value.partialFrame,'SIREN_FRESH_PREINPUT {');
});
