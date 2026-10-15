import test from 'node:test';
import assert from 'node:assert/strict';
import {Duplex} from 'node:stream';
import {createHmac} from 'node:crypto';
const api=await import('../src/terminal/command-channel.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const scope={channelId:'commands1',sessionId:'session1'};
const token=()=>({...scope,projectId:'project1',windowId:'window1',epoch:1,leaseId:'lease1',generation:2,gateGeneration:3});
const request=(op='install',extra={})=>({type:'command',op,...scope,requestId:1,token:token(),...extra});
const reply=(extra={})=>({type:'command-result',op:'install',...scope,requestId:1,token:token(),status:'accepted',code:'COMMAND_ACCEPTED',...extra});
const frame=value=>{const body=Buffer.from(JSON.stringify(value)),header=Buffer.alloc(4);header.writeUInt32BE(body.length);return Buffer.concat([header,body]);};
function wires(){
 let a,b;const make=peer=>{const s=new Duplex({read(){},write(bytes,encoding,done){s.frames.push(Buffer.from(bytes));if(s.mode==='hold'){s.complete=done;return;}if(s.mode==='fragment'){for(let i=0;i<bytes.length;i+=7)peer().emit('data',Buffer.from(bytes.subarray(i,i+7)));done();return;}queueMicrotask(()=>{const p=peer();if(!p.destroyed)p.push(Buffer.from(bytes));done();});},destroy(error,done){queueMicrotask(()=>{const p=peer();if(!p.destroyed)p.push(null);});done(error);}});s.frames=[];s.on('error',()=>{});return s;};a=make(()=>b);b=make(()=>a);return[a,b];
}
function pair(opts={}){
 assert.equal(typeof api.TerminalCommandChannel,'function');const[a,b]=wires();
 const creator=new api.TerminalCommandChannel({stream:b,role:'creator',channelId:opts.channelId??scope.channelId,sessionId:opts.sessionId??scope.sessionId,secret:opts.secret??Buffer.alloc(32,31),deadlineMs:opts.deadlineMs??100});
 const main=new api.TerminalCommandChannel({stream:a,role:'main',...scope,secret:Buffer.alloc(32,31),deadlineMs:opts.deadlineMs??100});return{a,b,creator,main};
}
async function ready(p){assert.equal(await p.main.ready,true);assert.equal(await p.creator.ready,true);}
const receiver=messages=>({message:value=>messages.push(value),closed:()=>{}});

test('independent command startup delivers typed requests and correlated replies only',async()=>{
 const p=pair(),commands=[],replies=[];p.creator.subscribe(receiver(commands));p.main.subscribe(receiver(replies));await ready(p);
 assert.equal(p.main.send(request('input',{inputSequence:0,data:'AΩ😀'})),true);await tick();assert.equal(commands[0].data,'AΩ😀');assert.equal(Object.hasOwn(commands[0],'dataBase64'),false);
 assert.equal(p.creator.send(reply({op:'input'})),true);await tick();assert.equal(replies[0].requestId,1);assert.equal(replies[0].token.gateGeneration,3);assert.equal(p.main.nativeExecutionAdmitted,false);p.main.dispose();
});
test('wrong command secret/session/channel cannot activate either endpoint',async()=>{
 for(const options of [{secret:Buffer.alloc(32,32)},{sessionId:'other'},{channelId:'other'}]){const p=pair(options);assert.equal(await p.main.ready,false);assert.equal(await p.creator.ready,false);p.main.dispose();}
});
test('history and gate domain proofs are rejected by command authentication',async()=>{
 for(const domain of ['history','control']){
  assert.equal(typeof api.TerminalCommandChannel,'function');const[a,b]=wires();const main=new api.TerminalCommandChannel({stream:a,role:'main',...scope,secret:Buffer.alloc(32,31),deadlineMs:100});
  b.on('data',bytes=>{const c=JSON.parse(bytes.subarray(4).toString()),nonce='a'.repeat(64),parts=domain==='history'?['siren-terminal-history',1,'creator-proof',scope.channelId,scope.sessionId,c.nonce,nonce]:['siren-terminal-control',1,'creator-proof',scope.channelId,c.nonce,nonce],proof=createHmac('sha256',Buffer.alloc(32,31)).update(JSON.stringify(parts)).digest('hex');b.write(frame({type:'proof',version:1,...scope,nonce,proof}));});
  assert.equal(await main.ready,false);assert.equal(main.isAvailable(),false);b.destroy();
 }
});
test('fragmented maximum Unicode input and coalesced commands remain bounded',async()=>{
 const p=pair(),messages=[];p.creator.subscribe(receiver(messages));await ready(p);
 p.a.mode='fragment';
 assert.equal(p.main.send(request('input',{inputSequence:0,data:'😀'.repeat(8192)})),true);assert.equal(messages[0].data.length,16384);assert.equal(Buffer.byteLength(messages[0].data),32768);
 p.a.mode='normal';p.b.emit('data',Buffer.concat([frame(request('install',{requestId:2})),frame(request('revoke',{requestId:3}))]));assert.equal(messages.length,3);assert.ok(p.creator.stats().receiveCapacity<=45060);p.main.dispose();
});
test('oversized, malformed UTF8 and unknown command frames close before dispatch',async()=>{
 for(const bad of [Buffer.from([255,255,255,255]),Buffer.from([0,0,0,0]),Buffer.from([0,0,0,1,255]),frame({...request(),shell:'run'}),frame({...request(),sessionId:'other'}),Buffer.alloc(128*1024+1)]){
  const p=pair(),messages=[];p.creator.subscribe(receiver(messages));await ready(p);p.b.emit('data',bad);assert.equal(p.creator.isAvailable(),false);assert.equal(messages.length,0);assert.equal(p.creator.stats().bufferedBytes,0);p.main.dispose();
 }
});
test('application direction and malformed reply close the lane',async()=>{
 for(const side of ['main','creator']){const p=pair();await ready(p);assert.equal(p[side].send(side==='main'?reply():request()),false);assert.equal(p[side].isAvailable(),false);p.main.dispose();}
 const p=pair(),messages=[];p.main.subscribe(receiver(messages));await ready(p);p.a.emit('data',frame(reply({code:'secret text'})));assert.equal(messages.length,0);assert.equal(p.main.isAvailable(),false);p.main.dispose();
});
test('EOF/error/timeout/close synchronously revoke and notify exactly once',async()=>{
 for(const event of ['end','error','timeout','close']){const p=pair();let closed=0;p.main.subscribe({message(){assert.fail('late message');},closed(){closed++;}});await ready(p);p.a.emit(event);assert.equal(p.main.isAvailable(),false);assert.equal(closed,1);p.a.emit('data',frame(reply()));p.a.emit('close');assert.equal(closed,1);assert.equal(p.main.send(request()),false);p.main.dispose();}
});
test('startup deadline cannot publish readiness or accept late frames',async()=>{
 assert.equal(typeof api.TerminalCommandChannel,'function');const[a,b]=wires();let closed=0;const channel=new api.TerminalCommandChannel({stream:a,role:'creator',...scope,secret:Buffer.alloc(32,31),deadlineMs:10});channel.subscribe({message(){assert.fail();},closed(){closed++;}});
 assert.equal(await channel.ready,false);a.emit('data',frame({type:'challenge',version:1,...scope,nonce:'a'.repeat(64)}));assert.equal(channel.isAvailable(),false);assert.equal(closed,1);b.destroy();
});
test('authenticated idle stream has no recurring expiry',async()=>{
 const p=pair({deadlineMs:20});await ready(p);await sleep(35);assert.equal(p.main.isAvailable(),true);assert.equal(p.creator.isAvailable(),true);p.main.dispose();
});
test('backpressure permits one write then refuses a second without growing the queue',async()=>{
 const p=pair();await ready(p);p.a.mode='hold';p.a._writableState.highWaterMark=1;assert.equal(p.main.send(request()),true);assert.equal(p.main.stats().backpressured,true);assert.equal(p.main.send(request('revoke',{requestId:2})),false);assert.equal(p.main.isAvailable(),false);assert.ok(p.main.stats().maxWriteBytes<=90120);p.main.dispose();
});
test('drain permits the next bounded write and excessive queue charge refuses',async()=>{
 const p=pair();p.creator.subscribe(receiver([]));await ready(p);p.a.mode='hold';p.a._writableState.highWaterMark=1;assert.equal(p.main.send(request()),true);p.a.complete();await tick();assert.equal(p.main.stats().backpressured,false);p.a.mode='normal';p.a._writableState.highWaterMark=65536;assert.equal(p.main.send(request('revoke',{requestId:2})),true);await tick();p.a._writableState.length=90121;assert.equal(p.main.send(request()),false);assert.equal(p.main.isAvailable(),false);p.a._writableState.length=0;p.main.dispose();
});
test('one captured disposable subscriber refuses Proxy/getter callbacks without traps',async()=>{
 const p=pair();let touched=0;const bad={closed(){}};Object.defineProperty(bad,'message',{enumerable:true,get(){touched++;return()=>{};}});assert.throws(()=>p.main.subscribe(bad));
 assert.throws(()=>p.main.subscribe(new Proxy({message(){},closed(){}},{ownKeys(){touched++;return[];}})));assert.equal(touched,0);
 const values=[],r=receiver(values),unsubscribe=p.main.subscribe(r);r.message=()=>assert.fail('mutated callback');assert.throws(()=>p.main.subscribe(receiver([])));unsubscribe();p.main.subscribe(receiver(values));await ready(p);p.creator.send(reply());await tick();assert.equal(values.length,1);p.main.dispose();
});
test('Proxy/accessor options, streams and send values reject without touching traps',async()=>{
 assert.equal(typeof api.TerminalCommandChannel,'function');let touched=0;const options={role:'main',...scope,secret:Buffer.alloc(32,31),stream:{}};Object.defineProperty(options,'stream',{enumerable:true,get(){touched++;return{};}});assert.throws(()=>new api.TerminalCommandChannel(options));
 assert.throws(()=>new api.TerminalCommandChannel(new Proxy({}, {ownKeys(){touched++;return[];}})));
 const stream=new Proxy({}, {get(){touched++;return()=>{};},getPrototypeOf(){touched++;return null;}});assert.throws(()=>new api.TerminalCommandChannel({role:'main',...scope,secret:Buffer.alloc(32,31),stream}));assert.equal(touched,0);
 const p=pair();await ready(p);assert.equal(p.main.send(new Proxy(request(),{ownKeys(){touched++;return[];}})),false);assert.equal(touched,0);p.main.dispose();
});
test('non-enumerable own stream methods are captured before later mutation',async()=>{
 assert.equal(typeof api.TerminalCommandChannel,'function');const[a,b]=wires();for(const s of[a,b])for(const name of ['on','write','destroy'])Object.defineProperty(s,name,{value:s[name],writable:true,configurable:true});
 const creator=new api.TerminalCommandChannel({stream:b,role:'creator',...scope,secret:Buffer.alloc(32,31),deadlineMs:100}),main=new api.TerminalCommandChannel({stream:a,role:'main',...scope,secret:Buffer.alloc(32,31),deadlineMs:100});const values=[];creator.subscribe(receiver(values));await ready({main,creator});a.write=()=>assert.fail('mutated write');assert.equal(main.send(request()),true);await tick();assert.equal(values.length,1);main.dispose();
});
test('reentrant adapter stats closure fences the underlying write synchronously',async()=>{
 for(const role of['main','creator']){
  const[a,b]=wires();let armed=false,target,writes=0,closed=0;
  const wrap=(stream,observed)=>({on(event,callback){stream.on(event,callback);},write(bytes){if(observed)writes++;return stream.write(bytes);},destroy(){stream.destroy();},stats(){if(observed&&armed){armed=false;target.dispose();}return{writableLength:stream.writableLength};}});
  const creator=new api.TerminalCommandChannel({stream:wrap(b,role==='creator'),role:'creator',...scope,secret:Buffer.alloc(32,31),deadlineMs:100}),main=new api.TerminalCommandChannel({stream:wrap(a,role==='main'),role:'main',...scope,secret:Buffer.alloc(32,31),deadlineMs:100});
  target=role==='main'?main:creator;target.subscribe({message(){assert.fail('late frame');},closed(){closed++;}});await ready({main,creator});
  const before=writes;armed=true;assert.equal(target.send(role==='main'?request():reply()),false);assert.equal(target.isAvailable(),false);assert.equal(closed,1);assert.equal(writes,before,'no underlying write after stats reports known local closure');main.dispose();creator.dispose();
 }
});

test('malformed binary prototypes are refused without Proxy traps or escaped stream errors',()=>{
 assert.equal(typeof api.TerminalCommandChannel,'function');
 for(const realBuffer of[false,true]){
  let hits=0;const bad=()=>{const proxy=new Proxy({}, {getPrototypeOf(){hits++;throw Error('PRIVATE_PROXY_TRAP');}});return realBuffer?Object.setPrototypeOf(Buffer.alloc(32),proxy):Object.create(proxy);};
  const stream={on(){},write(){return true;},destroy(){},stats(){return{writableLength:0};}};
  assert.throws(()=>new api.TerminalCommandChannel({stream,role:'creator',...scope,secret:bad(),deadlineMs:100}),error=>error instanceof TypeError&&error.message==='Bounded command data stream required');assert.equal(hits,0);
  const callbacks=new Map();stream.on=(event,callback)=>callbacks.set(event,callback);let closed=0;
  const channel=new api.TerminalCommandChannel({stream,role:'creator',...scope,secret:Buffer.alloc(32,31),deadlineMs:100});channel.subscribe({message(){assert.fail('malformed bytes dispatched');},closed(){closed++;}});
  try{assert.doesNotThrow(()=>callbacks.get('data')(bad()));assert.equal(hits,0);assert.equal(channel.stats().closed,true);assert.equal(closed,1);}finally{channel.dispose();}
 }
});

test('binary length and copy accessors cannot execute during secret or chunk validation',async()=>{
 let hits=0;const decorate=bytes=>{for(const key of['length','copy','buffer','byteLength','byteOffset'])Object.defineProperty(bytes,key,{get(){hits++;throw Error('PRIVATE_BINARY_ACCESSOR');}});return bytes;};
 const[a,b]=wires(),creator=new api.TerminalCommandChannel({stream:b,role:'creator',...scope,secret:decorate(Buffer.alloc(32,31)),deadlineMs:100}),main=new api.TerminalCommandChannel({stream:a,role:'main',...scope,secret:decorate(Buffer.alloc(32,31)),deadlineMs:100});
 const commands=[];creator.subscribe(receiver(commands));try{await ready({main,creator});b.emit('data',decorate(frame(request())));assert.equal(commands.length,1);assert.equal(hits,0);}finally{main.dispose();creator.dispose();}
});
