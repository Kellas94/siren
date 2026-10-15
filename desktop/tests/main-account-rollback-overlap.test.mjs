import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {EventEmitter} from 'node:events';
import {AccountService} from '../src/account/service.mjs';
import {invokeDesktop,failure} from '../src/ipc.mjs';
const main=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
const slice=(start,end)=>{const a=main.indexOf(start),b=main.indexOf(end,a);assert.ok(a>=0&&b>a);return main.slice(a,b);};
const defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function fixture({failRollback=false,holdEnd=false,failLogout=false}={}){
 const rollbackEntered=defer(),rollbackRelease=defer(),endEntered=defer(),endRelease=defer(),window=new EventEmitter();
 let destroyed=false,rollbacks=0,credentialClears=0,preparations=0,retirements=0,journals=0;
 window.webContents={mainFrame:{url:'siren://app/app.html'},executeJavaScript:async expression=>{if(holdEnd&&expression.includes('sirenDesktopEndAccountTransition')){endEntered.resolve();await endRelease.promise;}}};
 window.close=()=>{let cancelled=false;window.emit('close',{preventDefault(){cancelled=true;}});if(!cancelled)destroyed=true;};
 const account=new AccountService({config:{permitKeys:{}},credentials:{read:async()=>null,write:async()=>{},clear:async()=>{credentialClears++;if(failLogout)throw Error('Controlled credential clear refusal');}},openBrowser:()=>{throw Error('No browser permitted');}});
 const handlers=new Map(),context=vm.createContext({window,account,invokeDesktop,failure,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},
  writes:new Set(),accountTransition:false,accountQuiesced:false,pinTransition:false,terminalRuntime:null,
  localPin:{busy:false,state:()=>({unlocked:true}),cancelPending(){},drain:async()=>{}},
  prepareNativeWorkspace:async()=>{preparations++;},retireNativeViews:async()=>{retirements++;},rollbackNativePreparation:async()=>{rollbacks++;rollbackEntered.resolve();await rollbackRelease.promise;if(failRollback)throw Error('Controlled rollback refusal');},
  nativeLayoutMemory:{flush:async()=>true},windowRegistry:{activateWorkspace(){}},grants:new Set(['owned']),selectedId:'owned',snapshot:{},bootstrap:{},mode:'normal',reason:null,
  app:{getVersion:()=> 'fixture'},processIdentity:{pid:1,path:'owned',startedAt:'owned'},sessionId:'owned',
  journal:{recordSession:async()=>{journals++;}},dialog:{showErrorBox(){}},console:{info(){},warn(){}}
 });
 vm.runInContext('const services={'+slice('  beginLogin: async () => {','  getUpdate:')+'};\n'+slice("ipcMain.handle('siren:desktop',", "ipcMain.handle('siren:sources',")+slice('let closing = false;','requestDocsDiagramScan();'),context);
 const invoke=method=>handlers.get('siren:desktop')({sender:window.webContents,senderFrame:window.webContents.mainFrame},method);
 return {context,window,invoke,rollbackEntered,rollbackRelease,endEntered,endRelease,counts:()=>({rollbacks,credentialClears,preparations,retirements,journals,destroyed})};
}
test('ordinary failed Login completes rollback before returning; later Logout remains available',async()=>{
 const f=fixture(),first=f.invoke('beginLogin');await f.rollbackEntered.promise;
 assert.equal(f.counts().credentialClears,0);f.rollbackRelease.resolve();assert.equal((await first).code,'ACCOUNT_NOT_CONFIGURED');
 await f.invoke('logout');assert.deepEqual(f.counts(),{rollbacks:1,credentialClears:1,preparations:1,retirements:1,journals:0,destroyed:false});
});
test('second Logout cannot retire views or clear credentials while failed Login rollback is held',async()=>{
 const f=fixture(),first=f.invoke('beginLogin');await f.rollbackEntered.promise;
 try{const second=await f.invoke('logout');assert.deepEqual({code:second.code,...f.counts()},{code:'ACCOUNT_BUSY',rollbacks:1,credentialClears:0,preparations:0,retirements:0,journals:0,destroyed:false});}
 finally{f.rollbackRelease.resolve();await first;}
});
test('Quit cannot journal or destroy its owner while failed Login rollback is held',async()=>{
 const f=fixture(),first=f.invoke('beginLogin');await f.rollbackEntered.promise;
 try{f.window.close();await new Promise(r=>setImmediate(r));assert.deepEqual(f.counts(),{rollbacks:1,credentialClears:0,preparations:0,retirements:0,journals:0,destroyed:false});}
 finally{f.rollbackRelease.resolve();await first;}
});

test('failed account keeps its reservation until renderer rollback completion',async()=>{
 const f=fixture({holdEnd:true}),first=f.invoke('beginLogin');await f.rollbackEntered.promise;f.rollbackRelease.resolve();await f.endEntered.promise;
 try{assert.equal(f.context.accountTransition,true);f.window.close();await new Promise(r=>setImmediate(r));assert.equal(f.counts().journals,0);assert.equal(f.counts().destroyed,false);}
 finally{f.endRelease.resolve();await first;}assert.equal(f.context.accountTransition,false);
});

test('rollback failure releases account reservation without returning a success receipt',async()=>{
 const f=fixture({failRollback:true}),first=f.invoke('beginLogin');await f.rollbackEntered.promise;f.rollbackRelease.resolve();
 assert.equal((await first).code,'OPERATION_FAILED');assert.equal(f.context.accountTransition,false);assert.equal(f.context.accountQuiesced,false);
});

test('failed Logout keeps its reservation while rollback is held and refuses a later Login',async()=>{
 const f=fixture({failLogout:true}),first=f.invoke('logout');await f.rollbackEntered.promise;let secondReceipt;const second=f.invoke('beginLogin').then(receipt=>secondReceipt=receipt);
 try{await new Promise(r=>setImmediate(r));assert.equal(secondReceipt?.code,'ACCOUNT_BUSY');assert.equal(f.context.accountTransition,true);assert.equal(f.counts().rollbacks,1);}
 finally{f.rollbackRelease.resolve();await Promise.all([first,second]);}assert.equal(f.context.accountTransition,false);
});
