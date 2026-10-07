import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {dispatchNativeHelp} from '../src/help/native.mjs';
import * as helpNative from '../src/help/native.mjs';
test('native F1 handler routes exact unmodified key once and consumes repeats without new authority',()=>{
 let invoked=0,prevented=0;const originWindow={},args={originWindow,event:{preventDefault(){prevented++;}},dispatch:origin=>{assert.equal(origin,originWindow);invoked++;}};
 assert.equal(typeof helpNative.handleNativeHelpInput,'function');
 for(const input of [{type:'keyDown',key:'F1',control:true},{type:'keyUp',key:'F1'},{type:'keyDown',key:'F1',isComposing:true},{type:'keyDown',key:'F2'}])assert.equal(helpNative.handleNativeHelpInput({...args,input}),false);
 assert.equal(helpNative.handleNativeHelpInput({...args,input:{type:'keyDown',key:'F1'}}),true);assert.equal(invoked,1);
 assert.equal(helpNative.handleNativeHelpInput({...args,input:{type:'keyDown',key:'F1',isAutoRepeat:true}}),true);assert.equal(invoked,1);assert.equal(prevented,2);
});
function nativeFixture(){
 const sent=[],main={webContents:{mainFrame:{},send:(...v)=>sent.push(['main',...v])},isDestroyed:()=>false},code={webContents:{mainFrame:{},send:(...v)=>sent.push(['code',...v])},isDestroyed:()=>false};
 const grants=new WeakMap([[main.webContents,{role:'workspace'}],[code.webContents,{role:'code'}]]);let live=true,selected=false;
 const args={mainWindow:main,originWindow:code,windowFor:id=>id==='code'?code:null,selectedSurface:()=>selected?'code':null,capture:event=>event.senderFrame===event.sender.mainFrame?grants.get(event.sender):null,isCurrent:grant=>live&&[...['workspace','code']].includes(grant?.role),canRead:()=>live};
 return {args,sent,main,code,deny:()=>live=false,attach:()=>selected=true};
}
test('native Help dispatches only a fixed command to the current registered origin',()=>{
 const f=nativeFixture();assert.equal(dispatchNativeHelp(f.args),true);assert.deepEqual(f.sent,[['code','siren:command','desktopHelpDiagnostics']]);
 f.attach();assert.equal(dispatchNativeHelp({...f.args,originWindow:f.main}),true);assert.equal(f.sent.at(-1)[0],'code');
});
test('native Help refuses absent, stale, Audience and asynchronous truthiness authority',()=>{
 for(const patch of [{canRead:()=>false},{canRead:()=>Promise.resolve(true)},{capture:()=>null},{capture:()=>({role:'audience'})},{isCurrent:()=>false},{originWindow:{isDestroyed:()=>true}}]){const f=nativeFixture();assert.equal(dispatchNativeHelp({...f.args,...patch}),false);assert.equal(f.sent.length,0);}
 const f=nativeFixture();f.deny();assert.equal(dispatchNativeHelp(f.args),false);assert.equal(f.sent.length,0);
});
test('preloads expose only a fixed read-only Help event and unsubscribe cleanly',async()=>{
 for(const [path,pathname] of [['src/preload.cjs','/home.html'],['src/windows/preload.cjs','/windows/code.html'],['src/windows/presentation-preload.cjs','/windows/presenter.html']]){
  const bridges={},listeners=new Map();let invoked=0,calls=0;
  const electron={contextBridge:{exposeInMainWorld:(name,value)=>bridges[name]=value},ipcRenderer:{sendSync(){return {mode:'normal'};},invoke(){invoked++;},on(channel,fn){const rows=listeners.get(channel)||[];rows.push(fn);listeners.set(channel,rows);},removeListener(channel,fn){listeners.set(channel,(listeners.get(channel)||[]).filter(x=>x!==fn));}}};
  runInNewContext(await readFile(path,'utf8'),{require:()=>electron,location:{pathname,search:'?windowId=test'},URLSearchParams,console});
  assert.equal(typeof bridges.sirenShell.onHelp,'function');const off=bridges.sirenShell.onHelp(()=>calls++);
  for(const id of ['desktopRecovery','arbitrary','desktopHelpDiagnostics'])for(const callback of listeners.get('siren:command')||[])callback({},id);
  assert.equal(calls,1);assert.equal(invoked,0);off();for(const callback of listeners.get('siren:command')||[])callback({},'desktopHelpDiagnostics');assert.equal(calls,1);
 }
 const exposed=[];runInNewContext(await readFile('src/windows/presentation-preload.cjs','utf8'),{require:()=>({contextBridge:{exposeInMainWorld:name=>exposed.push(name)},ipcRenderer:{}}),location:{pathname:'/windows/audience.html'},console});assert.ok(!exposed.includes('sirenShell'));
});
