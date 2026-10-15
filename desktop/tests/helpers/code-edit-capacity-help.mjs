// Prospective author fixture: actual editor/controller+adapter+CM State+Help; finite DOM/view and private persistence DATA only.
import fs from 'node:fs/promises';import vm from 'node:vm';import crypto from 'node:crypto';
import * as stateModule from '../../node_modules/@codemirror/state/dist/index.js';
import * as viewModule from '../../node_modules/@codemirror/view/dist/index.js';
import * as commandModule from '../../node_modules/@codemirror/commands/dist/index.js';
import * as searchModule from '../../node_modules/@codemirror/search/dist/index.js';
import * as languageModule from '../../node_modules/@codemirror/language/dist/index.js';
import {tags} from '../../node_modules/@lezer/highlight/dist/index.js';
import {createEditorAdapter} from '../../src/ui/code/editor-adapter.js';
import {createCodeViewLifecycle} from '../../src/ui/code/view-lifecycle.js';
import {readonlySelectionGuard} from '../../src/ui/code/selection-guard.js';
import {createCodeCommands} from '../../src/ui/code/commands.js';
import {preserveMultilineInput} from '../../src/ui/code/multiline-input.js';
import * as rawHistory from '../../src/ui/code/source-newlines.js';
const root=new URL('../../../',import.meta.url),read=p=>fs.readFile(new URL(p,root),'utf8');
const [source,catalog,resolver,help,workspace,adapterSource]=await Promise.all(['desktop/src/ui/code/editor.js','desktop/src/help/catalog.mjs','desktop/src/help/resolve.mjs','desktop/src/ui/shared/help.js','desktop/src/ui/shared/help-workspace.js','desktop/src/ui/code/editor-adapter.js'].map(read));
// Version-bound budgets parsed from actual module literals; never lower a production limit to make the control cheap.
const caps=adapterSource.match(/const SOURCE_BYTES = (\d+) \* (\d+) \* (\d+), INSERT_BYTES = (\d+) \* (\d+) \* (\d+);/),queue=adapterSource.match(/QUEUE_COUNT = (\d+);/);if(!caps||!queue)throw Error('PRODUCER_CONSTANT_LAYOUT_CHANGED');
export const sourceBytes=Number(caps[1])*Number(caps[2])*Number(caps[3]),queueCount=Number(queue[1]);
export const tick=()=>new Promise(r=>setImmediate(r));export const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
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
export async function fixture({text='original',readonly=false}={}){
 const document={createElement(tag){return new Element(tag,this);},getElementById(id){let found;const walk=n=>{if(n.id===id)found=n;for(const c of n.children)walk(c);};walk(this.body);return found;},addEventListener(){},removeEventListener(){}};document.body=document.createElement('body');document.documentElement=document.createElement('html');
 const window={sirenShell:{},addEventListener(){},innerWidth:1000,innerHeight:800};document.defaultView=window;const nav=document.createElement('nav');nav.id='sirenAppNavigation';nav.hidden=false;document.body.append(nav);const container=document.createElement('div');document.body.append(container);
 let current={sourceId:'owned',version:1,sha256:crypto.createHash('sha256').update(text).digest('hex')},raw=text,paused=false,first=true;const gate=deferred(),calls=[];let held=false,adapter,renderView,override=null;
 const client={getState:()=>({...current,paused}),loadDocument:async()=>({ok:true,...current,doc:stateModule.Text.of(text.split('\n')),metrics:{utf16Units:text.length,utf8Bytes:Buffer.byteLength(text)}}),async applyEdit(r){calls.push({...r});if(held&&first){first=false;await gate.promise;}raw=raw.slice(0,r.start)+r.insertedText+raw.slice(r.end);current={sourceId:current.sourceId,version:current.version+1,sha256:crypto.createHash('sha256').update(raw).digest('hex')};return{ok:true,...current,operationId:r.operationId,durability:'draft'};},commitSource:async r=>({ok:true,...current,operationId:r.operationId,durability:'committed'}),pauseView(){paused=true;return{ok:true};},resumeView(){paused=false;return{ok:true};},drain:async()=>({ok:true})};
 class EditorView{constructor(o){renderView=this;this.state=o.state;this.contentDOM=document.createElement('div');this.dispatchTransactions=o.dispatchTransactions;}focus(){}dispatch(spec){this.dispatchTransactions([this.state.update(spec)]);}update(transactions){this.state=transactions.at(-1).state;}setState(s){this.state=s;}destroy(){}}
 for(const key of ['theme','domEventHandlers','editable','contentAttributes','lineWrapping'])EditorView[key]=viewModule.EditorView[key];
 const identities=[];const ctx=vm.createContext({document,window,...stateModule,...viewModule,...commandModule,...searchModule,...languageModule,...rawHistory,tags,EditorView,createEditorAdapter(options){adapter=createEditorAdapter(options);return Object.freeze({...adapter,applyTransaction(t){return override?override(t):adapter.applyTransaction(t);}});},createCodeViewLifecycle,createCodeCommands,readonlySelectionGuard,preserveMultilineInput});
 vm.runInContext(catalog.replace(/^export /gm,'')+'\nwindow.SirenHelpCatalog=HELP_ARTICLES;'+resolver.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')+'\nwindow.SirenHelpResolver=createHelpResolver(HELP_ARTICLES);'+help+workspace,ctx,{timeout:1000});
 const actualHelp=window.SirenHelpWorkspace;window.SirenHelpWorkspace=Object.freeze({...actualHelp,explain(host,identity,context){if(identity)identities.push(JSON.parse(JSON.stringify(identity)));return actualHelp.explain(host,identity,context);}});
 vm.runInContext(source.replace(/^import .*;\r?\n/gm,'').replace('export function createCodeEditor','function createCodeEditor')+'\nthis.create=createCodeEditor;',ctx,{timeout:1000});const api=ctx.create({container,client,language:'text',readonly});const opened=await api.open(current);if(!opened.ok)throw Error('ACTUAL_EDITOR_OPEN_FAILED '+opened.code);
 const offers=()=>{const out=[];const walk=n=>{if(n.className==='siren-help-error')out.push(n);for(const c of n.children)walk(c);};walk(container);return out;};
 return{api,client,calls,identities,offers,document,window,help:actualHelp,hold(){held=true;},release(){gate.resolve();},raw:()=>raw,edit(spec){renderView.dispatch(spec);},override(fn){override=fn;},async drain(){gate.resolve();for(let n=0;n<30&&api.getStatus().pending;n++)await tick();if(api.getStatus().pending)throw Error('FINITE_DRAIN_NOT_SETTLED');},async dispose(){api.dispose();gate.resolve();await tick();actualHelp.dispose();},get adapter(){return adapter;}};
}