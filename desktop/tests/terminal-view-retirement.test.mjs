import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerminalView} from '../src/ui/terminal/view.js';
import {createTerminalDisplayFilter} from '../src/ui/terminal/display-filter.js';
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture(hooks={}){
 let view,next=0;const calls=[],emulators=[],events={};
 const session={sessionId:'session_a',projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Project',state:'running',exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_a'};
 const bridge=Object.fromEntries(['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'].map(name=>['terminal'+name,p=>{
  calls.push(name);const value=name==='Attach'?{session,leaseId:'lease_a',generation:1,firstSequence:hooks.first??0,nextSequence:hooks.end??0}:name==='Input'?{inputSequence:p.inputSequence,accepted:true}:name==='Ack'?{acknowledged:true}:{};
  return hooks.dispatch?.(name,p,value,events)??Promise.resolve({ok:true,value,operationId:p.operationId});
 }]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=fn=>{events[name]=fn;return()=>delete events[name];};
 const terminalFactory=options=>{
  const e={options,disposed:0,registrations:0,removed:0,done:[],open(){hooks.open?.(view);},dispose(){this.disposed++;hooks.dispose?.(view);},clear(){},write(_text,done){this.done.push(done);hooks.write?.(view);},onData(){this.registrations++;hooks.onData?.(view);return {dispose:()=>this.removed++};},onResize(){this.registrations++;hooks.onResize?.(view);return {dispose:()=>this.removed++};}};
  emulators.push(e);hooks.factory?.(view);return e;
 };
 view=createTerminalView({container:{replaceChildren(){}},bridge,epoch:4,terminalFactory,operationId:()=>{const value=`operation_${++next}`;hooks.operation?.(view,events,session);return value;}});
 return {view,calls,emulators,events,session};
}
for(const phase of ['factory','open','onData','onResize'])test(`retirement during ${phase} refuses attach and releases late resources`,async()=>{
 const s=fixture({[phase]:view=>view.detach()});const reply=await s.view.attach('session_a');assert.equal(reply.ok,false);const e=s.emulators[0];assert.equal(e.disposed,1);assert.equal(e.removed,e.registrations);s.view.dispose();await s.view.drain();assert.equal(s.calls.filter(name=>name==='Stop').length,0);
});
for(const kind of ['Input','Ack','Resize'])test(`${kind} cannot dispatch after operation identity callback retires the view`,async()=>{
 let armed=false;const s=fixture({end:kind==='Ack'?1:0,operation:view=>{if(armed){armed=false;view.detach();}}});assert.equal((await s.view.attach('session_a')).ok,true);
 if(kind==='Ack'){s.events.Data({epoch:4,sessionId:'session_a',leaseId:'lease_a',generation:1,sequence:0,data:'x',utf8Bytes:1});armed=true;s.emulators[0].done.shift()();await tick();}
 else{armed=true;const reply=await (kind==='Input'?s.view.sendInput('x'):s.view.resize(80,24));assert.equal(reply.ok,false);}
 assert.equal(s.calls.filter(name=>name===kind).length,0);s.view.dispose();await s.view.drain();
});
test('dispose is already fenced before emulator disposal callbacks can reopen a view',async()=>{
 let attempt;const s=fixture({dispose:view=>attempt=view.attach('session_a')});assert.equal((await s.view.attach('session_a')).ok,true);s.view.dispose();assert.equal((await attempt).ok,false);assert.equal(s.calls.filter(name=>name==='Attach').length,1);await s.view.drain();
});
for(const control of ['\x9d52;c;secret\x07','\x90qimage\x1b\\','\x9fimage\x1b\\'])test(`nested C1 ${control.charCodeAt(0)} never escapes an incomplete CSI or escape`,()=>{
 for(const prefix of ['\x1b[','\x1b','\x1b(']){
  const f=createTerminalDisplayFilter();let display='';for(const chunk of [prefix,control.slice(0,3),control.slice(3)])display+=f.push(chunk).data;
  assert.doesNotMatch(display,/[\u0090\u009d\u009f]/u);assert.doesNotMatch(display,/secret|image/);assert.equal(f.push('safe').data,'safe');
 }
});
for(const phase of ['marker','early'])test(`retirement in ${phase} display write refuses affirmative attach publication`,async()=>{
 const s=fixture({first:phase==='marker'?10:0,end:phase==='marker'?10:1,write:view=>view.detach(),dispatch:(name,_p,_v,events)=>{if(name==='Attach'&&phase==='early')events.Data({epoch:4,sessionId:'session_a',leaseId:'lease_a',generation:1,sequence:0,data:'x',utf8Bytes:1});}});
 assert.equal((await s.view.attach('session_a')).ok,false);assert.equal(s.emulators[0].disposed,1);assert.equal(s.view.snapshot().active,false);s.view.dispose();await s.view.drain();
});
for(const kind of ['Input','Resize'])test(`${kind} checks session state again after identity generation`,async()=>{
 let armed=false;const s=fixture({operation:(_view,events,session)=>{if(armed){armed=false;events.State({epoch:4,session:{...session,state:'exited',exitCode:77}});}}});assert.equal((await s.view.attach('session_a')).ok,true);
 armed=true;const reply=await (kind==='Input'?s.view.sendInput('x'):s.view.resize(80,24));assert.equal(reply.ok,false);assert.equal(s.calls.filter(name=>name===kind).length,0);s.view.dispose();await s.view.drain();
});
