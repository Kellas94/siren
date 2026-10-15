// Owner regressions for TC-I1/TC-I2, authored separately from immutable peer probes.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {TerminalControlChannel} from '../src/terminal/control-channel.mjs';
import {TerminalGateLink} from '../src/terminal/gate-link.mjs';
import {TerminalInputFence} from '../src/terminal/input-gate.mjs';
import {TerminalAggregateGateLink} from '../src/terminal/aggregate-gate.mjs';
import {TerminalSessionLedger} from '../src/terminal/session-state.mjs';
const spin=()=>{const until=performance.now()+35;while(performance.now()<until){}};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
class Wire extends EventEmitter {
 writableLength=0;destroyed=false;
 write(bytes){const copy=Buffer.from(bytes);queueMicrotask(()=>{if(!this.peer.destroyed)this.peer.emit('data',copy);});return true;}
 destroy(){if(this.destroyed)return;this.destroyed=true;this.emit('close');queueMicrotask(()=>this.peer.emit('end'));}
}
test('TC-I1 configured socket timeout revokes authenticated availability and cached open fence',async()=>{
 const a=new Wire(),b=new Wire();a.peer=b;b.peer=a;const secret=Buffer.alloc(32,22),channelId='review_timeout';
 const creator=new TerminalControlChannel({stream:b,role:'creator',channelId,secret}),main=new TerminalControlChannel({stream:a,role:'main',channelId,secret});
 await main.ready;await creator.ready;creator.subscribe({message:p=>creator.send({...p,ok:true}),closed:()=>{}});
 const link=new TerminalGateLink({channelId,send:p=>main.send(p),subscribe:r=>main.subscribe(r)}),ledger=new TerminalSessionLedger({writeInput:async()=>({accepted:true})}),fence=new TerminalInputFence({ledger,gateLink:link});
 try{assert.equal((await fence.resumeInput()).ok,true);a.emit('timeout');assert.equal(main.isAvailable(),false);assert.equal(link.isAvailable(),false);assert.equal(fence.snapshot().closed,true);assert.equal(fence.snapshot().hostAcknowledged,false);}finally{main.dispose();creator.dispose();}
});
test('TC-I2 GateLink refuses elapsed ACK even before timeout callback gets its turn',async()=>{
 let receiver,packet;const link=new TerminalGateLink({channelId:'late_ack',deadlineMs:20,send:p=>packet=p,subscribe:r=>{receiver=r;return ()=>{};}});
 const pending=link.sendGate({generation:1,open:true});spin();receiver.message({...packet,ok:true});assert.equal((await pending).ok,false);assert.equal(link.isAvailable(),false);
});
test('TC-I2 outer fence independently refuses late success from a still-available provider',async()=>{
 const work=deferred(),ledger=new TerminalSessionLedger({writeInput:async()=>({accepted:true})}),link={sendGate:()=>work.promise,isAvailable:()=>true,subscribeUnavailable:()=>{}};
 const fence=new TerminalInputFence({ledger,gateLink:link,deadlineMs:20}),pending=fence.resumeInput();spin();work.resolve({ok:true,generation:1,open:true});
 assert.equal((await pending).ok,false);assert.equal(fence.snapshot().closed,true);assert.equal(fence.snapshot().hostAcknowledged,false);
});
function aggregateFixture(){
 const work=deferred();let available=true,closed;const child={sendGate:()=>work.promise,isAvailable:()=>available,subscribeUnavailable:f=>closed=f,dispose:()=>{available=false;closed?.();}};
 const aggregate=new TerminalAggregateGateLink({resolveLink:()=>({link:child,initiallyClosed:true}),deadlineMs:20});aggregate.reserve('one');return {aggregate,work};
}
test('elapsed global aggregate deadline cannot become successful while timer callback is delayed',async()=>{
 const {aggregate,work}=aggregateFixture();await aggregate.bind('one','creator');const pending=aggregate.sendGate({generation:1,open:false});spin();work.resolve({ok:true,generation:1,open:false});
 try{assert.equal((await pending).ok,false);assert.equal(aggregate.isAvailable(),false);}finally{aggregate.dispose();}
});
test('elapsed joining-bind deadline cannot publish a ready creator before its timeout callback',async()=>{
 const {aggregate,work}=aggregateFixture();assert.equal((await aggregate.sendGate({generation:1,open:false})).ok,true);const pending=aggregate.bind('one','creator');spin();work.resolve({ok:true,generation:1,open:false});
 try{assert.equal((await pending).ok,false);assert.equal(aggregate.isAvailable(),false);}finally{aggregate.dispose();}
});
