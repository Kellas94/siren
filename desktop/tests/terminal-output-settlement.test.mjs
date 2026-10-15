import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {TerminalProductionRemoteOutput as Pool} from '../src/terminal/production-remote-output.mjs';
import {TerminalProductionAttachmentOutput as Facet} from '../src/terminal/production-attachment-output.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const held=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const frame=(data='AΩ😀',sequence=0)=>({firstSequence:sequence,endSequence:sequence+Buffer.byteLength(data),chunk:data?{sequence,data,utf8Bytes:Buffer.byteLength(data)}:null});
const token=(s='s1',g=1)=>({sessionId:s,leaseId:`l${g}`,generation:g});
const request=(s='s1',g=1)=>({...token(s,g),fromSequence:0,windowId:'w1',projectId:'p1',epoch:1,accessGeneration:0});
const keys=(v,expected)=>assert.deepEqual(Reflect.ownKeys(v).sort(),expected.sort());
const pending=async p=>{let done=false;Reflect.apply(Promise.prototype.then,p,[()=>{done=true;},()=>{done=true;}]);await tick();assert.equal(done,false);};
function poolFixture(reader=()=>frame(),deadlineMs=50){const output=new Pool({deadlineMs});output.resumeViews();assert.equal(output.register('s1',reader).ok,true);assert.equal(output.attach('s1',{leaseId:'l1',generation:1,fromSequence:0}).ok,true);return output;}
function facetFixture(reader=()=>Promise.resolve(frame()),deadlineMs=50){const output=new Facet({deadlineMs});output.resumeViews();assert.equal(output.register({sessionId:'s1',ownerId:'o1',readHistory:reader}).ok,true);return output;}
const poolHandle=p=>p.captureSourceSettlement('s1'),facetHandle=p=>p.captureOutputSettlement({sessionId:'s1',ownerId:'o1'});

test('pool passive stable handle and roster have exact immutable output-only schemas',async()=>{
 assert.equal(typeof Pool.prototype.captureSourceSettlement,'function');assert.equal(typeof Pool.prototype.captureSourceSettlementRoster,'function');
 let calls=0;const output=poolFixture(()=>{calls++;return frame();}),h=poolHandle(output);
 assert.equal(h,poolHandle(output));assert.ok(Object.isFrozen(h));keys(h,['sessionId','actualSettled','snapshot']);
 const s=h.snapshot();assert.ok(Object.isFrozen(s));assert.ok(Object.isFrozen(s.read));keys(s,['sessionId','retired','actualSettled','unknown','activeFrames','takeWorkers','continuations','reservedUtf8Bytes','read','nativeExecutionAdmitted']);
 keys(s.read,['entered','pending','handlerSettled','unknown','mode']);assert.equal(calls,0);assert.equal(s.actualSettled,false);await pending(h.actualSettled);
 const roster=output.captureSourceSettlementRoster();assert.ok(Object.isFrozen(roster));assert.equal(roster[0],h);assert.notEqual(roster,output.captureSourceSettlementRoster());
 output.suspendViews();await pending(h.actualSettled);output.retire('s1');
 const receipt=await h.actualSettled;assert.ok(Object.isFrozen(receipt));assert.deepEqual(receipt,{scope:'OUTPUT_POOL_SOURCE',sessionId:'s1',actualSettled:true,nativeExecutionAdmitted:false});
 assert.equal(h.snapshot().actualSettled,true);assert.equal(poolHandle(output),null);assert.equal(output.captureSourceSettlementRoster().length,0);assert.equal(calls,0);
});
test('facet passive stable exact-owner handle and roster have exact immutable schemas',async()=>{
 assert.equal(typeof Facet.prototype.captureOutputSettlement,'function');assert.equal(typeof Facet.prototype.captureOutputSettlementRoster,'function');
 let calls=0;const output=facetFixture(()=>{calls++;return Promise.resolve(frame());}),h=facetHandle(output);assert.equal(h,facetHandle(output));assert.ok(Object.isFrozen(h));
 keys(h,['sessionId','ownerId','actualSettled','snapshot']);const s=h.snapshot();keys(s,['sessionId','ownerId','retired','actualSettled','unknown','activeFrames','facetWorkers','rawRead','poolSettled','candidatePresent','retainedReadTickets','nativeExecutionAdmitted']);keys(s.rawRead,['entered','pending','handlerSettled','unknown']);assert.ok(Object.isFrozen(s.rawRead));
 assert.equal(output.captureOutputSettlement({sessionId:'s1',ownerId:'wrong'}),null);assert.equal(output.captureOutputSettlementRoster()[0],h);assert.equal(calls,0);await pending(h.actualSettled);
 output.suspendViews();await pending(h.actualSettled);output.retire('s1');assert.deepEqual(await h.actualSettled,{scope:'OUTPUT_SOURCE',sessionId:'s1',ownerId:'o1',actualSettled:true,nativeExecutionAdmitted:false});assert.equal(facetHandle(output),null);assert.equal(calls,0);
});
test('new capture inputs and extra arguments reject with zero Proxy/accessor callbacks',()=>{
 assert.equal(typeof Facet.prototype.captureOutputSettlement,'function');const f=facetFixture(),p=poolFixture();let traps=0;
 const accessor={sessionId:'s1',get ownerId(){traps++;return 'o1';}},proxy=new Proxy({sessionId:'s1',ownerId:'o1'},{getPrototypeOf(){traps++;return Object.prototype;},ownKeys(){traps++;return [];},getOwnPropertyDescriptor(){traps++;return null;}});
 for(const value of [accessor,proxy,{sessionId:'s1',ownerId:'o1',extra:1}])assert.equal(f.captureOutputSettlement(value),null);
 assert.equal(f.captureOutputSettlement({sessionId:'s1',ownerId:'o1'},true),null);assert.equal(f.captureOutputSettlementRoster(true),null);assert.equal(p.captureSourceSettlement(proxy),null);assert.equal(p.captureSourceSettlement('s1',true),null);assert.equal(p.captureSourceSettlementRoster(true),null);assert.equal(traps,0);f.retire('s1');p.retire('s1');
});
for(const change of ['detach','timeout'])test(`pool ${change} public completion cannot settle held original or permit same-ID reuse`,async()=>{
 assert.equal(typeof Pool.prototype.captureSourceSettlement,'function');const d=held(),output=poolFixture(()=>d.promise,15),h=poolHandle(output),work=output.takeWithBounds(token());
 if(change==='detach')output.detach(token());assert.equal((await work).ok,false);output.retire('s1');
 await pending(h.actualSettled);const s=h.snapshot();assert.equal(s.read.pending,true);assert.equal(s.reservedUtf8Bytes,32768);assert.equal(output.register('s1',()=>frame()).code,'CAPACITY_EXCEEDED');
 d.resolve(frame());await h.actualSettled;assert.equal(output.stats().reservedUtf8Bytes,0);assert.equal(output.register('s1',()=>frame()).ok,true);assert.notEqual(poolHandle(output),h);output.retire('s1');
});
test('facet held raw and complete outer worker remain owned beyond public retirement failure',async()=>{
 assert.equal(typeof Facet.prototype.captureOutputSettlement,'function');const d=held(),output=facetFixture(()=>d.promise),h=facetHandle(output),work=output.prepare(request(),{isCurrent:()=>true});
 output.retire('s1');assert.equal((await work).ok,false);await pending(h.actualSettled);assert.equal(h.snapshot().rawRead.pending,true);assert.equal(h.snapshot().poolSettled,false);
 d.resolve(frame());await h.actualSettled;const s=h.snapshot();assert.equal(s.rawRead.handlerSettled,true);assert.equal(s.facetWorkers,0);assert.equal(s.activeFrames,0);assert.equal(s.poolSettled,true);assert.equal(output.stats().outstandingUtf8Bytes,0);assert.equal(output.status('s1'),null);
});
for(const type of ['sync-data','native-promise','rejected','malformed'])test(`pool ${type} reader is settled work after retirement with no invented native authority`,async()=>{
 assert.equal(typeof Pool.prototype.captureSourceSettlement,'function');const output=poolFixture(()=>type==='sync-data'?frame():type==='native-promise'?Promise.resolve(frame()):type==='rejected'?Promise.reject(Error('fixture')):({...frame(),extra:true})),h=poolHandle(output);
 const result=await output.takeWithBounds(token());assert.equal(result.ok,['sync-data','native-promise'].includes(type));output.retire('s1');await h.actualSettled;assert.equal(h.snapshot().unknown,false);assert.equal(h.snapshot().reservedUtf8Bytes,0);
});
test('accepted policy: entered pool throw retains unknown source/read/byte charge and first failure',async()=>{
 let entered=0;const output=poolFixture(()=>{entered++;throw Error('entered');},15);assert.equal((await output.takeWithBounds(token())).code,'HOST_UNAVAILABLE');
 assert.equal(output.stats().reservedUtf8Bytes,32768,'explicit conservative policy change');assert.equal(entered,1);const h=poolHandle(output);output.retire('s1');await pending(h.actualSettled);assert.equal(h.snapshot().unknown,true);assert.equal(h.snapshot().read.unknown,true);assert.equal(output.register('s1',()=>frame()).code,'CAPACITY_EXCEEDED');
});
for(const mutation of ['inherited-constructor','species'])test(`literal prepared strict reflection oracle: ${mutation} zero getters`,async()=>{
 const d=held(),stacks=[];let entered=0;const target=mutation==='inherited-constructor'?Promise.prototype:Promise,key=mutation==='inherited-constructor'?'constructor':Symbol.species,original=Object.getOwnPropertyDescriptor(target,key);
 const output=poolFixture(()=>{entered++;Object.defineProperty(target,key,{configurable:true,enumerable:original.enumerable,get(){stacks.push(new Error('fixture getter executed').stack);return Promise;}});return d.promise;});let work;
 try{work=output.takeWithBounds(token());}finally{Object.defineProperty(target,key,original);}
 d.resolve(frame());const result=await work;output.retire('s1');assert.equal(entered,1);assert.equal(stacks.length,0);assert.equal(result.ok,false);const h=poolHandle(output);assert.equal(h.snapshot().unknown,true);await pending(h.actualSettled);
});
test('pool original own then getter is ignored and legal rejection is completed-negative',async()=>{
 assert.equal(typeof Pool.prototype.captureSourceSettlement,'function');const d=held();let traps=0;Object.defineProperty(d.promise,'then',{get(){traps++;throw Error('OWN_THEN');}});const output=poolFixture(()=>d.promise),h=poolHandle(output),work=output.takeWithBounds(token());d.reject(Error('negative'));assert.equal((await work).ok,false);output.retire('s1');await h.actualSettled;assert.equal(traps,0);assert.equal(h.snapshot().unknown,false);
});
test('known-source pool result normalization keeps exact retirement frame through callback unwind',async()=>{
 assert.equal(typeof Pool.prototype.captureSourceSettlement,'function');let output,h,inside;const reply=new Proxy(frame(),{ownKeys(v){output.retire('s1');inside=h.snapshot();assert.equal(output.register('s1',()=>frame()).code,'CAPACITY_EXCEEDED');return Reflect.ownKeys(v);}});
 output=poolFixture(()=>Promise.resolve(reply));h=poolHandle(output);assert.equal((await output.takeWithBounds(token())).ok,false);assert.ok(inside.activeFrames>0);assert.equal(inside.actualSettled,false);await h.actualSettled;assert.equal(output.register('s1',()=>frame()).ok,true);output.retire('s1');
});
test('facet guard retirement keeps exact callback frame and prevents late ticket publication',async()=>{
 assert.equal(typeof Facet.prototype.captureOutputSettlement,'function');const output=facetFixture(),h=facetHandle(output);let inside,calls=0;
 const result=await output.prepare(request(),{isCurrent:()=>{calls++;output.retire('s1');inside=h.snapshot();assert.equal(output.register({sessionId:'s1',ownerId:'o1',readHistory:()=>Promise.resolve(frame())}).code,'CAPACITY_EXCEEDED');return true;}});
 assert.equal(result.ok,false);assert.equal(calls,1);assert.ok(inside.activeFrames>0);assert.equal(inside.actualSettled,false);await h.actualSettled;assert.equal(output.status('s1'),null);
});
test('eight unknown retired output lifetimes retain bounded roster and refuse ninth',async()=>{
 assert.equal(typeof Pool.prototype.captureSourceSettlementRoster,'function');const output=new Pool({deadlineMs:15});output.resumeViews();const handles=[];
 for(let i=0;i<8;i++){const sid=`s${i}`;output.register(sid,()=>{throw Error('entered unknown');});handles.push(output.captureSourceSettlement(sid));output.attach(sid,{leaseId:`l${i+1}`,generation:i+1,fromSequence:0});assert.equal((await output.takeWithBounds(token(sid,i+1))).ok,false);output.retire(sid);}
 assert.equal(output.captureSourceSettlementRoster().length,8);assert.equal(output.stats().reservedUtf8Bytes,8*32768);assert.equal(output.register('ninth',()=>frame()).code,'CAPACITY_EXCEEDED');for(const h of handles)assert.equal(h.snapshot().unknown,true);
});

for(const mode of ['valid-proxy','malformed-proxy','proxy-wrapped-promise'])test(`direct pool ${mode} preserves synchronous DATA normalization scope`,async()=>{
 let traps=0;const value=mode==='proxy-wrapped-promise'?Promise.resolve(frame()):mode==='valid-proxy'?frame():({...frame(),extra:true});
 const reply=new Proxy(value,{getPrototypeOf(v){traps++;return Reflect.getPrototypeOf(v);},ownKeys(v){traps++;return Reflect.ownKeys(v);},getOwnPropertyDescriptor(v,k){traps++;return Reflect.getOwnPropertyDescriptor(v,k);}});
 const output=poolFixture(()=>reply),h=poolHandle(output);const result=await output.takeWithBounds(token());assert.equal(result.ok,mode==='valid-proxy');assert.ok(traps>0);output.retire('s1');await h.actualSettled;assert.equal(h.snapshot().read.mode,'sync-data');assert.equal(h.snapshot().unknown,false);
});
test('pool receipt waits original handler and secondary unwind even after byte release',async()=>{
 const d=held(),output=poolFixture(()=>d.promise),h=poolHandle(output),work=output.takeWithBounds(token());let first,second;
 d.promise.then(()=>{first=h.snapshot();queueMicrotask(()=>{second=h.snapshot();});});output.retire('s1');assert.equal((await work).ok,false);d.resolve(frame());await h.actualSettled;
 assert.equal(first.read.handlerSettled,false);assert.equal(first.read.pending,true);assert.equal(first.reservedUtf8Bytes,32768);assert.equal(first.actualSettled,false);
 assert.equal(second.read.handlerSettled,true);assert.equal(second.read.pending,true);assert.equal(second.reservedUtf8Bytes,0);assert.equal(second.continuations,1);assert.equal(second.actualSettled,false);
});
test('facet raw counter zero is distinct from full raw and outer completion',async()=>{
 const d=held(),output=facetFixture(()=>d.promise),h=facetHandle(output),work=output.prepare(request(),{isCurrent:()=>true});let scalar,actual;
 d.promise.then(()=>{scalar=output.status('s1');actual=h.snapshot();});d.resolve(frame());assert.equal((await work).ok,true);
 assert.equal(scalar.pendingActualReads,0);assert.equal(scalar.poolPendingRead,true);assert.equal(actual.rawRead.pending,true);assert.equal(actual.rawRead.handlerSettled,false);assert.ok(actual.facetWorkers>0);assert.equal(actual.actualSettled,false);
 output.retire('s1');await h.actualSettled;assert.equal(h.snapshot().facetWorkers,0);
});
for(const action of ['handoff','ack','detach'])test(`facet ${action} admission callback retirement owns its entire synchronous frame`,async()=>{
 const output=facetFixture(),h=facetHandle(output);let armed=false,inside;
 const candidate=(await output.prepare(request(),{isCurrent:()=>{if(armed){output.retire('s1');inside=h.snapshot();assert.equal(facetHandle(output),h);}return true;}})).value.candidateTicket;
 let readTicket;if(action==='ack')readTicket=output.handoffInitial(candidate).value.readTicket;armed=true;
 const result=action==='handoff'?output.handoffInitial(candidate):action==='ack'?output.ack(readTicket,{throughSequence:7}):output.detach(candidate);
 assert.equal(result.ok,false);assert.ok(inside.activeFrames>0);assert.equal(inside.actualSettled,false);await h.actualSettled;assert.equal(output.stats().outstandingUtf8Bytes,0);
});
test('known-source attachment normalization cannot replace a retired source inside its own callback',async()=>{
 const output=new Pool({deadlineMs:50});output.register('s1',()=>frame());output.resumeViews();const h=poolHandle(output);let inside;
 const request=new Proxy({leaseId:'l1',generation:1,fromSequence:0},{ownKeys(v){output.retire('s1');inside=h.snapshot();assert.equal(output.register('s1',()=>frame()).code,'CAPACITY_EXCEEDED');return Reflect.ownKeys(v);}});
 assert.equal(output.attach('s1',request).code,'LEASE_STALE');assert.ok(inside.activeFrames>0);assert.equal(inside.actualSettled,false);await h.actualSettled;
});
test('facet does not re-assimilate a legally fulfilled raw value with later own then accessor',async()=>{
 const d=held(),output=facetFixture(()=>d.promise),h=facetHandle(output),work=output.prepare(request(),{isCurrent:()=>true});let traps=0;const value=frame();d.resolve(value);Object.defineProperty(value,'then',{enumerable:true,get(){traps++;throw Error('DO_NOT_REASSIMILATE');}});
 assert.equal((await work).ok,false);assert.equal(traps,0);output.retire('s1');await h.actualSettled;assert.equal(h.snapshot().unknown,false);
});
for(const mode of ['rejected','malformed'])test(`facet legally observed ${mode} reader is negative completed work after retirement`,async()=>{
 const output=facetFixture(()=>mode==='rejected'?Promise.reject(Error('negative')):Promise.resolve({...frame(),extra:true})),h=facetHandle(output);
 assert.equal((await output.prepare(request(),{isCurrent:()=>true})).ok,false);output.retire('s1');await h.actualSettled;assert.equal(h.snapshot().unknown,false);assert.equal(output.stats().reservedUtf8Bytes,0);
});
test('pre-entry pool environment refusal calls no reader/getter and is known local work',async()=>{
 let calls=0,traps=0;const output=poolFixture(()=>{calls++;return frame();}),h=poolHandle(output),original=Object.getOwnPropertyDescriptor(Promise.prototype,'constructor');let work;
 try{Object.defineProperty(Promise.prototype,'constructor',{configurable:true,get(){traps++;return Promise;}});work=output.takeWithBounds(token());}finally{Object.defineProperty(Promise.prototype,'constructor',original);}
 assert.equal((await work).ok,false);assert.equal(calls,0);assert.equal(traps,0);output.retire('s1');await h.actualSettled;assert.equal(h.snapshot().read.entered,false);assert.equal(h.snapshot().unknown,false);
});
test('caller-held completed handles retain cached facts without owners, readers, guards, raw promises or successors',()=>{
 const poolURL=new URL('../src/terminal/production-remote-output.mjs',import.meta.url).href,facetURL=new URL('../src/terminal/production-attachment-output.mjs',import.meta.url).href;
 const script=`
 import assert from 'node:assert/strict';
 import {TerminalProductionRemoteOutput as Pool} from ${JSON.stringify(poolURL)};
 import {TerminalProductionAttachmentOutput as Facet} from ${JSON.stringify(facetURL)};
 const tick=()=>new Promise(r=>setImmediate(r));const value={firstSequence:0,endSequence:1,chunk:{sequence:0,data:'x',utf8Bytes:1}};
 async function retired(facet){
  const output=facet?new Facet({deadlineMs:50}):new Pool({deadlineMs:50});output.resumeViews();const raw=Promise.resolve(value),reader=()=>raw,guard=()=>true;
  if(facet)output.register({sessionId:'s1',ownerId:'o1',readHistory:reader});else{output.register('s1',reader);output.attach('s1',{leaseId:'l1',generation:1,fromSequence:0});}
  const handle=facet?output.captureOutputSettlement({sessionId:'s1',ownerId:'o1'}):output.captureSourceSettlement('s1');
  if(facet)await output.prepare({sessionId:'s1',leaseId:'l1',generation:1,fromSequence:0,windowId:'w1',projectId:'p1',epoch:1,accessGeneration:0},{isCurrent:guard});else await output.takeWithBounds({sessionId:'s1',leaseId:'l1',generation:1});
  output.retire('s1');await handle.actualSettled;
  const successor=()=>Promise.resolve(value);if(facet)output.register({sessionId:'s1',ownerId:'o2',readHistory:successor});else output.register('s1',successor);
  return {handle,weak:[output,reader,guard,raw,successor].map(v=>new WeakRef(v))};
 }
 const control=new WeakRef({negative:true}),p=await retired(false),f=await retired(true);
 for(let i=0;i<25;i++){await tick();globalThis.gc();}
 console.log(JSON.stringify({negativeCollected:!control.deref(),pool:p.weak.map(w=>!!w.deref()),facet:f.weak.map(w=>!!w.deref()),handles:[p.handle.snapshot().actualSettled,f.handle.snapshot().actualSettled]}));
 `;
 const child=spawnSync(process.execPath,['--expose-gc','--input-type=module','--eval',script],{encoding:'utf8',maxBuffer:1024*1024});assert.equal(child.status,0,child.stderr);const result=JSON.parse(child.stdout.trim());assert.equal(result.negativeCollected,true,'GC negative control must collect');assert.deepEqual(result.handles,[true,true]);assert.deepEqual(result.pool,[false,false,false,false,false]);assert.deepEqual(result.facet,[false,false,false,false,false]);
});
