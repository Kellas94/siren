import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalProductionRemoteOutput as TerminalRemoteOutput} from '../src/terminal/production-remote-output.mjs';
import {TerminalCreatorHistory} from '../src/terminal/remote-output.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function setup(reader,options={}){
 const output=new TerminalRemoteOutput(options);output.resumeViews();
 assert.equal(output.register('s1',reader).ok,true);
 const token=output.attach('s1',{leaseId:'l1',generation:1,fromSequence:0}).value;
 return {output,token};
}
const frame=(firstSequence=0,data='AΩ😀',endSequence=firstSequence+Buffer.byteLength(data))=>({firstSequence,endSequence,chunk:data?{sequence:firstSequence,data,utf8Bytes:Buffer.byteLength(data)}:null});

test('credited bounds and first UTF-8 frame come from exactly one history read',async()=>{
 let calls=0,request;const {output,token}=setup(q=>{calls++;request=q;assert.equal(output.stats().reservedUtf8Bytes,32768);return frame(1024,'AΩ😀',4096);});
 const result=await output.takeWithBounds(token);
 assert.equal(result.ok,true);assert.equal(calls,1);
 assert.deepEqual(request,{sessionId:'s1',fromSequence:0,maxBytes:32768});
 assert.deepEqual(result.value,{firstSequence:1024,endSequence:4096,chunk:{sequence:1024,data:'AΩ😀',utf8Bytes:7},gap:{fromSequence:0,resumeSequence:1024,droppedUtf8Bytes:1024,marker:'Terminal history omitted: 1024 UTF-8 bytes.',resetParser:true}});
 assert.equal(output.stats().reservedUtf8Bytes,0);assert.equal(output.stats().outstandingUtf8Bytes,7);
 assert.equal(output.ack(token,1031).ok,true);assert.equal(output.stats().outstandingUtf8Bytes,0);
 assert.ok(Object.isFrozen(result.value));assert.ok(Object.isFrozen(result.value.chunk));
});
test('empty initial history has actual zero bounds and no invented frame or credit',async()=>{
 let calls=0;const {output,token}=setup(()=>{calls++;return frame(0,'');});
 assert.deepEqual((await output.takeWithBounds(token)).value,{firstSequence:0,endSequence:0,chunk:null,gap:null});
 assert.equal(calls,1);assert.equal(output.stats().outstandingUtf8Bytes,0);assert.equal(output.ack(token,0).ok,true);
});
test('empty retained history still returns its absolute bounds and explicit omission',async()=>{
 const {output,token}=setup(()=>frame(73,''));const r=await output.takeWithBounds(token);
 assert.equal(r.value.firstSequence,73);assert.equal(r.value.endSequence,73);assert.equal(r.value.chunk,null);assert.equal(r.value.gap.resumeSequence,73);
 assert.equal(output.ack(token,73).ok,true);
});
test('bounded initial frame is not skipped: next read starts at its actual UTF-8 end',async()=>{
 const requests=[];const history=new TerminalCreatorHistory('s1');history.append('x'.repeat(32768));history.append('Ω😀tail');
 const {output,token}=setup(q=>{requests.push(q);return history.read(q);});
 const initial=await output.takeWithBounds(token);assert.equal(initial.value.firstSequence,0);assert.equal(initial.value.endSequence,32778);assert.equal(initial.value.chunk.data,'x'.repeat(32768));
 const next=await output.take(token);assert.equal(requests.length,2);assert.equal(requests[1].fromSequence,32768);assert.equal(next.value.chunk.data,'Ω😀tail');assert.equal(next.value.gap,null);
 assert.equal(output.stats().outstandingUtf8Bytes,32778);assert.equal(output.ack(token,32778).value.releasedUtf8Bytes,32778);
});
test('legacy take keeps its exact reply contract',async()=>{
 const {output,token}=setup(()=>frame());assert.deepEqual((await output.take(token)).value,{chunk:{sequence:0,data:'AΩ😀',utf8Bytes:7},gap:null});
});
test('initial credited read and legacy delivery share one pending-read slot',async()=>{
 const held=deferred();let calls=0;const {output,token}=setup(()=>{calls++;return held.promise;});
 const initial=output.takeWithBounds(token);assert.equal(output.stats().pendingRequests,1);assert.equal(output.stats().reservedUtf8Bytes,32768);
 assert.equal((await output.take(token)).code,'CAPACITY_EXCEEDED');assert.equal((await output.takeWithBounds(token)).code,'CAPACITY_EXCEEDED');assert.equal(calls,1);
 held.resolve(frame());assert.equal((await initial).ok,true);assert.equal(output.stats().pendingRequests,0);
});
for(const transition of ['detach','lock','retire'])test(`${transition} suppresses initial bounds but retains actual unresolved read capacity`,async()=>{
 const held=deferred();const {output,token}=setup(()=>held.promise);const initial=output.takeWithBounds(token);
 if(transition==='detach')output.detach(token);else if(transition==='lock')output.suspendViews();else output.retire('s1');
 assert.equal((await initial).code,'LEASE_STALE');assert.equal(output.stats().pendingRequests,1);assert.equal(output.stats().reservedUtf8Bytes,32768);assert.equal(output.stats().outstandingUtf8Bytes,0);
 if(transition==='retire')assert.equal(output.register('s1',()=>frame()).code,'CAPACITY_EXCEEDED');
 held.resolve(frame());await tick();assert.equal(output.stats().pendingRequests,0);assert.equal(output.stats().reservedUtf8Bytes,0);assert.equal(output.stats().outstandingUtf8Bytes,0);
});
test('initial-history timeout cannot refund a still-unresolved reader or admit a retry',async()=>{
 const held=deferred();let calls=0;const {output,token}=setup(()=>{calls++;return held.promise;},{deadlineMs:20});
 assert.equal((await output.takeWithBounds(token)).code,'HOST_UNAVAILABLE');assert.equal(output.stats().pendingRequests,1);assert.equal(output.stats().reservedUtf8Bytes,32768);
 assert.equal((await output.takeWithBounds(token)).code,'HOST_UNAVAILABLE');assert.equal(calls,1);
 held.resolve(frame());await tick();assert.equal(output.stats().reservedUtf8Bytes,0);assert.equal(output.stats().outstandingUtf8Bytes,0);
});
test('stale initial result cannot refund or overwrite a replacement attachment',async()=>{
 const held=deferred();let calls=0;const {output,token}=setup(()=>++calls===1?held.promise:frame());const initial=output.takeWithBounds(token);
 const fresh=output.attach('s1',{leaseId:'l2',generation:2,fromSequence:0}).value;
 assert.equal((await initial).code,'LEASE_STALE');assert.equal((await output.takeWithBounds(fresh)).code,'CAPACITY_EXCEEDED');
 held.resolve(frame(400));await tick();const r=await output.takeWithBounds(fresh);
 assert.equal(r.value.firstSequence,0);assert.equal(r.value.chunk.sequence,0);assert.equal(output.stats().outstandingUtf8Bytes,7);assert.equal(output.ack(token,407).code,'LEASE_STALE');assert.equal(output.stats().outstandingUtf8Bytes,7);
});
test('malformed bounds never become an attachment receipt or credited frame',async()=>{
 for(const bad of [{...frame(),firstSequence:8},{...frame(),endSequence:-1},{...frame(),endSequence:6},{firstSequence:0,endSequence:4,chunk:null},{...frame(),extra:true}]){
  let calls=0;const {output,token}=setup(()=>{calls++;return bad;});assert.equal((await output.takeWithBounds(token)).code,'HOST_UNAVAILABLE');assert.equal(output.stats().outstandingUtf8Bytes,0);assert.equal(output.stats().reservedUtf8Bytes,0);
  assert.equal((await output.takeWithBounds(token)).code,'HOST_UNAVAILABLE');assert.equal(calls,1);
 }
});
test('initial bounds cannot bypass the per-attachment or shared delivery credit cap',async()=>{
 const output=new TerminalRemoteOutput();output.resumeViews();let calls=0;
 const history=new TerminalCreatorHistory('s1');for(let i=0;i<9;i++)history.append('x'.repeat(32768));
 for(let i=1;i<=8;i++){
  const sessionId='s'+i;assert.equal(output.register(sessionId,q=>{calls++;return {...history.read({...q,sessionId:'s1'})};}).ok,true);
  const token=output.attach(sessionId,{leaseId:'l'+i,generation:i,fromSequence:0}).value;
  for(let n=0;n<8;n++)assert.equal((await output.takeWithBounds(token)).ok,true);
  const before=calls;assert.equal((await output.takeWithBounds(token)).code,'CAPACITY_EXCEEDED');assert.equal(calls,before);
 }
 assert.equal(output.stats().outstandingUtf8Bytes,2*1024*1024);assert.equal(output.stats().reservedUtf8Bytes,0);
});

test('cached source status is exact frozen DATA and invokes no reader',()=>{
 let calls=0;const {output}=setup(()=>{calls++;return frame();});
 const status=output.sourceStatus('s1');assert.deepEqual(status,{registered:true,retiring:false,pendingRead:false});assert.ok(Object.isFrozen(status));assert.equal(calls,0);
 assert.equal(output.sourceStatus('unknown'),null);assert.equal(output.sourceStatus(new Proxy({}, {get(){throw Error('unexpected trap');}})),null);
});
test('source status reflects pending reservation before invoking the reader',async()=>{
 let observed;const {output,token}=setup(()=>{observed=output.sourceStatus('s1');assert.equal(output.stats().reservedUtf8Bytes,32768);return frame();});
 assert.equal((await output.takeWithBounds(token)).ok,true);assert.deepEqual(observed,{registered:true,retiring:false,pendingRead:true});assert.equal(output.sourceStatus('s1').pendingRead,false);
});
test('source status retains pending after early detach and becomes false only after pool release',async()=>{
 const held=deferred();const {output,token}=setup(()=>held.promise);const read=output.takeWithBounds(token);output.detach(token);
 assert.equal((await read).code,'LEASE_STALE');assert.equal(output.sourceStatus('s1').pendingRead,true);assert.equal(output.stats().reservedUtf8Bytes,32768);
 held.resolve(frame());await tick();assert.equal(output.sourceStatus('s1').pendingRead,false);assert.equal(output.stats().reservedUtf8Bytes,0);
});
test('cached retired status retains exact owner slot until actual pool settlement',async()=>{
 const held=deferred();const {output,token}=setup(()=>held.promise);const read=output.takeWithBounds(token);output.retire('s1');
 assert.equal((await read).code,'LEASE_STALE');assert.deepEqual(output.sourceStatus('s1'),{registered:false,retiring:true,pendingRead:true});assert.equal(output.register('s1',()=>frame()).code,'CAPACITY_EXCEEDED');
 held.resolve(frame());await tick();assert.equal(output.sourceStatus('s1'),null);assert.equal(output.register('s1',()=>frame()).ok,true);assert.deepEqual(output.sourceStatus('s1'),{registered:true,retiring:false,pendingRead:false});
});
test('cached pending status survives a public timeout without claiming cleanup or liveness',async()=>{
 const held=deferred();const {output,token}=setup(()=>held.promise,{deadlineMs:20});assert.equal((await output.takeWithBounds(token)).code,'HOST_UNAVAILABLE');
 assert.deepEqual(output.sourceStatus('s1'),{registered:true,retiring:false,pendingRead:true});held.resolve(frame());await tick();
 assert.deepEqual(output.sourceStatus('s1'),{registered:true,retiring:false,pendingRead:false});assert.equal((await output.takeWithBounds(token)).code,'HOST_UNAVAILABLE');
});
test('Lock does not hide actual pending reads from per-source status',async()=>{
 const held=deferred();const {output,token}=setup(()=>held.promise);const read=output.takeWithBounds(token);output.suspendViews();assert.equal((await read).code,'LEASE_STALE');
 assert.equal(output.sourceStatus('s1').pendingRead,true);held.resolve(frame());await tick();assert.equal(output.sourceStatus('s1').pendingRead,false);
});
test('retiring an idle source removes only its pool metadata, not native cleanup proof',()=>{
 const {output}=setup(()=>frame());assert.equal(output.retire('s1').ok,true);assert.equal(output.sourceStatus('s1'),null);assert.equal(output.nativeExecutionAdmitted,false);
});

for(const shadow of ['method','getter'])test(`native reader Promise own then ${shadow} cannot publish a fake frame or replace actual settlement`,async()=>{
 const held=deferred();let touched=0;
 if(shadow==='method')Object.defineProperty(held.promise,'then',{value(resolve){touched++;return Promise.resolve(resolve(frame(0,'fake')));}});
 else Object.defineProperty(held.promise,'then',{get(){touched++;throw Error('untrusted getter');}});
 const {output,token}=setup(()=>held.promise,{deadlineMs:100});let reading;
 try{
  reading=output.takeWithBounds(token);void reading.catch(()=>{});await tick();assert.equal(touched,0);assert.equal(output.sourceStatus('s1').pendingRead,true);assert.equal(output.stats().reservedUtf8Bytes,32768);assert.equal(output.stats().outstandingUtf8Bytes,0);
  held.resolve(frame(0,'actual'));assert.equal((await reading).value.chunk.data,'actual');assert.equal(touched,0);assert.equal(output.stats().reservedUtf8Bytes,0);assert.equal(output.stats().outstandingUtf8Bytes,6);
 }finally{held.resolve(frame(0,'actual'));if(reading)await Promise.allSettled([reading]);output.retire('s1');}
});
test('a sync malformed DTO is never assimilated through a then getter',async()=>{
 let touched=0;const reply={...frame(),get then(){touched++;throw Error('no assimilation');}};const {output,token}=setup(()=>reply,{deadlineMs:50});
 const result=await output.takeWithBounds(token);assert.equal(result.ok,false);assert.equal(touched,0);assert.equal(output.stats().reservedUtf8Bytes,0);assert.equal(output.sourceStatus('s1').pendingRead,false);
});
test('a native Promise with unknown species retains its finite reservation without evaluating constructor',async()=>{
 const held=deferred();let touched=0;Object.defineProperty(held.promise,'constructor',{get(){touched++;throw Error('no species access');}});
 const {output,token}=setup(()=>held.promise,{deadlineMs:20});assert.equal((await output.takeWithBounds(token)).code,'HOST_UNAVAILABLE');assert.equal(touched,0);
 assert.equal(output.sourceStatus('s1').pendingRead,true);assert.equal(output.stats().reservedUtf8Bytes,32768);output.retire('s1');held.resolve(frame());await tick();
 assert.deepEqual(output.sourceStatus('s1'),{registered:false,retiring:true,pendingRead:true});assert.equal(output.register('s1',()=>frame()).code,'CAPACITY_EXCEEDED');assert.equal(output.stats().reservedUtf8Bytes,32768);assert.equal(touched,0);
});
