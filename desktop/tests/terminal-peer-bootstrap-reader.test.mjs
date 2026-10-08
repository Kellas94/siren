// Pure Node streams and inert native callbacks; no addon, child, PTY or shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough,Readable} from 'node:stream';
import {performance} from 'node:perf_hooks';
import {createTerminalBootstrap} from '../src/terminal/bootstrap-codec.mjs';
const api=await import('../src/terminal/peer-bootstrap-reader.mjs').catch(error=>{
 if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};
});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const zero=value=>Buffer.isBuffer(value)&&value.every(byte=>byte===0);
function fixture(){
 const bootstrap=createTerminalBootstrap({sessionId:'peer-session',channelId:'peer-channel'});
 const bytes=Buffer.alloc(16+bootstrap.payload.length,0xa5);Buffer.from('SIRENTP2').copy(bytes);bootstrap.payload.copy(bytes,16);
 return {bootstrap,bytes,dispose(){bootstrap.dispose();bytes.fill(0);}};
}
function inertNative(transform=value=>value){
 const consumed=[],closed=[],payloads=[],witness=Object.freeze(Object.create(null));
 const native={
  consumePeerBootstrap(bytes){
   consumed.push(bytes);
   try{
    if(bytes.length<96||bytes.length>2064||!bytes.subarray(0,8).equals(Buffer.from('SIRENTP2')))throw Error('PRIVATE_NATIVE_ERROR');
    const payload=Buffer.from(bytes.subarray(16));payloads.push(payload);return transform({witness,payload});
   }finally{bytes.fill(0,0,Math.min(bytes.length,2065));}
  },
  closePeerWitness(value){assert.equal(value,witness);closed.push(value);return true;},
 };
 return {native,consumed,closed,payloads,witness};
}
function read(input,options,...extra){assert.equal(typeof api.readPeerTerminalBootstrap,'function');return api.readPeerTerminalBootstrap(input,options,...extra);}
class DelayedClose extends PassThrough{
 _destroy(error,callback){this.finishClose=()=>callback(error);}
}
async function finish(input,promise,bytes){input.end(bytes);return promise;}

test('peer reader publishes frozen bootstrap and opaque witness only after EOF and actual close',async()=>{
 const f=fixture(),n=inertNative(),input=new PassThrough();let settled=false;
 const pending=read(input,{native:n.native});pending.then(()=>{settled=true;},()=>{});
 const first=Buffer.from(f.bytes.subarray(0,11)),rest=Buffer.from(f.bytes.subarray(11));input.write(first);input.write(rest);
 await tick();assert.equal(settled,false);assert.equal(n.consumed.length,0);
 const result=await finish(input,pending);assert.equal(input.closed,true);assert.equal(n.consumed.length,1);
 assert.equal(result.bootstrap.sessionId,'peer-session');assert.equal(result.bootstrap.channelId,'peer-channel');
 assert.equal(result.bootstrap.nativeExecutionAdmitted,false);assert.deepEqual(result.bootstrap.controlSecret,f.bootstrap.controlSecret);
 assert.equal(result.witness,n.witness);assert.equal(Object.isFrozen(result),true);
 assert.deepEqual(Reflect.ownKeys(result).sort(),['bootstrap','dispose','witness']);assert.deepEqual(Object.keys(result),['bootstrap']);
 assert.equal(JSON.stringify(result).includes('witness'),false);assert.equal(JSON.stringify(result).includes('Secret'),false);
 // Node may coalesce buffered fragments; assert the reader-owned byte window
 // and the actual existing decoder's native-returned payload, not caller copies.
 assert.ok(zero(n.consumed[0])&&zero(n.payloads[0]));
 assert.equal(result.dispose(),true);assert.equal(result.dispose(),true);assert.equal(n.closed.length,1);
 assert.ok(zero(result.bootstrap.controlSecret)&&zero(result.bootstrap.dataSecret));f.dispose();
});
test('successful EOF cannot consume or publish while actual close is delayed',async()=>{
 const f=fixture(),n=inertNative(),input=new DelayedClose();let settled=false;
 const pending=read(input,{native:n.native});pending.then(()=>{settled=true;},()=>{});input.end(Buffer.from(f.bytes));await tick();
 assert.equal(input.readableEnded,true);assert.equal(input.closed,false);assert.equal(n.consumed.length,0);assert.equal(settled,false);
 input.finishClose();const result=await pending;assert.equal(n.consumed.length,1);result.dispose();f.dispose();
});
test('truncated and noncanonical payloads refuse without publishing and revoke a consumed witness',async()=>{
 const f=fixture();
 for(const bytes of [Buffer.from(f.bytes.subarray(0,20)),Buffer.from(f.bytes.subarray(0,-1)),Buffer.concat([f.bytes,Buffer.from([1])]),Buffer.from(f.bytes)]){
  const n=inertNative(),input=new PassThrough();if(bytes.length===f.bytes.length)bytes[16]=0;
  await assert.rejects(finish(input,read(input,{native:n.native}),bytes),error=>error.message==='TERMINAL_PEER_BOOTSTRAP_REFUSED');
  assert.ok(zero(bytes));assert.equal(input.closed,true);assert.equal(n.closed.length,n.payloads.length);assert.ok(n.payloads.every(zero));
 }
 f.dispose();
});
test('reader caps pulls at 2065 bytes and never consumes an oversized packet',async()=>{
 const n=inertNative(),input=new PassThrough(),bytes=Buffer.alloc(8192,7),pending=read(input,{native:n.native});
 input.end(bytes);await assert.rejects(pending,error=>error.message==='TERMINAL_PEER_BOOTSTRAP_REFUSED');
 assert.equal(n.consumed.length,0);assert.ok(zero(bytes.subarray(0,2065)));assert.equal(bytes[2065],7);
});
test('open input times out without consuming and observes late errors until actual close',async()=>{
 const f=fixture(),n=inertNative(),input=new DelayedClose(),pending=read(input,{native:n.native,timeoutMs:15});
 input.write(Buffer.from(f.bytes));await assert.rejects(pending,error=>error.message==='TERMINAL_PEER_BOOTSTRAP_TIMEOUT');
 assert.equal(n.consumed.length,0);assert.equal(input.listenerCount('readable'),0);assert.equal(input.listenerCount('end'),0);
 assert.equal(input.listenerCount('error'),1);input.emit('error',Error('PRIVATE_LATE_ERROR'));input.emit('error',Error('PRIVATE_LATE_ERROR_2'));
 input.finishClose();await tick();assert.equal(input.listenerCount('error'),0);assert.equal(n.consumed.length,0);f.dispose();
});
test('deadline before delayed close never consumes even after close eventually arrives',async()=>{
 const f=fixture(),n=inertNative(),input=new DelayedClose(),pending=read(input,{native:n.native,timeoutMs:15});input.end(Buffer.from(f.bytes));
 await assert.rejects(pending,error=>error.message==='TERMINAL_PEER_BOOTSTRAP_TIMEOUT');input.finishClose();await tick();assert.equal(n.consumed.length,0);f.dispose();
});
test('a premature close event retains late-error protection until the stream actually closes',async()=>{
 const n=inertNative(),input=new DelayedClose(),pending=read(input,{native:n.native});input.emit('close');
 await assert.rejects(pending,error=>error.message==='TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED');
 assert.equal(input.closed,false);assert.equal(input.listenerCount('error'),1);input.emit('error',Error('PRIVATE_AFTER_PREMATURE_CLOSE'));
 input.finishClose();await tick();assert.equal(input.listenerCount('error'),0);assert.equal(n.consumed.length,0);
});
test('invalid native arguments also observe errors through a premature close and actual teardown',async()=>{
 const input=new DelayedClose();await assert.rejects(read(input,{}),/TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED/);
 input.emit('close');assert.equal(input.closed,false);assert.equal(input.listenerCount('error'),1);input.emit('error',Error('PRIVATE_REJECTED_INPUT_ERROR'));
 input.finishClose();await tick();assert.equal(input.listenerCount('error'),0);
});
test('elapsed deadline is checked before native consume even before timer callback runs',async()=>{
 const f=fixture(),n=inertNative(),input=new PassThrough(),pending=read(input,{native:n.native,timeoutMs:5});
 const until=performance.now()+20;while(performance.now()<until){}input.end(Buffer.from(f.bytes));
 await assert.rejects(pending,error=>error.message==='TERMINAL_PEER_BOOTSTRAP_TIMEOUT');assert.equal(n.consumed.length,0);f.dispose();
});
test('native consume crossing deadline revokes witness and clears returned payload',async()=>{
 const f=fixture(),n=inertNative(value=>{const until=performance.now()+25;while(performance.now()<until){}return value;});
 const input=new PassThrough(),pending=read(input,{native:n.native,timeoutMs:10});input.end(Buffer.from(f.bytes));
 await assert.rejects(pending,error=>error.message==='TERMINAL_PEER_BOOTSTRAP_TIMEOUT');assert.equal(n.closed.length,1);assert.ok(n.payloads.every(zero));f.dispose();
});
test('reentrant stream error during native consume revokes the subsequently returned witness',async()=>{
 const f=fixture(),input=new PassThrough(),n=inertNative(value=>{input.emit('error',Error('PRIVATE_REENTRANT_ERROR'));return value;});
 const pending=read(input,{native:n.native});input.end(Buffer.from(f.bytes));
 await assert.rejects(pending,error=>error.message==='TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED');
 assert.equal(n.consumed.length,1);assert.equal(n.closed.length,1);assert.ok(n.payloads.every(zero));f.dispose();
});
test('reentrant close during native consume cannot consume the bounded packet twice',async()=>{
 const f=fixture(),input=new PassThrough();let reentered=false;
 const n=inertNative(value=>{if(!reentered){reentered=true;input.emit('close');}return value;});
 const pending=read(input,{native:n.native});input.end(Buffer.from(f.bytes));const result=await pending;
 assert.equal(n.consumed.length,1);result.dispose();assert.equal(n.closed.length,1);f.dispose();
});
test('input errors and early close refuse with constant errors and no native consume',async()=>{
 for(const mode of ['error','close']){const n=inertNative(),input=new PassThrough(),pending=read(input,{native:n.native});
  input.destroy(mode==='error'?Error('PRIVATE_STREAM_ERROR'):undefined);await assert.rejects(pending,error=>error.message==='TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED');assert.equal(n.consumed.length,0);
 }
});
test('native throw and malformed DATA result refuse generically and clean recoverable ownership',async()=>{
 const f=fixture();
 for(const {transform,close,wipe} of [
  {transform:()=>{throw Error('PRIVATE_NATIVE_ERROR');},close:0,wipe:false},
  {transform:()=>null,close:0,wipe:false},
  {transform:value=>({...value,extra:1}),close:1,wipe:true},
  {transform:value=>({...value,payload:'PRIVATE'}),close:1,wipe:false},
  {transform:value=>({...value,witness:7}),close:0,wipe:true},
 ]){
  const n=inertNative(transform),input=new PassThrough(),pending=read(input,{native:n.native});input.end(Buffer.from(f.bytes));
  await assert.rejects(pending,error=>error.message==='TERMINAL_PEER_BOOTSTRAP_REFUSED');assert.ok(n.consumed.every(zero));
  assert.equal(n.closed.length,close);
  // Payloads returned as DATA must be wiped even when the rest of the result is malformed.
  if(wipe)assert.ok(n.payloads.every(zero));
 }
 f.dispose();
});
test('native result accessors and Proxies execute no getter or Proxy trap',async()=>{
 const f=fixture();let touched=0;
 for(const transform of [value=>Object.defineProperty({witness:value.witness},'payload',{enumerable:true,get(){touched++;return value.payload;}}),value=>new Proxy(value,{ownKeys(){touched++;return ['witness','payload'];},getOwnPropertyDescriptor(){touched++;throw Error('PRIVATE');},getPrototypeOf(){touched++;return Object.prototype;}})]){
  const n=inertNative(transform),input=new PassThrough(),pending=read(input,{native:n.native});input.end(Buffer.from(f.bytes));
  await assert.rejects(pending,/TERMINAL_PEER_BOOTSTRAP_REFUSED/);assert.equal(touched,0);
 }
 f.dispose();
});
test('native callbacks are captured once as DATA methods with original receiver',async()=>{
 const f=fixture(),n=inertNative(),original=n.native.consumePeerBootstrap,close=n.native.closePeerWitness;
 n.native.consumePeerBootstrap=function(bytes){assert.equal(this,n.native);return original.call(this,bytes);};
 n.native.closePeerWitness=function(witness){assert.equal(this,n.native);return close.call(this,witness);};
 const input=new PassThrough(),pending=read(input,{native:n.native});n.native.consumePeerBootstrap=()=>{throw Error('PRIVATE_REPLACEMENT');};n.native.closePeerWitness=()=>{throw Error('PRIVATE_REPLACEMENT');};
 const result=await finish(input,pending,Buffer.from(f.bytes));assert.equal(result.dispose(),true);assert.equal(n.closed.length,1);f.dispose();
});
test('undefined timeout uses the default budget with null-prototype DATA options',async()=>{
 const f=fixture(),n=inertNative(),options=Object.assign(Object.create(null),{native:n.native,timeoutMs:undefined});
 const input=new PassThrough(),pending=read(input,options);input.end(Buffer.from(f.bytes));const result=await pending;
 assert.equal(result.bootstrap.sessionId,'peer-session');result.dispose();f.dispose();
});
test('callback getters, callback Proxies and native object Proxies refuse without executing them',async()=>{
 let touched=0;const n=inertNative();
 const getter={closePeerWitness:n.native.closePeerWitness};Object.defineProperty(getter,'consumePeerBootstrap',{get(){touched++;return n.native.consumePeerBootstrap;}});
 const proxy=new Proxy(n.native,{get(){touched++;throw Error('PRIVATE');},getOwnPropertyDescriptor(){touched++;throw Error('PRIVATE');},getPrototypeOf(){touched++;throw Error('PRIVATE');}});
 const callable=new Proxy(n.native.consumePeerBootstrap,{apply(){touched++;throw Error('PRIVATE');}});
 for(const native of [getter,proxy,{...n.native,consumePeerBootstrap:callable},{consumePeerBootstrap:n.native.consumePeerBootstrap}]){
  const input=new PassThrough();await assert.rejects(read(input,{native}),/TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED/);assert.equal(input.destroyed,true);assert.equal(touched,0);
 }
});
test('unknown arguments, options accessors and options Proxies refuse without invoking traps',async()=>{
 const n=inertNative();let touched=0;const getter={native:n.native};Object.defineProperty(getter,'timeoutMs',{enumerable:true,get(){touched++;return 10;}});
 const proxy=new Proxy({native:n.native},{ownKeys(){touched++;return [];},getPrototypeOf(){touched++;throw Error('PRIVATE');}});
 for(const options of [undefined,null,{},getter,proxy,{native:n.native,timeoutMs:0},{native:n.native,timeoutMs:5001},{native:n.native,timeoutMs:1.5},{native:n.native,extra:true},{native:n.native,[Symbol('extra')]:true}]){
  const input=new PassThrough();await assert.rejects(read(input,options),/TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED/);assert.equal(touched,0);
 }
 await assert.rejects(read(new PassThrough(),{native:n.native},'extra'),/TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED/);
});
test('non-byte, flowing, ended, destroyed and Proxy streams refuse without native consume',async()=>{
 const n=inertNative();let touched=0;const flowing=new PassThrough();flowing.resume();const ended=new PassThrough();ended.end();ended.resume();await tick();
 const destroyed=new PassThrough();destroyed.destroy();await tick();const proxy=new Proxy(new PassThrough(),{getPrototypeOf(){touched++;throw Error('PRIVATE');}});
 for(const input of [{},Readable.from([{}]),new PassThrough({encoding:'utf8'}),flowing,ended,destroyed,proxy])await assert.rejects(read(input,{native:n.native}),/TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED/);
 assert.equal(n.consumed.length,0);assert.equal(touched,0);
});
test('a Proxy in the input prototype chain refuses without running its traps or leaking its error',async()=>{
 const n=inertNative(),input=new PassThrough();let touched=0;
 const prototype=new Proxy(Object.getPrototypeOf(input),{getPrototypeOf(){touched++;throw Error('PRIVATE_PROTOTYPE_ERROR');}});Object.setPrototypeOf(input,prototype);
 await assert.rejects(read(input,{native:n.native}),error=>error.message==='TERMINAL_PEER_BOOTSTRAP_STREAM_REFUSED');
 assert.equal(touched,0);assert.equal(n.consumed.length,0);
 // Restore the test-owned stream for ordinary local cleanup.
 Object.setPrototypeOf(input,PassThrough.prototype);input.destroy();
});
test('empty EOF refuses promptly and every packet byte can arrive separately',async()=>{
 const empty=new PassThrough(),n=inertNative(),pending=read(empty,{native:n.native});empty.end();await assert.rejects(pending,/TERMINAL_PEER_BOOTSTRAP_REFUSED/);
 const f=fixture(),input=new PassThrough(),good=read(input,{native:n.native});for(const byte of f.bytes)input.write(Buffer.from([byte]));input.end();
 const result=await good;assert.deepEqual(result.bootstrap.dataSecret,f.bootstrap.dataSecret);result.dispose();f.dispose();
});
test('dispose revokes secrets even if native witness close throws and never retries ownership',async()=>{
 const f=fixture(),n=inertNative();let closes=0;n.native.closePeerWitness=()=>{closes++;throw Error('PRIVATE_CLOSE_ERROR');};
 const input=new PassThrough(),result=await finish(input,read(input,{native:n.native}),Buffer.from(f.bytes));
 assert.equal(result.dispose(),false);assert.equal(result.dispose(),false);assert.equal(closes,1);assert.ok(zero(result.bootstrap.controlSecret)&&zero(result.bootstrap.dataSecret));f.dispose();
});
