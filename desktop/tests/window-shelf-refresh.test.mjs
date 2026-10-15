import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const script=await readFile(new URL('../src/ui/windows/shelf.js',import.meta.url),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const item=(label,selected=false)=>({windowId:label.toLowerCase(),role:'docs',entityId:'doc-'+label.toLowerCase(),label,placement:'attached',selected,state:'active'});
function fixture(){
 const nodes=[],calls=[],listeners=new Map(),timers=[];
 class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.listeners=new Map();this.attributes=new Map();this.hidden=false;this.disabled=false;this._text='';const values=new Set();this.classList={add:x=>values.add(x),remove:x=>values.delete(x),toggle:(x,on)=>on?values.add(x):values.delete(x),contains:x=>values.has(x)};nodes.push(this);}
  append(child){this.children.push(child);}
  replaceChildren(...children){this.children=children;this._text='';}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(x=>x.textContent).join('');}
  setAttribute(key,value){this.attributes.set(key,String(value));}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  focus(){document.activeElement=this;}
 }
 const document={body:new Node('body'),readyState:'complete',activeElement:null,createElement:tag=>new Node(tag)};
 const window={sirenWindowDock:{getShelf:()=>{const d=deferred();calls.push(d);return d.promise;},showWorkspace:async()=>({ok:true}),detach:async()=>({ok:true})},sirenWindow:{focusView:async()=>({ok:true})},addEventListener:(name,fn)=>listeners.set(name,fn)};
 runInNewContext(script,{window,document,setInterval:fn=>{timers.push(fn);return 1;},clearInterval(){}});
 const refresh=()=>window.sirenNativeShelf.refresh();
 const bar=()=>nodes.find(x=>x.id==='nativeWindowShelf');
 const tabs=()=>nodes.find(x=>x.className==='native-shelf-tabs');
 return{calls,document,refresh,bar,tabs,unload:()=>listeners.get('unload')(),poll:()=>timers[0]()};
}
test('latest shelf request wins when an older successful refresh arrives last',async()=>{
 const f=fixture();f.calls[0].resolve({ok:true,items:[item('Initial')]});await settle();
 const old=f.refresh(),fresh=f.refresh();f.calls[2].resolve({ok:true,items:[item('New',true)]});await fresh;
 assert.equal(f.tabs().textContent,'New');f.calls[1].resolve({ok:true,items:[item('Old')]});await old;
 assert.equal(f.tabs().textContent,'New','late poll must not replace current window identity/selection');
 assert.equal(f.tabs().children[0].attributes.get('aria-pressed'),'true');
});
test('older rejected shelf poll cannot hide newer successful navigation',async()=>{
 const f=fixture(),old=f.refresh();f.calls[1].resolve({ok:true,items:[item('Current')]});await old;
 f.calls[0].reject(Error('late transport failure'));await settle();
 assert.equal(f.bar().hidden,false);assert.equal(f.document.body.classList.contains('native-shelf-open'),true);assert.equal(f.tabs().textContent,'Current');
});
test('older refused shelf reply cannot clear current tabs after a later reply',async()=>{
 const f=fixture(),fresh=f.refresh();f.calls[1].resolve({ok:true,items:[item('Current')]});await fresh;
 f.calls[0].resolve({ok:false,code:'VIEW_REFUSED'});await settle();
 assert.equal(f.bar().hidden,false);assert.equal(f.tabs().textContent,'Current');
});
test('current shelf refusal clears old navigation and a subsequent success recovers',async()=>{
 const f=fixture();f.calls[0].resolve({ok:true,items:[item('Current')]});await settle();
 const refused=f.refresh();f.calls[1].resolve({ok:false});await refused;assert.equal(f.bar().hidden,true);assert.equal(f.tabs().children.length,0);
 const again=f.refresh();f.calls[2].resolve({ok:true,items:[item('Recovered',true)]});await again;
 assert.equal(f.bar().hidden,false);assert.equal(f.tabs().textContent,'Recovered');
});
test('current transport failure can recover with exactly the same saved window list',async()=>{
 const f=fixture(),rows=[item('Current',true)];f.calls[0].resolve({ok:true,items:rows});await settle();
 const failed=f.refresh();f.calls[1].reject(Error('current transport failure'));await failed;assert.equal(f.bar().hidden,true);
 const recovered=f.refresh();f.calls[2].resolve({ok:true,items:rows});await recovered;
 assert.equal(f.bar().hidden,false,'identical current rows must restore the hidden shelf after an error');
 assert.equal(f.document.body.classList.contains('native-shelf-open'),true);assert.equal(f.tabs().textContent,'Current');
});
test('equal current shelf rows preserve exact focused tab rather than reconstructing it',async()=>{
 const f=fixture(),rows=[item('Current',true)];f.calls[0].resolve({ok:true,items:rows});await settle();
 const tab=f.tabs().children[0];tab.focus();const again=f.refresh();f.calls[1].resolve({ok:true,items:rows});await again;
 assert.equal(f.tabs().children[0],tab);assert.equal(f.document.activeElement,tab);
});
test('unloaded shelf never paints settled or rejected requests and never polls again',async()=>{
 const f=fixture(),fresh=f.refresh();f.unload();f.calls[1].resolve({ok:true,items:[item('Disposed')]});await fresh;f.calls[0].reject(Error('late disposed failure'));await settle();
 assert.equal(f.bar(),undefined);f.poll();assert.equal(f.calls.length,2);
});
