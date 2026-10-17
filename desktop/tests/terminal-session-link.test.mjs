// Inert streams/providers only. No shell, PTY, child or native workload.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Duplex} from 'node:stream';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import vm from 'node:vm';
import * as startup from '../src/terminal/startup-protocol.mjs';
import * as commands from '../src/terminal/command-protocol.mjs';
import {performance} from 'node:perf_hooks';
import {TerminalSessionCommandChannel as Channel} from '../src/terminal/session-command-channel.mjs';
import {encodeStartupRequest,encodeStartupReply} from '../src/terminal/startup-protocol.mjs';
const api=await import('../src/terminal/session-link.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const scope={sessionId:'session1',channelId:'channel1'},exe='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';
const token={...scope,projectId:'project1',windowId:'window1',epoch:1,leaseId:'lease1',generation:1,gateGeneration:7};
const command=(op='install',extra={})=>({op,token,...extra});
const config=()=>({version:1,...scope,projectId:'project1',startupId:'startup1',admissionEpoch:3,profileId:'powershell',cwd:'C:\\Work Ω',shell:{executable:exe,args:['-NoLogo','-NoProfile'],env:{PATH:'C:\\Windows',SystemRoot:'C:\\Windows',CUSTOM:'DO_NOT_RETAIN_CONFIG'}},cols:80,rows:24});
const common=q=>({version:q.version,sessionId:q.sessionId,channelId:q.channelId,startupId:q.startupId,sha256:q.sha256});
const tick=()=>new Promise(r=>setImmediate(r)),pause=n=>new Promise(r=>setTimeout(r,n));
const failed=code=>e=>e.message===code;
function pipes(){let a,b;const make=other=>{const stream=new Duplex({read(){},write(bytes,encoding,done){stream.calls++;if(stream.hold){stream.held.push({bytes:Buffer.from(bytes),done});return;}queueMicrotask(()=>{if(!other().destroyed)other().push(Buffer.from(bytes));done();});},destroy(error,done){done(error);}});stream.held=[];stream.calls=0;stream.flush=()=>{for(const h of stream.held.splice(0)){if(!other().destroyed)other().push(h.bytes);h.done();}};stream.on('error',()=>{});return stream;};a=make(()=>b);b=make(()=>a);return[a,b];}
function fixture(options={}){
 assert.equal(typeof api.TerminalSessionLink,'function','TerminalSessionLink required');
 const[a,b]=pipes();if(options.holdAuth)a.hold=true;
 const settings={...scope,secret:Buffer.alloc(32,37),deadlineMs:1000},main=new Channel({stream:a,role:'main',...settings}),creator=new Channel({stream:b,role:'creator',...settings}),events=[],seen=[];
 const f={a,b,main,creator,events,seen,begin:null,held:[],options,link:null};
 f.respond=(q,wire)=>{
  let reply;
  if(q.type==='command')reply={type:'command-result',op:q.op,...scope,requestId:q.requestId,token:q.token,status:'accepted',code:'COMMAND_ACCEPTED'};
  else if(q.type==='startup-begin')reply={type:'startup-begin-ack',...common(q),status:'accepted',code:'STARTUP_ACCEPTED'};
  else if(q.type==='startup-chunk')reply={type:'startup-chunk-ack',...common(q),index:q.index,status:'accepted',code:'STARTUP_ACCEPTED'};
  else if(q.type==='startup-seal')reply={type:'startup-prepared',...common(q),projectId:'project1',admissionEpoch:3,initiallyClosed:true,status:'accepted',code:'STARTUP_PREPARED'};
  else reply={type:'startup-ready',...common(q),gateGeneration:q.gateGeneration,reportedShell:{pid:42,image:exe},status:'accepted',code:'STARTUP_READY'};
  if(options.patch)reply=options.patch(reply,q);
  if(options.rawReply&&(q.type==='command'||q.type===options.rawPhase||options.patch&&q.type==='startup-seal')){const body=Buffer.from(JSON.stringify(reply)),head=Buffer.alloc(4);head.writeUInt32BE(body.length);a.emit('data',Buffer.concat([head,body]));}
  else creator.send(reply);
 };
 creator.subscribe({message(q){
  seen.push(q.type==='command'?q.op:q.type);
  let wire=null;if(q.type!=='command'){wire=encodeStartupRequest(q,q.type==='startup-begin'?scope:f.begin);if(q.type==='startup-begin')f.begin=wire;}
  if(q.data&&Buffer.isBuffer(q.data))q.data.fill(0);
  if(options.holdPhase===(q.type==='command'?'command':q.type)){f.held.push({q,wire});return;}
  if(options.delay)setTimeout(()=>f.respond(q,wire),options.delay);else f.respond(q,wire);
 },closed(){}});
 f.opts={channel:main,onUnavailable(){events.push('unavailable');options.notify?.(f);},deadlineMs:options.deadlineMs??200};
 if(!options.defer)f.link=new api.TerminalSessionLink(f.opts);return f;
}
async function activate(f){const prepared=await f.link.prepare(config());assert.equal(prepared.type,'startup-prepared');const r=await f.link.start({gateGeneration:7});assert.equal(r.type,'startup-ready');assert.equal(await f.link.ready,true);return r;}
function cleanup(f){f.link?.dispose();f.main.dispose();f.creator.dispose();f.a.flush();f.b.flush();}

test('one lifetime subscriber spans authenticated startup and monotonic fixed commands',async()=>{
 const f=fixture();assert.equal(f.link.isAvailable(),false);assert.equal(await f.link.authenticated,true);const ready=await activate(f);
 assert.deepEqual({...ready.reportedShell},{pid:42,image:exe});assert.equal(f.main.phase,'commands');assert.equal(f.link.isAvailable(),true);assert.equal(f.link.nativeExecutionAdmitted,false);
 for(const [i,q]of[command(),command('input',{inputSequence:0,data:'AΩ😀'}),command('resize',{cols:100,rows:30}),command('revoke')].entries())assert.equal((await f.link.request(q)).requestId,i+1);
 assert.deepEqual(f.seen.slice(0,4),['startup-begin','startup-chunk','startup-seal','startup-start']);assert.throws(()=>f.main.subscribe({message(){},closed(){}}),TypeError);assert.equal(f.link.stats().retainedStartupBytes,0);cleanup(f);
});

test('local malformed config wrong scope and command-before-ready do not send or claim startup',async()=>{
 const f=fixture();await f.link.authenticated;const calls=f.a.calls;
 for(const c of[{...config(),command:'bad'},{...config(),sessionId:'other'}])await assert.rejects(f.link.prepare(c),failed('STARTUP_REFUSED'));
 await assert.rejects(f.link.request(command()),failed('COMMAND_UNAVAILABLE'));assert.equal(f.a.calls,calls);assert.equal(f.link.stats().startupAttempted,false);await activate(f);cleanup(f);
});

test('prepare owns exactly one startup attempt and no queued parallel operations',async()=>{
 const f=fixture({holdPhase:'startup-begin'}),p=f.link.prepare(config());await tick();await assert.rejects(f.link.prepare(config()),failed('STARTUP_BUSY'));await assert.rejects(f.link.start({gateGeneration:7}),failed('STARTUP_REFUSED'));
 assert.equal(f.link.stats().pendingRequests,1);assert.equal(f.link.stats().retainedRequestSlots,1);f.respond(f.held[0].q,f.held[0].wire);await p;await assert.rejects(f.link.prepare(config()),failed('STARTUP_REFUSED'));await f.link.start({gateGeneration:7});await assert.rejects(f.link.start({gateGeneration:7}),failed('STARTUP_REFUSED'));cleanup(f);
});

test('prepared receipt must match project epoch and actual initially-closed field',async()=>{
 for(const patch of[r=>({...r,projectId:'other'}),r=>({...r,admissionEpoch:4}),r=>({...r,initiallyClosed:false})]){
  const f=fixture({patch:(r,q)=>q.type==='startup-seal'?patch(r):r,rawReply:true});await assert.rejects(f.link.prepare(config()),failed('STARTUP_UNAVAILABLE'));assert.deepEqual(f.events,['unavailable']);assert.equal(f.link.stats().retainedStartupBytes,0);cleanup(f);
 }
});

test('startup-ready image must match captured configuration, not reported native proof',async()=>{
 const f=fixture({patch:(r,q)=>q.type==='startup-start'?{...r,reportedShell:{pid:42,image:'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'}}:r});await f.link.prepare(config());await assert.rejects(f.link.start({gateGeneration:7}),failed('STARTUP_UNAVAILABLE'));assert.equal(await f.link.ready,false);assert.equal(f.link.stats().unknownRequests,1);cleanup(f);
});

test('absolute startup deadline includes authentication and retains only unknown metadata',async()=>{
 const f=fixture({holdAuth:true,deadlineMs:10}),p=f.link.prepare(config());assert.ok(f.link.stats().retainedStartupBytes>0);await assert.rejects(p,failed('STARTUP_UNAVAILABLE'));
 assert.equal(await f.link.authenticated,false);assert.equal(await f.link.ready,false);const s=f.link.stats();assert.equal(s.unknownRequests,1);assert.equal(s.retainedStartupBytes,0);assert.ok(s.unknownMetadata.sha256);assert.equal(JSON.stringify(s).includes('DO_NOT_RETAIN_CONFIG'),false);cleanup(f);
});

// Only this regression evaluates the exact production body with owned time imports.
// The real channel/protocols/Promise/Buffer brands and all other tests stay unchanged.
function startupClock(){
 let now=0,serial=0;const pending=new Map(),scheduled=[];
 return {performance:{now:()=>now},scheduled,
  setTimeout(fn,ms){assert.equal(typeof fn,'function');assert.ok(Number.isFinite(ms)&&ms>=0);const id=++serial;pending.set(id,{fn,due:now+ms});scheduled.push({due:now+ms,ms});return id;},
  clearTimeout(id){pending.delete(id);},pending:()=>pending.size,
  advanceTo(value,fire=true){assert.ok(value>=now);now=value;if(!fire)return;for(let i=0;i<64;i++){const due=[...pending].filter(([,v])=>v.due<=now).sort((a,b)=>a[1].due-b[1].due||a[0]-b[0]);if(!due.length)return;const [id,value]=due[0];pending.delete(id);value.fn();}assert.fail('bounded owned timer drain');}
 };
}
async function clockedSessionLink(clock){
 const source=await readFile(new URL('../src/terminal/session-link.mjs',import.meta.url),'utf8');
 assert.equal(createHash('sha256').update(source).digest('hex'),'afd063ca99a957e21e9e6d22bd9d868f8c95df5adc40559ba59e1478c927c518','Exact reviewed production module required');
 const imports=source.match(/^import .*;\r?$/gm)??[];assert.equal(imports.length,5);
 assert.equal(source.split('const invoke=Reflect.apply,clock=performance.now.bind(performance),timer=setTimeout,cancel=clearTimeout;').length,2,'Exact captured time boundary');
 assert.equal(source.split('export class TerminalSessionLink {').length,2);
 const body=source.replace(/^import .*;\r?\n/gm,'').replace('export class TerminalSessionLink {','class TerminalSessionLink {');
 const factory=vm.runInThisContext('(function({performance,types,TerminalSessionCommandChannel,STARTUP_LIMITS,validateStartupEnvelope,encodeStartupEnvelope,encodeStartupRequest,validateStartupReply,combineStartupPolicies,validateStartupModulePolicy,encodeTerminalCommandRequest,decodeTerminalCommandRequest,validateTerminalCommandReply,setTimeout,clearTimeout}){'+body+'\nreturn TerminalSessionLink;})',{filename:'exact-session-link-with-owned-time-imports'});
 return factory({...startup,...commands,types,TerminalSessionCommandChannel:Channel,performance:clock.performance,setTimeout:clock.setTimeout,clearTimeout:clock.clearTimeout});
}
async function heldChunk(f,index){for(let i=0;i<8&&f.held.length<=index;i++)await tick();assert.equal(f.held.length,index+1,'Actual next chunk requires previous accepted ACK');assert.equal(f.held[index].q.type,'startup-chunk');assert.equal(f.held[index].q.index,index);return f.held[index];}
test('chunk ACK progress never resets absolute startup deadline',async()=>{
 for(const expiry of ['timer','correlated-late-ack']){
  const clock=startupClock(),Link=await clockedSessionLink(clock),f=fixture({defer:true,holdPhase:'startup-chunk',deadlineMs:25});let refusal;
  try{
   f.link=new Link(f.opts);assert.equal(await f.link.authenticated,true);
   const c=config();c.shell.env.BIG='x'.repeat(32768);const pending=f.link.prepare(c);refusal=assert.rejects(pending,failed('STARTUP_UNAVAILABLE'));refusal.catch(()=>{});
   await heldChunk(f,0);assert.equal(f.begin.chunkCount,3);
   for(let index=0;index<2;index++){clock.advanceTo(8*(index+1));const chunk=f.held[index];f.respond(chunk.q,chunk.wire);await heldChunk(f,index+1);assert.deepEqual(f.events,[]);assert.equal(f.link.stats().unknownRequests,0);}
   assert.deepEqual(clock.scheduled,[{due:25,ms:25}],'Accepted ACK progress must not restart startup timer');
   assert.equal(f.seen.includes('startup-seal'),false);
   if(expiry==='timer')clock.advanceTo(25);
   else{
    clock.advanceTo(26,false);assert.deepEqual(f.events,[],'Owned timer deliberately has not run');
    f.options.rawReply=true;f.options.rawPhase='startup-chunk';
    const late=f.held[2];f.respond(late.q,late.wire); // Parser-correlated late ACK only; prior ACKs used creator.send; 26 < renewed 16+25.
   }
   assert.deepEqual(f.events,['unavailable'],'Original deadline fences synchronously, before any next Promise continuation');
   await refusal;const stats=f.link.stats();assert.equal(stats.fenced,true);assert.equal(stats.retainedStartupBytes,0);assert.equal(stats.unknownRequests,1);assert.equal(stats.unknownMetadata.phase,'startup-chunk');assert.equal(stats.unknownMetadata.index,2);assert.equal(JSON.stringify(stats).includes('DO_NOT_RETAIN_CONFIG'),false);
   assert.equal(f.seen.includes('startup-seal'),false);assert.equal(f.seen.includes('startup-start'),false);assert.equal(await f.link.ready,false);assert.equal(clock.pending(),0);
  }finally{cleanup(f);if(refusal)await refusal;assert.equal(clock.pending(),0);}
 }
});

test('prepared wait consumes the same deadline but command mode has no idle expiry',async()=>{
 const f=fixture({deadlineMs:20});await f.link.prepare(config());await pause(25);await assert.rejects(f.link.start({gateGeneration:7}),failed('STARTUP_UNAVAILABLE'));cleanup(f);
 const g=fixture({deadlineMs:20});await activate(g);await pause(25);assert.equal(g.link.isAvailable(),true);assert.equal((await g.link.request(command())).code,'COMMAND_ACCEPTED');cleanup(g);
});

test('elapsed deadline is checked before accepting ACK even before timer runs',async()=>{
 const f=fixture({holdPhase:'startup-begin',deadlineMs:10,rawReply:true,rawPhase:'startup-begin'}),p=f.link.prepare(config());const reject=assert.rejects(p,failed('STARTUP_UNAVAILABLE'));await tick();const until=performance.now()+15;while(performance.now()<until){}
 f.respond(f.held[0].q,f.held[0].wire);assert.deepEqual(f.events,['unavailable']);await reject;assert.equal(f.link.stats().unknownRequests,1);cleanup(f);
});

test('loss fences synchronously before rejection and preserves unsettled correlation',async()=>{
 const f=fixture({holdPhase:'startup-begin',notify(f){assert.equal(f.link.stats().fenced,true);throw Error('PRIVATE_CALLBACK');}}),p=f.link.prepare(config()),order=[];const rejected=assert.rejects(p.catch(e=>{order.push('rejected');throw e;}),failed('STARTUP_UNAVAILABLE'));await tick();f.a.emit('end');order.unshift(...f.events);assert.deepEqual(order,['unavailable']);await rejected;assert.deepEqual(order,['unavailable','rejected']);assert.equal(f.link.stats().unknownMetadata.phase,'startup-begin');cleanup(f);
});

test('command requests are exact, busy bounded, full-token correlated and no input retained',async()=>{
 const f=fixture({holdPhase:'command',rawReply:true});await activate(f);const p=f.link.request(command('input',{inputSequence:0,data:'DO_NOT_RETAIN_INPUT'}));await tick();await assert.rejects(f.link.request(command()),failed('COMMAND_BUSY'));assert.equal(f.link.stats().pendingRequests,1);
 const q=f.held[0].q;f.respond({...q,token:{...q.token,generation:2}},null);await assert.rejects(p,failed('COMMAND_UNAVAILABLE'));assert.equal(f.link.stats().unknownRequests,1);assert.equal(JSON.stringify(f.link.stats()).includes('DO_NOT_RETAIN_INPUT'),false);cleanup(f);
});

test('ambiguous command failure keeps unknown slot; known decline releases slot',async()=>{
 const f=fixture({patch:(r,q)=>q.type==='command'?{...r,status:'failed',code:'COMMAND_AMBIGUOUS'}:r});await activate(f);await assert.rejects(f.link.request(command()),failed('COMMAND_UNAVAILABLE'));assert.equal(f.link.stats().unknownRequests,1);cleanup(f);
 const g=fixture({patch:(r,q)=>q.type==='command'?{...r,status:'failed',code:'LEASE_STALE'}:r});await activate(g);assert.equal((await g.link.request(command())).code,'LEASE_STALE');assert.equal(g.link.stats().retainedRequestSlots,0);assert.equal(g.link.isAvailable(),true);cleanup(g);
});

test('duplicate or unsolicited command ACK retires after known acceptance without replay',async()=>{
 const f=fixture({holdPhase:'command',rawReply:true});await activate(f);const p=f.link.request(command());await tick();f.respond(f.held[0].q,null);const accepted=await p;assert.equal(accepted.status,'accepted');f.respond(f.held[0].q,null);assert.deepEqual(f.events,['unavailable']);assert.equal(f.link.stats().unknownRequests,0);await assert.rejects(f.link.request(command()),failed('COMMAND_UNAVAILABLE'));cleanup(f);
});

test('options callbacks requests and fake brands refuse without Proxy/getter traps',async()=>{
 const f=fixture({defer:true});let traps=0;const h={get(){traps++;throw Error();},ownKeys(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();},apply(){traps++;throw Error();}};
 const accessor={...f.opts};Object.defineProperty(accessor,'onUnavailable',{enumerable:true,get(){traps++;return()=>{};}});
 for(const p of[accessor,new Proxy(f.opts,h),{...f.opts,channel:new Proxy(f.main,h)},{...f.opts,onUnavailable:new Proxy(()=>{},h)},{...f.opts,channel:Object.create(Channel.prototype)},{...f.opts,channel:f.creator},{...f.opts,extra:true},...[0,10001,1.5].map(deadlineMs=>({...f.opts,deadlineMs}))])assert.throws(()=>new api.TerminalSessionLink(p),TypeError);
 f.link=new api.TerminalSessionLink(f.opts);await assert.rejects(f.link.prepare(new Proxy(config(),h)),failed('STARTUP_REFUSED'));await activate(f);await assert.rejects(f.link.request(new Proxy(command(),h)),failed('COMMAND_REFUSED'));await assert.rejects(f.link.request({...command(),token:new Proxy(token,h)}),failed('COMMAND_REFUSED'));assert.equal(traps,0);cleanup(f);
});

test('captured class methods and native promises ignore shadow methods and reject poisoned species',async()=>{
 const f=fixture({defer:true});let traps=0;for(const key of['send','subscribe','identity','phase'])Object.defineProperty(f.main,key,{configurable:true,get(){traps++;throw Error();}});
 f.link=new api.TerminalSessionLink(f.opts);f.opts.onUnavailable=()=>{traps++;};await activate(f);assert.equal((await f.link.request(command())).code,'COMMAND_ACCEPTED');cleanup(f);assert.equal(traps,0);
 for(const mode of['constructor','prototype']){const g=fixture({defer:true});if(mode==='constructor')Object.defineProperty(g.main.authenticated,'constructor',{get(){traps++;throw Error();}});else Object.setPrototypeOf(g.main.ready,new Proxy(Promise.prototype,{get(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}}));assert.throws(()=>new api.TerminalSessionLink(g.opts),TypeError);cleanup(g);assert.equal(traps,0);}
});

test('elapsed pending command deadline fences availability before timer delivery',async()=>{
 const f=fixture({deadlineMs:10,holdPhase:'command'});await activate(f);const p=f.link.request(command()),rejected=assert.rejects(p,failed('COMMAND_UNAVAILABLE'));const until=performance.now()+15;while(performance.now()<until){}
 assert.equal(f.link.isAvailable(),false);assert.deepEqual(f.events,['unavailable']);await rejected;assert.equal(f.link.stats().unknownRequests,1);cleanup(f);
});

test('command timeout retains correlation and independent unsettled stream write through late ACK',async()=>{
 const f=fixture({deadlineMs:10});await activate(f);f.a.hold=true;const p=f.link.request(command('input',{inputSequence:0,data:'DO_NOT_RETAIN_INPUT'}));await assert.rejects(p,failed('COMMAND_UNAVAILABLE'));
 const s=f.link.stats();assert.equal(s.pendingRequests,0);assert.equal(s.unknownRequests,1);assert.equal(s.retainedRequestSlots,1);assert.ok(f.a.held.length>0);assert.equal(JSON.stringify(s).includes('DO_NOT_RETAIN_INPUT'),false);
 f.a.emit('data',Buffer.from([0,0,0,2,123,125]));await assert.rejects(f.link.request(command()),failed('COMMAND_UNAVAILABLE'));assert.equal(f.link.stats().retainedRequestSlots,1);cleanup(f);
});

test('known permanent command decline fences before delivery and releases only correlation',async()=>{
 for(const code of['ENDPOINT_UNAVAILABLE','COMMAND_RETIRED']){const f=fixture({patch:(r,q)=>q.type==='command'?{...r,status:'failed',code}:r});await activate(f);
 const r=await f.link.request(command()).then(value=>{assert.deepEqual(f.events,['unavailable']);return value;});assert.equal(r.code,code);assert.equal(f.link.stats().retainedRequestSlots,0);assert.equal(f.link.isAvailable(),false);cleanup(f);}
});

test('known accepted ACK remains known when EOF follows before Promise delivery',async()=>{
 const f=fixture({holdPhase:'command',rawReply:true});await activate(f);const p=f.link.request(command());await tick();f.respond(f.held[0].q,null);f.a.emit('end');assert.deepEqual(f.events,['unavailable']);assert.equal((await p).status,'accepted');assert.equal(f.link.stats().unknownRequests,0);cleanup(f);
});

test('fixed failed startup response permanently retires and releases raw configuration',async()=>{
 const f=fixture({patch:(r,q)=>q.type==='startup-begin'?{type:'startup-failed',...common(q),phase:'begin',status:'failed',code:'STARTUP_REFUSED'}:r});await assert.rejects(f.link.prepare(config()),failed('STARTUP_UNAVAILABLE'));
 assert.equal(f.link.stats().retainedStartupBytes,0);assert.equal(f.link.stats().unknownMetadata.phase,'startup-begin');await assert.rejects(f.link.prepare(config()),failed('STARTUP_UNAVAILABLE'));assert.deepEqual(f.events,['unavailable']);cleanup(f);
});

test('invalid start DATA is refused without consuming prepared permission or running getters',async()=>{
 const f=fixture();await f.link.prepare(config());let traps=0;const accessor={};Object.defineProperty(accessor,'gateGeneration',{enumerable:true,get(){traps++;return 7;}});
 for(const value of[accessor,new Proxy({gateGeneration:7},{get(){traps++;throw Error();},ownKeys(){traps++;throw Error();},getPrototypeOf(){traps++;throw Error();}}),{gateGeneration:0},{gateGeneration:7,extra:true}])await assert.rejects(f.link.start(value),failed('STARTUP_REFUSED'));
 assert.equal(traps,0);assert.equal((await f.link.start({gateGeneration:7})).type,'startup-ready');cleanup(f);
});

test('public availability shadow cannot recreate a request slot after permanent retirement',async()=>{
 const f=fixture({holdPhase:'command'});await activate(f);const pending=f.link.request(command()),failure=assert.rejects(pending,failed('COMMAND_UNAVAILABLE'));await tick();f.link.dispose();await failure;
 const before=f.link.stats();let traps=0;Object.defineProperty(f.link,'isAvailable',{get(){traps++;return()=>true;}});
 const retry=f.link.request(command('input',{inputSequence:0,data:'NEVER_RESUBMIT'}));retry.catch(()=>{});assert.equal(traps,0);await assert.rejects(retry,failed('COMMAND_UNAVAILABLE'));
 assert.equal(f.link.stats().retainedRequestSlots,1);assert.deepEqual(f.link.stats().unknownMetadata,before.unknownMetadata);assert.equal(f.link.stats().lastRequestId,1);assert.equal(traps,0);cleanup(f);
});
