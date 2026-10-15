// SOURCE_ONLY renderer controls: fake creation/exit is not native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
const {createTerminalControls}=await import('../src/ui/terminal/controls.js').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const defer=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve};};
class Node {
 constructor(tag,document){this.tagName=tag;this.ownerDocument=document;this.children=[];this.attributes={};this.listeners=new Map();this.style={};this.dataset={};this.value='';this.disabled=false;this.textContent='';}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}
 setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,f){this.listeners.set(k,f);}removeEventListener(k,f){if(this.listeners.get(k)===f)this.listeners.delete(k);}
 focus(){}click(){if(!this.disabled)this.listeners.get('click')?.({target:this,preventDefault(){}});}
}
export function containerFixture(){const doc={createElement:tag=>new Node(tag,doc)};return new Node('main',doc);}
const info=(sessionId='session_a',extra={})=>({sessionId,projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Project Ω',state:'running',exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_a',...extra});
const profiles=[{profileId:'powershell',label:'Windows PowerShell',available:true}];
function fixture(options={}){
 assert.equal(typeof createTerminalControls,'function','Missing actual Terminal controls composition');
 const calls=[],emulators=[],subscriptions=new Map(),container=containerFixture(),sessions=options.sessions??[];let operation=0,created=0,subscribed=0,removed=0;
 const bridge=Object.fromEntries(['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'].map(name=>['terminal'+name,p=>{
  calls.push({name,p});assert.ok(calls.length<128,'Finite renderer fixture');
  let value=name==='PickCwd'?{cwdId:'cwd_a',projectId:'project_a',displayPath:'C:\\Project Ω'}:name==='ListProfiles'?profiles:name==='List'?sessions:name==='Create'?info('created_'+(++created)):name==='Attach'?{session:info(p.sessionId),leaseId:'lease_'+p.sessionId,generation:1,firstSequence:0,nextSequence:0}:name==='Detach'?{detached:true}:name==='Stop'?info(p.sessionId,{state:'exited',exitCode:77}):name==='Ack'?{acknowledged:true}:name==='Input'?{inputSequence:p.inputSequence,accepted:true}:{};
  return options.dispatch?.(name,p,value)??Promise.resolve({ok:true,value,operationId:p.operationId});
 }]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=fn=>{subscribed++;const set=subscriptions.get(name)??new Set();subscriptions.set(name,set);set.add(fn);return()=>{removed++;set.delete(fn);};};
 function terminalFactory(config){const e={options:config,disposed:0,clears:0,writes:[],open(){},write(text,done){this.writes.push(text);done();},clear(){this.clears++;},dispose(){this.disposed++;this.data?.('dispose-reentrant-input');},onData(fn){this.data=fn;return {dispose:()=>this.data=null};},onResize(fn){this.resize=fn;return {dispose:()=>this.resize=null};}};emulators.push(e);return e;}
 const controls=createTerminalControls({container,bridge,epoch:4,projectId:'project_a',available:options.available??true,terminalFactory,operationId:()=>`controls_${++operation}`,search:options.search});
 const nodes=()=>{const result=[];const visit=node=>{result.push(node);for(const child of node.children??[])visit(child);};visit(container);return result;};
 return {controls,container,calls,emulators,nodes,subscriptions,get subscribed(){return subscribed;},get removed(){return removed;},async prepare(){assert.equal((await controls.refresh()).ok,true);assert.equal((await controls.pickFolder()).ok,true);},emitState(session){for(const f of subscriptions.get('State')??[])f({epoch:4,session});},async end(){controls.dispose();await controls.drain();}};
}

const display=s=>s.nodes().find(n=>n.attributes['aria-label']==='Terminal output');
function pasteEvent(s,value,extra={}){const event={cancelable:true,defaultPrevented:false,clipboardData:{getData:format=>{assert.equal(format,'text/plain');return value;}},preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};display(s).listeners.get('paste')?.(event);return event;}
const action=(s,name)=>s.nodes().find(n=>n.dataset.action===name);
test('actual display paste is prevented and held until explicit local Submit; exact text is sent once',async()=>{
 const s=fixture({sessions:[info()]});try{await s.controls.refresh();await s.controls.selectSession('session_a');const value='  print("Ω")\r\nnext()\n',event=pasteEvent(s,value);await tick();
 assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);assert.equal(s.calls.filter(c=>c.name==='Input').length,0);
 const preview=s.nodes().find(n=>n.attributes['aria-label']==='Text to send to Terminal');assert.ok(preview);assert.equal(preview.value,value);assert.equal(preview.readOnly,true);assert.equal(action(s,'paste-submit').disabled,false);
 action(s,'paste-submit').click();await s.controls.drain();assert.deepEqual(s.calls.filter(c=>c.name==='Input').map(c=>c.p.data),[value]);assert.equal(preview.value,'');assert.equal(s.calls.some(c=>c.name==='Stop'),false);
 }finally{await s.end();}
});
test('Cancel clears the review without input, Stop or automatic retry',async()=>{
 const s=fixture({sessions:[info()]});try{await s.controls.refresh();await s.controls.selectSession('session_a');pasteEvent(s,'a\nb');await tick();assert.ok(action(s,'paste-cancel'));action(s,'paste-cancel').click();await s.controls.drain();assert.equal(s.calls.some(c=>c.name==='Input'||c.name==='Stop'),false);assert.equal(s.nodes().find(n=>n.attributes['aria-label']==='Text to send to Terminal').value,'');
 }finally{await s.end();}
});

test('single CR and LF paste need review while keyboard Enter remains ordinary input',async()=>{
 for(const value of ['\r','\n']){const s=fixture({sessions:[info()]});try{await s.controls.refresh();await s.controls.selectSession('session_a');pasteEvent(s,value);await tick();assert.equal(s.calls.some(c=>c.name==='Input'),false);assert.equal(action(s,'paste-submit').disabled,false);action(s,'paste-submit').click();await s.controls.drain();assert.deepEqual(s.calls.filter(c=>c.name==='Input').map(c=>c.p.data),[value]);}finally{await s.end();}}
 const s=fixture({sessions:[info()]});try{await s.controls.refresh();await s.controls.selectSession('session_a');s.emulators[0].data('\r');await tick();assert.deepEqual(s.calls.filter(c=>c.name==='Input').map(c=>c.p.data),['\r']);}finally{await s.end();}
});
test('paste controls, malformed Unicode and oversized UTF8 refuse whole without preview or input',async()=>{
 for(const value of ['a\0b','a\x1bb','a\x85b','a\u202eb','a\u061cb','\ud800','😀'.repeat(8193)]){const s=fixture({sessions:[info()]});try{await s.controls.refresh();await s.controls.selectSession('session_a');const event=pasteEvent(s,value);await s.controls.drain();assert.equal(event.defaultPrevented,true);assert.equal(s.calls.some(c=>c.name==='Input'),false);assert.equal(s.nodes().find(n=>n.attributes['aria-label']==='Text to send to Terminal').value,'');assert.equal(action(s,'paste-submit').disabled,true);}finally{await s.end();}}
});
test('one bounded32768-byte paste is exact; repeat events while reviewing do not read or replace clipboard data',async()=>{
 const s=fixture({sessions:[info()]});try{await s.controls.refresh();await s.controls.selectSession('session_a');const value='😀'.repeat(8191)+'abc\n';assert.equal(new TextEncoder().encode(value).length,32768);pasteEvent(s,value);await tick();let read=0;const duplicate=pasteEvent(s,'other\n',{clipboardData:{getData(){read++;return 'other\n';}}});assert.equal(duplicate.defaultPrevented,true);assert.equal(read,0);assert.equal(s.nodes().find(n=>n.attributes['aria-label']==='Text to send to Terminal').value,value);action(s,'paste-submit').click();await s.controls.drain();assert.deepEqual(s.calls.filter(c=>c.name==='Input').map(c=>c.p.data),[value]);}finally{await s.end();}
});
test('detach cancels and clears held local review; stale submit cannot reach the next session',async()=>{
 const s=fixture({sessions:[info('session_a'),info('session_b')]});try{await s.controls.refresh();await s.controls.selectSession('session_a');pasteEvent(s,'a\nb');await tick();const stale=action(s,'paste-submit').listeners.get('click');await s.controls.detachDisplay();await s.controls.drain();assert.equal(action(s,'paste-submit').disabled,true);assert.equal(s.nodes().find(n=>n.attributes['aria-label']==='Text to send to Terminal').value,'');await s.controls.selectSession('session_b');stale();await tick();assert.equal(s.calls.some(c=>c.name==='Input'||c.name==='Stop'),false);}finally{await s.end();}
});
test('dispose cancels actual held local review and drain settles without Stop',async()=>{
 const s=fixture({sessions:[info()]});await s.controls.refresh();await s.controls.selectSession('session_a');pasteEvent(s,'a\nb');await tick();s.controls.dispose();await s.controls.drain();assert.equal(s.container.children.length,0);assert.equal(s.calls.some(c=>c.name==='Input'||c.name==='Stop'),false);
});
test('submitted paste retains actual uncertain Input settlement after detach instead of refunding the lane',async()=>{
 const held=defer(),s=fixture({sessions:[info()],dispatch:(name)=>name==='Input'?held.promise:undefined});try{await s.controls.refresh();await s.controls.selectSession('session_a');pasteEvent(s,'a\nb');await tick();action(s,'paste-submit').click();await tick();assert.equal(s.calls.filter(c=>c.name==='Input').length,1);await s.controls.detachDisplay();let drained=false;const draining=s.controls.drain().then(()=>drained=true);await tick();assert.equal(drained,false);const p=s.calls.find(c=>c.name==='Input').p;held.resolve({ok:true,value:{inputSequence:p.inputSequence,accepted:true},operationId:p.operationId});await draining;assert.equal(drained,true);assert.equal(s.calls.filter(c=>c.name==='Input').length,1);assert.equal(s.calls.some(c=>c.name==='Stop'),false);}finally{held.resolve({ok:false,code:'HOST_UNAVAILABLE'});await s.end();}
});
test('consume paste before clipboard callbacks; reentrant detach cannot target a later lease',async()=>{
 const s=fixture({sessions:[info()]});try{await s.controls.refresh();await s.controls.selectSession('session_a');let event;event={cancelable:true,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},stopImmediatePropagation(){this.stopped=true;},clipboardData:{getData(){assert.equal(event.defaultPrevented,true);assert.equal(event.stopped,true);void s.controls.detachDisplay();return 'a\nb';}}};display(s).listeners.get('paste')(event);await s.controls.drain();assert.equal(s.calls.some(c=>c.name==='Input'||c.name==='Stop'),false);assert.equal(action(s,'paste-submit').disabled,true);}finally{await s.end();}
});
test('raw emulator multiline onData still refuses instead of automatically reviewing or retrying',async()=>{
 const s=fixture({sessions:[info()]});try{await s.controls.refresh();await s.controls.selectSession('session_a');s.emulators[0].data('a\nb');await tick();assert.equal(s.calls.some(c=>c.name==='Input'),false);assert.equal(action(s,'paste-submit').disabled,true);}finally{await s.end();}
});
test('exited session cancels review; noncancelable or already consumed DOM paste never dispatches',async()=>{
 const s=fixture({sessions:[info()]});try{await s.controls.refresh();await s.controls.selectSession('session_a');pasteEvent(s,'ignored',{cancelable:false});pasteEvent(s,'ignored',{defaultPrevented:true});await tick();assert.equal(s.calls.some(c=>c.name==='Input'),false);pasteEvent(s,'a\nb');await tick();s.emitState(info('session_a',{state:'exited',exitCode:0}));await s.controls.drain();assert.equal(s.calls.some(c=>c.name==='Input'||c.name==='Stop'),false);assert.equal(action(s,'paste-submit').disabled,true);}finally{await s.end();}
});
test('unavailable controls add no paste subscription or bridge operations',async()=>{
 const s=fixture({available:false});try{assert.equal(display(s).listeners.has('paste'),false);assert.equal(s.subscribed,0);assert.equal(s.calls.length,0);assert.equal(action(s,'paste-submit').disabled,true);}finally{await s.end();}
});

test('paste-specific control refusal preserves keyboard Ctrl+C and ordinary single-line paste',async()=>{
 const s=fixture({sessions:[info()]});try{await s.controls.refresh();await s.controls.selectSession('session_a');pasteEvent(s,'a\x03b');await s.controls.drain();assert.equal(s.calls.some(c=>c.name==='Input'),false);assert.match(s.nodes().find(n=>n.attributes.role==='status').textContent,/invisible terminal controls/);
 s.emulators[0].data('\x03');await tick();pasteEvent(s,'exact single line Ω');await s.controls.drain();assert.deepEqual(s.calls.filter(c=>c.name==='Input').map(c=>c.p.data),['\x03','exact single line Ω']);assert.equal(action(s,'paste-submit').disabled,true);
 }finally{await s.end();}
});
