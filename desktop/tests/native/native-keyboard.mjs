import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

export async function reserveInspectorPort(){const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}
/** Owned-fixture instrumentation only. Chromium CDP key dispatch does not
 * qualify Electron's native menu/before-input-event route. Use the actual
 * WebContents input API in the independently PID-checked main inspector.
 * No product IPC, PIN bypass, source mutation or renderer click is exposed. */
export async function attachNativeKeyboard({port,pid}){
 let target;const deadline=Date.now()+15000;
 while(Date.now()<deadline){try{const targets=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json();target=targets.find(t=>t.type==='node');if(target)break;}catch{}await delay(100);}
 assert.ok(target,'Owned main inspector required');const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let serial=0;
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{const data=JSON.parse(event.data),request=pending.get(data.id);if(request){pending.delete(data.id);data.error?request.reject(Error(JSON.stringify(data.error))):request.resolve(data.result);}});
 const evaluate=expression=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Error('Owned native input inspector deadline'));},10000);pending.set(id,{resolve:result=>{clearTimeout(timer);if(result.exceptionDetails)reject(Error(JSON.stringify(result.exceptionDetails)));else resolve(result.result.value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));});
 assert.equal(await evaluate('process.pid'),pid,'Inspector must belong to the launched fixture main process');
 const ownedViewURL=url=>assert.match(url,/^siren:\/\/app\/(?:home\.html|app\.html|windows\/(?:code|docs|diagram|presenter|audience)\.html\?windowId=[a-f0-9-]{36})$/);
 const windowExpression=url=>`process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron').BrowserWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents.getURL()===${JSON.stringify(url)})`;
 return {close:()=>ws.close(),windowState:async url=>{ownedViewURL(url);return evaluate(`(()=>{const w=${windowExpression(url)};if(!w)throw Error('Owned native window unavailable');return {focused:w.isFocused(),fullScreen:w.isFullScreen(),minimized:w.isMinimized(),visible:w.isVisible(),bounds:w.getBounds()};})()`);},
 minimizeView:async url=>{ownedViewURL(url);return evaluate(`(()=>{const w=${windowExpression(url)};if(!w)throw Error('Owned presentation window unavailable');w.minimize();return true;})()`);},
 focusView:async url=>{ownedViewURL(url);return evaluate(`(()=>{const w=${windowExpression(url)};if(!w)throw Error('Owned native window unavailable');w.focus();w.webContents.focus();return true;})()`);},
 windowShortcut:async(url,keyCode)=>{
  ownedViewURL(url);assert.ok(['Right','Left','1'].includes(keyCode));
  await evaluate(`(()=>{const w=${windowExpression(url)};if(!w)throw Error('Owned native input target unavailable');w.focus();w.webContents.focus();return true;})()`);
  for(const type of ['keyDown','keyUp'])await evaluate(`(()=>{const w=${windowExpression(url)};if(!w)throw Error('Owned native input target unavailable');w.webContents.sendInputEvent(${JSON.stringify({type,keyCode,modifiers:['control','alt']})});return true;})()`);
 },
 shortcut:async(keyCode,modifiers)=>{
  assert.ok([',','U','L'].includes(keyCode));assert.ok(Array.isArray(modifiers)&&modifiers.every(m=>['control','alt'].includes(m)));
  for(const type of ['keyDown','keyUp'])await evaluate(`(()=>{const e=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');const w=e.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='siren://app/home.html');if(!w||w.isDestroyed())throw Error('Owned Home input target unavailable');w.webContents.focus();w.webContents.sendInputEvent(${JSON.stringify({type,keyCode,modifiers})});return true;})()`);
 }};
}
