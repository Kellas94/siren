import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {ProductionGateLink,createProductionGateResponder} from '../src/terminal/production-gate-link.mjs';
import {HostInputGate} from '../src/terminal/input-gate.mjs';
const {ProductionControlChannel}=await import('../src/terminal/production-control-channel.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const tick=()=>new Promise(r=>setImmediate(r));
const key=()=>Buffer.alloc(32,71);
const frame=value=>{const body=Buffer.from(JSON.stringify(value)),header=Buffer.alloc(4);header.writeUInt32BE(body.length);return Buffer.concat([header,body]);};
class Wire extends EventEmitter {
 writes=[];destroyed=false;writableLength=0;blocked=false;hold=false;chunks=[];
 write(buffer){if(this.destroyed)throw Error('CLOSED');const copy=Buffer.from(buffer);this.writes.push(copy);if(this.hold)this.chunks.push(copy);else queueMicrotask(()=>{if(!this.remote.destroyed)this.remote.emit('data',copy);});return !this.blocked;}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.emit('close');queueMicrotask(()=>{if(!this.remote.destroyed)this.remote.emit('end');});}
 flush(){for(const c of this.chunks.splice(0))this.remote.emit('data',c);}
}
function wires(){const a=new Wire(),b=new Wire();a.remote=b;b.remote=a;return [a,b];}
function pair({creatorKey=key(),channelId='control_one',creatorChannel=channelId,deadlineMs=500}={}){
 assert.equal(typeof ProductionControlChannel,'function','control channel implementation required');const [a,b]=wires();
 const creator=new ProductionControlChannel({stream:b,role:'creator',channelId:creatorChannel,secret:creatorKey,deadlineMs});
 const main=new ProductionControlChannel({stream:a,role:'main',channelId,secret:key(),deadlineMs});return {a,b,main,creator};
}
async function ready(p){assert.equal(await p.main.ready,true);assert.equal(await p.creator.ready,true);}
const request={channelId:'control_one',requestId:1,generation:1,open:true};

test('both endpoints refuse availability until mutual authentication, and reveal no secret',async()=>{
 const p=pair();assert.equal(p.main.isAvailable(),false);assert.equal(p.creator.isAvailable(),false);await ready(p);
 assert.equal(p.main.isAvailable(),true);assert.equal(p.creator.isAvailable(),true);assert.equal(p.main.nativeExecutionAdmitted,false);
 for(const wire of [p.a,p.b])for(const bytes of wire.writes)assert.equal(bytes.includes(key()),false);p.main.dispose();
});
test('real gate link and responder exchange acknowledged gates over authenticated bytes',async()=>{
 const p=pair();await ready(p);const gate=new HostInputGate(),respond=createProductionGateResponder({channelId:'control_one',gate,send:r=>p.creator.send(r)});
 p.creator.subscribe({message:respond,closed:()=>{}});const link=new ProductionGateLink({channelId:'control_one',send:r=>{if(!p.main.send(r))throw Error('CONTROL_REFUSED');},subscribe:r=>p.main.subscribe(r)});
 assert.equal((await link.sendGate({generation:1,open:true})).ok,true);assert.equal(gate.allows(1),true);
 assert.equal((await link.sendGate({generation:2,open:false})).ok,true);assert.equal(gate.allows(1),false);p.main.dispose();assert.equal(link.isAvailable(),false);
});
test('wrong secret and wrong expected channel never produce a usable endpoint',async()=>{
 for(const options of [{creatorKey:Buffer.alloc(32,19)},{creatorChannel:'wrong'}]){const p=pair(options);assert.equal(await p.main.ready,false);assert.equal(await p.creator.ready,false);assert.equal(p.main.isAvailable(),false);}
});
test('caller secret is copied; zeroing caller buffer does not break the pending handshake',async()=>{
 assert.equal(typeof ProductionControlChannel,'function');const [a,b]=wires(),secret=key();
 const c=new ProductionControlChannel({stream:b,role:'creator',channelId:'control_one',secret,deadlineMs:500});const m=new ProductionControlChannel({stream:a,role:'main',channelId:'control_one',secret,deadlineMs:500});secret.fill(0);
 assert.equal(await m.ready,true);assert.equal(await c.ready,true);m.dispose();
});
test('fragmented headers and UTF-8 bodies plus coalesced frames preserve ordered exact packets',async()=>{
 const p=pair();await ready(p);const received=[];p.creator.subscribe({message:r=>received.push(r),closed:()=>{}});
 const bytes=Buffer.concat([frame(request),frame({...request,requestId:2,generation:2,open:false})]);
 for(const byte of bytes)p.b.emit('data',Buffer.from([byte]));assert.deepEqual(received.map(r=>({...r})),[request,{...request,requestId:2,generation:2,open:false}]);assert.ok(p.creator.stats().receiveCapacity<=1028);p.main.dispose();
});
test('oversized announced frame fails from its header without retaining an advertised body',async()=>{
 const p=pair();await ready(p);let closed=0;p.creator.subscribe({message:()=>assert.fail('unexpected packet'),closed:()=>closed++});const header=Buffer.alloc(4);header.writeUInt32BE(0xffffffff);p.b.emit('data',header);
 assert.equal(p.creator.isAvailable(),false);assert.equal(closed,1);assert.equal(p.creator.stats().bufferedBytes,0);p.main.dispose();
});
test('invalid UTF-8, malformed JSON, zero frame and unexpected control fields fail closed',async()=>{
 for(const bytes of [Buffer.from([0,0,0,1,255]),Buffer.from([0,0,0,1,123]),Buffer.alloc(4),frame({...request,command:'run'}),frame({...request,channelId:'other'}),frame({...request,requestId:-1})]){
  const p=pair();await ready(p);p.creator.subscribe({message:()=>assert.fail('malformed delivered'),closed:()=>{}});p.b.emit('data',bytes);assert.equal(p.creator.isAvailable(),false);p.main.dispose();
 }
});
test('pre-authentication gate traffic refuses and never reaches application',async()=>{
 assert.equal(typeof ProductionControlChannel,'function');const [a,b]=wires(),c=new ProductionControlChannel({stream:b,role:'creator',channelId:'control_one',secret:key(),deadlineMs:500});let messages=0;c.subscribe({message:()=>messages++,closed:()=>{}});
 b.emit('data',frame(request));assert.equal(await c.ready,false);assert.equal(messages,0);assert.equal(c.isAvailable(),false);a.destroy();
});
test('recorded authentication proof cannot authenticate a fresh main challenge',async()=>{
 const first=pair();await ready(first);const oldProof=first.b.writes[0];first.main.dispose();
 assert.equal(typeof ProductionControlChannel,'function');const [a,b]=wires(),m=new ProductionControlChannel({stream:a,role:'main',channelId:'control_one',secret:key(),deadlineMs:500});await tick();a.emit('data',oldProof);
 assert.equal(await m.ready,false);assert.equal(m.isAvailable(),false);b.destroy();
});
test('authentication deadline settles unavailable without waiting indefinitely',async()=>{
 assert.equal(typeof ProductionControlChannel,'function');const [a,b]=wires(),m=new ProductionControlChannel({stream:a,role:'main',channelId:'control_one',secret:key(),deadlineMs:25});assert.equal(await m.ready,false);assert.equal(m.isAvailable(),false);b.destroy();
});
test('authentication cannot succeed after elapsed deadline before its timer callback runs',async()=>{
 const p=pair({deadlineMs:20});const until=performance.now()+30;while(performance.now()<until){}
 assert.equal(await p.main.ready,false);assert.equal(await p.creator.ready,false);
});
test('out-of-order and reflected handshake records fail without gate effects',async()=>{
 for(const record of [{type:'ready',version:1,channelId:'control_one',proof:'0'.repeat(64)},{type:'proof',version:1,channelId:'control_one',nonce:'0'.repeat(64),proof:'0'.repeat(64)},{type:'challenge',version:2,channelId:'control_one',nonce:'0'.repeat(64)}]){
  const [a,b]=wires(),c=new ProductionControlChannel({stream:b,role:'creator',channelId:'control_one',secret:key(),deadlineMs:500});b.emit('data',frame(record));assert.equal(await c.ready,false);a.destroy();
 }
 const p=pair();await ready(p);p.b.emit('data',p.a.writes[0]);assert.equal(p.creator.isAvailable(),false);p.main.dispose();
});
test('tampered mutual proof and lost final confirmation never ready the main endpoint',async()=>{
 for(const corrupt of [true,false]){
  const [a,b]=wires();const original=b.write.bind(b);b.write=bytes=>{const p=JSON.parse(bytes.subarray(4));if(p.type==='ready')return corrupt?original(frame({...p,proof:'0'.repeat(64)})):true;return original(bytes);};
  const c=new ProductionControlChannel({stream:b,role:'creator',channelId:'control_one',secret:key(),deadlineMs:25});const m=new ProductionControlChannel({stream:a,role:'main',channelId:'control_one',secret:key(),deadlineMs:25});
  assert.equal(await m.ready,false);assert.equal(m.isAvailable(),false);c.dispose();
 }
});
test('preexisting excessive socket buffer refuses before adding any control bytes',async()=>{
 const p=pair();await ready(p);const count=p.a.writes.length;p.a.writableLength=2049;assert.equal(p.main.send(request),false);assert.equal(p.a.writes.length,count);assert.equal(p.main.isAvailable(),false);
});
test('backpressure never adds an application queue; another send invalidates the channel',async()=>{
 const p=pair();await ready(p);p.creator.subscribe({message:()=>{},closed:()=>{}});p.a.blocked=true;const before=p.a.writes.length;assert.equal(p.main.send(request),true);
 assert.equal(p.main.stats().backpressured,true);assert.equal(p.main.send({...request,requestId:2,generation:2}),false);assert.equal(p.a.writes.length,before+1);assert.equal(p.main.isAvailable(),false);
});
test('drain permits a fresh control submission and EOF invalidates subscribers synchronously',async()=>{
 const p=pair();await ready(p);const seen=[];p.creator.subscribe({message:r=>seen.push(r),closed:()=>{}});let closed=0;p.main.subscribe({message:()=>{},closed:()=>closed++});p.a.blocked=true;assert.equal(p.main.send(request),true);
 p.a.blocked=false;p.a.emit('drain');assert.equal(p.main.send({...request,requestId:2,generation:2}),true);await tick();assert.equal(seen.length,2);
 p.a.emit('end');assert.equal(p.main.isAvailable(),false);assert.equal(closed,1);p.main.dispose();assert.equal(closed,1);
});
test('no subscribers or a throwing subscriber refuse instead of buffering packets',async()=>{
 for(const subscribe of [false,true]){const p=pair();await ready(p);if(subscribe)p.creator.subscribe({message:()=>{throw Error('OBSERVER');},closed:()=>{}});p.b.emit('data',frame(request));assert.equal(p.creator.isAvailable(),false);p.main.dispose();}
});
test('local packet accessors are not evaluated and role-inappropriate reply refuses',async()=>{
 const p=pair();await ready(p);let reads=0;const bad={...request};Object.defineProperty(bad,'open',{enumerable:true,get(){reads++;return true;}});assert.equal(p.main.send(bad),false);assert.equal(reads,0);p.main.dispose();
 const other=pair();await ready(other);assert.equal(other.main.send({...request,ok:true}),false);other.main.dispose();
});

