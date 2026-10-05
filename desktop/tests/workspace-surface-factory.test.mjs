import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {nativeViewFactory} from '../src/windows/factory.mjs';
import {createWorkspaceSurface,workspaceSurfaceFor} from '../src/windows/surface.mjs';
class View{
 children=[];addChildView(view){view.parent?.removeChildView(view);this.children.push(view);view.parent=this;}
 removeChildView(view){this.children=this.children.filter(v=>v!==view);view.parent=null;}setBounds(){}setVisible(){}
}
class Contents extends EventEmitter{
 destroyed=false;mainFrame={url:'about:blank'};isDestroyed(){return this.destroyed;}getURL(){return this.mainFrame.url;}
 setWindowOpenHandler(){}async loadURL(url){this.mainFrame.url=url;if(this.failLoad)throw Error('Owned load failure');}
 close(){if(!this.hold)this.complete();}complete(){this.destroyed=true;this.emit('destroyed');}
}
class ContentsView extends View{webContents=new Contents();}
class Base extends EventEmitter{
 contentView=new View();destroyed=false;constructor(options={}){super();this.options=options;}
 isDestroyed(){return this.destroyed;}getContentBounds(){return {width:900,height:650};}hide(){}show(){}
 destroy(){this.destroyed=true;this.emit('closed');}
}
class Browser extends Base{
 webContents=new Contents();loadURL(url){return this.webContents.loadURL(url);}
 destroy(){this.webContents.complete();super.destroy();}
}
const request=role=>({role,windowId:'11111111-1111-4111-8111-111111111111',mainFrameUrl:`siren://app/windows/${role}.html?windowId=11111111-1111-4111-8111-111111111111`});
function fixture({failLoad=false,hold=false}={}){
 const host=new Browser();let created;
 const factory=nativeViewFactory({BrowserWindow:Browser,displays:()=>[{id:1,primary:true,workArea:{x:0,y:0,width:1200,height:800}}],preload:'/owned/preload.cjs',presentationPreload:'/owned/present.cjs',
  createSurface:options=>{created=createWorkspaceSurface({BaseWindow:Base,WebContentsView:ContentsView,host,...options,isCurrent:()=>true,destructionTimeoutMs:20});created.webContents.failLoad=failLoad;created.webContents.hold=hold;return created;}});
 return {factory,get surface(){return created;}};
}
test('factory opts Code/Docs/Diagram into the same owned surface while presentation roles stay isolated',async()=>{
 for(const role of ['code','docs','diagram']){const f=fixture(),window=await f.factory(request(role));assert.equal(workspaceSurfaceFor(window),f.surface);assert.equal(window.webContents,f.surface.webContents);assert.equal(window.webContents.getURL(),request(role).mainFrameUrl);await f.surface.dispose();}
 const f=fixture();for(const role of ['presenter','audience']){const window=await f.factory(request(role));assert.equal(workspaceSurfaceFor(window),null);assert.equal(f.surface,undefined);window.destroy();}
});
test('a failed surface load rejects only after actual renderer and shell cleanup',async()=>{
 const f=fixture({failLoad:true,hold:true});let finished=false;
 const pending=f.factory(request('code')).finally(()=>{finished=true;});const rejected=assert.rejects(pending,/Owned load failure/);
 await Promise.resolve();await Promise.resolve();assert.equal(finished,false);assert.equal(f.surface.window.isDestroyed(),false);
 f.surface.webContents.complete();await rejected;assert.equal(f.surface.isDestroyed(),true);
});
test('a failed unregistered surface cleanup preserves the concrete owned handle on its refusal',async()=>{
 const f=fixture({failLoad:true,hold:true});await assert.rejects(f.factory(request('docs')),error=>error.code==='WINDOW_DESTROY_FAILED'&&error.nativeWindow===f.surface.window);
 assert.equal(f.surface.isDestroyed(),false);const cleanup=f.surface.dispose();f.surface.webContents.complete();assert.equal(await cleanup,true);
});
