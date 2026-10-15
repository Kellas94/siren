import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {mkdtemp} from './fixtures/temporary.mjs';
import {nativeViewFactory} from '../src/windows/factory.mjs';
import {resolveLocalResource} from '../src/protocol.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {createTerminalSatellite} from '../src/ui/terminal/satellite.js';
import {buildTerminalWindow} from '../build/terminal-window.mjs';

const windowId='11111111-1111-4111-8111-111111111111';
const url=`siren://app/windows/terminal.html?windowId=${windowId}`;
const identity=()=>({windowId,role:'terminal',projectId:'project1',epoch:1,mode:'normal',access:'write',available:true});
const held=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};};
function controlsFixture(options={}){
 const rows=[],contexts=[];let listener,off=0;
 const bridge={getTerminalContext:()=>{const h=held();contexts.push(h);return h.promise;},onTerminalContext:fn=>{listener=fn;return()=>{off++;};},...options.bridge};
 const createControls=request=>{const cell={request,disposed:false,drained:0};rows.push(cell);return{dispose(){cell.disposed=true;},async drain(){cell.drained++;},snapshot:()=>({available:request.available&&!cell.disposed})};};
 const satellite=createTerminalSatellite({container:{},bridge,windowId,constructors:{candidate:true},createControls,createAdapter:()=>({terminalFactory(){},search:{}}),...options});
 return {satellite,rows,contexts,change:()=>listener?.(),get off(){return off;}};
}
test('satellite publishes controls only after matching native Terminal readiness',async()=>{
 const f=controlsFixture();const pending=f.satellite.refresh();assert.equal(f.satellite.snapshot().available,false);f.contexts[0].release(identity());assert.equal(await pending,true);assert.equal(f.satellite.snapshot().available,true);assert.equal(f.rows.at(-1).request.projectId,'project1');f.satellite.dispose();await f.satellite.drain();assert.equal(f.rows.at(-1).disposed,true);assert.equal(f.off,1);
});
test('late context after page retirement cannot recreate a display',async()=>{
 const f=controlsFixture();const pending=f.satellite.refresh();f.satellite.dispose();const count=f.rows.length;f.contexts[0].release(identity());assert.equal(await pending,false);await f.satellite.drain();assert.equal(f.rows.length,count);assert.equal(f.satellite.snapshot().available,false);
});
test('context change fences current controls before waiting for fresh readiness',async()=>{
 const f=controlsFixture();const first=f.satellite.refresh();f.contexts[0].release(identity());await first;const old=f.rows.at(-1);f.change();assert.equal(old.disposed,true);assert.equal(f.satellite.snapshot().available,false);f.contexts[1].release({...identity(),available:false});await f.satellite.drain();assert.equal(f.satellite.snapshot().available,false);f.satellite.dispose();
});
test('foreign identity, missing context invalidation and malformed readiness refuse admission',async()=>{
 for(const raw of [{...identity(),windowId:'22222222-2222-4222-8222-222222222222'},{...identity(),role:'docs'},{...identity(),mode:'readonly'},{...identity(),access:'read'},{...identity(),extra:true},null]){const f=controlsFixture();const pending=f.satellite.refresh();f.contexts[0].release(raw);assert.equal(await pending,false);assert.equal(f.satellite.snapshot().available,false);f.satellite.dispose();}
 const f=controlsFixture({bridge:{onTerminalContext:undefined}});assert.equal(await f.satellite.refresh(),false);assert.equal(f.contexts.length,0);f.satellite.dispose();
});
test('a newer readiness request wins over an older completion',async()=>{
 const f=controlsFixture();const old=f.satellite.refresh(),next=f.satellite.refresh();f.contexts[1].release({...identity(),epoch:2});assert.equal(await next,true);const current=f.rows.at(-1);f.contexts[0].release(identity());assert.equal(await old,false);assert.equal(f.rows.at(-1),current);assert.equal(current.request.epoch,2);f.satellite.dispose();await f.satellite.drain();
});
test('unadmitted constructors never query native context or build an emulator',async()=>{
 let calls=0;const f=controlsFixture({constructors:null,createAdapter:()=>{calls++;throw Error('unreachable');}});assert.equal(await f.satellite.refresh(),false);assert.equal(f.contexts.length,0);assert.equal(calls,0);f.satellite.dispose();
});
class Native extends EventEmitter{
 static rows=[];constructor(options){super();this.options=options;this.dead=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:''},getURL:()=>this.webContents.mainFrame.url,isDestroyed:()=>this.dead,setWindowOpenHandler:fn=>{this.popup=fn;}});Native.rows.push(this);}
 isDestroyed(){return this.dead;}destroy(){this.dead=true;this.webContents.emit('destroyed');this.emit('closed');}async loadURL(value){this.webContents.mainFrame.url=value;}
}
const factory=terminalPreload=>nativeViewFactory({BrowserWindow:Native,displays:()=>[{id:1,workArea:{x:0,y:0,width:1280,height:800}}],preload:'/owned/workspace.cjs',presentationPreload:'/owned/present.cjs',terminalPreload});
test('Terminal satellite factory explicitly selects its dedicated sandboxed preload',async()=>{
 const shell=await factory('/owned/terminal.cjs')({role:'terminal',windowId,mainFrameUrl:url});assert.equal(shell.options.show,false);assert.equal(shell.options.title,'SIREN — Terminal');assert.deepEqual(shell.options.webPreferences,{preload:'/owned/terminal.cjs',sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true});assert.deepEqual(shell.popup(),{action:'deny'});for(const type of ['will-navigate','will-frame-navigate','will-attach-webview']){let prevented=false;shell.webContents.emit(type,{url:'https://example.invalid',isMainFrame:false,preventDefault(){prevented=true;}});assert.equal(prevented,true);}shell.destroy();
});
test('Terminal native factory refuses missing or broader-role preloads before construction',async()=>{
 for(const preload of [undefined,'','relative.cjs','/owned/workspace.cjs','/owned/present.cjs','/owned/WORKSPACE.cjs','\\owned\\workspace.cjs','/owned/child/../workspace.cjs','/OWNED/./PRESENT.cjs','/owned/terminal\0.cjs']){const count=Native.rows.length;await assert.rejects(factory(preload)({role:'terminal',windowId,mainFrameUrl:url}),e=>e.code==='REQUEST_REFUSED');assert.equal(Native.rows.length,count);}
});
test('product registry default remains disabled before calling the candidate factory',async()=>{
 let calls=0;const registry=new WindowRegistry({authorize:()=>{calls++;throw Error('unreachable');},createWindow:factory('/owned/terminal.cjs')});await assert.rejects(registry.openView({role:'terminal',entityId:'session1'}),e=>e.code==='ACCESS_REFUSED');assert.equal(calls,0);
});
test('dedicated preload exposes finite context reads and payload-only invalidation',async()=>{
 const source=await readFile(new URL('../src/ui/terminal/preload.cjs',import.meta.url),'utf8');let exposed,unload;const calls=[],listeners=new Map();vm.runInNewContext(source,{require:name=>{assert.equal(name,'electron');return{contextBridge:{exposeInMainWorld(name,api){assert.equal(name,'sirenTerminal');exposed=api;}},ipcRenderer:{invoke(...args){calls.push(args);return Promise.resolve(identity());},on:(name,fn)=>listeners.set(name,fn),removeListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}}};},window:{addEventListener:(name,fn)=>{assert.equal(name,'unload');unload=fn;}}});
 await exposed.getTerminalContext();assert.deepEqual(calls[0],['siren:terminal-context']);let payload;const off=exposed.onTerminalContext(value=>{payload=value;});const event={secret:'private Electron event'},value={changed:true};listeners.get('siren:terminal-context')(event,value);assert.equal(payload,value);assert.notEqual(payload,event);off();assert.equal(listeners.has('siren:terminal-context'),false);unload();assert.equal((await exposed.getTerminalContext()).code,'CLIENT_DISPOSED');
});
test('source-only builder emits strict CSP and an unavailable real-controls entry',async t=>{
 const root=await mkdtemp(join(tmpdir(),'siren-terminal-entry-'));t.after(()=>rm(root,{recursive:true,force:true}));const receipt=await buildTerminalWindow(root),html=await readFile(join(root,'windows','terminal.html'),'utf8');assert.equal(receipt.constructorsBundled,false);assert.equal(receipt.nativeAdmission,false);assert.equal(receipt.entrySha256,createHash('sha256').update(html).digest('hex'));const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);assert.equal(scripts.length,1);assert.ok(html.includes(`'sha256-${createHash('sha256').update(scripts[0]).digest('base64')}'`));assert.ok(html.includes("default-src 'none'"));assert.equal(/script-src[^;]*unsafe-inline|<textarea|localStorage|require\(['"]electron/.test(html),false);assert.equal(await resolveLocalResource({url,rendererRoot:root}),join(root,'windows','terminal.html'));
 for(const bad of [url+'&role=docs',url.replace(windowId,'forged'),'siren://app/windows/terminal.html','siren://app/windows/%2e%2e/terminal.html?windowId='+windowId])await assert.rejects(resolveLocalResource({url:bad,rendererRoot:root}));
});
