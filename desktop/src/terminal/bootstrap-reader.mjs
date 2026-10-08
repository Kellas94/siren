// Bounded byte-stream reader. No implicit stdin access, native load or admission.
import {performance} from 'node:perf_hooks';
import {Readable} from 'node:stream';
import {decodeTerminalBootstrap} from './bootstrap-codec.mjs';
const LIMIT=2048;
export function readTerminalBootstrap(input,{timeoutMs=1000}={}){
 return new Promise((resolve,reject)=>{
  const refuse=()=>Error('TERMINAL_BOOTSTRAP_STREAM_REFUSED');
  if(!(input instanceof Readable)||input.destroyed||input.readableEnded||input.readableObjectMode||input.readableEncoding!==null||input.readableFlowing===true||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>5000){
   if(input instanceof Readable&&!input.destroyed)input.destroy();reject(refuse());return;
  }
  // Do not concatenate attacker-sized chunks. Pull at most LIMIT+1 bytes in
  // total; +1 detects oversize. Node's own stream buffer is not a history ring.
  const bytes=Buffer.alloc(LIMIT+1),deadline=performance.now()+timeoutMs;let count=0,done=false,closing=false,candidate=null,timer;
  function stopReading(){input.removeListener('readable',drain);input.removeListener('end',end);}
  function detach(){stopReading();input.removeListener('error',errorEvent);input.removeListener('close',close);}
  function finish(error){
   if(done)return;done=true;clearTimeout(timer);stopReading();bytes.fill(0);
   const result=candidate;candidate=null;
   if(error){result?.dispose();reject(error);}else resolve(result);
   // destroyed means teardown was requested, not that it completed. Keep the
   // error observer through close, including after a deadline rejection.
   input.destroy();if(input.closed)detach();
  }
  const expired=()=>performance.now()>=deadline;
  function drain(){
   if(done||closing)return;if(expired()){finish(Error('TERMINAL_BOOTSTRAP_TIMEOUT'));return;}
   try{
    while(!done){
     const size=Math.min(input.readableLength,LIMIT+1-count);if(size===0){input.read(0);return;}
     const chunk=input.read(size);if(chunk===null)return;
     if(!Buffer.isBuffer(chunk)||chunk.length!==size){finish(refuse());return;}
     chunk.copy(bytes,count);count+=chunk.length;chunk.fill(0);
     if(count>LIMIT){finish(Error('TERMINAL_BOOTSTRAP_REFUSED'));return;}
     if(expired()){finish(Error('TERMINAL_BOOTSTRAP_TIMEOUT'));return;}
    }
   }catch{finish(refuse());}
  }
  function end(){
   if(done)return;drain();if(done)return;
   if(expired()){finish(Error('TERMINAL_BOOTSTRAP_TIMEOUT'));return;}
   try{
    candidate=decodeTerminalBootstrap(bytes.subarray(0,count));closing=true;stopReading();bytes.fill(0);
    // Secret metadata is published only after successful close within budget.
    input.destroy();if(input.closed)close();
   }catch{finish(Error('TERMINAL_BOOTSTRAP_REFUSED'));}
  }
  function errorEvent(){if(!done)finish(refuse());}
  function close(){
   if(!done){
    if(expired())finish(Error('TERMINAL_BOOTSTRAP_TIMEOUT'));
    else if(!closing||!candidate||!input.closed)finish(refuse());
    else finish(null);
   }
   detach();
  }
  input.pause();input.on('readable',drain);input.once('end',end);input.once('error',errorEvent);input.once('close',close);
  timer=setTimeout(()=>finish(Error('TERMINAL_BOOTSTRAP_TIMEOUT')),timeoutMs);
  // EOF for an empty stream requires a read(0); readableLength alone does not
  // trigger it. No data callback, flowing mode, string decoder or retry queue.
  input.read(0);drain();
 });
}
