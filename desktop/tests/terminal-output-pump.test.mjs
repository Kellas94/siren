import test from 'node:test';
import assert from 'node:assert/strict';
const {TerminalOutputPump}=await import('../src/terminal/output-pump.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const MB=1024*1024;
function fixture(){assert.equal(typeof TerminalOutputPump,'function');const pump=new TerminalOutputPump();assert.equal(pump.register('s1').ok,true);pump.resumeViews();return pump;}
const attach=(pump,generation=1,leaseId='lease1',sessionId='s1')=>{const r=pump.attach(sessionId,{leaseId,generation,fromSequence:0});assert.equal(r.ok,true);return r.value;};

test('output consumption has exact256KiB credit while ingestion keeps draining into4MiB history',()=>{
 const p=fixture(),a=attach(p);p.append('s1','x'.repeat(MB));
 for(let i=0;i<8;i++){const r=p.take(a);assert.equal(r.ok,true);assert.equal(r.value.chunk.sequence,i*32768);assert.equal(r.value.chunk.utf8Bytes,32768);}
 assert.equal(p.take(a).code,'CAPACITY_EXCEEDED');assert.equal(p.stats().outstandingUtf8Bytes,262144);
 p.append('s1','y'.repeat(10*MB));assert.equal(p.stats().retainedUtf8Bytes,4*MB);assert.equal(p.stats().outstandingUtf8Bytes,262144);
 assert.equal(p.take(a).code,'CAPACITY_EXCEEDED','Unacknowledged frames cannot be erased by a history gap');
 assert.equal(p.ack(a,262144).value.releasedUtf8Bytes,262144);
 const next=p.take(a);assert.equal(next.ok,true);assert.equal(next.value.gap.fromSequence,262144);assert.equal(next.value.gap.resumeSequence,7*MB);assert.equal(next.value.gap.droppedUtf8Bytes,7*MB-262144);assert.equal(next.value.gap.resetParser,true);assert.equal(next.value.chunk.sequence,7*MB);assert.equal(next.value.chunk.data,'y'.repeat(32768));
 assert.equal(p.take(a).value.gap,null,'A gap is delivered only once');
});

test('Lock synchronously revokes every output view while ingestion continues without replaying input',()=>{
 const p=fixture(),a=attach(p);p.append('s1','before\n');p.take(a);p.suspendViews();
 assert.equal(p.take(a).code,'LEASE_STALE');assert.equal(p.ack(a,7).code,'LEASE_STALE');assert.equal(p.stats().outstandingUtf8Bytes,0);
 assert.equal(p.append('s1','finished while locked\n').ok,true);assert.equal(p.attach('s1',{leaseId:'l2',generation:2,fromSequence:0}).code,'PIN_REQUIRED');
 p.resumeViews();const b=attach(p,2,'l2');assert.equal(p.take(b).value.chunk.data,'before\nfinished while locked\n');assert.equal(p.nativeExecutionAdmitted,false);
});

test('replacement attachment refunds only old credit and rejects stale generation even if a lease ID is reused',()=>{
 const p=fixture(),a=attach(p);p.append('s1','abc');p.take(a);const b=attach(p,2);assert.equal(p.stats().outstandingUtf8Bytes,0);
 assert.equal(p.ack(a,3).code,'LEASE_STALE');assert.equal(p.take(a).code,'LEASE_STALE');assert.equal(p.attach('s1',{leaseId:'other',generation:1,fromSequence:0}).code,'LEASE_STALE');
 assert.equal(p.take(b).value.chunk.data,'abc');assert.equal(p.stats().outstandingUtf8Bytes,3);assert.equal(p.ack(b,3).value.releasedUtf8Bytes,3);assert.equal(p.ack(b,3).value.releasedUtf8Bytes,0);
});

test('eight streams retain at most32MiB with exact2MiB total delivery credit and no ninth allocation',()=>{
 const p=fixture();for(let i=2;i<=8;i++)assert.equal(p.register('s'+i).ok,true);assert.equal(p.register('s9').code,'CAPACITY_EXCEEDED');
 for(let i=1;i<=8;i++){p.append('s'+i,'a'.repeat(5*MB));const a=attach(p,i,'l'+i,'s'+i);for(let j=0;j<8;j++)assert.equal(p.take(a).ok,true);assert.equal(p.take(a).code,'CAPACITY_EXCEEDED');}
 assert.equal(p.stats().retainedUtf8Bytes,32*MB);assert.equal(p.stats().outstandingUtf8Bytes,2*MB);assert.equal(p.stats().sessions,8);assert.equal(p.stats().attachments,8);p.suspendViews();assert.equal(p.stats().outstandingUtf8Bytes,0);assert.equal(p.stats().retainedUtf8Bytes,32*MB);
});

test('Unicode deliveries have byte-accurate cursors and malformed requests do not change live attachments',()=>{
 const p=fixture();p.append('s1','😀'.repeat(8193));const a=attach(p);const r=p.take(a);assert.equal(r.value.chunk.data,'😀'.repeat(8192));assert.equal(r.value.chunk.utf8Bytes,32768);assert.equal(p.take(a).value.chunk.data,'😀');
 const before=p.stats();for(const request of [{leaseId:'bad/id',generation:2,fromSequence:0},{leaseId:'fresh',generation:2,fromSequence:1},{leaseId:'fresh',generation:2,fromSequence:999999}])assert.equal(p.attach('s1',request).code,'REQUEST_REFUSED');assert.deepEqual(p.stats(),before);
 assert.equal(p.ack(a,1).code,'REQUEST_REFUSED');assert.equal(p.ack(a,32772).value.releasedUtf8Bytes,32772);assert.equal(p.take(a).value.chunk,null);
});

test('one-byte frame floods have bounded metadata and clearing history never clears outstanding frames',()=>{
 const p=fixture(),a=attach(p);for(let i=0;i<256;i++){p.append('s1','x');assert.equal(p.take(a).ok,true);}p.append('s1','y');assert.equal(p.take(a).code,'CAPACITY_EXCEEDED');assert.equal(p.stats().frames,256);
 assert.equal(p.clear('s1').ok,true);assert.equal(p.stats().retainedUtf8Bytes,0);assert.equal(p.stats().outstandingUtf8Bytes,256);assert.equal(p.take(a).code,'CAPACITY_EXCEEDED');p.ack(a,256);const gap=p.take(a);assert.equal(gap.value.chunk,null);assert.equal(gap.value.gap.droppedUtf8Bytes,1);assert.equal(p.take(a).value.gap,null);
});

test('split Unicode blocks preserve every byte and ACK boundary without hidden cursor advances',()=>{
 const p=fixture(),text='ab'+'😀'.repeat(16385)+'z';p.append('s1',text);const a=attach(p);let decoded='',offset=0;
 for(let i=0;i<10;i++){const r=p.take(a);assert.equal(r.ok,true);const chunk=r.value.chunk;if(!chunk)break;assert.equal(chunk.sequence,offset);assert.equal(chunk.data.isWellFormed(),true);assert.equal(chunk.utf8Bytes,Buffer.byteLength(chunk.data));assert.ok(chunk.utf8Bytes<=32768);decoded+=chunk.data;offset+=chunk.utf8Bytes;assert.equal(p.ack(a,offset).ok,true);}
 assert.equal(decoded,text);assert.equal(offset,65543);assert.equal(p.stats().outstandingUtf8Bytes,0);
});

test('forged attachment fields and accessor payloads have zero effects on current streams',()=>{
 const p=fixture();p.register('s2');p.append('s1','live');const a=attach(p);p.take(a);const before=p.stats();let reads=0;
 const accessor={generation:2,fromSequence:0};Object.defineProperty(accessor,'leaseId',{enumerable:true,get(){reads++;return 'evil';}});
 assert.equal(p.attach('s1',accessor).code,'REQUEST_REFUSED');assert.equal(reads,0);
 assert.equal(p.attach('s2',{leaseId:'lease1',generation:2,fromSequence:0}).code,'REQUEST_REFUSED');
 assert.equal(p.take({...a,extra:true}).code,'LEASE_STALE');assert.equal(p.ack({...a,sessionId:'s2'},4).code,'LEASE_STALE');assert.deepEqual(p.stats(),before);
 assert.equal(p.ack(a,4).value.releasedUtf8Bytes,4);assert.equal(p.append('missing','x').code,'SESSION_REFUSED');assert.equal(p.append('s1','\ud800').code,'REQUEST_REFUSED');
});
