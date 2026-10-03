import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
const module=await import('../src/windows/control.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('native Code view control exists',()=>assert.equal(typeof module.NativeCodeControl,'function'));
const check=(name,fn)=>test(name,{skip:!module.NativeCodeControl},fn);
async function fixture(t,{deadline=50,seal}={}) {
  const windows=[];const registry=new WindowRegistry({authorize:()=>({projectId:'owned',mode:'normal',access:'write',entityIds:['a','b']}),createWindow:async options=>{
    const window=new EventEmitter();window.destroyed=false;window.webContents=new EventEmitter();
    Object.assign(window.webContents,{id:windows.length+100,mainFrame:{url:options.mainFrameUrl},getURL:()=>options.mainFrameUrl,isDestroyed:()=>window.destroyed});
    Object.assign(window,{id:windows.length+1,isDestroyed:()=>window.destroyed,isMinimized:()=>false,restore(){},focus(){},close(){this.destroy();},destroy(){window.destroyed=true;window.webContents.emit('destroyed');window.emit('closed');}});windows.push(window);return window;
  }});await registry.openView({role:'code',entityId:'a'});await registry.openView({role:'code',entityId:'b'});
  const events=windows.map(w=>({sender:w.webContents,senderFrame:w.webContents.mainFrame})),grants=events.map(e=>registry.capture(e));
  let serial=0;const sent=[],cancelled=[],issued=[],sealed=[];
  const owner={beginViewFlush:g=>{issued.push(g);return 'nonce-'+(++serial);},cancelViewFlush:(g,nonce)=>{cancelled.push({g,nonce});return {ok:true};},finishViewFlush:async(g,nonce)=>{sealed.push({g,nonce});return seal?seal():{ok:true,receipts:[{ok:true,durability:'committed'}]};}};
  const control=new module.NativeCodeControl({registry,owner,timeoutMs:deadline,send:(event,request)=>sent.push({event,request})});t.after(()=>control.dispose());
  return {control,registry,windows,events,grants,sent,cancelled,issued,sealed};
}
check('native seal rather than a renderer supplied receipt establishes flush success',async t=>{
  const f=await fixture(t);const pending=f.control.flushView(f.grants[0]);assert.equal(f.sent.length,1);const request=f.sent[0].request;
  assert.equal(typeof request.requestId,'string');assert.equal(request.nonce,'nonce-1');
  assert.equal((await f.control.acknowledge(f.events[0],{requestId:request.requestId,ok:true,receipts:[{ok:true}]})).code,'REQUEST_REFUSED');
  assert.equal(f.sealed.length,0);
  assert.equal((await f.control.acknowledge(f.events[1],{requestId:request.requestId,ok:true})).code,'ACCESS_REFUSED');
  assert.equal((await f.control.acknowledge(f.events[0],{requestId:request.requestId,ok:true})).ok,true);
  assert.equal((await pending).ok,true);assert.equal(f.sealed.length,1);assert.equal(f.cancelled.length,0);
  assert.equal((await f.control.acknowledge(f.events[0],{requestId:request.requestId,ok:true})).code,'CONTROL_STALE');
});
check('unresponsive view reaches a native deadline and late acknowledgements cannot become success',async t=>{
  const f=await fixture(t,{deadline:15});const pending=f.control.flushView(f.grants[0]),request=f.sent[0].request;
  assert.equal((await pending).code,'VIEW_TIMEOUT');assert.equal(f.cancelled.length,1);assert.equal(f.sealed.length,0);
  assert.equal((await f.control.acknowledge(f.events[0],{requestId:request.requestId,ok:true})).code,'CONTROL_STALE');
});
check('actual frame destruction refuses pending preparation and cancels its finite allowance',async t=>{
  const f=await fixture(t);const pending=f.control.flushView(f.grants[0]);f.windows[0].destroy();
  assert.equal((await pending).code,'VIEW_RETIRED');assert.equal(f.cancelled.length,1);assert.equal(f.sealed.length,0);
});
check('one view is not prepared twice and independent views have independent acknowledgements',async t=>{
  const f=await fixture(t);const first=f.control.flushView(f.grants[0]);assert.equal((await f.control.flushView(f.grants[0])).code,'VIEW_BUSY');
  const second=f.control.flushView(f.grants[1]);const [a,b]=f.sent.map(x=>x.request);
  await f.control.acknowledge(f.events[1],{requestId:b.requestId,ok:false,code:'REVISION_CONFLICT'});assert.equal((await second).code,'VIEW_FLUSH_FAILED');
  await f.control.acknowledge(f.events[0],{requestId:a.requestId,ok:true});assert.equal((await first).ok,true);assert.equal(f.cancelled.length,1);
});
check('deadline covers the native seal and never publishes its delayed success',async t=>{
  let release;const gate=new Promise(resolve=>{release=resolve;});const f=await fixture(t,{deadline:15,seal:()=>gate});
  const pending=f.control.flushView(f.grants[0]),request=f.sent[0].request;
  const ack=f.control.acknowledge(f.events[0],{requestId:request.requestId,ok:true});
  assert.equal((await pending).code,'VIEW_TIMEOUT');assert.equal(f.cancelled.length,1);release({ok:true,receipts:[]});
  assert.equal((await ack).code,'CONTROL_STALE');
});
check('disposing control refuses every outstanding request and never records a clean close',async t=>{
  const f=await fixture(t);const a=f.control.flushView(f.grants[0]),b=f.control.flushView(f.grants[1]);f.control.dispose();
  assert.equal((await a).code,'CONTROL_DISPOSED');assert.equal((await b).code,'CONTROL_DISPOSED');assert.equal(f.cancelled.length,2);
  assert.equal((await f.control.flushView(f.grants[0])).code,'CONTROL_DISPOSED');assert.equal(f.sealed.length,0);
});
