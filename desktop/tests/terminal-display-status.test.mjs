// Actual renderer composition with finite DOM/emulator/bridge boundaries only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerminalControls} from '../src/ui/terminal/controls.js';
import {createTerminalView} from '../src/ui/terminal/view.js';
const tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
const defer=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve};};
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.listeners=new Map();this.style={};this.dataset={};this.textContent='';this.value='';this.disabled=false;}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}
 setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,f){this.listeners.set(k,f);}removeEventListener(k,f){if(this.listeners.get(k)===f)this.listeners.delete(k);}
 focus(){}
}
const info=(sessionId='session_a')=>({sessionId,projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Project',state:'running',exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_a'});
function setup(options={}){
 const doc={createElement:tag=>new Element(tag,doc)},container=new Element('main',doc),calls=[],emulators=[],listeners=new Map();let operation=0,attachment=0;
 const bridge=Object.fromEntries(['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'].map(name=>['terminal'+name,p=>{
  calls.push({name,p});assert.ok(calls.length<100,'Finite bridge boundary');
  const value=name==='ListProfiles'?[{profileId:'powershell',label:'PowerShell',available:true}]:name==='List'?[info(),info('session_b')]:name==='Attach'?{session:info(p.sessionId),leaseId:'lease_'+(++attachment),generation:attachment,firstSequence:0,nextSequence:p.sessionId==='session_a'?(options.end??3):0}:name==='Ack'?{acknowledged:true}:name==='Detach'?{detached:true}:name==='Resize'?{resized:true}:name==='Input'?{inputSequence:p.inputSequence,accepted:true}:{};
  return options.dispatch?.(name,p,value)??Promise.resolve({ok:true,value,operationId:p.operationId});
 }]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=fn=>{const set=listeners.get(name)??new Set();set.add(fn);listeners.set(name,set);return()=>set.delete(fn);};
 const terminalFactory=config=>{const e={options:config,writes:[],done:[],disposed:0,clears:0,open(){},write(text,done){this.writes.push(text);if(options.writeThrows)throw Error('display failure');this.done.push(done);},dispose(){this.disposed++;},clear(){this.clears++;},onData(fn){this.data=fn;return{dispose:()=>this.data=null};},onResize(fn){this.resize=fn;return{dispose:()=>this.resize=null};}};emulators.push(e);return e;};
 const config={container,bridge,epoch:4,terminalFactory,operationId:()=>`status_${++operation}`};
 const api=options.direct?createTerminalView({...config,onDisplayState:options.notify}):createTerminalControls({...config,projectId:'project_a',available:options.available??true});
 const nodes=()=>{const result=[];const visit=n=>{result.push(n);for(const c of n.children)visit(c);};visit(container);return result;};
 const s={api,container,calls,emulators,listeners,bridge,nodes,async attach(id='session_a'){if(!options.direct)assert.equal((await api.refresh()).ok,true);return options.direct?api.attach(id):api.selectSession(id);},output(data='abc',sessionId='session_a',leaseId='lease_1',generation=1,sequence=0){for(const fn of listeners.get('Data')??[])fn({epoch:4,sessionId,leaseId,generation,sequence,utf8Bytes:new TextEncoder().encode(data).length,data});},status(){return nodes().find(n=>n.attributes.role==='status')?.textContent;},button(name){return nodes().find(n=>n.dataset.action===name);},async end(){api.dispose();await api.drain();}};
 return s;
}
const inputCalls=s=>s.calls.filter(c=>['Input','Resize','Stop','Create'].includes(c.name));

test('panel leaves replay only after actual emulator completion and correlated ACK settlement',async()=>{
 const held=defer(),s=setup({dispatch:(name)=>name==='Ack'?held.promise:undefined});try{
  assert.equal((await s.attach()).ok,true);assert.match(s.status(),/Replaying/);s.output();await tick();assert.equal(s.calls.some(c=>c.name==='Ack'),false);assert.match(s.status(),/Replaying/);
  s.emulators[0].done.shift()();await tick();const ack=s.calls.find(c=>c.name==='Ack');assert.ok(ack);assert.equal(ack.p.throughSequence,3);assert.match(s.status(),/Replaying/);assert.equal(s.emulators[0].options.disableStdin,true);
  held.resolve({ok:true,value:{acknowledged:true},operationId:ack.p.operationId});await tick();assert.equal(s.status(),'running');assert.equal(s.emulators[0].options.disableStdin,false);assert.deepEqual(inputCalls(s),[]);
 }finally{held.resolve({ok:false,code:'HOST_UNAVAILABLE'});await s.end();}
});
test('ACK refusal retires display and disables Clear/Find without an extra native State event',async()=>{
 const s=setup({dispatch:(name,p)=>name==='Ack'?Promise.resolve({ok:false,code:'HOST_UNAVAILABLE',operationId:p.operationId}):undefined});try{await s.attach();s.output();s.emulators[0].done.shift()();await tick();assert.match(s.status(),/display.*unavailable/i);assert.equal(s.button('clear').disabled,true);assert.equal(s.button('find').disabled,true);assert.equal(s.emulators[0].disposed,1);assert.equal(s.api.clearView().ok,false);assert.equal(s.api.find('x'),false);assert.deepEqual(inputCalls(s),[]);}finally{await s.end();}
});
test('synchronous emulator failure updates panel instead of retaining an old replay label',async()=>{
 const s=setup({writeThrows:true});try{await s.attach();s.output();await tick();assert.match(s.status(),/display.*unavailable/i);assert.equal(s.button('clear').disabled,true);assert.equal(s.button('find').disabled,true);assert.equal(s.calls.some(c=>c.name==='Ack'),false);assert.deepEqual(inputCalls(s),[]);}finally{await s.end();}
});
test('resize refusal reports retirement without waiting for native session metadata',async()=>{
 const s=setup({end:0,dispatch:(name,p)=>name==='Resize'?Promise.resolve({ok:false,code:'HOST_UNAVAILABLE',operationId:p.operationId}):undefined});try{await s.attach();assert.equal(s.status(),'running');s.emulators[0].resize({cols:80,rows:24});await tick();assert.match(s.status(),/display.*unavailable/i);assert.equal(s.button('clear').disabled,true);assert.equal(s.button('find').disabled,true);assert.equal(s.calls.filter(c=>c.name==='Resize').length,1);assert.equal(s.calls.some(c=>c.name==='Input'||c.name==='Stop'),false);}finally{await s.end();}
});
test('old write callback after local Lock-style detach cannot repaint or ACK a reattached session',async()=>{
 const s=setup();try{await s.attach();s.output();const late=s.emulators[0].done.shift();await s.api.detachDisplay();await s.api.selectSession('session_b');assert.equal(s.status(),'running');late();await tick();assert.equal(s.status(),'running');assert.equal(s.api.snapshot().displaySessionId,'session_b');assert.equal(s.calls.some(c=>c.name==='Ack'),false);assert.equal(s.emulators[1].options.disableStdin,false);assert.deepEqual(inputCalls(s),[]);}finally{await s.end();}
});
test('pending ACK remains actually owned through detach and cannot publish into a newer display',async()=>{
 const held=defer(),s=setup({dispatch:name=>name==='Ack'?held.promise:undefined});try{await s.attach();s.output();s.emulators[0].done.shift()();await tick();const ack=s.calls.find(c=>c.name==='Ack');assert.ok(ack);await s.api.detachDisplay();await s.api.selectSession('session_b');let drained=false;const draining=s.api.drain().then(()=>drained=true);await tick();assert.equal(drained,false);held.resolve({ok:true,value:{acknowledged:true},operationId:ack.p.operationId});await draining;assert.equal(s.status(),'running');assert.equal(s.api.snapshot().displaySessionId,'session_b');assert.deepEqual(inputCalls(s),[]);}finally{held.resolve({ok:false,code:'HOST_UNAVAILABLE'});await s.end();}
});
test('disposed panel stays blank when its held write callback eventually runs',async()=>{
 const s=setup();await s.attach();s.output();const late=s.emulators[0].done.shift();s.api.dispose();late();await s.api.drain();assert.equal(s.container.children.length,0);assert.equal(s.calls.some(c=>c.name==='Ack'),false);assert.deepEqual(inputCalls(s),[]);
});
test('local observer DATA is immutable and emits once per meaningful replay change, not each output chunk',async()=>{
 const events=[],s=setup({direct:true,notify:value=>events.push(value)});try{await s.attach();assert.equal(events.length,1);assert.deepEqual(events[0],{active:true,sessionId:'session_a',replaying:true,code:null});assert.equal(Object.isFrozen(events[0]),true);s.output();s.emulators[0].done.shift()();await tick();assert.equal(events.length,2);assert.deepEqual(events[1],{active:true,sessionId:'session_a',replaying:false,code:null});s.output('x','session_a','lease_1',1,3);s.emulators[0].done.shift()();await tick();assert.equal(events.length,2);await s.api.detach();assert.equal(events.length,3);assert.equal(events[2].active,false);assert.equal(events[2].code,'VIEW_DETACHED');}finally{await s.end();}
});
test('observer callback cannot reenter input resize or Attach but may detach the local display safely',async()=>{
 const attempts=[];let s;const notify=value=>{if(value.active&&!value.replaying){attempts.push(s.api.sendInput('must not run'),s.api.resize(90,25),s.api.attach('session_b'));void s.api.detach();}};s=setup({direct:true,notify});try{await s.attach();s.output();s.emulators[0].done.shift()();await tick();const replies=await Promise.all(attempts);assert.equal(replies.length,3);assert.equal(replies.every(r=>r.ok===false),true);assert.deepEqual(inputCalls(s),[]);assert.deepEqual(s.calls.filter(c=>c.name==='Attach').map(c=>c.p.sessionId),['session_a']);assert.equal(s.api.snapshot().active,false);}finally{await s.end();}
});
test('observer throw is contained and does not replace replay ACK or retirement result',async()=>{
 let notifications=0;const s=setup({direct:true,notify:()=>{notifications++;throw Error('observer only');}});try{assert.equal((await s.attach()).ok,true);s.output();s.emulators[0].done.shift()();await tick();assert.equal(s.api.snapshot().replaying,false);assert.equal(s.calls.filter(c=>c.name==='Ack').length,1);assert.equal((await s.api.detach()).ok,true);assert.equal(notifications,3);assert.deepEqual(inputCalls(s),[]);}finally{await s.end();}
});
test('no display callbacks arrive after disposal even if an emulator callback is retained',async()=>{
 const events=[],s=setup({direct:true,notify:e=>events.push(e)});await s.attach();s.output();const late=s.emulators[0].done.shift();s.api.dispose();const count=events.length;late();await s.api.drain();assert.equal(events.length,count);assert.equal(s.calls.some(c=>c.name==='Ack'),false);
});
test('unavailable controls construct no emulator subscriptions or dispatches',async()=>{
 const s=setup({available:false});try{assert.equal(s.calls.length,0);assert.equal(s.emulators.length,0);assert.equal(s.listeners.size,0);assert.equal(s.button('clear').disabled,true);assert.equal(s.button('find').disabled,true);}finally{await s.end();}
});
test('status repaint cannot reenter a control operation through a DOM adapter callback',async()=>{
 const s=setup();try{await s.attach();const node=s.nodes().find(n=>n.attributes.role==='status');let value=node.textContent,attempt=null;Object.defineProperty(node,'textContent',{get:()=>value,set:next=>{value=next;if(next==='running')attempt=s.api.stopSession();}});s.output();s.emulators[0].done.shift()();await tick();assert.ok(attempt,'replay settlement must repaint');assert.equal((await attempt).ok,false);assert.deepEqual(inputCalls(s),[]);}finally{await s.end();}
});
test('observer may retire an attaching display but cannot make its Attach reply current again',async()=>{
 let s;const seen=[];s=setup({direct:true,notify:value=>{seen.push(value);if(value.active)void s.api.detach();}});try{assert.equal((await s.attach()).ok,false);await tick();assert.equal(s.api.snapshot().active,false);assert.equal(s.emulators[0].disposed,1);assert.equal(s.calls.filter(c=>c.name==='Detach').length,1);assert.deepEqual(inputCalls(s),[]);assert.equal(seen.at(-1).active,false);}finally{await s.end();}
});

test('control: reselecting a genuinely active display does not attach twice',async()=>{
 const s=setup({end:0});try{await s.attach();assert.equal(s.status(),'running');assert.equal((await s.api.selectSession('session_a')).ok,true);assert.equal(s.calls.filter(r=>r.name==='Attach').length,1);assert.equal(s.button('clear').disabled,false);}finally{await s.end();}
});

for(const failure of ['Ack','Resize'])test('explicit same-session selection restores a retired display after verified detach: '+failure,async()=>{
 const s=setup({end:0,dispatch:(name,p)=>name===failure?Promise.resolve({ok:false,code:'HOST_UNAVAILABLE',operationId:p.operationId}):undefined});
 try{
  await s.attach();
  if(failure==='Ack'){s.output();s.emulators[0].done.shift()();}else{s.emulators[0].resize({cols:90,rows:30});}
  await tick();await s.api.drain();
  assert.match(s.status(),/display.*unavailable/i);
  assert.equal(s.button('clear').disabled,true);
  assert.equal(s.emulators[0].disposed,1);
  assert.equal(s.calls.filter(r=>r.name==='Detach').length,1,'actual renderer lease detach completed');
  assert.equal(s.api.snapshot().detachUncertain,false,'successful correlated cleanup permits an explicit future attachment');
  const reply=await s.api.selectSession('session_a');
  assert.equal(reply.ok,true);
  assert.equal(s.calls.filter(r=>r.name==='Attach').length,2,'selected success must restore the retired current session display');
  assert.equal(s.button('clear').disabled,false);
  assert.equal(s.calls.some(r=>['Create','Stop','Input'].includes(r.name)),false);
 }finally{await s.end();}
});

for(const cleanup of ['success','refused'])test('explicit retired-session restore waits for the original automatic detach receipt: '+cleanup,async()=>{
 const held=defer(),s=setup({end:0,dispatch:(name,p)=>name==='Ack'?Promise.resolve({ok:false,code:'HOST_UNAVAILABLE',operationId:p.operationId}):name==='Detach'?held.promise:undefined});
 try{
  await s.attach();s.output();s.emulators[0].done.shift()();await tick();
  const detach=s.calls.find(r=>r.name==='Detach');assert.ok(detach);assert.equal(s.button('clear').disabled,true);
  let settled=false;const restoring=s.api.selectSession('session_a').then(reply=>{settled=true;return reply;});await tick();
  assert.equal(settled,false,'restoration cannot report success before the actual cleanup receipt');
  assert.equal(s.calls.filter(r=>r.name==='Attach').length,1,'no replacement attachment while old cleanup is held');
  held.resolve(cleanup==='success'?{ok:true,value:{detached:true},operationId:detach.p.operationId}:{ok:false,code:'HOST_UNAVAILABLE',operationId:detach.p.operationId});
  const reply=await restoring;await s.api.drain();
  assert.equal(reply.ok,cleanup==='success');assert.equal(s.calls.filter(r=>r.name==='Attach').length,cleanup==='success'?2:1);
  assert.equal(s.api.snapshot().detachUncertain,cleanup!=='success');assert.equal(s.button('clear').disabled,cleanup!=='success');
  assert.equal(s.calls.filter(r=>r.name==='Detach').length,1,'one actual cleanup invocation');
  assert.equal(s.calls.some(r=>['Create','Stop','Input'].includes(r.name)),false);
 }finally{held.resolve({ok:false,code:'HOST_UNAVAILABLE'});await s.end();}
});
