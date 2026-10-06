import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
/** Owned-fixture OS chooser adapter. Actual main IPC, validator, copy and
 * selection run unchanged; this does not qualify manual OS dialog interaction. */
export async function attachBundleChooser({port,pid,file}){
 let target;const deadline=Date.now()+15000;
 while(Date.now()<deadline){try{target=(await(await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==='node');if(target)break;}catch{}await delay(100);}
 assert.ok(target,'Owned main inspector required');const ws=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let serial=0;
 await new Promise((yes,no)=>{ws.addEventListener('open',yes,{once:true});ws.addEventListener('error',no,{once:true});});
 ws.addEventListener('message',event=>{const r=JSON.parse(event.data),p=pending.get(r.id);if(p){pending.delete(r.id);clearTimeout(p.timer);r.error?p.no(Error(JSON.stringify(r.error))):p.yes(r.result);}});
 const evaluate=expression=>new Promise((yes,no)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);no(Error('Owned chooser inspector timeout'));},10000);pending.set(id,{timer,yes:r=>r.exceptionDetails?no(Error(JSON.stringify(r.exceptionDetails))):yes(r.result.value),no});ws.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));});
 assert.equal(await evaluate('process.pid'),pid);
 const electron=`process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron')`;
 await evaluate(`(()=>{const e=${electron},chosen=${JSON.stringify(file)},open=e.dialog.showOpenDialog,message=e.dialog.showMessageBox;globalThis.__ownedBundleChooser={calls:[],restore:()=>{e.dialog.showOpenDialog=open;e.dialog.showMessageBox=message;}};e.dialog.showOpenDialog=async(...args)=>{const o=args.at(-1);if(!['Open a SIREN project','Import an exported SIREN project'].includes(o?.title))throw Error('Unexpected chooser');globalThis.__ownedBundleChooser.calls.push({title:o.title,extensions:o.filters?.[0]?.extensions??null});return {canceled:false,filePaths:[chosen]};};e.dialog.showMessageBox=async(...args)=>args.at(-1)?.title==='SIREN local project'?{response:2,checkboxChecked:false}:message.apply(e.dialog,args);return true;})()`);
 return {observations:()=>evaluate('globalThis.__ownedBundleChooser.calls'),close:async()=>{try{await evaluate('globalThis.__ownedBundleChooser.restore();true');}finally{ws.close();}}};
}
