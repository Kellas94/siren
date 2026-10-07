import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createDocumentActivityContract} from '../src/documents/document-activity.mjs';
const source=await readFile(new URL('../src/ui/docs/activity.js',import.meta.url),'utf8').catch(error=>{if(error.code!=='ENOENT')throw error;return '';});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(value={}){
 const nodes=[];
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.attributes={};this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.dataset={};nodes.push(this);}
  append(...items){for(const item of items){item.parentNode=this;this.children.push(item);}}
  replaceChildren(...items){this.children=[];this.append(...items);}
  setAttribute(key,value){this.attributes[key]=String(value);}
  addEventListener(key,fn){(this.listeners[key]??=[]).push(fn);}
  removeEventListener(key,fn){this.listeners[key]=(this.listeners[key]??[]).filter(item=>item!==fn);}
  emit(key='click',event={}){for(const fn of this.listeners[key]??[])fn(event);}
  set innerHTML(value){throw Error('HTML execution sink forbidden');}
  focus(){document.activeElement=this;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
 }
 const document={createElement:tag=>new Node(tag),activeElement:null},window={SirenDocumentActivity:createDocumentActivityContract()};
 runInNewContext(source,{window,document,Promise});assert.equal(typeof window.SirenNativeDocsActivity?.create,'function','Activity controller must exist');
 const host=new Node('section'),button=new Node('button'),editor=new Node('textarea');editor.value='pending rich/context/image edit';editor.selectionStart=3;editor.selectionEnd=8;document.activeElement=editor;
 let enabled=true,jump=async()=>({ok:true}),compare=async()=>({ok:true,identical:true,rows:[],counts:{}});const jumps=[],compares=[],messages=[];
 const view=window.SirenNativeDocsActivity.create({host,button,enabled:()=>enabled,onJump:id=>{jumps.push(id);return jump(id);},onCompare:request=>{compares.push(JSON.parse(JSON.stringify(request)));return compare(request);},onStatus:message=>messages.push(message)});
 const saved={id:'doc-a',blocks:[{id:'block-a',kind:'text',html:'<p>Saved</p>'}],comments:[{id:'c0',blockId:'block-a',text:'<script>secret()</script>',resolved:false},{id:'c1',blockId:'gone',text:'Resolved',resolved:true},{id:'c2',text:'Unsupported',resolved:'yes'}],revisions:[{at:'yesterday',blocks:[]}],review:{state:'approved',trail:[{action:'approved',who:'Recorded person',detail:'Recorded detail'}]},releases:[{seq:1,status:'approved',approvedBy:'Recorded person'}],signoffFromFile:{status:'approved',digestHeld:false},...value};
 const context={document:saved,version:'a'.repeat(64),sha256:'b'.repeat(64),dirty:false,readonly:true};view.setContext(context);
 const live=()=>{const found=[];const walk=node=>{found.push(node);for(const child of node.children)walk(child);};walk(host);return found;};
 const byId=id=>live().find(node=>node.id===id),text=()=>live().map(node=>node.textContent).join('\n');
 return {view,host,button,editor,document,saved,context,byId,live,text,jumps,compares,messages,jump:fn=>jump=fn,compare:fn=>compare=fn,enabled:value=>enabled=value};
}
test('compact readonly disclosure uses inert recorded rows and preserves mounted editor focus/selection',()=>{
 const f=fixture(),before=JSON.stringify(f.saved);let prevented=0;f.button.emit('pointerdown',{button:0,preventDefault:()=>prevented++});f.button.emit();
 assert.equal(prevented,1);assert.equal(f.host.hidden,false);assert.equal(f.button.attributes['aria-expanded'],'true');assert.equal(f.document.activeElement,f.editor);assert.equal(f.editor.selectionStart,3);assert.equal(f.editor.selectionEnd,8);assert.match(f.text(),/<script>secret\(\)<\/script>/);assert.match(f.text(),/recorded/i);assert.equal(JSON.stringify(f.saved),before);assert.equal(f.jumps.length+f.compares.length,0);
 f.button.emit();assert.equal(f.host.hidden,true);assert.equal(f.button.attributes['aria-expanded'],'false');
});
test('comment filters retain original source positions and unsupported resolution is not open or resolved',()=>{
 const f=fixture();f.button.emit();const filter=f.byId('documentActivityFilter');filter.value='resolved';filter.emit('change');assert.match(f.text(),/Comment 2/);assert.doesNotMatch(f.text(),/Comment 1|Comment 3/);assert.match(f.byId('documentActivityPageNotice').textContent,/3 source positions/);
 f.byId('documentActivityFilter').value='open';f.byId('documentActivityFilter').emit('change');assert.match(f.text(),/Comment 1/);assert.doesNotMatch(f.text(),/Comment 2|Comment 3/);
});
test('pagination advances original source cursor after bounded filtered scan and reports limits honestly',()=>{
 const f=fixture({comments:Array.from({length:300},(_,i)=>({resolved:i===299,text:'row '+i}))});f.button.emit();f.byId('documentActivityFilter').value='resolved';f.byId('documentActivityFilter').emit('change');assert.match(f.text(),/limit/i);assert.equal(f.byId('documentActivityNext').disabled,false);assert.match(f.byId('documentActivityPageNotice').textContent,/300 source positions/);f.byId('documentActivityNext').emit();assert.match(f.text(),/Comment 300/);assert.equal(f.byId('documentActivityNext').disabled,true);f.byId('documentActivityPrevious').emit();assert.doesNotMatch(f.text(),/Comment 300/);
});
test('exact block jump callback is readonly-safe; failure says refused and cannot mutate recorded data',async()=>{
 const f=fixture(),before=JSON.stringify(f.saved);f.button.emit();f.jump(async()=>({ok:false,code:'BLOCK_MISSING'}));f.byId('documentActivityJump0').emit();await tick();assert.deepEqual(f.jumps,['block-a']);assert.match(f.messages.at(-1),/BLOCK_MISSING/);assert.equal(JSON.stringify(f.saved),before);
});
test('revision comparison explicitly selects saved or unsaved working target and paginates at most20 rows',async()=>{
 const f=fixture(),rows=Array.from({length:45},(_,i)=>({id:'b'+i,change:'changed',reordered:i===0,beforeIndex:i,afterIndex:i}));f.compare(async()=>({ok:true,identical:false,rows,counts:{changed:45}}));f.button.emit();f.byId('documentActivitySection').value='revisions';f.byId('documentActivitySection').emit('change');f.byId('documentActivityCompare0').emit();await tick();assert.deepEqual(f.compares,[{position:0,against:'saved'}]);assert.equal(f.live().filter(node=>node.dataset.activityComparisonRow==='true').length,20);assert.match(f.text(),/Saved current/);f.byId('documentActivityCompareNext').emit();assert.match(f.text(),/b20/);assert.doesNotMatch(f.text(),/^b0$/m);
 f.view.updateState({dirty:true});assert.equal(f.byId('documentActivityCompareRows'),undefined);f.byId('documentActivityAgainst').value='working';f.byId('documentActivityAgainst').emit('change');f.byId('documentActivityCompare0').emit();await tick();assert.deepEqual(f.compares[1],{position:0,against:'working'});assert.match(f.text(),/Unsaved working/);assert.equal(f.live().filter(node=>node.dataset.activityComparisonRow==='true').length,20);
});
test('comparison refusal and malformed record containers expose explicit limited/unavailable state',async()=>{
 const f=fixture();f.compare(async()=>({ok:false,code:'COMPARISON_BYTE_LIMIT'}));f.button.emit();f.byId('documentActivitySection').value='revisions';f.byId('documentActivitySection').emit('change');f.byId('documentActivityCompare0').emit();await tick();assert.match(f.text(),/COMPARISON_BYTE_LIMIT/);assert.doesNotMatch(f.text(),/identical/i);f.view.setContext({...f.context,document:{...f.saved,comments:{opaque:'retained'}}});f.byId('documentActivitySection').value='comments';f.byId('documentActivitySection').emit('change');assert.match(f.text(),/ACTIVITY_RECORDS_INVALID/);
});
test('review and releases display recorded provenance without verified approval claims',()=>{
 const f=fixture();f.button.emit();f.byId('documentActivitySection').value='review';f.byId('documentActivitySection').emit('change');assert.match(f.text(),/signoffFromFile/);assert.match(f.text(),/approved/);assert.match(f.text(),/recorded claims, not independently verified approvals, signatures or tests/i);assert.equal(f.live().some(node=>['A','IFRAME','IMG','SCRIPT'].includes(node.tagName)),false);
});
test('pause, context replacement, invalidation and disposal fence late comparison callbacks and clear private DOM',async()=>{
 for(const operation of ['pause','invalidate','dispose','replace']){
  const f=fixture();let release;f.compare(()=>new Promise(resolve=>release=resolve));f.button.emit();f.byId('documentActivitySection').value='revisions';f.byId('documentActivitySection').emit('change');f.byId('documentActivityCompare0').emit();await tick();assert.equal(f.byId('documentActivityCompare0').disabled,true);
  if(operation==='replace')f.view.setContext({...f.context,document:{id:'doc-b',comments:[]}});else f.view[operation]();const count=f.messages.length;release({ok:true,identical:false,rows:[{id:'late secret',change:'added'}],counts:{added:1}});await tick();assert.doesNotMatch(f.text(),/late secret/);assert.equal(f.messages.length,count);
  if(operation!=='replace'){assert.equal(f.host.children.length,0);assert.equal(f.host.hidden,true);}if(operation==='pause'){f.view.resume();assert.equal(f.host.hidden,false);assert.doesNotMatch(f.text(),/late secret/);}if(operation==='dispose'){assert.equal(f.button.disabled,true);f.button.emit();assert.equal(f.host.children.length,0);}
 }
});
test('disabled state refuses actions and dirty update invalidates a pending working comparison',async()=>{
 const f=fixture();f.enabled(false);f.view.updateState({dirty:false});f.button.emit();assert.equal(f.host.hidden,true);assert.equal(f.button.disabled,true);f.enabled(true);f.view.updateState({dirty:true});f.button.emit();f.byId('documentActivitySection').value='revisions';f.byId('documentActivitySection').emit('change');f.byId('documentActivityAgainst').value='working';f.byId('documentActivityAgainst').emit('change');let release;f.compare(()=>new Promise(resolve=>release=resolve));f.byId('documentActivityCompare0').emit();await tick();f.view.updateState({dirty:true});release({ok:true,identical:true,rows:[],counts:{}});await tick();assert.equal(f.byId('documentActivityCompareRows'),undefined);assert.doesNotMatch(f.text(),/No differences/);
});
test('clean working comparison does not invent unsaved changes and native controls retain keyboard focus',async()=>{
 const f=fixture();f.button.emit();const section=f.byId('documentActivitySection');section.focus();section.value='revisions';section.emit('change');assert.equal(f.document.activeElement,f.byId('documentActivitySection'));
 f.byId('documentActivityAgainst').value='working';f.byId('documentActivityAgainst').emit('change');f.byId('documentActivityCompare0').emit();await tick();assert.match(f.text(),/Working current content · No unsaved edits/);assert.doesNotMatch(f.text(),/Unsaved working/);
});
test('one pending callback, throw/refusal and bounded excerpts never report a successful jump or equality',async()=>{
 const f=fixture({comments:[{blockId:'b',resolved:false,text:'x'.repeat(5000)}]});f.button.emit();assert.match(f.text(),/Shortened display/);assert.equal(f.text().includes('x'.repeat(4097)),false);let release;f.jump(()=>new Promise(resolve=>release=resolve));const old=f.byId('documentActivityJump0');old.emit();old.emit();await tick();assert.equal(f.jumps.length,1);f.view.pause();f.view.resume();const messageCount=f.messages.length;release({ok:false,code:'PRIVATE_ERROR'});await tick();assert.equal(f.messages.length,messageCount);
 f.view.setContext(f.context);f.jump(()=>{throw Error('raw private error');});f.byId('documentActivityJump0').emit();await tick();assert.match(f.messages.at(-1),/refused/);assert.doesNotMatch(f.messages.at(-1),/raw private error/);
});
test('comparison maximum512 rows stays paged20 and context replacement retires already-captured handlers',async()=>{
 const f=fixture();f.button.emit();const oldJump=f.byId('documentActivityJump0');f.view.invalidate();oldJump.emit();await tick();assert.equal(f.jumps.length,0);f.view.setContext(f.context);f.button.emit();f.byId('documentActivitySection').value='revisions';f.byId('documentActivitySection').emit('change');f.compare(async()=>({ok:true,identical:false,rows:Array.from({length:512},(_,i)=>({id:'x'+i,change:'added',afterIndex:i})),counts:{added:512}}));f.byId('documentActivityCompare0').emit();await tick();assert.equal(f.live().filter(node=>node.dataset.activityComparisonRow==='true').length,20);for(let i=0;i<25;i++)f.byId('documentActivityCompareNext').emit();assert.equal(f.live().filter(node=>node.dataset.activityComparisonRow==='true').length,12);assert.equal(f.byId('documentActivityCompareNext').disabled,true);
});
test('detached old controls cannot act on a newly admitted document or a replaced local page',async()=>{
 const f=fixture();f.button.emit();const old=f.byId('documentActivityJump0');f.view.setContext({...f.context,document:{id:'doc-b',comments:[{blockId:'other',resolved:false}]}});old.emit();await tick();assert.deepEqual(f.jumps,[]);
 const current=f.byId('documentActivityJump0');f.byId('documentActivityFilter').value='resolved';f.byId('documentActivityFilter').emit('change');current.emit();await tick();assert.deepEqual(f.jumps,[]);
});
