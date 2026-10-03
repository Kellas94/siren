import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { WindowRegistry } from '../src/windows/registry.mjs';

const module = await import('../src/windows/ipc.mjs').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const invoke = args => {
  assert.equal(typeof module.invokeWindow, 'function', 'invokeWindow must exist');
  return module.invokeWindow(args);
};

class NativeWindow extends EventEmitter {
  constructor(id, url) {
    super(); Object.assign(this,{id,destroyed:false,minimized:false,focused:false,cancelClose:false});
    this.webContents = new EventEmitter();
    Object.assign(this.webContents,{id:id+100,mainFrame:{url},isDestroyed:()=>this.destroyed,getURL:()=>this.webContents.mainFrame.url});
  }
  isDestroyed(){return this.destroyed;}
  isMinimized(){return this.minimized;}
  restore(){this.minimized=false;}
  focus(){this.focused=true;}
  close(){if(!this.cancelClose)this.destroy();else this.emit('close',{defaultPrevented:true});}
  destroy(){this.destroyed=true;this.webContents.emit('destroyed');this.emit('closed');}
}
const eventFor = window => ({sender:window.webContents,senderFrame:window.webContents.mainFrame});
async function setup(closeTimeoutMs = 10000) {
  const windows=[],options=[];
  const native={projectId:'project_a',mode:'normal',entityIds:['doc_a','code_a','deck_a']};
  let pending;
  const registry=new WindowRegistry({
    closeTimeoutMs,
    authorize:request=>({...native,access:request.role==='audience'?'presentation':'read'}),
    createWindow:async spec=>{
      options.push(spec);const window=new NativeWindow(windows.length+1,spec.mainFrameUrl);windows.push(window);
      if(pending){const gate=pending;pending=undefined;await gate;}
      return window;
    },
  });
  const workspace=await registry.openView({role:'workspace',entityId:null});
  return {registry,native,windows,options,workspace,event:eventFor(windows[0]),deferNext:()=>{let resolve;pending=new Promise(r=>{resolve=r;});return resolve;}};
}
const denied=async(args,code)=>assert.equal((await invoke(args)).code,code);
const call=(s,method,payload,event=s.event)=>invoke({event,method,payload,registry:s.registry});

test('required window IPC implementation exists',()=>assert.equal(typeof module.invokeWindow,'function'));
const feature=(name,fn)=>test(name,{skip:!module.invokeWindow},fn);
feature('getView returns only the native caller grant despite forged event identity',async()=>{
  const s=await setup();const event={...s.event,role:'audience',projectId:'other',epoch:90,windowId:'forged'};
  assert.deepEqual(await call(s,'getView',{},event),{ok:true,view:s.registry.caller(s.event)});
});
feature('missing, unregistered, forged-object and subframe senders are refused',async()=>{
  const s=await setup();const fake=new NativeWindow(s.windows[0].id,s.event.sender.getURL());
  for(const event of [undefined,null,{},eventFor(fake),{sender:{id:s.event.sender.id},senderFrame:s.event.senderFrame},{sender:s.event.sender,senderFrame:{url:s.event.senderFrame.url}}]) {
    await denied({event,method:'getView',payload:{},registry:s.registry},'SENDER_REFUSED');
  }
});
feature('exact payloads reject unknown keys, symbols, prototypes, accessors and identity fields',async()=>{
  const s=await setup();let getterCalls=0;
  for(const payload of [{role:'workspace'},[],1,'empty',{epoch:1},{[Symbol('hidden')]:true},Object.create({role:'workspace'}),{get role(){getterCalls++;throw new Error('getter');}}]) await denied({event:s.event,method:'getView',payload,registry:s.registry},'REQUEST_REFUSED');
  for(const field of ['projectId','epoch','windowId','notes','source','access']) await denied({event:s.event,method:'openView',payload:{role:'docs',entityId:'doc_a',[field]:'forged'},registry:s.registry},'REQUEST_REFUSED');
  assert.equal(getterCalls,0);assert.equal(s.windows.length,1);
  for(const method of ['readSource','getProject','__proto__',undefined]) await denied({event:s.event,method,payload:{},registry:s.registry},'REQUEST_REFUSED');
});
feature('empty requests accept omitted, null and empty-object payloads only',async()=>{
  const s=await setup();for(const payload of [undefined,null,{}]) assert.equal((await call(s,'getView',payload)).ok,true);
});
feature('workspace opens only Code and Docs with exact nonnegative version',async()=>{
  const s=await setup();const docs=await call(s,'openView',{role:'docs',entityId:'doc_a',version:0});const code=await call(s,'openView',{role:'code',entityId:'code_a',version:7});
  assert.equal(docs.ok,true);assert.equal(docs.view.role,'docs');assert.equal(code.ok,true);assert.equal(s.options[2].version,7);
  for(const role of ['workspace','presenter','audience']) assert.equal((await call(s,'openView',{role,entityId:'deck_a'})).code,'ACCESS_REFUSED');
  for(const version of [-1,1.5,'7',NaN,Infinity,Number.MAX_SAFE_INTEGER+1,null]) assert.equal((await call(s,'openView',{role:'docs',entityId:'doc_a',version})).code,'REQUEST_REFUSED');
  assert.equal(s.windows.length,3);
});
feature('foreign entity requests and every satellite opening or global listing are refused',async()=>{
  const s=await setup();assert.equal((await call(s,'openView',{role:'docs',entityId:'doc_foreign'})).code,'ACCESS_REFUSED');
  for(const role of ['docs','code','presenter','audience']) {
    await s.registry.openView({role,entityId:role==='docs'?'doc_a':role==='code'?'code_a':'deck_a'});
    const event=eventFor(s.windows.at(-1));assert.equal((await call(s,'openView',{role:'docs',entityId:'doc_a'},event)).code,'ACCESS_REFUSED');assert.equal((await call(s,'listViews',{},event)).code,'ACCESS_REFUSED');
  }
});
feature('Audience gets its grant with empty entityIds and no project, notes or source content',async()=>{
  const s=await setup();await s.registry.openView({role:'audience',entityId:'deck_a'});const result=await call(s,'getView',{},eventFor(s.windows.at(-1)));
  assert.equal(result.ok,true);assert.deepEqual(result.view.entityIds,[]);
  assert.deepEqual(Object.keys(result.view).sort(),['entityIds','epoch','mainFrameUrl','projectId','role','webContentsId','windowId']);
  for(const method of ['readSource','readNotes','getProject']) assert.equal((await call(s,method,{},eventFor(s.windows.at(-1)))).code,'REQUEST_REFUSED');
});
feature('listViews filters project and epoch and strips non-record data',async()=>{
  const s=await setup();const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});const original=s.registry.listViews.bind(s.registry);
  s.registry.listViews=()=>[...original().map(record=>({...record,notes:'private',source:'private',nativeHandle:{}})),{...doc,windowId:'foreign',projectId:'project_b'},{...doc,windowId:'old_epoch',epoch:0}];
  const result=await call(s,'listViews',{});assert.equal(result.ok,true);assert.equal(result.views.length,2);assert.deepEqual(result.views,original());
});
feature('workspace focuses and closes scoped satellites but cannot close workspace',async()=>{
  const s=await setup();const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});s.windows[1].minimized=true;
  assert.deepEqual(await call(s,'focusView',{windowId:doc.windowId}),{ok:true,focused:true});assert.equal(s.windows[1].minimized,false);assert.equal(s.windows[1].focused,true);
  assert.equal((await call(s,'closeView',{windowId:s.workspace.windowId})).code,'ACCESS_REFUSED');assert.equal(s.windows[0].destroyed,false);
  assert.deepEqual(await call(s,'closeView',{windowId:doc.windowId}),{ok:true,closed:true});assert.equal(s.windows[1].destroyed,true);
});
feature('satellites focus and close only themselves with no global shelf grant',async()=>{
  const s=await setup();const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});const code=await s.registry.openView({role:'code',entityId:'code_a'});const event=eventFor(s.windows[1]);
  for(const method of ['focusView','closeView']) assert.equal((await call(s,method,{windowId:code.windowId},event)).code,'ACCESS_REFUSED');
  assert.deepEqual(await call(s,'focusView',{windowId:doc.windowId},event),{ok:true,focused:true});assert.deepEqual(await call(s,'closeView',{windowId:doc.windowId},event),{ok:true,closed:true});
  assert.equal(s.windows[2].destroyed,false);
});
feature('foreign project, epoch and unknown targets refuse before native actions',async()=>{
  const s=await setup();const original=s.registry.listViews.bind(s.registry);let calls=0;s.registry.focusView=()=>{calls++;return true;};s.registry.closeView=()=>{calls++;return true;};
  for(const record of [{...s.workspace,windowId:'foreign',projectId:'other',role:'docs'},{...s.workspace,windowId:'foreign',epoch:2,role:'docs'}]) {
    s.registry.listViews=()=>[...original(),record];for(const method of ['focusView','closeView']) assert.equal((await call(s,method,{windowId:'foreign'})).code,'VIEW_REFUSED');
  }
  for(const method of ['focusView','closeView']) assert.equal((await call(s,method,{windowId:'unknown'})).code,'VIEW_REFUSED');assert.equal(calls,0);
});
feature('canceled close stays registered and never reports successful close',async()=>{
  const s=await setup();const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});s.windows[1].cancelClose=true;
  assert.equal((await call(s,'closeView',{windowId:doc.windowId})).code,'CANCELLED');assert.equal(s.windows[1].destroyed,false);assert.equal(s.registry.listViews().length,2);
});

feature('workspace and satellite self-close acknowledge actual asynchronous native closure',async()=>{
  for(const self of [false,true]) {
    const s=await setup();const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});
    s.windows[1].close=()=>s.windows[1].emit('close',{defaultPrevented:false});
    const event=self?eventFor(s.windows[1]):s.event;
    const pending=call(s,'closeView',{windowId:doc.windowId},event);
    await Promise.resolve();s.windows[1].destroy();
    assert.deepEqual(await pending,{ok:true,closed:true});
  }
});

feature('asynchronous self-close cannot acknowledge a changed access epoch, project or sender',async()=>{
  for(const mutate of [s=>s.registry.invalidateEpoch(),s=>{s.native.projectId='other';},(_s,event)=>{event.senderFrame={url:event.senderFrame.url};}]) {
    const s=await setup();const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});
    s.windows[1].close=()=>s.windows[1].emit('close',{defaultPrevented:false});
    const event=eventFor(s.windows[1]);const pending=call(s,'closeView',{windowId:doc.windowId},event);
    await Promise.resolve();mutate(s,event);if(!s.windows[1].isDestroyed())s.windows[1].destroy();
    assert.equal((await pending).code,'SENDER_REFUSED');
  }
});

feature('self-close revalidates native scope at the final IPC continuation',async()=>{
  for(const mutate of [s=>s.registry.invalidateEpoch(),s=>{s.native.projectId='other';},s=>{s.native.mode='readonly';},
    s=>{s.native.entityIds=[];},(_s,event)=>{event.sender={id:event.sender.id};},(_s,event)=>{event.senderFrame={url:event.senderFrame.url};}]) {
    const s=await setup();const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});
    s.windows[1].close=()=>s.windows[1].emit('close',{defaultPrevented:false});
    const event=eventFor(s.windows[1]);const pending=call(s,'closeView',{windowId:doc.windowId},event);
    s.windows[1].destroy();queueMicrotask(()=>mutate(s,event));
    assert.equal((await pending).code,'SENDER_REFUSED');
  }
});

feature('navigation and crash disposal never count as an intentional pending self-close',async()=>{
  for(const signal of ['will-navigate','render-process-gone']) {
    const s=await setup();const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});
    s.windows[1].close=()=>s.windows[1].emit('close',{defaultPrevented:false});
    const pending=call(s,'closeView',{windowId:doc.windowId},eventFor(s.windows[1]));
    s.windows[1].webContents.emit(signal,{}, {reason:'crashed'});
    assert.equal((await pending).code,'SENDER_REFUSED');assert.equal(s.windows[1].isDestroyed(),true);
  }
});

feature('native close deadline reports unknown completion separately from cancellation',async()=>{
  const s=await setup(15);const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});
  s.windows[1].close=()=>s.windows[1].emit('close',{defaultPrevented:false});
  assert.equal((await call(s,'closeView',{windowId:doc.windowId})).code,'WINDOW_CLOSE_TIMEOUT');
  assert.equal(s.windows[1].isDestroyed(),false);
  assert.equal(s.registry.caller(eventFor(s.windows[1])).windowId,doc.windowId);
});

feature('renderer unload veto cancels close while an overridden veto waits for native closed',async()=>{
  for(const overridden of [false,true]) {
    const s=await setup();const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});
    s.windows[1].close=()=>{s.windows[1].emit('close',{defaultPrevented:false});s.windows[1].webContents.emit('will-prevent-unload',{defaultPrevented:overridden});};
    const pending=call(s,'closeView',{windowId:doc.windowId});
    await Promise.resolve();if(overridden)s.windows[1].destroy();
    const receipt=await pending;
    if(overridden)assert.deepEqual(receipt,{ok:true,closed:true});
    else {assert.equal(receipt.code,'CANCELLED');assert.equal(s.windows[1].isDestroyed(),false);}
    assert.equal(s.windows[1].listenerCount('close'),0);assert.equal(s.windows[1].webContents.listenerCount('will-prevent-unload'),0);
  }
});
feature('open caller revocation discards the newly registered view even when close is canceled',async()=>{
  const s=await setup();const release=s.deferNext();const pending=call(s,'openView',{role:'docs',entityId:'doc_a'});s.windows[1].cancelClose=true;s.windows[0].destroy();release();
  assert.equal((await pending).code,'SENDER_REFUSED');assert.equal(s.windows[1].destroyed,true);assert.equal(s.registry.listViews().length,0);
});
feature('late open caller revocation and failed disposal report sanitized destruction failure',async()=>{
  const s=await setup();const release=s.deferNext();const pending=call(s,'openView',{role:'docs',entityId:'doc_a'});s.windows[1].destroy=()=>{throw new Error('secret path');};s.windows[0].destroy();release();
  assert.deepEqual(await pending,{ok:false,code:'WINDOW_DESTROY_FAILED',message:'Native window destruction incomplete'});
});
feature('project and epoch revocation while open is pending refuse without publishing a grant',async()=>{
  for(const mutation of [s=>{s.native.projectId='project_b';},s=>{s.registry.invalidateEpoch();}]) {
    const s=await setup();const release=s.deferNext();const pending=call(s,'openView',{role:'code',entityId:'code_a'});mutation(s);release();assert.equal((await pending).ok,false);assert.equal(s.windows[1].destroyed,true);
  }
});
feature('async metadata reads recheck native caller object and frame after awaiting',async()=>{
  for(const mutation of [s=>{s.windows[0].destroy();},s=>{s.event.sender={id:s.event.sender.id};},s=>{s.event.senderFrame={url:s.event.senderFrame.url};},s=>{s.native.projectId='other';}]) {
    const s=await setup();let resolve;const old=s.registry.listViews();s.registry.listViews=()=>new Promise(r=>{resolve=r;});const pending=call(s,'listViews',{});mutation(s);resolve(old);assert.equal((await pending).code,'SENDER_REFUSED');
  }
});
feature('async target lookup rechecks caller before executing focus',async()=>{
  const s=await setup();const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});let resolve;const old=s.registry.listViews();let focused=0;s.registry.listViews=()=>new Promise(r=>{resolve=r;});s.registry.focusView=()=>{focused++;return true;};
  const pending=call(s,'focusView',{windowId:doc.windowId});s.windows[0].destroy();resolve(old);assert.equal((await pending).code,'SENDER_REFUSED');assert.equal(focused,0);
});
feature('native errors never expose stack, path, notes or arbitrary error code',async()=>{
  const s=await setup();s.registry.openView=()=>{throw Object.assign(new Error('private notes C:/private/source'),{code:'SECRET_CODE'});};
  assert.deepEqual(await call(s,'openView',{role:'docs',entityId:'doc_a'}),{ok:false,code:'OPERATION_FAILED',message:'Native window operation failed'});
  s.registry.openView=()=>{throw Object.assign(new Error('private'),{code:'ACCESS_REFUSED'});};assert.deepEqual(await call(s,'openView',{role:'docs',entityId:'doc_a'}),{ok:false,code:'ACCESS_REFUSED',message:'Native view access refused'});
});
feature('rejected asynchronous operations also recheck caller before returning a receipt',async()=>{
  for(const method of ['openView','listViews','focusView']) {
    const s=await setup();const doc=await s.registry.openView({role:'docs',entityId:'doc_a'});let reject;
    s.registry[method]=()=>new Promise((_resolve,r)=>{reject=r;});
    const payload=method==='openView'?{role:'docs',entityId:'doc_a'}:method==='focusView'?{windowId:doc.windowId}:{};
    const pending=call(s,method,payload);s.windows[0].destroy();reject(Object.assign(new Error('private'),{code:'ACCESS_REFUSED'}));
    assert.equal((await pending).code,'SENDER_REFUSED');
  }
});
