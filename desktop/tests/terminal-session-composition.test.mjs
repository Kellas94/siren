// Full pure composition; providers and connected streams are inert DATA glue.
// Passing these cases establishes no Windows/native/PTY/package admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {TerminalSessionCommandChannel} from '../src/terminal/session-command-channel.mjs';
import {TerminalCreatorSession} from '../src/terminal/creator-session.mjs';
const api=await import('../src/terminal/session-link.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const scope={sessionId:'session1',channelId:'channel1'},image='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
function envelope(){return {version:1,...scope,projectId:'project1',startupId:'startup1',admissionEpoch:4,profileId:'powershell',cwd:'C:\\Work Ω\\project',shell:{executable:image,args:['-NoLogo','-NoProfile'],env:{PATH:'C:\\Windows\\System32',SystemRoot:'C:\\Windows',CUSTOM:'independently-captured'}},cols:120,rows:40};}
function setup({asyncWire=false,prepareShell,assertEndpointsCurrent=()=>true,deadlineMs=1000}={}){
 assert.equal(typeof api.TerminalSessionLink,'function');const a=new EventEmitter(),b=new EventEmitter();
 for(const[s,p]of[[a,b],[b,a]]){s.writableLength=0;s.write=data=>{const bytes=Buffer.from(data);s.onWrite?.(bytes);if(asyncWire)queueMicrotask(()=>{if(!p.dead)p.emit('data',bytes);});else p.emit('data',bytes);return true;};s.destroy=()=>{if(s.dead)return;s.dead=true;s.emit('close');queueMicrotask(()=>p.emit('end'));};}
 const secret=Buffer.alloc(32,63),creatorChannel=new TerminalSessionCommandChannel({stream:b,role:'creator',...scope,secret}),mainChannel=new TerminalSessionCommandChannel({stream:a,role:'main',...scope,secret});
 const state={spawns:0,config:null,writes:[],resizes:[],creatorLoss:[],mainLoss:[]};
 const creator=new TerminalCreatorSession({channel:creatorChannel,assertEndpointsCurrent,prepareShell:prepareShell??(config=>{state.config=config;return Promise.resolve({spawn:()=>{state.spawns++;return {reportedShell:{pid:73,image},writeInput:data=>{state.writes.push(data);},resize:(cols,rows)=>{state.resizes.push([cols,rows]);}};}});}),onUnavailable:code=>state.creatorLoss.push(code),deadlineMs});
 const link=new api.TerminalSessionLink({channel:mainChannel,onUnavailable:()=>state.mainLoss.push('unavailable'),deadlineMs});
 return{a,b,creatorChannel,mainChannel,creator,link,state,dispose(){link.dispose();creator.dispose();mainChannel.dispose();creatorChannel.dispose();}};
}
const token=()=>({...scope,projectId:'project1',windowId:'window1',epoch:4,leaseId:'lease1',generation:1,gateGeneration:1});
async function ready(s,e=envelope()){const prepared=await s.link.prepare(e);assert.equal(prepared.initiallyClosed,true);assert.equal(prepared.projectId,e.projectId);assert.equal(s.state.spawns,0);s.creator.applyGate({generation:1,open:true});const reply=await s.link.start({gateGeneration:1});assert.equal(reply.type,'startup-ready');assert.deepEqual({...reply.reportedShell},{pid:73,image});return reply;}

for(const asyncWire of[false,true])test('main and creator complete real pure modules and fixed commands over '+(asyncWire?'microtask':'synchronous')+' transport',async()=>{
 const s=setup({asyncWire});try{await ready(s);assert.equal(await s.link.ready,true);assert.equal(s.state.spawns,1);assert.equal(s.link.isAvailable(),true);assert.deepEqual(s.state.config.shell.args,['-NoLogo','-NoProfile']);assert.equal(s.state.config.cwd,envelope().cwd);
 assert.equal((await s.link.request({op:'install',token:token()})).status,'accepted');assert.equal((await s.link.request({op:'input',token:token(),inputSequence:0,data:'print("Ω")\r'})).status,'accepted');assert.equal((await s.link.request({op:'resize',token:token(),cols:90,rows:28})).status,'accepted');assert.deepEqual(s.state.writes,['print("Ω")\r']);assert.deepEqual(s.state.resizes,[[90,28]]);assert.equal(s.link.nativeExecutionAdmitted,false);
 }finally{s.dispose();}
});
test('complete pure startup captures caller environment before authentication and leaves no raw reservation',async()=>{
 const s=setup();try{const e=envelope();e.shell.env.CUSTOM='x'.repeat(32768);const original=e.shell.env.CUSTOM;const preparing=s.link.prepare(e);e.shell.env.CUSTOM='changed';const r=await preparing;assert.equal(r.type,'startup-prepared');assert.equal(s.link.stats().retainedStartupBytes,0);s.creator.applyGate({generation:1,open:true});await s.link.start({gateGeneration:1});assert.equal(s.state.config.shell.env.CUSTOM,original);assert.equal(s.creator.stats().startup.rawReservedBytes,0);}finally{s.dispose();}
});
test('no command may run between prepared and start or without a matching installed lease',async()=>{
 const s=setup();try{await s.link.prepare(envelope());await assert.rejects(s.link.request({op:'input',token:token(),inputSequence:0,data:'no'}));assert.equal(s.state.spawns,0);s.creator.applyGate({generation:1,open:true});await s.link.start({gateGeneration:1});assert.equal((await s.link.request({op:'input',token:token(),inputSequence:0,data:'no'})).status,'failed');assert.equal(s.state.writes.length,0);}finally{s.dispose();}
});
test('Lock during pending provider prevents spawn, settles main once and preserves provider until actual completion',async()=>{
 let resolve;const pending=new Promise(yes=>{resolve=yes;});let spawns=0;const s=setup({prepareShell:()=>pending});try{await s.link.prepare(envelope());s.creator.applyGate({generation:1,open:true});const start=s.link.start({gateGeneration:1});s.creator.applyGate({generation:2,open:false});resolve({spawn:()=>{spawns++;return {};}});await assert.rejects(start);assert.equal(spawns,0);assert.equal(s.creator.stats().startup.pendingProvider,false);assert.equal(s.link.isAvailable(),false);assert.equal(s.state.mainLoss.length,1);}finally{s.dispose();}
});
test('Lock after ready keeps known work and requires new input lease after unlock',async()=>{
 const s=setup();try{await ready(s);await s.link.request({op:'install',token:token()});await s.link.request({op:'input',token:token(),inputSequence:0,data:'in-progress'});s.creator.applyGate({generation:2,open:false});assert.equal((await s.link.request({op:'input',token:token(),inputSequence:1,data:'blocked'})).status,'failed');assert.deepEqual(s.state.writes,['in-progress']);assert.equal(s.state.spawns,1);
 s.creator.applyGate({generation:3,open:true});const fresh={...token(),leaseId:'lease2',generation:2,gateGeneration:3};await s.link.request({op:'install',token:fresh});await s.link.request({op:'input',token:fresh,inputSequence:0,data:'fresh'});assert.deepEqual(s.state.writes,['in-progress','fresh']);
 }finally{s.dispose();}
});
test('captured stream callbacks remain fixed after public method replacement',async()=>{
 const s=setup();try{const original=s.a.write;s.a.write=()=>{throw Error('must use captured stream callback');};await ready(s);assert.equal(s.state.spawns,1);s.a.write=original;assert.equal(s.link.stats().retainedStartupBytes,0);}finally{s.dispose();}
});
test('failed creator ready publication cannot execute injected install/input through actual composed authority',async()=>{
 const frame=q=>{const body=Buffer.from(JSON.stringify(q)),head=Buffer.alloc(4);head.writeUInt32BE(body.length);return Buffer.concat([head,body]);};
 for(const failure of['write-throw','postwrite-budget']){
 const s=setup();try{
 await s.link.prepare(envelope());s.creator.applyGate({generation:1,open:true});let injected=false;
 s.b.onWrite=bytes=>{const q=JSON.parse(bytes.subarray(4));if(q.type!=='startup-ready')return;injected=true;
 s.b.emit('data',frame({type:'command',...scope,op:'install',requestId:1,token:token()}));s.b.emit('data',frame({type:'command',...scope,op:'input',requestId:2,token:token(),inputSequence:0,data:'must-not-run'}));
 if(failure==='write-throw')throw Error('inert ready write refusal');s.b.writableLength=90121;
 };
 const started=s.link.start({gateGeneration:1});await started.catch(()=>{});await new Promise(resolve=>setImmediate(resolve));assert.equal(injected,true);assert.deepEqual(s.state.writes,[]);assert.equal(s.link.isAvailable(),false);assert.equal(s.creator.stats().closed,true);assert.equal(s.state.spawns,1);
 }finally{s.dispose();}
 }
});
test('public dispose shadow cannot bypass the branded channel failure fence',async()=>{
 const s=setup();try{assert.equal(await s.link.authenticated,true);s.mainChannel.dispose=()=>false;s.a.emit('data',Buffer.from([0,0,0,0]));assert.equal(s.mainChannel.phase,'closed');assert.equal(s.link.isAvailable(),false);assert.equal(s.state.mainLoss.length,1);}finally{s.dispose();}
});
for(const op of['input','resize'])test('START-I1 correction: '+op+' has one endpoint query before the final lease check and none inside provider dispatch',async()=>{
 let check=()=>true;const s=setup({assertEndpointsCurrent:()=>check()});try{
 await ready(s);await s.link.request({op:'install',token:token()});let calls=0;
 check=()=>{if(++calls===2){s.creator.applyGate({generation:2,open:false});s.creator.applyGate({generation:3,open:true});}return true;};
 const request=op==='input'?{op,token:token(),inputSequence:0,data:'valid-current-lease'}:{op,token:token(),cols:110,rows:31};
 const first=await s.link.request(request);assert.equal(calls,1,'no arbitrary query after final authority check');assert.equal(first.status,'accepted');assert.equal(s.creator.stats().commands.leased,true);assert.deepEqual(s.creator.stats().gate,{generation:1,open:true});
 assert.deepEqual(s.state.writes,op==='input'?['valid-current-lease']:[]);assert.deepEqual(s.state.resizes,op==='resize'?[[110,31]]:[]);
 // Reentrancy at the sole query still occurs BEFORE CreatorCommands' final
 // lease/gate check, so a real close/reopen must refuse both operations.
 check=()=>{s.creator.applyGate({generation:2,open:false});s.creator.applyGate({generation:3,open:true});return true;};
 const second=await s.link.request(op==='input'?{...request,inputSequence:1,data:'must-not-execute'}:{...request,cols:120});assert.equal(second.status,'failed');assert.equal(s.creator.stats().commands.leased,false);
 assert.deepEqual(s.state.writes,op==='input'?['valid-current-lease']:[]);assert.deepEqual(s.state.resizes,op==='resize'?[[110,31]]:[]);
 }finally{s.dispose();}
});
