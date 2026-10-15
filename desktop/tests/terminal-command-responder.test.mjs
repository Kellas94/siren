import test from 'node:test';
import assert from 'node:assert/strict';
import {Duplex} from 'node:stream';
import {TerminalCommandChannel} from '../src/terminal/command-channel.mjs';
import {TerminalCreatorCommands} from '../src/terminal/creator-commands.mjs';
import {HostInputGate} from '../src/terminal/input-gate.mjs';
const api=await import('../src/terminal/command-responder.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const token=Object.freeze({sessionId:'session1',channelId:'commands1',projectId:'project1',windowId:'window1',epoch:1,leaseId:'lease1',generation:1,gateGeneration:1});
const request=(op,requestId,extra={})=>({type:'command',op,sessionId:token.sessionId,channelId:token.channelId,requestId,token,...extra});
const frame=value=>{const body=Buffer.from(JSON.stringify(value)),header=Buffer.alloc(4);header.writeUInt32BE(body.length);return Buffer.concat([header,body]);};
function pipes(){let a,b;const make=peer=>{const stream=new Duplex({read(){},write(bytes,encoding,done){queueMicrotask(()=>{if(!peer().destroyed)peer().push(Buffer.from(bytes));done();});},destroy(error,done){queueMicrotask(()=>{if(!peer().destroyed)peer().push(null);});done(error);}});stream.on('error',()=>{});return stream;};a=make(()=>b);b=make(()=>a);return[a,b];}
function fixture(options={}){
 const[a,b]=pipes(),scope={channelId:token.channelId,sessionId:token.sessionId,secret:Buffer.alloc(32,53),deadlineMs:100},main=new TerminalCommandChannel({stream:a,role:'main',...scope}),creator=new TerminalCommandChannel({stream:b,role:'creator',...scope}),writes=[],sizes=[],replies=[];
 const commands=new TerminalCreatorCommands({sessionId:token.sessionId,channelId:token.channelId,projectId:token.projectId,gate:new HostInputGate(),assertEndpointCurrent:()=>true,writeInput:data=>{writes.push(data);if(options.throwInput)throw Error('PRIVATE_INPUT_SECRET');},resize:(cols,rows)=>{sizes.push([cols,rows]);}});
 commands.applyGate({generation:1,open:true});main.subscribe({message:reply=>replies.push(reply),closed(){}});
 assert.equal(typeof api.createTerminalCommandResponder,'function');const dispose=options.deferResponder?null:api.createTerminalCommandResponder({channel:creator,commands});
 return{a,b,main,creator,commands,writes,sizes,replies,dispose};
}
async function ready(f){assert.equal(await f.main.ready,true);assert.equal(await f.creator.ready,true);}
async function send(f,op,requestId,extra={}){assert.equal(f.main.send(request(op,requestId,extra)),true);await tick();return f.replies.at(-1);}

test('authenticated responder composes install, input, resize and revoke with exact replies',async()=>{
 const f=fixture();await ready(f);
 const install=await send(f,'install',1);assert.deepEqual({...install,token:{...install.token}},{type:'command-result',op:'install',sessionId:token.sessionId,channelId:token.channelId,requestId:1,token:{...token},status:'accepted',code:'COMMAND_ACCEPTED'});
 assert.equal((await send(f,'input',2,{inputSequence:0,data:'AΩ😀'})).status,'accepted');
 assert.equal((await send(f,'resize',7,{cols:100,rows:30})).requestId,7);
 assert.equal((await send(f,'revoke',8)).code,'COMMAND_ACCEPTED');assert.equal((await send(f,'input',9,{inputSequence:1,data:'late'})).code,'LEASE_STALE');
 assert.deepEqual(f.writes,['AΩ😀']);assert.deepEqual(f.sizes,[[100,30]]);assert.ok(Object.isFrozen(f.replies[0].token));f.dispose();
});
test('known input and resize receipts produce replies with zero duplicate provider calls',async()=>{
 const f=fixture();await ready(f);await send(f,'install',1);
 for(const id of[2,3])assert.equal((await send(f,'input',id,{inputSequence:0,data:'once'})).code,'COMMAND_ACCEPTED');
 for(let n=0;n<2;n++)assert.equal((await send(f,'resize',7,{cols:80,rows:24})).code,'COMMAND_ACCEPTED');
 assert.deepEqual(f.writes,['once']);assert.deepEqual(f.sizes,[[80,24]]);assert.equal(f.replies[2].requestId,3);f.dispose();
});
test('conflicting duplicate input or resize is refused without another side effect',async()=>{
 const f=fixture();await ready(f);await send(f,'install',1);await send(f,'input',2,{inputSequence:0,data:'original'});
 assert.equal((await send(f,'input',3,{inputSequence:0,data:'changed'})).code,'REQUEST_REFUSED');await send(f,'resize',7,{cols:80,rows:24});
 assert.equal((await send(f,'resize',7,{cols:81,rows:24})).code,'REQUEST_REFUSED');assert.deepEqual(f.writes,['original']);assert.deepEqual(f.sizes,[[80,24]]);f.dispose();
});
test('queued input fenced by Lock or lease replacement cannot reach the provider',async()=>{
 for(const change of['lock','replace']){const f=fixture();await ready(f);await send(f,'install',1);assert.equal(f.main.send(request('input',2,{inputSequence:0,data:'queued'})),true);
  if(change==='lock')f.commands.applyGate({generation:2,open:false});else assert.equal(f.commands.installLease({...token,leaseId:'fresh',generation:2}).ok,true);
  await tick();assert.equal(f.replies.at(-1).status,'failed');assert.equal(f.replies.at(-1).code,'LEASE_STALE');assert.deepEqual(f.writes,[]);f.dispose();
 }
});
test('ambiguous provider throw remains fenced and is never retried by the responder',async()=>{
 const f=fixture({throwInput:true});await ready(f);await send(f,'install',1);
 for(const id of[2,3])assert.equal((await send(f,'input',id,{inputSequence:0,data:'once'})).code,'COMMAND_AMBIGUOUS');
 assert.deepEqual(f.writes,['once']);assert.equal(f.commands.stats().retired,true);assert.equal(JSON.stringify(f.replies).includes('PRIVATE_INPUT_SECRET'),false);f.dispose();
});
test('EOF, disposal and late queued command frames synchronously retire authority',async()=>{
 for(const mode of['end','dispose']){const f=fixture();await ready(f);await send(f,'install',1);assert.equal(f.main.send(request('input',2,{inputSequence:0,data:'queued'})),true);
  if(mode==='end')f.b.emit('end');else{f.dispose();f.dispose();}
  assert.equal(f.commands.stats().retired,true);assert.equal(f.creator.isAvailable(),false);
  f.b.emit('data',frame({...request('input',3,{inputSequence:0}),dataBase64:'bGF0ZQ=='}));await tick();assert.deepEqual(f.writes,[]);assert.deepEqual(f.sizes,[]);f.dispose();
 }
});
test('reply send failure synchronously retires authority after known void acceptance',async()=>{
 const f=fixture();await ready(f);await send(f,'install',1);f.b._writableState.length=90121;
 f.b.emit('data',frame({...request('input',2,{inputSequence:0}),dataBase64:'eA=='}));
 assert.deepEqual(f.writes,['x']);assert.equal(f.commands.stats().retired,true);assert.equal(f.creator.isAvailable(),false);assert.equal(f.replies.length,1);
 f.b._writableState.length=0;f.dispose();await tick();assert.equal(f.writes.length,1);
});
test('options, wrong brands, Proxies and accessors refuse without executing traps',async()=>{
 assert.equal(typeof api.createTerminalCommandResponder,'function');const[a,b]=pipes(),channel=new TerminalCommandChannel({stream:b,role:'creator',channelId:token.channelId,sessionId:token.sessionId,secret:Buffer.alloc(32,53),deadlineMs:100}),commands=new TerminalCreatorCommands({sessionId:token.sessionId,channelId:token.channelId,projectId:token.projectId,gate:new HostInputGate(),assertEndpointCurrent:()=>true,writeInput(){},resize(){}});
 let touched=0;const trap={get(){touched++;throw Error('private');},getPrototypeOf(){touched++;throw Error('private');},ownKeys(){touched++;throw Error('private');}};
 const getter={commands};Object.defineProperty(getter,'channel',{enumerable:true,get(){touched++;return channel;}});
 for(const options of[getter,new Proxy({channel,commands},trap),{channel:new Proxy(channel,trap),commands},{channel,commands:new Proxy(commands,trap)},{channel:Object.create(TerminalCommandChannel.prototype),commands},{channel,commands:Object.create(TerminalCreatorCommands.prototype)},{channel,commands,handler(){}}])assert.throws(()=>api.createTerminalCommandResponder(options),TypeError);
 const main=new TerminalCommandChannel({stream:a,role:'main',channelId:token.channelId,sessionId:token.sessionId,secret:Buffer.alloc(32,53),deadlineMs:100});assert.throws(()=>api.createTerminalCommandResponder({channel:main,commands}),TypeError);assert.equal(touched,0);main.dispose();channel.dispose();commands.retire();
});
test('original branded methods bypass poisoned instance and later prototype handlers',async()=>{
 const f=fixture({deferResponder:true});let touched=0;const own=[['commands',['installLease','revokeLease','input','resize','retire','stats']],['creator',['subscribe','send','dispose','identity']]];
 for(const [name,keys]of own)for(const key of keys)Object.defineProperty(f[name],key,{configurable:true,get(){touched++;throw Error('private');}});
 const saved=Object.getOwnPropertyDescriptor(TerminalCreatorCommands.prototype,'input');Object.defineProperty(TerminalCreatorCommands.prototype,'input',{configurable:true,get(){touched++;throw Error('private');}});
 try{f.dispose=api.createTerminalCommandResponder({channel:f.creator,commands:f.commands});await ready(f);await send(f,'install',1);assert.equal((await send(f,'input',2,{inputSequence:0,data:'real'})).code,'COMMAND_ACCEPTED');f.dispose();assert.deepEqual(f.writes,['real']);assert.equal(touched,0);}
 finally{Object.defineProperty(TerminalCreatorCommands.prototype,'input',saved);for(const[name,keys]of own)for(const key of keys)delete f[name][key];f.dispose();}
});
