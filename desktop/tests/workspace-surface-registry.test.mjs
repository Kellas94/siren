import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {createWorkspaceSurface} from '../src/windows/surface.mjs';

let id=1;
class View{
  children=[];addChildView(view){view.parent?.removeChildView(view);this.children.push(view);view.parent=this;}
  removeChildView(view){this.children=this.children.filter(v=>v!==view);view.parent=null;}
  setBounds(){}setVisible(value){this.visible=value;}
}
class Contents extends EventEmitter{
  id=id++;destroyed=false;mainFrame={url:'about:blank'};
  isDestroyed(){return this.destroyed;}getURL(){return this.mainFrame.url;}
  close(){}complete(){this.destroyed=true;this.emit('destroyed');}
}
class ContentsView extends View{webContents=new Contents();}
class Window extends EventEmitter{
  id=id++;contentView=new View();destroyed=false;
  isDestroyed(){return this.destroyed;}isMinimized(){return false;}restore(){}focus(){}hide(){}show(){}
  getContentBounds(){return {width:900,height:650};}
  destroy(){this.destroyed=true;this.emit('closed');}close(){this.destroy();}
}
async function fixture({timeoutMs=200,reuseError=false}={}){
  const host=new Window();host.webContents=new Contents();host.webContents.mainFrame.url='siren://app/app.html';
  let surface;
  const registry=new WindowRegistry({closeTimeoutMs:1000,authorize:()=>({projectId:'project_a',mode:'normal',access:'write',entityIds:['code_a']}),
    createWindow:options=>{
      if(surface&&reuseError)throw Object.assign(Error('Native factory refused'),{nativeWindow:surface.window});
      surface=createWorkspaceSurface({BaseWindow:Window,WebContentsView:ContentsView,host,isCurrent:()=>!!registry.caller(event()),destructionTimeoutMs:timeoutMs});
      surface.webContents.mainFrame.url=options.mainFrameUrl;return surface.window;
    }});
  const event=()=>({sender:surface.webContents,senderFrame:surface.webContents.mainFrame});
  registry.bindWorkspace(host);registry.activateWorkspace();
  const opened=await registry.openView({role:'code',entityId:'code_a'});surface.attach();
  return {host,registry,surface,opened,event};
}
test('synchronous epoch retirement refuses confirmation while a surface renderer survives',async()=>{
  const f=await fixture();const grant=f.registry.capture(f.event());
  assert.throws(()=>f.registry.invalidateEpoch({preserveWorkspace:true}),e=>e.code==='WINDOW_DESTROY_FAILED');
  assert.equal(f.surface.webContents.isDestroyed(),false);assert.equal(f.registry.isCurrent(grant),false);
  assert.deepEqual(f.host.contentView.children,[]);assert.throws(()=>f.registry.activateWorkspace(),e=>e.code==='ACCESS_REFUSED');
  const retirement=f.registry.invalidateEpochAsync({preserveWorkspace:true});f.surface.webContents.complete();
  await retirement;assert.equal(f.surface.isDestroyed(),true);assert.deepEqual(f.registry.listViews(),[]);
  assert.equal(f.registry.activateWorkspace().role,'workspace');
});
test('a factory error cannot dispose a previously admitted surface using a reused native handle',async()=>{
  const f=await fixture({reuseError:true}),grant=f.registry.capture(f.event());
  await assert.rejects(f.registry.openView({role:'code',entityId:'code_a'}));
  assert.equal(f.surface.isDestroyed(),false);assert.equal(f.registry.isCurrent(grant),true);
  assert.equal(f.surface.detach(),true,'Unrelated factory error must not retire the existing surface');
  const cleanup=f.registry.invalidateEpochAsync({preserveWorkspace:true});f.surface.webContents.complete();await cleanup;
});
test('async epoch retirement fences before awaiting and confirms only contents plus shell destruction',async()=>{
  const f=await fixture(),grant=f.registry.capture(f.event());let confirmed=false;
  const retirement=f.registry.invalidateEpochAsync({preserveWorkspace:true}).then(value=>{confirmed=true;return value;});
  assert.equal(f.registry.isCurrent(grant),false);assert.equal(f.surface.window.isDestroyed(),false);await Promise.resolve();assert.equal(confirmed,false);
  f.surface.webContents.complete();const epoch=await retirement;assert.ok(epoch>grant.epoch);assert.equal(f.surface.isDestroyed(),true);
  assert.equal(f.host.isDestroyed(),false);
});
test('async trusted discard retires one surface without renewing another primary grant',async()=>{
  const f=await fixture(),primary=f.registry.capture({sender:f.host.webContents,senderFrame:f.host.webContents.mainFrame});
  const disposal=f.registry.discardViewAsync(f.opened.windowId);assert.equal(f.registry.caller(f.event()),null);
  f.surface.webContents.complete();assert.equal(await disposal,true);assert.equal(f.registry.isCurrent(primary),true);assert.equal(f.surface.isDestroyed(),true);
});
test('timed out async retirement retains its fence and a later actual close can recover it',async()=>{
  const f=await fixture({timeoutMs:15});await assert.rejects(f.registry.invalidateEpochAsync({preserveWorkspace:true}),e=>e.code==='WINDOW_DESTROY_FAILED');
  assert.equal(f.surface.isDestroyed(),false);assert.throws(()=>f.registry.activateWorkspace(),e=>e.code==='ACCESS_REFUSED');
  const retry=f.registry.invalidateEpochAsync({preserveWorkspace:true});f.surface.webContents.complete();await retry;
  assert.equal(f.surface.isDestroyed(),true);assert.equal(f.registry.activateWorkspace().role,'workspace');
});
test('self-close waits for contents destruction before issuing its one-use native proof',async()=>{
  const f=await fixture(),event=f.event(),caller=f.registry.caller(event);let confirmed=false;
  const closed=f.registry.closeView(f.opened.windowId,{caller:event});assert.ok(closed instanceof Promise);
  const pending=closed.then(value=>{confirmed=true;return value;});await Promise.resolve();assert.equal(confirmed,false);
  assert.equal(f.surface.window.isDestroyed(),true);assert.equal(f.surface.webContents.isDestroyed(),false);
  f.surface.webContents.complete();assert.equal(await pending,true);
  assert.equal(f.registry.confirmClosedCaller(event,caller),true);assert.equal(f.registry.confirmClosedCaller(event,caller),false);
});
test('an older async retirement cannot confirm a newer epoch as its own',async()=>{
  const f=await fixture(),first=f.registry.invalidateEpochAsync({preserveWorkspace:true});
  const rejected=assert.rejects(first,e=>e.code==='ACCESS_REFUSED');
  const latest=f.registry.invalidateEpochAsync({preserveWorkspace:true});f.surface.webContents.complete();
  await rejected;assert.ok(await latest>f.opened.epoch);
});
test('external shell closure retains its surviving renderer and fences retirement/admission through timeout',async()=>{
  const f=await fixture({timeoutMs:15});f.surface.window.destroy();
  assert.equal(f.registry.caller(f.event()),null);assert.equal(f.surface.webContents.isDestroyed(),false);
  assert.throws(()=>f.registry.activateWorkspace(),e=>e.code==='ACCESS_REFUSED');
  await assert.rejects(f.registry.invalidateEpochAsync({preserveWorkspace:true}),e=>e.code==='WINDOW_DESTROY_FAILED');
  assert.throws(()=>f.registry.activateWorkspace(),e=>e.code==='ACCESS_REFUSED');
  const retry=f.registry.invalidateEpochAsync({preserveWorkspace:true});f.surface.webContents.complete();await retry;
  assert.equal(f.registry.activateWorkspace().role,'workspace');
});
test('external renderer closure cannot forget a native shell that refuses destruction',async()=>{
  const f=await fixture();f.surface.window.destroy=()=>{};f.surface.webContents.complete();await Promise.resolve();
  assert.equal(f.surface.window.isDestroyed(),false);assert.throws(()=>f.registry.activateWorkspace(),e=>e.code==='ACCESS_REFUSED');
  await assert.rejects(f.registry.invalidateEpochAsync({preserveWorkspace:true}),e=>e.code==='WINDOW_DESTROY_FAILED');
  f.surface.window.destroy=Window.prototype.destroy;await f.registry.invalidateEpochAsync({preserveWorkspace:true});
  assert.equal(f.surface.isDestroyed(),true);assert.equal(f.registry.activateWorkspace().role,'workspace');
});
test('surface initialization failure retains unadmitted native handles when cleanup cannot be confirmed',async()=>{
  const host=new Window();host.webContents=new Contents();host.webContents.mainFrame.url='siren://app/app.html';let wc,shell;
  class BrokenView extends ContentsView{constructor(options){super(options);wc=this.webContents;}setBounds(){throw Error('native bounds failure');}}
  class Shell extends Window{constructor(options){super(options);shell=this;}}
  const registry=new WindowRegistry({authorize:()=>({projectId:'project_a',mode:'normal',access:'write',entityIds:['code_a']}),
    createWindow:()=>createWorkspaceSurface({BaseWindow:Shell,WebContentsView:BrokenView,host,isCurrent:()=>true,destructionTimeoutMs:15}).window});
  registry.bindWorkspace(host);registry.activateWorkspace();
  await assert.rejects(registry.openView({role:'code',entityId:'code_a'}),e=>e.code==='WINDOW_DESTROY_FAILED');
  assert.equal(shell.isDestroyed(),false);assert.equal(wc.isDestroyed(),false);
  await assert.rejects(registry.invalidateEpochAsync({preserveWorkspace:true}),e=>e.code==='WINDOW_DESTROY_FAILED');
  assert.throws(()=>registry.activateWorkspace(),e=>e.code==='ACCESS_REFUSED');
  const retry=registry.invalidateEpochAsync({preserveWorkspace:true});wc.complete();await retry;
  assert.equal(shell.isDestroyed(),true);assert.equal(registry.activateWorkspace().role,'workspace');
});
