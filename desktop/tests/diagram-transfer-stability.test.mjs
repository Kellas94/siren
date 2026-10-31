import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile(new URL('../src/ui/windows/diagram-transfer.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function fixture(configure=()=>{}){
 const view={windowId:'12345678-1234-4234-8234-123456789abc',role:'diagram'};
 const listeners=new Map(),events=new Map(),polls=[],calls=[];
 const button={hidden:false,disabled:false,dataset:{},addEventListener:(name,fn)=>listeners.set(name,fn)};
 let readView=async()=>({ok:true,view}),readShelf=async()=>({ok:true,items:[{...view,placement:'attached'}]}),move=async()=>({ok:true}),shelfCalls=0;
 const window={sirenWindow:{getView:()=>readView(),onReady:fn=>events.set('ready',fn)},sirenWindowDock:{getShelf:()=>{shelfCalls++;return readShelf();},attach:payload=>{calls.push({method:'attach',...payload});return move();},detach:payload=>{calls.push({method:'detach',...payload});return move();}},addEventListener:(name,fn)=>events.set(name,fn)};
 const document={getElementById:()=>({before(){}}),createElement:()=>button,body:{dataset:{}}};
 const api={button,window,document,view,calls,events,shelfCalls:()=>shelfCalls,setView:fn=>{readView=fn;},setShelf:fn=>{readShelf=fn;},setMove:fn=>{move=fn;},poll:()=>polls[0](),click:()=>listeners.get('click')(),unload:()=>events.get('unload')()};
 configure(api);
 runInNewContext(source,{window,document,setInterval:fn=>{polls.push(fn);return 1;},clearInterval(){}});
 return api;
}
const unavailable=[
 ['view non-ok',f=>f.setView(async()=>({ok:false}))],
 ['view wrong role',f=>f.setView(async()=>({ok:true,view:{...f.view,role:'code'}}))],
 ['view missing record',f=>f.setView(async()=>({ok:true}))],
 ['view exception',f=>f.setView(async()=>{throw Error('unavailable');})],
 ['shelf non-ok',f=>f.setShelf(async()=>({ok:false}))],
 ['shelf missing own',f=>f.setShelf(async()=>({ok:true,items:[]}))],
 ['shelf foreign',f=>f.setShelf(async()=>({ok:true,items:[{...f.view,windowId:'foreign',placement:'attached'}]}))],
 ['shelf wrong role',f=>f.setShelf(async()=>({ok:true,items:[{...f.view,role:'code',placement:'attached'}]}))],
 ['shelf unsupported placement',f=>f.setShelf(async()=>({ok:true,items:[{...f.view,placement:'floating'}]}))],
 ['shelf exception',f=>f.setShelf(async()=>{throw Error('unavailable');})],
];
for(const [name,invalidate] of unavailable)test(`established placement retains label/footprint and refuses dispatch across ${name}`,async()=>{
 const f=fixture();await tick();assert.equal(await f.window.SirenNativeDiagramTransfer.whenPlaced(),true);
 const caption=f.button.textContent,title=f.button.title;invalidate(f);f.poll();await tick();
 assert.equal(f.button.hidden,false,'Unavailable observation must not remove the established header control');
 assert.equal(f.button.disabled,true,'Unavailable control cannot retain command authority');
 assert.equal(f.button.textContent,caption);assert.equal(f.button.title,title);
 await f.click();assert.equal(f.calls.length,0,'Direct listener invocation also refuses unavailable authority');
 f.setView(async()=>({ok:true,view:f.view}));f.setShelf(async()=>({ok:true,items:[{...f.view,placement:'attached'}]}));f.poll();await tick();
 assert.equal(f.button.hidden,false);assert.equal(f.button.disabled,false);assert.equal(f.button.textContent,caption);
 await f.click();assert.equal(f.calls.length,1);assert.equal(f.calls[0].method,'detach');assert.equal(f.calls[0].windowId,f.view.windowId);f.unload();
});
for(const [name,invalidate] of unavailable)test(`initial ${name} never admits placement`,async()=>{
 const g=fixture(invalidate);await tick();g.poll();await tick();
 assert.equal(g.button.hidden,true);let settled=false;g.window.SirenNativeDiagramTransfer.whenPlaced().then(()=>{settled=true;});await tick();assert.equal(settled,false);
 await g.click();assert.equal(g.calls.length,0);g.unload();assert.equal(await g.window.SirenNativeDiagramTransfer.whenPlaced(),false);
});
test('valid polling during an in-flight transfer never permits a duplicate command',async()=>{
 const f=fixture();await tick();const held=deferred();f.setMove(()=>held.promise);const moving=f.click();await tick();
 assert.equal(f.button.disabled,true);f.poll();await tick();assert.equal(f.button.disabled,true);await f.click();assert.equal(f.calls.length,1);
 held.resolve({ok:true});await moving;assert.equal(f.button.disabled,false);f.unload();
});
test('invalid polling before transfer completion stays unavailable until a valid recovery',async()=>{
 const f=fixture();await tick();const held=deferred();f.setMove(()=>held.promise);const moving=f.click();
 f.setShelf(async()=>({ok:false}));f.poll();await tick();held.resolve({ok:true});await moving;
 assert.equal(f.button.hidden,false);assert.equal(f.button.disabled,true);await f.click();assert.equal(f.calls.length,1);
 f.setShelf(async()=>({ok:true,items:[{...f.view,placement:'detached'}]}));f.poll();await tick();assert.equal(f.button.disabled,false);assert.equal(f.button.textContent,'Attach to workspace');
 f.setMove(async()=>({ok:true}));await f.click();assert.equal(f.calls.length,2);assert.equal(f.calls[1].method,'attach');f.unload();
});
test('transfer completion joins an existing refresh and still performs fresh placement validation',async()=>{
 const f=fixture();await tick();const transfer=deferred(),shelf=deferred();f.setMove(()=>transfer.promise);const moving=f.click();
 f.setShelf(()=>shelf.promise);f.poll();await tick();const before=f.shelfCalls();transfer.resolve({ok:true});await tick();
 assert.equal(f.button.disabled,true);await f.click();assert.equal(f.calls.length,1);
 f.setShelf(async()=>({ok:true,items:[{...f.view,placement:'detached'}]}));shelf.resolve({ok:false});await moving;
 assert(f.shelfCalls()>before,'Post-transfer validation cannot be swallowed by an already running refresh');assert.equal(f.button.hidden,false);assert.equal(f.button.disabled,false);assert.equal(f.button.textContent,'Attach to workspace');f.unload();
});
for(const phase of ['view','shelf','transfer'])test(`unload during pending ${phase} prevents late presentation changes and dispatch`,async()=>{
 const f=fixture();await tick();const held=deferred();let pending;
 if(phase==='view'){f.setView(()=>held.promise);f.poll();}
 else if(phase==='shelf'){f.setShelf(()=>held.promise);f.poll();}
 else{f.setMove(()=>held.promise);pending=f.click();}
 await tick();f.unload();const before={hidden:f.button.hidden,disabled:f.button.disabled,textContent:f.button.textContent,title:f.button.title,result:f.button.dataset.result,placement:f.document.body.dataset.nativePlacement};
 held.resolve(phase==='view'?{ok:true,view:f.view}:phase==='shelf'?{ok:true,items:[{...f.view,placement:'detached'}]}:{ok:true});
 if(pending)await pending;await tick();
 assert.deepEqual({hidden:f.button.hidden,disabled:f.button.disabled,textContent:f.button.textContent,title:f.button.title,result:f.button.dataset.result,placement:f.document.body.dataset.nativePlacement},before);
 const count=f.calls.length;await f.click();assert.equal(f.calls.length,count);
});
