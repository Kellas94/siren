// Reentrant trusted admission callbacks over actual private composition.
// SOURCE_ONLY; no native, shell, PTY or host shutdown proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {privateManager,inertTick} from './fixtures/terminal-production-manager-private.mjs';
for(const point of ['registry','policy'])for(const operation of ['terminalAttach','terminalDetach','terminalResize','terminalInput','terminalStop'])test(operation+' reserves its entry before reentrant '+point,async()=>{
 let armed=false,depth=0,maxDepth=0,remaining=12,invoke;const nested=[];
 const hook=()=>{if(!armed)return;depth++;maxDepth=Math.max(maxDepth,depth);try{if(remaining-->0)nested.push(invoke());}finally{depth--;armed=false;}};
 const h=privateManager({onPolicy:q=>{if(point==='policy'&&q.method===operation)hook();}});
 if(point==='registry'){const capture=h.registry.captureAdmissionGuard.bind(h.registry);h.registry.captureAdmissionGuard=(...args)=>{hook();return capture(...args);};}
 try{const s=await h.ready(),lease=(await h.attach(s)).value;
  invoke=()=>operation==='terminalAttach'?h.attach(s):operation==='terminalDetach'?h.detach(lease):operation==='terminalResize'?h.resize(lease):operation==='terminalInput'?h.input(lease):h.manager.stop(h.grant,h.packet(s.sessionId));
  armed=true;const outer=invoke();const replies=await Promise.all(nested);assert.equal(maxDepth,1,'nested admission must be refused before calling policy again');assert.equal(replies.length,1);assert.equal(replies[0].code,'CAPACITY_EXCEEDED');assert.equal(typeof replies[0].operationId,'string','refused valid request retains its correlation identity');assert.equal((await outer).ok,true,'original authorized operation still works');
  if(operation==='terminalInput')assert.equal(h.composition.state.writes.length,1);if(operation==='terminalResize')assert.equal(h.composition.state.resizes.length,1);if(operation==='terminalStop'){await inertTick();assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.composition.state.trace.filter(t=>t.name==='native-stop').length,1);}
 }finally{armed=false;await h.end();}
});
test('Stop remains available from attachment authorization while recursive Stop is refused',async()=>{
 let armed=false,stopReply=null;const h=privateManager({onPolicy:q=>{if(!armed)return;if(q.method==='terminalAttach'){armed=false;stopReply=h.manager.stop(h.grant,h.packet(q.session.sessionId));}}});
 try{const s=await h.ready();armed=true;const attach=await h.attach(s);assert.equal(attach.ok,false);assert.ok(stopReply);assert.equal((await stopReply).ok,true);await inertTick();assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.composition.state.trace.filter(t=>t.name==='native-stop').length,1);}
 finally{armed=false;await h.end();}
});
test('refused reentrant entry does not poison future attachment or input',async()=>{
 let armed=false,invoke,nested;const h=privateManager({onPolicy:q=>{if(armed&&q.method==='terminalAttach'){armed=false;nested=invoke();}}});
 try{const s=await h.ready();invoke=()=>h.attach(s);armed=true;const first=await invoke();assert.equal((await nested).code,'CAPACITY_EXCEEDED');assert.equal(first.ok,true);assert.equal((await h.detach(first.value)).ok,true);const next=await h.attach(s);assert.equal(next.ok,true);assert.equal((await h.input(next.value,0,'after reentry')).ok,true);assert.deepEqual(h.composition.state.writes,['after reentry']);}
 finally{armed=false;await h.end();}
});
test('cross-operation registry cycle is bounded to five frames while innermost Stop cancels stale work',async()=>{
 let armed=false,depth=0,maxDepth=0,captures=0,index=0,operations;const nested=[],h=privateManager();const capture=h.registry.captureAdmissionGuard.bind(h.registry);
 h.registry.captureAdmissionGuard=(...args)=>{if(armed){depth++;maxDepth=Math.max(maxDepth,depth);captures++;try{nested.push(operations[++index%operations.length]());}finally{depth--;}}return capture(...args);};
 try{const s=await h.ready(),l=(await h.attach(s)).value;operations=[()=>h.attach(s),()=>h.detach(l),()=>h.resize(l),()=>h.input(l),()=>h.manager.stop(h.grant,h.packet(s.sessionId))];armed=true;const outer=operations[0]();armed=false;await Promise.all([outer,...nested]);assert.equal(maxDepth,5);assert.equal(captures,5);assert.equal(nested.length,5);assert.equal(h.composition.state.writes.length,0);assert.equal(h.composition.state.resizes.length,0);await inertTick();assert.equal(h.manager.stats().reservedSessions,0);assert.equal(h.composition.state.trace.filter(t=>t.name==='native-stop').length,1);}
 finally{armed=false;await h.end();}
});
for(const operation of ['terminalAttach','terminalDetach','terminalResize','terminalInput','terminalStop'])test(operation+' never reads operationId accessor on a thrown admission error',async()=>{
 let armed=false,getters=0;const h=privateManager(),capture=h.registry.captureAdmissionGuard.bind(h.registry);
 h.registry.captureAdmissionGuard=(...args)=>{if(armed)throw Object.defineProperty({code:'SENDER_REFUSED'},'operationId',{get(){getters++;throw Error('unwanted getter');}});return capture(...args);};
 try{const s=await h.ready(),l=(await h.attach(s)).value;armed=true;const reply=await (operation==='terminalAttach'?h.attach(s):operation==='terminalDetach'?h.detach(l):operation==='terminalResize'?h.resize(l):operation==='terminalInput'?h.input(l):h.manager.stop(h.grant,h.packet(s.sessionId)));assert.equal(reply.code,'SENDER_REFUSED');assert.equal(typeof reply.operationId,'string');assert.equal(getters,0);armed=false;assert.equal((await h.resize(l)).ok,true,'throwing admission cannot poison future entry');}
 finally{armed=false;await h.end();}
});
