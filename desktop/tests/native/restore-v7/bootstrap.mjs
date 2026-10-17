import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
let go;
try{go=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('HELD_JOB_GO_TIMEOUT')),15000);lines.once('line',text=>{clearTimeout(timer);try{resolve(JSON.parse(text));}catch(error){reject(error);}});});}finally{lines.close();}
assert.equal(go.pid,process.pid);assert.equal(go.assignment.assignedActualHeldHandlePID,process.pid);assert.equal(go.assignment.limitKillOnJobClose,true);
const args=go.producerArguments;
assert.ok(Array.isArray(args)&&(args.length===0||(args.length===2&&args[0]==='--package'&&typeof args[1]==='string'&&/^[A-Za-z]:[\\/]/.test(args[1])&&!/[\x00-\x1f]/.test(args[1]))),'EXPLICIT_PRODUCER_ARGUMENTS_REQUIRED');
process.argv=[process.execPath,fileURLToPath(new URL('./app/tests/native/source-sync.mjs',import.meta.url)),...args];
await import('./app/tests/native/source-sync.mjs');
