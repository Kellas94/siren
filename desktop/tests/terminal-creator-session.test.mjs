// Actual pure modules over an inert synchronous connected lane. No PTY/child.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {TerminalSessionCommandChannel} from '../src/terminal/session-command-channel.mjs';
import {encodeStartupEnvelope} from '../src/terminal/startup-protocol.mjs';
const api=await import('../src/terminal/creator-session.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const scope={sessionId:'session1',channelId:'channel1'};
const image='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const env=()=>({version:1,...scope,projectId:'project1',startupId:'startup1',admissionEpoch:4,profileId:'powershell',cwd:'C:\\Work',shell:{executable:image,args:['-NoLogo','-NoProfile'],env:{PATH:'C:\\Windows',SystemRoot:'C:\\Windows'}},cols:80,rows:24});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(overrides={},onReply){
 assert.equal(typeof api.TerminalCreatorSession,'function');const a=new EventEmitter(),b=new EventEmitter();
 for(const [s,p]of[[a,b],[b,a]]){s.writableLength=0;s.write=data=>{p.emit('data',Buffer.from(data));return true;};s.destroy=()=>{if(s.dead)return;s.dead=true;s.emit('close');queueMicrotask(()=>p.emit('end'));};}
 const secret=Buffer.alloc(32,42),creator=new TerminalSessionCommandChannel({stream:b,...scope,role:'creator',secret}),main=new TerminalSessionCommandChannel({stream:a,...scope,role:'main',secret});
 const state={spawns:0,writes:[],resizes:[],notifications:[],replies:[],queue:[],prepares:0};
 const session=new api.TerminalCreatorSession({channel:creator,assertEndpointsCurrent:()=>true,prepareShell:()=>{state.prepares++;return Promise.resolve({spawn:()=>{state.spawns++;return {reportedShell:{pid:42,image},writeInput:data=>{state.writes.push(data);},resize:(cols,rows)=>{state.resizes.push([cols,rows]);}};}});},onUnavailable:code=>state.notifications.push(code),...overrides});
 main.subscribe({message:q=>{state.replies.push(q);const pending=state.queue.shift();pending?.(q);onReply?.(q,{main,session,state});},closed:()=>{while(state.queue.length)state.queue.shift()(null);}});
 const exchange=q=>new Promise(resolve=>{state.queue.push(resolve);if(main.send(q)!==true){state.queue.splice(state.queue.indexOf(resolve),1);resolve(null);}});
 const dispose=()=>{session.dispose();main.dispose();creator.dispose();};return{main,creator,session,state,exchange,dispose};
}
function startupPackets(){const e=env(),r=encodeStartupEnvelope(e);const begin={type:'startup-begin',version:1,...scope,startupId:e.startupId,totalBytes:r.totalBytes,chunkCount:r.chunkCount,sha256:r.sha256};const common={version:1,...scope,startupId:e.startupId,sha256:r.sha256};const data=Buffer.from(r.bytes);r.dispose();return {begin,chunk:{...begin,type:'startup-chunk',index:0,data},seal:{type:'startup-seal',...common},start:{type:'startup-start',...common,gateGeneration:1}};}
async function ready(s){assert.equal(await s.main.authenticated,true);const p=startupPackets();for(const q of[p.begin,p.chunk,p.seal])assert.ok(await s.exchange(q));p.chunk.data.fill(0);assert.equal(s.session.applyGate({generation:1,open:true}).ok,true);assert.equal((await s.exchange(p.start)).type,'startup-ready');return p;}
const token=()=>({...scope,projectId:'project1',windowId:'window1',epoch:4,leaseId:'lease1',generation:1,gateGeneration:1});
const command=(op,requestId,extra={},t=token())=>({type:'command',...scope,op,requestId,token:t,...extra});

test('one creator subscriber completes startup, installs lease, writes and resizes through actual pure authority',async()=>{
 const s=setup();try{await ready(s);assert.equal(s.state.spawns,1);assert.equal(s.session.stats().commandsCreated,true);assert.equal((await s.exchange(command('install',1))).status,'accepted');assert.equal((await s.exchange(command('input',2,{inputSequence:0,data:'print(1)'}))).status,'accepted');assert.equal((await s.exchange(command('resize',3,{cols:100,rows:35}))).status,'accepted');assert.deepEqual(s.state.writes,['print(1)']);assert.deepEqual(s.state.resizes,[[100,35]]);assert.equal(s.session.nativeExecutionAdmitted,false);}finally{s.dispose();}
});
test('authority exists before synchronous ready delivery and first command has no handoff gap',async()=>{
 const s=setup({},(q,{main})=>{if(q.type==='startup-ready')assert.equal(main.send(command('install',1)),true);});try{await ready(s);await tick();assert.equal(s.state.replies.at(-1).type,'command-result');assert.equal(s.state.replies.at(-1).status,'accepted');assert.equal(s.session.stats().closed,false);}finally{s.dispose();}
});
test('Lock revokes old lease without stopping shell and unlock requires a new lease generation',async()=>{
 const s=setup();try{await ready(s);await s.exchange(command('install',1));await s.exchange(command('input',2,{inputSequence:0,data:'already-running'}));assert.equal(s.session.applyGate({generation:2,open:false}).ok,true);
 assert.equal((await s.exchange(command('input',3,{inputSequence:1,data:'blocked'}))).status,'failed');assert.deepEqual(s.state.writes,['already-running']);assert.equal(s.state.spawns,1);assert.equal(s.session.applyGate({generation:3,open:true}).ok,true);
 assert.equal((await s.exchange(command('install',4))).code,'LEASE_STALE');const fresh={...token(),leaseId:'lease2',generation:2,gateGeneration:3};assert.equal((await s.exchange(command('install',5,{},fresh))).status,'accepted');assert.equal((await s.exchange(command('input',6,{inputSequence:0,data:'new-work'},fresh))).status,'accepted');assert.deepEqual(s.state.writes,['already-running','new-work']);
 }finally{s.dispose();}
});
test('channel loss synchronously fences commands and late provider cannot spawn',async()=>{
 let resolve;const promise=new Promise(yes=>{resolve=yes;});const s=setup({prepareShell:()=>promise});try{
 assert.equal(await s.main.authenticated,true);const p=startupPackets();for(const q of[p.begin,p.chunk,p.seal])await s.exchange(q);s.session.applyGate({generation:1,open:true});const pending=s.exchange(p.start);s.main.dispose();await pending;let spawns=0;resolve({spawn:()=>{spawns++;return {};}});await tick();assert.equal(spawns,0);assert.equal(s.session.stats().closed,true);assert.equal(s.session.stats().startup.pendingProvider,false);assert.deepEqual(s.state.notifications,['STARTUP_UNAVAILABLE']);
 }finally{s.dispose();}
});
test('strict branded constructor and gate DATA ignore Proxy and accessor traps',async()=>{
 let traps=0;const hostile=new Proxy({}, {get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();},ownKeys(){traps++;throw Error();}});assert.throws(()=>new api.TerminalCreatorSession(hostile),/creator session/i);
 const s=setup();try{assert.equal(s.session.applyGate(hostile).ok,false);const q={generation:1,open:true};Object.defineProperty(q,'open',{enumerable:true,get(){traps++;return true;}});assert.equal(s.session.applyGate(q).ok,false);assert.equal(traps,0);assert.equal(s.state.spawns,0);}finally{s.dispose();}
});
test('forged project token fails without provider side effect',async()=>{
 const s=setup();try{await ready(s);const forged={...token(),projectId:'foreign'};assert.equal((await s.exchange(command('install',1,{},forged))).code,'SESSION_REFUSED');assert.equal((await s.exchange(command('input',2,{inputSequence:0,data:'no'},forged))).status,'failed');assert.equal(s.state.writes.length,0);}finally{s.dispose();}
});
test('duplicate input is a known receipt with no second provider write',async()=>{
 const s=setup();try{await ready(s);await s.exchange(command('install',1));assert.equal((await s.exchange(command('input',2,{inputSequence:0,data:'once'}))).status,'accepted');assert.equal((await s.exchange(command('input',3,{inputSequence:0,data:'once'}))).status,'accepted');assert.deepEqual(s.state.writes,['once']);}finally{s.dispose();}
});
test('ambiguous provider effect retires creator before another command',async()=>{
 let effects=0;const s=setup({prepareShell:()=>Promise.resolve({spawn:()=>({reportedShell:{pid:42,image},writeInput:()=>{effects++;throw Error('private-value');},resize:()=>{}})})});try{await ready(s);await s.exchange(command('install',1));await s.exchange(command('input',2,{inputSequence:0,data:'effect'}));await tick();assert.equal(effects,1);assert.equal(s.session.stats().closed,true);assert.equal(s.state.notifications.length,1);assert.ok(!JSON.stringify(s.state.notifications).includes('private-value'));assert.equal(s.main.send(command('input',3,{inputSequence:0,data:'effect'})),false);}finally{s.dispose();}
});
