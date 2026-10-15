// Pure bounded connected streams. No startup assembly, provider or native proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Duplex} from 'node:stream';
import {EventEmitter} from 'node:events';
import {createHmac} from 'node:crypto';
import {performance} from 'node:perf_hooks';
const api=await import('../src/terminal/session-command-channel.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const scope={sessionId:'session1',channelId:'channel1'},hash='a'.repeat(64);
const common={version:1,...scope,startupId:'startup1',sha256:hash};
const begin=(extra={})=>({type:'startup-begin',...common,totalBytes:3,chunkCount:1,...extra});
const chunk=(extra={})=>({type:'startup-chunk',...common,totalBytes:3,chunkCount:1,index:0,data:Buffer.from('abc'),...extra});
const seal=()=>({type:'startup-seal',...common}),start=()=>({type:'startup-start',...common,gateGeneration:3});
const token=()=>({...scope,projectId:'project1',windowId:'window1',epoch:1,leaseId:'lease1',generation:1,gateGeneration:3});
const command=()=>({type:'command',op:'install',...scope,requestId:1,token:token()});
const commandReply=()=>({type:'command-result',op:'install',...scope,requestId:1,token:token(),status:'accepted',code:'COMMAND_ACCEPTED'});
const reply=q=>({type:q.type==='startup-begin'?'startup-begin-ack':q.type==='startup-chunk'?'startup-chunk-ack':q.type==='startup-seal'?'startup-prepared':'startup-ready',version:q.version,sessionId:q.sessionId,channelId:q.channelId,startupId:q.startupId,sha256:q.sha256,...(q.type==='startup-chunk'?{index:q.index}:q.type==='startup-seal'?{projectId:'project1',admissionEpoch:1,initiallyClosed:true}:q.type==='startup-start'?{gateGeneration:q.gateGeneration,reportedShell:{pid:47,image:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'}}:{}),status:'accepted',code:q.type==='startup-seal'?'STARTUP_PREPARED':q.type==='startup-start'?'STARTUP_READY':'STARTUP_ACCEPTED'});
const frame=value=>{const body=Buffer.from(JSON.stringify(value)),head=Buffer.alloc(4);head.writeUInt32BE(body.length);return Buffer.concat([head,body]);};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function wires(sync=false){
 if(sync){const a=new EventEmitter(),b=new EventEmitter();for(const[s,p]of[[a,b],[b,a]]){s.writableLength=0;s.writeCalls=0;s.write=bytes=>{s.writeCalls++;p.emit('data',Buffer.from(bytes));return true;};s.destroy=()=>{if(s.dead)return;s.dead=true;s.emit('close');queueMicrotask(()=>p.emit('end'));};}return[a,b];}
 let a,b;const make=peer=>{const s=new Duplex({read(){},write(bytes,encoding,done){s.writeCalls++;if(s.mode==='coalesce'){s.coalesced.push(Buffer.from(bytes));done();return;}if(s.mode==='fragment'){for(let i=0;i<bytes.length;i+=7)peer().emit('data',Buffer.from(bytes.subarray(i,i+7)));done();return;}if(s.mode==='hold'){s.complete=done;return;}queueMicrotask(()=>{if(!peer().destroyed)peer().push(Buffer.from(bytes));done();});},destroy(error,done){queueMicrotask(()=>{if(!peer().destroyed)peer().push(null);});done(error);}});s.coalesced=[];s.writeCalls=0;s.on('error',()=>{});return s;};a=make(()=>b);b=make(()=>a);return[a,b];
}
function pair(options={}){
 assert.equal(typeof api.TerminalSessionCommandChannel,'function');const[a,b]=wires(options.sync),key=Buffer.alloc(32,89),creator=new api.TerminalSessionCommandChannel({stream:b,role:'creator',...scope,sessionId:options.creatorSession??scope.sessionId,channelId:options.creatorChannel??scope.channelId,secret:options.creatorSecret??key,deadlineMs:options.deadlineMs??100}),main=new api.TerminalSessionCommandChannel({stream:a,role:'main',...scope,secret:key,deadlineMs:options.deadlineMs??100});
 const p={a,b,creator,main,requests:[],replies:[],creatorClosed:0,mainClosed:0};
 p.creatorReceiver={message:q=>{p.requests.push(q);if(options.onCreator)options.onCreator(q,p);else if(options.autoReply!==false&&q.type.startsWith('startup-'))assert.equal(creator.send(reply(q)),true);},closed:()=>p.creatorClosed++};
 p.mainReceiver={message:q=>{p.replies.push(q);options.onMain?.(q,p);},closed:()=>p.mainClosed++};
 if(!options.noSubscribe){p.disposeCreatorSubscription=creator.subscribe(p.creatorReceiver);p.disposeMainSubscription=main.subscribe(p.mainReceiver);}return p;
}
async function authenticated(p){assert.equal(await p.main.authenticated,true);assert.equal(await p.creator.authenticated,true);assert.equal(p.main.isAvailable(),true);}
async function startup(p){for(const q of[begin(),chunk(),seal(),start()]){assert.equal(p.main.send(q),true);await tick();}assert.equal(await p.main.ready,true);assert.equal(await p.creator.ready,true);}
function dispose(p){p.main.dispose();p.creator.dispose();for(const q of p.requests)if(q.data)Uint8Array.prototype.fill.call(q.data,0);}

test('HMAC authentication leaves ready pending and fixes phase to startup',async()=>{
 const p=pair();let ready=false;p.main.ready.then(()=>ready=true);assert.equal(p.main.phase,'startup');assert.equal(p.main.isAvailable(),false);await authenticated(p);await tick();assert.equal(ready,false);assert.equal(p.main.phase,'startup');assert.equal(p.main.nativeExecutionAdmitted,false);assert.deepEqual(p.main.identity,{role:'main',...scope});dispose(p);
});
test('one lifetime subscriber carries all fixed startup phases then typed commands',async()=>{
 const p=pair();await authenticated(p);await startup(p);assert.deepEqual(p.requests.map(q=>q.type),['startup-begin','startup-chunk','startup-seal','startup-start']);assert.deepEqual(p.requests[1].data,Buffer.from('abc'));assert.equal(Object.hasOwn(p.requests[1],'dataBase64'),false);assert.equal(p.main.phase,'commands');assert.equal(p.creator.phase,'commands');assert.equal(p.main.send(command()),true);await tick();assert.equal(p.requests.at(-1).type,'command');assert.equal(p.creator.send(commandReply()),true);await tick();assert.equal(p.replies.at(-1).type,'command-result');dispose(p);
});
test('commands are forbidden before valid startup-ready in either direction',async()=>{
 for(const side of['main','creator']){const p=pair();await authenticated(p);assert.equal(p[side].send(side==='main'?command():commandReply()),false);assert.equal(p[side].phase,'closed');assert.equal(await p[side].ready,false);assert.equal(p.requests.length,0);dispose(p);}
});
test('single pending startup request is reserved before send or subscriber dispatch',async()=>{
 const p=pair({sync:true});await authenticated(p);assert.equal(p.main.send(begin()),true);assert.equal(p.replies.length,1);assert.equal(p.main.stats().pendingStartupRequests,0);assert.equal(p.creator.stats().pendingStartupRequests,0);dispose(p);
 const held=pair({autoReply:false});await authenticated(held);assert.equal(held.main.send(begin()),true);await tick();assert.equal(held.creator.stats().pendingStartupRequests,1);assert.equal(held.main.stats().pendingStartupRequests,1);assert.equal(held.main.send(chunk()),false);assert.equal(held.main.phase,'closed');dispose(held);
 const incoming=pair({autoReply:false});await authenticated(incoming);incoming.b.emit('data',Buffer.concat([frame(begin()),frame({...chunk(),data:undefined,dataBase64:'YWJj'})]));assert.equal(incoming.requests.length,1);assert.equal(incoming.creator.phase,'closed');dispose(incoming);
});
test('later requests retain every begin binding and cannot replace a begun transaction',async()=>{
 for(const patch of[{startupId:'other'},{sha256:'b'.repeat(64)},{sessionId:'other'},{channelId:'other'},{totalBytes:4,data:Buffer.from('abcd')},{chunkCount:2}]){const p=pair();await authenticated(p);assert.equal(p.main.send(begin()),true);await tick();assert.equal(p.main.send(chunk(patch)),false);assert.equal(p.main.phase,'closed');dispose(p);}
 const p=pair();await authenticated(p);p.main.send(begin());await tick();assert.equal(p.main.send(begin({startupId:'replacement'})),false);assert.equal(p.main.phase,'closed');dispose(p);
});
test('malformed, unmatched, wrong and duplicate startup replies permanently close',async()=>{
 for(const patch of[{sha256:'b'.repeat(64)},{startupId:'other'},{code:'PRIVATE_ERROR'},{status:'failed'},{extra:true},{type:'startup-ready'}]){const p=pair({autoReply:false});await authenticated(p);p.main.send(begin());p.a.emit('data',frame({...reply(begin()),...patch}));assert.equal(p.main.phase,'closed');assert.equal(p.mainClosed,1);assert.equal(await p.main.ready,false);dispose(p);}
 const p=pair();await authenticated(p);p.main.send(begin());await tick();p.a.emit('data',frame(reply(begin())));assert.equal(p.main.phase,'closed');dispose(p);
});
test('creator changes phase before ready publication so synchronous first command is not lost',async()=>{
 const phases=[];const p=pair({sync:true,onMain(q,p){if(q.type==='startup-ready'){phases.push(p.main.phase);assert.equal(p.main.send(command()),true);}},onCreator(q,p){if(q.type==='command'){phases.push(p.creator.phase);return;}assert.equal(p.creator.send(reply(q)),true);}});await authenticated(p);await startup(p);assert.deepEqual(phases,['commands','commands']);assert.equal(p.requests.at(-1).type,'command');assert.equal(p.creator.phase,'commands');dispose(p);
});
test('coalesced startup-ready and command reply route without a subscriber handoff',async()=>{
 const p=pair({autoReply:false});await authenticated(p);p.main.send(begin());await tick();p.creator.send(reply(begin()));await tick();p.main.send(start());await tick();p.b.mode='coalesce';assert.equal(p.creator.send(reply(start())),true);assert.equal(p.creator.phase,'commands');assert.equal(p.creator.send(commandReply()),true);p.a.emit('data',Buffer.concat(p.b.coalesced));assert.equal(p.main.phase,'commands');assert.deepEqual(p.replies.slice(-2).map(q=>q.type),['startup-ready','command-result']);assert.equal(await p.main.ready,true);dispose(p);
});
test('fragmented maximum startup chunk remains bounded and transfers an independent Buffer',async()=>{
 const p=pair(),data=Buffer.alloc(16384,7);await authenticated(p);p.a.mode='fragment';assert.equal(p.main.send(begin({totalBytes:16384})),true);await tick();assert.equal(p.main.send(chunk({totalBytes:16384,data})),true);await tick();assert.equal(p.requests[1].data.length,16384);assert.equal(p.requests[1].data[0],7);assert.notEqual(p.requests[1].data,data);assert.equal(data[0],7);assert.equal(p.main.stats().receiveCapacity,45060);dispose(p);
});
test('wrong secret, session, channel and old command domain cannot authenticate',async()=>{
 for(const options of[{creatorSecret:Buffer.alloc(32,90)},{creatorSession:'other'},{creatorChannel:'other'}]){const p=pair(options);assert.equal(await p.main.authenticated,false);assert.equal(await p.creator.authenticated,false);assert.equal(await p.main.ready,false);dispose(p);}
 assert.equal(typeof api.TerminalSessionCommandChannel,'function');const[a,b]=wires(),main=new api.TerminalSessionCommandChannel({stream:a,role:'main',...scope,secret:Buffer.alloc(32,89),deadlineMs:100});main.subscribe({message(){assert.fail();},closed(){}});b.on('data',bytes=>{const q=JSON.parse(bytes.subarray(4).toString()),nonce='c'.repeat(64),proof=createHmac('sha256',Buffer.alloc(32,89)).update(JSON.stringify(['siren-terminal-command',1,'creator-proof',scope.channelId,scope.sessionId,q.nonce,nonce])).digest('hex');b.write(frame({type:'proof',version:1,...scope,nonce,proof}));});assert.equal(await main.authenticated,false);b.destroy();
});
test('malformed UTF8, oversized frame/chunk and unknown envelopes close before dispatch',async()=>{
 for(const bytes of[Buffer.from([255,255,255,255]),Buffer.from([0,0,0,0]),Buffer.from([0,0,0,1,255]),Buffer.alloc(131073),frame({...begin(),shell:'run'})]){const p=pair();await authenticated(p);p.b.emit('data',bytes);assert.equal(p.creator.phase,'closed');assert.equal(p.requests.length,0);assert.equal(p.creator.stats().bufferedBytes,0);dispose(p);}
});
test('DATA options, subscribers, startup values and binary Proxy prototypes invoke no traps',async()=>{
 assert.equal(typeof api.TerminalSessionCommandChannel,'function');let touched=0;const trap={get(){touched++;throw Error('private');},ownKeys(){touched++;throw Error('private');},getPrototypeOf(){touched++;throw Error('private');}};
 const[a,b]=wires();const opts={stream:a,role:'main',...scope,secret:Buffer.alloc(32,89),deadlineMs:100};const getter={...opts};Object.defineProperty(getter,'secret',{get(){touched++;return opts.secret;}});
 for(const value of[getter,new Proxy(opts,trap),{...opts,stream:new Proxy(a,trap)},{...opts,secret:Object.create(new Proxy(Buffer.prototype,trap))},{...opts,secret:Object.setPrototypeOf(Buffer.alloc(32),new Proxy(Buffer.prototype,trap))},{...opts,extra:true}])assert.throws(()=>new api.TerminalSessionCommandChannel(value),TypeError);a.destroy();b.destroy();
 const p=pair();await authenticated(p);assert.throws(()=>p.main.subscribe(new Proxy({message(){},closed(){}},trap)),TypeError);p.main.send(begin());await tick();const bad=chunk({data:Object.setPrototypeOf(Buffer.from('abc'),new Proxy(Buffer.prototype,trap))});assert.equal(p.main.send(bad),false);assert.equal(touched,0);dispose(p);
 const received=pair();await authenticated(received);const bytes=frame(begin());for(const key of['length','copy','buffer','byteOffset'])Object.defineProperty(bytes,key,{get(){touched++;throw Error('private');}});received.b.emit('data',bytes);assert.equal(received.requests.length,1);assert.equal(touched,0);dispose(received);
});
test('subscriber callbacks are captured once and disposal never permits listener replacement',async()=>{
 const p=pair();p.creatorReceiver.message=()=>assert.fail('mutated callback');await authenticated(p);p.main.send(begin());await tick();assert.equal(p.requests.length,1);assert.throws(()=>p.creator.subscribe({message(){},closed(){}}),TypeError);p.disposeCreatorSubscription();assert.equal(p.creator.phase,'closed');assert.throws(()=>p.creator.subscribe({message(){},closed(){}}),TypeError);dispose(p);assert.equal(p.creatorClosed,1);
});
test('queue backpressure and reentrant queue-report closure refuse further publication',async()=>{
 const p=pair({autoReply:false});await authenticated(p);p.a.mode='hold';p.a._writableState.highWaterMark=1;assert.equal(p.main.send(begin()),true);assert.equal(p.main.stats().backpressured,true);assert.equal(p.main.send(chunk()),false);assert.equal(p.main.phase,'closed');dispose(p);
 const[a,b]=wires(true);let armed=false,target,writes=0;const wrap=s=>({on:(name,fn)=>s.on(name,fn),write(bytes){writes++;return s.write(bytes);},destroy:()=>s.destroy(),stats(){if(armed){armed=false;target.dispose();}return{writableLength:0};}});const creator=new api.TerminalSessionCommandChannel({stream:wrap(b),role:'creator',...scope,secret:Buffer.alloc(32,89),deadlineMs:100}),main=new api.TerminalSessionCommandChannel({stream:wrap(a),role:'main',...scope,secret:Buffer.alloc(32,89),deadlineMs:100});target=main;creator.subscribe({message(){},closed(){}});main.subscribe({message(){},closed(){}});assert.equal(await main.authenticated,true);const before=writes;armed=true;assert.equal(main.send(begin()),false);assert.equal(writes,before);assert.equal(main.phase,'closed');creator.dispose();
});
test('startup failure is handed to composer and supplies no readiness or cleanup receipt',async()=>{
 const p=pair({autoReply:false});await authenticated(p);let ready=false;p.main.ready.then(()=>ready=true);p.main.send(begin());await tick();assert.equal(p.creator.send({type:'startup-failed',...common,phase:'begin',status:'failed',code:'STARTUP_REFUSED'}),true);await tick();assert.equal(p.replies.at(-1).code,'STARTUP_REFUSED');assert.equal(p.main.phase,'startup');assert.equal(p.main.isAvailable(),true);assert.equal(p.main.stats().pendingStartupRequests,0);assert.equal(ready,false);dispose(p);assert.equal(await p.main.ready,false);
});
test('ready send failure fences the creator instead of publishing command readiness',async()=>{
 const p=pair({autoReply:false});await authenticated(p);p.main.send(begin());await tick();p.creator.send(reply(begin()));await tick();p.main.send(start());await tick();p.b._writableState.length=90121;assert.equal(p.creator.send(reply(start())),false);assert.equal(p.creator.phase,'closed');assert.equal(await p.creator.ready,false);p.b._writableState.length=0;dispose(p);
});
test('known loss notifies synchronously once and late packets cannot revive either Promise',async()=>{
 for(const event of['end','error','timeout','close']){const p=pair({autoReply:false});await authenticated(p);p.main.send(begin());p.a.emit(event);assert.equal(p.mainClosed,1);assert.equal(p.main.phase,'closed');assert.equal(p.main.stats().pendingStartupRequests,0);p.a.emit('data',frame(reply(begin())));assert.equal(await p.main.ready,false);assert.equal(p.main.isAvailable(),false);dispose(p);assert.equal(p.mainClosed,1);}
});
test('HMAC deadline is elapsed-time enforced and authenticated startup has no idle expiry',async()=>{
 assert.equal(typeof api.TerminalSessionCommandChannel,'function');const[a,b]=wires(),creator=new api.TerminalSessionCommandChannel({stream:b,role:'creator',...scope,secret:Buffer.alloc(32,89),deadlineMs:5});creator.subscribe({message(){assert.fail();},closed(){}});const until=performance.now()+8;while(performance.now()<until){}b.emit('data',frame({type:'challenge',version:1,...scope,nonce:'a'.repeat(64)}));assert.equal(await creator.authenticated,false);assert.equal(await creator.ready,false);a.destroy();creator.dispose();
 const p=pair({deadlineMs:20});await authenticated(p);await new Promise(resolve=>setTimeout(resolve,30));assert.equal(p.main.phase,'startup');assert.equal(p.main.isAvailable(),true);dispose(p);
});
test('authentication requires the single lifetime union subscriber to be installed',async()=>{
 const p=pair({noSubscribe:true});assert.equal(await p.main.authenticated,false);assert.equal(await p.creator.authenticated,false);assert.equal(await p.main.ready,false);dispose(p);
});
test('throwing chunk delivery wipes its owned bytes and fences the lifetime subscriber',async()=>{
 let owned;const p=pair({onCreator(q,p){if(q.type==='startup-chunk'){owned=q.data;throw Error('private provider detail');}assert.equal(p.creator.send(reply(q)),true);}});await authenticated(p);p.main.send(begin());await tick();p.main.send(chunk());await tick();assert.ok(owned);assert.deepEqual(owned,Buffer.alloc(3));assert.equal(p.creator.phase,'closed');assert.equal(p.creatorClosed,1);dispose(p);
});
test('ready correlation rejects a different gate or unverified extra shell fields; startup cannot recur after ready',async()=>{
 for(const patch of[{gateGeneration:4},{reportedShell:{pid:47,image:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',createdFileTime:'123'}}]){const p=pair({autoReply:false});await authenticated(p);p.main.send(begin());await tick();p.creator.send(reply(begin()));await tick();p.main.send(start());await tick();p.a.emit('data',frame({...reply(start()),...patch}));assert.equal(p.main.phase,'closed');assert.equal(await p.main.ready,false);dispose(p);}
 for(const side of['main','creator']){const p=pair();await authenticated(p);await startup(p);p[side==='main'?'a':'b'].emit('data',frame(side==='main'?reply(start()):begin()));assert.equal(p[side].phase,'closed');dispose(p);}
});
test('ready queue preflight cannot expose command dispatch before actual publication',async()=>{
 assert.equal(typeof api.TerminalSessionCommandChannel,'function');const[a,b]=wires(true);let armed=false,closed=0;const received=[];
 const creatorStream={on:(name,fn)=>b.on(name,fn),write:bytes=>b.write(bytes),destroy:()=>b.destroy(),stats(){if(armed){armed=false;b.emit('data',frame(command()));return{writableLength:90121};}return{writableLength:0};}};
 const creator=new api.TerminalSessionCommandChannel({stream:creatorStream,role:'creator',...scope,secret:Buffer.alloc(32,89),deadlineMs:100}),main=new api.TerminalSessionCommandChannel({stream:a,role:'main',...scope,secret:Buffer.alloc(32,89),deadlineMs:100});
 creator.subscribe({message:q=>{received.push(q.type);if(q.type==='startup-begin')assert.equal(creator.send(reply(q)),true);},closed(){closed++;}});main.subscribe({message(){},closed(){}});assert.equal(await main.authenticated,true);assert.equal(await creator.authenticated,true);assert.equal(main.send(begin()),true);assert.equal(main.send(start()),true);const before=b.writeCalls;armed=true;assert.equal(creator.send(reply(start())),false);assert.deepEqual(received,['startup-begin','startup-start']);assert.equal(b.writeCalls,before);assert.equal(creator.phase,'closed');assert.equal(await creator.ready,false);assert.equal(closed,1);main.dispose();creator.dispose();
});
for(const failure of['throw','post-queue'])test('failed ready '+failure+' discards synchronous commands before dispatch',async()=>{
 assert.equal(typeof api.TerminalSessionCommandChannel,'function');
  const[a,b]=wires(true);let armed=false,badQueue=false,closed=0;const received=[];
  const creatorStream={on:(name,fn)=>b.on(name,fn),write(bytes){if(armed){armed=false;b.emit('data',frame(command()));if(failure==='throw')throw Error('PRIVATE_WRITE_DETAIL');badQueue=true;return true;}return b.write(bytes);},destroy:()=>b.destroy(),stats(){return{writableLength:badQueue?90121:0};}};
  const creator=new api.TerminalSessionCommandChannel({stream:creatorStream,role:'creator',...scope,secret:Buffer.alloc(32,89),deadlineMs:100}),main=new api.TerminalSessionCommandChannel({stream:a,role:'main',...scope,secret:Buffer.alloc(32,89),deadlineMs:100});creator.subscribe({message:q=>{received.push(q.type);if(q.type==='startup-begin')assert.equal(creator.send(reply(q)),true);},closed(){closed++;}});main.subscribe({message(){},closed(){}});assert.equal(await main.authenticated,true);assert.equal(await creator.authenticated,true);main.send(begin());main.send(start());armed=true;assert.equal(creator.send(reply(start())),false);assert.deepEqual(received,['startup-begin','startup-start']);assert.equal(creator.phase,'closed');assert.equal(await creator.ready,false);assert.equal(closed,1);main.dispose();creator.dispose();
});
test('ready transition staging has a finite byte budget and overflow dispatches no commands',async()=>{
 assert.equal(typeof api.TerminalSessionCommandChannel,'function');const[a,b]=wires(true);let armed=false,peak=0;const received=[];
 const input={...command(),op:'input',inputSequence:0,dataBase64:Buffer.alloc(32768,97).toString('base64')};
 const creatorStream={on:(name,fn)=>b.on(name,fn),write(bytes){if(armed){armed=false;for(let requestId=1;requestId<=3;requestId++){b.emit('data',frame({...input,requestId}));peak=Math.max(peak,creator.stats().stagedCommandBytes);}return true;}return b.write(bytes);},destroy:()=>b.destroy(),stats(){return{writableLength:0};}};
 const creator=new api.TerminalSessionCommandChannel({stream:creatorStream,role:'creator',...scope,secret:Buffer.alloc(32,89),deadlineMs:100}),main=new api.TerminalSessionCommandChannel({stream:a,role:'main',...scope,secret:Buffer.alloc(32,89),deadlineMs:100});creator.subscribe({message:q=>{received.push(q.type);if(q.type==='startup-begin')assert.equal(creator.send(reply(q)),true);},closed(){}});main.subscribe({message(){},closed(){}});assert.equal(await main.authenticated,true);assert.equal(await creator.authenticated,true);main.send(begin());main.send(start());armed=true;assert.equal(creator.send(reply(start())),false);assert.deepEqual(received,['startup-begin','startup-start']);assert.ok(peak>45056&&peak<=90120);assert.equal(creator.stats().stagedCommandBytes,0);assert.equal(creator.stats().stagedCommandFrames,0);assert.equal(await creator.ready,false);main.dispose();creator.dispose();
});
test('malformed framing retires privately despite a public dispose shadow',async()=>{
 const p=pair();await authenticated(p);p.main.dispose=()=>false;p.a.emit('data',Buffer.from([0,0,0,0]));assert.equal(p.main.phase,'closed');assert.equal(p.mainClosed,1);assert.equal(await p.main.ready,false);p.creator.dispose();
});
test('lifetime subscription disposal and stream loss ignore public method shadows',async()=>{
 for(const action of['subscription','end']){const p=pair();await authenticated(p);p.main.dispose=()=>false;p.main.isAvailable=()=>true;if(action==='subscription')p.disposeMainSubscription();else p.a.emit('end');assert.equal(p.main.phase,'closed');assert.equal(p.main.stats().available,false);assert.equal(p.main.send(begin()),false);assert.equal(p.mainClosed,1);p.creator.dispose();}
});
test('public availability shadow cannot send a startup request before authentication',async()=>{
 const p=pair();p.main.isAvailable=()=>true;const before=p.a.writeCalls;assert.equal(p.main.send(begin()),false);assert.equal(p.a.writeCalls,before);assert.equal(p.main.stats().available,false);dispose(p);
});
