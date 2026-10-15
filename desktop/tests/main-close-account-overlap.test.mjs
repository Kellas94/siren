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
function fixture(){
 const journalEntered=defer(),journalRelease=defer(),window=new EventEmitter();let destroyed=false,rollbacks=0,accountCalls=0,credentialClears=0;
 window.webContents={mainFrame:{url:'siren://app/app.html'},executeJavaScript:async()=>{}};
 window.close=()=>{let cancelled=false;window.emit('close',{preventDefault(){cancelled=true;}});if(!cancelled)destroyed=true;};
 const account=new AccountService({config:{permitKeys:{}},credentials:{read:async()=>null,write:async()=>{},clear:async()=>{credentialClears++;}},openBrowser:()=>{throw Error('No browser permitted');}});
 for(const name of ['beginLogin','logout']){const original=account[name].bind(account);account[name]=(...args)=>{accountCalls++;return original(...args);};}
 const handlers=new Map(),context=vm.createContext({window,account,invokeDesktop,failure,ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},
  writes:new Set(),accountTransition:false,accountQuiesced:false,pinTransition:false,terminalRuntime:null,
  localPin:{busy:false,state:()=>({unlocked:true}),cancelPending(){},drain:async()=>{}},
  prepareNativeWorkspace:async()=>{},retireNativeViews:async()=>{},rollbackNativePreparation:async()=>{rollbacks++;},
  nativeLayoutMemory:{flush:async()=>true},windowRegistry:{activateWorkspace(){}},grants:new Set(['owned']),selectedId:'owned',snapshot:{},bootstrap:{},mode:'normal',reason:null,
  app:{getVersion:()=> 'fixture'},processIdentity:{pid:1,path:'owned',startedAt:'owned'},sessionId:'owned',
  journal:{recordSession:async()=>{journalEntered.resolve();await journalRelease.promise;}},dialog:{showErrorBox(){}},console:{info(){},warn(){}}
 });
 vm.runInContext('const services={'+slice('  beginLogin: async () => {','  getUpdate:')+'};\n'+slice("ipcMain.handle('siren:desktop',", "ipcMain.handle('siren:sources',")+slice('let closing = false;','requestDocsDiagramScan();'),context);
 const invoke=(method='beginLogin')=>handlers.get('siren:desktop')({sender:window.webContents,senderFrame:window.webContents.mainFrame},method);
 return {context,window,invoke,journalEntered,journalRelease,rollbacks:()=>rollbacks,accountCalls:()=>accountCalls,credentialClears:()=>credentialClears,destroyed:()=>destroyed};
}
test('ordinary unconfigured Login retains existing account refusal and rollback',async()=>{
 const f=fixture();assert.equal((await f.invoke()).code,'ACCOUNT_NOT_CONFIGURED');assert.equal(f.accountCalls(),1);assert.equal(f.rollbacks(),1);
});
test('Quit held at durable journal must refuse a later account transition before rollback',async()=>{
 const f=fixture();f.window.close();await f.journalEntered.promise;
 try{assert.equal(f.context.pinTransition,true);assert.equal(f.destroyed(),false);await f.invoke();assert.deepEqual({accountCalls:f.accountCalls(),rollbacks:f.rollbacks()},{accountCalls:0,rollbacks:0},'Account transition must not enter or rollback while Quit owns pinTransition');}
 finally{f.journalRelease.resolve();await new Promise(r=>setImmediate(r));}
});
test('Quit with account transition already active preserves window without journalling',async()=>{
 const f=fixture();f.context.accountTransition=true;f.window.close();await new Promise(r=>setImmediate(r));assert.equal(f.destroyed(),false);assert.equal(f.context.pinTransition,false);assert.equal(f.rollbacks(),0);
});

test('ordinary Logout keeps the existing credential clear and completes its own transition',async()=>{
 const f=fixture();await f.invoke('logout');assert.equal(f.accountCalls(),1);assert.equal(f.credentialClears(),1);assert.equal(f.rollbacks(),0);assert.equal(f.context.accountTransition,false);
});

for(const method of ['beginLogin','logout'])test(method+' is busy during a held Quit before account work or credential changes',async()=>{
 const f=fixture();f.window.close();await f.journalEntered.promise;
 try{const receipt=await f.invoke(method);assert.deepEqual({code:receipt.code,accountCalls:f.accountCalls(),rollbacks:f.rollbacks(),credentialClears:f.credentialClears()},{code:'ACCOUNT_BUSY',accountCalls:0,rollbacks:0,credentialClears:0});}
 finally{f.journalRelease.resolve();await new Promise(r=>setImmediate(r));}
});

for(const method of ['beginLogin','logout'])test(method+' preserves other access transitions without entering an account transition',async()=>{
 const f=fixture();f.context.pinTransition=true;const receipt=await f.invoke(method);
 assert.deepEqual({code:receipt.code,accountCalls:f.accountCalls(),rollbacks:f.rollbacks(),credentialClears:f.credentialClears()},{code:'ACCOUNT_BUSY',accountCalls:0,rollbacks:0,credentialClears:0});assert.equal(f.context.pinTransition,true);assert.equal(f.context.accountTransition,false);
});
