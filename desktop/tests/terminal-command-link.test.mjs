import test from 'node:test';
import assert from 'node:assert/strict';
import {Duplex} from 'node:stream';
import {performance} from 'node:perf_hooks';
import {TerminalCommandChannel} from '../src/terminal/command-channel.mjs';
import {TerminalCreatorCommands} from '../src/terminal/creator-commands.mjs';
import {createTerminalCommandResponder} from '../src/terminal/command-responder.mjs';
import {HostInputGate} from '../src/terminal/input-gate.mjs';
const api=await import('../src/terminal/command-link.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const token=Object.freeze({sessionId:'session1',channelId:'commands1',projectId:'project1',windowId:'window1',epoch:1,leaseId:'lease1',generation:1,gateGeneration:1});
const request=(op='install',extra={})=>({op,token,...extra});
const reply=(extra={})=>({type:'command-result',op:'install',channelId:token.channelId,sessionId:token.sessionId,requestId:1,token,status:'accepted',code:'COMMAND_ACCEPTED',...extra});
const frame=value=>{const body=Buffer.from(JSON.stringify(value)),header=Buffer.alloc(4);header.writeUInt32BE(body.length);return Buffer.concat([header,body]);};
function pipes(){
 let a,b;const make=peer=>{const stream=new Duplex({read(){},write(bytes,encoding,done){stream.writeCalls++;if(stream.mode==='hold'){stream.held={bytes:Buffer.from(bytes),done};return;}queueMicrotask(()=>{if(!peer().destroyed)peer().push(Buffer.from(bytes));done();});},destroy(error,done){queueMicrotask(()=>{if(!peer().destroyed)peer().push(null);});done(error);}});stream.writeCalls=0;stream.flush=()=>{const held=stream.held;stream.held=null;if(held){if(!peer().destroyed)peer().push(held.bytes);held.done();}};stream.on('error',()=>{});return stream;};a=make(()=>b);b=make(()=>a);return[a,b];
}
function fixture(options={}){
 assert.equal(typeof api.TerminalCommandLink,'function');const[a,b]=pipes(),scope={channelId:token.channelId,sessionId:token.sessionId,secret:Buffer.alloc(32,61),deadlineMs:100},main=new TerminalCommandChannel({stream:a,role:'main',...scope}),creator=new TerminalCommandChannel({stream:b,role:'creator',...scope}),writes=[],sizes=[],events=[];
 const commands=new TerminalCreatorCommands({sessionId:token.sessionId,channelId:token.channelId,projectId:token.projectId,gate:new HostInputGate(),assertEndpointCurrent:()=>options.endpointCurrent!==false,writeInput:data=>{writes.push(data);if(options.throwInput)throw Error('PRIVATE_COMMAND_SECRET');},resize:(cols,rows)=>{sizes.push([cols,rows]);}});
 commands.applyGate({generation:1,open:true});const disposeResponder=createTerminalCommandResponder({channel:creator,commands});
 const opts={channel:main,onUnavailable(){events.push('unavailable');if(options.throwUnavailable)throw Error('PRIVATE_CALLBACK_SECRET');},deadlineMs:options.deadlineMs??100};
 const link=options.deferLink?null:new api.TerminalCommandLink(opts);return{a,b,main,creator,commands,writes,sizes,events,opts,link,disposeResponder};
}
async function ready(f){assert.equal(await f.link.ready,true);assert.equal(await f.creator.ready,true);assert.equal(f.link.isAvailable(),true);}
function cleanup(f){f.link?.dispose();f.disposeResponder();f.a.flush();f.b.flush();}
const unavailable=error=>error.message==='COMMAND_UNAVAILABLE';

test('main link composes install/input/resize/revoke with monotonic request IDs and exact replies',async()=>{
 const f=fixture();await ready(f);const results=[];
 for(const q of[request(),request('input',{inputSequence:0,data:'AΩ😀'}),request('resize',{cols:100,rows:30}),request('revoke'),request('input',{inputSequence:1,data:'late'})])results.push(await f.link.request(q));
 assert.deepEqual(results.map(r=>r.requestId),[1,2,3,4,5]);assert.deepEqual(results.map(r=>r.code),['COMMAND_ACCEPTED','COMMAND_ACCEPTED','COMMAND_ACCEPTED','COMMAND_ACCEPTED','LEASE_STALE']);
 assert.deepEqual({...results[0],token:{...results[0].token}},reply({token:{...token}}));assert.ok(Object.isFrozen(results[0])&&Object.isFrozen(results[0].token));
 assert.deepEqual(f.writes,['AΩ😀']);assert.deepEqual(f.sizes,[[100,30]]);assert.equal(f.link.stats().retainedRequestSlots,0);assert.equal(f.link.isAvailable(),true);cleanup(f);
});
test('before-ready and invalid local requests refuse without dispatch or request IDs',async()=>{
 const f=fixture();assert.equal(f.link.isAvailable(),false);await assert.rejects(f.link.request(request()),unavailable);await ready(f);const before=f.a.writeCalls;
 for(const q of[request('shell'),request('input',{inputSequence:0,data:'\ud800'}),request('resize',{cols:1,rows:24}),{...request(),requestId:99}])await assert.rejects(f.link.request(q),error=>error.message==='COMMAND_REFUSED');
 assert.equal(f.a.writeCalls,before);assert.equal(f.link.stats().lastRequestId,0);assert.equal(f.link.stats().retainedRequestSlots,0);assert.equal((await f.link.request(request())).requestId,1);cleanup(f);
});
test('one pending request bounds busy callers and admits no application queue',async()=>{
 const f=fixture();await ready(f);f.a.mode='hold';const before=f.a.writeCalls,pending=f.link.request(request());assert.equal(f.link.stats().pendingRequests,1);
 for(let n=0;n<20;n++)await assert.rejects(f.link.request(request()),error=>error.message==='COMMAND_BUSY');
 assert.equal(f.a.writeCalls,before+1);assert.equal(f.link.stats().retainedRequestSlots,1);assert.equal(f.link.stats().lastRequestId,1);f.a.mode='normal';f.a.flush();assert.equal((await pending).code,'COMMAND_ACCEPTED');assert.equal(f.link.stats().retainedRequestSlots,0);cleanup(f);
});
test('every token field, operation and request identity must match the pending request',async()=>{
 const changes=[...Object.keys(token).map(key=>({token:{...token,[key]:typeof token[key]==='number'?token[key]+1:'other'}})),{op:'revoke'},{requestId:2},{sessionId:'other'},{channelId:'other'}];
 for(const patch of changes){const f=fixture();await ready(f);f.a.mode='hold';const pending=f.link.request(request());const failure=assert.rejects(pending,unavailable);f.a.emit('data',frame(reply(patch)));assert.deepEqual(f.events,['unavailable']);assert.equal(f.link.stats().unknownRequests,1);await failure;assert.deepEqual(f.writes,[]);cleanup(f);}
});
test('elapsed deadline rejects ACK before the timer callback gets a turn',async()=>{
 const f=fixture({deadlineMs:10});await ready(f);f.a.mode='hold';const pending=f.link.request(request());const order=[];f.events.push=event=>{order.push(event);return 1;};const failed=assert.rejects(pending.catch(error=>{order.push('rejected');throw error;}),unavailable);
 const until=performance.now()+15;while(performance.now()<until){}f.a.emit('data',frame(reply()));assert.deepEqual(order,['unavailable']);assert.equal(f.link.stats().unknownRequests,1);await failed;assert.deepEqual(order,['unavailable','rejected']);cleanup(f);
});
test('queue failure and EOF synchronously fence before pending rejection',async()=>{
 for(const mode of['queue','end']){const f=fixture({throwUnavailable:true});await ready(f);if(mode==='queue')f.a._writableState.length=90121;else f.a.mode='hold';
  const pending=f.link.request(request()),failed=assert.rejects(pending,unavailable);if(mode==='end')f.a.emit('end');
  assert.deepEqual(f.events,['unavailable']);assert.equal(f.link.isAvailable(),false);assert.equal(f.link.stats().unknownRequests,1);await failed;f.a._writableState.length=0;cleanup(f);assert.equal(f.events.length,1);
 }
});
test('ambiguous provider ACK retains the unknown slot and never retries',async()=>{
 const f=fixture({throwInput:true});await ready(f);await f.link.request(request());await assert.rejects(f.link.request(request('input',{inputSequence:0,data:'once'})),unavailable);
 assert.deepEqual(f.writes,['once']);assert.equal(f.commands.stats().retired,true);assert.deepEqual(f.events,['unavailable']);assert.equal(f.link.stats().unknownRequests,1);
 await assert.rejects(f.link.request(request('input',{inputSequence:0,data:'once'})),unavailable);assert.deepEqual(f.writes,['once']);assert.equal(JSON.stringify(f.link.stats()).includes('once'),false);cleanup(f);assert.equal(f.link.stats().retainedRequestSlots,1);
});
test('known permanent authority declines release their slot but fence before settlement',async()=>{
 for(const code of['ENDPOINT_UNAVAILABLE','COMMAND_RETIRED']){const f=fixture({endpointCurrent:code!=='ENDPOINT_UNAVAILABLE'});await ready(f);if(code==='COMMAND_RETIRED')f.commands.retire();
  const result=await f.link.request(request()).then(value=>{assert.deepEqual(f.events,['unavailable']);return value;});assert.equal(result.status,'failed');assert.equal(result.code,code);assert.equal(f.link.stats().retainedRequestSlots,0);assert.equal(f.link.isAvailable(),false);assert.deepEqual(f.writes,[]);cleanup(f);
 }
});
test('known nonpermanent decline releases a slot without replaying or fencing',async()=>{
 const f=fixture();await ready(f);await f.link.request(request());await f.link.request(request('input',{inputSequence:0,data:'original'}));const declined=await f.link.request(request('input',{inputSequence:0,data:'changed'}));
 assert.equal(declined.code,'REQUEST_REFUSED');assert.equal(f.link.stats().retainedRequestSlots,0);assert.equal(f.link.isAvailable(),true);assert.equal((await f.link.request(request('input',{inputSequence:1,data:'next'}))).code,'COMMAND_ACCEPTED');assert.deepEqual(f.writes,['original','next']);cleanup(f);
});
test('timeout and late ACK never release an unknown slot or revive the instance',async()=>{
 const f=fixture({deadlineMs:10});await ready(f);f.a.mode='hold';const pending=f.link.request(request('input',{inputSequence:0,data:'DO_NOT_RETAIN_BODY'}));await assert.rejects(pending,unavailable);
 assert.ok(f.a.held.bytes.length>0,'transport operation remains independently unsettled');assert.equal(f.link.stats().retainedRequestSlots,1);assert.equal(f.link.stats().pendingRequests,0);assert.equal(f.link.stats().unknownRequests,1);assert.equal(JSON.stringify(f.link.stats()).includes('DO_NOT_RETAIN_BODY'),false);
 f.a.emit('data',frame(reply({op:'input'})));f.link.dispose();f.link.dispose();await assert.rejects(f.link.request(request()),unavailable);assert.equal(f.link.stats().retainedRequestSlots,1);assert.equal(f.link.stats().lastRequestId,1);assert.deepEqual(f.writes,[]);cleanup(f);
});
test('known accepted ACK remains known when EOF follows before Promise delivery',async()=>{
 const f=fixture();await ready(f);f.a.mode='hold';const pending=f.link.request(request());f.a.emit('data',frame(reply()));f.a.emit('end');assert.deepEqual(f.events,['unavailable']);
 const accepted=await pending;assert.equal(accepted.status,'accepted');assert.equal(accepted.code,'COMMAND_ACCEPTED');assert.equal(f.link.stats().retainedRequestSlots,0);assert.equal(f.link.isAvailable(),false);cleanup(f);
});
test('options, callback, request Proxies and getters are refused without traps',async()=>{
 const f=fixture({deferLink:true});let touched=0;const trap={get(){touched++;throw Error('private');},ownKeys(){touched++;throw Error('private');},getPrototypeOf(){touched++;throw Error('private');},apply(){touched++;throw Error('private');}};
 const accessor={...f.opts};Object.defineProperty(accessor,'onUnavailable',{enumerable:true,get(){touched++;return()=>{};}});
 for(const options of[accessor,new Proxy(f.opts,trap),{...f.opts,channel:new Proxy(f.main,trap)},{...f.opts,onUnavailable:new Proxy(()=>{},trap)},{...f.opts,onUnavailable:undefined},{...f.opts,channel:Object.create(TerminalCommandChannel.prototype)},{...f.opts,channel:f.creator},{...f.opts,extra:true},...[0,10001,1.5].map(deadlineMs=>({...f.opts,deadlineMs}))])assert.throws(()=>new api.TerminalCommandLink(options),TypeError);
 f.link=new api.TerminalCommandLink(f.opts);await ready(f);const getter=request('input',{inputSequence:0});Object.defineProperty(getter,'data',{enumerable:true,get(){touched++;return 'secret';}});
 for(const q of[getter,new Proxy(request(),trap),request('install',{token:new Proxy(token,trap)})])await assert.rejects(f.link.request(q),error=>error.message==='COMMAND_REFUSED');assert.equal(touched,0);assert.equal(f.link.stats().lastRequestId,0);cleanup(f);
});
test('original channel methods and callback are captured before caller mutation',async()=>{
 const f=fixture({deferLink:true});let touched=0;for(const name of['identity','subscribe','send'])Object.defineProperty(f.main,name,{configurable:true,get(){touched++;throw Error('private');}});
 f.link=new api.TerminalCommandLink(f.opts);f.opts.onUnavailable=()=>{touched++;};await ready(f);assert.equal((await f.link.request(request())).code,'COMMAND_ACCEPTED');for(const name of['identity','subscribe','send'])delete f.main[name];f.a.emit('end');assert.deepEqual(f.events,['unavailable']);assert.equal(touched,0);cleanup(f);
});
test('poisoned ready Promise constructor or Proxy prototype is refused without traps',()=>{
 for(const mode of['constructor','prototype']){const f=fixture({deferLink:true});let touched=0;
  if(mode==='constructor')Object.defineProperty(f.main.ready,'constructor',{get(){touched++;throw Error('private');}});
  else Object.setPrototypeOf(f.main.ready,new Proxy(Promise.prototype,{get(){touched++;throw Error('private');},getPrototypeOf(){touched++;throw Error('private');}}));
  assert.throws(()=>new api.TerminalCommandLink(f.opts),TypeError);assert.equal(touched,0);f.main.dispose();cleanup(f);
 }
});
