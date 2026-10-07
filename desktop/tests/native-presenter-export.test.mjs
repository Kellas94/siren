import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFile,readdir,rm,writeFile,realpath} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {join,dirname,resolve,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from './fixtures/temporary.mjs';
import {ProjectStore} from '../src/projects/store.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
import {PresentationSession} from '../src/windows/presentation.mjs';
import {formatPresentationNotes} from '../src/documents/presentation-notes.mjs';
import {exportClassAtOwnedFile} from './fixtures/export-await-phase.mjs';
const module=await import('../src/windows/presenter-export.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const v='a'.repeat(64),next='b'.repeat(64);
async function fixture(t,format,Service=module.NativePresenterExports){
 const root=await mkdtemp(join(tmpdir(),'siren-presenter-export-'));t.after(async()=>{assert.equal(await realpath(dirname(resolve(root))),await realpath(tmpdir()));assert.match(basename(root),/^siren-presenter-export-/);await rm(root,{recursive:true,force:true});});
 const projects=new ProjectStore(root),selected=await projects.createProject({label:'Exact presentation',json:'{}'}),windows=[];let unlocked=true;
 const registry=new WindowRegistry({authorize:r=>unlocked?{projectId:selected.project.id,mode:'readonly',access:r.role==='audience'?'presentation':'read',entityIds:['deck-a']}:null,createWindow:async record=>{
  const w=new EventEmitter();w.id=windows.length+1;let destroyed=false;Object.assign(w,{isDestroyed:()=>destroyed,isMinimized:()=>false,restore(){},focus(){},destroy(){destroyed=true;w.emit('closed');},close(){w.destroy();}});const wc=w.webContents=new EventEmitter();Object.assign(wc,{id:100+w.id,mainFrame:{url:record.mainFrameUrl},getURL:()=>wc.mainFrame.url,isDestroyed:()=>destroyed});windows.push(w);return w;
 }});
 for(const role of ['presenter','presenter','audience','docs'])await registry.openView({role,entityId:'deck-a'});
 const event=i=>({sender:windows[i].webContents,senderFrame:windows[i].webContents.mainFrame}),grants=windows.map((_,i)=>registry.capture(event(i)));
 let saved={projectId:selected.project.id,deckId:'deck-a',version:v,title:'Captured Ș😀',slides:[{id:'first',title:'First',notes:'PRIVATE_OLD\r\n exact ',render:{}},{id:'second',title:'Second',notes:'',render:{}}]};
 const session=new PresentationSession({registry,loadDeck:async()=>structuredClone(saved),renderPublicSlide:async({slide})=>({kind:'text',title:slide.title,body:'PUBLIC_ONLY'}),sendFrame:()=>true});for(const g of grants.slice(0,2))assert.equal((await session.admit(g)).ok,true);assert.equal(session.bindAudience(grants[0],grants[2]).ok,true);
 assert.equal(typeof Service,'function','Own Presenter export service must exist');let currentSession=session;
 const revealed=[],service=new Service({registry,sessionFor:()=>currentSession,projects,format:format??formatPresentationNotes,reveal:p=>revealed.push(p)});
 return {root,projects,selected,windows,registry,event,grants,session,service,revealed,save:()=>{saved={...saved,version:next,slides:saved.slides.map(s=>({...s,notes:'PRIVATE_NEW'}))};},replace:()=>currentSession=null,lock:()=>{unlocked=false;},call:(method='exportNotes',payload={deckVersion:v},i=0)=>service.invoke({event:event(i),method,payload}),directory:async()=>join(await projects.directory(selected.project.id),'exports')};
}
test('readonly Presenter exports only its exact captured notes; newer saved data waits for Refresh, Audience stays public',async t=>{
 const f=await fixture(t);f.save();const result=await f.call();assert.equal(result.ok,true);assert.equal(result.deckVersion,v);assert.equal(result.deckId,'deck-a');assert.equal('path'in result,false);assert.equal('notes'in result,false);const file=join(await f.directory(),result.filename),bytes=await readFile(file);assert.ok(bytes.includes(Buffer.from('PRIVATE_OLD\r\n exact ')));assert.equal(bytes.includes(Buffer.from('PRIVATE_NEW')),false);assert.equal(result.bytes,bytes.length);
 assert.equal((await f.call('revealExport',{exportId:result.exportId})).ok,true);assert.deepEqual(f.revealed,[file]);assert.equal((await f.call('revealExport',{exportId:result.exportId},1)).ok,false);
 assert.equal((await f.session.navigate(f.grants[0],{deckVersion:v,sequence:1,slideId:'second'})).ok,true);assert.equal(JSON.stringify(f.session.getFrame(f.grants[2])).includes('PRIVATE'),false);assert.equal((await f.call('revealExport',{exportId:result.exportId})).ok,true);
 assert.equal((await f.session.refreshDeck(f.grants[0],{deckVersion:v})).ok,true);assert.equal((await f.call()).ok,false);assert.equal((await f.call('revealExport',{exportId:result.exportId})).ok,false);const fresh=await f.call('exportNotes',{deckVersion:next});assert.equal(fresh.ok,true);assert.ok((await readFile(join(await f.directory(),fresh.filename))).includes(Buffer.from('PRIVATE_NEW')));assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('finite own main-frame authority rejects Audience/Docs/subframe/copied sender/extra path/text/version/getters',async t=>{
 let formats=0;const f=await fixture(t,d=>{formats++;return formatPresentationNotes(d);});
 for(const i of [2,3])assert.equal((await f.call('exportNotes',{deckVersion:v},i)).ok,false);
 for(const p of [{deckVersion:v,path:'outside'},{deckVersion:v,notes:'injected'},{deckVersion:'wrong'}])assert.equal((await f.call('exportNotes',p)).ok,false);
 let ran=false;assert.equal((await f.call('exportNotes',Object.defineProperty({},'deckVersion',{enumerable:true,get(){ran=true;return v;}}))).ok,false);assert.equal(ran,false);
 const event=f.event(0);assert.equal((await f.service.invoke({event:{sender:{...event.sender},senderFrame:event.senderFrame},method:'exportNotes',payload:{deckVersion:v}})).ok,false);assert.equal((await f.service.invoke({event:{...event,senderFrame:{url:event.senderFrame.url}},method:'exportNotes',payload:{deckVersion:v}})).ok,false);assert.equal(formats,0);
});
test('bounded pending jobs permit normal navigation, but Lock, Refresh and session replacement revoke in-flight publication',async t=>{
 for(const cause of ['navigation','Lock','Refresh','replacement']){
  let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);const f=await fixture(t,async(d,scope)=>{enter(scope);await gate;return formatPresentationNotes(d);}),pending=f.call(),scope=await entered;
  assert.equal((await f.call()).code,'EXPORT_BUSY');
  if(cause==='navigation')assert.equal((await f.session.navigate(f.grants[0],{deckVersion:v,sequence:1,slideId:'second'})).ok,true);
  if(cause==='Lock'){f.service.pause();f.session.pause();assert.equal(scope.signal.aborted,true);}
  if(cause==='Refresh'){f.save();assert.equal((await f.session.refreshDeck(f.grants[0],{deckVersion:v})).ok,true);}
  if(cause==='replacement')f.replace();release();const result=await pending;assert.equal(result.ok,cause==='navigation');await f.service.drain();assert.equal(f.service.isIdle(),true);
  if(cause!=='navigation')assert.equal(existsSync(await f.directory()),false);
 }
});
test('Lock detected after actual rename cleans unretained file before drain; uncertain cleanup fences service',async t=>{
 for(const uncertain of [false,true]){
  const f=await fixture(t),directory=await f.directory(),get=f.session.getPresenter.bind(f.session);let triggered=false;
  f.session.getPresenter=grant=>{if(!triggered&&existsSync(directory)){
   // The actual readback check follows rename, with no test-only publisher hook.
   const files=process.getBuiltinModule('node:fs').readdirSync(directory).filter(n=>n.endsWith('.txt'));
   if(files.length){triggered=true;if(uncertain){const fs=process.getBuiltinModule('node:fs');fs.renameSync(join(directory,files[0]),join(f.root,'displaced.txt'));fs.mkdirSync(join(directory,files[0]));}f.service.pause();f.session.pause();}
  }return get(grant);};
  assert.equal((await f.call()).ok,false);assert.equal(triggered,true);assert.equal(f.service.isIdle(),!uncertain);
  if(uncertain){await assert.rejects(f.service.drain(),/PRESENTER_EXPORT_NOT_IDLE/);f.service.resume();assert.equal((await f.call()).ok,false);}else{await f.service.drain();assert.deepEqual(await readdir(directory),[]);}
 }
});
test('changed files cannot reveal and pause clears receipts without deleting retained user files',async t=>{
 const f=await fixture(t),result=await f.call();assert.equal(result.ok,true);const file=join(await f.directory(),result.filename);await writeFile(file,'changed');assert.equal((await f.call('revealExport',{exportId:result.exportId})).code,'EXPORT_CHANGED');assert.deepEqual(f.revealed,[]);f.service.pause();await f.service.drain();f.service.resume();assert.equal((await f.call('revealExport',{exportId:result.exportId})).ok,false);assert.equal((await readFile(file,'utf8')),'changed');
});

test('global pending budget admits two own Presenters and refuses a third until actual jobs finish',async t=>{
 let release;const gate=new Promise(r=>release=r),entered=[];const f=await fixture(t,async d=>{entered.push(d);await gate;return formatPresentationNotes(d);});
 await f.registry.openView({role:'presenter',entityId:'deck-a'});assert.equal((await f.session.admit(f.registry.capture(f.event(4)))).ok,true);
 const a=f.call(),b=f.call('exportNotes',{deckVersion:v},1);while(entered.length<2)await new Promise(r=>setImmediate(r));assert.equal((await f.call('exportNotes',{deckVersion:v},4)).code,'EXPORT_BUSY');release();assert.equal((await a).ok,true);assert.equal((await b).ok,true);assert.equal((await f.call('exportNotes',{deckVersion:v},4)).ok,true);
});

test('changed Refresh or session replacement after actual rename removes unpublished old notes',async t=>{
 for(const cause of ['Refresh','replacement']){
  const f=await fixture(t),directory=await f.directory(),get=f.session.getPresenter.bind(f.session);let triggered=false,refresh;
  f.session.getPresenter=grant=>{if(!triggered&&existsSync(directory)&&process.getBuiltinModule('node:fs').readdirSync(directory).some(n=>n.endsWith('.txt'))){triggered=true;if(cause==='Refresh'){f.save();refresh=f.session.refreshDeck(grant,{deckVersion:v});}else f.replace();}return get(grant);};
  assert.equal((await f.call()).ok,false);assert.equal(triggered,true);if(refresh)assert.equal((await refresh).ok,true);await f.service.drain();assert.deepEqual(await readdir(directory),[]);
 }
});

test('Lock or Refresh during final cleanup refuses stale success/receipt, retaining the previously accepted file',async t=>{
 for(const cause of ['normal','Lock','Refresh']){
  let f,triggered=false;const Service=await exportClassAtOwnedFile('presenter',async path=>{if(!triggered&&path.endsWith('.tmp')){triggered=true;if(cause==='Lock'){f.service.pause();f.session.pause();}if(cause==='Refresh'){f.save();assert.equal((await f.session.refreshDeck(f.grants[0],{deckVersion:v})).ok,true);}}});f=await fixture(t,undefined,Service);
  const result=await f.call();assert.equal(triggered,true);assert.equal(result.ok,cause==='normal','No stale success after final-cleanup '+cause);await f.service.drain();assert.equal(f.service.isIdle(),true);const files=await readdir(await f.directory());assert.equal(files.length,1);assert.match(files[0],/\.txt$/);
  if(cause!=='normal'){f.service.resume();f.session.resume();const id=files[0].slice('presentation-notes-'.length,-4);assert.equal((await f.call('revealExport',{exportId:id})).ok,false);}
 }
});
