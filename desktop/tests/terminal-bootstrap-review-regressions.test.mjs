// Owner reproductions of independent P2 findings. In-memory/source only.
import test from 'node:test';import assert from 'node:assert/strict';import {Readable} from 'node:stream';import {setTimeout as delay} from 'node:timers/promises';import {readFile} from 'node:fs/promises';
import {createTerminalBootstrap} from '../src/terminal/bootstrap-codec.mjs';import {readTerminalBootstrap} from '../src/terminal/bootstrap-reader.mjs';
class ClosingStream extends Readable {
 constructor(payload,ms,error){super();this.payload=Buffer.from(payload);this.ms=ms;this.failure=error;this.sent=false;}
 _read(){if(!this.sent){this.sent=true;this.push(this.payload);this.push(null);}}
 _destroy(error,callback){setTimeout(()=>callback(this.failure??error),this.ms);}
}
test('independent reader P2: destroy failure rejects instead of publishing startup success',async()=>{
 const p=createTerminalBootstrap({sessionId:'review-1',channelId:'review-1'}),input=new ClosingStream(p.payload,15,Error('PRIVATE_DESTROY_DETAIL'));let errors=0;
 input.on('error',()=>{errors++;});
 try{await assert.rejects(readTerminalBootstrap(input,{timeoutMs:100}),e=>e.message==='TERMINAL_BOOTSTRAP_STREAM_REFUSED');}finally{await delay(25);p.dispose();}
 assert.equal(errors,1);assert.equal(input.closed,true);
});
test('independent reader P2: stream closure belongs to the startup deadline',async()=>{
 const p=createTerminalBootstrap({sessionId:'review-2',channelId:'review-2'}),input=new ClosingStream(p.payload,90,null);input.on('error',()=>{});
 try{await assert.rejects(readTerminalBootstrap(input,{timeoutMs:20}),/TERMINAL_BOOTSTRAP_TIMEOUT/);}finally{await delay(100);p.dispose();}
 assert.equal(input.closed,true);
});
test('independent native P2: final deadline check follows disposal before resolving success',async()=>{
 // This proves source control-flow only, never actual native latency.
 const source=await readFile(new URL('../native/terminal-creator-async/ownership.cc',import.meta.url),'utf8');
 const callback=source.slice(source.indexOf('void AsyncStopComplete('),source.indexOf('napi_value StopAndCloseSessionAsync('));
 const dispose=callback.indexOf('DisposeSession()'),resolve=callback.indexOf('napi_resolve_deferred');
 const late=callback.indexOf('if(!work->error&&GetTickCount64()>=work->deadline)',dispose);
 assert.ok(dispose>=0&&late>dispose&&late<resolve,'Disposed after the last deadline check: late success remains possible');
});
test('deadline rejection retains teardown error handling until delayed close',async()=>{
 const p=createTerminalBootstrap({sessionId:'review-3',channelId:'review-3'}),input=new ClosingStream(p.payload,70,Error('LATE_PRIVATE_ERROR'));
 // No independent error listener: an escaped teardown error fails the test.
 await assert.rejects(readTerminalBootstrap(input,{timeoutMs:10}),/TERMINAL_BOOTSTRAP_TIMEOUT/);
 assert.ok(input.listenerCount('error')>0);await delay(90);assert.equal(input.closed,true);assert.equal(input.listenerCount('error'),0);assert.equal(input.listenerCount('close'),0);p.dispose();
});
test('successful delayed close is observed before secret metadata becomes available',async()=>{
 const p=createTerminalBootstrap({sessionId:'review-4',channelId:'review-4'}),input=new ClosingStream(p.payload,15,null);
 const result=await readTerminalBootstrap(input,{timeoutMs:500});assert.equal(input.closed,true);assert.deepEqual(result.controlSecret,p.controlSecret);assert.equal(input.listenerCount('error'),0);result.dispose();p.dispose();
});
