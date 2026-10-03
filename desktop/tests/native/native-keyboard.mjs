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
 return {close:()=>ws.close(),shortcut:async(keyCode,modifiers)=>{
  assert.ok([',','U','L'].includes(keyCode));assert.ok(Array.isArray(modifiers)&&modifiers.every(m=>['control','alt'].includes(m)));
  for(const type of ['keyDown','keyUp'])await evaluate(`(()=>{const e=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron');const w=e.BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='siren://app/home.html');if(!w||w.isDestroyed())throw Error('Owned Home input target unavailable');w.webContents.focus();w.webContents.sendInputEvent(${JSON.stringify({type,keyCode,modifiers})});return true;})()`);
 }};
}
