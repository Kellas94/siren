// Actual Node IPC only; no Electron, native addon, compiler, child or PTY.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {TerminalHistoryChannel,TerminalHistoryReader,createHistoryResponder} from '../src/terminal/history-channel.mjs';
import {TerminalCreatorHistory,TerminalRemoteOutput} from '../src/terminal/remote-output.mjs';
async function pair(t,sessionId,{wrongKey=false}={}){
 const channelId='history_'+randomUUID(),secret=randomBytes(32),name=process.platform==='win32'?'\\\\.\\pipe\\siren-history-test-'+randomUUID():join(tmpdir(),'siren-history-'+randomUUID()+'.sock');
 const server=net.createServer();server.maxConnections=1;let client,socket,main,creator;
 t.after(async()=>{main?.dispose();creator?.dispose();client?.destroy();socket?.destroy();secret.fill(0);if(server.listening)await new Promise(resolve=>server.close(resolve));});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(name,resolve);});const accepted=once(server,'connection');client=net.createConnection(name);await once(client,'connect');[socket]=await accepted;
 creator=new TerminalHistoryChannel({stream:client,role:'creator',sessionId,channelId,secret:wrongKey?randomBytes(32):secret,deadlineMs:2000});
 main=new TerminalHistoryChannel({stream:socket,role:'main',sessionId,channelId,secret,deadlineMs:2000});secret.fill(0);
 return {main,creator,client};
}
test('actual Windows/local pipe delivers Unicode and32KiB control text through creator-only history',async t=>{
 const p=await pair(t,'s1'),history=new TerminalCreatorHistory('s1');history.append('AΩ😀');history.append('\x00'.repeat(32760));createHistoryResponder({channel:p.creator,history});const reader=new TerminalHistoryReader({channel:p.main,sessionId:'s1',deadlineMs:2000});assert.equal(await p.main.ready,true);assert.equal(await p.creator.ready,true);
 const output=new TerminalRemoteOutput();output.register('s1',q=>reader.read(q));output.resumeViews();const token=output.attach('s1',{leaseId:'l1',generation:1,fromSequence:0}).value;const r=await output.take(token);assert.equal(r.value.chunk.utf8Bytes,32767);assert.ok(r.value.chunk.data.startsWith('AΩ😀'));assert.equal(output.stats().retainedUtf8Bytes,0);assert.equal(output.ack(token,32767).ok,true);
 t.diagnostic(JSON.stringify({transport:process.platform==='win32'?'Windows named pipe':'Unix local socket',node:process.version,bytes:32767,pty:false,nativeAddon:false}));
});
test('eight actual history pipes share credits and retain output through Lock without delivering stale data',async t=>{
 const output=new TerminalRemoteOutput();output.resumeViews();const entries=[];
 for(let n=1;n<=8;n++){const sessionId='s'+n,p=await pair(t,sessionId),history=new TerminalCreatorHistory(sessionId);history.append('before'+n);createHistoryResponder({channel:p.creator,history});const reader=new TerminalHistoryReader({channel:p.main,sessionId,deadlineMs:2000});assert.equal(await p.main.ready,true);assert.equal(await p.creator.ready,true);output.register(sessionId,q=>reader.read(q));entries.push({history,p,sessionId,token:output.attach(sessionId,{leaseId:'l'+n,generation:n,fromSequence:0}).value});}
 for(const {token}of entries)assert.equal((await output.take(token)).ok,true);assert.equal(output.stats().outstandingUtf8Bytes,56);output.suspendViews();assert.equal(output.stats().outstandingUtf8Bytes,0);
 for(const e of entries){e.history.append('duringLock');assert.equal((await output.take(e.token)).code,'LEASE_STALE');assert.equal(e.p.creator.isAvailable(),true);}
 output.resumeViews();for(let n=0;n<entries.length;n++){const e=entries[n],token=output.attach(e.sessionId,{leaseId:'fresh'+n,generation:9+n,fromSequence:0}).value;const r=await output.take(token);assert.equal(r.value.chunk.data,'before'+(n+1)+'duringLock');output.ack(token,r.value.chunk.utf8Bytes);}
 assert.equal(output.stats().retainedUtf8Bytes,0);assert.equal(output.stats().pendingRequests,0);
});
test('actual pipe wrong secret rejects readiness and EOF rejects a pending history read',async t=>{
 const bad=await pair(t,'s1',{wrongKey:true});assert.equal(await bad.main.ready,false);assert.equal(await bad.creator.ready,false);
 const p=await pair(t,'s2');await p.main.ready;await p.creator.ready;let sawRead;const arrived=new Promise(resolve=>sawRead=resolve);p.creator.subscribe({message:()=>sawRead(),closed:()=>{}});const reader=new TerminalHistoryReader({channel:p.main,sessionId:'s2',deadlineMs:2000});const pending=reader.read({sessionId:'s2',fromSequence:0,maxBytes:32768});const rejection=assert.rejects(pending);await arrived;p.client.destroy();await rejection;assert.equal(p.main.isAvailable(),false);
});
