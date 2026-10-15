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
test('default unavailable builds labelled controls with zero bridge subscriptions or emulator operations',async()=>{
 const s=fixture({available:false});try{
  assert.equal(s.subscribed,0);assert.equal(s.calls.length,0);assert.equal(s.emulators.length,0);
  for(const action of [()=>s.controls.refresh(),()=>s.controls.pickFolder(),()=>s.controls.createSession(),()=>s.controls.selectSession('session_a'),()=>s.controls.stopSession()])assert.equal((await action()).ok,false);
  assert.equal(s.controls.clearView().ok,false);assert.equal(s.controls.find('x'),false);assert.equal(s.calls.length,0);
  assert.ok(s.nodes().some(n=>n.attributes.role==='status'));assert.ok(s.nodes().some(n=>n.attributes['aria-label']==='Terminal controls'));assert.equal(s.nodes().filter(n=>n.tagName==='button').every(n=>n.disabled),true);
 }finally{await s.end();}
});
test('explicit folder/profile choices create once and attach exactly the validated returned session without input',async()=>{
 const s=fixture();try{assert.equal(s.calls.length,0);await s.prepare();assert.equal((await s.controls.createSession()).ok,true);
  const created=s.calls.find(c=>c.name==='Create'),attached=s.calls.find(c=>c.name==='Attach');assert.deepEqual(Object.keys(created.p).sort(),['cols','cwdId','epoch','operationId','profileId','rows']);assert.equal(created.p.cwdId,'cwd_a');assert.equal(created.p.profileId,'powershell');assert.equal(attached.p.sessionId,'created_1');
  assert.equal(s.controls.snapshot().selectedSessionId,'created_1');assert.equal(s.emulators.length,1);assert.equal(s.calls.filter(c=>c.name==='Input'||c.name==='Stop').length,0);
 }finally{await s.end();}
});
test('folder cancellation and missing profile cause zero Create and preserve an existing choice',async()=>{
 let cancel=false;const s=fixture({dispatch:(name,p)=>name==='PickCwd'&&cancel?Promise.resolve({ok:false,code:'CANCELLED',operationId:p.operationId}):undefined});try{
  assert.equal((await s.controls.createSession()).ok,false);await s.prepare();cancel=true;assert.equal((await s.controls.pickFolder()).code,'CANCELLED');assert.equal(s.controls.snapshot().folder.cwdId,'cwd_a');assert.equal(s.calls.filter(c=>c.name==='Create').length,0);
 }finally{await s.end();}
});
test('button handlers use the real client/view workflow and render untrusted labels only as text',async()=>{
 const s=fixture({dispatch:(name,p,value)=>name==='PickCwd'?Promise.resolve({ok:true,value:{...value,displayPath:'C:\\<img onerror=bad> Ω'},operationId:p.operationId}):undefined});try{
  s.nodes().find(n=>n.dataset.action==='refresh').click();await s.controls.drain();s.nodes().find(n=>n.dataset.action==='folder').click();await s.controls.drain();
  s.nodes().find(n=>n.dataset.action==='create').click();await s.controls.drain();assert.equal(s.calls.filter(c=>c.name==='Create').length,1);assert.ok(s.nodes().some(n=>n.textContent.includes('<img onerror=bad>')));assert.equal(s.nodes().some(n=>n.tagName==='img'),false);
 }finally{await s.end();}
});
for(const bad of ['foreign-project','duplicate','overflow','accessor'])test('refuses malformed successful session list '+bad+' without attaching',async()=>{
 let reads=0;const malformed=bad==='foreign-project'?[info('session_a',{projectId:'foreign'})]:bad==='duplicate'?[info(),info()]:bad==='overflow'?Array.from({length:9},(_,i)=>info('session_'+i)):[Object.defineProperty(info(),'cwdDisplay',{enumerable:true,get(){reads++;return 'private';}})];
 const s=fixture({sessions:malformed});try{assert.equal((await s.controls.refresh()).ok,false);assert.equal(reads,0);assert.equal(s.calls.some(c=>c.name==='Attach'),false);assert.equal(s.controls.snapshot().sessions.length,0);}finally{await s.end();}
});
for(const bad of ['foreign-project','wrong-profile','exited','getter'])test('creator receipt '+bad+' cannot attach or silently retry',async()=>{
 let reads=0;const s=fixture({dispatch:(name,p,value)=>name==='Create'?Promise.resolve({ok:true,value:bad==='foreign-project'?info('created_a',{projectId:'other'}):bad==='wrong-profile'?info('created_a',{profileId:'other'}):bad==='exited'?info('created_a',{state:'exited'}):Object.defineProperty(info('created_a'),'projectId',{enumerable:true,get(){reads++;return 'project_a';}}),operationId:p.operationId}):undefined});
 try{await s.prepare();assert.equal((await s.controls.createSession()).ok,false);assert.equal(s.controls.snapshot().creationUncertain,true);assert.equal((await s.controls.createSession()).ok,false);assert.equal(s.calls.filter(c=>c.name==='Create').length,1);assert.equal(s.calls.some(c=>c.name==='Attach'),false);assert.equal(reads,0);}finally{await s.end();}
});
test('display detach generation fences a late picker result without any automatic create',async()=>{
 const h=defer(),s=fixture({dispatch:(name,p)=>name==='PickCwd'?h.promise:undefined});try{
  const picking=s.controls.pickFolder();await tick();await s.controls.detachDisplay();h.resolve({ok:true,value:{cwdId:'late_cwd',projectId:'project_a',displayPath:'C:\\Late'},operationId:s.calls[0].p.operationId});assert.equal((await picking).ok,false);assert.equal(s.controls.snapshot().folder,null);assert.equal(s.calls.some(c=>c.name==='Create'),false);
 }finally{h.resolve({ok:false,code:'CANCELLED'});await s.end();}
});
test('dispose fences late creator replies and clears display before drain; it never stops or resends input',async()=>{
 const h=defer(),s=fixture({dispatch:(name,p)=>name==='Create'?h.promise:undefined});await s.prepare();const creating=s.controls.createSession();await tick();const p=s.calls.find(c=>c.name==='Create').p;s.controls.dispose();assert.equal(s.container.children.length,0);
 h.resolve({ok:true,value:info('late_created'),operationId:p.operationId});assert.equal((await creating).ok,false);await s.controls.drain();assert.equal(s.calls.some(c=>c.name==='Attach'||c.name==='Stop'||c.name==='Input'),false);assert.equal(s.removed,s.subscribed);
});
test('switch awaits successful prior detach and never creates or stops a session',async()=>{
 const h=defer();let hold=false;const s=fixture({sessions:[info('session_a'),info('session_b')],dispatch:(name,p)=>name==='Detach'&&hold?h.promise:undefined});try{
  await s.controls.refresh();await s.controls.selectSession('session_a');hold=true;const switching=s.controls.selectSession('session_b');await tick();assert.deepEqual(s.calls.filter(c=>c.name==='Attach').map(c=>c.p.sessionId),['session_a']);
  const p=s.calls.find(c=>c.name==='Detach').p;h.resolve({ok:true,value:{detached:true},operationId:p.operationId});assert.equal((await switching).ok,true);assert.deepEqual(s.calls.filter(c=>c.name==='Attach').map(c=>c.p.sessionId),['session_a','session_b']);assert.equal(s.calls.some(c=>c.name==='Create'||c.name==='Stop'),false);
 }finally{hold=false;h.resolve({ok:false,code:'LEASE_STALE'});await s.end();}
});
test('unverified prior detach refuses new attachment and remains visible instead of recycling lease',async()=>{
 const s=fixture({sessions:[info('session_a'),info('session_b')],dispatch:(name,p)=>name==='Detach'?Promise.resolve({ok:false,code:'HOST_UNAVAILABLE',operationId:p.operationId}):undefined});try{
  await s.controls.refresh();await s.controls.selectSession('session_a');assert.equal((await s.controls.selectSession('session_b')).ok,false);assert.equal(s.controls.snapshot().detachUncertain,true);assert.equal((await s.controls.selectSession('session_b')).ok,false);assert.equal(s.calls.filter(c=>c.name==='Attach').length,1);assert.equal(s.calls.some(c=>c.name==='Stop'),false);
 }finally{await s.end();}
});
test('Clear Search detachDisplay and dispose are display-only; only explicit Stop issues terminalStop',async()=>{
 const queries=[],s=fixture({sessions:[info()],search:{findNext:q=>{queries.push(q);return true;}}});try{
  await s.controls.refresh();await s.controls.selectSession('session_a');assert.equal(s.controls.clearView().ok,true);assert.equal(s.controls.find('needle'),true);assert.deepEqual(queries,['needle']);
  assert.equal(s.calls.some(c=>c.name==='Stop'),false);assert.equal((await s.controls.stopSession()).ok,true);assert.equal(s.calls.filter(c=>c.name==='Stop').length,1);assert.equal(s.controls.snapshot().sessions[0].state,'exited');
  await s.controls.detachDisplay();assert.equal(s.calls.filter(c=>c.name==='Stop').length,1);
 }finally{await s.end();}
});
test('uncertain Stop remains visible through refresh and never refunds a full eight-session capacity',async()=>{
 const rows=Array.from({length:8},(_,i)=>info('session_'+i));let omit=false;const s=fixture({sessions:rows,dispatch:(name,p)=>name==='Stop'?Promise.resolve({ok:false,code:'CLEANUP_FAILED',operationId:p.operationId}):name==='List'&&omit?Promise.resolve({ok:true,value:rows.slice(1),operationId:p.operationId}):undefined});try{
  await s.prepare();await s.controls.selectSession('session_0');assert.equal((await s.controls.stopSession()).ok,false);assert.equal(s.controls.snapshot().sessions[0].state,'running');assert.equal(s.controls.snapshot().sessions[0].uncertain,true);
  omit=true;assert.equal((await s.controls.refresh()).ok,true);assert.equal(s.controls.snapshot().sessions.length,8);assert.equal((await s.controls.createSession()).code,'CAPACITY_EXCEEDED');assert.equal((await s.controls.stopSession()).ok,false);assert.equal(s.calls.filter(c=>c.name==='Stop').length,1);assert.equal(s.calls.some(c=>c.name==='Create'),false);
 }finally{await s.end();}
});
test('foreign or non-exited affirmative Stop receipt remains uncertain and cannot claim cleanup',async()=>{
 const s=fixture({sessions:[info()],dispatch:(name,p)=>name==='Stop'?Promise.resolve({ok:true,value:info('session_other'),operationId:p.operationId}):undefined});try{
  await s.controls.refresh();await s.controls.selectSession('session_a');assert.equal((await s.controls.stopSession()).ok,false);assert.equal(s.controls.snapshot().sessions[0].state,'running');assert.equal(s.controls.snapshot().sessions[0].uncertain,true);
 }finally{await s.end();}
});
test('bounded request lane refuses rapid repeated Create while actual first bridge work remains pending',async()=>{
 const h=defer(),s=fixture({dispatch:(name,p)=>name==='Create'?h.promise:undefined});try{await s.prepare();const first=s.controls.createSession();await tick();assert.equal((await s.controls.createSession()).code,'CAPACITY_EXCEEDED');assert.equal(s.calls.filter(c=>c.name==='Create').length,1);const p=s.calls.find(c=>c.name==='Create').p;h.resolve({ok:true,value:info('only_created'),operationId:p.operationId});assert.equal((await first).ok,true);}finally{h.resolve({ok:false,code:'HOST_UNAVAILABLE'});await s.end();}
});
