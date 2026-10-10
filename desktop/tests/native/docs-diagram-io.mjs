// Disposable hosted fixture only. No product service, validator, handler or
// publication result is replaced. The sole dialog adapter selects our backup;
// Ctrl+Q uses Electron WebContents input, not Chromium CDP key dispatch.
import assert from 'node:assert/strict';
import {createServer} from 'node:net';
import {isAbsolute} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

function hosted(){
 assert.equal(process.platform,'win32');
 assert.equal(process.env.GITHUB_ACTIONS,'true');
 assert.equal(process.env.GITHUB_REPOSITORY,'Kellas94/siren');
 assert.equal(process.env.GITHUB_REF,'refs/heads/probe/docs-diagram-embeds-20261010');
}
export async function reserveDocsInspectorPort(){
 hosted();const server=createServer();
 await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
 const port=server.address().port;await new Promise(yes=>server.close(yes));return port;
}
export async function attachDocsIO({port,pid,file}){
 hosted();assert.ok(Number.isSafeInteger(pid)&&pid>0);assert.ok(isAbsolute(file)&&file.endsWith('.siren-backup'));
 let target;const end=Date.now()+15000;
 while(Date.now()<end){try{target=(await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)})).json()).find(t=>t.type==='node');if(target)break;}catch{}await delay(100);}
 assert.ok(target,'Owned main inspector required');const address=new URL(target.webSocketDebuggerUrl);
 assert.equal(address.hostname,'127.0.0.1');assert.equal(Number(address.port),port);
 const ws=new WebSocket(address),pending=new Map();let serial=0,adapted=false;
 const failAll=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.no(Error('Owned main inspector disconnected'));}pending.clear();};
 ws.addEventListener('close',failAll);ws.addEventListener('error',failAll);
 await new Promise((yes,no)=>{const timer=setTimeout(()=>{ws.close();no(Error('Owned inspector connection deadline'));},10000);ws.addEventListener('open',()=>{clearTimeout(timer);yes();},{once:true});ws.addEventListener('error',()=>{clearTimeout(timer);no(Error('Owned inspector connection failed'));},{once:true});});
 ws.addEventListener('message',event=>{const r=JSON.parse(event.data),p=pending.get(r.id);if(p){pending.delete(r.id);clearTimeout(p.timer);r.error?p.no(Error(JSON.stringify(r.error))):p.yes(r.result);}});
 const evaluate=expression=>new Promise((yes,no)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);no(Error('Owned Docs IO deadline'));},10000);pending.set(id,{timer,no,yes:r=>r.exceptionDetails?no(Error(JSON.stringify(r.exceptionDetails))):yes(r.result.value)});ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});
 const electron="process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron')";
 try{
  assert.equal(await evaluate('process.pid'),pid,'Inspector PID must match our launched Electron');
  await evaluate(`(()=>{const e=${electron},open=e.dialog.showOpenDialog; if(globalThis.__docsEmbedChooser)throw Error('Chooser already installed');globalThis.__docsEmbedChooser={calls:[],restore:()=>{e.dialog.showOpenDialog=open;}};e.dialog.showOpenDialog=async(...args)=>{const o=args.at(-1);if(o?.title!=='Open a SIREN project')throw Error('Unexpected chooser');globalThis.__docsEmbedChooser.calls.push({title:o.title,extensions:o.filters?.[0]?.extensions??null});return {canceled:false,filePaths:[${JSON.stringify(file)}]};};return true;})()`);adapted=true;
 }catch(error){ws.close();throw error;}
 const restoreChooser=async()=>{if(adapted){await evaluate('globalThis.__docsEmbedChooser.restore();true');adapted=false;}};
 return {
  observations:()=>evaluate('globalThis.__docsEmbedChooser.calls'),
  restoreChooser,
  quitFromDocs:async url=>{
   assert.match(url,/^siren:\/\/app\/windows\/docs\.html\?windowId=[a-f0-9-]{36}$/);
   assert.equal(adapted,false,'Restore chooser before testing normal quit');
   return evaluate(`(()=>{const e=${electron},w=e.BaseWindow.getAllWindows().find(w=>!w.isDestroyed()&&w.webContents?.getURL()===${JSON.stringify(url)});if(!w)throw Error('Owned Docs input target required');w.focus();const c=w.webContents;c.focus();const observed={pid:process.pid,url:c.getURL(),contentsId:c.id,route:'Electron WebContents.sendInputEvent'};c.sendInputEvent({type:'keyDown',keyCode:'Q',modifiers:['control']});if(!c.isDestroyed())c.sendInputEvent({type:'keyUp',keyCode:'Q',modifiers:['control']});return observed;})()`);
  },
  close:async()=>{try{await restoreChooser();}finally{ws.close();}}
 };
}
