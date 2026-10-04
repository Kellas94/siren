import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {sourceReadFixture} from './fixtures/source-read-context.mjs';
import {WindowRegistry} from '../src/windows/registry.mjs';
const module=await import('../src/windows/catalog.mjs').catch(error=>{if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;return {};});
async function fixture(){
 const f=await sourceReadFixture();let selected=f.selected,unlocked=true,provider=()=>selected;
 const frame={url:'siren://app/app.html'},sender=new EventEmitter();Object.assign(sender,{id:2000,mainFrame:frame,getURL:()=>frame.url,isDestroyed:()=>false});
 const primary=new EventEmitter();Object.assign(primary,{id:1000,webContents:sender,isDestroyed:()=>false});
 const registry=new WindowRegistry({createWindow:()=>{throw Error('Catalog must never create a window');},authorize:()=>unlocked?{projectId:f.selected.project.id,mode:'readonly',access:'read',entityIds:['doc-a',...f.refs.map(ref=>ref.sourceId)]}:null});
 registry.bindWorkspace(primary);registry.activateWorkspace();assert.equal(typeof module.NativeWindowCatalog,'function','Actual native window metadata catalog must exist');
 const catalog=new module.NativeWindowCatalog({registry,snapshotFor:grant=>provider(grant)}),event={sender,senderFrame:frame};
 return {...f,registry,catalog,event,primary,call:(payload,e=event)=>catalog.invoke({event:e,payload}),select:value=>{selected=value;},provider:value=>{provider=value;},lock:()=>{unlocked=false;registry.invalidateEpoch({preserveWorkspace:true});}};
}
test('native App catalog lists readonly Docs and exact selected Code versions without content or future drafts',async()=>{
 const f=await fixture();const result=await f.call();assert.equal(result.ok,true);assert.equal(result.items.length,3);
 const ordered=values=>values.map(({sourceId,version,sha256})=>({sourceId,version,sha256})).sort((a,b)=>a.sourceId.localeCompare(b.sourceId));
 assert.deepEqual(ordered(result.items.filter(item=>item.role==='code').map(item=>item.sourceRef)),ordered(f.refs));
 assert.equal(result.items.find(item=>item.role==='docs').entityId,'doc-a');assert.equal(result.hasMore,false);
 assert.equal(JSON.stringify(result).includes('PLANTED_DOCS_PRIVATE_CONTENT'),false);assert.equal(JSON.stringify(result).includes('foreign secret'),false);
 assert.deepEqual(await f.projects.readProject(f.selected.project.id),f.selected);
});
test('catalog is bounded and paginated while preserving exact metadata and Unicode labels',async()=>{
 const f=await fixture();const workpapers=Array.from({length:130},(_,index)=>({id:'doc-'+index,title:'Ș😀 document '+index,content:'PRIVATE_'+index}));
 f.select({...f.selected,json:JSON.stringify({workpapers})});const first=await f.call(),second=await f.call({cursor:first.nextCursor}),last=await f.call({cursor:second.nextCursor});
 assert.equal(first.items.length,64);assert.equal(second.items.length,64);assert.equal(last.items.length,4);assert.equal(last.hasMore,false);
 assert.equal(new Set([...first.items,...second.items,...last.items].map(item=>item.role+':'+item.entityId)).size,132);assert.equal(JSON.stringify(first).includes('PRIVATE_'),false);
});
test('copied native sender, URL-only Home change, lock, project mismatch, identity payload and getters cannot obtain catalog metadata',async()=>{
 const f=await fixture();assert.equal((await f.call(undefined,{sender:{...f.event.sender},senderFrame:f.event.senderFrame})).code,'ACCESS_REFUSED');
 for(const payload of [{projectId:f.selected.project.id},{cursor:-1},{cursor:4097}])assert.equal((await f.call(payload)).code,'REQUEST_REFUSED');
 let ran=false;const getter=Object.defineProperty({},'cursor',{enumerable:true,get(){ran=true;return 0;}});assert.equal((await f.call(getter)).code,'REQUEST_REFUSED');assert.equal(ran,false);
 f.event.senderFrame.url='siren://app/home.html';assert.equal((await f.call()).code,'ACCESS_REFUSED');f.event.senderFrame.url='siren://app/app.html';
 f.select({...f.selected,project:{...f.selected.project,id:'another-project'}});assert.equal((await f.call()).code,'ACCESS_REFUSED');f.lock();assert.equal((await f.call()).code,'ACCESS_REFUSED');
});
test('a genuinely admitted Home primary receives bounded metadata without source or document content',async()=>{
 const f=await fixture();f.registry.invalidateEpoch({preserveWorkspace:true});f.event.sender.mainFrame={url:'siren://app/home.html'};
 f.event.sender.getURL=()=>f.event.sender.mainFrame.url;f.event.senderFrame=f.event.sender.mainFrame;
 f.registry.activateWorkspace({entryUrl:'siren://app/home.html'});
 const result=await f.call();assert.equal(result.ok,true);assert.equal(result.items.length,3);
 assert.equal(JSON.stringify(result).includes('PLANTED_DOCS_PRIVATE_CONTENT'),false);assert.equal(JSON.stringify(result).includes('foreign secret'),false);
 f.lock();assert.equal((await f.call()).code,'ACCESS_REFUSED');
});
test('Lock during actual native snapshot selection suppresses the pending catalog instead of publishing labels',async()=>{
 const f=await fixture();let entered,release;const ready=new Promise(r=>{entered=r;}),gate=new Promise(r=>{release=r;});
 f.provider(async()=>{entered();await gate;return f.selected;});const pending=f.call();await ready;f.lock();release();const result=await pending;assert.equal(result.code,'ACCESS_REFUSED');assert.equal(result.items,undefined);
});

test('role-filtered pages bound the chosen library without first mounting unrelated Docs rows',async()=>{
 const f=await fixture();f.select({...f.selected,json:JSON.stringify({workpapers:Array.from({length:130},(_,n)=>({id:'doc-'+n,title:'Doc '+n,content:'PRIVATE'}))})});
 const code=await f.call({role:'code',cursor:0});assert.equal(code.ok,true);assert.equal(code.items.length,2);assert.equal(code.total,2);assert.equal(code.hasMore,false);assert.ok(code.items.every(item=>item.role==='code'));
 const docs=await f.call({role:'docs',cursor:0}),next=await f.call({role:'docs',cursor:docs.nextCursor});assert.equal(docs.items.length,64);assert.equal(next.items.length,64);assert.equal(docs.total,130);assert.equal(docs.hasMore,true);assert.ok(next.items.every(item=>item.role==='docs'));assert.equal(JSON.stringify(docs).includes('PRIVATE'),false);
 const diagrams=await f.call({role:'diagram'});assert.equal(diagrams.ok,true);assert.deepEqual(diagrams.items,[]);
 for(const role of ['presenter',null,{}])assert.equal((await f.call({role})).code,'REQUEST_REFUSED');
});
