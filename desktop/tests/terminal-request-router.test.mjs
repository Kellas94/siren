import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';

const {TerminalRequestRouter}=await import('../src/terminal/request-router.mjs').catch(error=>{
  if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};
});
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const mapping=Object.freeze({terminalPickCwd:'pickCwd',terminalListProfiles:'listProfiles',terminalCreate:'create',terminalList:'list',terminalAttach:'attach',terminalInput:'input',terminalResize:'resize',terminalAck:'ack',terminalDetach:'detach',terminalStop:'stop'});
const payload=(method,extra={})=>({operationId:'op1',epoch:3,...({
  terminalCreate:{cwdId:'cwd1',profileId:'powershell',cols:80,rows:25},terminalAttach:{sessionId:'session1'},
  terminalInput:{sessionId:'session1',leaseId:'lease1',generation:1,inputSequence:0,data:'Ω😀\r'},
  terminalResize:{sessionId:'session1',leaseId:'lease1',generation:1,cols:80,rows:25},
  terminalAck:{sessionId:'session1',leaseId:'lease1',generation:1,throughSequence:0},
  terminalDetach:{sessionId:'session1',leaseId:'lease1',generation:1},terminalStop:{sessionId:'session1'},
})[method],...extra});

function fixture(options={}){
  assert.equal(typeof TerminalRequestRouter,'function','TerminalRequestRouter implementation required');
  const state={epoch:3,projectId:'project1',role:'terminal',generation:0,current:true,captures:0,guardHook:null};
  const sender={},frame={},event={sender,senderFrame:frame},captured=new WeakSet(),calls=[];
  const registry={
    capture(event){state.captures++;if(!state.current||event.sender!==sender||event.senderFrame!==frame)return null;
      const grant=Object.freeze({webContentsId:1,mainFrameUrl:'siren://app/windows/terminal.html?windowId=window1',windowId:'window1',projectId:state.projectId,epoch:state.epoch,role:state.role,entityIds:Object.freeze([])});captured.add(grant);return grant;},
    isCurrent(grant){return state.current&&captured.has(grant)&&grant.epoch===state.epoch&&grant.projectId===state.projectId&&grant.role===state.role;},
    captureAdmissionGuard(grant){const generation=state.generation;return {isCurrent(){state.guardHook?.();return registry.isCurrent(grant)&&generation===state.generation;}};},
  };
  const manager=Object.fromEntries(Object.values(mapping).map(method=>[method,(grant,input)=>{calls.push({method,grant,input});return {ok:true,operationId:input.operationId,value:{method}};} ]));
  Object.assign(manager,options.manager);
  const router=new TerminalRequestRouter({registry,manager,...options.router});
  const route=(method='terminalList',input=payload(method),ownEvent=event)=>router.route({event:ownEvent,method,payload:input});
  return {router,registry,manager,state,event,sender,frame,calls,route};
}

test('router has exactly the ten approved manager routes and copies immutable request data',async()=>{
  const f=fixture();for(const [name,target] of Object.entries(mapping)){
    const input=payload(name),result=await f.route(name,input);assert.equal(result.ok,true);assert.equal(f.calls.at(-1).method,target);
    assert.notEqual(f.calls.at(-1).input,input);assert.equal(Object.isFrozen(f.calls.at(-1).input),true);assert.equal(Object.getPrototypeOf(f.calls.at(-1).input),null);
  }
  assert.equal(f.calls.length,10);assert.equal(f.router.stats().pending,0);
});
test('fresh native captures reuse the retained canonical grant required by manager attachment leases',async()=>{
  const f=fixture();await f.route('terminalAttach');const attachmentGrant=f.calls.at(-1).grant;
  await f.route('terminalInput');assert.equal(f.calls.at(-1).grant,attachmentGrant);assert.equal(f.state.captures,2);assert.equal(f.router.stats().callers,1);
});
test('unknown routes additional fields prototype objects accessors and proxies never dispatch or evaluate payload getters',async()=>{
  const f=fixture();let reads=0;const getter={operationId:'op1',epoch:3};Object.defineProperty(getter,'extra',{enumerable:true,get(){reads++;return 'secret';}});
  const proxy=new Proxy(payload('terminalList'),{getPrototypeOf(){reads++;return Object.prototype;},ownKeys(){reads++;return ['operationId','epoch'];}});
  for(const [method,input] of [['spawn',payload('terminalList')],['__proto__',payload('terminalList')],['terminalList',{...payload('terminalList'),projectId:'foreign'}],['terminalCreate',{...payload('terminalCreate'),command:'run'}],['terminalList',Object.assign(Object.create({}),payload('terminalList'))],['terminalList',getter],['terminalList',proxy]]){
    assert.equal((await f.route(method,input)).code,'REQUEST_REFUSED');
  }
  assert.equal(reads,0);assert.equal(f.calls.length,0);assert.equal(f.state.captures,0);
});
test('native sender and main frame are pinned without using renderer project role or URL fields',async()=>{
  const f=fixture();for(const event of [{sender:{},senderFrame:f.frame},{sender:f.sender,senderFrame:{}},{sender:{url:f.state.url,role:'terminal',projectId:'project1'},senderFrame:f.frame}]){
    assert.equal((await f.route('terminalList',payload('terminalList'),event)).code,'SENDER_REFUSED');
  }assert.equal(f.calls.length,0);
});
test('only native workspace and terminal roles enter manager policy; other roles and stale epochs refuse',async()=>{
  const f=fixture();for(const role of ['code','docs','diagram','presenter','audience']){f.state.role=role;assert.equal((await f.route()).code,'SENDER_REFUSED');}
  f.state.role='workspace';assert.equal((await f.route()).ok,true);f.state.role='terminal';assert.equal((await f.route('terminalList',payload('terminalList',{epoch:4}))).code,'EPOCH_STALE');assert.equal(f.calls.length,1);
});
test('manager PIN readonly and session-policy refusals remain authoritative',async()=>{
  for(const code of ['PIN_REQUIRED','READONLY','SESSION_REFUSED','LEASE_STALE']){const f=fixture({manager:{list:(_grant,p)=>({ok:false,operationId:p.operationId,code,message:code})}});assert.equal((await f.route()).code,code);}
});
test('native admission loss during awaited provider suppresses result and retains the pending slot until settlement',async()=>{
  const wait=deferred(),f=fixture({manager:{list:()=>wait.promise}});const pending=f.route();assert.equal(f.router.stats().pending,1);
  f.state.generation++;assert.equal(f.router.stats().pending,1);wait.resolve({ok:true,value:'PRIVATE_RESULT'});assert.equal((await pending).code,'SENDER_REFUSED');assert.equal(f.router.stats().pending,0);
});
test('caller project or epoch change during await never discloses the completed result',async()=>{
  for(const change of [s=>{s.projectId='project2';},s=>{s.epoch=4;},s=>{s.current=false;}]){
    const wait=deferred(),f=fixture({manager:{list:()=>wait.promise}});const pending=f.route();change(f.state);wait.resolve({ok:true,value:'PRIVATE_RESULT'});assert.equal((await pending).code,'SENDER_REFUSED');
  }
});
test('mutation of the source IPC event after capture cannot replace its native pinned references',async()=>{
  const wait=deferred(),f=fixture({manager:{list:()=>wait.promise}}),pending=f.route();f.event.sender={};f.event.senderFrame={};wait.resolve({ok:true,value:'native completion'});assert.equal((await pending).ok,true);
});
test('per caller concurrency refuses overflow and settles only the actual outstanding provider',async()=>{
  const waits=[deferred(),deferred()];let index=0;const f=fixture({router:{maxPending:2,maxPendingPerCaller:1},manager:{list:()=>waits[index++].promise}});
  const first=f.route();assert.equal((await f.route()).code,'CAPACITY_EXCEEDED');assert.equal(index,1);assert.equal(f.router.stats().pending,1);
  waits[0].resolve({ok:true});await first;const second=f.route();assert.equal(f.router.stats().pending,1);waits[1].resolve({ok:true});await second;assert.equal(f.router.stats().pending,0);
});
test('revoke synchronously refuses future routes and stale results without Stop kill or releasing unresolved slots',async()=>{
  const wait=deferred(),f=fixture({manager:{list:()=>wait.promise,stop:()=>assert.fail('Lock cannot Stop')}}),pending=f.route();f.router.revoke();
  assert.equal(f.router.stats().revoked,true);assert.equal(f.router.stats().pending,1);assert.equal((await f.route()).code,'SENDER_REFUSED');assert.equal(f.router.stats().pending,1);
  wait.resolve({ok:true,value:'PRIVATE_RESULT'});assert.equal((await pending).code,'SENDER_REFUSED');assert.equal(f.router.stats().pending,0);assert.equal(f.router.stats().callers,0);
});
test('dispose is irreversible and keeps actual outstanding capacity until settlement',async()=>{
  const wait=deferred(),f=fixture({manager:{list:()=>wait.promise}}),pending=f.route();f.router.dispose();f.router.revoke();assert.equal(f.router.stats().disposed,true);assert.equal(f.router.stats().pending,1);assert.equal((await f.route()).code,'SENDER_REFUSED');wait.reject(Error('PRIVATE_SECRET'));assert.equal((await pending).code,'SENDER_REFUSED');assert.equal(f.router.stats().pending,0);
});
test('reentrant native authorization cannot revoke the router and still dispatch a provider',async()=>{
  const f=fixture();f.state.guardHook=()=>f.router.revoke();assert.equal((await f.route()).code,'SENDER_REFUSED');assert.equal(f.calls.length,0);
});
test('provider exceptions redact details and release occupied slots after actual rejection',async()=>{
  const f=fixture({router:{maxPending:1,maxPendingPerCaller:1},manager:{list:()=>{throw Error('PRIVATE_SECRET');}}});const r=await f.route();assert.equal(r.code,'HOST_UNAVAILABLE');assert.equal(JSON.stringify(r).includes('PRIVATE_SECRET'),false);assert.equal(f.router.stats().pending,0);assert.equal((await f.route()).code,'HOST_UNAVAILABLE');
});
test('unconfigured or missing native proof refuses and manager method getters are not evaluated',async()=>{
  fixture();let reads=0;const manager={};Object.defineProperty(manager,'list',{get(){reads++;return ()=>assert.fail('getter dispatch');}});
  assert.equal((await new TerminalRequestRouter().route({event:{},method:'terminalList',payload:payload('terminalList')})).ok,false);
  const guarded=fixture({router:{manager}});assert.equal((await guarded.route()).code,'HOST_UNAVAILABLE');
  for(const value of [undefined,()=>1,()=>Promise.resolve(true),()=>{throw Error('PRIVATE');}]){
    const f=fixture(),registry={...f.registry,isCurrent:value},router=new TerminalRequestRouter({registry,manager:f.manager});
    assert.equal((await router.route({event:f.event,method:'terminalList',payload:payload('terminalList')})).ok,false);assert.equal(f.calls.length,0);
  }assert.equal(reads,0);
});

class NativeWindow extends EventEmitter{
  constructor(id,url){super();this.id=id;this.destroyed=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:id+1000,mainFrame:{url},getURL:()=>this.webContents.mainFrame.url,isDestroyed:()=>this.destroyed});}
  isDestroyed(){return this.destroyed;}isMinimized(){return false;}restore(){}focus(){}destroy(){this.destroyed=true;this.webContents.emit('destroyed');this.emit('closed');}close(){this.destroy();}
}
async function nativeFixture(options={}){
  assert.equal(typeof TerminalRequestRouter,'function');let next=0;const windows=[];
  const registry=new WindowRegistry({authorize:()=>({projectId:'project1',mode:'normal',access:'write',entityIds:[]}),createWindow:input=>{const window=new NativeWindow(++next,input.mainFrameUrl);windows.push(window);return window;}});
  const calls=[],manager={list:(grant,input)=>{calls.push({grant,input});return {ok:true,value:[]};},...options.manager};
  const router=new TerminalRequestRouter({registry,manager,...options.router});
  const open=async()=>{await registry.openView({role:'workspace',entityId:null});const w=windows.at(-1);return {sender:w.webContents,senderFrame:w.webContents.mainFrame};};
  const route=event=>router.route({event,method:'terminalList',payload:payload('terminalList',{epoch:1})});return {registry,router,open,route,calls};
}
test('actual pure WindowRegistry workspace captures route and retain canonical authority without admitting terminal role',async()=>{
  const f=await nativeFixture(),event=await f.open();assert.equal((await f.route(event)).ok,true);assert.equal((await f.route(event)).ok,true);assert.equal(f.calls[0].grant,f.calls[1].grant);assert.equal(f.registry.isCurrent(f.calls[0].grant),true);
  assert.equal((await f.route({sender:{...event.sender},senderFrame:event.senderFrame})).code,'SENDER_REFUSED');
  await assert.rejects(()=>f.registry.openView({role:'terminal',entityId:'session1'}));
});
test('actual registry freeze then rollback cannot revive a queued router result or release its pending accounting early',async()=>{
  const wait=deferred(),f=await nativeFixture({manager:{list:()=>wait.promise}}),event=await f.open(),pending=f.route(event);
  const proof=f.registry.freezeRoster();assert.equal(f.registry.releaseRoster(proof),true);assert.equal(f.router.stats().pending,1);
  wait.resolve({ok:true,value:'PRIVATE_RESULT'});assert.equal((await pending).code,'SENDER_REFUSED');assert.equal(f.router.stats().pending,0);
});
test('global pending and caller-cache capacity remain bounded across distinct native callers',async()=>{
  const waits=[deferred(),deferred()];let count=0;const f=await nativeFixture({router:{maxPending:1,maxPendingPerCaller:1,maxCallers:2},manager:{list:()=>waits[count++].promise}}),a=await f.open(),b=await f.open();
  const first=f.route(a);assert.equal((await f.route(b)).code,'CAPACITY_EXCEEDED');assert.equal(count,1);waits[0].resolve({ok:true});await first;const second=f.route(b);waits[1].resolve({ok:true});await second;
  assert.equal(f.router.stats().callers,2);const c=await f.open();assert.equal((await f.route(c)).code,'CAPACITY_EXCEEDED');assert.equal(f.router.stats().callers,2);
});
test('stale idle cached callers may retire while pending old identities cannot be replaced',async()=>{
  const f=await nativeFixture({router:{maxCallers:1}}),a=await f.open();await f.route(a);a.sender.emit('destroyed');const b=await f.open();assert.equal((await f.route(b)).ok,true);assert.equal(f.router.stats().callers,1);
  const wait=deferred(),g=fixture({manager:{list:()=>wait.promise}}),pending=g.route();g.state.epoch=4;
  assert.equal((await g.route('terminalList',payload('terminalList',{epoch:4}))).code,'SENDER_REFUSED');assert.equal(g.router.stats().pending,1);wait.resolve({ok:true});await pending;
});
test('configured capacity limits reject unbounded or malformed constructor values',()=>{
  fixture();for(const router of [{maxPending:0},{maxPending:65},{maxPendingPerCaller:0},{maxPendingPerCaller:9},{maxCallers:0},{maxCallers:65}])assert.throws(()=>new TerminalRequestRouter(router),TypeError);
});
