// Actual editor controller + actual Help catalog/resolver/view/workspace.
// CM rendering and persistence adapters are finite doubles, not native proof.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import vm from 'node:vm';
import {readHelpBrowser} from '../build/help.mjs';import {createCodeCommands} from '../src/ui/code/commands.js';
const source=await fs.readFile(new URL('../src/ui/code/editor.js',import.meta.url),'utf8');
const help=await readHelpBrowser(),view=await fs.readFile(new URL('../src/ui/shared/help.js',import.meta.url),'utf8'),workspace=await fs.readFile(new URL('../src/ui/shared/help-workspace.js',import.meta.url),'utf8');
class Element{
 constructor(tag,document){this.tagName=tag.toUpperCase();this.document=this.ownerDocument=document;this.children=[];this.listeners=new Map();this.dataset={};this.style={};this.value='';this.hidden=false;this._text='';this.classList={toggle(){}};}
 set textContent(v){this._text=String(v);this.replaceChildren();}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 get isConnected(){return this.parent?this.parent.isConnected:this===this.document.body;}
 append(...nodes){for(const n of nodes){n.remove();n.parent=this;this.children.push(n);if(this.tagName==='SELECT'&&!this.value)this.value=n.value;}}
 replaceChildren(...nodes){for(const n of [...this.children])n.remove();this.children=[];this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}
 setAttribute(k,v){this[k]=v;}addEventListener(k,f){const a=this.listeners.get(k)??[];a.push(f);this.listeners.set(k,a);}removeEventListener(k,f){this.listeners.set(k,(this.listeners.get(k)??[]).filter(n=>n!==f));}
 emit(k,e={}){for(const f of this.listeners.get(k)??[])f({preventDefault(){},...e});}click(){this.emit('click');}focus(){this.document.activeElement=this;}showModal(){this.open=true;}close(){this.open=false;this.emit('close');}contains(n){return n===this||this.children.some(c=>c.contains(n));}
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const tick=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function fixture({withHelp=true}={}){
 const document={createElement(tag){return new Element(tag,this);},getElementById(id){let found;const walk=n=>{if(n.id===id)found=n;for(const child of n.children)walk(child);};walk(this.body);return found;},addEventListener(){},removeEventListener(){}};
 document.body=document.createElement('body');document.documentElement=document.createElement('html');
 const win={sirenShell:{},addEventListener(){},innerWidth:1000,innerHeight:800};document.defaultView=win;
 const nav=document.createElement('nav');nav.id='sirenAppNavigation';nav.hidden=false;document.body.append(nav);const container=document.createElement('div');document.body.append(container);
 const ref={sourceId:'owned',version:1,sha256:'a'.repeat(64)},state={doc:{length:12,lineAt:()=>({number:1})},selection:{main:{from:0,to:0,head:0,empty:true}}};let value={ready:false,paused:false,disposed:false,readonly:false,fenced:false,dirty:false,pending:0,saving:false,sourceRef:ref,code:null};const observers=new Set(),calls={open:0,flush:0},controls={load:async()=>({ok:false,code:'CORRUPT_SOURCE'}),save:async()=>({ok:false,code:'REVISION_CONFLICT'})};
 const notify=()=>{for(const f of observers)f({...value});};
 const adapter={getStatus:()=>({...value}),getState:()=>value.ready?state:null,getSourceText:()=>({toString:()=> 'owned draft'}),async open(){calls.open++;const r=await controls.load();if(r.ok)value={...value,ready:true,code:null};else value={...value,code:r.code};notify();return r;},async flush(){calls.flush++;const r=await controls.save();if(!r.ok)value={...value,code:r.code};notify();return r;},pauseView(){value={...value,paused:true};notify();return{ok:true};},resumeView(){value={...value,paused:false};notify();return{ok:true};},subscribe(f){observers.add(f);return()=>observers.delete(f);},dispose(){value={...value,disposed:true};observers.clear();},applyTransaction:()=>({ok:true})};
 class Compartment{of(){return{};}reconfigure(){return{};}}
 class EditorView{constructor(o){this.state=o.state;this.contentDOM=document.createElement('div');}focus(){}dispatch(){}destroy(){}static theme(){return{};}static domEventHandlers(){return{};}}
 EditorView.editable={of:()=>({})};EditorView.contentAttributes={of:()=>({})};EditorView.lineWrapping={};
 const context={document,window:win,Compartment,EditorView,keymap:{of:()=>({})},lineNumbers:()=>({}),drawSelection:()=>({}),defaultKeymap:[],indentWithTab:{},search:()=>({}),searchKeymap:[],openSearchPanel(){},indentUnit:{of:()=>({})},syntaxHighlighting:()=>({}),HighlightStyle:{define:()=>({})},tags:{special:x=>x,function:x=>x},createEditorAdapter:()=>adapter,createCodeCommands,readonlySelectionGuard:()=>({}),sourceHistoryInput(){},preserveMultilineInput(){},sourceUndo(){},sourceRedo(){},sourceHistoryKeymap:[],createCodeViewLifecycle:()=>({flushView:async()=>({ok:false}),resumeView:()=>adapter.resumeView()})};
 if(withHelp)for(const script of [help,view,workspace])vm.runInNewContext(script,context,{timeout:1000});
 const code=source.replace(/^import .*;\r?\n/gm,'').replace('export function createCodeEditor','function createCodeEditor')+'\nthis.create=createCodeEditor;';vm.runInNewContext(code,context,{timeout:1000});
 const api=context.create({container,client:{},language:'text'}),node=id=>document.getElementById(id),offers=()=>{const out=[];const walk=n=>{if(n.className==='siren-help-error')out.push(n);for(const c of n.children)walk(c);};walk(container);return out;};
 return{api,ref,node,offers,controls,calls,help:win.SirenHelpWorkspace,markReady(){value={...value,ready:true,dirty:true};},pause:()=>api.pauseView(),resume:()=>api.resumeRefresh()};
}
test('explicit Code read refusal opens existing integrity explanation without another read',async()=>{
 const f=fixture();try{const r=await f.api.open(f.ref);assert.equal(r.code,'CORRUPT_SOURCE');assert.equal(f.offers().length,1);f.offers()[0].click();assert.match(f.node('sirenHelpArticle').textContent,/Stored source integrity/);assert.match(f.node('sirenHelpContext').textContent,/CORRUPT_SOURCE/);assert.equal(f.calls.open,1);}finally{f.api.dispose();}
});
test('explicit Save conflict explains existing article without changing local draft or retrying',async()=>{
 const f=fixture();try{f.markReady();const r=await f.api.flush();assert.equal(r.code,'REVISION_CONFLICT');assert.equal(f.offers().length,1);f.offers()[0].click();assert.match(f.node('sirenHelpArticle').textContent,/Code version conflict/);assert.match(f.node('sirenHelpContext').textContent,/REVISION_CONFLICT/);assert.equal(f.api.getSourceText().toString(),'owned draft');assert.equal(f.calls.flush,1);}finally{f.api.dispose();}
});
test('unknown valid save code retains unknown explanation, not read integrity diagnosis',async()=>{
 const f=fixture();try{f.controls.save=async()=>({ok:false,code:'CORRUPT_SOURCE'});await f.api.flush();assert.equal(f.offers().length,1);f.offers()[0].click();assert.match(f.node('sirenHelpContext').textContent,/Unknown error identity/);assert.doesNotMatch(f.node('sirenHelpArticle').textContent,/Stored source integrity/);}finally{f.api.dispose();}
});
for(const boundary of ['pause-resume','help-cover-resume','dispose'])test('late read refusal after '+boundary+' cannot recreate explanation',async()=>{
 const f=fixture(),held=deferred();try{f.controls.load=()=>held.promise;const p=f.api.open(f.ref);if(boundary==='pause-resume'){f.pause();f.resume();}else if(boundary==='help-cover-resume'){f.help.cover();f.help.resume();}else f.api.dispose();held.resolve({ok:false,code:'CORRUPT_SOURCE'});await p;await tick();assert.equal(f.offers().length,0);assert.equal(f.node('sirenHelpDiagnostics'),undefined);}finally{f.api.dispose();}
});
test('successful new explicit read removes prior diagnostic and retained click cannot open it',async()=>{
 const f=fixture();try{await f.api.open(f.ref);const old=f.offers()[0];assert.ok(old);f.controls.load=async()=>({ok:true,...f.ref});await f.api.open(f.ref);assert.equal(f.offers().length,0);old.click();assert.equal(f.node('sirenHelpDiagnostics'),undefined);}finally{f.api.dispose();}
});
test('optional Help absence preserves exact ordinary receipt behavior',async()=>{
 const f=fixture({withHelp:false});try{assert.equal((await f.api.open(f.ref)).code,'CORRUPT_SOURCE');assert.equal((await f.api.flush()).code,'REVISION_CONFLICT');assert.equal(f.offers().length,0);}finally{f.api.dispose();}
});
for(const code of ['<bad>','lowercase','X'.repeat(97)])test('invalid diagnostic code is not forwarded: '+code.slice(0,16),async()=>{
 const f=fixture();try{f.controls.save=async()=>({ok:false,code});assert.equal((await f.api.flush()).code,code);assert.equal(f.offers().length,0);}finally{f.api.dispose();}
});
test('diagnostic validation does not additionally invoke a receipt code getter',async()=>{
 const f=fixture();let reads=0;try{f.controls.save=async()=>({ok:false,get code(){reads++;return'REVISION_CONFLICT';}});await f.api.flush();assert.equal(reads,1,'only the controlled persistence adapter reads its input receipt');assert.equal(f.offers().length,0);}finally{f.api.dispose();}
});
for(const boundary of ['pause-resume','help-cover-resume','dispose'])test('late save refusal after '+boundary+' cannot recreate explanation',async()=>{
 const f=fixture(),held=deferred();try{f.controls.save=()=>held.promise;const p=f.api.flush();if(boundary==='pause-resume'){f.pause();f.resume();}else if(boundary==='help-cover-resume'){f.help.cover();f.help.resume();}else f.api.dispose();held.resolve({ok:false,code:'REVISION_CONFLICT'});assert.equal((await p).code,'REVISION_CONFLICT');assert.equal(f.offers().length,0);}finally{f.api.dispose();}
});
test('preparation clears the visible action and retires an already captured click',async()=>{
 const f=fixture();try{await f.api.flush();const old=f.offers()[0];assert.ok(old);await f.api.flushView();assert.equal(f.offers().length,0);old.click();assert.equal(f.node('sirenHelpDiagnostics'),undefined);}finally{f.api.dispose();}
});
