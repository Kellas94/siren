// In-memory byte streams only; no stdin, child, native addon or shell execution.
import test from 'node:test';import assert from 'node:assert/strict';import {PassThrough,Readable} from 'node:stream';
import {createTerminalBootstrap} from '../src/terminal/bootstrap-codec.mjs';
const api=await import('../src/terminal/bootstrap-reader.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const packet=()=>createTerminalBootstrap({sessionId:'session-1',channelId:'channel-1'});
test('bootstrap reader accepts fragmented bytes only after EOF and closes the input',async()=>{
 assert.equal(typeof api.readTerminalBootstrap,'function');const p=packet(),input=new PassThrough(),pending=api.readTerminalBootstrap(input,{timeoutMs:1000});let settled=false;pending.then(()=>{settled=true;},()=>{});
 input.write(Buffer.from(p.payload.subarray(0,9)));input.write(Buffer.from(p.payload.subarray(9)));await new Promise(r=>setImmediate(r));assert.equal(settled,false);
 input.end();const result=await pending;assert.equal(result.sessionId,p.sessionId);assert.deepEqual(result.controlSecret,p.controlSecret);assert.equal(input.destroyed,true);result.dispose();p.dispose();
});
test('bootstrap reader refuses incomplete, oversized and appended input and closes it',async()=>{
 assert.equal(typeof api.readTerminalBootstrap,'function');const p=packet();
 for(const bytes of [Buffer.from(p.payload.subarray(0,30)),Buffer.concat([p.payload,Buffer.from([1])]),Buffer.alloc(2049,9)]){const input=new PassThrough();const pending=api.readTerminalBootstrap(input);input.end(bytes);await assert.rejects(pending,/TERMINAL_BOOTSTRAP/);assert.equal(input.destroyed,true);assert.equal(bytes.every(b=>b===0),true);}
 p.dispose();
});
test('bootstrap reader deadline revokes an open partial input without retry',async()=>{
 assert.equal(typeof api.readTerminalBootstrap,'function');const input=new PassThrough();const pending=api.readTerminalBootstrap(input,{timeoutMs:15});input.write(Buffer.from('SIREN'));
 await assert.rejects(pending,/TERMINAL_BOOTSTRAP_TIMEOUT/);assert.equal(input.destroyed,true);assert.equal(input.listenerCount('readable'),0);assert.equal(input.listenerCount('end'),0);
});
test('bootstrap reader refuses strings, object mode, and already-consumed streams',async()=>{
 assert.equal(typeof api.readTerminalBootstrap,'function');const inputs=[new PassThrough({encoding:'utf8'}),Readable.from([{}]),new PassThrough()];inputs[2].resume();
 for(const input of inputs){await assert.rejects(api.readTerminalBootstrap(input),/TERMINAL_BOOTSTRAP_STREAM_REFUSED/);assert.equal(input.destroyed,true);}
});
test('bootstrap stream errors and early close never publish secret metadata',async()=>{
 assert.equal(typeof api.readTerminalBootstrap,'function');for(const mode of ['error','close']){const input=new PassThrough(),pending=api.readTerminalBootstrap(input);if(mode==='error')input.destroy(Error('PRIVATE_CONTENT_MUST_NOT_ESCAPE'));else input.destroy();await assert.rejects(pending,e=>e.message==='TERMINAL_BOOTSTRAP_STREAM_REFUSED');}
});
test('elapsed deadline rejects success before the timeout callback gets a turn',async()=>{
 assert.equal(typeof api.readTerminalBootstrap,'function');const p=packet(),input=new PassThrough(),pending=api.readTerminalBootstrap(input,{timeoutMs:5});
 const until=performance.now()+20;while(performance.now()<until){}input.end(Buffer.from(p.payload));
 await assert.rejects(pending,/TERMINAL_BOOTSTRAP_TIMEOUT/);assert.equal(input.destroyed,true);p.dispose();
});
test('empty EOF refuses promptly and every byte may arrive separately',async()=>{
 assert.equal(typeof api.readTerminalBootstrap,'function');const empty=new PassThrough(),bad=api.readTerminalBootstrap(empty);empty.end();await assert.rejects(bad,/TERMINAL_BOOTSTRAP_REFUSED/);
 const p=packet(),input=new PassThrough(),good=api.readTerminalBootstrap(input);for(const byte of p.payload)input.write(Buffer.from([byte]));input.end();const result=await good;assert.deepEqual(result.dataSecret,p.dataSecret);result.dispose();p.dispose();
});
