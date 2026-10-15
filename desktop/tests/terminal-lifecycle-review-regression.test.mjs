// Owner regressions for authentic peer findings. Pure JS composition only.
import test from 'node:test';import assert from 'node:assert/strict';
import {TerminalLifecycle} from '../src/terminal/lifecycle.mjs';
import {TerminalInputFence,HostInputGate} from '../src/terminal/input-gate.mjs';
const tick=()=>new Promise(r=>setImmediate(r));
const grant={windowId:'workspace_a',projectId:'project_a',epoch:2,role:'workspace'};
function dependencies(inputFence,extra={}){return {authorize:()=>true,captureAdmission:()=>({isCurrent:()=>true}),inputFence,...extra};}
function actualFence(){
  const gate=new HostInputGate(),packets=[],ledger={closed:true,closeInput(){this.closed=true;},resumeInput(){this.closed=false;}};
  const link={isAvailable:()=>true,subscribeUnavailable(){},sendGate(p){packets.push(p);return Promise.resolve(gate.apply(p));}};
  return {ledger,gate,packets,fence:new TerminalInputFence({ledger,gateLink:link})};
}
for(const transition of ['lock','host-failed','shutdown'])test('queued resume cannot reopen the actual external gate after '+transition,async()=>{
  const actual=actualFence(),life=new TerminalLifecycle(dependencies(actual.fence));
  const opening=life.resumeInput();let closing;
  if(transition==='lock')closing=life.closeInput('lock');
  else if(transition==='host-failed')life.hostFailed();
  else closing=life.shutdown('quit');
  await closing;assert.equal((await opening).ok,false);await tick();
  assert.equal(actual.ledger.closed,true);assert.equal(actual.gate.allows(actual.fence.snapshot().generation),false);
});
test('timed-out external open remains single-flight through 30 retries until actual settlement',async()=>{
  const timers=[],pending=[],closes=[];
  const fence={closeInput(reason){closes.push(reason);return Promise.resolve({ok:true,localInputFenced:true,hostAcknowledged:true});},resumeInput(){return new Promise(r=>pending.push(r));}};
  const life=new TerminalLifecycle(dependencies(fence,{setTimer:fn=>{timers.push(fn);return fn;},clearTimer(){}}));
  const first=life.resumeInput();await tick();timers.at(-1)();assert.equal((await first).ok,false);
  for(let i=0;i<30;i++){
    const again=life.resumeInput();await tick();timers.at(-1)();assert.equal((await again).ok,false);
  }
  assert.equal(pending.length,1,'wrapper timeout cannot admit another unresolved host open');
  assert.ok(closes.includes('resume-timeout'),'a newer external close must fence a timed-out opening');
  pending[0]({ok:true,localInputFenced:false,hostAcknowledged:true});await tick();
  const fresh=life.resumeInput();assert.equal(pending.length,2);pending[1]({ok:true,localInputFenced:false,hostAcknowledged:true});assert.equal((await fresh).ok,true);
});
for(const method of ['create','list'])test(method+' refuses invalid operationId accessors without invocation or exception',async()=>{
  let getters=0;const payload={epoch:2};Object.defineProperty(payload,'operationId',{enumerable:true,get(){getters++;throw Error('INVALID_GETTER_EXECUTED');}});
  const life=new TerminalLifecycle();let response,error;
  try{response=await life[method](grant,payload);}catch(e){error=e;}
  assert.equal(getters,0);assert.equal(error,undefined);assert.equal(response.code,'REQUEST_REFUSED');
});
test('ready actual fence opens then a same-turn Lock leaves the newest generation closed',async()=>{
  const actual=actualFence(),life=new TerminalLifecycle(dependencies(actual.fence));await tick();
  const opening=life.resumeInput(),closing=life.closeInput('lock');await opening;await closing;await tick();
  assert.equal(actual.ledger.closed,true);assert.equal(actual.gate.allows(actual.fence.snapshot().generation),false);
  assert.equal((await life.resumeInput()).ok,true);assert.equal(actual.ledger.closed,false);
});
