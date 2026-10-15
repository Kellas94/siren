import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {TerminalCreatorHistory} from '../src/terminal/remote-output.mjs';
import {TerminalProductionAttachmentOutput} from '../src/terminal/production-attachment-output.mjs';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const held=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const frame=(data='AΩ😀',firstSequence=0,endSequence=firstSequence+Buffer.byteLength(data))=>({firstSequence,endSequence,chunk:data?{sequence:firstSequence,data,utf8Bytes:Buffer.byteLength(data)}:null});
const request=(sessionId='s1',generation=1,extra={})=>({sessionId,leaseId:`l${generation}`,generation,fromSequence:0,windowId:'w1',projectId:'p1',epoch:1,accessGeneration:0,...extra});
function fixture({deadlineMs=100,reader}={}){
 const history=new TerminalCreatorHistory('s1');history.append('AΩ😀');let calls=0,last;
 const output=new TerminalProductionAttachmentOutput({deadlineMs});
 assert.equal(output.nativeExecutionAdmitted,false);
 assert.equal(output.register({sessionId:'s1',ownerId:'o1',readHistory:q=>{calls++;last=q;return reader?reader(q):Promise.resolve(history.read({sessionId:'s1',fromSequence:q.fromSequence,maxBytes:q.maxBytes}));}}).ok,true);
 let current=true;const admission={isCurrent:()=>current};output.resumeViews();
 return {output,history,admission,invalidate:()=>{current=false;},calls:()=>calls,last:()=>last};
}
const prepared=async f=>{const r=await f.output.prepare(request(),f.admission);assert.equal(r.ok,true);return r.value.candidateTicket;};

test('initial history is privately credited once with exact same-read bounds and owner',async()=>{
 const f=fixture();const result=await f.output.prepare(request(),f.admission);
 assert.equal(result.ok,true);assert.deepEqual(Object.keys(result.value).sort(),['candidateTicket','endSequence','firstSequence']);
 assert.equal(result.value.firstSequence,0);assert.equal(result.value.endSequence,7);assert.equal(f.calls(),1);
 assert.deepEqual(f.last(),{ownerId:'o1',fromSequence:0,maxBytes:32768});
 assert.ok(Object.isFrozen(result.value.candidateTicket));assert.equal(Reflect.ownKeys(result.value.candidateTicket).length,0);
 assert.equal(f.output.status('s1').heldInitial,true);assert.equal(f.output.stats().outstandingUtf8Bytes,7);
 assert.equal(f.output.stats().reservedUtf8Bytes,0);assert.equal(f.output.status('s1').pendingActualReads,0);
});
test('private prefetch cannot be ACKed and handoff exposes the initial frame exactly once',async()=>{
 const f=fixture(),candidate=await prepared(f);
 assert.equal(f.output.ack(candidate,{throughSequence:7}).ok,false);assert.equal(f.output.stats().outstandingUtf8Bytes,7);
 const h=f.output.handoffInitial(candidate);assert.equal(h.ok,true);assert.equal(h.value.chunk.data,'AΩ😀');
 assert.ok(h.value.readTicket);assert.equal(f.output.handoffInitial(candidate).ok,false);assert.equal(f.calls(),1);
 assert.equal(f.output.ack(h.value.readTicket,{throughSequence:7}).ok,true);assert.equal(f.output.stats().outstandingUtf8Bytes,0);
 assert.equal(f.output.ack(h.value.readTicket,{throughSequence:7}).ok,false);assert.equal(f.output.status('s1').retainedReadTickets,0);
});
test('ACK must match the actual frame end, never ring highwater or partial scalar',async()=>{
 const f=fixture({reader:()=>Promise.resolve(frame('AΩ😀',0,99))}),c=await prepared(f),h=f.output.handoffInitial(c).value;
 for(const n of [1,3,6,8,99])assert.equal(f.output.ack(h.readTicket,{throughSequence:n}).ok,false);
 assert.equal(f.output.stats().outstandingUtf8Bytes,7);assert.equal(f.output.ack(h.readTicket,{throughSequence:7}).ok,true);
});
test('subsequent history starts at credited first-frame end without skipping or duplicating it',async()=>{
 const f=fixture(),c=await prepared(f);assert.equal(f.history.append('tail').ok,true);
 assert.equal((await f.output.read(c)).ok,false); // Initial handoff must precede another read.
 const first=f.output.handoffInitial(c).value;assert.equal(first.chunk.data,'AΩ😀');
 const next=await f.output.read(c);assert.equal(next.ok,true);assert.equal(next.value.chunk.data,'tail');assert.equal(next.value.chunk.sequence,7);
 assert.equal(f.calls(),2);assert.equal(f.output.ack(next.value.readTicket,{throughSequence:11}).ok,true);
 assert.equal(f.output.stats().outstandingUtf8Bytes,0);assert.equal(f.output.ack(first.readTicket,{throughSequence:7}).ok,false);
});
test('empty initial/subsequent history retains no read-ticket metadata',async()=>{
 const f=fixture({reader:()=>Promise.resolve(frame(''))}),c=await prepared(f);
 const first=f.output.handoffInitial(c).value;assert.equal(first.chunk,null);assert.equal(first.readTicket,null);assert.equal(first.firstSequence,0);assert.equal(first.endSequence,0);
 for(let i=0;i<300;i++){const r=await f.output.read(c);assert.equal(r.ok,true);assert.equal(r.value.readTicket,null);}
 assert.equal(f.output.status('s1').retainedReadTickets,0);assert.equal(f.output.stats().frames,0);
});
test('large actual Unicode creator history yields exact gap and bounded credited frame',async()=>{
 const f=fixture();for(let i=0;i<150;i++)assert.equal(f.history.append('😀Ω'.repeat(5000)).ok,true);
 const r=await f.output.prepare(request(),f.admission);assert.equal(r.ok,true);assert.ok(r.value.firstSequence>0);
 const h=f.output.handoffInitial(r.value.candidateTicket).value;assert.equal(h.gap.resumeSequence,r.value.firstSequence);assert.equal(h.gap.droppedUtf8Bytes,r.value.firstSequence);
 assert.equal(h.chunk.sequence,r.value.firstSequence);assert.ok(h.chunk.utf8Bytes<=32768);assert.equal(Buffer.byteLength(h.chunk.data),h.chunk.utf8Bytes);assert.ok(h.chunk.data.isWellFormed());
 assert.equal(h.endSequence,f.history.stats().nextSequence);assert.equal(f.calls(),1);
});
test('per-attachment 256 KiB cap refuses ninth 32 KiB frame until exact handed-off ACK',async()=>{
 const f=fixture({reader:q=>Promise.resolve(frame('x'.repeat(q.maxBytes),q.fromSequence,q.fromSequence+q.maxBytes+1))}),c=await prepared(f);
 let latest=f.output.handoffInitial(c).value;for(let i=1;i<8;i++){const r=await f.output.read(c);assert.equal(r.ok,true);latest=r.value;}
 assert.equal(f.output.stats().outstandingUtf8Bytes,262144);assert.equal(f.output.status('s1').retainedReadTickets,8);
 assert.equal((await f.output.read(c)).code,'CAPACITY_EXCEEDED');assert.equal(f.calls(),8);
 assert.equal(f.output.ack(latest.readTicket,{throughSequence:262144}).ok,true);assert.equal(f.output.status('s1').retainedReadTickets,0);
 assert.equal((await f.output.read(c)).ok,true);
});
test('eight sessions use one 2 MiB shared pool including held reservations',async()=>{
 const output=new TerminalProductionAttachmentOutput({deadlineMs:100});output.resumeViews();const candidates=[];let calls=0;
 for(let i=0;i<8;i++){
  const sessionId=`s${i}`,ownerId=`o${i}`;output.register({sessionId,ownerId,readHistory:q=>{calls++;assert.ok(output.stats().outstandingUtf8Bytes+output.stats().reservedUtf8Bytes<=2097152);return Promise.resolve(frame('x'.repeat(q.maxBytes),q.fromSequence,q.fromSequence+q.maxBytes+1));}});
  const r=await output.prepare(request(sessionId,i+1),{isCurrent:()=>true});assert.equal(r.ok,true);const c=r.value.candidateTicket;candidates.push(c);output.handoffInitial(c);
  for(let n=1;n<8;n++)assert.equal((await output.read(c)).ok,true);
 }
 assert.equal(output.stats().outstandingUtf8Bytes,2097152);assert.equal(calls,64);assert.equal((await output.read(candidates[0])).code,'CAPACITY_EXCEEDED');
});
for(const transition of ['lock','retire'])test(`${transition} suppresses late bytes and retains raw read plus exact pool pending`,async()=>{
 const waiting=held(),f=fixture({reader:()=>waiting.promise});const preparing=f.output.prepare(request(),f.admission);
 assert.equal(f.output.status('s1').pendingActualReads,1);assert.equal(f.output.status('s1').poolPendingRead,true);
 if(transition==='lock')f.output.suspendViews();else f.output.retire('s1');
 assert.equal((await preparing).ok,false);assert.equal(f.output.stats().reservedUtf8Bytes,32768);assert.equal(f.output.status('s1').pendingActualReads,1);
 waiting.resolve(frame());await tick();f.output.reconcile();assert.equal(f.output.stats().reservedUtf8Bytes,0);assert.equal(f.output.stats().outstandingUtf8Bytes,0);
 if(transition==='retire')assert.equal(f.output.status('s1'),null);else assert.equal(f.output.status('s1').poolPendingRead,false);
});
test('detach of a disclosed candidate retains an outstanding subsequent read and blocks replacement',async()=>{
 const waiting=held();let n=0;const f=fixture({reader:()=>++n===1?Promise.resolve(frame()):waiting.promise}),c=await prepared(f);f.output.handoffInitial(c);
 const reading=f.output.read(c);assert.equal(f.output.detach(c).ok,true);assert.equal((await reading).ok,false);
 assert.equal((await f.output.prepare(request('s1',2),f.admission)).code,'CAPACITY_EXCEEDED');assert.equal(f.calls(),2);assert.equal(f.output.stats().reservedUtf8Bytes,32768);
 waiting.resolve(frame('tail',7));await tick();assert.equal(f.output.status('s1').pendingActualReads,0);assert.equal(f.output.status('s1').poolPendingRead,false);
 const replacement=await f.output.prepare(request('s1',2),f.admission);assert.equal(replacement.ok,true);assert.equal(f.output.handoffInitial(c).ok,false);
});
test('timeout cannot release still-held reader or admit replacement',async()=>{
 const waiting=held(),f=fixture({deadlineMs:15,reader:()=>waiting.promise});assert.equal((await f.output.prepare(request(),f.admission)).ok,false);
 assert.equal(f.output.status('s1').pendingActualReads,1);assert.equal(f.output.status('s1').poolPendingRead,true);assert.equal(f.output.stats().reservedUtf8Bytes,32768);
 assert.equal((await f.output.prepare(request('s1',2),f.admission)).code,'CAPACITY_EXCEEDED');assert.equal(f.calls(),1);
 waiting.resolve(frame());await tick();assert.equal(f.output.status('s1').pendingActualReads,0);assert.equal(f.output.stats().reservedUtf8Bytes,0);
});
test('eight retiring held readers refuse lifetime ninth until actual pool settlement',async()=>{
 const output=new TerminalProductionAttachmentOutput({deadlineMs:100}),waits=[];output.resumeViews();const pending=[];
 for(let i=0;i<8;i++){const w=held();waits.push(w);output.register({sessionId:`s${i}`,ownerId:`o${i}`,readHistory:()=>w.promise});pending.push(output.prepare(request(`s${i}`,i+1),{isCurrent:()=>true}));output.retire(`s${i}`);}
 await Promise.all(pending);assert.equal(output.register({sessionId:'ninth',ownerId:'o9',readHistory:()=>Promise.resolve(frame())}).code,'CAPACITY_EXCEEDED');
 assert.equal(output.stats().reservedUtf8Bytes,8*32768);waits[0].resolve(frame());await tick();output.reconcile();
 assert.equal(output.register({sessionId:'ninth',ownerId:'o9',readHistory:()=>Promise.resolve(frame())}).ok,true);
 for(let i=1;i<8;i++)waits[i].resolve(frame());await tick();output.reconcile();
});
test('stale admission cannot handoff/read/ACK/detach a frame and does not regain authority',async()=>{
 const f=fixture(),c=await prepared(f),first=f.output.handoffInitial(c).value;f.invalidate();
 assert.equal(f.output.ack(first.readTicket,{throughSequence:7}).ok,false);assert.equal((await f.output.read(c)).ok,false);assert.equal(f.output.detach(c).ok,false);
 assert.equal(f.calls(),1);assert.equal(f.output.stats().outstandingUtf8Bytes,0);
});
test('Lock at guard callback prevents history dispatch and publication',async()=>{
 const f=fixture();let n=0;const r=await f.output.prepare(request(),{isCurrent:()=>{if(++n===2)f.output.suspendViews();return true;}});
 assert.equal(r.ok,false);assert.equal(f.calls(),0);assert.equal(f.output.stats().reservedUtf8Bytes,0);
});
test('Lock reentered by history reader suppresses initial result while actual work remains charged',async()=>{
 const waiting=held();let f;f=fixture({reader:()=>{f.output.suspendViews();return waiting.promise;}});
 const p=f.output.prepare(request(),f.admission);assert.equal((await p).ok,false);assert.equal(f.output.status('s1').pendingActualReads,1);assert.equal(f.output.stats().reservedUtf8Bytes,32768);
 waiting.resolve(frame());await tick();assert.equal(f.output.stats().reservedUtf8Bytes,0);
});
test('resume after Lock never resurrects candidate/read tickets',async()=>{
 const f=fixture(),c=await prepared(f),h=f.output.handoffInitial(c).value;f.output.suspendViews();f.output.resumeViews();
 assert.equal(f.output.handoffInitial(c).ok,false);assert.equal(f.output.ack(h.readTicket,{throughSequence:7}).ok,false);assert.equal((await f.output.read(c)).ok,false);
 assert.equal((await f.output.prepare(request('s1',2),f.admission)).ok,true);
});
test('copied opaque candidates/read tickets and cross-session identities are refused',async()=>{
 const f=fixture(),c=await prepared(f),h=f.output.handoffInitial(c).value;
 for(const bad of [{...c},Object.create(c),new Proxy(c,{})]){assert.equal(f.output.handoffInitial(bad).ok,false);assert.equal((await f.output.read(bad)).ok,false);assert.equal(f.output.detach(bad).ok,false);}
 for(const bad of [{...h.readTicket},Object.create(h.readTicket),new Proxy(h.readTicket,{})])assert.equal(f.output.ack(bad,{throughSequence:7}).ok,false);
 assert.equal(f.output.stats().outstandingUtf8Bytes,7);
});
test('request/guard accessors and proxies invoke no getters, callbacks or reader',async()=>{
 const f=fixture();let calls=0;const accessor={...request()};Object.defineProperty(accessor,'epoch',{enumerable:true,get(){calls++;return 1;}});
 for(const q of [accessor,new Proxy(request(),{get(){calls++;return 1;}}),{...request(),extra:true}])assert.equal((await f.output.prepare(q,f.admission)).ok,false);
 assert.equal((await f.output.prepare(request(),{get isCurrent(){calls++;return ()=>true;}})).ok,false);
 assert.equal((await f.output.prepare(request(),new Proxy(f.admission,{get(){calls++;return ()=>true;}}))).ok,false);
 assert.equal(calls,0);assert.equal(f.calls(),0);
});
test('strict native reader Promise is observed without a shadow then accessor',async()=>{
 const waiting=held();let touches=0;Object.defineProperty(waiting.promise,'then',{get(){touches++;throw Error('OWN_THEN');}});
 const f=fixture({reader:()=>waiting.promise}),p=f.output.prepare(request(),f.admission);assert.equal(f.output.status('s1').pendingActualReads,1);
 waiting.resolve(frame());assert.equal((await p).ok,true);assert.equal(touches,0);assert.equal(f.output.status('s1').pendingActualReads,0);
});
test('actual raw-reader finish does not falsely settle the still-pending pool continuation',async()=>{
 const waiting=held(),f=fixture({reader:()=>waiting.promise}),preparing=f.output.prepare(request(),f.admission);let observed;
 waiting.promise.then(()=>{observed=f.output.status('s1');});waiting.resolve(frame());assert.equal((await preparing).ok,true);
 assert.equal(observed.pendingActualReads,0);assert.equal(observed.poolPendingRead,true);assert.equal(observed.settled,false);
 assert.equal(f.output.status('s1').settled,true);
});
test('reentrant prepare/read callbacks see an already reserved candidate/read operation',async()=>{
 const f=fixture();let nestedPrepare;const admission={isCurrent:()=>{if(!nestedPrepare)nestedPrepare=f.output.prepare(request('s1',2),f.admission);return true;}};
 const result=await f.output.prepare(request(),admission);assert.equal(result.ok,true);assert.equal((await nestedPrepare).code,'CAPACITY_EXCEEDED');assert.equal(f.calls(),1);
 const c=result.value.candidateTicket;f.output.handoffInitial(c);f.history.append('tail');f.output.detach(c);
 let nestedRead=null,active=false,c2;const scope={isCurrent:()=>{if(active&&!nestedRead)nestedRead=f.output.read(c2);return true;}};
 c2=(await f.output.prepare(request('s1',2),scope)).value.candidateTicket;f.output.handoffInitial(c2);active=true;
 assert.equal((await f.output.read(c2)).ok,true);assert.equal((await nestedRead).code,'CAPACITY_EXCEEDED');
});
test('non-Promise/thenable reader output fails closed without invoking then',async()=>{
 let touches=0;const f=fixture({deadlineMs:15,reader:()=>({get then(){touches++;return ()=>{};}})});assert.equal((await f.output.prepare(request(),f.admission)).ok,false);
 assert.equal(touches,0);assert.equal(f.output.status('s1').pendingActualReads,1);assert.equal(f.output.status('s1').quarantinedRead,true);assert.equal(f.output.stats().reservedUtf8Bytes,32768);
});
test('observed rejected/malformed history cannot disclose bytes or retain false credit',async()=>{
 for(const reader of [()=>Promise.reject(Error('reader')),()=>Promise.resolve({...frame(),extra:true}),()=>Promise.resolve(frame('\ud800'))]){
  const f=fixture({reader});assert.equal((await f.output.prepare(request(),f.admission)).ok,false);await tick();assert.equal(f.output.stats().outstandingUtf8Bytes,0);assert.equal(f.output.stats().reservedUtf8Bytes,0);assert.equal(f.output.status('s1').pendingActualReads,0);
 }
});
test('effectful reader throw has no settlement proof and retains finite quarantine',async()=>{
 const f=fixture({deadlineMs:15,reader:()=>{throw Error('unknown reader side effect');}});assert.equal((await f.output.prepare(request(),f.admission)).ok,false);
 assert.equal(f.output.status('s1').quarantinedRead,true);assert.equal(f.output.status('s1').pendingActualReads,1);assert.equal(f.output.stats().reservedUtf8Bytes,32768);
 f.output.retire('s1');assert.equal(f.output.status('s1').settled,false);assert.equal(f.output.stats().retiringCreators,1);
});
test('Promise subclass is unobservable under the strict reader contract and stays quarantined',async()=>{
 class AlternatePromise extends Promise{}let resolve;const actual=new AlternatePromise(yes=>resolve=yes),f=fixture({deadlineMs:15,reader:()=>actual});
 assert.equal((await f.output.prepare(request(),f.admission)).ok,false);resolve(frame());await tick();assert.equal(f.output.status('s1').quarantinedRead,true);assert.equal(f.output.status('s1').pendingActualReads,1);
});
test('registered reader/constructor/accessor rejection is inert and default views are closed',async()=>{
 let touched=0;assert.throws(()=>new TerminalProductionAttachmentOutput({get deadlineMs(){touched++;return 10;}}));
 const output=new TerminalProductionAttachmentOutput({deadlineMs:100});assert.equal(output.register({sessionId:'s1',ownerId:'o1',get readHistory(){touched++;return ()=>Promise.resolve(frame());}}).ok,false);
 assert.equal(output.register({sessionId:'s1',ownerId:'o1',readHistory:()=>Promise.resolve(frame())}).ok,true);
 assert.equal((await output.prepare(request(),{isCurrent:()=>true})).code,'PIN_REQUIRED');assert.equal(touched,0);
});
test('one retained owner cannot be registered to two Sessions, including retiring held reads',async()=>{
 const waiting=held(),f=fixture({reader:()=>waiting.promise});
 assert.equal(f.output.register({sessionId:'s2',ownerId:'o1',readHistory:()=>Promise.resolve(frame())}).code,'REQUEST_REFUSED');
 const p=f.output.prepare(request(),f.admission);f.output.retire('s1');await p;
 assert.equal(f.output.register({sessionId:'s2',ownerId:'o1',readHistory:()=>Promise.resolve(frame())}).code,'REQUEST_REFUSED');
 waiting.resolve(frame());await tick();f.output.reconcile();
 assert.equal(f.output.register({sessionId:'s2',ownerId:'o1',readHistory:()=>Promise.resolve(frame())}).ok,true);
});
test('effectful unobservable native Promise result retains a quarantined read and pool reservation',async()=>{
 const waiting=held();let touched=0;Object.defineProperty(waiting.promise,'constructor',{get(){touched++;throw Error('SPECIES');}});
 const f=fixture({deadlineMs:15,reader:()=>waiting.promise});assert.equal((await f.output.prepare(request(),f.admission)).ok,false);
 assert.equal(touched,0);assert.equal(f.output.status('s1').quarantinedRead,true);assert.equal(f.output.status('s1').pendingActualReads,1);assert.equal(f.output.status('s1').poolPendingRead,true);
 assert.equal(f.output.stats().reservedUtf8Bytes,32768);waiting.resolve(frame());await tick();
 assert.equal(f.output.status('s1').quarantinedRead,true);assert.equal(f.output.status('s1').settled,false);
 f.output.retire('s1');f.output.reconcile();assert.equal(f.output.status('s1').retiring,true);assert.equal(f.output.stats().reservedUtf8Bytes,32768);
});
test('256 tiny handed-off frames cap read-ticket metadata even below byte ceiling',async()=>{
 const f=fixture({reader:q=>Promise.resolve(frame('x',q.fromSequence,q.fromSequence+2))}),c=await prepared(f);let last=f.output.handoffInitial(c).value;
 for(let i=1;i<256;i++){const r=await f.output.read(c);assert.equal(r.ok,true);last=r.value;}
 assert.equal(f.output.status('s1').retainedReadTickets,256);assert.equal((await f.output.read(c)).code,'CAPACITY_EXCEEDED');assert.equal(f.calls(),256);
 assert.equal(f.output.ack(last.readTicket,{throughSequence:256}).ok,true);assert.equal(f.output.status('s1').retainedReadTickets,0);
});
test('held retired candidate and ACKed read keys do not retain readers after settled retirement',()=>{
 const moduleUrl=new URL('../src/terminal/production-attachment-output.mjs',import.meta.url).href;
 const script=`
  import assert from 'node:assert/strict';
  import {TerminalProductionAttachmentOutput} from ${JSON.stringify(moduleUrl)};
  const output=new TerminalProductionAttachmentOutput({deadlineMs:100});output.resumeViews();
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  async function retired(n,hold,pending=false){
   let resolve,calls=0;const waiting=new Promise(yes=>resolve=yes);
   const reader=q=>++calls===1?Promise.resolve({firstSequence:0,endSequence:1,chunk:{sequence:0,data:'x',utf8Bytes:1}}):waiting;
   const weakReader=new WeakRef(reader),sessionId='s'+n;
   assert.equal(output.register({sessionId,ownerId:'o'+n,readHistory:reader}).ok,true);
   const prepared=await output.prepare({sessionId,leaseId:'l'+n,generation:n,fromSequence:0,windowId:'w1',projectId:'p1',epoch:1,accessGeneration:0},{isCurrent:()=>true});
   assert.equal(prepared.ok,true);const candidate=prepared.value.candidateTicket,first=output.handoffInitial(candidate).value;
   assert.equal(output.ack(first.readTicket,{throughSequence:1}).ok,true);
   if(pending){const reading=output.read(candidate);assert.equal(output.detach(candidate).ok,true);assert.equal(output.retire(sessionId).ok,true);assert.equal((await reading).ok,false);resolve({firstSequence:0,endSequence:2,chunk:{sequence:1,data:'y',utf8Bytes:1}});await tick();output.reconcile();}
   else assert.equal(output.retire(sessionId).ok,true);
   assert.equal(output.status(sessionId),null);
   return {weakReader,ticket:hold==='candidate'?candidate:hold==='read'?first.readTicket:null};
  }
  const control=await retired(1,null),candidate=await retired(2,'candidate'),read=await retired(3,'read'),pending=await retired(4,'candidate',true);
  for(let i=0;i<20;i++){await tick();globalThis.gc();}
  console.log(JSON.stringify({control:!!control.weakReader.deref(),candidate:!!candidate.weakReader.deref(),read:!!read.weakReader.deref(),pending:!!pending.weakReader.deref(),held:[!!candidate.ticket,!!read.ticket,!!pending.ticket],stats:output.stats()}));
 `;
 const child=spawnSync(process.execPath,['--expose-gc','--input-type=module','--eval',script],{encoding:'utf8',maxBuffer:1024*1024});
 assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout.trim());
 assert.equal(result.control,false,'GC negative control must actually be collected');assert.deepEqual(result.held,[true,true,true]);
 assert.equal(result.stats.ownerRecords,0);assert.equal(result.stats.frames,0);assert.equal(result.stats.reservedUtf8Bytes,0);
 assert.equal(result.candidate,false,'held retired candidate must not retain reader');assert.equal(result.read,false,'held ACKed read key must not retain reader');assert.equal(result.pending,false,'settled canceled read must not be retained by old candidate');
});
