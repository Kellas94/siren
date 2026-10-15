// OWNER functional controls tests with actual client/view and finite DOM/bridge.
// No installed renderer, emulator dependency, native session or input authority.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerminalControls} from '../src/ui/terminal/controls.js';
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve};};
const tick=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
class Element {
 constructor(tag,document){this.tagName=tag;this.ownerDocument=document;this.parentNode=null;this.children=[];this.attributes={};this.dataset={};this.listeners=new Map();this.style={};this.disabled=false;this.tabIndex=0;this.value='';this._text='';}
 get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 set textContent(v){this.replaceChildren();this._text=String(v);}
 contains(n){return n===this||this.children.some(c=>c.contains(n));}
 append(...nodes){for(const n of nodes){if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(c=>c!==n);n.parentNode=this;this.children.push(n);}}
 replaceChildren(...nodes){if(this.children.some(n=>n.contains(this.ownerDocument.activeElement)))this.ownerDocument.activeElement=this.ownerDocument.body;for(const n of this.children)n.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
 setAttribute(k,v){this.attributes[k]=String(v);}
 addEventListener(k,f){this.listeners.set(k,f);}
 removeEventListener(k,f){if(this.listeners.get(k)===f)this.listeners.delete(k);}
 focus(){if(this.disabled||this.ownerDocument.activeElement===this)return;this.ownerDocument.focuses.push(this);this.ownerDocument.activeElement=this;this.emit('focusin');}
 emit(type,extra={}){const e={target:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};for(let n=this;n&&!e.stopped;n=n.parentNode){e.currentTarget=n;n.listeners.get(type)?.(e);}return e;}
 click(){if(!this.disabled){this.focus();return this.emit('click');}}
 key(key){const e=this.emit('keydown',{key});if(!e.defaultPrevented&&(key==='Enter'||key===' ')&&!this.disabled)this.emit('click');return e;}
}
const info=(sessionId='session_a',extra={})=>({sessionId,projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Project Ș=Δ',state:'running',exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_a',...extra});
function fixture({rows=[info('session_a'),info('session_b'),info('session_c')],dispatch,available=true}={}){
 const document={activeElement:null,focuses:[],createElement:tag=>new Element(tag,document)};document.body=new Element('body',document);document.activeElement=document.body;
 const container=new Element('main',document);document.body.append(container);const calls=[],subscriptions=new Map(),emulators=[];let operation=0;
 const reply=(p,value)=>({ok:true,value,operationId:p.operationId});
 const bridge=Object.fromEntries(['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'].map(name=>['terminal'+name,p=>{
  calls.push({name,p});assert.ok(calls.length<128,'Finite bridge fixture');
  const value=name==='PickCwd'?{cwdId:'cwd_a',projectId:'project_a',displayPath:'C:\\Project Ș=Δ'}:name==='ListProfiles'?[{profileId:'powershell',label:'Windows PowerShell',available:true}]:name==='List'?rows:name==='Attach'?{session:rows.find(r=>r.sessionId===p.sessionId)??info(p.sessionId),leaseId:'lease_'+p.sessionId,generation:1,firstSequence:0,nextSequence:0}:name==='Detach'?{detached:true}:name==='Stop'?info(p.sessionId,{state:'exited',exitCode:77}):name==='Create'?info('created_one'):name==='Input'?{inputSequence:p.inputSequence,accepted:true}:name==='Ack'?{acknowledged:true}:{};
  return dispatch?.(name,p,value)??Promise.resolve(reply(p,value));
 }]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=fn=>{const set=subscriptions.get(name)??new Set();subscriptions.set(name,set);set.add(fn);return()=>set.delete(fn);};
 const controls=createTerminalControls({container,bridge,epoch:4,projectId:'project_a',available,operationId:()=>`navigation_${++operation}`,terminalFactory(config){
  const emulator={options:config,open(parent){this.input=document.createElement('textarea');this.input.setAttribute('aria-label','Inert emulator input');parent.append(this.input);},write(text,done){done();},clear(){},dispose(){this.input?.parentNode?.replaceChildren();},onData(fn){this.data=fn;return{dispose:()=>this.data=null};},onResize(fn){this.resize=fn;return{dispose:()=>this.resize=null};}};emulators.push(emulator);return emulator;
 }});
 const nodes=()=>{const all=[];const visit=n=>{all.push(n);n.children.forEach(visit);};visit(container);return all;};
 const tabs=()=>nodes().filter(n=>n.attributes.role==='tab');
 const tab=id=>{const n=tabs().find(n=>n.dataset.sessionId===id);assert.ok(n,'Visible session tab '+id);return n;};
 return{controls,container,document,calls,emulators,subscriptions,nodes,tabs,tab,reply,emit(row){for(const fn of subscriptions.get('State')??[])fn({epoch:4,session:row});},async end(){controls.dispose();await controls.drain();}};
}

test('validated maximum-eight metadata becomes a compact labelled tablist and one roving entry',async()=>{
 const rows=Array.from({length:8},(_,i)=>info('session_'+i,{cwdDisplay:i?'C:\\Project '+i:'C:\\<img onerror=bad>\u202e'+ 'x'.repeat(160)})),s=fixture({rows});try{
  assert.equal((await s.controls.refresh()).ok,true);const list=s.nodes().find(n=>n.attributes.role==='tablist');assert.ok(list,'Session navigation must expose tablist semantics');assert.equal(list.attributes['aria-label'],'Terminal sessions');
  assert.equal(s.tabs().length,8);assert.equal(s.tabs().filter(n=>n.tabIndex===0).length,1);assert.equal(s.tab('session_0').attributes['aria-selected'],'false');
  for(const tab of s.tabs()){assert.match(tab.textContent,/PowerShell/);assert.match(tab.textContent,/running/);assert.ok(tab.textContent.length<160);assert.equal(tab.textContent.includes('\u202e'),false);assert.equal(tab.type,'button');}
  assert.equal(s.nodes().some(n=>n.tagName==='img'),false);assert.equal(s.calls.some(c=>['Attach','Create','Input','Stop'].includes(c.name)),false);
 }finally{await s.end();}
});
test('Left Right Home End move only tab focus, wrap, and never intercept emulator input',async()=>{
 const s=fixture();try{await s.controls.refresh();s.tab('session_a').focus();
  for(const [key,target]of [['ArrowRight','session_b'],['End','session_c'],['ArrowRight','session_a'],['ArrowLeft','session_c'],['Home','session_a']]){const e=s.document.activeElement.key(key);assert.equal(e.defaultPrevented,true);assert.equal(s.document.activeElement,s.tab(target));assert.equal(s.tabs().filter(n=>n.tabIndex===0).length,1);}
  assert.equal(s.calls.some(c=>['Attach','Detach','Stop','Input'].includes(c.name)),false);
  await s.controls.selectSession('session_a');const input=s.emulators[0].input;input.focus();const e=input.key('ArrowRight');assert.equal(e.defaultPrevented,false);assert.equal(s.document.activeElement,input);
 }finally{await s.end();}
});
test('Enter and Space explicitly attach one exact session each and keep Stop separate',async()=>{
 const s=fixture();try{await s.controls.refresh();s.tab('session_b').focus();assert.equal(s.tab('session_b').key('Enter').defaultPrevented,true);await s.controls.drain();
  assert.deepEqual(s.calls.filter(c=>c.name==='Attach').map(c=>c.p.sessionId),['session_b']);assert.equal(s.tab('session_b').attributes['aria-selected'],'true');assert.equal(s.document.activeElement,s.tab('session_b'));
  s.tab('session_c').focus();assert.equal(s.tab('session_c').key(' ').defaultPrevented,true);await s.controls.drain();
  assert.deepEqual(s.calls.filter(c=>['Attach','Detach'].includes(c.name)).map(c=>c.name),['Attach','Detach','Attach']);assert.equal(s.calls.filter(c=>c.name==='Attach').at(-1).p.sessionId,'session_c');
  assert.equal(s.calls.some(c=>['Create','Stop','Input'].includes(c.name)),false);assert.ok(s.nodes().some(n=>n.dataset.action==='stop'&&n.textContent==='Stop session'));
 }finally{await s.end();}
});
test('repaints preserve the actual focused tab node and never steal focused emulator input',async()=>{
 const s=fixture();try{await s.controls.refresh();await s.controls.selectSession('session_a');const tab=s.tab('session_b');tab.focus();const count=s.document.focuses.length;
  s.emit(info('session_b',{state:'cleanup-failed'}));assert.equal(s.tab('session_b'),tab);assert.equal(s.document.activeElement,tab);assert.match(tab.textContent,/cleanup-failed/);assert.equal(s.document.focuses.length,count);
  await s.controls.refresh();assert.equal(s.tab('session_b'),tab);assert.equal(s.document.activeElement,tab);
  const input=s.emulators[0].input;input.focus();const after=s.document.focuses.length;s.emit(info('session_c',{state:'host-failed'}));await s.controls.refresh();assert.equal(s.document.activeElement,input);assert.equal(s.document.focuses.length,after);
 }finally{await s.end();}
});
test('membership refresh restores focus only when its focused tab disappeared',async()=>{
 let list=[info('session_a'),info('session_b'),info('session_c')];const s=fixture({dispatch:(name,p)=>name==='List'?Promise.resolve({ok:true,value:list,operationId:p.operationId}):undefined});try{
  await s.controls.refresh();s.tab('session_b').focus();list=[list[0],list[2]];await s.controls.refresh();assert.equal(s.tabs().length,2);assert.equal(s.document.activeElement,s.tab('session_a'));assert.equal(s.tabs().filter(n=>n.tabIndex===0).length,1);
  await s.controls.selectSession('session_a');const input=s.emulators[0].input;input.focus();list=[...list,info('session_d')];await s.controls.refresh();assert.equal(s.document.activeElement,input);assert.equal(s.tab('session_d').attributes['aria-selected'],'false');
 }finally{await s.end();}
});
test('pending real detach blocks another tab activation until one exact acknowledged switch',async()=>{
 const held=deferred();let holding=false;const s=fixture({dispatch:(name)=>name==='Detach'&&holding?held.promise:undefined});try{
  await s.controls.refresh();await s.controls.selectSession('session_a');holding=true;s.tab('session_b').click();await tick();assert.equal(s.controls.snapshot().busy,'select');s.tab('session_c').key('Enter');
  assert.deepEqual(s.calls.filter(c=>c.name==='Attach').map(c=>c.p.sessionId),['session_a']);assert.equal(s.calls.filter(c=>c.name==='Detach').length,1);assert.equal(s.tab('session_c').attributes['aria-disabled'],'true');
  const p=s.calls.find(c=>c.name==='Detach').p;held.resolve(s.reply(p,{detached:true}));await s.controls.drain();assert.deepEqual(s.calls.filter(c=>c.name==='Attach').map(c=>c.p.sessionId),['session_a','session_b']);assert.equal(s.calls.some(c=>c.name==='Stop'),false);
 }finally{holding=false;held.resolve({ok:false,code:'HOST_UNAVAILABLE'});await s.end();}
});
test('unconfirmed detach keeps tabs visible but refuses click and keyboard switching without retry',async()=>{
 const s=fixture({dispatch:(name,p)=>name==='Detach'?Promise.resolve({ok:false,code:'HOST_UNAVAILABLE',operationId:p.operationId}):undefined});try{
  await s.controls.refresh();await s.controls.selectSession('session_a');s.tab('session_b').click();await s.controls.drain();assert.equal(s.controls.snapshot().detachUncertain,true);
  s.tab('session_c').click();s.tab('session_c').key(' ');await s.controls.drain();assert.equal(s.calls.filter(c=>c.name==='Attach').length,1);assert.equal(s.calls.filter(c=>c.name==='Detach').length,1);assert.equal(s.tab('session_c').attributes['aria-disabled'],'true');assert.equal(s.tabs().length,3);assert.equal(s.calls.some(c=>c.name==='Stop'),false);
 }finally{await s.end();}
});
test('uncertain stopped session remains a tab and occupies all eight cells after omitted refresh',async()=>{
 const rows=Array.from({length:8},(_,i)=>info('session_'+i));let omit=false;const s=fixture({rows,dispatch:(name,p)=>name==='Stop'?Promise.resolve({ok:false,code:'CLEANUP_FAILED',operationId:p.operationId}):name==='List'&&omit?Promise.resolve({ok:true,value:rows.slice(1),operationId:p.operationId}):undefined});try{
  await s.controls.refresh();await s.controls.pickFolder();await s.controls.selectSession('session_0');assert.equal((await s.controls.stopSession()).ok,false);omit=true;await s.controls.refresh();assert.equal(s.tabs().length,8);assert.match(s.tab('session_0').textContent,/Cleanup uncertain/);
  assert.equal((await s.controls.createSession()).code,'CAPACITY_EXCEEDED');assert.equal(s.calls.some(c=>c.name==='Create'),false);assert.equal(s.calls.filter(c=>c.name==='Stop').length,1);
 }finally{await s.end();}
});
test('invalid foreign duplicate overflow or getter metadata never becomes a clickable session',async()=>{
 let reads=0;for(const rows of [[info('foreign',{projectId:'other'})],[info('a'),info('a')],Array.from({length:9},(_,i)=>info('s'+i)),[Object.defineProperty(info(),'cwdDisplay',{enumerable:true,get(){reads++;throw 0;}})]]){const s=fixture({rows});try{assert.equal((await s.controls.refresh()).ok,false);assert.equal(s.tabs().length,0);assert.equal(s.calls.some(c=>c.name==='Attach'),false);}finally{await s.end();}}assert.equal(reads,0);
});
test('default unavailable has zero subscriptions bridge calls or emulator construction',async()=>{
 const s=fixture({available:false});try{assert.equal(s.tabs().length,0);assert.equal(s.subscriptions.size,0);assert.equal((await s.controls.selectSession('session_a')).ok,false);s.nodes().find(n=>n.attributes.role==='tablist')?.key('Enter');assert.equal(s.calls.length,0);assert.equal(s.emulators.length,0);assert.ok(s.nodes().filter(n=>n.tagName==='button').every(n=>n.disabled));}finally{await s.end();}
});
test('local retirement during a held detach never attaches a queued tab or submits Stop/input',async()=>{
 const held=deferred();let holding=false;const s=fixture({dispatch:name=>name==='Detach'&&holding?held.promise:undefined});try{
  await s.controls.refresh();await s.controls.selectSession('session_a');holding=true;s.tab('session_b').click();await tick();const retirement=s.controls.detachDisplay();const p=s.calls.find(c=>c.name==='Detach').p;held.resolve(s.reply(p,{detached:true}));await retirement;await s.controls.drain();assert.equal(s.controls.snapshot().displaySessionId,null);assert.deepEqual(s.calls.filter(c=>c.name==='Attach').map(c=>c.p.sessionId),['session_a']);assert.equal(s.calls.some(c=>['Stop','Input'].includes(c.name)),false);
 }finally{holding=false;held.resolve({ok:false,code:'HOST_UNAVAILABLE'});await s.end();}
});
test('API local retirement fences a pending switch while retaining the same actual detach promise',async()=>{
 const held=deferred();let holding=false;const s=fixture({dispatch:name=>name==='Detach'&&holding?held.promise:undefined});try{
  await s.controls.refresh();assert.equal((await s.controls.selectSession('session_a')).ok,true);holding=true;
  const switching=s.controls.selectSession('session_b');await tick();const retirement=s.controls.detachDisplay();assert.equal(s.controls.detachDisplay(),retirement);assert.equal(s.calls.filter(c=>c.name==='Detach').length,1);
  const p=s.calls.find(c=>c.name==='Detach').p;held.resolve(s.reply(p,{detached:true}));await retirement;assert.equal((await switching).ok,false);assert.equal(s.controls.snapshot().displaySessionId,null);assert.deepEqual(s.calls.filter(c=>c.name==='Attach').map(c=>c.p.sessionId),['session_a']);
 }finally{holding=false;held.resolve({ok:false,code:'HOST_UNAVAILABLE'});await s.end();}
});
test('dispose removes handlers and late held Attach cannot rebuild navigation or move focus',async()=>{
 const held=deferred();const s=fixture({dispatch:name=>name==='Attach'?held.promise:undefined});await s.controls.refresh();const tab=s.tab('session_b');tab.click();await tick();const p=s.calls.find(c=>c.name==='Attach').p;s.controls.dispose();const after=s.document.focuses.length;tab.key('Enter');held.resolve(s.reply(p,{session:info('session_b'),leaseId:'late_lease',generation:1,firstSequence:0,nextSequence:0}));await s.controls.drain();assert.equal(s.container.children.length,0);assert.equal(s.document.focuses.length,after);assert.equal(s.calls.filter(c=>c.name==='Attach').length,1);assert.equal(s.calls.some(c=>['Stop','Input'].includes(c.name)),false);
});
