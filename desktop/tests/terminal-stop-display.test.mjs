// Independently authored renderer composition. Finite DOM/emulator/bridge DATA only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerminalControls} from '../src/ui/terminal/controls.js';
import {createTerminalView} from '../src/ui/terminal/view.js';
const tick=async()=>{for(let i=0;i<25;i++)await Promise.resolve();};
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.listeners=new Map();this.style={};this.dataset={};this.textContent='';this.value='';this.disabled=false;}
 append(...nodes){this.children.push(...nodes);for(const n of nodes)n.parentNode=this;}
 replaceChildren(...nodes){this.children=[...nodes];for(const n of nodes)n.parentNode=this;}
 setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,f){this.listeners.set(k,f);}removeEventListener(k,f){if(this.listeners.get(k)===f)this.listeners.delete(k);}focus(){}
}
const info=(sessionId='session_a',state='running')=>({sessionId,projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Project',state,exitCode:state==='exited'?77:null,droppedUtf8Bytes:0,attachedWindowId:state==='exited'?null:'window_a'});
function setup({emitExit=false,refusedExited=false,dispatch,refuseStoppedDetach=false,direct=false,search}={}){
 const doc={createElement:tag=>new Element(tag,doc)},container=new Element('main',doc),calls=[],emulators=[],listeners=new Map();let op=0,stopped=false;
 const rows=refusedExited?[info('session_a','exited'),info('session_b')]:[info(),info('session_b')];
 const bridge=Object.fromEntries(['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'].map(name=>['terminal'+name,p=>{
  calls.push({name,p});assert.ok(calls.length<60,'finite bridge');
  if(name==='Attach'&&refusedExited&&p.sessionId==='session_a')return Promise.resolve({ok:false,code:'SESSION_REFUSED',operationId:p.operationId});
  if(name==='Input'&&stopped)return Promise.resolve({ok:false,code:'SESSION_REFUSED',operationId:p.operationId});
  if(name==='Detach'&&stopped&&refuseStoppedDetach)return Promise.resolve({ok:false,code:'SESSION_REFUSED',operationId:p.operationId});
  if(name==='Stop'){stopped=true;if(emitExit)for(const fn of listeners.get('State')??[])fn({epoch:4,session:info(p.sessionId,'exited')});}
  const value=name==='ListProfiles'?[{profileId:'powershell',label:'PowerShell',available:true}]:name==='List'?rows:name==='Attach'?{session:info(p.sessionId),leaseId:'lease_'+p.sessionId,generation:1,firstSequence:0,nextSequence:0}:name==='Input'?{inputSequence:p.inputSequence,accepted:true}:name==='Stop'?info(p.sessionId,'exited'):name==='Detach'?{detached:true}:name==='Ack'?{acknowledged:true}:name==='Resize'?{resized:true}:{};
  return dispatch?.(name,p,value)??Promise.resolve({ok:true,value,operationId:p.operationId});
 }]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=fn=>{const set=listeners.get(name)??new Set();listeners.set(name,set);set.add(fn);return()=>set.delete(fn);};
 const terminalFactory=config=>{const e={options:config,clears:0,disposed:0,writes:[],open(){},write(s,done){this.writes.push(s);done();},clear(){this.clears++;},dispose(){this.disposed++;},onData(fn){this.data=fn;return{dispose:()=>this.data=null};},onResize(fn){this.resize=fn;return{dispose:()=>this.resize=null};}};emulators.push(e);return e;};
 const config={container,bridge,epoch:4,terminalFactory,operationId:()=>`functional_${++op}`,search};
 const api=direct?createTerminalView(config):createTerminalControls({...config,projectId:'project_a',available:true});
 const emitState=(session,epoch=4)=>{for(const fn of listeners.get('State')??[])fn({epoch,session});};
 return{api,calls,emulators,emitState,output(data='final'){for(const fn of listeners.get('Data')??[])fn({epoch:4,sessionId:'session_a',leaseId:'lease_session_a',generation:1,sequence:0,utf8Bytes:Buffer.byteLength(data),data});},async open(){if(direct)assert.equal((await api.attach('session_a')).ok,true);else{assert.equal((await api.refresh()).ok,true);assert.equal((await api.selectSession('session_a')).ok,true);}},async end(){api.dispose();await api.drain();}};
}
test('control: genuine active running display accepts explicit keyboard input once',async()=>{
 const s=setup();try{await s.open();assert.equal(s.emulators[0].options.disableStdin,false);s.emulators[0].data('x');await tick();assert.equal(s.calls.filter(r=>r.name==='Input').length,1);}finally{await s.end();}
});
test('control: a current exited event already fences keyboard input even before Stop settles',async()=>{
 const s=setup({emitExit:true});try{await s.open();assert.equal((await s.api.stopSession()).ok,true);assert.equal(s.api.snapshot().sessions[0].state,'exited');assert.equal(s.emulators[0].options.disableStdin,true);s.emulators[0].data?.('x');await tick();assert.equal(s.calls.some(r=>r.name==='Input'),false);}finally{await s.end();}
});
test('successful exact Stop receipt must fence the stopped display without requiring a separate State event',async()=>{
 const s=setup();try{await s.open();assert.equal((await s.api.stopSession()).ok,true);assert.equal(s.api.snapshot().sessions[0].state,'exited');s.emulators[0].data?.('x');await tick();assert.equal(s.calls.filter(r=>r.name==='Input').length,0,'known exited receipt must not leave keyboard dispatch live');assert.equal(s.emulators[0].options.disableStdin,true);}finally{await s.end();}
});
test('a listed exited session refusal must not permanently block selecting a different running session',async()=>{
 const s=setup({refusedExited:true});try{assert.equal((await s.api.refresh()).ok,true);assert.equal((await s.api.selectSession('session_a')).ok,false);const reply=await s.api.selectSession('session_b');assert.equal(reply.ok,true,'known no-lease SESSION_REFUSED must not poison subsequent explicit running-session selection');assert.deepEqual(s.calls.filter(r=>r.name==='Attach').map(r=>r.p.sessionId),['session_a','session_b']);}finally{await s.end();}
});
test('stopped final display stays readable and explicit switch uses only the labelled Stop basis',async()=>{
 const queries=[],s=setup({refuseStoppedDetach:true,search:{findNext:q=>{queries.push(q);return true;}}});try{await s.open();s.output();await tick();const keyboard=s.emulators[0].data;assert.equal((await s.api.stopSession()).ok,true);assert.equal(s.emulators[0].disposed,0);assert.equal(s.api.clearView().ok,true);assert.equal(s.api.find('final'),true);assert.deepEqual(queries,['final']);s.emitState(info());keyboard('late');await tick();assert.equal(s.emulators[0].options.disableStdin,true);assert.equal(s.calls.some(r=>r.name==='Input'),false);assert.equal((await s.api.selectSession('session_b')).ok,true);assert.equal(s.emulators[0].disposed,1);assert.equal(s.emulators[1].options.disableStdin,false);assert.equal(s.calls.some(r=>r.name==='Detach'),false);assert.equal(s.calls.filter(r=>r.name==='Stop').length,1);}finally{await s.end();}
});
for(const invalid of ['refused','wrong-session','wrong-project','wrong-cwd','running','wrong-operation'])test('invalid Stop outcome cannot mint local retirement basis: '+invalid,async()=>{
 const s=setup({dispatch:(name,p,v)=>name==='Stop'?Promise.resolve(invalid==='refused'?{ok:false,code:'CLEANUP_FAILED',operationId:p.operationId}:{ok:true,value:invalid==='wrong-session'?info('session_b','exited'):invalid==='wrong-project'?{...v,projectId:'foreign'}:invalid==='wrong-cwd'?{...v,cwdDisplay:'C:\\Other'}:invalid==='running'?info():v,operationId:invalid==='wrong-operation'?'wrong_id':p.operationId}):undefined});try{await s.open();assert.equal((await s.api.stopSession()).ok,false);assert.equal(s.api.snapshot().sessions[0].uncertain,true);assert.equal(s.api.snapshot().sessions[0].state,'running');assert.equal((await s.api.selectSession('session_b')).ok,true);assert.equal(s.calls.filter(r=>r.name==='Detach').length,1,'no successful Stop basis; actual detach still required');}finally{await s.end();}
});
test('local Stop observer accepts only exact same live session/epoch identity and returns a distinct retirement basis',async()=>{
 const s=setup({direct:true});try{await s.open();assert.equal(typeof s.api.observeStoppedSession,'function');for(const event of [{epoch:3,session:info('session_a','exited')},{epoch:4,session:info('session_b','exited')},{epoch:4,session:{...info('session_a','exited'),projectId:'other'}},{epoch:4,session:{...info('session_a','exited'),profileId:'other'}},{epoch:4,session:{...info('session_a','exited'),cwdDisplay:'C:\\Other'}},{epoch:4,session:info()}])assert.equal(s.api.observeStoppedSession(event).ok,false);assert.equal(s.emulators[0].options.disableStdin,false);assert.equal(s.api.observeStoppedSession({epoch:4,session:info('session_a','exited')}).ok,true);assert.equal((await s.api.sendInput('x')).ok,false);assert.equal((await s.api.resize(90,30)).ok,false);const reply=await s.api.detach();assert.deepEqual(reply.value,{retired:true,basis:'STOPPED_SESSION',sessionId:'session_a',epoch:4});assert.equal(s.calls.some(r=>r.name==='Detach'||r.name==='Input'||r.name==='Resize'),false);}finally{await s.end();}
});
test('local Stop observer rechecks retirement after metadata reflection reentry',async()=>{
 const s=setup({direct:true});try{await s.open();const event=new Proxy({epoch:4,session:info('session_a','exited')},{getPrototypeOf(target){void s.api.detach();return Object.getPrototypeOf(target);}});assert.equal(s.api.observeStoppedSession(event).ok,false);await s.api.drain();assert.equal(s.calls.filter(r=>r.name==='Detach').length,1);assert.equal(s.api.snapshot().active,false);}finally{await s.end();}
});
test('late successful Stop after Lock-style detach cannot replace held real cleanup with a local basis',async()=>{
 let stopResolve,detachResolve,stopRequest,detachRequest;const s=setup({dispatch:(name,p)=>name==='Stop'?(stopRequest=p,new Promise(r=>stopResolve=r)):name==='Detach'?(detachRequest=p,new Promise(r=>detachResolve=r)):undefined});try{await s.open();const stop=s.api.stopSession();await tick();const detach=s.api.detachDisplay();await tick();stopResolve({ok:true,value:info('session_a','exited'),operationId:stopRequest.operationId});assert.equal((await stop).ok,false);assert.equal(s.api.snapshot().sessions[0].state,'running');let drained=false;const drain=s.api.drain().then(()=>drained=true);await tick();assert.equal(drained,false);detachResolve({ok:false,code:'LEASE_STALE',operationId:detachRequest.operationId});assert.equal((await detach).ok,false);await drain;assert.equal((await s.api.selectSession('session_b')).ok,false);assert.equal(s.api.snapshot().detachUncertain,true);assert.equal(s.calls.filter(r=>r.name==='Attach').length,1);}finally{stopResolve?.({ok:false,code:'PIN_REQUIRED',operationId:stopRequest?.operationId});detachResolve?.({ok:false,code:'LEASE_STALE',operationId:detachRequest?.operationId});await s.end();}
});
test('final queued output remains display-only after a verified Stop with no new ACK or Resize',async()=>{
 const s=setup();try{await s.open();assert.equal((await s.api.stopSession()).ok,true);s.output('last output');s.emulators[0].resize({cols:80,rows:24});await tick();assert.deepEqual(s.emulators[0].writes,['last output']);assert.equal(s.calls.some(r=>r.name==='Ack'||r.name==='Resize'||r.name==='Input'),false);}finally{await s.end();}
});
test('an already-entered ACK remains charged until settlement and its stale refusal cannot undo verified Stop',async()=>{
 let release,request;const s=setup({dispatch:(name,p)=>name==='Ack'?(request=p,new Promise(r=>release=r)):undefined});try{await s.open();s.output();await tick();assert.ok(request);assert.equal((await s.api.stopSession()).ok,true);let drained=false;const drain=s.api.drain().then(()=>drained=true);await tick();assert.equal(drained,false);release({ok:false,code:'LEASE_STALE',operationId:request.operationId});await drain;assert.equal(s.emulators[0].disposed,0);assert.equal(s.emulators[0].options.disableStdin,true);assert.equal(s.api.clearView().ok,true);assert.equal((await s.api.selectSession('session_b')).ok,true);assert.equal(s.calls.some(r=>r.name==='Detach'),false);}finally{release?.({ok:false,code:'LEASE_STALE',operationId:request?.operationId});await s.end();}
});
test('a pending real detach is not replaced by a later local stopped observation',async()=>{
 let release,request;const s=setup({direct:true,dispatch:(name,p)=>name==='Detach'?(request=p,new Promise(r=>release=r)):undefined});try{await s.open();const first=s.api.detach();assert.equal(s.api.observeStoppedSession({epoch:4,session:info('session_a','exited')}).ok,false);const second=s.api.detach();assert.equal(first,second);release({ok:false,code:'LEASE_STALE',operationId:request.operationId});assert.equal((await second).ok,false);assert.equal(s.calls.filter(r=>r.name==='Detach').length,1);}finally{release?.({ok:false,code:'LEASE_STALE',operationId:request?.operationId});await s.end();}
});
test('metadata reflection during Stop cannot publish a stopped basis after local Lock-style retirement',async()=>{
 let s,detached;const proxy=new Proxy(info('session_a','exited'),{getPrototypeOf(target){detached=s.api.detachDisplay();return Object.getPrototypeOf(target);}});s=setup({dispatch:(name,p)=>name==='Stop'?Promise.resolve({ok:true,value:proxy,operationId:p.operationId}):undefined});try{await s.open();assert.equal((await s.api.stopSession()).ok,false);await detached;assert.equal(s.api.snapshot().sessions[0].state,'running');assert.equal(s.calls.filter(r=>r.name==='Detach').length,1);}finally{await s.end();}
});
