// Test-worker seam only. No PTY/process imports, execution authority, manager,
// renderer bridge or native admission. Fixed CI worker owns the callbacks.
// Input receipt dedup/caller/lease authority remain separate unqualified gates.
import {HostInputGate} from '../../src/terminal/input-gate.mjs';
import {createOutputRing} from '../../src/terminal/output.mjs';
import {TERMINAL_LIMITS as limits} from '../../src/terminal/contracts.mjs';
import {createHash} from 'node:crypto';
const int=n=>Number.isSafeInteger(n)&&n>=0;
const refuse=code=>Object.freeze({ok:false,code});
export function createShellFlowCore({write,resize}={}){
 if(typeof write!=='function'||typeof resize!=='function')throw TypeError('Fixed write and resize seams required');
 const gate=new HostInputGate(),ring=createOutputRing();
 const attempted=createHash('sha256'),accepted=createHash('sha256');
 let unavailable=false,inputWrites=0,inputWriteAttempts=0,inputUtf8Bytes=0,resizeCalls=0,receivedUtf8Bytes=0,generation=0,open=false;
 const allowed=g=>!unavailable&&gate.allows(g);
 return Object.freeze({
  nativeExecutionAdmitted:false,
  applyGate(packet){if(unavailable)return refuse('HOST_UNAVAILABLE');const r=gate.apply(packet);if(r.ok){generation=r.generation;open=r.open;}return r;},
  submit(g,data){
   if(!allowed(g))return refuse(unavailable?'HOST_UNAVAILABLE':'LEASE_STALE');
   if(typeof data!=='string'||!data.length||!data.isWellFormed()||Buffer.byteLength(data)>limits.inputBytes)return refuse('REQUEST_REFUSED');
   inputWriteAttempts++;attempted.update(data);
   try{write(data);accepted.update(data);inputWrites++;inputUtf8Bytes+=Buffer.byteLength(data);return Object.freeze({ok:true,accepted:true});}
   catch{unavailable=true;return refuse('HOST_UNAVAILABLE');}
  },
  fit(g,cols,rows){
   if(!allowed(g))return refuse(unavailable?'HOST_UNAVAILABLE':'LEASE_STALE');
   if(!int(cols)||cols<2||cols>500||!int(rows)||rows<1||rows>200)return refuse('REQUEST_REFUSED');
   try{resize(cols,rows);resizeCalls++;return Object.freeze({ok:true});}catch{unavailable=true;return refuse('HOST_UNAVAILABLE');}
  },
  append(data){const r=ring.append(data);receivedUtf8Bytes=r.nextSequence;return r;},
  read(request){return ring.read(request);},
  stats(){return Object.freeze({...ring.stats(),receivedUtf8Bytes,inputWrites,inputWriteAttempts,inputUtf8Bytes,inputAttemptSha256:attempted.copy().digest('hex'),inputWriteSha256:accepted.copy().digest('hex'),resizeCalls,generation,open:!unavailable&&open,unavailable});},
 });
}
