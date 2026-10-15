// Pure SOURCE_ONLY adapter checks; no xterm, PTY or native admission.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerminalView} from '../src/ui/terminal/view.js';
import {createTerminalControls} from '../src/ui/terminal/controls.js';
const tick=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
const info=(sessionId='session_a',state='running')=>({sessionId,projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Project',state,exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_a'});
function setup(options={}){
 const calls=[],listeners={},emulators=[],held=[];let operation=0,attachment=0;
 const bridge=Object.fromEntries(['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'].map(name=>['terminal'+name,p=>{
  calls.push({name,p});const value=name==='Attach'?{session:info(p.sessionId,options.state??'running'),leaseId:'lease_'+(++attachment),generation:attachment,firstSequence:0,nextSequence:options.end??0}:name==='Resize'?{resized:true}:name==='Ack'?{acknowledged:true}:name==='Detach'?{detached:true}:name==='Input'?{inputSequence:p.inputSequence,accepted:true}:{};
  if(name==='Resize'&&options.holdResize)return new Promise(resolve=>held.push(value=>resolve(options.resizeReply?options.resizeReply(p,value):{ok:true,value,operationId:p.operationId})));
  return options.dispatch?.(name,p,value)??Promise.resolve({ok:true,value,operationId:p.operationId});
 }]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=fn=>{listeners[name]=fn;return()=>delete listeners[name];};
 const terminalFactory=config=>{const e={options:config,done:[],open(){},write(_data,done){this.done.push(done);},dispose(){},clear(){},onData(fn){this.data=fn;return{dispose:()=>this.data=null};},onResize(fn){this.resize=fn;return{dispose:()=>this.resize=null};}};emulators.push(e);return e;};
 const view=createTerminalView({container:{replaceChildren(){}},bridge,epoch:4,terminalFactory,operationId:()=>{options.operation?.();return 'geometry_'+(++operation);}});
 return {view,calls,listeners,emulators,held,async attach(sessionId='session_a'){assert.equal((await view.attach(sessionId)).ok,true);return emulators.at(-1);},state(state,sessionId='session_a'){listeners.State?.({epoch:4,session:info(sessionId,state)});},async complete(sessionId='session_a',leaseId='lease_1',generation=1){listeners.Data?.({epoch:4,sessionId,leaseId,generation,sequence:0,utf8Bytes:1,data:'x'});emulators.at(-1).done.shift()?.();await tick();},async end(){for(const release of held.splice(0))release({resized:true});view.dispose();await view.drain();}};
}
const sizes=s=>s.calls.filter(c=>c.name==='Resize').map(c=>[c.p.cols,c.p.rows,c.p.leaseId,c.p.generation]);

test('replay retains only bounded latest local geometry and flushes once after processed ACK',async()=>{
 const s=setup({end:1});try{const e=await s.attach();e.resize({cols:80,rows:24});e.resize({cols:100,rows:30});assert.equal((await s.view.resize(501,30)).code,'REQUEST_REFUSED');assert.equal((await s.view.resize(100,0)).code,'REQUEST_REFUSED');assert.equal((await s.view.resize(100.5,30)).code,'REQUEST_REFUSED');assert.deepEqual(sizes(s),[]);assert.equal(s.calls.some(c=>c.name==='Input'),false);
  await s.complete();assert.deepEqual(sizes(s),[[100,30,'lease_1',1]]);assert.ok(s.calls.findIndex(c=>c.name==='Ack')<s.calls.findIndex(c=>c.name==='Resize'));e.resize({cols:100,rows:30});await tick();assert.equal(sizes(s).length,1);
 }finally{await s.end();}
});
test('ready resize accepts exact bounds and deduplicates confirmed geometry without implicit emulator dimensions',async()=>{
 const s=setup();try{await s.attach();assert.deepEqual(sizes(s),[]);assert.equal((await s.view.resize(2,1)).ok,true);assert.deepEqual((await s.view.resize(2,1)).value,{unchanged:true});assert.equal((await s.view.resize(500,200)).ok,true);assert.deepEqual(sizes(s).map(r=>r.slice(0,2)),[[2,1],[500,200]]);}finally{await s.end();}
});
test('latest geometry waits for both replay completion and running state',async()=>{
 const s=setup({end:1,state:'starting'});try{await s.attach();assert.equal((await s.view.resize(120,40)).code,'REPLAY_PENDING');await s.complete();assert.deepEqual(sizes(s),[]);assert.equal((await s.view.resize(130,45)).code,'SESSION_NOT_RUNNING');s.state('running');await tick();assert.deepEqual(sizes(s),[[130,45,'lease_1',1]]);s.state('running');await tick();assert.equal(sizes(s).length,1);}finally{await s.end();}
});
test('one in-flight resize coalesces latest geometry and shares work only for that geometry',async()=>{
 const s=setup({holdResize:true});try{await s.attach();const first=s.view.resize(80,24);assert.equal(s.view.resize(80,24),first);assert.deepEqual((await s.view.resize(100,30)).value,{queued:true});assert.deepEqual((await s.view.resize(140,50)).value,{queued:true});assert.equal(sizes(s).length,1);s.held.shift()({resized:true});assert.equal((await first).ok,true);await tick();assert.deepEqual(sizes(s).map(r=>r.slice(0,2)),[[80,24],[140,50]]);s.held.shift()({resized:true});await tick();assert.deepEqual((await s.view.resize(140,50)).value,{unchanged:true});assert.equal(s.calls.some(c=>c.name==='Input'),false);}finally{await s.end();}
});
test('returning to in-flight geometry cancels an intermediate queued resize',async()=>{
 const s=setup({holdResize:true});try{await s.attach();const first=s.view.resize(80,24),middle=s.view.resize(100,30);assert.equal(sizes(s).length,1);await middle;assert.equal(s.view.resize(80,24),first);s.held.shift()({resized:true});await first;await tick();assert.equal(sizes(s).length,1);}finally{await s.end();}
});
test('retired replay geometry never transfers to a new lease',async()=>{
 const s=setup({end:1});try{const old=await s.attach(),oldResize=old.resize;oldResize({cols:100,rows:30});await s.view.detach();await s.attach();oldResize({cols:140,rows:50});await s.complete('session_a','lease_2',2);assert.deepEqual(sizes(s),[]);await s.view.resize(100,30);assert.deepEqual(sizes(s),[[100,30,'lease_2',2]]);}finally{await s.end();}
});
test('old asynchronous resize completion cannot flush pending geometry into a new attachment',async()=>{
 const s=setup({holdResize:true});try{await s.attach();const first=s.view.resize(80,24),queued=s.view.resize(100,30);assert.equal(sizes(s).length,1);await queued;await s.view.detach();await s.attach('session_b');s.held.shift()({resized:true});assert.equal((await first).ok,false);await tick();assert.deepEqual(sizes(s),[[80,24,'lease_1',1]]);const next=s.view.resize(120,40);s.held.shift()({resized:true});assert.equal((await next).ok,true);assert.deepEqual(sizes(s)[1],[120,40,'lease_2',2]);}finally{await s.end();}
});
test('identity-factory reentry reserves resize before a nested latest-geometry request',async()=>{
 let armed=false,s;s=setup({operation:()=>{if(armed){armed=false;void s.view.resize(140,50);}}});try{await s.attach();armed=true;assert.equal((await s.view.resize(80,24)).ok,true);await tick();assert.deepEqual(sizes(s).map(r=>r.slice(0,2)),[[80,24],[140,50]]);}finally{await s.end();}
});
test('bridge reentry cannot dispatch a second resize before the first receipt',async()=>{
 let s,armed=true,release;s=setup({dispatch:(name,p)=>{if(name==='Resize'&&armed){armed=false;void s.view.resize(140,50);return new Promise(resolve=>release=()=>resolve({ok:true,value:{resized:true},operationId:p.operationId}));}}});try{await s.attach();const first=s.view.resize(80,24);assert.equal(sizes(s).length,1);release();await first;await tick();assert.deepEqual(sizes(s).map(r=>r.slice(0,2)),[[80,24],[140,50]]);}finally{release?.();await s.end();}
});
test('reentrant callback retirement cannot record old geometry in a newly attached view',async()=>{
 const s=setup();try{const old=await s.attach(),callback=old.resize;let attached;callback({get cols(){void s.view.detach();attached=s.view.attach('session_b');return 140;},rows:50});await attached;await tick();assert.deepEqual(sizes(s),[]);await s.view.resize(100,30);assert.deepEqual(sizes(s),[[100,30,'lease_2',2]]);}finally{await s.end();}
});
for(const bad of ['refused','malformed','unknown','thrown'])test('resize '+bad+' receipt fences input and discards queued geometry',async()=>{
 const s=setup({holdResize:true,resizeReply:(p)=>bad==='thrown'?Promise.reject(Error('unavailable')):bad==='unknown'?null:bad==='refused'?{ok:false,code:'HOST_UNAVAILABLE',operationId:p.operationId}:{ok:true,value:{},operationId:p.operationId}});try{const e=await s.attach(),first=s.view.resize(80,24),queued=s.view.resize(100,30);assert.equal(sizes(s).length,1);await queued;s.held.shift()({resized:true});assert.equal((await first).ok,false);assert.equal(e.options.disableStdin,true);assert.equal((await s.view.sendInput('x')).ok,false);assert.equal(sizes(s).length,1);assert.equal(s.calls.some(c=>c.name==='Input'),false);assert.equal(s.calls.filter(c=>c.name==='Detach').length,1);}finally{await s.end();}
});
test('drain retains the actual resize receipt even after local disposal',async()=>{
 const s=setup({holdResize:true});try{await s.attach();const first=s.view.resize(80,24);s.view.dispose();let drained=false;const draining=s.view.drain().then(()=>drained=true);await tick();assert.equal(drained,false);s.held.shift()({resized:true});assert.equal((await first).ok,false);await draining;assert.equal(drained,true);}finally{await s.end();}
});

class Node {
 constructor(document){this.ownerDocument=document;this.children=[];this.style={};this.dataset={};this.value='';this.listeners=new Map();}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}setAttribute(){}addEventListener(k,f){this.listeners.set(k,f);}removeEventListener(k){this.listeners.delete(k);}
}
function controlsFixture(available){
 const document={createElement:()=>new Node(document)},container=new Node(document),calls=[],listeners={},emulators=[];let operation=0;
 const bridge=Object.fromEntries(['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'].map(name=>['terminal'+name,p=>{calls.push(name);const value=name==='ListProfiles'?[{profileId:'powershell',label:'PowerShell',available:true}]:name==='List'?[info()]:name==='Attach'?{session:info(),leaseId:'lease_a',generation:1,firstSequence:0,nextSequence:0}:name==='Detach'?{detached:true}:{};return Promise.resolve({ok:true,value,operationId:p.operationId});}]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=fn=>{listeners[name]=fn;return()=>{};};
 const controls=createTerminalControls({container,bridge,epoch:4,projectId:'project_a',...(available===undefined?{}:{available}),operationId:()=>'theme_'+(++operation),terminalFactory:config=>{const e={options:config,open(){},dispose(){},onData(){return{dispose(){}};},onResize(){return{dispose(){}};}};emulators.push(e);return e;}});
 return{controls,calls,listeners,emulators,async end(){controls.dispose();await controls.drain();}};
}
test('default-unavailable controls refuse theme before touching values or bridge',async()=>{
 const s=controlsFixture();try{let reads=0;const theme=Object.defineProperty({},'background',{get(){reads++;return '#000000';}});assert.equal(s.controls.setTheme(theme).code,'TERMINAL_UNAVAILABLE');assert.equal(reads,0);assert.deepEqual(s.calls,[]);assert.equal(Object.keys(s.listeners).length,0);assert.equal(s.emulators.length,0);}finally{await s.end();}
});
test('controls forward only locally validated themes before and after attachment',async()=>{
 const s=controlsFixture(true);try{assert.equal(s.controls.setTheme({background:'#101010',foreground:'#eeeeee',cursor:'#aabbccdd'}).ok,true);assert.deepEqual(s.calls,[]);await s.controls.refresh();await s.controls.selectSession('session_a');assert.equal(s.emulators[0].options.theme.background,'#101010');const before=s.calls.slice();assert.equal(s.controls.setTheme({background:'#fafafa',foreground:'#111111'}).ok,true);assert.equal(s.emulators[0].options.theme.background,'#fafafa');let reads=0;const getter=Object.defineProperty({},'background',{enumerable:true,get(){reads++;return '#000000';}});for(const value of [getter,{background:'red'},{unknown:'#000000'},{background:'#123'},Object.create({background:'#ffffff'})])assert.equal(s.controls.setTheme(value).code,'THEME_REFUSED');assert.equal(reads,0);assert.equal(s.emulators[0].options.theme.background,'#fafafa');assert.deepEqual(s.calls,before);s.controls.dispose();assert.equal(s.controls.setTheme({}).code,'VIEW_DISPOSED');}finally{await s.end();}
});
