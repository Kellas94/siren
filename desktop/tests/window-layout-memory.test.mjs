import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {EventEmitter} from 'node:events';
import {mkdtemp} from './fixtures/temporary.mjs';
import {nativeViewFactory} from '../src/windows/factory.mjs';
import {settleHiddenBounds} from '../src/windows/factory.mjs';
import {allowedAppFile} from '../scripts/package.mjs';
const implementation=await import('../src/windows/layout-memory.mjs').catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const bounds={normalBounds:{x:-1500,y:50,width:800,height:600},displayId:2,maximized:true,fullscreen:false};
async function fixture(){assert.equal(typeof implementation.WindowLayoutStore,'function');const root=await mkdtemp(join(tmpdir(),'siren-window-layout-'));const store=new implementation.WindowLayoutStore(root);await store.initialize();return {root,store};}
test('layout metadata survives a fresh store read without project/source data and retains negative DIP bounds',async()=>{
 const {root,store}=await fixture();assert.equal(store.remember('main',bounds),true);assert.equal(await store.flush(),true);
 const fresh=new implementation.WindowLayoutStore(root);await fresh.initialize();assert.deepEqual(fresh.get('main'),bounds);
 const data=await readFile(join(root,'UI/window-layout.json'),'utf8');assert.equal(/project|source|agent|content|password|pin/i.test(data),false);
 assert.equal(store.remember('main',{...bounds,content:'PRIVATE'}),false);assert.deepEqual(store.get('main'),bounds);
});
test('malformed or oversized saved layout defaults safely and is retained without overwrite',async()=>{
 for(const data of ['{"schema":9,"content":"PRIVATE"}','x'.repeat(65537)]){
  const {root}=await fixture();await mkdir(join(root,'UI'),{recursive:true});const file=join(root,'UI/window-layout.json');await writeFile(file,data);
  const store=new implementation.WindowLayoutStore(root);assert.equal(await store.initialize(),false);assert.equal(store.get('main'),undefined);assert.equal(store.remember('main',bounds),false);assert.equal(await store.flush(),false);assert.equal(await readFile(file,'utf8'),data);
 }
});
test('duplicate native entity views reserve separate stable slots, restore after restart and rehome a missing display',async()=>{
 const {store,root}=await fixture();assert.equal(typeof implementation.NativeLayoutMemory,'function');
 const displays=[{id:1,primary:true,workArea:{x:0,y:30,width:1280,height:800}},{id:2,workArea:{x:-1600,y:0,width:1600,height:900}}];
 const memory=new implementation.NativeLayoutMemory({store,displays:()=>displays});
 const options={projectId:'project-a',role:'code',entityId:'source-a',version:1},a=memory.reserve(options),b=memory.reserve(options);
 assert.notEqual(a.key,b.key);assert.equal(store.remember(a.key,bounds),true);assert.equal(store.remember(b.key,{...bounds,normalBounds:{x:100,y:100,width:700,height:500},maximized:false}),true);assert.equal(await store.flush(),true);
 const fresh=new implementation.WindowLayoutStore(root);await fresh.initialize();const restarted=new implementation.NativeLayoutMemory({store:fresh,displays:()=>[displays[0]]});
 const first=restarted.reserve(options),second=restarted.reserve(options);assert.equal(first.key,a.key);assert.equal(second.key,b.key);assert.deepEqual(first.layout.normalBounds,{x:0,y:50,width:800,height:600});assert.equal(first.layout.maximized,true);assert.deepEqual(second.layout.normalBounds,{x:100,y:100,width:700,height:500});
 memory.release(a);assert.equal(memory.reserve(options).key,a.key);assert.notEqual(memory.reserve({...options,version:2}).key,b.key);
 memory.dispose();restarted.dispose();
});
test('layout identity accepts the native registry entity alphabet, including imported uppercase and leading underscore IDs',async()=>{
 const {store}=await fixture(),memory=new implementation.NativeLayoutMemory({store,displays:()=>[{id:1,workArea:{x:0,y:0,width:1280,height:800}}]});
 for(const role of ['docs','diagram','presenter','audience'])for(const entityId of ['AgentNotes','_Deck-A'])assert.match(memory.reserve({projectId:'project-a',role,entityId}).key,/^[a-f0-9]{64}\.[0-9]+$/);
 memory.dispose();
});
test('native geometry events coalesce metadata only, revoke on disposal and keep the last actual normal/max/full state',async()=>{
 const {store}=await fixture();const displays=[{id:1,primary:true,workArea:{x:0,y:30,width:1280,height:800}}];const memory=new implementation.NativeLayoutMemory({store,displays:()=>displays});
 const w=new EventEmitter();let native={x:50,y:60,width:700,height:500};Object.assign(w,{isDestroyed:()=>false,getNormalBounds:()=>native,isMaximized:()=>true,isFullScreen:()=>false});
 const ticket=memory.reserve({role:'workspace'});memory.track(w,ticket);native={...native,x:100};w.emit('move');assert.equal(await memory.flush(),true);assert.equal(store.get(ticket.key).normalBounds.x,100);assert.equal(store.get(ticket.key).maximized,true);
 memory.dispose();native={...native,x:200};w.emit('move');assert.equal(store.get(ticket.key).normalBounds.x,100);assert.equal(w.listenerCount('move'),0);
});
test('cancelled native placement retains last stable fullscreen metadata instead of persisting its temporary exit',async()=>{
 const {store}=await fixture(),memory=new implementation.NativeLayoutMemory({store,displays:()=>[{id:1,workArea:{x:0,y:0,width:1280,height:800}}]});
 const w=new EventEmitter();let fullscreen=true,current=true;Object.assign(w,{isDestroyed:()=>false,getNormalBounds:()=>({x:50,y:60,width:700,height:500}),isMaximized:()=>false,isFullScreen:()=>fullscreen});
 const ticket=memory.reserve({role:'workspace'});memory.track(w,ticket,{isCurrent:()=>current});assert.equal(store.get(ticket.key).fullscreen,true);
 assert.equal(typeof memory.beginPlacement,'function');const finish=memory.beginPlacement(w);fullscreen=false;w.emit('leave-full-screen');assert.equal(store.get(ticket.key).fullscreen,true);
 current=false;finish(false);assert.equal(await memory.flush(),true);assert.equal(store.get(ticket.key).fullscreen,true);memory.dispose();
});
test('native factory consumes saved geometry while hidden and releases a failed creation slot; package includes the memory module',async()=>{
 const {store}=await fixture(),displays=[{id:2,primary:true,workArea:{x:-1600,y:0,width:1600,height:900}}],memory=new implementation.NativeLayoutMemory({store,displays:()=>displays});
 const identity={projectId:'project-a',role:'code',entityId:'source-a',version:1},ticket=memory.reserve(identity);store.remember(ticket.key,bounds);memory.release(ticket);let native;
 class Boundary extends EventEmitter{constructor(options){super();this.options=options;this.dead=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:''},getURL:()=>this.webContents.mainFrame.url,isDestroyed:()=>this.dead,setWindowOpenHandler:()=>{}});native=this;}isDestroyed(){return this.dead;}destroy(){this.dead=true;this.emit('closed');}async loadURL(url){this.webContents.mainFrame.url=url;}}
 const factory=nativeViewFactory({BrowserWindow:Boundary,displays:()=>displays,layoutMemory:memory,preload:'/owned/preload.cjs'}),windowId='12345678-1234-4234-8234-123456789abc';
 await factory({...identity,windowId,mainFrameUrl:'siren://app/windows/code.html?windowId='+windowId});assert.equal(native.options.x,-1500);assert.equal(native.options.width,800);assert.equal(native.options.show,false);native.destroy();assert.equal(memory.reserve(identity).key,ticket.key);
 assert.equal(allowedAppFile('src/windows/layout-memory.mjs',new Set()),true);memory.dispose();
});
test('hidden native factory verifies and corrects constructor frame drift before a saved maximized/fullscreen view can be admitted',async()=>{
 const {store}=await fixture(),displays=[{id:2,primary:true,workArea:{x:-1600,y:0,width:1600,height:900}}],memory=new implementation.NativeLayoutMemory({store,displays:()=>displays}),identity={projectId:'project-a',role:'docs',entityId:'_AgentNotes'},ticket=memory.reserve(identity);store.remember(ticket.key,bounds);memory.release(ticket);
 class Boundary extends EventEmitter{constructor(options){super();this.dead=false;this.normal={x:options.x,y:options.y,width:options.width+4,height:options.height+4};this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:''},getURL:()=>this.webContents.mainFrame.url,isDestroyed:()=>this.dead,setWindowOpenHandler:()=>{}});}isDestroyed(){return this.dead;}destroy(){this.dead=true;this.emit('closed');}async loadURL(url){this.webContents.mainFrame.url=url;}getBounds(){return {...this.normal};}setPosition(x,y){this.normal={...this.normal,x,y};}setSize(width,height){this.normal={...this.normal,width,height};}}
 const windowId='12345678-1234-4234-8234-123456789abc',factory=nativeViewFactory({BrowserWindow:Boundary,displays:()=>displays,layoutMemory:memory,preload:'/owned/preload.cjs'}),window=await factory({...identity,windowId,mainFrameUrl:'siren://app/windows/docs.html?windowId='+windowId});
 assert.deepEqual(window.getBounds(),bounds.normalBounds);window.destroy();memory.dispose();
});
test('hidden frame sizing compensates one stable native scale rounding offset while still requiring exact final DIP readback',async()=>{
 const wanted={x:-1557,y:90,width:1052,height:750};let current={...wanted,width:1056},sizes=[];
 const window={isDestroyed:()=>false,getBounds:()=>({...current}),setPosition(x,y){current={...current,x,y};},setSize(width,height){sizes.push([width,height]);current={...current,width:width+1,height};}};
 await settleHiddenBounds(window,wanted);assert.deepEqual(current,wanted);assert.deepEqual(sizes,[[1052,750],[1051,750]]);
});
