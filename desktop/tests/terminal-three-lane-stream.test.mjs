// Inert opaque endpoint callbacks only; none of these tests proves native IO.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalCommandChannel} from '../src/terminal/command-channel.mjs';
const api=await import('../src/terminal/native-three-lane-stream.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function make(lane='command',override={}){assert.equal(typeof api.createNativeThreeLaneStream,'function');const endpoint=Object.freeze({}),reads=[],writes=[],closes=[];let current=true;const native={assertPeerCurrent(value){assert.equal(value,endpoint);return current;},peerRead(value,deadline){assert.equal(value,endpoint);assert.equal(deadline,25);const r=deferred();reads.push(r);return r.promise;},peerWrite(value,bytes,deadline){assert.equal(value,endpoint);assert.equal(deadline,25);const w={...deferred(),bytes};writes.push(w);return w.promise;},closePeerEndpoint(value,deadline){assert.equal(value,endpoint);assert.equal(deadline,25);const c=deferred();closes.push(c);return c.promise;},...override};const stream=api.createNativeThreeLaneStream({native,endpoint,lane,deadlineMs:25});return{stream,native,endpoint,reads,writes,closes,revoke(){current=false;}};}
async function close(p){p.stream.destroy();p.reads.forEach(r=>r.resolve(null));p.writes.forEach(w=>w.resolve({bytes:w.bytes.length}));p.closes.forEach(c=>c.resolve(true));return p.stream.closed;}

test('three named lanes use explicit write caps with no unknown-lane fallthrough',async()=>{
 for(const [lane,cap]of[['control',2048],['history',90120],['command',90120]]){const p=make(lane);assert.equal(p.stream.stats().lane,lane);assert.equal(p.stream.stats().maxWriteBytes,cap);assert.equal(p.stream.stats().readIdleTimeout,false);assert.throws(()=>p.stream.write(Buffer.alloc(cap+1)),RangeError);assert.equal(p.stream.write(Buffer.alloc(cap)),false);assert.equal(p.stream.writableLength,cap);assert.equal(await close(p),true);}
 assert.throws(()=>make('data'),TypeError);assert.throws(()=>make('shell'),TypeError);
});
test('read slot stays pending beyond cancellation ceiling without an idle expiry',async()=>{
 const p=make();let data=0;p.stream.on('data',()=>data++);await tick();await new Promise(resolve=>setTimeout(resolve,35));assert.equal(p.reads.length,1);assert.equal(p.stream.stats().readReservedBytes,32768);assert.equal(p.stream.stats().retired,false);assert.equal(data,0);assert.equal(await close(p),true);
});
test('actual pending read and write credits survive retirement and early close receipt',async()=>{
 const p=make();let data=0,drain=0;p.stream.on('data',()=>data++).on('drain',()=>drain++);await tick();p.stream.write(Buffer.from('held'));p.stream.write(Buffer.from('unsent'));p.stream.destroy();assert.equal(p.stream.stats().retainedBytes,32772);let closed=false;p.stream.closed.then(()=>{closed=true;});p.closes[0].resolve(true);await tick();assert.equal(closed,false);p.reads[0].resolve(Buffer.from('stale'));await tick();assert.equal(data,0);assert.equal(p.stream.writableLength,4);p.writes[0].resolve({bytes:4});assert.equal(await p.stream.closed,true);assert.equal(p.stream.stats().retainedBytes,0);assert.equal(drain,0);assert.equal(p.writes.length,1);
});
test('EOF emits end before close while native failure remains fixed error',async()=>{
 for(const fail of[false,true]){const p=make(),events=[];p.stream.on('data',()=>events.push('data')).on('end',()=>events.push('end')).on('error',error=>{events.push(error.message);}).on('close',()=>events.push('close'));await tick();p.revoke();if(fail)p.reads[0].reject(Error('PRIVATE_NATIVE'));else p.reads[0].resolve(null);await tick();assert.deepEqual(events,fail?['NATIVE_THREE_LANE_STREAM_UNAVAILABLE','close']:['end','close']);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);}
});
test('stale completion after endpoint loss never emits data or drains a write',async()=>{
 for(const op of['read','write']){const p=make(),events=[];p.stream.on('drain',()=>events.push('drain'));if(op==='read')p.stream.on('data',()=>events.push('data'));else p.stream.write(Buffer.from('abc'));await tick();p.revoke();if(op==='read')p.reads[0].resolve(Buffer.from('stale'));else p.writes[0].resolve({bytes:3});await tick();assert.deepEqual(events,[]);assert.equal(p.stream.stats().retired,true);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);}
});
test('frame-count and byte reservations are bounded and queued failures never replay',async()=>{
 const p=make();for(let i=0;i<32;i++)p.stream.write(Buffer.from('x'));assert.equal(p.stream.stats().backpressured,true);assert.throws(()=>p.stream.write(Buffer.from('x')),RangeError);assert.equal(p.writes.length,1);p.writes[0].reject(Error('PRIVATE_WRITE'));await tick();assert.equal(p.writes.length,1);assert.equal(p.stream.writableLength,0);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
});
test('malformed native receipts and nontrue close replies never verify closure',async()=>{
 for(const receipt of[{bytes:2},{bytes:3,extra:true},{bytes:'3'}]){const p=make();p.stream.write(Buffer.from('abc'));p.writes[0].resolve(receipt);await tick();assert.equal(p.stream.stats().retired,true);p.closes[0].resolve(false);assert.equal(await p.stream.closed,false);}
});
test('native methods and options reject Proxies/accessors before side effects',()=>{
 assert.equal(typeof api.createNativeThreeLaneStream,'function');let touched=0;const methods=Object.fromEntries(['assertPeerCurrent','peerRead','peerWrite','closePeerEndpoint'].map(name=>[name,()=>{touched++;return true;}]));
 const trap={get(){touched++;throw Error('private');},ownKeys(){touched++;throw Error('private');},getPrototypeOf(){touched++;throw Error('private');}};
 for(const patch of[{native:new Proxy(methods,trap)},{endpoint:new Proxy({},trap)},{native:{...methods,peerRead:new Proxy(()=>{},trap)}},{deadlineMs:0},{lane:'unknown'},{extra:true}])assert.throws(()=>api.createNativeThreeLaneStream({native:methods,endpoint:{},lane:'command',deadlineMs:25,...patch}),TypeError);
 const options={native:methods,endpoint:{},lane:'command',deadlineMs:25};Object.defineProperty(options,'native',{get(){touched++;return methods;}});assert.throws(()=>api.createNativeThreeLaneStream(options),TypeError);assert.equal(touched,0);
});
test('binary Proxy prototypes and decorated buffers invoke no caller properties',async()=>{
 let touched=0;const trap={get(){touched++;throw Error('private');},getPrototypeOf(){touched++;throw Error('private');}};const p=make();for(const value of[new Proxy(Buffer.from('x'),trap),Object.create(new Proxy(Buffer.prototype,trap)),Object.setPrototypeOf(Buffer.from('x'),new Proxy(Buffer.prototype,trap))])assert.throws(()=>p.stream.write(value),TypeError);
 const bytes=Buffer.from('abc');for(const key of['length','copy','buffer','byteOffset'])Object.defineProperty(bytes,key,{get(){touched++;throw Error('private');}});assert.equal(p.stream.write(bytes),true);assert.deepEqual(p.writes[0].bytes,Buffer.from('abc'));assert.equal(touched,0);assert.equal(await close(p),true);
});
test('decorated read bytes are copied cleanly and observer destruction fences later listeners',async()=>{
 const p=make();let touched=0,late=0;const seen=[];p.stream.on('data',bytes=>{seen.push(bytes);p.stream.destroy();}).on('data',()=>late++);await tick();const bytes=Buffer.from('abc');for(const key of['length','copy','buffer','byteOffset'])Object.defineProperty(bytes,key,{get(){touched++;throw Error('private');}});p.reads[0].resolve(bytes);await tick();assert.deepEqual(seen,[Buffer.from('abc')]);assert.equal(late,0);assert.equal(touched,0);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
});
test('reentrant currentness retirement cannot dispatch a new native write',async()=>{
 let p,armed=false;p=make('command',{assertPeerCurrent(){if(armed){armed=false;p.stream.destroy();}return true;}});armed=true;assert.equal(p.stream.write(Buffer.from('never')),false);assert.equal(p.writes.length,0);p.closes[0].resolve(true);assert.equal(await p.stream.closed,true);
});
test('command adapter carries real command HMAC using only inert opaque endpoints',async()=>{
 assert.equal(typeof api.createNativeThreeLaneStream,'function');const endpoints=[{},{}],states=endpoints.map(()=>({pending:null,queue:[],closed:false}));const native={assertPeerCurrent:e=>!states[endpoints.indexOf(e)].closed,peerRead(e){const s=states[endpoints.indexOf(e)];if(s.queue.length)return Promise.resolve(s.queue.shift());const d=deferred();s.pending=d;return d.promise;},async peerWrite(e,bytes){const peer=states[1-endpoints.indexOf(e)];for(let i=0;i<bytes.length;i+=7){const part=Buffer.from(bytes.subarray(i,i+7));if(peer.pending){const d=peer.pending;peer.pending=null;d.resolve(part);}else peer.queue.push(part);}return{bytes:bytes.length};},async closePeerEndpoint(e){for(const s of states){s.closed=true;s.pending?.resolve(null);s.pending=null;s.queue=[];}return true;}};
 const streams=endpoints.map(endpoint=>api.createNativeThreeLaneStream({native,endpoint,lane:'command',deadlineMs:1000})),scope={channelId:'channel1',sessionId:'session1',secret:Buffer.alloc(32,71),deadlineMs:1000};const main=new TerminalCommandChannel({stream:streams[0],role:'main',...scope}),creator=new TerminalCommandChannel({stream:streams[1],role:'creator',...scope});assert.equal(await main.ready,true);assert.equal(await creator.ready,true);const received=[];creator.subscribe({message:r=>received.push(r),closed(){}});assert.equal(main.send({type:'command',op:'install',channelId:'channel1',sessionId:'session1',requestId:1,token:{channelId:'channel1',sessionId:'session1',projectId:'project1',windowId:'window1',epoch:1,leaseId:'lease1',generation:1,gateGeneration:1}}),true);await tick();assert.equal(received.length,1);assert.equal(received[0].op,'install');main.dispose();creator.dispose();assert.deepEqual(await Promise.all(streams.map(s=>s.closed)),[true,true]);
});
