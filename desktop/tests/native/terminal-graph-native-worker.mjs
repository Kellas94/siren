// Fixed zero-Session graph/host qualification. Synthetic window; real graph/addon.
// Never imported by the product and never accepts user commands.
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {createTerminalShutdownGraph} from '../../src/terminal/shutdown-graph.mjs';
import {validateHostAsyncReceipt} from '../../src/terminal/host-async-receipt-contract.mjs';
import {graphNativeModes} from './terminal-graph-native-verdict.mjs';
const dir=process.cwd(),config=JSON.parse(readFileSync(join(dir,'config.json'),'utf8'));
const digest=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const write=(name,value)=>{const p=join(dir,name);writeFileSync(p+'.tmp',JSON.stringify(value),{flag:'wx'});renameSync(p+'.tmp',p);};
const wait=async name=>{for(let i=0;i<1600;i++){if(existsSync(join(dir,name)))return JSON.parse(readFileSync(join(dir,name),'utf8'));await delay(5);}throw Error('PROTOCOL_DEADLINE:'+name);};
const watchdog=setTimeout(()=>process.exit(124),25000);
try{
 assert(graphNativeModes.includes(config.mode));assert.equal(digest(process.execPath),config.nodeHash);assert.equal(digest(config.addon),config.addonHash);
 for(const row of config.inputs)assert.equal(digest(row.path),row.sha256,'INPUT_CHANGED:'+row.path);
 const native=createRequire(import.meta.url)(config.addon),mark=native.mark();
 const root=spawn(process.execPath,[config.payload,'host',dir],{cwd:dir,stdio:'ignore',windowsHide:true});
 const canary=spawn(process.execPath,[config.payload,'canary',dir],{cwd:dir,stdio:'ignore',windowsHide:true});
 await wait('host-ready.json');await wait('canary-ready.json');
 // Test-only facade preserves original export receiver and unmodified results.
 const state={host:null,startCalls:0,stopCalls:0,stopPromise:null},facade=Object.create(null);
 for(const [key,d] of Object.entries(Object.getOwnPropertyDescriptors(native))){
  assert(Object.hasOwn(d,'value'));if(typeof d.value!=='function')continue;const fn=d.value;
  facade[key]=(...args)=>{if(key==='start')state.startCalls++;if(key==='stopAndCloseHostAsync')state.stopCalls++;const value=Reflect.apply(fn,native,args);if(key==='start')state.host=value;if(key==='stopAndCloseHostAsync')state.stopPromise=value;return value;};
 }
 class SyntheticWindow extends EventEmitter{
  constructor(){super();this.id=902;this.webContents=new EventEmitter();Object.assign(this.webContents,{id:1902,mainFrame:{url:'siren://app/app.html'},isDestroyed:()=>false,getURL:()=>this.webContents.mainFrame.url});}
  isDestroyed(){return false;}isMinimized(){return false;}focus(){}restore(){}
 }
 const synthetic=new SyntheticWindow(),registry=new WindowRegistry({createWindow:()=>{throw Error('No native view in this fixture');},authorize:()=>({projectId:'project1',mode:'normal',access:'write',entityIds:[]})});
 registry.bindWorkspace(synthetic);registry.activateWorkspace();const grant=registry.capture({sender:synthetic.webContents,senderFrame:synthetic.webContents.mainFrame});
 let locked=false,providerEntered=0,releaseProvider;const provider=new Promise(resolve=>{releaseProvider=resolve;});
 const held=['graph-held-cwd','negative-provider-held'].includes(config.mode);
 const graph=createTerminalShutdownGraph({projectId:'project1',registry,native:facade,hostProcessIdentity:{pid:root.pid,image:process.execPath,since:mark},
  ownership:{isCurrent:()=>true,onUnavailable:()=>{},onVerified:()=>{}},creator:{executable:process.execPath,entry:config.payload,directory:dir},
  cwd:{pickDirectory:()=>{providerEntered++;return held?provider:Promise.resolve({canceled:true,filePaths:[]});},protectedRoots:[dir],inspectDirectory:()=>Promise.reject(Error('No directory grant in this fixture'))},
  profiles:{grants:[grant],getSystemDirectory:()=>Promise.reject(Error('No shell profile requested')),inspectExecutable:()=>Promise.reject(Error('No executable requested')),readEnvironment:()=>Promise.reject(Error('No environment requested')),privateEnvironmentKeys:[]},
  access:{prepareWorkspace:()=>Promise.resolve(),retireViews:()=>Promise.resolve(),rollbackWorkspace:()=>Promise.resolve(),isReady:()=>!locked},
  policy:{isUnlocked:()=>!locked,getMode:()=> 'normal',canExecute:()=>true},deadlineMs:1000});
 assert.equal(graph.start().ok,true);assert.equal(state.startCalls,1);assert.equal(state.stopCalls,0);
 const members=graph.mainAuthorities(),handle=graph.captureSettlement();let cwdPromise=null;
 if(held){cwdPromise=members.cwdAuthority.pick(grant);cwdPromise.catch(()=>{});for(let i=0;i<200&&providerEntered===0;i++)await delay(5);assert.equal(providerEntered,1);}
 const before=native.capture(state.host);assert(before.root.alive);assert.equal(before.held.length,before.active);
 write('before.json',{mainPid:process.pid,canaryPid:canary.pid,mode:config.mode,before,sessionCount:0,peerCount:0,sessionCaptures:[],graphBefore:handle.snapshot(),syntheticWindow:true});
 await wait('go.json');let lockPreserved=false;
 if(config.mode==='graph-lock'){
  assert.equal((await members.access.beginLock()).ok,true);locked=true;
  lockPreserved=state.stopCalls===0&&handle.snapshot().requested===false&&members.ownership.captureOwnershipSettlement().snapshot().retired===false&&members.manager.captureManagerSettlement().snapshot().retired===false&&native.snapshot(state.host).root.alive===true;
  assert(lockPreserved);write('graph-lock.json',{lockPreserved,graph:handle.snapshot(),stopCalls:state.stopCalls,root:native.snapshot(state.host).root,ownerRetired:members.ownership.captureOwnershipSettlement().snapshot().retired,managerRetired:members.manager.captureManagerSettlement().snapshot().retired,inputClosed:members.manager.stats().inputClosed});
 }
 if(config.mode==='graph-host-loss'){const exited=new Promise(resolve=>root.once('exit',resolve));assert(root.kill());await exited;}
 const request={code:77,deadlineMs:5000,shutdownId:'native_'+config.mode},started=performance.now(),completion=graph.shutdown(request);
 assert.equal(completion,handle.actualSettled);const duplicateSame=graph.shutdown({...request})===completion,conflictRefused=graph.shutdown({...request,code:98})===null;assert(duplicateSame&&conflictRefused);
 let hold=null;
 if(held){
  await delay(config.mode==='graph-held-cwd'?5500:25);const snapshot=handle.snapshot();
  hold={elapsedMs:performance.now()-started,requested:snapshot.requested,actualSettled:snapshot.actualSettled,hostStarted:snapshot.hostStarted,stopCalls:state.stopCalls,rootAlive:native.snapshot(state.host).root.alive};
  assert.equal(hold.requested,true);assert.equal(hold.actualSettled,false);assert.equal(hold.hostStarted,false);assert.equal(hold.stopCalls,0);assert.equal(hold.rootAlive,true);write('graph-blocked.json',hold);
  if(config.mode==='graph-held-cwd'){assert(hold.elapsedMs>=5500);releaseProvider({canceled:true,filePaths:[]});await cwdPromise.catch(()=>{});}
 }
 const graphResult=await completion;assert.equal(graphResult.actualSettled,true);assert.equal(graphResult.unknown,false);assert.equal(state.stopCalls,1);assert.equal(graph.mainAuthorities(),null);
 const receipt=await state.stopPromise,expected=native.captureHostShutdownExpectation(state.host,request.shutdownId),checked=validateHostAsyncReceipt(expected,receipt);assert.equal(checked.ok,true);
 write('after.json',{status:'GRAPH_NATIVE_OPERATION_COMPLETED',mode:config.mode,graph:graphResult,receipt,expected,checked,startCalls:state.startCalls,stopCalls:state.stopCalls,duplicateSame,conflictRefused,lockPreserved,hold,elapsedMs:performance.now()-started,nativeExecutionAdmitted:false,scope:'BOUNDED_WINDOWS_NODE_GRAPH_COMPOSITION'});
 await wait('release.json');writeFileSync(join(dir,'canary-release.txt'),'release',{flag:'wx'});await new Promise((resolve,reject)=>{if(canary.exitCode!==null)return resolve();canary.once('exit',resolve);canary.once('error',reject);});clearTimeout(watchdog);
}catch(error){try{write('worker-error.json',{message:error.message,stack:error.stack});}catch{}console.error(error);process.exitCode=1;clearTimeout(watchdog);}
