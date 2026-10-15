// Pure transaction tests. Every shell callback below is inert; no child/native load.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {encodeStartupEnvelope,encodeStartupRequest,validateStartupReply} from '../src/terminal/startup-protocol.mjs';
const api=await import('../src/terminal/creator-startup.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const scope={sessionId:'session1',channelId:'channel1'};
const image='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const common=b=>({version:b.version,...scope,startupId:b.startupId,sha256:b.sha256});
function envelope(){return {version:1,...scope,projectId:'project1',startupId:'startup1',admissionEpoch:4,profileId:'powershell',cwd:'C:\\Work Ω\\project',shell:{executable:image,args:['-NoLogo','-NoProfile'],env:{PATH:'C:\\Windows\\System32',SystemRoot:'C:\\Windows',CUSTOM:'private-value'}},cols:100,rows:30};}
function packets(e=envelope()){
 const encoded=encodeStartupEnvelope(e);assert.ok(encoded);
 const begin=encodeStartupRequest({type:'startup-begin',version:1,...scope,startupId:e.startupId,totalBytes:encoded.totalBytes,chunkCount:encoded.chunkCount,sha256:encoded.sha256},scope);
 const chunks=Array.from({length:encoded.chunkCount},(_,index)=>encodeStartupRequest({...begin,type:'startup-chunk',index,data:encoded.bytes.subarray(index*16384,Math.min(encoded.totalBytes,(index+1)*16384))},begin));
 const seal=encodeStartupRequest({type:'startup-seal',...common(begin)},begin);
 const start=encodeStartupRequest({type:'startup-start',...common(begin),gateGeneration:1},begin);
 encoded.dispose();return {begin,chunks,seal,start};
}
function setup(overrides={}){
 assert.equal(typeof api.TerminalCreatorStartup,'function','TerminalCreatorStartup export must exist');
 const state={gate:{generation:0,open:false},prepares:0,spawns:0,writes:[],resizes:[],events:[],configuration:null};
 const result=()=>({reportedShell:{pid:1234,image},writeInput:data=>{state.writes.push(data);},resize:(cols,rows)=>{state.resizes.push([cols,rows]);}});
 const options={...scope,readGate:()=>state.gate,assertEndpointsCurrent:()=>true,prepareShell:config=>{state.prepares++;state.configuration=config;return Promise.resolve({spawn:()=>{state.spawns++;return result();}});},onUnavailable:code=>{state.events.push(code);},...overrides};
 const owner=new api.TerminalCreatorStartup(options);return {owner,state,options,result};
}
async function prepared(owner,p=packets()){
 assert.equal((await owner.handle(p.begin)).type,'startup-begin-ack');
 for(const q of p.chunks)assert.equal((await owner.handle(q)).type,'startup-chunk-ack');
 const reply=await owner.handle(p.seal);assert.equal(reply.type,'startup-prepared');assert.ok(validateStartupReply(reply,p.seal));return p;
}
test('startup consumes validated bytes before one-use spawn and returns only unverified PID/image',async()=>{
 const {owner,state}=setup();try{
 const p=await prepared(owner);assert.equal(state.prepares,0);assert.equal(state.spawns,0);assert.equal(owner.stats().rawReservedBytes,0);
 state.gate={generation:1,open:true};const ready=await owner.handle(p.start);assert.equal(ready.type,'startup-ready');assert.ok(validateStartupReply(ready,p.start));assert.deepEqual({...ready.reportedShell},{pid:1234,image});
 assert.equal(state.prepares,1);assert.equal(state.spawns,1);assert.deepEqual(state.configuration.shell.args,['-NoLogo','-NoProfile']);assert.equal(state.configuration.cwd,envelope().cwd);assert.ok(Object.isFrozen(state.configuration.shell.env));
 const again=await owner.handle(p.start);assert.equal(again.type,'startup-failed');assert.equal(again.code,'STARTUP_ORDER_REFUSED');assert.equal(state.spawns,1);
 }finally{owner.dispose();}
});
test('closed or wrong generation gate refuses start before provider import',async()=>{
 for(const gate of [{generation:0,open:false},{generation:2,open:true}]){
 const {owner,state}=setup();try{const p=await prepared(owner);state.gate=gate;const reply=await owner.handle(p.start);assert.equal(reply.code,'STARTUP_GATE_CLOSED');assert.equal(state.prepares,0);assert.equal(state.spawns,0);}finally{owner.dispose();}
 }
});
test('seal must observe actual initially closed gate',async()=>{
 const {owner,state}=setup();try{const p=packets();await owner.handle(p.begin);for(const q of p.chunks)await owner.handle(q);state.gate={generation:1,open:true};const reply=await owner.handle(p.seal);assert.equal(reply.code,'STARTUP_GATE_CLOSED');assert.equal(owner.stats().rawReservedBytes,0);assert.equal(state.prepares,0);}finally{owner.dispose();}
});
test('chunks are contiguous and duplicate or out-of-order permanently retires assembly',async()=>{
 const e=envelope();e.shell.env.CUSTOM='x'.repeat(32768);const p=packets(e);assert.ok(p.chunks.length>1);
 for(const sequence of [[p.chunks[1]],[p.chunks[0],p.chunks[0]]]){
 const {owner,state}=setup();try{await owner.handle(p.begin);let reply;for(const q of sequence)reply=await owner.handle(q);assert.equal(reply.code,'STARTUP_ORDER_REFUSED');assert.equal(owner.stats().rawReservedBytes,0);assert.equal(owner.stats().retired,true);assert.equal(state.prepares,0);}finally{owner.dispose();}
 }
});
test('bad digest and incomplete seal retire without exposing environment values',async()=>{
 for(const mutate of [false,true]){
 const {owner,state}=setup();try{const p=packets();await owner.handle(p.begin);if(mutate){const q={...p.chunks[0],dataBase64:Buffer.alloc(Buffer.from(p.chunks[0].dataBase64,'base64').length,65).toString('base64')};await owner.handle(q);}
 const reply=await owner.handle(p.seal);assert.equal(reply.type,'startup-failed');assert.equal(reply.code,mutate?'STARTUP_HASH_REFUSED':'STARTUP_ORDER_REFUSED');assert.equal(owner.stats().rawReservedBytes,0);assert.equal(state.spawns,0);assert.ok(!JSON.stringify(owner.stats()).includes('private-value'));
 }finally{owner.dispose();}
 }
});
test('late provider resolution after Lock never invokes spawn or revives startup',async()=>{
 let resolve;const pending=new Promise(yes=>{resolve=yes;});const {owner,state}=setup({prepareShell:()=>pending});try{
 const p=await prepared(owner);state.gate={generation:1,open:true};const ready=owner.handle(p.start);assert.equal(owner.stats().pendingProvider,true);state.gate={generation:2,open:false};let spawns=0;resolve({spawn:()=>{spawns++;return {};}});
 assert.equal((await ready).code,'STARTUP_GATE_CLOSED');assert.equal(spawns,0);assert.equal(owner.stats().pendingProvider,false);assert.equal(owner.stats().retired,true);
 }finally{owner.dispose();}
});
test('absolute deadline settles startup but retains pending provider reservation until actual settlement',async()=>{
 let resolve;const pending=new Promise(yes=>{resolve=yes;});const {owner,state}=setup({deadlineMs:25,prepareShell:()=>pending});try{
 const p=await prepared(owner);state.gate={generation:1,open:true};const reply=await owner.handle(p.start);assert.equal(reply.code,'STARTUP_TIMEOUT');assert.equal(owner.stats().pendingProvider,true);assert.equal(owner.stats().spawnAttempts,0);assert.equal(owner.stats().retired,true);
 assert.equal((await owner.handle(p.start)).code,'STARTUP_TIMEOUT');resolve({spawn:()=>{throw Error('must not run');}});await delay(0);assert.equal(owner.stats().pendingProvider,false);assert.equal(owner.stats().spawnAttempts,0);
 }finally{owner.dispose();}
});
test('endpoint reentrancy disposal is checked again immediately before spawn',async()=>{
 let owner,checks=0,spawns=0;const s=setup({assertEndpointsCurrent:()=>{checks++;if(checks===3)owner.dispose();return true;},prepareShell:()=>Promise.resolve({spawn:()=>{spawns++;return {};}})});owner=s.owner;
 try{const p=await prepared(owner);s.state.gate={generation:1,open:true};const reply=await owner.handle(p.start);assert.equal(reply.type,'startup-failed');assert.equal(spawns,0);}finally{owner.dispose();}
});
test('one pending start accepts no second provider reservation',async()=>{
 let resolve,prepares=0;const pending=new Promise(yes=>{resolve=yes;});const {owner,state,result}=setup({prepareShell:()=>{prepares++;return pending;}});try{
 const p=await prepared(owner);state.gate={generation:1,open:true};const first=owner.handle(p.start);const second=await owner.handle(p.start);assert.equal(second.code,'STARTUP_BUSY');assert.equal(prepares,1);resolve({spawn:()=>result()});assert.equal((await first).type,'startup-ready');assert.equal(prepares,1);
 }finally{owner.dispose();}
});
test('spawn side effect followed by throw is ambiguous and cannot be retried',async()=>{
 let effects=0;const {owner,state}=setup({prepareShell:()=>Promise.resolve({spawn:()=>{effects++;throw Error('private-value');}})});try{
 const p=await prepared(owner);state.gate={generation:1,open:true};const reply=await owner.handle(p.start);assert.equal(reply.code,'STARTUP_AMBIGUOUS');assert.equal(owner.stats().unknownSpawn,true);assert.equal(owner.stats().spawnAttempts,1);await owner.handle(p.start);assert.equal(effects,1);assert.deepEqual(state.events,['STARTUP_AMBIGUOUS']);assert.ok(!JSON.stringify(reply).includes('private-value'));
 }finally{owner.dispose();}
});
test('reported different image is refused and keeps ambiguous spawn reservation',async()=>{
 const {owner,state,result}=setup();try{const p=await prepared(owner);state.gate={generation:1,open:true};owner.dispose();assert.equal(owner.stats().retired,true);}finally{owner.dispose();}
 const s=setup({prepareShell:()=>Promise.resolve({spawn:()=>({...result(),reportedShell:{pid:1234,image:'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'}})})});try{const p=await prepared(s.owner);s.state.gate={generation:1,open:true};assert.equal((await s.owner.handle(p.start)).code,'STARTUP_AMBIGUOUS');assert.equal(s.owner.stats().unknownSpawn,true);}finally{s.owner.dispose();}
});
test('non-DATA dependencies, gate results and provider outcomes never execute getters or Proxy traps',async()=>{
 let traps=0;const hostile=new Proxy({}, {get(){traps++;throw Error('private-value');},getPrototypeOf(){traps++;throw Error();},ownKeys(){traps++;throw Error();}});
 assert.throws(()=>new api.TerminalCreatorStartup(hostile),/startup/i);assert.throws(()=>new api.TerminalCreatorStartup(Object.create(hostile)),/startup/i);
 for(const overrides of [{readGate:()=>hostile},{prepareShell:()=>hostile},{prepareShell:()=>Promise.resolve({spawn:hostile})}]){
 const {owner,state}=setup(overrides);try{const p=packets();await owner.handle(p.begin);for(const q of p.chunks)await owner.handle(q);const seal=await owner.handle(p.seal);if(seal.type==='startup-prepared'){state.gate={generation:1,open:true};assert.equal((await owner.handle(p.start)).type,'startup-failed');}else assert.equal(seal.type,'startup-failed');}finally{owner.dispose();}
 }
 assert.equal(traps,0);
});
test('malformed unbound packet retires with fixed local error and no forged response',async()=>{
 const {owner,state}=setup();try{let traps=0;const bad=new Proxy({}, {get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}});await assert.rejects(owner.handle(bad),/^Error: STARTUP_UNAVAILABLE$/);assert.equal(traps,0);assert.equal(owner.stats().retired,true);assert.equal(state.prepares,0);}finally{owner.dispose();}
});
test('unavailable notification precedes pending result and reentrancy cannot revive',async()=>{
 let owner,resolve;const events=[],pending=new Promise(yes=>{resolve=yes;});const s=setup({prepareShell:()=>pending,onUnavailable:code=>{events.push(code);owner.dispose();throw Error('private-value');}});owner=s.owner;try{
 const p=await prepared(owner);s.state.gate={generation:1,open:true};const reply=owner.handle(p.start).then(r=>{events.push('settled');return r;});owner.dispose();assert.equal((await reply).code,'STARTUP_RETIRED');assert.deepEqual(events,['STARTUP_RETIRED','settled']);assert.equal(owner.stats().pendingProvider,true);resolve({spawn:()=>{throw Error();}});await delay(0);assert.equal(owner.stats().pendingProvider,false);
 }finally{owner.dispose();}
});
test('trusted ready callbacks contain no control queries after authority validation and retain private retirement guard',async()=>{
 let endpointQueries=0,gateQueries=0;const s=setup({assertEndpointsCurrent:()=>{endpointQueries++;return true;},readGate:()=>{gateQueries++;return s.state.gate;}});const {owner,state}=s;try{const p=await prepared(owner);assert.equal(owner.commandCallbacks(),null);state.gate={generation:1,open:true};await owner.handle(p.start);const callbacks=owner.commandCallbacks();assert.ok(Object.isFrozen(callbacks));const before=[endpointQueries,gateQueries];callbacks.writeInput('print(1)');callbacks.resize(90,25);assert.deepEqual(state.writes,['print(1)']);assert.deepEqual([endpointQueries,gateQueries],before);
 // These are private trusted glue callbacks, not an alternate input API.
 // Actual CreatorSession/CreatorCommands tests retain Lock/lease enforcement.
 owner.dispose();assert.throws(()=>callbacks.writeInput('no'),/STARTUP_UNAVAILABLE/);assert.throws(()=>callbacks.resize(90,25),/STARTUP_UNAVAILABLE/);assert.deepEqual(state.writes,['print(1)']);assert.equal(state.spawns,1);
 }finally{owner.dispose();}
});
test('assembly allocation crossing absolute deadline cannot publish an accepted begin ACK',async()=>{
 const original=Buffer.alloc;let fresh;
 try{
  Buffer.alloc=function(n){const until=performance.now()+55;while(performance.now()<until){}return Reflect.apply(original,Buffer,[n]);};
  fresh=await import('../src/terminal/creator-startup.mjs?delayed-owned-allocation');
 }finally{Buffer.alloc=original;}
 const s=setup();s.owner.dispose();const owner=new fresh.TerminalCreatorStartup({...s.options,deadlineMs:30});
 try{const reply=await owner.handle(packets().begin);assert.equal(reply.type,'startup-failed');assert.equal(reply.code,'STARTUP_TIMEOUT');assert.equal(owner.stats().rawReservedBytes,0);}finally{owner.dispose();}
});
test('all 64 owned chunks assemble exactly 1 MiB and are wiped before prepared publication',async()=>{
 const e=envelope();e.shell.env={PATH:'x',SystemRoot:'C:\\Windows'};for(let i=0;i<6;i++)e.shell.env['PAD_'+i]='';
 const base=encodeStartupEnvelope(e),delta=1048576-base.totalBytes;base.dispose();let remaining=Math.floor(delta/6);
 for(let i=0;i<6;i++){const n=Math.min(32768,remaining);e.shell.env['PAD_'+i]='\u0001'.repeat(n);remaining-=n;}e.shell.env.PAD_5+='x'.repeat(delta%6);assert.equal(remaining,0);
 const p=packets(e);assert.equal(p.begin.totalBytes,1048576);assert.equal(p.chunks.length,64);const {owner,state}=setup();try{
 await owner.handle(p.begin);assert.equal(owner.stats().rawReservedBytes,1048576);for(const q of p.chunks)assert.equal((await owner.handle(q)).type,'startup-chunk-ack');assert.equal(owner.stats().receivedBytes,1048576);
 assert.equal((await owner.handle(p.seal)).type,'startup-prepared');assert.equal(owner.stats().rawReservedBytes,0);assert.equal(state.prepares,0);
 }finally{owner.dispose();}
});
test('synchronous spawn over deadline retains unknown shell even when a plausible result is returned',async()=>{
 let result;const s=setup({deadlineMs:30,prepareShell:()=>Promise.resolve({spawn:()=>{const until=performance.now()+55;while(performance.now()<until){}return result();}})});result=s.result;
 try{const p=await prepared(s.owner);s.state.gate={generation:1,open:true};const reply=await s.owner.handle(p.start);assert.equal(reply.code,'STARTUP_TIMEOUT');assert.equal(s.owner.stats().unknownSpawn,true);assert.equal(s.owner.stats().spawnAttempts,1);assert.equal(s.owner.commandCallbacks(),null);}finally{s.owner.dispose();}
});
test('Lock reentered inside a synchronous spawn keeps unknown shell for external cleanup',async()=>{
 let result,state;const s=setup({prepareShell:()=>Promise.resolve({spawn:()=>{state.gate={generation:2,open:false};return result();}})});result=s.result;state=s.state;
 try{const p=await prepared(s.owner);state.gate={generation:1,open:true};assert.equal((await s.owner.handle(p.start)).code,'STARTUP_GATE_CLOSED');assert.equal(s.owner.stats().unknownSpawn,true);assert.equal(s.owner.commandCallbacks(),null);}finally{s.owner.dispose();}
});
