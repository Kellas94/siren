// Actual local Node IPC only. No Electron, native addon, process, PTY or shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {once} from 'node:events';
import {randomBytes,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {TerminalControlChannel} from '../src/terminal/control-channel.mjs';
import {TerminalAggregateGateLink} from '../src/terminal/aggregate-gate.mjs';
import {TerminalGateLink,createGateResponder} from '../src/terminal/gate-link.mjs';
import {TerminalInputFence,HostInputGate} from '../src/terminal/input-gate.mjs';
import {TerminalSessionLedger} from '../src/terminal/session-state.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
async function pair(t,{wrongSecret=false}={}){
 const channelId='pipe_'+randomUUID(),secret=randomBytes(32),name=process.platform==='win32'?'\\\\.\\pipe\\siren-control-test-'+randomUUID():join(tmpdir(),'siren-control-'+randomUUID()+'.sock');
 const server=net.createServer();server.maxConnections=1;let client,socket,creator,main;
 t.after(async()=>{main?.dispose();creator?.dispose();client?.destroy();socket?.destroy();secret.fill(0);if(server.listening)await new Promise(resolve=>server.close(resolve));});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(name,resolve);});
 const accepted=once(server,'connection');client=net.createConnection(name);await once(client,'connect');[socket]=await accepted;
 creator=new TerminalControlChannel({stream:client,role:'creator',channelId,secret:wrongSecret?randomBytes(32):secret,deadlineMs:2000});
 main=new TerminalControlChannel({stream:socket,role:'main',channelId,secret,deadlineMs:2000});secret.fill(0);
 return {channelId,main,creator,client,socket,server};
}
test('actual local named pipe performs mutual authentication and an acknowledged Lock',async t=>{
 const p=await pair(t);assert.equal(await p.main.ready,true);assert.equal(await p.creator.ready,true);const gate=new HostInputGate();
 p.creator.subscribe({message:createGateResponder({channelId:p.channelId,gate,send:r=>p.creator.send(r)}),closed:()=>{}});
 const link=new TerminalGateLink({channelId:p.channelId,send:r=>{if(!p.main.send(r))throw Error('CONTROL_REFUSED');},subscribe:r=>p.main.subscribe(r)});
 assert.equal((await link.sendGate({generation:1,open:true})).ok,true);assert.equal(gate.allows(1),true);
 assert.equal((await link.sendGate({generation:2,open:false})).ok,true);assert.equal(gate.allows(1),false);
 assert.equal(p.main.nativeExecutionAdmitted,false);t.diagnostic(JSON.stringify({transport:process.platform==='win32'?'Windows named pipe':'Unix local socket',node:process.version,pty:false,nativeAddon:false}));
});
test('actual pipe rejects a wrong bootstrap secret with no gate delivery',async t=>{
 const p=await pair(t,{wrongSecret:true});let messages=0;p.creator.subscribe({message:()=>messages++,closed:()=>{}});assert.equal(await p.main.ready,false);assert.equal(await p.creator.ready,false);assert.equal(messages,0);
});
test('eight actual pipe links form one fence and wait the delayed eighth ACK',async t=>{
 const entries=new Map(),aggregate=new TerminalAggregateGateLink({resolveLink:(_,channelId)=>({link:entries.get(channelId),initiallyClosed:true}),deadlineMs:2000});
 const ledger=new TerminalSessionLedger({writeInput:async()=>({accepted:true})}),fence=new TerminalInputFence({ledger,gateLink:aggregate,deadlineMs:2000});
 assert.equal((await fence.resumeInput()).ok,true);const gates=[];let lastReply,releaseLast;const delayed=new Promise(resolve=>releaseLast=resolve);let hold=false;
 for(let i=0;i<8;i++){
  const p=await pair(t);assert.equal(await p.main.ready,true);assert.equal(await p.creator.ready,true);const gate=new HostInputGate();gates.push(gate);
  p.creator.subscribe({message:createGateResponder({channelId:p.channelId,gate,send:r=>{if(i===7&&hold){lastReply=()=>p.creator.send(r);releaseLast();}else p.creator.send(r);}}),closed:()=>{}});
  entries.set(p.channelId,new TerminalGateLink({channelId:p.channelId,send:r=>{if(!p.main.send(r))throw Error('CONTROL_REFUSED');},subscribe:r=>p.main.subscribe(r)}));
  assert.equal(aggregate.reserve('s'+i).ok,true);assert.equal((await aggregate.bind('s'+i,p.channelId)).ok,true);
 }
 const generation=fence.snapshot().generation;assert.ok(gates.every(g=>g.allows(generation)));hold=true;let settled=false;
 const closing=fence.closeInput('lock').then(r=>{settled=true;return r;});await delayed;await tick();assert.equal(settled,false);assert.equal(fence.snapshot().closed,true);assert.ok(gates.every(g=>!g.allows(generation)));
 lastReply();assert.equal((await closing).ok,true);assert.equal(aggregate.stats().pending,0);aggregate.dispose();
});
test('actual EOF invalidates a real gate link and pending request without inventing an ACK',async t=>{
 const p=await pair(t);await p.main.ready;await p.creator.ready;let received;const packet=new Promise(resolve=>received=resolve);
 p.creator.subscribe({message:()=>received(),closed:()=>{}});const link=new TerminalGateLink({channelId:p.channelId,send:r=>{if(!p.main.send(r))throw Error('CONTROL_REFUSED');},subscribe:r=>p.main.subscribe(r)});
 const pending=link.sendGate({generation:1,open:true});await packet;p.client.destroy();assert.equal((await pending).ok,false);assert.equal(link.isAvailable(),false);assert.equal(p.main.isAvailable(),false);
});
