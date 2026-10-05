import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createWorkspaceSurface} from '../src/windows/surface.mjs';

// Only the native boundary is doubled. No registry, save or privacy verdict is
// inferred from these tests; actual Electron is exercised separately.
class View {
  children=[]; visible=true;
  addChildView(view){view.parent?.removeChildView(view);this.children.push(view);view.parent=this;}
  removeChildView(view){this.children=this.children.filter(v=>v!==view);view.parent=null;}
  setBounds(bounds){this.bounds={...bounds};}
  setVisible(value){this.visible=value;}
}
class Window extends EventEmitter {
  contentView=new View();destroyed=false;minimized=false;visible=false;
  getContentBounds(){return {x:20,y:20,width:900,height:650};}
  isDestroyed(){return this.destroyed;}
  isMinimized(){return this.minimized;}
  restore(){this.minimized=false;}
  show(){this.visible=true;}
  hide(){this.visible=false;}
  focus(){this.focused=true;}
  destroy(){this.destroyed=true;this.emit('closed');}
}
class Contents extends EventEmitter {
  destroyed=false;closeCalls=0;mainFrame={url:'siren://app/windows/code.html'};
  isDestroyed(){return this.destroyed;}
  focus(){this.focused=true;}
  close(options){assert.deepEqual(options,{waitForBeforeUnload:false});this.closeCalls++;}
  complete(){this.destroyed=true;this.emit('destroyed');}
}
class ContentsView extends View {webContents=new Contents();}
function fixture({timeoutMs=100}={}){
  const host=new Window();host.webContents=new Contents();let current=true,frame,wc;const errors=[];
  const surface=createWorkspaceSurface({BaseWindow:Window,WebContentsView:ContentsView,host,
    windowOptions:{show:false},webPreferences:{preload:'/owned/preload.cjs'},
    isCurrent:()=>current&&wc.mainFrame===frame,destructionTimeoutMs:timeoutMs,onFailure:error=>errors.push(error.code)});
  wc=surface.webContents;frame=wc.mainFrame;
  return {surface,host,shell:surface.window,wc:surface.webContents,view:surface.view,errors,retire:()=>{current=false;}};
}
test('attach/detach moves one native view with the same contents/frame and restores focus',()=>{
  const f=fixture(),frame=f.wc.mainFrame,view=f.view;
  f.shell.show();assert.equal(f.surface.attach(),true);assert.equal(f.shell.visible,false);
  assert.deepEqual(f.host.contentView.children,[view]);assert.deepEqual(f.shell.contentView.children,[]);
  assert.equal(f.surface.webContents,f.wc);assert.equal(f.wc.mainFrame,frame);
  assert.deepEqual(view.bounds,{x:0,y:48,width:900,height:602});
  f.host.minimized=true;assert.equal(f.surface.focus(),true);assert.equal(f.host.minimized,false);assert.equal(f.wc.focused,true);
  assert.equal(f.surface.detach(),true);assert.deepEqual(f.host.contentView.children,[]);assert.deepEqual(f.shell.contentView.children,[view]);
  assert.equal(f.shell.visible,true);assert.equal(f.wc.closeCalls,0);assert.equal(f.wc.mainFrame,frame);
});
test('retired authority cannot attach, detach, resize or focus a surface',()=>{
  const f=fixture();f.surface.attach();f.retire();const bounds={...f.view.bounds};
  for(const method of ['attach','detach','resize','focus'])assert.equal(f.surface[method](),false,method);
  assert.deepEqual(f.view.bounds,bounds);assert.deepEqual(f.host.contentView.children,[f.view]);
});
test('focus restores an authorized minimized native parent before measuring its zero-sized content viewport',()=>{
 const f=fixture();f.shell.minimized=true;
 f.shell.getContentBounds=()=>f.shell.minimized?{width:0,height:0}:{width:900,height:650};
 assert.equal(f.surface.focus(),true);assert.equal(f.shell.minimized,false);
 assert.deepEqual(f.view.bounds,{x:0,y:0,width:900,height:650});assert.equal(f.wc.focused,true);
});
test('replacement native frame makes transfer authority stale',()=>{
  const f=fixture();f.wc.mainFrame={url:'siren://app/windows/code.html'};
  assert.equal(f.surface.attach(),false);assert.deepEqual(f.shell.contentView.children,[f.view]);
});
test('a destroyed host or contents cannot receive a view',()=>{
  for(const target of ['host','wc']){const f=fixture();f[target].destroyed=true;assert.equal(f.surface.attach(),false);assert.deepEqual(f.shell.contentView.children,[f.view]);}
});
test('unsafe or undersized viewport refuses movement before native ownership changes',()=>{
  for(const bounds of [{width:900,height:48},{width:NaN,height:500},{width:32769,height:500}]){
    const f=fixture();f.host.getContentBounds=()=>bounds;assert.equal(f.surface.attach(),false);assert.deepEqual(f.shell.contentView.children,[f.view]);
  }
});
test('dispose hides/removes sensitive view immediately but waits for actual contents destruction',async()=>{
  const f=fixture();f.surface.attach();f.retire();let completed=false;
  const disposal=f.surface.dispose().then(result=>{completed=true;return result;});
  assert.equal(f.view.visible,false);assert.deepEqual(f.host.contentView.children,[]);assert.equal(f.shell.visible,false);
  await Promise.resolve();assert.equal(completed,false);assert.equal(f.shell.isDestroyed(),false);assert.equal(f.wc.isDestroyed(),false);
  for(const method of ['attach','detach','resize','focus'])assert.equal(f.surface[method](),false);
  f.wc.complete();assert.equal(await disposal,true);assert.equal(f.shell.isDestroyed(),true);assert.equal(f.surface.isDestroyed(),true);
});
test('concurrent disposal requests share one contents close and one confirmation',async()=>{
  const f=fixture(),first=f.surface.dispose(),second=f.surface.dispose();assert.equal(first,second);assert.equal(f.wc.closeCalls,1);
  f.wc.complete();assert.equal(await first,true);assert.equal(await f.surface.dispose(),true);assert.equal(f.wc.closeCalls,1);
});
test('timeout retains actual handles, refuses success and permits a later confirmed disposal',async()=>{
  const f=fixture({timeoutMs:15});f.surface.attach();await assert.rejects(f.surface.dispose(),e=>e.code==='WINDOW_DESTROY_FAILED');
  assert.equal(f.surface.isDestroyed(),false);assert.equal(f.shell.destroyed,false);assert.equal(f.surface.attach(),false);
  assert.equal(f.wc.listenerCount('destroyed'),1,'Only the surface lifetime observer remains');assert.deepEqual(f.host.contentView.children,[]);
  const retry=f.surface.dispose();f.wc.complete();assert.equal(await retry,true);assert.equal(f.wc.closeCalls,2);
});
test('native close exception keeps handles fenced and can never confirm cleanup',async()=>{
  const f=fixture();f.surface.attach();f.wc.close=()=>{throw Error('native private details');};
  await assert.rejects(f.surface.dispose(),e=>e.code==='WINDOW_DESTROY_FAILED'&&!e.message.includes('private'));
  assert.equal(f.surface.isDestroyed(),false);assert.equal(f.surface.focus(),false);assert.deepEqual(f.host.contentView.children,[]);
});
test('a shell closed outside the controller also removes its view and closes the renderer',async()=>{
  const f=fixture();f.surface.attach();f.shell.destroy();assert.deepEqual(f.host.contentView.children,[]);assert.equal(f.wc.closeCalls,1);
  assert.equal(f.surface.isDestroyed(),false);const pending=f.surface.dispose();f.wc.complete();assert.equal(await pending,true);
});
test('failed native reparenting is hidden and fenced rather than reported as attached',async()=>{
  const f=fixture();f.host.contentView.addChildView=()=>{throw Error('native move failed');};
  assert.throws(()=>f.surface.attach(),e=>e.code==='SURFACE_MOVE_FAILED');assert.equal(f.view.visible,false);assert.equal(f.surface.focus(),false);
  const cleanup=f.surface.dispose();f.wc.complete();assert.equal(await cleanup,true);
});
test('secure preferences cannot be relaxed by the surface options',()=>{
  let observed;class Capture extends ContentsView{constructor(options){super();observed=options;}}
  const host=new Window();host.webContents=new Contents();
  createWorkspaceSurface({BaseWindow:Window,WebContentsView:Capture,host,isCurrent:()=>true,
    webPreferences:{preload:'/owned/preload.cjs',sandbox:false,nodeIntegration:true,contextIsolation:false,webSecurity:false}});
  assert.deepEqual(observed.webPreferences,{preload:'/owned/preload.cjs',sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true});
});
test('external renderer destruction conceals its attached view and closes the empty shell',async()=>{
  const f=fixture();f.surface.attach();f.wc.complete();assert.deepEqual(f.host.contentView.children,[]);
  assert.equal(await f.surface.dispose(),true);assert.equal(f.shell.isDestroyed(),true);assert.equal(f.wc.listenerCount('destroyed'),0);
});
test('host destruction disposes the attached view rather than stranding its hidden shell',async()=>{
  const f=fixture();f.surface.attach();f.host.destroy();assert.equal(f.view.visible,false);assert.equal(f.wc.closeCalls,1);
  const pending=f.surface.dispose();f.wc.complete();assert.equal(await pending,true);assert.equal(f.shell.destroyed,true);
});
test('a failed view constructor cannot leave a native shell alive',()=>{
  let window;class Shell extends Window{constructor(options){super(options);window=this;}}
  class Broken{constructor(){throw Error('construction failed');}}
  const host=new Window();host.webContents=new Contents();
  assert.throws(()=>createWorkspaceSurface({BaseWindow:Shell,WebContentsView:Broken,host,isCurrent:()=>true}));assert.equal(window.isDestroyed(),true);
});
