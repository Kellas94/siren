// Inert provider composition. No native loader, PTY, process or shell runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createThreeLaneTerminalBootstrap,decodeThreeLaneTerminalBootstrap} from '../src/terminal/three-lane-bootstrap-codec.mjs';
import {ProductionControlChannel} from '../src/terminal/production-control-channel.mjs';
import {ProductionHistoryChannel,ProductionHistoryReader} from '../src/terminal/production-history-channel.mjs';
import {ProductionGateLink} from '../src/terminal/production-gate-link.mjs';
import {TerminalSessionCommandChannel} from '../src/terminal/session-command-channel.mjs';
import {TerminalSessionLink} from '../src/terminal/session-link.mjs';
const api=await import('../src/terminal/production-creator.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const scope={sessionId:'session1',channelId:'channel1'},image='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const envelope=()=>({version:1,...scope,projectId:'project1',startupId:'startup1',admissionEpoch:3,profileId:'powershell',cwd:'C:\\Project Ω',shell:{executable:image,args:['-NoLogo','-NoProfile'],env:{PATH:'C:\\Windows\\System32',SystemRoot:'C:\\Windows',CUSTOM:'unchanged'}},cols:100,rows:30});
const token=()=>({...scope,projectId:'project1',windowId:'window1',epoch:3,leaseId:'lease1',generation:1,gateGeneration:1});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function decodedBootstrap(){const encoded=createThreeLaneTerminalBootstrap(scope);const result=decodeThreeLaneTerminalBootstrap(Buffer.from(encoded.payload));encoded.dispose();return result;}
function pair(){
 const a=new EventEmitter(),b=new EventEmitter();
 for(const [s,p]of[[a,b],[b,a]]){s.writableLength=0;s.backlog=[];const on=s.on;s.on=function(name,fn){on.call(this,name,fn);if(name==='data'&&this.backlog.length){const q=this.backlog.splice(0);queueMicrotask(()=>q.forEach(bytes=>{if(!this.dead)this.emit('data',bytes);}));}return this;};s.write=data=>{const bytes=Buffer.from(data);queueMicrotask(()=>{if(p.dead)return;if(p.listenerCount('data'))p.emit('data',bytes);else p.backlog.push(bytes);});return true;};s.destroy=()=>{if(s.dead)return;s.dead=true;s.emit('close');queueMicrotask(()=>{if(!p.dead)p.emit('end');});};}
 return[a,b];
}
function setup(options={}){
 assert.equal(typeof api.createProductionCreator,'function');
 const bootstrap=decodedBootstrap(),witness={},pairs=Object.fromEntries(['control','history','command'].map(lane=>[lane,pair()]));
 const state={connects:[],witnessClosed:0,loads:0,spawns:[],writes:[],resizes:[],loss:[],termDisposed:0,data:null,exit:null};
 const adopted={bootstrap};Object.defineProperties(adopted,{witness:{value:witness},dispose:{value:()=>{state.witnessClosed++;bootstrap.dispose();return true;}}});
 const term={pid:73,write:data=>{state.writes.push(data);},resize:(cols,rows)=>{state.resizes.push([cols,rows]);},onData:fn=>{state.data=fn;return{dispose(){state.termDisposed++;}};},onExit:fn=>{state.exit=fn;return{dispose(){state.termDisposed++;}};}};
 const originalSecrets={control:Buffer.from(bootstrap.controlSecret),history:Buffer.from(bootstrap.historySecret),command:Buffer.from(bootstrap.commandSecret)};
 const creator=api.createProductionCreator({bootstrap:adopted,connectLane:q=>{state.connects.push(q);return Promise.resolve(pairs[q.lane][1]);},assertEndpointsCurrent:()=>true,loadPty:()=>{state.loads++;return Promise.resolve({spawn:(exe,args,opts)=>{state.spawns.push({exe,args,opts});return term;}});},onUnavailable:code=>state.loss.push(code),deadlineMs:1000,...options});
 const control=new ProductionControlChannel({stream:pairs.control[0],role:'main',channelId:scope.channelId,secret:originalSecrets.control,deadlineMs:1000});
 const history=new ProductionHistoryChannel({stream:pairs.history[0],role:'main',...scope,secret:originalSecrets.history,deadlineMs:1000});
 const command=new TerminalSessionCommandChannel({stream:pairs.command[0],role:'main',...scope,secret:originalSecrets.command,deadlineMs:1000});
 const gate=new ProductionGateLink({channelId:scope.channelId,send:q=>{if(!control.send(q))throw Error('CONTROL_UNAVAILABLE');},subscribe:r=>control.subscribe(r)});
 const reader=new ProductionHistoryReader({channel:history,sessionId:scope.sessionId}),link=new TerminalSessionLink({channel:command,onUnavailable:()=>{},deadlineMs:1000});
 return{creator,state,pairs,bootstrap,term,control,history,command,gate,reader,link,dispose(){creator.dispose();link.dispose();reader.dispose();gate.dispose();control.dispose();}};
}
async function ready(s){assert.equal(await s.creator.ready,true);assert.equal(await s.control.ready,true);assert.equal(await s.history.ready,true);assert.equal(await s.link.authenticated,true);assert.equal((await s.link.prepare(envelope())).initiallyClosed,true);assert.equal((await s.gate.sendGate({generation:1,open:true})).ok,true);return s.link.start({gateGeneration:1});}
test('actual pure three-lane startup waits for start before loading and spawns exact interactive profile',async()=>{
 const s=setup();try{assert.equal(await s.creator.ready,true);assert.deepEqual(s.state.connects.map(q=>q.lane),['control','history','command']);assert.equal(s.state.connects.every(q=>q.witness===s.state.connects[0].witness),true);assert.equal(s.state.witnessClosed,1);assert.equal(s.state.loads,0);assert.equal(s.state.spawns.length,0);
 const prepared=await s.link.prepare(envelope());assert.equal(prepared.initiallyClosed,true);assert.equal(s.state.loads,0);assert.equal((await s.gate.sendGate({generation:1,open:true})).ok,true);const reply=await s.link.start({gateGeneration:1});assert.deepEqual({...reply.reportedShell},{pid:73,image});assert.equal(s.state.loads,1);assert.equal(s.state.spawns.length,1);assert.deepEqual(s.state.spawns[0],{exe:image,args:['-NoLogo','-NoProfile'],opts:{cwd:envelope().cwd,env:Object.assign(Object.create(null),envelope().shell.env),cols:100,rows:30,useConpty:true,useConptyDll:false,handleFlowControl:false}});assert.equal(typeof s.state.data,'function');assert.equal(typeof s.state.exit,'function');assert.equal(s.creator.nativeExecutionAdmitted,false);
 }finally{s.dispose();}
});
test('real composed lease routes input and resize and drains output through Lock',async()=>{
 const s=setup();try{await ready(s);assert.equal((await s.link.request({op:'install',token:token()})).status,'accepted');await s.link.request({op:'input',token:token(),inputSequence:0,data:'user supplied\r'});await s.link.request({op:'resize',token:token(),cols:85,rows:27});assert.deepEqual(s.state.writes,['user supplied\r']);assert.deepEqual(s.state.resizes,[[85,27]]);s.state.data('before Ω\r\n');assert.equal((await s.gate.sendGate({generation:2,open:false})).ok,true);s.state.data('continues in background\r\n');const out=await s.reader.read({sessionId:scope.sessionId,fromSequence:0,maxBytes:32768});assert.equal(out.chunk.data,'before Ω\r\ncontinues in background\r\n');assert.equal((await s.link.request({op:'input',token:token(),inputSequence:1,data:'blocked'})).status,'failed');assert.deepEqual(s.state.writes,['user supplied\r']);assert.equal(s.state.spawns.length,1);
 }finally{s.dispose();}
});
test('Lock while provider import is pending prevents eventual spawn without a retry',async()=>{
 let resolve,loads=0;const pending=new Promise(yes=>{resolve=yes;});const s=setup({loadPty:()=>{loads++;return pending;}});try{assert.equal(await s.creator.ready,true);await s.link.prepare(envelope());await s.gate.sendGate({generation:1,open:true});const started=s.link.start({gateGeneration:1});await tick();assert.equal(loads,1);await s.gate.sendGate({generation:2,open:false});resolve({spawn:()=>{throw Error('must not spawn');}});await assert.rejects(started);assert.equal(s.state.spawns.length,0);assert.equal(s.creator.stats().closed,true);
 }finally{s.dispose();}
});
test('output handler is installed before ready and handles large scalar-aligned output without truncation',async()=>{
 const s=setup();try{await ready(s);const output='😀'.repeat(40000);s.state.data(output);const stats=s.creator.stats();assert.equal(stats.history.retainedUtf8Bytes,160000);assert.ok(stats.history.allocatedBytes<=4*1024*1024);let cursor=0,text='';while(cursor<160000){const r=await s.reader.read({sessionId:scope.sessionId,fromSequence:cursor,maxBytes:32768});text+=r.chunk.data;cursor+=r.chunk.utf8Bytes;}assert.equal(text,output);
 }finally{s.dispose();}
});
for(const cause of['exit','control','history','command'])test(cause+' permanently retires composition and no extra spawn',async()=>{
 const s=setup();try{await ready(s);if(cause==='exit')s.state.exit({exitCode:0});else s.pairs[cause][1].emit('close');assert.equal(s.creator.stats().closed,true);assert.equal(s.state.loss.length,1);assert.equal(s.state.termDisposed,2);assert.equal(s.state.spawns.length,1);assert.equal(s.creator.dispose(),true);assert.equal(s.state.loss.length,1);
 }finally{s.dispose();}
});
test('constructor rejects option Proxy and accessors without invoking traps',()=>{
 assert.equal(typeof api.createProductionCreator,'function');let traps=0;assert.throws(()=>api.createProductionCreator(new Proxy({}, {getPrototypeOf(){traps++;throw Error();},ownKeys(){traps++;throw Error();},get(){traps++;throw Error();}})));assert.equal(traps,0);const o={};Object.defineProperty(o,'bootstrap',{enumerable:true,get(){traps++;}});assert.throws(()=>api.createProductionCreator(o));assert.equal(traps,0);
});
test('pending native connect is retained after timeout and late returned stream is closed',async()=>{
 assert.equal(typeof api.createProductionCreator,'function');const b=decodedBootstrap();let close=0,resolve;const p=new Promise(yes=>resolve=yes);const adopted={bootstrap:b};Object.defineProperties(adopted,{witness:{value:{}},dispose:{value:()=>{close++;b.dispose();return true;}}});
 const c=api.createProductionCreator({bootstrap:adopted,connectLane:()=>p,assertEndpointsCurrent:()=>true,loadPty:()=>{throw Error('must not load');},onUnavailable:()=>{},deadlineMs:15});assert.equal(await c.ready,false);assert.equal(c.stats().connectPending,3);assert.equal(c.stats().closed,true);assert.equal(close,1);const [stream]=pair();resolve(stream);await tick();assert.equal(stream.dead,true);assert.equal(c.stats().connectPending,0);assert.equal(c.stats().verifiedExited,false);
});
test('captured provider callbacks cannot be replaced after shell startup',async()=>{
 const s=setup();try{await ready(s);s.term.write=()=>{throw Error('replacement must not run');};s.term.resize=()=>{throw Error('replacement must not run');};await s.link.request({op:'install',token:token()});assert.equal((await s.link.request({op:'input',token:token(),inputSequence:0,data:'captured'})).status,'accepted');assert.equal((await s.link.request({op:'resize',token:token(),cols:90,rows:32})).status,'accepted');assert.deepEqual(s.state.writes,['captured']);assert.deepEqual(s.state.resizes,[[90,32]]);
 }finally{s.dispose();}
});
test('output surrogate split across provider events is reassembled with one-unit retention',async()=>{
 const s=setup();try{await ready(s);s.state.data('a\ud83d');assert.equal(s.creator.stats().pendingSurrogateUnits,1);s.state.data('\ude00b');assert.equal(s.creator.stats().pendingSurrogateUnits,0);const r=await s.reader.read({sessionId:scope.sessionId,fromSequence:0,maxBytes:32768});assert.equal(r.chunk.data,'a😀b');assert.equal(r.chunk.utf8Bytes,6);
 }finally{s.dispose();}
});
for(const bad of ['x'.repeat(262145),'\udc00'])test('invalid or oversized output event fences without unbounded retained copy '+bad.length,async()=>{
 const s=setup();try{await ready(s);s.state.data(bad);assert.equal(s.creator.stats().closed,true);assert.equal(s.state.loss.length,1);assert.equal(s.creator.stats().history.retainedUtf8Bytes,0);assert.equal(s.creator.stats().verifiedExited,false);
 }finally{s.dispose();}
});
test('provider spawn accessor is refused without executing the getter',async()=>{
 let traps=0;const p={};Object.defineProperty(p,'spawn',{enumerable:true,get(){traps++;return()=>{};}});const s=setup({loadPty:()=>Promise.resolve(p)});try{assert.equal(await s.creator.ready,true);await s.link.prepare(envelope());await s.gate.sendGate({generation:1,open:true});await assert.rejects(s.link.start({gateGeneration:1}));assert.equal(traps,0);assert.equal(s.creator.stats().spawnAttempts,0);assert.equal(s.creator.stats().providerUnknown,true);
 }finally{s.dispose();}
});
test('provider Promise own constructor accessor is refused without executing the getter',async()=>{
 let traps=0;const promise=Promise.resolve({spawn:()=>{throw Error('must not spawn');}});Object.defineProperty(promise,'constructor',{get(){traps++;throw Error();}});const s=setup({loadPty:()=>promise});try{assert.equal(await s.creator.ready,true);await s.link.prepare(envelope());await s.gate.sendGate({generation:1,open:true});await assert.rejects(s.link.start({gateGeneration:1}));assert.equal(traps,0);assert.equal(s.creator.stats().providerUnknown,true);assert.equal(s.creator.stats().spawnAttempts,0);
 }finally{s.dispose();}
});
test('known native endpoint refusal before channel setup closes witness and never loads provider',async()=>{
 const s=setup({assertEndpointsCurrent:()=>false});try{assert.equal(await s.creator.ready,false);assert.equal(s.state.witnessClosed,1);assert.equal(s.state.loads,0);assert.equal(s.creator.stats().spawnAttempts,0);assert.equal(s.state.loss.length,1);
 }finally{s.dispose();}
});
test('fixed entry qualification guard is DATA-only and refuses local, wrong branch, runtime and unsupported OS',()=>{
 assert.equal(typeof api.requireProductionCreatorQualification,'function');const good={platform:'win32',arch:'x64',electron:'44.9.3',modules:'149',napi:'10',electronRunAsNode:'1',actions:'true',runnerOs:'Windows',ref:'refs/heads/probe/terminal-production-backend-2026-10-09',windowsVersion:'10.0.18309'};assert.equal(api.requireProductionCreatorQualification(good),true);
 for(const [key,value]of [['platform','linux'],['arch','arm64'],['electron','44.5.0'],['modules','148'],['napi','9'],['electronRunAsNode','0'],['actions',undefined],['runnerOs','Linux'],['ref','refs/heads/feature/portable-foundation'],['windowsVersion','10.0.18308'],['windowsVersion','10.0.9999999999999999999999']])assert.throws(()=>api.requireProductionCreatorQualification({...good,[key]:value}));
 let traps=0;assert.throws(()=>api.requireProductionCreatorQualification(new Proxy(good,{get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}})));assert.equal(traps,0);const accessor={...good};Object.defineProperty(accessor,'actions',{enumerable:true,get(){traps++;}});assert.throws(()=>api.requireProductionCreatorQualification(accessor));assert.equal(traps,0);
});
test('ambiguous connection callback retains a permanent unknown reservation',async()=>{
 assert.equal(typeof api.createProductionCreator,'function');const b=decodedBootstrap(),adopted={bootstrap:b};Object.defineProperties(adopted,{witness:{value:{}},dispose:{value:()=>{b.dispose();return true;}}});let called=0;
 const c=api.createProductionCreator({bootstrap:adopted,connectLane:()=>{called++;throw Error('unknown native effect');},assertEndpointsCurrent:()=>true,loadPty:()=>Promise.reject(Error()),onUnavailable:()=>{},deadlineMs:100});assert.equal(await c.ready,false);assert.equal(called,1);assert.equal(c.stats().connectPending,0);assert.equal(c.stats().unknownConnectReservations,1);assert.equal(c.stats().retainedSessionReservation,1);assert.equal(c.stats().verifiedExited,false);
});
test('sanitized creator runtime guard works without GitHub variables and cannot claim parent qualification',()=>{
 assert.equal(typeof api.requireProductionCreatorRuntime,'function');const child={platform:'win32',arch:'x64',electron:'44.9.3',modules:'149',napi:'10',electronRunAsNode:'1',windowsVersion:'10.0.18309'};assert.equal(api.requireProductionCreatorRuntime(child),true);assert.throws(()=>api.requireProductionCreatorQualification(child));assert.throws(()=>api.requireProductionCreatorRuntime({...child,actions:'true'}));for(const electron of ['44.5.0','44.5.1','44.9.1','44.9.4'])assert.throws(()=>api.requireProductionCreatorRuntime({...child,electron}));
});
test('fixed creator entry is inert on import and exports only an explicit no-configuration runner',async()=>{
 const entry=await import('../src/terminal/production-creator-entry.mjs');assert.deepEqual(Object.keys(entry),['runProductionCreatorEntry']);assert.equal(typeof entry.runProductionCreatorEntry,'function');
});
test('synchronous output during handler registration is captured before startup-ready',async()=>{
 const s=setup();s.term.onData=fn=>{s.state.data=fn;fn('first output before ready\r\n');return{dispose(){s.state.termDisposed++;}};};try{await ready(s);const r=await s.reader.read({sessionId:scope.sessionId,fromSequence:0,maxBytes:32768});assert.equal(r.chunk.data,'first output before ready\r\n');assert.equal(s.creator.stats().spawnAttempts,1);
 }finally{s.dispose();}
});
test('synchronous exit during handler registration cannot publish startup-ready',async()=>{
 const s=setup();s.term.onExit=fn=>{fn({exitCode:0});return{dispose(){s.state.termDisposed++;}};};try{await assert.rejects(ready(s));assert.equal(s.creator.stats().closed,true);assert.equal(s.creator.stats().spawnAttempts,1);assert.equal(s.creator.stats().shellExists,true);assert.equal(s.state.termDisposed,2);assert.equal(s.creator.stats().verifiedExited,false);
 }finally{s.dispose();}
});
