// Local Windows/Node qualification only. Never imported by product code.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {validateHostAsyncReceipt} from '../../src/terminal/host-async-receipt-contract.mjs';
import {createCapturedHostAsyncOperation} from '../../src/terminal/host-async-captured-operation.mjs';
import {validateLocalSessionCapture} from './terminal-local-fixture-contract.mjs';
const dir=process.cwd(),config=JSON.parse(readFileSync(join(dir,'config.json'),'utf8'));
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const write=(name,data)=>{const p=join(dir,name);writeFileSync(p+'.tmp',JSON.stringify(data),{flag:'wx'});renameSync(p+'.tmp',p);};
const wait=async name=>{for(let i=0;i<1600;i++){if(existsSync(join(dir,name)))return JSON.parse(readFileSync(join(dir,name),'utf8'));await delay(5);}throw Error('PROTOCOL_DEADLINE:'+name);};
let watchdog=setTimeout(()=>process.exit(124),25000),timer;
try {
 assert(['zero','eight','listeners','accepts','captured','gc','session-async','host-loss','negative-no-stop','negative-js-hang'].includes(config.mode));
 assert.equal(hash(process.execPath),config.nodeHash);assert.equal(hash(config.addon),config.addonHash);
 for(const row of config.inputs)assert.equal(hash(row.path),row.sha256,'INPUT_CHANGED:'+row.path);
 const native=createRequire(import.meta.url)(config.addon);
 const mark=native.mark();
 const root=spawn(process.execPath,[config.payload,'host',dir],{cwd:dir,stdio:'ignore',windowsHide:true});
 const canary=spawn(process.execPath,[config.payload,'canary',dir],{cwd:dir,stdio:'ignore',windowsHide:true});
 await wait('host-ready.json');await wait('canary-ready.json');
 let host=native.start(root.pid,process.execPath,mark);
 const sessions=[],sessionCaptures=[],pairs=[],pending=[];
 const count=config.mode==='zero'?0:8;
 for(let i=0;i<count;i++){
  const session=native.createSession(host,process.execPath,config.creator,dir);sessions.push(session);
  const snap=native.snapshotSession(session),ready=await wait('creator-'+snap.root.pid+'.json');
  assert.equal(ready.creatorPid,snap.root.pid);
  native.watchRoot(session,ready.shellPid,process.execPath,mark);
  const captured=native.captureSession(session),consoleHost=join(process.env.SystemRoot,'System32','conhost.exe');
  assert.equal(validateLocalSessionCapture({captured,ready,node:process.execPath,conhost:consoleHost}).ok,true,'SESSION_FIXTURE_MEMBERS_REFUSED');
  sessionCaptures.push({ready,captured});
 }
 const usePeers=['listeners','accepts','captured','gc','session-async'].includes(config.mode);
 if(usePeers)for(let i=0;i<8;i++){
  const names=['control','data','command'].map(lane=>'\\\\.\\pipe\\siren-terminal-'+lane+'-'+randomBytes(16).toString('hex'));
  const pair=native.createPeerListeners(host,...names);pairs.push(pair);
  if(config.mode!=='listeners')for(let lane=0;lane<3;lane++)pending.push(native.acceptPeerLane(pair,['control','history','command'][lane],10000).then(()=>({accepted:true}),e=>({accepted:false,error:e.code??e.message})));
 }
 const before=native.capture(host);assert(before.active>=1+count*2&&before.active<=2+count*4);assert.equal(before.held.length,before.active);
 write('before.json',{mainPid:process.pid,canaryPid:canary.pid,mode:config.mode,before,sessionCount:count,peerCount:pairs.length,sessionCaptures});
 await wait('go.json');
 if(config.mode==='negative-js-hang')Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);
 if(config.mode==='negative-no-stop'){
  write('after.json',{status:'DELIBERATELY_FALSE_SUCCESS_NEGATIVE_CONTROL'});
  await wait('release.json');throw Error('NEGATIVE_CONTROL_MUST_NOT_BE_RELEASED');
 }
 if(config.mode==='host-loss'){root.kill();await new Promise(res=>root.once('exit',res));}
 const start=performance.now();let ticks=0,maxGap=0,last=start;
 timer=setInterval(()=>{const now=performance.now();ticks++;maxGap=Math.max(maxGap,now-last);last=now;},5);
 const id='native_'+config.mode,deadlineMs=5000;
 let operation,original,sessionCleanup=[];
 if(config.mode==='session-async')sessionCleanup=sessions.map(s=>native.stopAndCloseSessionAsync(s,98,5000));
 if(config.mode==='captured'){
  operation=createCapturedHostAsyncOperation({native,host});original=operation.start({code:77,deadlineMs,shutdownId:id});
  assert.equal(operation.start({code:77,deadlineMs,shutdownId:id}),original);
 }else original=native.stopAndCloseHostAsync(host,77,deadlineMs,id);
 assert(original instanceof Promise);
 // GC awaits below must not turn an early native rejection into an unhandled
 // process exit. Awaiting the same original later still reports its failure.
 original.catch(()=>{});
 assert.equal(native.stopAndCloseHostAsync(host,77,deadlineMs,id),original);
 assert.throws(()=>native.stopAndCloseHostAsync(host,98,deadlineMs,id));
 const roster=native.captureHostShutdownPeerRoster(host,id);assert(Object.isFrozen(roster));assert(Object.isFrozen(roster.pairOrdinals));
 assert.equal(roster.pairOrdinals.length,pairs.length);assert.equal(new Set(roster.pairOrdinals).size,pairs.length);
 assert.throws(()=>native.createSession(host,process.execPath,config.creator,dir));
 if(config.mode==='gc'){
  const {setFlagsFromString}=await import('node:v8');const {runInNewContext}=await import('node:vm');
  setFlagsFromString('--expose-gc');const gc=runInNewContext('gc');for(let i=0;i<8;i++){gc();await delay(1);}
 }
 const receipt=await original,expected=native.captureHostShutdownExpectation(host,id);
 assert.equal(native.captureHostShutdownExpectation(host,id),expected);assert(Object.isFrozen(expected));
 const checked=validateHostAsyncReceipt(expected,receipt);assert.equal(checked.ok,true);
 assert.deepEqual([...expected.pairOrdinals],[...roster.pairOrdinals]);
 assert.equal(native.stopAndCloseHostAsync(host,77,deadlineMs,id),original);
 assert.throws(()=>native.captureHostShutdownExpectation(host,'wrong_id'));
 const peers=await Promise.all(pending);assert(peers.every(p=>p.accepted===false));
 const sessionResults=await Promise.all(sessionCleanup);assert(sessionResults.every(r=>r.closed===true));
 let settlement=null;if(operation){settlement=await operation.captureSettlement().actualSettled;assert.equal(settlement.nativeReceiptMatched,true);}
 // Host receipt explicitly does not join Session JS cleanup. Do that separately.
 if(config.mode!=='session-async')for(const s of sessions)assert.equal(native.closeSession(s),true);
 clearInterval(timer);timer=null;
 write('after.json',{status:'NATIVE_OPERATION_COMPLETED',mode:config.mode,receipt,expected,checked,roster,settlement,pendingAccepts:peers,sessionResults,elapsedMs:performance.now()-start,heartbeat:{ticks,maxGap},nativeExecutionAdmitted:false,scope:'LOCAL_WINDOWS_NODE_ROSTER_QUALIFICATION'});
 await wait('release.json');
 writeFileSync(join(dir,'canary-release.txt'),'release',{flag:'wx'});
 await new Promise((res,rej)=>{if(canary.exitCode!==null)return res();canary.once('exit',res);canary.once('error',rej);});
 clearTimeout(watchdog);watchdog=null;
}catch(error){
 if(timer)clearInterval(timer);
 try{write('worker-error.json',{message:error.message,stack:error.stack});}catch{}
 console.error(error);process.exitCode=1;
}finally{if(watchdog)clearTimeout(watchdog);}
