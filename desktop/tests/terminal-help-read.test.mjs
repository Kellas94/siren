// TEST-ONLY prospective contract, /root/session_native_failure_diagnosis.
// Actual native helper/registry, MAIN handler, preload and renderer entry source.
// Native windows/satellite/Help rendering are explicit finite doubles, not OS proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import vm from 'node:vm';
import * as nativeHelp from '../src/help/native.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
const entry=await readFile(new URL('../src/ui/terminal/entry.js',import.meta.url),'utf8');
const preload=await readFile(new URL('../src/ui/terminal/preload.cjs',import.meta.url),'utf8');
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const wid='11111111-1111-4111-8111-111111111111';
const receipt=(overrides={})=>({ok:true,readable:true,role:'terminal',windowId:wid,projectId:'project1',epoch:1,...overrides});
let serial=100;
class Native extends EventEmitter{
 constructor(url){super();this.id=++serial;this.dead=false;const frame={url};this.webContents=new EventEmitter();Object.assign(this.webContents,{id:++serial,mainFrame:frame,isDestroyed:()=>this.dead,getURL:()=>this.webContents.mainFrame.url});}
 isDestroyed(){return this.dead;}isMinimized(){return false;}restore(){}focus(){}close(){this.destroy();}destroy(){if(this.dead)return;this.dead=true;this.webContents.emit('destroyed');this.emit('closed');}
}
async function nativeFixture(role='terminal'){
 const windows=new Map();let readable=true;
 const registry=new WindowRegistry({terminalViews:true,authorize:request=>({projectId:'project1',mode:'normal',access:'write',entityIds:[request.entityId]}),createWindow:async request=>{const w=new Native(request.mainFrameUrl);windows.set(request.windowId,w);return w;}});
 const record=await registry.openView({role,entityId:'entity1'}),window=windows.get(record.windowId),event={sender:window.webContents,senderFrame:window.webContents.mainFrame};
 return {registry,record,window,event,windows,setReadable:value=>readable=value,canRead:()=>readable,windowFor:id=>windows.get(id),close:()=>window.destroy()};
}
function capture(f,overrides={}){
 assert.equal(typeof nativeHelp.captureTerminalHelpContext,'function','The read-only helper must exist; missing API is the expected original RED');
 return nativeHelp.captureTerminalHelpContext({event:f.event,args:[],registry:f.registry,canRead:f.canRead,windowFor:f.windowFor,...overrides});
}
test('native read context is exact and independent of any Terminal execution graph',async t=>{
 const f=await nativeFixture();t.after(f.close);const actual=capture(f);
 assert.deepEqual(actual,{ok:true,readable:true,role:'terminal',windowId:f.record.windowId,projectId:'project1',epoch:f.record.epoch});
 assert.equal(Object.hasOwn(actual,'available'),false);assert.equal(Object.hasOwn(actual,'access'),false);
});
test('native read refuses wrong role, extra arguments and argument getters without reading them',async t=>{
 const terminal=await nativeFixture(),docs=await nativeFixture('docs');t.after(terminal.close);t.after(docs.close);
 assert.equal(capture(docs).ok,false);assert.equal(capture(terminal,{args:['renderer-authority']}).ok,false);
 let reads=0;const args=[];Object.defineProperty(args,'0',{get(){reads++;throw Error('Do not evaluate argument');},enumerable:true});assert.equal(capture(terminal,{args}).ok,false);assert.equal(reads,0);
 const revoked=Proxy.revocable([],{});revoked.revoke();assert.equal(capture(terminal,{args:revoked.proxy}).ok,false);
});
test('native read binds exact registered sender, current main frame and actual owned window',async t=>{
 const f=await nativeFixture();t.after(f.close);
 assert.equal(capture(f,{event:{sender:f.event.sender,senderFrame:{...f.event.senderFrame}}}).ok,false);
 assert.equal(capture(f,{event:{sender:{...f.event.sender},senderFrame:f.event.senderFrame}}).ok,false);
 const foreign=new Native(f.window.webContents.getURL());t.after(()=>foreign.destroy());assert.equal(capture(f,{windowFor:()=>foreign}).ok,false);
 const old=f.event.senderFrame;f.window.webContents.mainFrame={...old};assert.equal(capture(f).ok,false);
});
test('native read refuses locked, retired and synchronous retirement during owned-window lookup',async t=>{
 const f=await nativeFixture();t.after(f.close);f.setReadable(false);assert.equal(capture(f).ok,false);f.setReadable(true);
 assert.equal(capture(f,{windowFor:()=>{f.window.destroy();return f.window;}}).ok,false);assert.equal(capture(f).ok,false);
});
function mainHandlerSource(){
 const marker="ipcMain.handle('siren:terminal-help-context',",start=main.indexOf(marker);
 assert.notEqual(start,-1,'MAIN must register an argument-free read-only Terminal Help channel, independently of candidate execution');
 let depth=0,quote=null,escape=false,line=false,block=false;
 for(let i=main.indexOf('(',start);i<main.length;i++){
  const c=main[i],next=main[i+1];if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&next==='/'){block=false;i++;}continue;}
  if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}
  if(c==='/'&&next==='/'){line=true;i++;continue;}if(c==='/'&&next==='*'){block=true;i++;continue;}if(['\'','"','`'].includes(c)){quote=c;continue;}
  if(c==='(')depth++;if(c===')'&&--depth===0)return main.slice(start,i+1)+';';
 }
 assert.fail('Complete actual MAIN channel registration required');
}
test('actual MAIN read handler blocks all global access transitions but never reads graph readiness',async t=>{
 const f=await nativeFixture();t.after(f.close);let handler,unlocked=true;
 const scope={ipcMain:{handle:(name,fn)=>{assert.equal(name,'siren:terminal-help-context');handler=fn;}},captureTerminalHelpContext:nativeHelp.captureTerminalHelpContext,windowRegistry:f.registry,nativeShells:f.windows,localPin:{state:()=>({unlocked})},pinTransition:false,accountTransition:false,workspaceBarrier:null,accountQuiesced:false,nativeShellFailure:false,selectedId:'project1',snapshot:{project:{id:'project1'}},mode:'normal',nativeReadonly:false,writes:{selectionTransition:false,selectionQuiesced:false,viewClosing:false}};
 Object.defineProperty(scope,'terminalRuntime',{get(){throw Error('Read-only Help must not inspect execution graph');}});vm.runInNewContext(mainHandlerSource(),scope,{timeout:1000});
 assert.equal((await handler(f.event)).ok,true);assert.equal((await handler(f.event,'extra')).ok,false);
 for(const key of ['pinTransition','accountTransition','workspaceBarrier','accountQuiesced','nativeShellFailure']){scope[key]=true;assert.equal((await handler(f.event)).ok,false,key);scope[key]=key==='workspaceBarrier'?null:false;}
 for(const key of ['selectionTransition','selectionQuiesced','viewClosing']){scope.writes[key]=true;assert.equal((await handler(f.event)).ok,false,key);scope.writes[key]=false;}
 unlocked=false;assert.equal((await handler(f.event)).ok,false);
});
function preloadFixture(){
 let api,unload;const requests=[];
 vm.runInNewContext(preload,{require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(name,value)=>{assert.equal(name,'sirenTerminal');api=value;}},ipcRenderer:{invoke(...args){let release;const promise=new Promise(r=>release=r);requests.push({args,release});return promise;},on(){},removeListener(){}}};},window:{addEventListener:(name,fn)=>{assert.equal(name,'unload');unload=fn;}}},{timeout:1000});
 return {api,requests,unload};
}
test('actual preload exposes argument-free read method in the existing shared32 pending budget',async()=>{
 const f=preloadFixture();assert.equal(typeof f.api.getTerminalHelpContext,'function');const pending=[f.api.getTerminalContext()];for(let i=0;i<31;i++)pending.push(f.api.getTerminalHelpContext('ignored-renderer-argument'));
 assert.equal(f.requests.length,32);for(const request of f.requests.slice(1))assert.deepEqual(request.args,['siren:terminal-help-context']);assert.equal((await f.api.getTerminalHelpContext()).code,'CAPACITY_EXCEEDED');
 f.requests.forEach(r=>r.release(receipt()));await Promise.all(pending);const next=f.api.getTerminalHelpContext();assert.equal(f.requests.length,33);f.requests.at(-1).release(receipt());await next;f.unload();
});
test('preload unload fences a held Help read and all subsequent reads without extra IPC',async()=>{
 const f=preloadFixture();assert.equal(typeof f.api.getTerminalHelpContext,'function');const pending=f.api.getTerminalHelpContext();f.unload();f.requests[0].release(receipt());assert.equal((await pending).code,'CLIENT_DISPOSED');assert.equal((await f.api.getTerminalHelpContext()).code,'CLIENT_DISPOSED');assert.equal(f.requests.length,1);
});
function entryFixture({available=false,missingRead=false,missingInvalidation=false,invalidInvalidation=null}={}){
 const listeners=new Map(),subscriptions=new Map(),requests=[],calls=[],observers=[];let availability;
 class MutationObserver{constructor(callback){this.callback=callback;this.active=true;this.targets=[];observers.push(this);}observe(target,options){this.targets.push({target,options});}disconnect(){this.active=false;calls.push('observer-off');}}
 const buttons=new Map(['terminalWorkspace','terminalPlacement','terminalHelp'].map(id=>[id,{addEventListener:(name,fn)=>listeners.set(id+':'+name,fn),textContent:''}]));
 const doc={hidden:false,visibilityState:'visible',body:{inert:false},documentElement:{inert:false,dataset:{desktopLocked:'false'},style:{visibility:'visible',setProperty(){}}},getElementById:id=>buttons.get(id)};
 const bridge={getTerminalHelpContext(){let release,reject;const promise=new Promise((a,b)=>{release=a;reject=b;});requests.push({release,reject});return promise;},getTerminalTheme:async()=>({ok:false}),onTerminalContext:fn=>{if(invalidInvalidation==='throw')throw Error('finite subscription refusal');subscriptions.set('context',fn);if(invalidInvalidation==='nonfunction')return undefined;return()=>calls.push('off-context');},onTerminalTheme:fn=>{subscriptions.set('theme',fn);return()=>calls.push('off-theme');},onTerminalHelp:fn=>{subscriptions.set('help',fn);return()=>calls.push('off-help');}};
 if(missingRead)delete bridge.getTerminalHelpContext;if(missingInvalidation)delete bridge.onTerminalContext;
 const satellite={snapshot:()=>({available}),refresh:async()=>false,setTheme:()=>({ok:false}),dispose:()=>calls.push('satellite-dispose'),drain:async()=>{}};
 const win={sirenTerminal:bridge,MutationObserver,location:{href:'siren://app/windows/terminal.html?windowId='+wid},requestAnimationFrame(){},cancelAnimationFrame(){},ResizeObserver:class{},addEventListener:(name,fn)=>listeners.set(name,fn),SirenHelp:{create:options=>{availability=options.isAvailable;return {open(){if(availability()===true){calls.push('open');return true;}return false;},close:()=>calls.push('close'),dispose:()=>calls.push('help-dispose')};}}};
 const context=vm.createContext({URL,Terminal:class{},FitAddon:class{},SearchAddon:class{},createTerminalSatellite(){throw Error('Must use explicit finite satellite double');}});
 const source=entry.replace(/^import .*;\r?\n/gm,'').replace('export function bootTerminalEntry','function bootTerminalEntry')+'\nthis.boot=bootTerminalEntry;';vm.runInContext(source,context,{timeout:1000});const api=context.boot({window:win,document:doc,createSatellite:()=>satellite});
 const release=(index,value=receipt())=>requests[index].release(vm.runInContext('('+JSON.stringify(value)+')',context,{timeout:1000}));
 const mutate=(target,attributeName)=>{for(const observer of observers)if(observer.active&&observer.targets.some(t=>t.target===target&&t.options.attributes===true&&t.options.attributeFilter.includes(attributeName)))observer.callback([{type:'attributes',target,attributeName}],observer);};
 return {api,context,doc,requests,calls,release,mutate,availability:()=>availability(),click:()=>listeners.get('terminalHelp:click')(),command:id=>subscriptions.get('help')?.(id),invalidate:()=>subscriptions.get('context')?.({changed:true})};
}
const opens=f=>f.calls.filter(c=>c==='open').length;
test('button Help is readable with unavailable execution only after a fresh valid read receipt',async()=>{
 const f=entryFixture();assert.equal(f.api.snapshot().available,false);assert.equal(f.availability(),false);void f.click();await tick();assert.equal(f.requests.length,1);assert.equal(opens(f),0);f.release(0);await tick();assert.equal(opens(f),1);assert.equal(f.availability(),true);f.api.dispose();
});
test('fixed MAIN Help command and button use fresh same handshake; newer request retires older reply',async()=>{
 const f=entryFixture();f.command('unknown');await tick();assert.equal(f.requests.length,0);void f.click();await tick();f.command('desktopHelpDiagnostics');await tick();assert.equal(f.requests.length,2);f.release(0);await tick();assert.equal(opens(f),0);f.release(1);await tick();assert.equal(opens(f),1);f.api.dispose();
});
test('renderer strictly refuses foreign identity, malformed shape, extra fields and unreadable receipt',async()=>{
 for(const raw of [null,receipt({role:'docs'}),receipt({windowId:'22222222-2222-4222-8222-222222222222'}),receipt({projectId:''}),receipt({epoch:0}),receipt({epoch:1.5}),receipt({extra:true}),receipt({readable:false})]){
  const f=entryFixture();void f.click();await tick();assert.equal(f.requests.length,1);f.release(0,raw);await tick();assert.equal(opens(f),0);assert.equal(f.availability(),false);f.api.dispose();
 }
});
test('renderer receipt accessors and revoked proxies refuse without getter execution or opening',async()=>{
 const f=entryFixture();void f.click();await tick();assert.equal(f.requests.length,1);let reads=0;f.context.onGetter=()=>{reads++;};const raw=vm.runInContext('Object.defineProperty({readable:true,role:"terminal",windowId:'+JSON.stringify(wid)+',projectId:"project1",epoch:1},"ok",{enumerable:true,get(){onGetter();return true;}})',f.context);f.requests[0].release(raw);await tick();assert.equal(reads,0);assert.equal(opens(f),0);
 void f.click();await tick();const revoked=vm.runInContext('(()=>{const r=Proxy.revocable({},{});r.revoke();return r.proxy;})()',f.context);f.requests[1].release(revoked);await tick();assert.equal(opens(f),0);f.api.dispose();
});
test('context invalidation fences pending and cached Help authority until another fresh request',async()=>{
 const f=entryFixture();void f.click();await tick();assert.equal(f.requests.length,1);f.invalidate();f.release(0);await tick();assert.equal(opens(f),0);assert.equal(f.availability(),false);
 void f.click();await tick();f.release(1);await tick();assert.equal(opens(f),1);f.invalidate();assert.equal(f.availability(),false);assert.ok(f.calls.includes('close'));f.api.dispose();
});
test('disposal fences held Help read, fixed command and cached button callback',async()=>{
 const f=entryFixture();void f.click();await tick();assert.equal(f.requests.length,1);f.api.dispose();f.release(0);await tick();assert.equal(opens(f),0);assert.equal(f.availability(),false);void f.click();f.command('desktopHelpDiagnostics');await tick();assert.equal(f.requests.length,1);assert.equal(f.calls.filter(c=>c==='help-dispose').length,1);assert.equal(f.calls.filter(c=>c==='observer-off').length,1);
});
test('covered or transiently covered document cannot use cached or held Help authority after uncover',async()=>{
 const f=entryFixture();void f.click();await tick();assert.equal(f.requests.length,1);f.release(0);await tick();assert.equal(opens(f),1);f.doc.documentElement.style.visibility='hidden';assert.equal(f.availability(),false);f.doc.documentElement.style.visibility='visible';f.doc.body.inert=true;assert.equal(f.availability(),false);f.doc.body.inert=false;f.doc.documentElement.dataset.desktopLocked='true';assert.equal(f.availability(),false);f.api.dispose();
 for(const [name,cover,uncover,target]of [
  ['inert',d=>d.body.inert=true,d=>d.body.inert=false,d=>d.body],
  ['style',d=>d.documentElement.style.visibility='hidden',d=>d.documentElement.style.visibility='visible',d=>d.documentElement],
  ['data-desktop-locked',d=>d.documentElement.dataset.desktopLocked='true',d=>d.documentElement.dataset.desktopLocked='false',d=>d.documentElement],
 ]){const held=entryFixture();void held.click();await tick();assert.equal(held.requests.length,1);cover(held.doc);uncover(held.doc);held.mutate(target(held.doc),name);held.release(0);await tick();assert.equal(opens(held),0,name+' cover/uncover retires old request');assert.equal(held.availability(),false);void held.click();await tick();held.release(1);await tick();assert.equal(opens(held),1,'Only fresh read after uncover can open');held.api.dispose();}
});
test('missing bridge/invalidation and rejected read stay closed with no automatic retry even if execution available',async()=>{
 for(const options of [{available:true,missingRead:true},{available:true,missingInvalidation:true},{available:true,invalidInvalidation:'throw'},{available:true,invalidInvalidation:'nonfunction'}]){const f=entryFixture(options);void f.click();f.command('desktopHelpDiagnostics');await tick();assert.equal(opens(f),0);assert.equal(f.requests.length,0);f.api.dispose();}
 const f=entryFixture({available:true});void f.click();await tick();assert.equal(f.requests.length,1);f.requests[0].reject(Error('finite read failure'));await tick();assert.equal(opens(f),0);assert.equal(f.availability(),false);await tick();assert.equal(f.requests.length,1);f.api.dispose();
});
