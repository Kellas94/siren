import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {createDiagramCatalogueContract} from '../src/documents/diagram-catalogue.mjs';

// Missing production view is an assertion failure in the initial RED run.
const script=await readFile(new URL('../src/ui/diagram/catalogue-view.js',import.meta.url),'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
const digest='a'.repeat(64);
const row=(id='starter:flowchart',extra={})=>({id,title:'Flowchart',kind:id.startsWith('template:')?'template':'starter',group:'Process',description:'Build supports admitted flowchart syntax only.',source:'flowchart TD\n A["<img src=x onerror=alert(1)>"] --> B',build:'flowchart-subset',guided:'source-lines',sourceSha256:digest,...extra});
const page=(rows=[row()],extra={})=>({ok:true,rows,total:rows.length,nextCursor:null,canCreate:true,version:1,referenceSha256:digest,...extra});
const saved=(extra={})=>({ok:true,entityId:'diagram-created',creation:{version:1,sha256:digest,projectRevision:2,durability:'committed'},current:{available:true,version:1,sha256:digest,projectRevision:2},opening:{ok:true,view:{windowId:'window-created',role:'diagram',entityId:'diagram-created',epoch:1}},...extra});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

function fixture({getPage=async()=>page(),createDiagram=async()=>saved(),allowed=true}={}){
 class Element{
  children=[];listeners=new Map();attrs={};value='';hidden=false;disabled=false;parentNode=null;className='';text='';
  constructor(tag){this.tagName=tag.toUpperCase();}
  set textContent(value){this.text=String(value);this.children=[];}
  get textContent(){return this.text+this.children.map(child=>child.textContent).join('');}
  set innerHTML(value){throw Error('HTML injection is forbidden: '+value);}
  append(...children){for(const child of children){child.parentNode=this;this.children.push(child);}}
  replaceChildren(...children){for(const child of this.children)child.parentNode=null;this.text='';this.children=[];this.append(...children);}
  setAttribute(key,value){this.attrs[key]=String(value);}
  getAttribute(key){return this.attrs[key]??null;}
  removeAttribute(key){delete this.attrs[key];}
  addEventListener(type,callback){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(callback);}
  removeEventListener(type,callback){this.listeners.get(type)?.delete(callback);}
  emit(type,event={}){for(const callback of [...this.listeners.get(type)||[]])callback({target:this,key:'',preventDefault(){},stopPropagation(){},...event});}
  focus(){document.activeElement=this;}
 }
 const document={createElement:tag=>new Element(tag),activeElement:null},window={};
 vm.runInNewContext(script,{window,document,crypto:webcrypto,TextEncoder});
 assert.equal(typeof window.SirenDiagramCatalogueView?.create,'function','catalogue view API must exist');
 const host=new Element('section'),calls=[],creates=[],closed=[];
 const view=window.SirenDiagramCatalogueView.create({host,bridge:{getPage:async request=>{calls.push(structuredClone(request));return getPage(structuredClone(request));},createDiagram:async request=>{creates.push(structuredClone(request));return createDiagram(structuredClone(request));}},enabled:()=>allowed,onClose:options=>closed.push(structuredClone(options))});
 const all=()=>{const result=[];const visit=node=>{result.push(node);for(const child of node.children)visit(child);};visit(host);return result;};
 const control=name=>all().find(node=>node.attrs['data-catalogue-control']===name);
 const choose=id=>all().find(node=>node.attrs['data-catalogue-entry']===id)?.emit('click');
 return{document,host,view,calls,creates,closed,all,control,choose,setAllowed:value=>{allowed=value;}};
}

test('opening browses only a bounded page; selecting previews literal source without rendering, mutation or implicit creation',async()=>{
 const f=fixture();assert.equal(Object.isFrozen(f.view),true);assert.equal(f.view.isOpen(),false);assert.equal(f.host.hidden,true);
 assert.equal(await f.view.open(),true);assert.deepEqual(f.calls,[{kind:'all',cursor:0,limit:20}]);assert.equal(f.view.isOpen(),true);assert.equal(f.control('create').disabled,true);
 f.choose('starter:flowchart');assert.equal(f.control('source').textContent,row().source);assert.match(f.control('capabilities').textContent,/Build.*subset/);assert.match(f.control('capabilities').textContent,/Guided.*source lines/);assert.equal(f.control('title').maxLength,160);assert.equal(f.creates.length,0);
 assert.equal(f.all().some(node=>['IMG','SVG','SCRIPT','IFRAME'].includes(node.tagName)),false);assert.equal(f.control('create').disabled,false);
});

test('opening moves keyboard focus to Cancel before loading; reopening an open catalogue does not steal an edited title focus',async()=>{const pending=deferred(),f=fixture({getPage:()=>pending.promise});const opening=f.view.open();assert.equal(f.document.activeElement,f.control('cancel'));pending.resolve(page());await opening;f.document.activeElement=f.control('title');await f.view.open();assert.equal(f.document.activeElement,f.control('title'));f.view.close();await f.view.open();assert.equal(f.document.activeElement,f.control('cancel'));});

test('creation sends only the selected entry, exact title and UUID; successful opening closes without restoring origin focus',async()=>{
 const f=fixture();await f.view.open();f.choose('starter:flowchart');const input=f.control('title');input.value='My exact title';input.emit('input');f.control('create').emit('click');await settle();
 assert.equal(f.creates.length,1);assert.deepEqual(Object.keys(f.creates[0]).sort(),['entryId','operationId','title']);assert.equal(f.creates[0].entryId,'starter:flowchart');assert.equal(f.creates[0].title,'My exact title');assert.match(f.creates[0].operationId,/^[a-f0-9-]{36}$/);assert.equal(f.view.isOpen(),false);assert.equal(f.host.textContent,'');assert.deepEqual(f.closed,[{restoreFocus:false}]);
});

test('saved but unopened retains exact operation for deliberate retry and never reports that creation failed',async()=>{
 let count=0;const f=fixture({createDiagram:async()=>++count===1?saved({opening:{ok:false,code:'OPEN_UNAVAILABLE'}}):saved()});await f.view.open();f.choose('starter:flowchart');f.control('create').emit('click');await settle();
 assert.equal(f.view.isOpen(),true);assert.match(f.control('status').textContent,/saved/i);assert.match(f.control('status').textContent,/could not open/i);assert.match(f.control('create').textContent,/Retry opening/i);assert.equal(f.closed.length,0);assert.equal(f.creates.length,1);
 f.control('create').emit('click');await settle();assert.deepEqual(f.creates[1],f.creates[0]);assert.equal(f.view.isOpen(),false);
});

test('rejected and unsuccessful requests retain the exact operation, with no automatic retry',async()=>{
 let count=0;const f=fixture({createDiagram:async()=>{count++;if(count===1)throw Error('private filesystem path');return{ok:false,code:'WRITE_REFUSED'};}});await f.view.open();f.choose('starter:flowchart');f.control('create').emit('click');await settle();assert.equal(count,1);assert.match(f.control('status').textContent,/not confirmed/i);assert.doesNotMatch(f.host.textContent,/private filesystem/);
 f.control('create').emit('click');await settle();assert.equal(count,2);assert.deepEqual(f.creates[1],f.creates[0]);assert.match(f.control('status').textContent,/not confirmed/i);assert.equal(f.closed.length,0);
});

test('changing selection or title after a failure creates a fresh operation, while repeated selection preserves it',async()=>{
 const f=fixture({getPage:async()=>page([row(),row('starter:state',{title:'State',build:'code-first'})]),createDiagram:async()=>({ok:false,code:'WRITE_REFUSED'})});await f.view.open();f.choose('starter:flowchart');f.control('create').emit('click');await settle();f.choose('starter:flowchart');f.control('create').emit('click');await settle();assert.equal(f.creates[1].operationId,f.creates[0].operationId);
 f.control('title').value='New title';f.control('title').emit('input');f.control('create').emit('click');await settle();assert.notEqual(f.creates[2].operationId,f.creates[1].operationId);
 f.choose('starter:state');assert.match(f.control('capabilities').textContent,/code first/i);assert.doesNotMatch(f.control('capabilities').textContent,/mouse.*available/i);f.control('create').emit('click');await settle();assert.notEqual(f.creates[3].operationId,f.creates[2].operationId);
});

test('busy creation blocks duplicate sends, title edits, selection and paging without queuing future work',async()=>{
 const pending=deferred();const f=fixture({getPage:async()=>page([row(),row('starter:state',{title:'State'})]),createDiagram:()=>pending.promise});await f.view.open();f.choose('starter:flowchart');f.control('create').emit('click');f.control('create').emit('click');assert.equal(f.control('title').disabled,true);f.control('title').value='Injected while disabled';f.control('title').emit('input');f.choose('starter:state');f.control('kind').value='template';f.control('kind').emit('change');assert.equal(f.creates.length,1);assert.equal(f.calls.length,1);
 pending.resolve({ok:false,code:'WRITE_REFUSED'});await settle();assert.equal(f.control('title').value,'Flowchart');f.control('create').emit('click');await settle();assert.equal(f.creates[1].entryId,'starter:flowchart');assert.equal(f.creates[1].title,'Flowchart');assert.equal(f.creates[1].operationId,f.creates[0].operationId);
});

test('paging replaces rows instead of accumulating sources; filters reset to the first page and show honest group labels',async()=>{
 const rows=Array.from({length:22},(_,i)=>row('starter:item'+i,{title:'Diagram '+i,group:i<10?'Process':'Systems'}));const f=fixture({getPage:async request=>request.kind==='template'?page([row('template:sample',{title:'Example',group:'Examples'})]):page(rows.slice(request.cursor,request.cursor+20),{total:22,nextCursor:request.cursor===0?20:null})});await f.view.open();assert.equal(f.all().filter(node=>node.attrs['data-catalogue-entry']).length,20);assert.match(f.control('list').textContent,/Starters.*Process/);f.choose('starter:item0');f.control('next').emit('click');await settle();assert.deepEqual(f.calls[1],{kind:'all',cursor:20,limit:20});assert.equal(f.all().filter(node=>node.attrs['data-catalogue-entry']).length,2);assert.equal(f.control('source').textContent,'');assert.equal(f.control('previous').disabled,false);
 f.control('previous').emit('click');await settle();assert.equal(f.calls[2].cursor,0);f.control('kind').value='template';f.control('kind').emit('change');await settle();assert.deepEqual(f.calls[3],{kind:'template',cursor:0,limit:20});assert.match(f.control('list').textContent,/Templates.*Examples/);assert.equal(f.all().filter(node=>node.attrs['data-catalogue-entry']).length,1);
});

test('read-only browsing explains creation restrictions and cannot send a forged click',async()=>{
 const f=fixture({getPage:async()=>page([row()],{canCreate:false})});await f.view.open();f.choose('starter:flowchart');assert.equal(f.control('create').disabled,true);assert.match(f.control('status').textContent,/read.only|read only/i);assert.equal(f.control('source').textContent,row().source);f.control('create').emit('click');await settle();assert.equal(f.creates.length,0);
});

test('invalid title never mutates; blank resets to a useful selected title and overlong or malformed title is refused',async()=>{
 const f=fixture({createDiagram:async()=>({ok:false,code:'WRITE_REFUSED'})});await f.view.open();f.choose('starter:flowchart');const input=f.control('title');input.value='x'.repeat(161);input.emit('input');assert.equal(f.control('create').disabled,true);f.control('create').emit('click');await settle();assert.equal(f.creates.length,0);assert.equal(input.getAttribute('aria-invalid'),'true');
 input.value='\ud800';input.emit('input');f.control('create').emit('click');await settle();assert.equal(f.creates.length,0);input.value='';input.emit('input');assert.equal(f.control('create').disabled,false);f.control('create').emit('click');await settle();assert.equal(f.creates[0].title,'Flowchart');
});

test('cancel invalidates pending replies and clears private source; a later open cannot be closed by the old mutation',async()=>{
 const mutation=deferred();const f=fixture({createDiagram:()=>mutation.promise});await f.view.open();f.choose('starter:flowchart');f.control('create').emit('click');f.view.close();assert.equal(f.host.textContent,'');assert.equal(f.view.isOpen(),false);assert.deepEqual(f.closed,[{restoreFocus:true}]);await f.view.open();assert.equal(f.view.isOpen(),true);mutation.resolve(saved());await settle();assert.equal(f.view.isOpen(),true);assert.equal(f.closed.length,1);assert.equal(f.control('source').textContent,'');
});

test('pause and dispose reject stale page responses, remove listeners, clear all private previews and never restore focus',async()=>{
 const wait=deferred();const f=fixture({getPage:()=>wait.promise});const opened=f.view.open();const oldControls=f.all();f.view.pause();wait.resolve(page());assert.equal(await opened,false);assert.equal(f.host.textContent,'');assert.equal(f.closed.length,0);for(const node of oldControls)for(const callbacks of node.listeners.values())assert.equal(callbacks.size,0);
 await f.view.open();f.choose('starter:flowchart');const controls=f.all();f.view.dispose();assert.equal(f.view.isOpen(),false);assert.equal(f.host.textContent,'');assert.equal(await f.view.open(),false);for(const node of controls)for(const callbacks of node.listeners.values())assert.equal(callbacks.size,0);assert.equal(f.closed.length,0);
});

test('permission revocation rejects late mutation results and prevents new operations until root pauses or closes',async()=>{
 const wait=deferred();const f=fixture({createDiagram:()=>wait.promise});await f.view.open();f.choose('starter:flowchart');f.control('create').emit('click');f.setAllowed(false);wait.resolve(saved());await settle();assert.equal(f.view.isOpen(),false);assert.equal(f.host.textContent,'');assert.equal(f.closed.length,0);assert.equal(await f.view.open(),false);
});

test('malformed or oversized pages and duplicate rows are refused before their contents reach the preview',async()=>{
 const variants=[page(Array.from({length:21},(_,i)=>row('starter:item'+i))),page([row(),row()]),page([row('starter:unsafe',{source:'x'.repeat(8193)})]),page([row()],{nextCursor:99}),page([row()],{total:100000}),page([row()],{referenceSha256:'bad'})];
 for(const value of variants){const f=fixture({getPage:async()=>value});await f.view.open();assert.equal(f.all().filter(node=>node.attrs['data-catalogue-entry']).length,0);assert.equal(f.control('source').textContent,'');assert.equal(f.control('create').disabled,true);assert.match(f.control('status').textContent,/unavailable/i);assert.equal(f.creates.length,0);}
});

test('failed browsing remains retryable without exposing errors or automatically fetching again',async()=>{
 let count=0;const f=fixture({getPage:async()=>{if(++count===1)throw Error('secret');return page();}});assert.equal(await f.view.open(),false);assert.equal(f.view.isOpen(),true);assert.equal(count,1);assert.doesNotMatch(f.host.textContent,/secret/);assert.equal(f.control('retry').hidden,false);f.control('retry').emit('click');await settle();assert.equal(count,2);f.choose('starter:flowchart');assert.equal(f.control('source').textContent,row().source);
});

test('saved but unavailable is distinguished from failure and malformed success cannot navigate or close',async()=>{
 const f=fixture({createDiagram:async()=>saved({current:{available:false,code:'ENTITY_REFUSED',projectRevision:3},opening:{ok:false,code:'ENTITY_REFUSED'}})});await f.view.open();f.choose('starter:flowchart');f.control('create').emit('click');await settle();assert.match(f.control('status').textContent,/saved/i);assert.match(f.control('status').textContent,/no longer available/i);assert.equal(f.closed.length,0);
 const malformed=fixture({createDiagram:async()=>saved({opening:{ok:true,view:{windowId:'w',role:'docs',entityId:'other',epoch:1}}})});await malformed.view.open();malformed.choose('starter:flowchart');malformed.control('create').emit('click');await settle();assert.equal(malformed.closed.length,0);assert.equal(malformed.view.isOpen(),true);assert.match(malformed.control('status').textContent,/not confirmed/i);
});

test('Escape cancels exactly once, repeated open adds no listeners or fetch and each view owns its private controls',async()=>{
 const f=fixture(),other=fixture();await f.view.open();await other.view.open();const count=f.all().reduce((sum,node)=>sum+[...node.listeners.values()].reduce((n,set)=>n+set.size,0),0);await f.view.open();assert.equal(f.calls.length,1);assert.equal(f.all().reduce((sum,node)=>sum+[...node.listeners.values()].reduce((n,set)=>n+set.size,0),0),count);f.choose('starter:flowchart');assert.equal(other.control('source').textContent,'');let prevented=0;f.host.emit('keydown',{key:'Escape',preventDefault(){prevented++;}});f.view.close();assert.equal(prevented,1);assert.deepEqual(f.closed,[{restoreFocus:true}]);assert.equal(other.view.isOpen(),true);
});

test('reopening after pause or cancel keeps a single host class and a bounded listener set',async()=>{
 const f=fixture();for(let i=0;i<12;i++){await f.view.open();assert.equal(f.host.className.split(/\s+/).filter(value=>value==='siren-diagram-catalogue').length,1);const nodes=f.all();f.choose('starter:flowchart');if(i%2)f.view.close();else f.view.pause();assert.equal(f.host.textContent,'');for(const node of nodes)for(const listeners of node.listeners.values())assert.equal(listeners.size,0);}assert.equal(f.calls.length,12);assert.equal(f.closed.length,6);
});

test('reselecting an already saved entry retains its saved/open-failed explanation and exact retry',async()=>{
 const f=fixture({createDiagram:async()=>saved({opening:{ok:false,code:'OPEN_UNAVAILABLE'}})});await f.view.open();f.choose('starter:flowchart');f.control('create').emit('click');await settle();const message=f.control('status').textContent;f.choose('starter:flowchart');assert.equal(f.control('status').textContent,message);f.control('create').emit('click');await settle();assert.deepEqual(f.creates[1],f.creates[0]);
});

test('editing a title during read-only browsing retains the read-only explanation',async()=>{
 const f=fixture({getPage:async()=>page([row()],{canCreate:false})});await f.view.open();f.choose('starter:flowchart');f.control('title').value='My title';f.control('title').emit('input');assert.match(f.control('status').textContent,/read.only|read only/i);assert.equal(f.control('create').disabled,true);
});

test('all real frozen catalogue rows retain exact source and finite page behavior in the actual renderer controller',async()=>{
 const catalogue=createDiagramCatalogueContract(),seen=new Set();const f=fixture({getPage:async request=>({...catalogue.page(request),canCreate:false,version:catalogue.version,referenceSha256:catalogue.referenceSha256})});await f.view.open();
 for(let cursor=0;;){for(const row of catalogue.page({kind:'all',cursor,limit:20}).rows){f.choose(row.id);assert.equal(f.control('source').textContent,row.source,row.id);assert.equal(f.control('heading').textContent,row.title);seen.add(row.id);}const next=catalogue.page({kind:'all',cursor,limit:20}).nextCursor;if(next===null)break;f.control('next').emit('click');await settle();cursor=next;}
 assert.equal(seen.size,catalogue.entries.length);assert.equal(f.creates.length,0);assert.ok(f.all().filter(node=>node.attrs['data-catalogue-entry']).length<=20);
});
