// Real Readables with inert DATA native callbacks; no addon or kernel proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough,Readable} from 'node:stream';
import {performance} from 'node:perf_hooks';
const codec=await import('../src/terminal/three-lane-bootstrap-codec.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const api=await import('../src/terminal/three-lane-bootstrap-reader.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const tick=()=>new Promise(resolve=>setImmediate(resolve)),zero=value=>Uint8Array.prototype.every.call(value,byte=>byte===0);
const read=(input,options)=>{assert.equal(typeof api.readThreeLaneTerminalBootstrap,'function');return api.readThreeLaneTerminalBootstrap(input,options);};
function packet(){assert.equal(typeof codec.createThreeLaneTerminalBootstrap,'function');const b=codec.createThreeLaneTerminalBootstrap({sessionId:'session1',channelId:'channel1'}),bytes=Buffer.alloc(b.payload.length+16,0xa5);Buffer.from('SIRENTP3').copy(bytes);b.payload.copy(bytes,16);return{b,bytes};}
function native(transform=value=>value){const consumed=[],payloads=[],closed=[],witness=Object.freeze({});const object={consumePeerBootstrap(bytes){consumed.push(bytes);try{if(bytes.subarray(0,8).toString()!=='SIRENTP3')throw Error('PRIVATE_NATIVE');const payload=Buffer.from(bytes.subarray(16));payloads.push(payload);return transform({witness,payload});}finally{bytes.fill(0);}},closePeerWitness(value){assert.equal(value,witness);closed.push(value);return true;}};return{object,consumed,payloads,closed,witness};}
class DelayedClose extends PassThrough{_destroy(error,callback){this.completeClose=()=>callback(error);}}

test('three-lane reader waits for successful EOF and actual close then wipes payload and hides witness',async()=>{
 const f=packet(),n=native(),input=new DelayedClose(),pending=read(input,{native:n.object});input.write(Buffer.from(f.bytes));await tick();assert.equal(n.consumed.length,0);input.end();await tick();assert.equal(input.readableEnded,true);assert.equal(input.closed,false);assert.equal(n.consumed.length,0);input.completeClose();const result=await pending;
 assert.deepEqual(result.bootstrap.commandSecret,f.b.commandSecret);assert.equal(result.bootstrap.historyPipe,f.b.historyPipe);assert.equal(result.witness,n.witness);assert.equal(Object.keys(result).join(','),'bootstrap');assert.equal(JSON.stringify(result).includes('Secret'),false);assert.ok(n.consumed.every(zero)&&n.payloads.every(zero));assert.equal(result.dispose(),true);assert.equal(result.dispose(),true);assert.equal(n.closed.length,1);assert.ok(zero(result.bootstrap.commandSecret));f.b.dispose();
});
test('reader uses Readable listener hooks to keep an asynchronously filled input nonflowing',async()=>{
 const f=packet(),n=native(),input=new PassThrough(),pending=read(input,{native:n.object});assert.equal(input._readableState.readableListening,true);assert.notEqual(input.readableFlowing,true);await tick();input.end(Buffer.from(f.bytes));const result=await pending;assert.equal(input.closed,true);assert.equal(n.consumed.length,1);result.dispose();f.b.dispose();
});
test('captured native cleanup requires strict true and wipes all three keys on abort',async()=>{
 const f=packet(),n=native(),input=new PassThrough();n.object.closePeerWitness=function(value){assert.equal(this,n.object);assert.equal(value,n.witness);n.closed.push(value);return false;};
 const pending=read(input,{native:n.object});n.object.closePeerWitness=()=>assert.fail('mutated callback');input.end(Buffer.from(f.bytes));const result=await pending;assert.equal(result.dispose(),false);assert.equal(result.dispose(),false);assert.equal(n.closed.length,1);
 for(const key of['controlSecret','historySecret','commandSecret'])assert.ok(zero(result.bootstrap[key]));f.b.dispose();
});
test('oversize, truncation and old outer/inner versions cannot publish a three-lane witness',async()=>{
 const f=packet();for(const mode of['oversize','truncated','outer','inner']){const n=native(),input=new PassThrough(),pending=read(input,{native:n.object});let bytes=mode==='oversize'?Buffer.alloc(8192,7):Buffer.from(f.bytes);if(mode==='truncated')bytes=bytes.subarray(0,-1);if(mode==='outer')bytes.write('SIRENTP2');if(mode==='inner')bytes.write('SIRENTB1',16);input.end(bytes);await assert.rejects(pending,/THREE_LANE_BOOTSTRAP_REFUSED/);assert.equal(n.closed.length,n.payloads.length);assert.ok(n.payloads.every(zero));if(mode==='oversize'){assert.equal(n.consumed.length,0);assert.ok(zero(bytes.subarray(0,2065)));assert.equal(bytes[2065],7);}}
 f.b.dispose();
});
test('missing EOF and delayed close expire without late native consumption',async()=>{
 const f=packet();for(const eof of[false,true]){const n=native(),input=new DelayedClose(),pending=read(input,{native:n.object,timeoutMs:10});input.write(Buffer.from(f.bytes));if(eof)input.end();await assert.rejects(pending,/THREE_LANE_BOOTSTRAP_TIMEOUT/);input.emit('error',Error('private late'));input.completeClose();await tick();assert.equal(n.consumed.length,0);assert.equal(input.listenerCount('error'),0);}f.b.dispose();
});
test('elapsed deadline before timer dispatch cannot consume or publish',async()=>{
 const f=packet(),n=native(),input=new PassThrough(),pending=read(input,{native:n.object,timeoutMs:5});const until=performance.now()+8;while(performance.now()<until){}input.end(Buffer.from(f.bytes));await assert.rejects(pending,/THREE_LANE_BOOTSTRAP_TIMEOUT/);assert.equal(n.consumed.length,0);f.b.dispose();
});
test('decode failure after native consume wipes every secret and closes the owned witness',async()=>{
 const f=packet(),n=native(value=>{value.payload[value.payload.length-1]=0;value.payload.fill(0,value.payload.length-32);return value;}),input=new PassThrough(),pending=read(input,{native:n.object});input.end(Buffer.from(f.bytes));await assert.rejects(pending,/THREE_LANE_BOOTSTRAP_REFUSED/);assert.equal(n.closed.length,1);assert.ok(n.payloads.every(zero));f.b.dispose();
});
test('native consume reentrancy error cannot publish and still salvages returned DATA ownership',async()=>{
 const f=packet(),input=new PassThrough(),n=native(value=>{input.emit('error',Error('PRIVATE_REENTRANT'));return value;}),pending=read(input,{native:n.object});input.end(Buffer.from(f.bytes));await assert.rejects(pending,/THREE_LANE_BOOTSTRAP_STREAM_REFUSED/);assert.equal(n.closed.length,1);assert.ok(n.payloads.every(zero));f.b.dispose();
});
test('options/native/result Proxies and getters refuse without traps or secret errors',async()=>{
 let touched=0;const trap={get(){touched++;throw Error('private');},getPrototypeOf(){touched++;throw Error('private');},ownKeys(){touched++;throw Error('private');}};
 const f=packet();for(const mode of['options','native','callback','result','payload']){const n=native(value=>mode==='result'?new Proxy(value,trap):mode==='payload'?{...value,payload:Object.setPrototypeOf(value.payload,new Proxy(Buffer.prototype,trap))}:value),input=new PassThrough();let options={native:n.object};if(mode==='options')options=new Proxy(options,trap);if(mode==='native')options.native=new Proxy(n.object,trap);if(mode==='callback')Object.defineProperty(n.object,'consumePeerBootstrap',{get(){touched++;return()=>{};}});const pending=read(input,options);if(!input.destroyed)input.end(Buffer.from(f.bytes));await assert.rejects(pending,/THREE_LANE_BOOTSTRAP_(?:STREAM_)?REFUSED/);}
 assert.equal(touched,0);f.b.dispose();
});
test('decorated native payload reads native bytes without invoking caller properties',async()=>{
 let touched=0;const f=packet(),n=native(value=>{for(const key of['length','copy','buffer','fill','subarray'])Object.defineProperty(value.payload,key,{get(){touched++;throw Error('private');}});return value;}),input=new PassThrough(),pending=read(input,{native:n.object});input.end(Buffer.from(f.bytes));const result=await pending;assert.equal(result.bootstrap.sessionId,'session1');assert.ok(n.payloads.every(zero));assert.equal(touched,0);result.dispose();f.b.dispose();
});
test('encoded/object/flowing or Proxy prototype inputs refuse before native callbacks',async()=>{
 let touched=0;for(const mode of['encoded','object','flowing','proxy']){const n=native();let input=mode==='object'?new Readable({objectMode:true,read(){}}):new PassThrough();if(mode==='encoded')input.setEncoding('utf8');if(mode==='flowing')input.resume();if(mode==='proxy')input=new Proxy(input,{getPrototypeOf(){touched++;throw Error('private');}});await assert.rejects(read(input,{native:n.object}),/THREE_LANE_BOOTSTRAP_STREAM_REFUSED/);assert.equal(n.consumed.length,0);}assert.equal(touched,0);
});
