import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

// Pure renderer regressions: the complete production scripts execute unchanged
// in a finite inert DOM. IPC below returns only controlled records/receipts; it
// never opens an application window, saves a project or changes native policy.
const [desktopScript,syncScript,shellScript]=await Promise.all([
  '../src/ui/desktop.js','../src/ui/shared/appearance-sync.js','../src/ui/shared/shell.js'
].map(path=>readFile(new URL(path,import.meta.url),'utf8')));

function inertDOM(role='home'){
  const nodes=[],documentListeners=new Map(),windowListeners=new Map();
  const listenersFor=(target,name)=>target.get(name)??[];
  class Node{
    constructor(tag){
      this.tagName=tag.toUpperCase();this.children=[];this.parentNode=null;this.dataset={};this.attributes=new Map();this.listeners=new Map();this.hidden=false;this.disabled=false;this.value='';this._text='';this.style={setProperty(){}};this._classes=new Set();
      this.classList={add:(...values)=>values.forEach(value=>this._classes.add(value)),remove:(...values)=>values.forEach(value=>this._classes.delete(value)),toggle:(value,on)=>{const wanted=on??!this._classes.has(value);if(wanted)this._classes.add(value);else this._classes.delete(value);return wanted;}};
      nodes.push(this);
    }
    get textContent(){return this._text+this.children.map(node=>node.textContent).join('');}
    set textContent(value){this._text=String(value);this.children=[];}
    append(...children){for(const child of children){child.remove();child.parentNode=this;this.children.push(child);}}
    prepend(...children){for(const child of [...children].reverse()){child.remove();child.parentNode=this;this.children.unshift(child);}}
    insertBefore(child,before){const index=this.children.indexOf(before);if(index<0){this.append(child);return;}child.remove();child.parentNode=this;this.children.splice(index,0,child);}
    replaceChildren(...children){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';this.append(...children);}
    remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    getAttribute(name){return this.attributes.get(name)??null;}
    removeAttribute(name){this.attributes.delete(name);}
    addEventListener(name,callback){this.listeners.set(name,[...listenersFor(this.listeners,name),callback]);}
    removeEventListener(name,callback){this.listeners.set(name,listenersFor(this.listeners,name).filter(item=>item!==callback));}
    dispatchEvent(event){for(const callback of listenersFor(this.listeners,event.type))callback(event);return true;}
    focus(){document.activeElement=this;}
    click(){if(this.disabled)return;return Promise.all(listenersFor(this.listeners,'click').map(callback=>callback({type:'click',target:this})));}
  }
  const body=new Node('body');body.dataset.role=role;
  const document={body,documentElement:new Node('html'),readyState:'complete',activeElement:null,createElement:tag=>new Node(tag),getElementById:id=>nodes.find(node=>node.id===id),querySelector:()=>null,
    addEventListener(name,callback){documentListeners.set(name,[...listenersFor(documentListeners,name),callback]);},dispatchEvent(event){for(const callback of listenersFor(documentListeners,event.type))callback(event);}};
  const window={addEventListener(name,callback){windowListeners.set(name,[...listenersFor(windowListeners,name),callback]);}};
  return {document,window,nodes};
}
const settle=async()=>{await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));};
const currentSurface=role=>role==='diagram'?'diagrams':role==='presenter'?'present':role;

async function shellFixture({role='home',navigate=async()=>({ok:false,code:'SAVE_REFUSED'})}={}){
  const dom=inertDOM(role),calls=[];
  dom.window.sirenShell={getAppearance:async()=>({ok:true,theme:'dark'}),setAppearance:async()=>({ok:false}),navigate:async input=>{calls.push(input);return navigate(input);}};
  dom.window.SirenAppearancePalette=[{id:'dark',name:'Dark',mode:'dark',colors:{}}];
  const context={window:dom.window,document:dom.document,location:{pathname:role==='home'?'/home.html':'/windows/'+role+'.html'},matchMedia:()=>({matches:true,addEventListener(){}}),setInterval:()=>1,clearInterval(){},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
  runInNewContext(syncScript,context);runInNewContext(shellScript,context);await settle();
  const jump=dom.nodes.find(node=>node.className==='siren-module-jump'),bar=dom.document.getElementById('sirenAppNavigation'),note=dom.nodes.find(node=>node.className==='siren-navigation-status');
  assert.ok(jump);assert.equal(bar.hidden,false,'fixture received genuine positive appearance admission');
  const selected=()=>dom.nodes.filter(node=>node.getAttribute('aria-current')==='page').map(node=>node.dataset.surface);
  const choose=surface=>{jump.value=surface;jump.dispatchEvent({type:'change',target:jump});};
  return {...dom,calls,jump,bar,note,selected,choose};
}

const records=Object.freeze([
  {windowId:'workspace',role:'workspace',entityId:null,state:'active'},
  {windowId:'code-a',role:'code',entityId:'source-a',state:'active'},
  {windowId:'docs-a',role:'docs',entityId:'document-a',state:'active'},
  {windowId:'diagram-a',role:'diagram',entityId:'flow-a',state:'active'},
  {windowId:'presenter-a',role:'presenter',entityId:'deck-a',state:'active'},
  {windowId:'audience-a',role:'audience',entityId:'deck-a',state:'minimized'}
].map(Object.freeze));
async function desktopFixture(){
  const dom=inertDOM('diagrams'),focused=[],before=JSON.stringify(records);
  dom.window.sirenDesktopBootstrap={mode:'normal'};dom.window.sirenDesktop={onStatus(){},onCommand(){}};
  dom.window.sirenWindow={getCatalog:async()=>({ok:true,items:[],nextCursor:0,hasMore:false}),listViews:async()=>({ok:true,views:records}),focusView:async input=>{focused.push(input.windowId);return {ok:true};}};
  runInNewContext(desktopScript,{window:dom.window,document:dom.document,location:{},Promise});
  await dom.document.getElementById('desktopWindows').click();await settle();
  const rows=dom.document.getElementById('desktopOpenWindows').children;
  assert.equal(JSON.stringify(records),before,'renderer must leave allowed-role IPC records untouched');
  return {...dom,rows,focused};
}

test('Studio Windows distinguishes all five role labels including private Presenter and public Audience',async()=>{
  const f=await desktopFixture(),labels={code:'⌘ Code',docs:'Docs',diagram:'Diagrams',presenter:'Presenter',audience:'Audience'};
  assert.equal(f.rows.length,5,'workspace itself is not a restore entry');
  for(const record of records.filter(record=>record.role!=='workspace')){
    const row=f.rows.find(node=>node.dataset.windowId===record.windowId);assert.ok(row,record.windowId);
    assert.ok(row.textContent.startsWith(labels[record.role]+' · '),record.role+' must not be represented as another module: '+row.textContent);
    assert.ok(row.textContent.endsWith(record.state==='minimized'?'Restore':'Show'));
  }
});

test('Studio restore labels never change exact windowId routing even for a shared Presenter/Audience deck',async()=>{
  const f=await desktopFixture();
  for(const id of ['presenter-a','audience-a','code-a','docs-a','diagram-a']){
    const row=f.document.getElementById('desktopOpenWindows').children.find(node=>node.dataset.windowId===id);assert.ok(row);await row.click();await settle();
  }
  assert.deepEqual(f.focused,['presenter-a','audience-a','code-a','docs-a','diagram-a']);
});

for(const role of ['home','diagram','presenter'])test('compact selector restores actual '+role+' after a refused module request',async()=>{
  const f=await shellFixture({role}),current=currentSurface(role);assert.equal(f.jump.value,current);assert.deepEqual(f.selected(),[current]);
  f.choose('docs');await settle();assert.equal(f.calls.length,1);assert.equal(f.calls[0].surface,'docs');
  assert.equal(f.jump.value,current,'a failed save/navigation receipt must not change the shown current module');
  assert.deepEqual(f.selected(),[current]);assert.equal(f.document.body.dataset.role,role);assert.equal(f.bar.getAttribute('aria-busy'),'false');assert.equal(f.note.textContent,'Navigation unavailable. Your work was retained.');
  f.choose('code');await settle();assert.equal(f.calls.length,2,'a refusal must release navigation admission for another intentional request');assert.equal(f.jump.value,current);
});

test('compact selector restores the actual Code role when navigation throws',async()=>{
  const f=await shellFixture({role:'code',navigate:async()=>{throw Error('synthetic IPC refusal');}});
  f.choose('docs');await settle();assert.equal(f.calls.length,1);assert.equal(f.jump.value,'code');assert.deepEqual(f.selected(),['code']);assert.equal(f.bar.getAttribute('aria-busy'),'false');assert.equal(f.note.textContent,'Navigation unavailable. Your work was retained.');
});

test('ignored selector changes during a pending request restore currentness without dispatching another operation',async t=>{
  let release;const held=new Promise(resolve=>{release=resolve;}),f=await shellFixture({navigate:()=>held});t.after(()=>release({ok:false,code:'SAVE_REFUSED'}));
  f.choose('docs');assert.equal(f.calls.length,1);assert.equal(f.bar.getAttribute('aria-busy'),'true');
  f.choose('code');assert.equal(f.calls.length,1,'the second selector event must not bypass pending navigation');assert.equal(f.jump.value,'home','ignored selection must not advertise a destination that was never dispatched');assert.deepEqual(f.selected(),['home']);
  release({ok:false,code:'SAVE_REFUSED'});await settle();assert.equal(f.jump.value,'home');assert.equal(f.bar.getAttribute('aria-busy'),'false');
});

test('a successful navigation ACK alone does not relabel the current Home renderer as the destination module',async()=>{
  const f=await shellFixture({navigate:async()=>({ok:true})});
  f.choose('docs');await settle();assert.equal(f.calls.length,1);assert.equal(f.calls[0].surface,'docs');assert.equal(f.document.body.dataset.role,'home','the fixture acknowledged routing without replacing this renderer');
  assert.deepEqual(f.selected(),['home']);assert.equal(f.jump.value,'home','opening/focusing a module elsewhere is not proof that this renderer changed roles');assert.equal(f.bar.getAttribute('aria-busy'),'false');assert.notEqual(f.note.textContent,'Navigation unavailable. Your work was retained.');
});
