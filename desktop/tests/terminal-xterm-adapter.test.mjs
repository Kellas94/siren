import test from 'node:test';
import assert from 'node:assert/strict';
const {createXtermAdapter}=await import('../src/ui/terminal/xterm-adapter.js').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});

function fixture({size={width:800,height:400},dimensions={cols:80,rows:24},throwOpen=false,throwObserve=false,throwDisconnect=false,syncFrame=false,onDispose}={}){
 const terminals=[],fits=[],searches=[],frames=new Map(),observers=[],calls=[];let frame=0;
 class Terminal {
  constructor(options){this.options=options;this.cols=80;this.rows=24;this.listeners={};this.addons=[];this.disposed=0;this.callbacks=[];terminals.push(this);}
  loadAddon(addon){this.addons.push(addon);addon.activate(this);}
  open(container){this.container=container;if(throwOpen)throw Error('open failed');}
  onData(callback){this.listeners.data=callback;return{dispose:()=>delete this.listeners.data};}
  onResize(callback){this.listeners.resize=callback;return{dispose:()=>delete this.listeners.resize};}
  resize(cols,rows){this.cols=cols;this.rows=rows;calls.push(['resize',cols,rows]);this.listeners.resize?.({cols,rows});}
  write(data,callback){calls.push(['write',data]);this.callbacks.push(callback);}
  clear(){calls.push(['clear']);}dispose(){this.disposed++;onDispose?.();for(const addon of this.addons)addon.dispose();}
 }
 class FitAddon{constructor(){this.disposed=0;fits.push(this);}activate(terminal){this.terminal=terminal;}proposeDimensions(){return dimensions;}dispose(){this.disposed++;}}
 class SearchAddon{constructor(){this.disposed=0;searches.push(this);}activate(terminal){this.terminal=terminal;}findNext(query){calls.push(['search',query,this.terminal]);return query==='found';}dispose(){this.disposed++;}}
 class ResizeObserver{constructor(callback){this.callback=callback;this.disconnected=0;observers.push(this);}observe(container){this.container=container;if(throwObserve)throw Error('observe failed');}disconnect(){this.disconnected++;if(throwDisconnect)throw Error('disconnect failed');}}
 const container={replaceChildren(){},listeners:new Map(),getBoundingClientRect:()=>size,addEventListener(name,callback,capture){this.listeners.set(name,{callback,capture});},removeEventListener(name,callback){if(this.listeners.get(name)?.callback===callback)this.listeners.delete(name);}};
 const adapter=createXtermAdapter({Terminal,FitAddon,SearchAddon,ResizeObserver,requestFrame:callback=>{const id=++frame;if(syncFrame)callback();else frames.set(id,callback);return id;},cancelFrame:id=>frames.delete(id)});
 const flush=()=>{for(const [id,callback]of [...frames]){frames.delete(id);callback();}};
 return{adapter,container,terminals,fits,searches,frames,observers,calls,flush};
}

test('the adapter exists independently from native or installed xterm packages',()=>assert.equal(typeof createXtermAdapter,'function'));
test('each emulator loads exactly fit and search, preserves view options and cannot enable unsupported features',()=>{
 const s=fixture(),e=s.adapter.terminalFactory({disableStdin:true,theme:{background:'#000000'},scrollback:1,allowProposedApi:true,windowOptions:{getWinSizePixels:true},linkHandler:{activate(){throw Error('wrong');}}});
 assert.equal(e.options.disableStdin,true);assert.equal(e.options.scrollback,10000);assert.equal(e.options.allowProposedApi,false);assert.deepEqual(e.options.windowOptions,{});assert.doesNotThrow(()=>e.options.linkHandler.activate());
 e.open(s.container);assert.equal(s.terminals[0].addons.length,2);assert.equal(s.fits[0].terminal,s.terminals[0]);assert.equal(s.searches[0].terminal,s.terminals[0]);e.dispose();
});
test('write completion forwards only the real parser callback and nothing is acknowledged by adapter',()=>{
 const s=fixture(),e=s.adapter.terminalFactory({});e.open(s.container);let completed=0;e.write('text',()=>completed++);assert.equal(completed,0);s.terminals[0].callbacks.shift()();assert.equal(completed,1);assert.deepEqual(s.calls,[['write','text']]);e.dispose();
});
test('fit coalesces frames, clamps native dimensions and suppresses duplicate geometry',()=>{
 const s=fixture({dimensions:{cols:900,rows:900}}),e=s.adapter.terminalFactory({});e.open(s.container);let resized=0;e.onResize(()=>resized++);for(let i=0;i<20;i++)s.observers[0].callback();assert.equal(s.frames.size,1);s.flush();assert.deepEqual(s.calls,[['resize',500,200]]);assert.equal(resized,1);s.observers[0].callback();s.flush();assert.equal(resized,1);e.dispose();
});
test('hidden and invalid dimensions never resize; a later visible notification can fit',()=>{
 const size={width:0,height:0},s=fixture({size,dimensions:{cols:1,rows:0}}),e=s.adapter.terminalFactory({});e.open(s.container);s.flush();assert.deepEqual(s.calls,[]);size.width=400;size.height=200;s.observers[0].callback();s.flush();assert.deepEqual(s.calls,[['resize',2,1]]);e.dispose();
 const t=fixture({dimensions:{cols:NaN,rows:5}}),f=t.adapter.terminalFactory({});f.open(t.container);t.flush();assert.deepEqual(t.calls,[]);f.dispose();
});
test('search follows the active emulator and never searches a destroyed buffer',()=>{
 const s=fixture(),first=s.adapter.terminalFactory({});first.open(s.container);assert.equal(s.adapter.search.findNext('found'),true);first.dispose();assert.equal(s.adapter.search.findNext('found'),false);const second=s.adapter.terminalFactory({});second.open(s.container);assert.equal(s.adapter.search.findNext('found'),true);assert.equal(s.calls.at(-1)[2],s.terminals[1]);assert.equal(s.adapter.search.findNext('x'.repeat(4097)),false);second.dispose();
});
test('adapter leaves explicit DOM paste to the reviewed controls and never registers a duplicate handler',()=>{
 const s=fixture(),e=s.adapter.terminalFactory({});e.open(s.container);assert.equal(s.container.listeners.has('paste'),false);assert.deepEqual(s.calls,[]);e.dispose();
});

test('dispose cancels fitting, ignores stale observer callbacks and owns addon disposal once',()=>{
 const s=fixture(),e=s.adapter.terminalFactory({});e.open(s.container);const callback=s.observers[0].callback;e.dispose();e.dispose();callback();s.flush();assert.equal(s.frames.size,0);assert.deepEqual(s.calls,[]);assert.equal(s.observers[0].disconnected,1);assert.equal(s.terminals[0].disposed,1);assert.equal(s.fits[0].disposed,1);assert.equal(s.searches[0].disposed,1);
});
test('a second emulator requires disposal of the first instead of sharing its search or observer',()=>{
 const s=fixture(),e=s.adapter.terminalFactory({});assert.throws(()=>s.adapter.terminalFactory({}),/DISPLAY_ACTIVE/);e.dispose();const next=s.adapter.terminalFactory({});next.dispose();
});
test('failed open retires constructed addons and never leaves a searchable active instance',()=>{
 const s=fixture({throwOpen:true}),e=s.adapter.terminalFactory({});assert.throws(()=>e.open(s.container),/open failed/);assert.equal(s.terminals[0].disposed,1);assert.equal(s.fits[0].disposed,1);assert.equal(s.searches[0].disposed,1);assert.equal(s.adapter.search.findNext('found'),false);
});


test('observer setup failure and throwing disconnect still retire terminal and both loaded addons',()=>{
 const s=fixture({throwObserve:true,throwDisconnect:true}),e=s.adapter.terminalFactory({});assert.throws(()=>e.open(s.container),/observe failed/);assert.equal(s.terminals[0].disposed,1);assert.equal(s.fits[0].disposed,1);assert.equal(s.searches[0].disposed,1);assert.equal(s.adapter.search.findNext('found'),false);const next=s.adapter.terminalFactory({});next.dispose();
});

test('synchronous frame delivery does not strand fitting and retired callbacks cannot resize the next display',()=>{
 const dimensions={cols:100,rows:30},s=fixture({dimensions,syncFrame:true}),e=s.adapter.terminalFactory({});e.open(s.container);assert.deepEqual(s.calls,[['resize',100,30]]);dimensions.cols=120;s.observers[0].callback();assert.deepEqual(s.calls.at(-1),['resize',120,30]);const stale=s.observers[0].callback;e.dispose();const next=s.adapter.terminalFactory({});next.open(s.container);const before=s.calls.length;dimensions.cols=140;stale();assert.equal(s.calls.length,before);next.dispose();
});

test('terminal disposal callbacks cannot create a concurrent display while the retiring buffer is owned',()=>{
 let s,reentries=0;s=fixture({onDispose:()=>{assert.throws(()=>s.adapter.terminalFactory({}),/DISPLAY_ACTIVE/);reentries++;}});const e=s.adapter.terminalFactory({});e.open(s.container);e.dispose();assert.equal(reentries,1);const next=s.adapter.terminalFactory({});next.dispose();assert.equal(reentries,2);
});

test('real view composition defers fitted geometry until parsed replay ACK and search follows reattachment',async()=>{
 const {createTerminalView}=await import('../src/ui/terminal/view.js');const s=fixture({dimensions:{cols:140,rows:45}}),listeners={},calls=[];let op=0,generation=0;
 const session=id=>({sessionId:id,projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Project',state:'running',exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_a'});
 const bridge=Object.fromEntries(['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'].map(name=>['terminal'+name,p=>{calls.push({name,p});const value=name==='Attach'?{session:session(p.sessionId),leaseId:'lease_'+(++generation),generation,firstSequence:0,nextSequence:generation===1?1:0}:name==='Ack'?{acknowledged:true}:name==='Resize'?{resized:true}:name==='Detach'?{detached:true}:{};return Promise.resolve({ok:true,value,operationId:p.operationId});}]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=fn=>{listeners[name]=fn;return()=>delete listeners[name];};
 const view=createTerminalView({container:s.container,bridge,epoch:4,operationId:()=> 'adapter_'+(++op),...s.adapter});
 try{
  assert.equal((await view.attach('session_a')).ok,true);s.flush();assert.equal(calls.some(c=>c.name==='Resize'),false);
  listeners.Data({epoch:4,sessionId:'session_a',leaseId:'lease_1',generation:1,sequence:0,utf8Bytes:1,data:'x'});assert.equal(calls.some(c=>c.name==='Ack'),false);s.terminals[0].callbacks.shift()();for(let i=0;i<32;i++)await Promise.resolve();
  assert.deepEqual(calls.filter(c=>['Ack','Resize'].includes(c.name)).map(c=>c.name),['Ack','Resize']);assert.equal(calls.find(c=>c.name==='Resize').p.cols,140);assert.equal(view.find('found'),true);assert.equal(s.calls.at(-1)[2],s.terminals[0]);
  await view.detach();assert.equal(view.find('found'),false);assert.equal((await view.attach('session_b')).ok,true);assert.equal(view.find('found'),true);assert.equal(s.calls.at(-1)[2],s.terminals[1]);assert.equal(calls.some(c=>c.name==='Input'),false);
 }finally{view.dispose();await view.drain();}
});

// Permanent controls originating in the genuine independent lifecycle review.
function lifetimeFixture(hooks={}){
 const state={terms:[],observers:[],frames:[],calls:[],fits:[],searches:[],emulator:null};let frame=0;
 class Terminal{
  constructor(options){hooks.construct?.(state);this.options=options;this.cols=80;this.rows=24;this.addons=[];this.disposed=0;state.terms.push(this);}
  loadAddon(a){a.activate(this);this.addons.push(a);}
  open(){state.calls.push('open');}
  resize(cols,rows){state.calls.push(['resize',cols,rows]);this.cols=cols;this.rows=rows;}
  onData(){return{dispose(){}};}onResize(){return{dispose(){}};}
  write(_data,callback){state.calls.push('write');hooks.write?.(callback);}
  clear(){state.calls.push('clear');}
  dispose(){this.disposed++;for(const a of this.addons)a.dispose();}
 }
 class FitAddon{constructor(){this.disposed=0;state.fits.push(this);}activate(){hooks.fitActivate?.(state);}proposeDimensions(){state.calls.push('propose');return{cols:100,rows:30};}dispose(){this.disposed++;}}
 class SearchAddon{constructor(){this.disposed=0;state.searches.push(this);}activate(){}findNext(){return true;}dispose(){this.disposed++;}}
 class Observer{constructor(callback){this.callback=callback;this.disconnected=0;state.observers.push(this);hooks.observerConstruct?.(state);}observe(){state.calls.push('observe');}disconnect(){this.disconnected++;}}
 const adapter=createXtermAdapter({Terminal,FitAddon,SearchAddon,ResizeObserver:Observer,requestFrame:callback=>{hooks.schedule?.(state);const id=++frame;state.frames.push({id,callback});return id;},cancelFrame:id=>{state.calls.push(['cancel',id]);hooks.cancel?.(state);}});
 const container={getBoundingClientRect(){hooks.rect?.(state);return{width:800,height:400};},addEventListener(){throw Error('Unexpected DOM listener');}};
 return{...state,state,adapter,container,make(){state.emulator=adapter.terminalFactory();return state.emulator;},flush(){const pending=state.frames.splice(0);for(const f of pending)f.callback();}};
}

test('maintained adverse: observer construction retirement cannot leave a newly returned observer retained',()=>{
 const f=lifetimeFixture({observerConstruct(s){s.emulator.dispose();}}),e=f.make();
 assert.throws(()=>e.open(f.container),/DISPLAY_INACTIVE/);
 assert.equal(f.state.observers[0].disconnected,1,'late observer must be disconnected after constructor reenters disposal');
 assert.equal(f.state.calls.includes('observe'),false,'retired open must not start observation');
 assert.equal(f.state.terms[0].disposed,1);
});

test('maintained adverse: addon activation retirement cannot reopen or load a later addon on disposed terminal',()=>{
 const f=lifetimeFixture({fitActivate(s){s.emulator.dispose();}}),e=f.make();
 assert.throws(()=>e.open(f.container),/DISPLAY_INACTIVE/);
 assert.equal(f.state.calls.includes('open'),false,'disposed terminal must not be reopened');
 assert.equal(f.state.searches.length,0,'later search addon must not be created after retirement');
 assert.equal(f.state.fits[0].disposed,1,'addon activation that retired display must still release its addon');
});

test('maintained adverse: retirement during layout read cannot call a disposed fit addon',()=>{
 const f=lifetimeFixture({rect(s){s.emulator.dispose();}}),e=f.make();e.open(f.container);f.flush();
 assert.equal(f.state.calls.includes('propose'),false,'layout callback retired the display before proposing dimensions');
 assert.equal(f.state.calls.some(x=>Array.isArray(x)&&x[0]==='resize'),false);
 assert.equal(f.state.terms[0].disposed,1);
});
