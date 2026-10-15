// Pure Node adapters and inert providers only: no native identity or execution admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalControlChannel} from '../src/terminal/control-channel.mjs';
import {TerminalHistoryChannel,TerminalHistoryReader,createHistoryResponder} from '../src/terminal/history-channel.mjs';
import {TerminalCreatorHistory} from '../src/terminal/remote-output.mjs';

const api=await import('../src/terminal/native-peer-stream.mjs').catch(error=>{
 if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function make(options={}){
 assert.equal(typeof api.createNativePeerStream,'function','native stream adapter export is required');
 const endpoint=Object.freeze({});const reads=[],writes=[],closes=[];let current=true;
 const native={
  assertPeerCurrent(value){assert.equal(value,endpoint);if(!current)throw Error('sensitive owner identity');return true;},
  peerRead(value,deadline){assert.equal(value,endpoint);assert.equal(deadline,100);const operation=deferred();reads.push(operation);return operation.promise;},
  peerWrite(value,bytes,deadline){assert.equal(value,endpoint);assert.equal(deadline,100);const operation={...deferred(),bytes};writes.push(operation);return operation.promise;},
  closePeerEndpoint(value,deadline){assert.equal(value,endpoint);assert.equal(deadline,100);const operation=deferred();closes.push(operation);return operation.promise;},
 };
 const stream=api.createNativePeerStream({native,endpoint,lane:options.lane??'control',deadlineMs:100});
 return {stream,native,endpoint,reads,writes,closes,revoke(){current=false;}};
}
async function close(p){p.stream.destroy();for(const r of p.reads)r.resolve(null);for(const w of p.writes)w.resolve({bytes:w.bytes.length});for(const c of p.closes)c.resolve(true);return p.stream.closed;}

test('PE-I1 native EOF retirement emits end before close without accepting stale data',async()=>{
 const p=make();const events=[];
 p.stream.on('data',()=>events.push('data')).on('end',()=>events.push('end')).on('error',()=>events.push('error')).on('close',()=>events.push('close'));
 await tick();p.revoke();p.reads[0].resolve(null);await tick();
 assert.deepEqual(events,['end','close']);assert.equal(p.closes.length,1);
 p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);assert.equal(p.stream.stats().retainedBytes,0);
});

test('PE-I1 rejected read after native retirement remains an error rather than EOF',async()=>{
 const p=make();const events=[];
 p.stream.on('data',()=>events.push('data')).on('end',()=>events.push('end')).on('error',()=>events.push('error')).on('close',()=>events.push('close'));
 await tick();p.revoke();p.reads[0].reject(Error('native retired failure'));await tick();
 assert.deepEqual(events,['error','close']);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
});

test('PE-I1 local destruction fences a later native EOF without emitting end',async()=>{
 const p=make();const events=[];
 p.stream.on('data',()=>events.push('data')).on('end',()=>events.push('end')).on('error',()=>events.push('error')).on('close',()=>events.push('close'));
 await tick();p.stream.destroy();p.revoke();p.reads[0].resolve(null);await tick();
 assert.deepEqual(events,['close']);assert.equal(p.closes.length,1);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
});

test('adapter export supports bounded binary connected stream methods',async()=>{
 const p=make();assert.equal(typeof p.stream.on,'function');assert.equal(typeof p.stream.write,'function');assert.equal(typeof p.stream.destroy,'function');assert.equal(p.stream.writableLength,0);
 assert.equal(p.stream.stats().nativeExecutionAdmitted,false);assert.equal(await close(p),true);
});

test('data registration starts one deferred read after all same-turn handlers install',async()=>{
 const p=make();const received=[];p.stream.on('data',bytes=>received.push(bytes));p.stream.on('data',bytes=>received.push(bytes));
 assert.equal(p.reads.length,0);await tick();assert.equal(p.reads.length,1);assert.equal(p.stream.stats().readReservedBytes,32768);
 const bytes=Buffer.from([0,255,195,40]);p.reads[0].resolve(bytes);await tick();assert.equal(received.length,2);assert.deepEqual(received[0],bytes);assert.ok(Buffer.isBuffer(received[0]));assert.equal(p.reads.length,2);
 assert.equal(await close(p),true);assert.equal(p.stream.stats().retainedBytes,0);
});

test('oversized and non-buffer read results retire without delivering a byte',async()=>{
 for(const value of [Buffer.alloc(32769),'secret',new Uint8Array([1]),undefined,Buffer.alloc(0)]){
  const p=make();let received=0;p.stream.on('data',()=>received++);await tick();p.reads[0].resolve(value);await tick();assert.equal(received,0);assert.equal(p.stream.stats().retired,true);assert.equal(p.reads.length,1);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
 }
});

test('EOF permanently retires and closes once without another read',async()=>{
 const p=make();let ends=0,closes=0;p.stream.on('data',()=>{}).on('end',()=>ends++).on('close',()=>closes++);await tick();p.reads[0].resolve(null);await tick();
 assert.equal(ends,1);assert.equal(closes,1);assert.equal(p.reads.length,1);assert.equal(p.closes.length,1);p.stream.destroy();p.stream.on('data',()=>{});await tick();assert.equal(p.reads.length,1);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
});

test('native callbacks are captured as own data methods without evaluating accessors or proxies',async()=>{
 assert.equal(typeof api.createNativePeerStream,'function');let touched=0;
 const bad=new Proxy({}, {get(){touched++;throw Error('getter');},getOwnPropertyDescriptor(){touched++;throw Error('descriptor');}});
 assert.throws(()=>api.createNativePeerStream({native:bad,endpoint:{},lane:'control',deadlineMs:100}),TypeError);assert.equal(touched,0);
 const p=make();p.stream.destroy();p.closes[0].resolve(true);await p.stream.closed;
 for(const name of ['peerRead','peerWrite','assertPeerCurrent','closePeerEndpoint']){
  const candidate={...p.native};Object.defineProperty(candidate,name,{get(){touched++;return ()=>true;}});
  assert.throws(()=>api.createNativePeerStream({native:candidate,endpoint:{},lane:'control',deadlineMs:100}),TypeError);
 }
 assert.equal(touched,0);
 const own=make();for(const name of Object.keys(own.native))Object.defineProperty(own.native,name,{value:own.native[name],enumerable:false});
 const another=api.createNativePeerStream({native:own.native,endpoint:own.endpoint,lane:'control',deadlineMs:100});own.native.peerRead=()=>{throw Error('replacement');};another.on('data',()=>{});await tick();assert.equal(own.reads.length,1);another.destroy();own.reads[0].resolve(null);own.closes[0].resolve(true);assert.equal(await another.closed,true);await close(own);
});

test('invalid lane deadlines endpoints and callback proxies reject before native effects',()=>{
 assert.equal(typeof api.createNativePeerStream,'function');let effects=0;const native=Object.fromEntries(['peerRead','peerWrite','assertPeerCurrent','closePeerEndpoint'].map(k=>[k,()=>{effects++;return true;}]));
 for(const patch of [{lane:'shell'},{deadlineMs:0},{deadlineMs:10001},{deadlineMs:1.5},{endpoint:123},{endpoint:true},{endpoint:null},{native:{...native,peerRead:new Proxy(()=>{}, {})}}])assert.throws(()=>api.createNativePeerStream({native,endpoint:{},lane:'control',deadlineMs:100,...patch}),TypeError);
 const options={native,endpoint:{},lane:'control',deadlineMs:100};Object.defineProperty(options,'lane',{get(){effects++;return 'control';}});assert.throws(()=>api.createNativePeerStream(options),TypeError);assert.equal(effects,0);
});

test('only supported events and at most eight listeners are retained',async()=>{
 const p=make();for(const event of ['data','drain','end','close','error','timeout']){for(let i=0;i<8;i++)p.stream.on(event,()=>{});assert.throws(()=>p.stream.on(event,()=>{}),TypeError);}
 assert.throws(()=>p.stream.on('secret',()=>{}),TypeError);assert.throws(()=>p.stream.on('data',null),TypeError);let coerced=0;assert.throws(()=>p.stream.on({toString(){coerced++;return 'data';}},()=>{}),TypeError);assert.equal(coerced,0);await close(p);
});

test('write copies once and keeps in-flight bytes charged without spurious drain',async()=>{
 const p=make();let drains=0;p.stream.on('drain',()=>drains++);const input=Buffer.from([255,0,1]);assert.equal(p.stream.write(input),true);input.fill(0);
 assert.equal(p.stream.writableLength,3);assert.deepEqual(p.writes[0].bytes,Buffer.from([255,0,1]));assert.equal(drains,0);p.writes[0].resolve({bytes:3});await tick();assert.equal(p.stream.writableLength,0);assert.equal(drains,0);await close(p);
});

test('control backlog never exceeds 2048 bytes and queued writes serialize',async()=>{
 const p=make();let drains=0;p.stream.on('drain',()=>drains++);assert.equal(p.stream.write(Buffer.alloc(1024,1)),true);assert.equal(p.stream.write(Buffer.alloc(1024,2)),false);
 assert.equal(p.writes.length,1);assert.equal(p.stream.writableLength,2048);assert.throws(()=>p.stream.write(Buffer.alloc(1)),RangeError);assert.equal(p.writes.length,1);assert.equal(p.stream.writableLength,2048);
 p.writes[0].resolve({bytes:1024});await tick();assert.equal(p.writes.length,2);assert.equal(p.stream.writableLength,1024);assert.equal(drains,1);p.writes[1].resolve({bytes:1024});await tick();assert.equal(drains,1);await close(p);
});

test('history accepts its byte budget while rejecting oversize and non-Buffer input before a write',async()=>{
 const p=make({lane:'history'});assert.throws(()=>p.stream.write(Buffer.alloc(90121)),RangeError);for(const input of ['secret',new Uint8Array(1),null])assert.throws(()=>p.stream.write(input),TypeError);assert.equal(p.writes.length,0);
 assert.equal(p.stream.write(Buffer.alloc(90120)),false);assert.equal(p.stream.writableLength,90120);p.writes[0].resolve({bytes:90120});await tick();await close(p);
});

test('tiny writes have a hard frame count and empty writes retain no objects or native work',async()=>{
 const p=make();let drains=0;p.stream.on('drain',()=>drains++);for(let i=0;i<100;i++)assert.equal(p.stream.write(Buffer.alloc(0)),true);assert.equal(p.writes.length,0);assert.equal(p.stream.writableLength,0);
 for(let i=0;i<32;i++)assert.equal(p.stream.write(Buffer.from([i])),i<31);assert.equal(p.writes.length,1);assert.equal(p.stream.writableLength,32);assert.throws(()=>p.stream.write(Buffer.from([32])),RangeError);assert.equal(p.stream.writableLength,32);
 p.writes[0].resolve({bytes:1});await tick();assert.equal(p.writes.length,2);assert.equal(drains,1);assert.equal(p.stream.write(Buffer.from([33])),false);p.stream.destroy();p.writes[1].resolve({bytes:1});p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
});

test('short or malformed write completion retires and discards unsent queued bytes',async()=>{
 for(const result of [{bytes:1},{bytes:3.5},true,{get bytes(){throw Error('secret');}},new Proxy({bytes:3},{})]){
  const p=make();p.stream.write(Buffer.from('abc'));p.stream.write(Buffer.from('queued'));p.writes[0].resolve(result);await tick();assert.equal(p.stream.stats().retired,true);assert.equal(p.writes.length,1);assert.equal(p.stream.writableLength,0);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
 }
});

test('destroy closes immediately and stale read/write retain charges until actual settlement',async()=>{
 const p=make();let data=0,drains=0;p.stream.on('data',()=>data++).on('drain',()=>drains++);await tick();p.stream.write(Buffer.from('held'));p.stream.write(Buffer.from('unsent'));p.stream.destroy();
 assert.equal(p.closes.length,1);assert.equal(p.stream.stats().retired,true);assert.equal(p.stream.writableLength,4);assert.equal(p.stream.stats().readReservedBytes,32768);assert.equal(p.stream.stats().retainedBytes,32772);assert.equal(p.stream.write(Buffer.from('late')),false);
 let closed=false;p.stream.closed.then(()=>{closed=true;});p.closes[0].resolve(true);await tick();assert.equal(closed,false);
 p.reads[0].resolve(Buffer.from('stale secret'));await tick();assert.equal(data,0);assert.equal(p.stream.stats().readReservedBytes,0);assert.equal(p.stream.writableLength,4);
 p.writes[0].resolve({bytes:4});assert.equal(await p.stream.closed,true);assert.equal(p.stream.stats().retainedBytes,0);assert.equal(drains,0);assert.equal(p.writes.length,1);assert.equal(p.reads.length,1);
});

test('owner loss before and after awaited operations permanently suppresses effects',async()=>{
 for(const operation of ['read','write']){
  const p=make();let data=0,drains=0;p.stream.on('drain',()=>drains++);if(operation==='read')p.stream.on('data',()=>data++);else p.stream.write(Buffer.from('abc'));await tick();p.revoke();if(operation==='read')p.reads[0].resolve(Buffer.from('stale'));else p.writes[0].resolve({bytes:3});await tick();assert.equal(data,0);assert.equal(drains,0);assert.equal(p.stream.stats().retired,true);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
 }
 const p=make();p.revoke();p.stream.on('data',()=>{});await tick();assert.equal(p.reads.length,0);assert.equal(p.stream.stats().retired,true);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
 const w=make();w.revoke();assert.equal(w.stream.write(Buffer.from('abc')),false);assert.equal(w.writes.length,0);w.closes[0].resolve(true);assert.equal(await w.stream.closed,true);
});

test('destroy during data delivery suppresses remaining listeners and deferred next reads',async()=>{
 const p=make();let stale=0;p.stream.on('data',()=>p.stream.destroy()).on('data',()=>stale++);await tick();p.reads[0].resolve(Buffer.from('data'));await tick();assert.equal(stale,0);assert.equal(p.reads.length,1);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
 const early=make();early.stream.on('data',()=>{});early.stream.destroy();await tick();assert.equal(early.reads.length,0);early.closes[0].resolve(true);assert.equal(await early.stream.closed,true);
});

test('a failure of a queued native write retires the lane without sending its successor',async()=>{
 const p=make();p.stream.write(Buffer.from('first'));p.stream.write(Buffer.from('second'));p.stream.write(Buffer.from('never'));p.writes[0].resolve({bytes:5});await tick();assert.equal(p.writes.length,2);p.writes[1].reject(Error('queued secret'));await tick();assert.equal(p.stream.stats().retired,true);assert.equal(p.writes.length,2);assert.equal(p.stream.writableLength,0);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
});

test('rejected native and observer failures expose only a fixed error without unhandled throws',async()=>{
 const p=make();let message;p.stream.on('error',error=>{message=error.message;throw Error('observer secret');});p.stream.on('data',()=>{});await tick();p.reads[0].reject(Error('native secret credential'));await tick();assert.equal(message,'NATIVE_PEER_STREAM_UNAVAILABLE');p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
 const quiet=make();quiet.stream.write(Buffer.from('a'));quiet.writes[0].reject(Error('secret'));await tick();quiet.closes[0].reject(Error('close secret'));assert.equal(await quiet.stream.closed,false);
 const observer=make();observer.stream.on('data',()=>{throw Error('observer secret');});await tick();observer.reads[0].resolve(Buffer.from('abc'));await tick();assert.equal(observer.stream.stats().retired,true);observer.closes[0].resolve(true);assert.equal(await observer.stream.closed,true);
});

test('close requires exactly true and failure never becomes verified closure',async()=>{
 for(const value of [false,undefined,1,{closed:true}]){const p=make();p.stream.destroy();p.closes[0].resolve(value);assert.equal(await p.stream.closed,false);assert.equal(p.stream.stats().closeVerified,false);}
});

function inertPair(lane,{split=32768,holdWrites=false}={}){
 assert.equal(typeof api.createNativePeerStream,'function');const endpoints=[Object.freeze({}),Object.freeze({})];const states=endpoints.map(()=>({pending:null,queue:[],closed:false,maxPending:0,reads:0,maxChunk:0,closeCount:0,writesPending:0,maxWritesPending:0,writeSizes:[]}));
 const native={
  assertPeerCurrent(endpoint){const index=endpoints.indexOf(endpoint);if(index<0||states[index].closed)throw Error('retired');return true;},
  peerRead(endpoint){const state=states[endpoints.indexOf(endpoint)];assert.equal(state.pending,null,'one native read per endpoint');state.reads++;if(state.queue.length)return Promise.resolve(state.queue.shift());const pending=deferred();state.pending=pending;state.maxPending=Math.max(state.maxPending,1);return pending.promise;},
  async peerWrite(endpoint,bytes){const state=states[endpoints.indexOf(endpoint)];state.writeSizes.push(bytes.length);state.writesPending++;state.maxWritesPending=Math.max(state.maxWritesPending,state.writesPending);const peer=states[1-endpoints.indexOf(endpoint)];for(let offset=0;offset<bytes.length;offset+=split){const chunk=Buffer.from(bytes.subarray(offset,offset+split));peer.maxChunk=Math.max(peer.maxChunk,chunk.length);if(peer.pending){const pending=peer.pending;peer.pending=null;pending.resolve(chunk);}else peer.queue.push(chunk);}if(holdWrites)await tick();state.writesPending--;return {bytes:bytes.length};},
  async closePeerEndpoint(endpoint){const state=states[endpoints.indexOf(endpoint)];state.closeCount++;state.closed=true;state.pending?.resolve(null);state.pending=null;state.queue=[];const peer=states[1-endpoints.indexOf(endpoint)];peer.pending?.resolve(null);peer.pending=null;return true;},
 };
 const streams=endpoints.map(endpoint=>api.createNativePeerStream({native,endpoint,lane,deadlineMs:1000}));return {streams,states};
}

test('pure Node inert endpoints carry the real mutual HMAC control channel',async()=>{
 const p=inertPair('control',{split:7});const creator=new TerminalControlChannel({stream:p.streams[1],role:'creator',channelId:'control1',secret:Buffer.alloc(32,47),deadlineMs:1000});const main=new TerminalControlChannel({stream:p.streams[0],role:'main',channelId:'control1',secret:Buffer.alloc(32,47),deadlineMs:1000});
 assert.equal(await main.ready,true);assert.equal(await creator.ready,true);await tick();const received=[];creator.subscribe({message:r=>received.push(r),closed:()=>{}});const request={channelId:'control1',requestId:1,generation:3,open:true};assert.equal(main.send(request),true);await tick();assert.deepEqual(received.map(r=>({...r})),[request]);assert.equal(main.nativeExecutionAdmitted,false);assert.equal(p.streams[0].stats().nativeExecutionAdmitted,false);main.dispose();creator.dispose();assert.deepEqual(await Promise.all(p.streams.map(s=>s.closed)),[true,true]);
});

test('HMAC responses arriving before local write settlement use remaining credit without deadlock',async()=>{
 const p=inertPair('control',{holdWrites:true});const creator=new TerminalControlChannel({stream:p.streams[1],role:'creator',channelId:'control2',secret:Buffer.alloc(32,49),deadlineMs:1000});const main=new TerminalControlChannel({stream:p.streams[0],role:'main',channelId:'control2',secret:Buffer.alloc(32,49),deadlineMs:1000});assert.equal(await main.ready,true);assert.equal(await creator.ready,true);await tick();assert.deepEqual(p.states.map(s=>s.maxWritesPending),[1,1]);main.dispose();creator.dispose();assert.deepEqual(await Promise.all(p.streams.map(s=>s.closed)),[true,true]);
});

test('pure Node inert endpoints split a real history response across the 32768 read cap',async()=>{
 const p=inertPair('history');const creator=new TerminalHistoryChannel({stream:p.streams[1],role:'creator',channelId:'history1',sessionId:'s1',secret:Buffer.alloc(32,48),deadlineMs:1000});const main=new TerminalHistoryChannel({stream:p.streams[0],role:'main',channelId:'history1',sessionId:'s1',secret:Buffer.alloc(32,48),deadlineMs:1000});
 const history=new TerminalCreatorHistory('s1');history.append('\0'.repeat(32768));createHistoryResponder({channel:creator,history});const reader=new TerminalHistoryReader({channel:main,sessionId:'s1',deadlineMs:1000});assert.equal(await main.ready,true);assert.equal(await creator.ready,true);await tick();const result=await reader.read({sessionId:'s1',fromSequence:0,maxBytes:32768});assert.equal(result.chunk.utf8Bytes,32768);assert.equal(result.chunk.data,'\0'.repeat(32768));assert.equal(p.states[0].maxChunk,32768);assert.ok(p.states[0].reads>=4);assert.ok(p.states[1].writeSizes.some(size=>size>32768));main.dispose();creator.dispose();assert.deepEqual(await Promise.all(p.streams.map(s=>s.closed)),[true,true]);
});
