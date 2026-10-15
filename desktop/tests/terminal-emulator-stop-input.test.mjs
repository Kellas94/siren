// Original controls by /root/session_native_failure_diagnosis; extra and reentry controls by /root/capability_libraries_research. Source-only finite maintained regressions.
import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,info,tick,defer} from './helpers/terminal-emulator-fixture.mjs';

// BEGIN ORIGINAL adverse.test.mjs
{


const refused=(p,code)=>({ok:false,code,operationId:p.operationId});
const inputs=s=>s.calls.filter(r=>r.name==='Input');
test('control: explicit paste receipt offers exact input Help after refusal without replay',async()=>{
 const s=fixture({dispatch:(name,p)=>name==='Input'?Promise.resolve(refused(p,'INPUT_RECEIPT_EXPIRED')):undefined});
 try{await s.controls.refresh();await s.controls.selectSession('session_a');await s.paste('x');assert.equal(inputs(s).length,1);assert.ok(s.action());s.action().click();assert.deepEqual(s.explained,[{namespace:'terminal',operation:'input',code:'INPUT_RECEIPT_EXPIRED'}]);assert.equal(inputs(s).length,1);assert.match(s.nodes().find(n=>n.attributes.role==='status').textContent,/unavailable/);}finally{await s.end();}
});
test('raw emulator input refusal must expose same exact scoped Help as explicit paste',async()=>{
 const s=fixture({dispatch:(name,p)=>name==='Input'?Promise.resolve(refused(p,'INPUT_RECEIPT_EXPIRED')):undefined});
 try{await s.controls.refresh();await s.controls.selectSession('session_a');const callback=s.emulators[0].input;callback('x');await s.controls.drain();assert.equal(inputs(s).length,1);assert.match(s.nodes().find(n=>n.attributes.role==='status').textContent,/INPUT_RECEIPT_EXPIRED/);assert.equal(s.emulators[0].options.disableStdin,true);assert.ok(s.action(),'actual keyboard refusal needs contextual Help, not merely generic display retirement');s.action().click();assert.deepEqual(s.explained,[{namespace:'terminal',operation:'input',code:'INPUT_RECEIPT_EXPIRED'}]);}finally{await s.end();}
});
test('Stop held before any State delivery must fence keyboard without losing final display',async()=>{
 const held=defer();let stopping=false,stopRequest;
 const s=fixture({dispatch:(name,p)=>{if(name==='Stop'){stopping=true;stopRequest=p;return held.promise;}if(name==='Input'&&stopping)return Promise.resolve(refused(p,'SESSION_REFUSED'));}});
 let stoppingWork;
 try{await s.controls.refresh();await s.controls.selectSession('session_a');const emulator=s.emulators[0],callback=emulator.input;let disposed=0;emulator.dispose=()=>{disposed++;};
  stoppingWork=s.controls.stopSession();await tick();assert.ok(stopRequest);const stdinWhilePending=emulator.options.disableStdin;
  callback('x');await tick();held.resolve({ok:true,value:{...info(),state:'exited',exitCode:77,attachedWindowId:null},operationId:stopRequest.operationId});assert.equal((await stoppingWork).ok,true);await s.controls.drain();
  console.log(JSON.stringify({scope:'FINITE_ACTUAL_CONTROLS_VIEW',stdinWhilePending,inputAfterStop:inputs(s).length,displayDisposed:disposed,displaySessionId:s.controls.snapshot().displaySessionId,status:s.nodes().find(n=>n.attributes.role==='status').textContent,stopOutcome:s.controls.snapshot().sessions[0].state}));
  assert.equal(inputs(s).length,0,'pending explicit Stop must not dispatch keyboard into a session whose native input was already closed');assert.equal(stdinWhilePending,true);assert.equal(disposed,0,'known stopped output should remain readable');
 }finally{held.resolve(stopRequest?{ok:false,code:'CLEANUP_FAILED',operationId:stopRequest.operationId}:{ok:false,code:'CLEANUP_FAILED'});await stoppingWork;await s.end();}
});

}
// END ORIGINAL adverse.test.mjs

// BEGIN ORIGINAL extra.test.mjs
{
// Author copy-experiment controls, not independent/native qualification.


const fail=(p,code)=>({ok:false,code,operationId:p.operationId});
const calls=(s,name)=>s.calls.filter(r=>r.name===name);
const output=(s,text,sequence=0)=>{const e={epoch:4,sessionId:'session_a',leaseId:'lease_a',generation:1,sequence,data:text,utf8Bytes:Buffer.byteLength(text)};for(const callback of s.listeners.get('Data')??[])callback(e);};
test('pending Stop closes raw input+resize while real output and its ACK continue',async()=>{
 const held=defer();let request;const s=fixture({dispatch:(name,p)=>{if(name==='Stop'){request=p;return held.promise;}}});let stopping;
 try{await s.controls.refresh();await s.controls.selectSession('session_a');const e=s.emulators[0],written=[];e.write=(v,done)=>{written.push(v);done();};stopping=s.controls.stopSession();await tick();assert.ok(request);e.input('x');e.resize({cols:90,rows:30});output(s,'final\r\n');await tick();assert.equal(calls(s,'Input').length,0);assert.equal(calls(s,'Resize').length,0);assert.deepEqual(written,['final\r\n']);assert.equal(calls(s,'Ack').length,1);assert.equal(calls(s,'Ack')[0].p.throughSequence,7);held.resolve({ok:true,value:{...info(),state:'exited',exitCode:0,attachedWindowId:null},operationId:request.operationId});assert.equal((await stopping).ok,true);await s.controls.drain();assert.equal(s.controls.snapshot().displaySessionId,'session_a');assert.equal(calls(s,'Detach').length,0);assert.equal(calls(s,'Stop').length,1);}finally{held.resolve(request?fail(request,'CLEANUP_FAILED'):{});await stopping;await s.end();}
});
test('unknown Stop remains locally input-closed after refresh/state-running; no retry or fake exit',async()=>{
 const s=fixture({dispatch:(name,p)=>name==='Stop'?Promise.resolve(fail(p,'CLEANUP_UNVERIFIED')):undefined});
 try{await s.controls.refresh();await s.controls.selectSession('session_a');const raw=s.emulators[0].input;assert.equal((await s.controls.stopSession()).code,'CLEANUP_UNVERIFIED');await s.controls.refresh();for(const f of s.listeners.get('State')??[])f({epoch:4,session:info()});raw('x');await s.controls.drain();assert.equal(calls(s,'Input').length,0);assert.equal(s.emulators[0].options.disableStdin,true);assert.equal(s.controls.snapshot().sessions[0].state,'running');assert.equal(s.controls.snapshot().sessions[0].uncertain,true);assert.equal((await s.controls.stopSession()).code,'CLEANUP_UNVERIFIED');assert.equal(calls(s,'Stop').length,1);}finally{await s.end();}
});
test('detach during held Stop fences display and a late success never resurrects it',async()=>{
 const held=defer();let request;const s=fixture({dispatch:(name,p)=>name==='Stop'?(request=p,held.promise):undefined});let stop;
 try{await s.controls.refresh();await s.controls.selectSession('session_a');const e=s.emulators[0],raw=e.input;let disposed=0;e.dispose=()=>disposed++;stop=s.controls.stopSession();await tick();await s.controls.detachDisplay();held.resolve({ok:true,value:{...info(),state:'exited',exitCode:0,attachedWindowId:null},operationId:request.operationId});assert.equal((await stop).code,'VIEW_INACTIVE');raw('x');await s.controls.drain();assert.equal(s.controls.snapshot().displaySessionId,null);assert.equal(disposed,1);assert.equal(calls(s,'Input').length,0);assert.equal(calls(s,'Detach').length,1);}finally{held.resolve(request?fail(request,'CLEANUP_FAILED'):{});await stop;await s.end();}
});
test('held raw input then a newer Refresh suppresses the old Help offer',async()=>{
 const held=defer();let request;const s=fixture({dispatch:(name,p)=>name==='Input'?(request=p,held.promise):undefined});
 try{await s.controls.refresh();await s.controls.selectSession('session_a');s.emulators[0].input('x');await tick();assert.ok(request);await s.controls.refresh();held.resolve(fail(request,'INPUT_RECEIPT_EXPIRED'));await s.controls.drain();assert.equal(s.action(),undefined);assert.equal(calls(s,'Input').length,1);assert.equal(s.explained.length,0);}finally{held.resolve(request?fail(request,'INPUT_RECEIPT_EXPIRED'):{});await s.end();}
});
test('raw failure Help button retirement blocks cached click after detach',async()=>{
 const s=fixture({dispatch:(name,p)=>name==='Input'?Promise.resolve(fail(p,'INPUT_RECEIPT_EXPIRED')):undefined});
 try{await s.controls.refresh();await s.controls.selectSession('session_a');s.emulators[0].input('x');await s.controls.drain();const old=s.action();assert.ok(old);await s.controls.detachDisplay();old.click();assert.equal(s.explained.length,0);assert.equal(calls(s,'Input').length,1);}finally{await s.end();}
});
test('held raw failure after disposal has no late Help/callback or input replay',async()=>{
 const held=defer();let request;const s=fixture({dispatch:(name,p)=>name==='Input'?(request=p,held.promise):undefined});
 try{await s.controls.refresh();await s.controls.selectSession('session_a');s.emulators[0].input('x');await tick();s.controls.dispose();held.resolve(fail(request,'INPUT_RECEIPT_EXPIRED'));await s.controls.drain();assert.equal(s.action(),undefined);assert.equal(s.explained.length,0);assert.equal(calls(s,'Input').length,1);}finally{held.resolve(request?fail(request,'INPUT_RECEIPT_EXPIRED'):{});await s.end();}
});
test('malformed native code getter is never invoked; only sanitized validated refusal is offered',async()=>{
 let getters=0;const s=fixture({dispatch:(name,p)=>name==='Input'?Promise.resolve({ok:false,operationId:p.operationId,get code(){getters++;return 'SECRET_PATH';}}):undefined});
 // Existing client.request maps invalid receipt descriptors to BRIDGE_UNAVAILABLE.
 try{await s.controls.refresh();await s.controls.selectSession('session_a');s.emulators[0].input('x');await s.controls.drain();assert.equal(getters,0);assert.ok(s.action());s.action().click();assert.deepEqual(s.explained,[{namespace:'terminal',operation:'input',code:'BRIDGE_UNAVAILABLE'}]);assert.equal(calls(s,'Input').length,1);}finally{await s.end();}
});
test('local fence precedes synchronous Stop bridge reentry and does not dispatch input',async()=>{
 let s;const held=defer();let request;s=fixture({dispatch:(name,p)=>{if(name==='Stop'){request=p;assert.equal(s.emulators[0].options.disableStdin,true);s.emulators[0].input('x');s.emulators[0].resize({cols:80,rows:24});return held.promise;}}});let stop;
 try{await s.controls.refresh();await s.controls.selectSession('session_a');stop=s.controls.stopSession();await tick();assert.ok(request);assert.equal(calls(s,'Input').length,0);assert.equal(calls(s,'Resize').length,0);held.resolve({ok:true,value:{...info(),state:'exited',exitCode:0,attachedWindowId:null},operationId:request.operationId});assert.equal((await stop).ok,true);await s.controls.drain();assert.equal(calls(s,'Stop').length,1);}finally{held.resolve(request?fail(request,'CLEANUP_FAILED'):{});await stop;await s.end();}
});
test('optional Help throw cannot change raw refusal or dispatch another native action',async()=>{
 let attempts=0;const s=fixture({explain:()=>{attempts++;throw Error('optional Help failed');},dispatch:(name,p)=>name==='Input'?Promise.resolve(fail(p,'INPUT_RECEIPT_EXPIRED')):undefined});
 try{await s.controls.refresh();await s.controls.selectSession('session_a');s.emulators[0].input('x');await s.controls.drain();const action=s.action();assert.ok(action);action.click();action.click();assert.equal(attempts,1);assert.equal(calls(s,'Input').length,1);assert.equal(calls(s,'Stop').length,0);assert.equal(s.emulators[0].options.disableStdin,true);}finally{await s.end();}
});

}
// END ORIGINAL extra.test.mjs

// BEGIN ORIGINAL peer-controls.test.mjs
{

const fail=(p,code)=>({ok:false,code,operationId:p.operationId});const calls=(s,n)=>s.calls.filter(x=>x.name===n);
test('unknown Stop fence survives explicit detach then same-session reattachment',async()=>{const s=fixture({dispatch:(n,p)=>n==='Stop'?Promise.resolve(fail(p,'CLEANUP_UNVERIFIED')):undefined});try{await s.controls.refresh();await s.controls.selectSession('session_a');await s.controls.stopSession();await s.controls.detachDisplay();await s.controls.selectSession('session_a');s.emulators.at(-1).input('x');await s.controls.drain();assert.equal(calls(s,'Stop').length,1);assert.equal(s.controls.snapshot().sessions[0].uncertain,true);assert.equal(calls(s,'Input').length,0,'uncertain Stop must not restore local input via reattachment');}finally{await s.end();}});
test('unknown Stop fence survives neighbor switch and same-session return',async()=>{const b={...info(),sessionId:'session_b'};const s=fixture({dispatch:(n,p)=>n==='List'?Promise.resolve({ok:true,value:[info(),b],operationId:p.operationId}):n==='Attach'?Promise.resolve({ok:true,value:{session:p.sessionId==='session_b'?b:info(),leaseId:p.sessionId==='session_b'?'lease_b':'lease_a',generation:1,firstSequence:0,nextSequence:0},operationId:p.operationId}):n==='Stop'?Promise.resolve(fail(p,'CLEANUP_UNVERIFIED')):undefined});try{await s.controls.refresh();await s.controls.selectSession('session_a');await s.controls.stopSession();await s.controls.selectSession('session_b');s.emulators.at(-1).input('b');await s.controls.drain();assert.equal(calls(s,'Input').length,1,'unrelated live neighbor remains usable');await s.controls.selectSession('session_a');s.emulators.at(-1).input('a');await s.controls.drain();assert.equal(calls(s,'Input').length,1,'return to uncertain stopped session cannot dispatch new input');}finally{await s.end();}});
test('held Stop fences synchronous keyboard and resize while preserving data ACK',async()=>{const held=defer();let req,s,work;s=fixture({dispatch:(n,p)=>{if(n==='Stop'){req=p;s.emulators[0].input('sync');s.emulators[0].resize({cols:81,rows:26});return held.promise;}}});try{await s.controls.refresh();await s.controls.selectSession('session_a');const e=s.emulators[0],written=[];e.write=(v,done)=>{written.push(v);done();};work=s.controls.stopSession();await tick();for(const f of s.listeners.get('Data')??[])f({epoch:4,sessionId:'session_a',leaseId:'lease_a',generation:1,sequence:0,data:'tail',utf8Bytes:4});await tick();assert.equal(calls(s,'Input').length,0);assert.equal(calls(s,'Resize').length,0);assert.deepEqual(written,['tail']);assert.equal(calls(s,'Ack').length,1);held.resolve({ok:true,value:{...info(),state:'exited',exitCode:0,attachedWindowId:null},operationId:req.operationId});assert.equal((await work).ok,true);assert.equal(s.controls.snapshot().displaySessionId,'session_a');}finally{held.resolve(req?fail(req,'CLEANUP_UNVERIFIED'):{});await work;await s.end();}});
test('raw refusal Help retires when detached and cannot replay native input',async()=>{const held=defer();let req;const s=fixture({dispatch:(n,p)=>n==='Input'?(req=p,held.promise):undefined});try{await s.controls.refresh();await s.controls.selectSession('session_a');s.emulators[0].input('x');await tick();assert.ok(req);await s.controls.detachDisplay();held.resolve(fail(req,'INPUT_RECEIPT_EXPIRED'));await s.controls.drain();assert.equal(s.action(),undefined);assert.equal(s.explained.length,0);assert.equal(calls(s,'Input').length,1);}finally{held.resolve(req?fail(req,'INPUT_RECEIPT_EXPIRED'):{});await s.end();}});

}
// END ORIGINAL peer-controls.test.mjs

// BEGIN ORIGINAL reattach-reentry.test.mjs
{

test('uncertain Stop fence exists before reattach onData/onResize registration callbacks',async()=>{
 let armed=false,dataCallbacks=0,resizeCallbacks=0;
 const s=fixture({dispatch:(n,p)=>n==='Stop'?Promise.resolve({ok:false,code:'CLEANUP_UNVERIFIED',operationId:p.operationId}):undefined,onDataRegistered(fn,e){if(armed){dataCallbacks++;assert.equal(e.options.disableStdin,true);fn('reentrant');}},onResizeRegistered(fn,e){if(armed){resizeCallbacks++;assert.equal(e.options.disableStdin,true);fn({cols:80,rows:25});}}});
 try{await s.controls.refresh();await s.controls.selectSession('session_a');await s.controls.stopSession();await s.controls.detachDisplay();armed=true;assert.equal((await s.controls.selectSession('session_a')).ok,true);await s.controls.drain();assert.equal(dataCallbacks,1);assert.equal(resizeCallbacks,1);assert.equal(s.calls.filter(c=>c.name==='Input').length,0);assert.equal(s.calls.filter(c=>c.name==='Resize').length,0);const texts=[];s.emulators.at(-1).write=(text,done)=>{texts.push(text);done();};for(const f of s.listeners.get('Data')??[])f({epoch:4,sessionId:'session_a',leaseId:'lease_a',generation:1,sequence:0,data:'tail',utf8Bytes:4});await tick();assert.deepEqual(texts,['tail']);assert.equal(s.calls.filter(c=>c.name==='Ack').length,1);assert.equal(s.controls.snapshot().sessions.find(x=>x.sessionId==='session_a').uncertain,true);assert.equal(s.controls.snapshot().sessions[0].state,info().state);}finally{await s.end();}
});

}
// END ORIGINAL reattach-reentry.test.mjs
