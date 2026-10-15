// ROOT synthetic trusted callbacks; no native/backend allocation or shell.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalProductionManager} from '../src/terminal/production-manager.mjs';
import {inertConfig,inertTick} from './fixtures/terminal-production-inert.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
function setup({hook=()=>{},cwd,profile,deadlineMs=20}={}){
 const calls={capture:0,ready:0,policy:0,cwd:0,profile:0,prepare:0},config=inertConfig(),grant=Object.freeze({projectId:'project1',windowId:'window1',epoch:1,role:'workspace'});let manager,armed=false,n=0;
 const visit=name=>{calls[name]++;if(armed)hook(name,h);};
 const backend={prepare(){calls.prepare++;throw Error('No native preparation authorized by this fixture');},allocate(){throw Error('No allocation');},connect(){throw Error('No connection');},stopSession(){throw Error('No owner');},sessionStatus(){throw Error('No owner status');},sendGate:p=>Object.freeze({ok:true,...p}),isAvailable:()=>true,subscribeUnavailable:()=>{}};
 manager=new TerminalProductionManager({registry:{isCurrent:()=>true,captureAdmissionGuard(){visit('capture');return{isCurrent:()=>true};}},policy:{authorize(){visit('policy');return{ok:true};}},backend,accessReady(){visit('ready');return true;},cwdAuthority:{resolve(){calls.cwd++;return cwd?cwd():Promise.resolve(config.cwd);}},profilesFor:()=>({resolveShellProfile(){calls.profile++;return profile?profile():Promise.resolve(config.shell);}}),deadlineMs});
 const h={manager,calls,grant,create:g=>manager.create(g??grant,{operationId:'create_'+ ++n,epoch:1,cwdId:'cwd1',profileId:'powershell',cols:120,rows:40}),async open(){await manager.resumeInput();armed=true;},async close(){armed=false;await manager.closeInput('fixture cleanup');}};return h;
}
for(const point of ['capture','ready','policy'])test(`create reserves its eight-slot budget before reentrant ${point} callbacks`,async()=>{
 const held=deferred(),pending=[];let remaining=8,depth=0,maximum=0;const h=setup({cwd:()=>held.promise,hook:(name,h)=>{if(name!==point)return;depth++;maximum=Math.max(maximum,depth);try{if(remaining>0){remaining--;pending.push(h.create());}}finally{depth--;}}});
 try{await h.open();pending.push(h.create());assert.equal(maximum,8,'refuse ninth provisional callback before entering it');assert.equal(h.calls.cwd,8);assert.equal(h.manager.stats().reservedSessions,8);assert.equal((await h.create()).code,'CAPACITY_EXCEEDED');assert.equal(h.calls.cwd,8);assert.equal(h.calls.prepare,0);
 }finally{await h.close();held.resolve(inertConfig().cwd);const results=await Promise.all(pending);assert.equal(results.length,9);assert(results.every(r=>r.ok===false));await inertTick();assert.equal(h.manager.stats().reservedSessions,0);}
});
for(const stage of ['cwd','profile'])for(const mode of ['throw','thenable','subclass','constructor'])test(`entered unobservable ${stage}/${mode} retains eight finite reservations`,async()=>{
 let getters=0;class OtherPromise extends Promise{}
 const work=()=>{if(mode==='throw')throw Error('callback entered, outcome unknown');if(mode==='thenable')return Object.defineProperty({},'then',{get(){getters++;throw Error('never assimilate');}});if(mode==='subclass')return new OtherPromise(()=>{});const p=new Promise(()=>{});Object.defineProperty(p,'constructor',{get(){getters++;throw Error('never read constructor');}});return p;};
 const h=setup({[stage]:work,deadlineMs:10});try{await h.open();const results=await Promise.all(Array.from({length:8},()=>h.create()));assert(results.every(r=>!r.ok));assert.equal(getters,0);assert.equal(h.manager.stats().reservedSessions,8);assert.equal(h.manager.stats().pendingOperations,8);assert.equal(h.manager.stats().quarantinedOperations,8);assert.equal((await h.create()).code,'CAPACITY_EXCEEDED');assert.equal(h.calls[stage],8);assert.equal(h.calls.prepare,0);await h.close();assert.equal(h.manager.stats().reservedSessions,8,'Lock cannot manufacture completion');}finally{await h.close();}
});
for(const stage of ['cwd','profile'])test(`observed ${stage} rejection releases local create capacity without allocating`,async()=>{
 const h=setup({[stage]:()=>Promise.reject(Error('known completed negative'))});try{await h.open();for(let i=0;i<10;i++){assert.equal((await h.create()).ok,false);await inertTick();assert.equal(h.manager.stats().reservedSessions,0);}assert.equal(h.calls.prepare,0);assert.equal(h.manager.stats().quarantinedOperations,0);}finally{await h.close();}
});
test('invalid create request and Lock refuse before trusted admission callbacks',async()=>{
 const h=setup();await h.open();const before={...h.calls};assert.equal((await h.create({...h.grant,epoch:0})).ok,false);assert.equal(h.calls.capture,before.capture);await h.close();const closed={...h.calls};assert.equal((await h.create()).code,'PIN_REQUIRED');assert.equal(h.calls.capture,closed.capture);assert.equal(h.calls.cwd,0);
});
