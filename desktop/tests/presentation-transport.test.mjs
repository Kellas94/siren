import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {WindowRegistry} from '../src/windows/registry.mjs';
const module=await import('../src/windows/presentation.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
const version='a'.repeat(64),nextVersion='b'.repeat(64),json=value=>JSON.parse(JSON.stringify(value));
async function fixture({render,send}={}){
 const windows=[],policy={projectId:'project-a',mode:'normal'},frames=[];
 const registry=new WindowRegistry({authorize:request=>({...policy,access:request.role==='audience'?'presentation':'read',entityIds:['deck-a']}),createWindow:async options=>{
  const w=new EventEmitter();w.id=windows.length+1;w.isDestroyed=()=>w.destroyed===true;w.isMinimized=()=>false;w.show=()=>{};w.restore=()=>{};w.focus=()=>{};w.destroy=()=>{w.destroyed=true;w.webContents.emit('destroyed');w.emit('closed');};w.close=w.destroy;w.webContents=new EventEmitter();Object.assign(w.webContents,{id:w.id+100,mainFrame:{url:options.mainFrameUrl},getURL:()=>options.mainFrameUrl,isDestroyed:w.isDestroyed});windows.push(w);return w;
 }});
 for(const role of ['presenter','audience','audience','docs'])await registry.openView({role,entityId:'deck-a'});
 const grants=windows.map(w=>registry.capture({sender:w.webContents,senderFrame:w.webContents.mainFrame}));
 let deck={projectId:'project-a',deckId:'deck-a',version,title:'Exact deck',slides:[{id:'first',title:'First',notes:'PRIVATE_PRESENTER_NOTES',render:{source:'PRIVATE_MERMAID_SOURCE',secret:'PRIVATE_DRAFT'}},{id:'second',title:'Second',notes:'PRIVATE_SECOND_NOTES',render:{source:'PRIVATE_OTHER_SOURCE'}}]};
 assert.equal(typeof module.PresentationSession,'function','Native presentation transport must exist');
 const session=new module.PresentationSession({registry,loadDeck:async()=>structuredClone(deck),renderPublicSlide:render??(async({slide})=>({kind:'text',title:slide.title,body:'Only the visible public content'})),sendFrame:(grant,frame)=>{frames.push({windowId:grant.windowId,frame:structuredClone(frame)});return send?.(grant,frame)??true;}});
 return {session,registry,windows,grants,frames,policy,setDeck:value=>deck=value,deck:()=>structuredClone(deck)};
}
const admit=async f=>{assert.equal((await f.session.admit(f.grants[0])).ok,true);assert.equal(f.session.bindAudience(f.grants[0],f.grants[1]).ok,true);};
const navigate=(f,sequence,slideId='first',deckVersion=version)=>f.session.navigate(f.grants[0],{deckVersion,sequence,slideId});

test('native pause drains an actual outstanding render before admitting a transition and clears the Presenter preview',async()=>{
 let release,entered;const gate=new Promise(resolve=>release=resolve),admitted=new Promise(resolve=>entered=resolve);
 const f=await fixture({render:async()=>{entered();await gate;return {kind:'text',title:'Public',body:'Rendered'};}});await admit(f);
 const pending=navigate(f,1);await admitted;f.session.pause();assert.equal(f.session.isIdle(),false);
 let drained=false;const drain=f.session.drain().then(()=>{drained=true;});await new Promise(resolve=>setImmediate(resolve));assert.equal(drained,false);
 release();await pending;await drain;assert.equal(f.session.isIdle(),true);f.session.resume();assert.equal(f.session.getPreview(f.grants[0]).ok,false);
});
test('Presenter preview receives only its successfully rendered public slide, never private notes or source',async()=>{
 const f=await fixture();await admit(f);assert.equal((await navigate(f,1)).ok,true);const preview=f.session.getPreview(f.grants[0]);assert.equal(preview.ok,true);assert.equal(preview.frame.publicSlide.body,'Only the visible public content');assert.equal(JSON.stringify(preview).includes('PRIVATE'),false);assert.equal(f.session.getPreview(f.grants[1]).ok,false);f.session.pause();assert.equal(f.session.getPreview(f.grants[0]).ok,false);
});

test('genuine Presenter/Audience roles project only visible content, retaining notes solely for Presenter',async()=>{
 const f=await fixture();const state=await f.session.admit(f.grants[0]);assert.equal(state.ok,true);assert.equal(state.deck.slides[0].notes,'PRIVATE_PRESENTER_NOTES');assert.equal('render' in state.deck.slides[0],false);
 assert.equal(f.session.bindAudience(f.grants[0],f.grants[1]).ok,true);assert.equal((await navigate(f,1)).ok,true);const frame=f.frames[0].frame;
 assert.deepEqual(Object.keys(frame).sort(),['deckVersion','epoch','publicSlide','sequence','slideId']);assert.equal(frame.sequence,1);assert.equal(frame.slideId,'first');assert.equal(frame.deckVersion,version);
 for(const forbidden of ['PRIVATE_PRESENTER','PRIVATE_SECOND','PRIVATE_MERMAID','PRIVATE_OTHER','PRIVATE_DRAFT','secret','render'])assert.equal(JSON.stringify(frame).includes(forbidden),false,forbidden);
 assert.deepEqual(json(f.session.getFrame(f.grants[1]).frame),frame);assert.equal(f.session.getFrame(f.grants[3]).ok,false);assert.equal((await f.session.admit(f.grants[1])).ok,false);
});
test('foreign/copy/retired caller, stale sequence/version and unexpected authority fields never publish',async()=>{
 const f=await fixture();await admit(f);assert.equal((await navigate(f,1)).ok,true);const count=f.frames.length;
 for(const request of [{deckVersion:version,sequence:1,slideId:'second'},{deckVersion:nextVersion,sequence:2,slideId:'second'},{deckVersion:version,sequence:2,slideId:'missing'},{deckVersion:version,sequence:2,slideId:'first',projectId:'outside'}])assert.equal((await f.session.navigate(f.grants[0],request)).ok,false);
 assert.equal((await f.session.navigate({...f.grants[0]},{deckVersion:version,sequence:2,slideId:'first'})).ok,false);assert.equal((await f.session.navigate(f.grants[3],{deckVersion:version,sequence:2,slideId:'first'})).ok,false);assert.equal(f.frames.length,count);
 f.windows[0].destroy();assert.equal((await navigate(f,2)).ok,false);assert.equal(f.session.getFrame(f.grants[1]).ok,false);
});
test('a slow audience has one in-flight and one coalesced latest frame, independently of another audience',async()=>{
 const f=await fixture();await admit(f);assert.equal(f.session.bindAudience(f.grants[0],f.grants[2]).ok,true);assert.equal((await navigate(f,1)).ok,true);
 assert.equal(f.session.acknowledge(f.grants[2],{deckVersion:version,sequence:1}).ok,true);assert.equal((await navigate(f,2,'second')).ok,true);assert.equal((await navigate(f,3)).ok,true);
 assert.deepEqual(f.frames.filter(x=>x.windowId===f.grants[1].windowId).map(x=>x.frame.sequence),[1]);
 assert.deepEqual(f.frames.filter(x=>x.windowId===f.grants[2].windowId).map(x=>x.frame.sequence),[1,2]);
 assert.equal(f.session.acknowledge(f.grants[1],{deckVersion:version,sequence:2}).ok,false);assert.equal(f.session.acknowledge(f.grants[1],{deckVersion:version,sequence:1}).ok,true);
 assert.deepEqual(f.frames.filter(x=>x.windowId===f.grants[1].windowId).map(x=>x.frame.sequence),[1,3]);assert.equal(f.session.acknowledge(f.grants[2],{deckVersion:version,sequence:2}).ok,true);
 assert.deepEqual(f.frames.filter(x=>x.windowId===f.grants[2].windowId).map(x=>x.frame.sequence),[1,2,3]);
});
test('out-of-order rendering and pause/disposal never republish an older slide or cached audience data',async()=>{
 const jobs=[];const f=await fixture({render:({slide},scope)=>new Promise(resolve=>jobs.push({slide,scope,resolve}))});await admit(f);
 const old=navigate(f,1),latest=navigate(f,2,'second');assert.equal(jobs.length,2);assert.equal(jobs[0].scope.isCurrent(),false);
 jobs[1].resolve({kind:'text',title:'Second',body:'CURRENT'});assert.equal((await latest).ok,true);jobs[0].resolve({kind:'text',title:'First',body:'STALE'});assert.equal((await old).ok,false);assert.equal(f.frames.length,1);assert.equal(f.frames[0].frame.slideId,'second');
 const late=navigate(f,3);f.session.pause();assert.equal(jobs[2].scope.isCurrent(),false);jobs[2].resolve({kind:'text',title:'First',body:'LATE'});assert.equal((await late).ok,false);assert.equal(f.session.getFrame(f.grants[1]).ok,false);f.session.resume();assert.equal((await f.session.getPresenter(f.grants[0])).ok,true);
 f.session.dispose();assert.equal(f.session.getFrame(f.grants[1]).ok,false);assert.equal((await f.session.getPresenter(f.grants[0])).ok,false);assert.equal((await navigate(f,4)).ok,false);assert.equal(f.frames.length,1);
});
test('explicit deck refresh preserves the current slide identity and rejects an old audience acknowledgement',async()=>{
 const f=await fixture();await admit(f);assert.equal((await navigate(f,1,'second')).ok,true);const deck=f.deck();deck.version=nextVersion;deck.slides=[deck.slides[1],{id:'third',title:'Third',notes:'PRIVATE_NEW',render:{source:'PRIVATE_NEW_SOURCE'}}];f.setDeck(deck);
 assert.equal((await f.session.getPresenter(f.grants[0])).deck.version,version);assert.equal((await f.session.refreshDeck(f.grants[0],{deckVersion:version})).ok,true);
 const state=await f.session.getPresenter(f.grants[0]);assert.equal(state.deck.version,nextVersion);assert.equal(state.slideId,'second');assert.equal(f.frames.length,1,'Refresh is explicit and does not publish an unrendered slide');
 assert.equal(f.session.acknowledge(f.grants[1],{deckVersion:version,sequence:1}).ok,false);assert.equal((await navigate(f,2,'second',nextVersion)).ok,true);assert.equal(f.frames.at(-1).frame.deckVersion,nextVersion);
 deck.version='c'.repeat(64);deck.slides=[deck.slides[1]];f.setDeck(deck);assert.equal((await f.session.refreshDeck(f.grants[0],{deckVersion:nextVersion})).ok,true);assert.equal((await f.session.getPresenter(f.grants[0])).slideId,'third');
});
test('public payload validation refuses private fields, executable/remote media and oversized content without replacing the current frame',async()=>{
 let candidate={kind:'text',title:'Public',body:'Valid'};const f=await fixture({render:async()=>candidate});await admit(f);assert.equal((await navigate(f,1)).ok,true);
 let sequence=2;for(const value of [{kind:'text',title:'Public',body:'x',notes:'PRIVATE'},{kind:'image',title:'Public',image:'https://outside/image.png'},{kind:'image',title:'Public',image:'data:image/svg+xml,<svg onload="alert(1)"/>'},{kind:'text',title:'Public',body:'x'.repeat(65537)}]){candidate=value;const result=await navigate(f,sequence++);assert.equal(result.code,'PUBLIC_SLIDE_REFUSED');assert.equal(f.frames.length,1);}
 assert.equal(f.session.getFrame(f.grants[1]).frame.publicSlide.body,'Valid');
});
test('native deck corruption or changed caller during load retains the original admitted deck',async()=>{
 const f=await fixture();await admit(f);const original=f.deck();f.setDeck({...original,version:nextVersion,slides:[original.slides[0],original.slides[0]]});assert.equal((await f.session.refreshDeck(f.grants[0],{deckVersion:version})).ok,false);assert.equal((await f.session.getPresenter(f.grants[0])).deck.version,version);
 f.setDeck({...original,projectId:'outside',version:nextVersion});assert.equal((await f.session.refreshDeck(f.grants[0],{deckVersion:version})).ok,false);assert.equal((await f.session.getPresenter(f.grants[0])).deck.version,version);
});
test('render jobs have a finite native budget and cancellation signal; a refused burst does not consume its position',async()=>{
 const jobs=[];const f=await fixture({render:(_input,scope)=>new Promise(resolve=>jobs.push({scope,resolve}))});await admit(f);
 const first=navigate(f,1),second=navigate(f,2,'second');assert.equal(jobs.length,2);assert.equal(jobs[0].scope.signal.aborted,true);
 assert.equal((await navigate(f,3)).code,'PRESENTATION_RENDER_BUSY');assert.equal(jobs.length,2);
 jobs[0].resolve({kind:'text',title:'Old',body:'OLD'});assert.equal((await first).ok,false);jobs[1].resolve({kind:'text',title:'Current',body:'CURRENT'});assert.equal((await second).ok,true);
 const next=navigate(f,3);assert.equal(jobs.length,3);f.session.pause();assert.equal(jobs[2].scope.signal.aborted,true);jobs[2].resolve({kind:'text',title:'Late',body:'LATE'});assert.equal((await next).ok,false);assert.equal(f.frames.length,1);
});
test('canonical bounded PNG content is delivered as public media while oversized geometry and malformed encoding are refused',async()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';let image=png;
 const f=await fixture({render:async()=>({kind:'image',title:'Public image',image})});await admit(f);assert.equal((await navigate(f,1)).ok,true);assert.equal(f.frames[0].frame.publicSlide.image,png);
 const bytes=Buffer.from(png.slice(22),'base64');bytes.writeUInt32BE(100000,16);image='data:image/png;base64,'+bytes.toString('base64');assert.equal((await navigate(f,2)).code,'PUBLIC_SLIDE_REFUSED');
 image=png.slice(0,-1);assert.equal((await navigate(f,3)).code,'PUBLIC_SLIDE_REFUSED');assert.equal(f.frames.length,1);
});
