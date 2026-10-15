// Preparation-only desired behavior. Actual controls/client/view; inert DOM and emulator.
import test from 'node:test';import assert from 'node:assert/strict';
import {createTerminalControls} from '../src/ui/terminal/controls.js';
import {HELP_ARTICLES} from '../src/help/catalog.mjs';import {createHelpResolver} from '../src/help/resolve.mjs';
const resolver=createHelpResolver(HELP_ARTICLES),tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();},defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.listeners=new Map();this.style={};this.dataset={};this.textContent='';this.value='';this.disabled=false;this.hidden=false;}
 append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}replaceChildren(...nodes){for(const n of this.children)n.parentNode=null;this.children=[];this.append(...nodes);}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
 get isConnected(){return this.parentNode?this.parentNode.isConnected:this===this.ownerDocument.root;}
 setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,f){this.listeners.set(k,f);}removeEventListener(k,f){if(this.listeners.get(k)===f)this.listeners.delete(k);}focus(){this.ownerDocument.activeElement=this;}click(){if(!this.disabled)this.listeners.get('click')?.({target:this,preventDefault(){}});}
}
const info=()=>({sessionId:'session_a',projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Owned',state:'running',exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_a'});
function fixture({dispatch,explain=true,available=true}={}){
 const document={createElement:tag=>new Element(tag,document)},container=new Element('main',document),calls=[],explained=[],emulators=[],listeners=new Map();let operation=0;
 const bridge=Object.fromEntries(['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'].map(name=>['terminal'+name,p=>{
  calls.push({name,p});assert.ok(calls.length<64,'Finite bridge');const value=name==='PickCwd'?{cwdId:'cwd_a',projectId:'project_a',displayPath:'C:\\Owned'}:name==='ListProfiles'?[{profileId:'powershell',label:'PowerShell',available:true}]:name==='List'?[info()]:name==='Attach'?{session:info(),leaseId:'lease_a',generation:1,firstSequence:0,nextSequence:0}:name==='Input'?{inputSequence:p.inputSequence,accepted:true}:name==='Ack'?{acknowledged:true}:name==='Detach'?{detached:true}:{};
  return dispatch?.(name,p,value)??Promise.resolve({ok:true,value,operationId:p.operationId});
 }]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=f=>{const set=listeners.get(name)??new Set();set.add(f);listeners.set(name,set);return()=>set.delete(f);};
 const terminalFactory=options=>{const emulator={options,open(){},write(data,done){done();},clear(){},dispose(){},onData(fn){this.input=fn;return{dispose:()=>this.input=null};},onResize(fn){this.resize=fn;return{dispose:()=>this.resize=null};}};emulators.push(emulator);return emulator;};
 document.root=container;const controls=createTerminalControls({container,bridge,epoch:4,projectId:'project_a',available,terminalFactory,operationId:()=>`help_${++operation}`,...(explain===true?{onExplain:identity=>{explained.push(identity);return true;}}:explain===false?{}:{onExplain:explain})});
 const nodes=()=>{const all=[],visit=n=>{all.push(n);for(const c of n.children)visit(c);};visit(container);return all;};
 const action=()=>nodes().find(n=>n.dataset.action==='explain-error');
 return{controls,calls,explained,emulators,nodes,action,async paste(value){const output=nodes().find(n=>n.attributes['aria-label']==='Terminal output');let prevented=0,stopped=0;output.listeners.get('paste')({cancelable:true,defaultPrevented:false,preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;},clipboardData:{getData:format=>{assert.equal(format,'text/plain');return value;}}});await controls.drain();assert.equal(prevented,1);assert.equal(stopped,1);},async end(){controls.dispose();await controls.drain();}};
}
function expectIdentity(s,operation,code,article){const button=s.action();assert.ok(button,'owned Explain error action must exist');assert.equal(s.explained.length,0,'no implicit Help open');button.click();assert.deepEqual(s.explained,[{namespace:'terminal',operation,code}]);assert.deepEqual(Object.keys(s.explained[0]).sort(),['code','namespace','operation']);assert.equal(resolver.resolve(s.explained[0]).id,article);}

test('folder refusal offers exact pick-cwd article only on explicit click, with no picker retry',async()=>{
 const s=fixture({dispatch:(name,p)=>name==='PickCwd'?Promise.resolve({ok:false,code:'CWD_REFUSED',message:'private path omitted',operationId:p.operationId}):undefined});try{assert.equal((await s.controls.pickFolder()).code,'CWD_REFUSED');expectIdentity(s,'pick-cwd','CWD_REFUSED','terminal-project-folder');assert.equal(s.calls.filter(c=>c.name==='PickCwd').length,1);assert.equal(s.calls.some(c=>['Input','Create','Stop'].includes(c.name)),false);}finally{await s.end();}
});
test('local missing-folder create refusal offers create identity without any native Create',async()=>{
 const s=fixture();try{assert.equal((await s.controls.createSession()).code,'CWD_REQUIRED');expectIdentity(s,'create','CWD_REQUIRED','terminal-project-folder');assert.equal(s.calls.length,0);}finally{await s.end();}
});
test('explicit pasted invisible controls offer input article without input or Stop',async()=>{
 const s=fixture();try{await s.controls.refresh();assert.equal((await s.controls.selectSession('session_a')).ok,true);await s.paste('echo\x1b[31m');assert.equal(s.controls.snapshot().code,'PASTE_CONTROL_REFUSED');expectIdentity(s,'input','PASTE_CONTROL_REFUSED','terminal-paste');assert.equal(s.calls.some(c=>['Input','Stop','Create'].includes(c.name)),false);}finally{await s.end();}
});
test('unknown valid picker code uses unknown article instead of inference from message',async()=>{
 const s=fixture({dispatch:(name,p)=>name==='PickCwd'?Promise.resolve({ok:false,code:'UNMAPPED_REFUSAL',message:'PIN_REQUIRED CWD_REFUSED C:\\private',operationId:p.operationId}):undefined});try{await s.controls.pickFolder();expectIdentity(s,'pick-cwd','UNMAPPED_REFUSAL','unknown-error');}finally{await s.end();}
});
for(const retire of ['detach','dispose'])test('late picker refusal after '+retire+' cannot publish an action',async()=>{
 const held=defer(),s=fixture({dispatch:name=>name==='PickCwd'?held.promise:undefined});try{const work=s.controls.pickFolder();await tick();if(retire==='detach')await s.controls.detachDisplay();else s.controls.dispose();held.resolve({ok:false,code:'CWD_REFUSED'});assert.equal((await work).ok,false);assert.equal(s.action(),undefined);assert.equal(s.explained.length,0);}finally{held.resolve({ok:false,code:'CANCELLED'});await s.end();}
});
test('optional callback absence keeps receipt behavior and creates no action',async()=>{
 const s=fixture({explain:false});try{assert.equal((await s.controls.createSession()).code,'CWD_REQUIRED');assert.equal(s.action(),undefined);assert.equal(s.calls.length,0);}finally{await s.end();}
});
test('default unavailable has no contextual action or bridge execution',async()=>{
 const s=fixture({available:false});try{assert.equal((await s.controls.createSession()).code,'TERMINAL_UNAVAILABLE');assert.equal(s.action(),undefined);assert.equal(s.calls.length,0);assert.equal(s.emulators.length,0);}finally{await s.end();}
});

const refusal=(p,code='CWD_REFUSED')=>({ok:false,code,operationId:p.operationId});
for(const action of ['success','refresh','detach','dispose'])test('retained old button cannot explain after '+action,async()=>{
 let deny=true;const s=fixture({dispatch:(name,p)=>name==='PickCwd'&&deny?Promise.resolve(refusal(p)):undefined});try{await s.controls.pickFolder();const old=s.action();assert.ok(old);deny=false;if(action==='success')await s.controls.pickFolder();else if(action==='refresh')await s.controls.refresh();else if(action==='detach')await s.controls.detachDisplay();else s.controls.dispose();old.click();assert.equal(s.explained.length,0);assert.equal(s.action(),undefined);assert.equal(s.calls.some(r=>r.name==='Input'||r.name==='Stop'),false);}finally{await s.end();}
});
test('actual Create refusal is scoped create, not folder/paste and is never retried',async()=>{
 const s=fixture({dispatch:(name,p)=>name==='Create'?Promise.resolve(refusal(p)):undefined});try{await s.controls.refresh();await s.controls.pickFolder();assert.equal((await s.controls.createSession()).code,'CWD_REFUSED');assert.ok(s.action());s.action().click();assert.deepEqual(s.explained,[{namespace:'terminal',operation:'create',code:'CWD_REFUSED'}]);assert.equal(Object.isFrozen(s.explained[0]),true);assert.equal(s.calls.filter(r=>r.name==='Create').length,1);assert.equal(s.calls.some(r=>r.name==='Attach'||r.name==='Stop'),false);}finally{await s.end();}
});
test('successful Create then Attach refusal explains attach without mislabeled create or retry',async()=>{
 const s=fixture({dispatch:(name,p)=>name==='Create'?Promise.resolve({ok:true,value:{sessionId:'made_a',projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Owned',state:'running',exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_a'},operationId:p.operationId}):name==='Attach'?Promise.resolve(refusal(p,'HOST_UNAVAILABLE')):undefined});try{await s.controls.refresh();await s.controls.pickFolder();assert.equal((await s.controls.createSession()).code,'HOST_UNAVAILABLE');assert.ok(s.action());assert.equal(s.explained.length,0);s.action().click();assert.deepEqual(s.explained,[{namespace:'terminal',operation:'attach',code:'HOST_UNAVAILABLE'}]);assert.equal(s.calls.filter(r=>r.name==='Create').length,1);assert.equal(s.calls.filter(r=>r.name==='Attach').length,1);assert.equal(s.calls.some(r=>r.name==='Stop'||r.name==='Input'),false);}finally{await s.end();}
});
for(const invalid of ['<private>','lowercase', 'X'.repeat(97),'accessor'])test('invalid receipt code never forwarded as raw identity: '+invalid.slice(0,12),async()=>{
 let gets=0;const s=fixture({dispatch:(name,p)=>name==='PickCwd'?Promise.resolve(invalid==='accessor'?Object.defineProperty({ok:false,operationId:p.operationId},'code',{enumerable:true,get(){gets++;return 'CWD_REFUSED';}}):refusal(p,invalid)):undefined});try{assert.equal((await s.controls.pickFolder()).code,'BRIDGE_UNAVAILABLE');assert.equal(gets,0);assert.ok(s.action());s.action().click();assert.deepEqual(s.explained,[{namespace:'terminal',operation:'pick-cwd',code:'BRIDGE_UNAVAILABLE'}]);}finally{await s.end();}
});
test('explanation append reentry detaches and cannot leave a live action',async()=>{
 const s=fixture({dispatch:(name,p)=>name==='PickCwd'?Promise.resolve(refusal(p)):undefined});try{const root=s.container?.children?.[0]??s.nodes()[1];const status=root.children.findIndex(n=>n.attributes.role==='status'),host=root.children[status+1],append=host.append.bind(host);let retired=false;host.append=(...nodes)=>{append(...nodes);if(!retired){retired=true;void s.controls.detachDisplay();}};assert.equal((await s.controls.pickFolder()).ok,false);await s.controls.drain();assert.equal(retired,true);assert.equal(s.action(),undefined);assert.equal(s.explained.length,0);}finally{await s.end();}
});

for(const invalidCallback of ['foreign',{}])test('wrong callback type cannot alter source controls receipt or add action: '+String(invalidCallback),async()=>{const s=fixture({explain:invalidCallback});try{assert.equal((await s.controls.createSession()).code,'CWD_REQUIRED');assert.equal(s.action(),undefined);assert.equal(s.calls.length,0);}finally{await s.end();}});

for(const removal of ['button','root'])test('externally disconnected '+removal+' cannot explain through a retained click',async()=>{const s=fixture({dispatch:(name,p)=>name==='PickCwd'?Promise.resolve({ok:false,code:'CWD_REFUSED',operationId:p.operationId}):undefined});try{await s.controls.pickFolder();const button=s.action();assert.ok(button);assert.equal(button.isConnected,true);if(removal==='button')button.remove();else s.nodes()[0].replaceChildren();assert.equal(button.isConnected,false);button.click();assert.equal(s.explained.length,0);}finally{await s.end();}});


test('normal picker cancellation retains earlier folder and neutral receipt/status without error offer',async()=>{
 let cancelled=false;const s=fixture({dispatch:(name,p)=>name==='PickCwd'&&cancelled?Promise.resolve({ok:false,code:'CANCELLED',operationId:p.operationId}):undefined});try{assert.equal((await s.controls.pickFolder()).ok,true);const before=s.controls.snapshot().folder;cancelled=true;const receipt=await s.controls.pickFolder();assert.equal(receipt.ok,false);assert.equal(receipt.code,'CANCELLED');assert.deepEqual(s.controls.snapshot().folder,before);const status=s.nodes().find(n=>n.attributes.role==='status');assert.match(status.textContent,/Folder selection was cancelled; your earlier choice is retained/);assert.equal(s.calls.filter(c=>c.name==='PickCwd').length,2);assert.equal(s.calls.some(c=>['Input','Create','Stop'].includes(c.name)),false);assert.equal(s.explained.length,0);assert.equal(s.action(),undefined,'normal user cancellation is not an error action');}finally{await s.end();}
});

test('user cancels reviewed paste: no input, neutral cancellation status and no error offer',async()=>{
 const s=fixture();try{assert.equal((await s.controls.refresh()).ok,true);assert.equal((await s.controls.selectSession('session_a')).ok,true);const work=s.paste('echo first\necho second');await tick();const cancel=s.nodes().find(n=>n.dataset.action==='paste-cancel');assert.ok(cancel);assert.equal(cancel.disabled,false,'actual local review is pending');cancel.click();await work;assert.equal(s.controls.snapshot().code,'PASTE_CANCELLED');const status=s.nodes().find(n=>n.attributes.role==='status');assert.match(status.textContent,/Paste cancelled\. No pasted text was sent/);assert.equal(s.calls.some(c=>['Input','Create','Stop'].includes(c.name)),false);assert.equal(s.calls.filter(c=>c.name==='Attach').length,1);assert.equal(s.explained.length,0);assert.equal(s.action(),undefined,'deliberate review cancellation is not an error action');}finally{await s.end();}
});
