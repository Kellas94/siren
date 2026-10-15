import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import * as model from '../src/documents/context.mjs';
const [contextScript,draftScript]=await Promise.all(['../src/ui/docs/context.js','../src/ui/docs/draft.js'].map(p=>readFile(new URL(p,import.meta.url),'utf8')));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const held=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const page=(label,cursor=10,hasMore=true)=>({ok:true,version:'a'.repeat(64),items:[{kind:'document',id:label.toLowerCase(),label}],nextCursor:cursor,hasMore});
async function fixture({type='agent-spec',agentExtra={},getTargets=async()=>page('Result')}={}){
 const nodes=[],calls=[];let writes=0;
 class Node{constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.listeners={};this.value='';this.disabled=false;this.hidden=false;this._text='';nodes.push(this);}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}set textContent(v){this._text=String(v);this.replaceChildren();}append(...ns){for(const n of ns){n.remove();n.parent=this;this.children.push(n);}}replaceChildren(...ns){for(const n of this.children)n.parent=null;this.children=[];this.append(...ns);}remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}setAttribute(k,v){this[k]=String(v);}addEventListener(k,fn){this.listeners[k]=fn;}showModal(){this.open=true;}close(){this.open=false;this.emit('close');}emit(type='click',extra={}){if(type==='click'&&this.disabled)return;return this.listeners[type]?.({target:this,preventDefault(){},...extra});}}
 const document={body:new Node('body'),createElement:tag=>new Node(tag)},window={SirenDocumentContext:Object.fromEntries(Object.entries(model).map(([key,value])=>[key,typeof value==='function'?((...args)=>value(...args.map(v=>structuredClone(v)))):value])),sirenDocsReferences:{getTargets:q=>{calls.push(structuredClone(q));return getTargets(q);},openReference:async()=>({ok:false})}};
 runInNewContext(draftScript,{window,structuredClone,crypto:webcrypto,TextEncoder});
 const stored={id:'doc',title:'Agent',...(type===null?{}:{type}),owner:'Saved owner',blocks:[],links:[],agent:{future:{preserve:'exact'},...agentExtra}},sha256=createHash('sha256').update(JSON.stringify(stored)).digest('hex');
 const draft=window.SirenNativeDocsDraft.create({context:{ok:true,readonly:false,document:stored,version:'a'.repeat(64),sha256,projectRevision:1},bridge:{applyDocument:async()=>{writes++;return {ok:false};}}});
 runInNewContext(contextScript,{window,document});const open=()=>window.SirenDocsContext.open({draft,canEdit:()=>true,onChange(){}});open();
 const live=node=>{for(let n=node;n;n=n.parent)if(n===document.body)return true;return false;};
 return {nodes,calls,window,draft,open,get writes(){return writes;},field:path=>nodes.find(n=>live(n)&&n.dataset.contextField===path),query:()=>nodes.find(n=>live(n)&&n.placeholder==='Find a document or diagram'),button:text=>nodes.find(n=>live(n)&&n.tagName==='BUTTON'&&n.textContent===text),targets:()=>nodes.filter(n=>live(n)&&n.dataset.referenceTarget),submit:()=>nodes.find(n=>live(n)&&n.tagName==='FORM').emit('submit'),hint:()=>nodes.find(n=>live(n)&&n.role==='status')?.textContent};
}
test('held Context search queues latest query and never shows stale rows or mixes pagination cursors',async()=>{
 const a=held(),b=held(),f=await fixture({getTargets:()=>f.calls.length===1?a.promise:f.calls.length===2?b.promise:Promise.resolve(page('Beta later',30,false))});
 const query=f.query();query.value='Alpha';f.button('Find').emit();query.value='Beta';query.emit('input');query.emit('keydown',{key:'Enter'});
 a.resolve(page('Alpha',20));await tick();assert.equal(f.targets().length,0);assert.deepEqual(f.calls,[{cursor:0,query:'Alpha'},{cursor:0,query:'Beta'}]);
 b.resolve(page('Beta',10));await tick();assert.deepEqual(f.targets().map(n=>n.textContent),['Beta · document']);await f.button('More').emit();
 assert.deepEqual(f.calls[2],{cursor:10,query:'Beta'});assert.equal(f.writes,0);
});
test('editing query after a loaded page clears its rows and starts the new query at zero',async()=>{
 const f=await fixture({getTargets:async q=>page(q.query,20)}),query=f.query();query.value='Alpha';await f.button('Find').emit();await tick();assert.equal(f.targets().length,1);
 query.value='Beta';query.emit('input');assert.equal(f.targets().length,0);assert.equal(f.button('More').hidden,true);query.emit('keydown',{key:'Enter'});await tick();
 assert.deepEqual(f.calls[1],{cursor:0,query:'Beta'});assert.deepEqual(f.targets().map(n=>n.textContent),['Beta · document']);
});
test('closed Context sheet cannot publish a held response into a newly opened sheet',async()=>{
 const a=held(),f=await fixture({getTargets:()=>a.promise});f.query().value='Old';f.button('Find').emit();f.window.SirenDocsContext.close();f.open();
 a.resolve(page('Old'));await tick();assert.equal(f.targets().length,0);assert.equal(f.query().value,'');assert.equal(f.draft.getStatus().dirty,false);
});
test('a failed stale query still starts its queued latest query without stale error text',async()=>{
 const a=held(),f=await fixture({getTargets:()=>f.calls.length===1?a.promise:Promise.resolve(page('Beta',0,false))});const query=f.query();query.value='Alpha';f.button('Find').emit();query.value='Beta';query.emit('input');query.emit('keydown',{key:'Enter'});
 a.reject(Error('controlled stale failure'));await tick();assert.deepEqual(f.calls[1],{cursor:0,query:'Beta'});assert.deepEqual(f.targets().map(n=>n.textContent),['Beta · document']);assert.doesNotMatch(f.hint(),/could not load/i);
});
test('Document type exposes only supported finite choices and an allowed choice applies to actual draft',async()=>{
 const f=await fixture(),field=f.field('type');assert.equal(field.children.some(n=>n.value===''),false);
 field.value='narrative';field.emit('input');f.submit();assert.equal(f.draft.getDocument().type,'narrative');assert.equal(f.draft.getStatus().dirty,true);assert.equal(f.writes,0);assert.equal(f.draft.getDocument().agent.future.preserve,'exact');
});
test('untyped imported document stays untyped when another Context field is applied',async()=>{
 const f=await fixture({type:null}),field=f.field('owner');field.value='Reviewed owner';field.emit('input');f.submit();assert.equal(f.draft.getDocument().owner,'Reviewed owner');assert.equal(Object.hasOwn(f.draft.getDocument(),'type'),false);assert.equal(f.writes,0);
});

test('unknown imported Document type is visible as disabled metadata and only supported choices are editable',async()=>{
 const f=await fixture({type:'vendor-imported'}),field=f.field('type'),imported=field.children.find(n=>n.value==='vendor-imported');assert.ok(imported);assert.equal(imported.disabled,true);assert.match(imported.textContent,/Imported/);assert.deepEqual(field.children.filter(n=>!n.disabled).map(n=>n.value),[...model.documentTypes]);assert.equal(field.value,'vendor-imported');assert.equal(f.draft.getStatus().dirty,false);assert.equal(f.writes,0);
});
test('synthetic unsupported type events cannot inject invalid patches into an unrelated owner edit',async()=>{
 for(const type of ['vendor-imported',null]){const f=await fixture({type}),field=f.field('type');field.value='vendor-imported';field.emit('input');const owner=f.field('owner');owner.value='Reviewed imported owner';owner.emit('input');f.submit();const actual=f.draft.getDocument();assert.equal(actual.owner,'Reviewed imported owner');assert.equal(Object.hasOwn(actual,'type'),type!==null);if(type!==null)assert.equal(actual.type,type);assert.equal(actual.agent.future.preserve,'exact');assert.equal(f.writes,0);assert.equal(f.field('owner'),undefined,'valid unrelated edit closes the sheet');}
});
test('unsupported imported event after a valid type choice cannot replace its supported pending patch',async()=>{
 const f=await fixture({type:'vendor-imported'}),field=f.field('type');field.value='note';field.emit('input');field.value='vendor-imported';field.emit('input');f.submit();assert.equal(f.draft.getDocument().type,'note');assert.equal(f.draft.getStatus().dirty,true);assert.equal(f.field('type'),undefined);assert.equal(f.writes,0);
});
test('unsupported finite choice alone cannot dirty the draft or keep an error dialog open',async()=>{
 const f=await fixture(),field=f.field('type');field.value='not-supported';field.emit('input');f.submit();assert.equal(f.draft.getDocument().type,'agent-spec');assert.equal(f.draft.getStatus().dirty,false);assert.equal(f.field('type'),undefined);assert.equal(f.writes,0);
});
test('unknown imported oversight and data flags are disabled and survive unrelated owner edits',async()=>{
 const f=await fixture({agentExtra:{oversight:{mode:'vendor-review',how:'Saved review'},data:{confidential:'vendor-flag',restrictions:'Saved boundary'}}});for(const [path,value]of [['agent.oversight.mode','vendor-review'],['agent.data.confidential','vendor-flag']]){const field=f.field(path),imported=field.children.find(n=>n.value===value);assert.ok(imported);assert.equal(imported.disabled,true);field.value=value;field.emit('input');}const owner=f.field('owner');owner.value='Reviewed owner';owner.emit('input');f.submit();const actual=f.draft.getDocument();assert.equal(actual.owner,'Reviewed owner');assert.equal(actual.agent.oversight.mode,'vendor-review');assert.equal(actual.agent.oversight.how,'Saved review');assert.equal(actual.agent.data.confidential,'vendor-flag');assert.equal(actual.agent.data.restrictions,'Saved boundary');assert.equal(actual.agent.future.preserve,'exact');assert.equal(f.writes,0);
});
