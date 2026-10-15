import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createTerminalSatellite} from '../../src/ui/terminal/satellite.js';
import {createTerminalControls} from '../../src/ui/terminal/controls.js';
const [entry,help,catalog,resolver]=await Promise.all(['../../src/ui/terminal/entry.js','../../src/ui/shared/help.js','../../src/help/catalog.mjs','../../src/help/resolve.mjs'].map(p=>readFile(new URL(p,import.meta.url),'utf8')));
export const tick=()=>new Promise(r=>setImmediate(r));
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.listeners=new Map();this.attributes={};this.dataset={};this.style={visibility:'visible',setProperty(){}};this.open=false;this.value='';this.hidden=false;this.inert=false;this.disabled=false;this._text='';}
 get isConnected(){return this.parentNode?this.parentNode.isConnected:this._connected===true;}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}set textContent(v){this._text=String(v);for(const c of this.children)c.parentNode=null;this.children=[];}
 set innerHTML(v){throw Error('HTML injection disallowed');}
 append(...nodes){for(const n of nodes){n.remove();n.parentNode=this;this.children.push(n);}}replaceChildren(...ns){for(const n of [...this.children])n.remove();this._text='';this.append(...ns);}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;this._connected=false;}
 setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,fn){const a=this.listeners.get(k)||[];a.push(fn);this.listeners.set(k,a);}removeEventListener(k,fn){this.listeners.set(k,(this.listeners.get(k)||[]).filter(f=>f!==fn));}
 dispatch(k,extra={}){for(const f of [...(this.listeners.get(k)||[])])f({target:this,preventDefault(){},stopPropagation(){},...extra});}click(){if(!this.disabled)this.dispatch('click');}focus(){this.ownerDocument.activeElement=this;}showModal(){this.open=true;}close(){this.open=false;this.dispatch('close');}
}
export async function composed({code='CWD_REFUSED',dispatch,helpThrows=false}={}){
 const doc={createElement(tag){return new Element(tag,this);},getElementById(id){return all().find(n=>n.id===id);}};
 doc.body=new Element('body',doc);doc.body._connected=true;doc.documentElement=new Element('html',doc);doc.documentElement.dataset.desktopLocked='false';
 const all=()=>{const a=[];function visit(n){a.push(n);for(const c of n.children)visit(c);}visit(doc.body);return a;};
 for(const id of ['terminalWorkspace','terminalHelp','terminalPlacement']){const n=doc.createElement(id==='terminalWorkspace'?'main':'button');n.id=id;doc.body.append(n);}
 const wid='11111111-1111-4111-8111-111111111111',subs=new Map(),calls=[],reads=[],controls=[],observers=[],events=new Map(),offers=[],emulators=[];let satellite,op=0;
 const bridge={getTerminalContext:async()=>({windowId:wid,role:'terminal',projectId:'project1',epoch:1,mode:'normal',access:'write',available:true}),getTerminalTheme:async()=>({ok:false}),getTerminalHelpContext(){let resolve,reject;const p=new Promise((a,b)=>{resolve=a;reject=b;});reads.push({resolve,reject});return p;}};
 for(const name of ['Context','Data','Gap','State','Theme','Help'])bridge['onTerminal'+name]=fn=>{let a=subs.get(name);if(!a)subs.set(name,a=new Set());a.add(fn);return()=>a.delete(fn);};
 for(const name of ['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'])bridge['terminal'+name]=p=>{calls.push({name,p});assert.ok(calls.length<32);return dispatch?.(name,p)??Promise.resolve({ok:false,code,operationId:p.operationId,message:'PIN_REQUIRED C:/private-unforwarded'});};
 class MutationObserver{constructor(cb){this.cb=cb;this.targets=[];this.active=true;observers.push(this);}observe(target,config){this.targets.push({target,config});}disconnect(){this.active=false;}}
 const win={sirenTerminal:bridge,MutationObserver,location:{href:'siren://app/windows/terminal.html?windowId='+wid},requestAnimationFrame(){},cancelAnimationFrame(){},ResizeObserver:class{},addEventListener:(k,f)=>events.set(k,f)};
 const realm=vm.createContext({window:win,document:doc,URL,Terminal:class{},FitAddon:class{},SearchAddon:class{},createTerminalSatellite(){throw Error('Explicit actual satellite supplied');}});
 vm.runInContext(catalog.replace(/^export /gm,'')+'\nwindow.SirenHelpCatalog=HELP_ARTICLES;',realm,{timeout:1000});
 vm.runInContext(resolver.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')+'\nwindow.SirenHelpResolver=createHelpResolver(window.SirenHelpCatalog);',realm,{timeout:1000});vm.runInContext(help,realm,{timeout:1000});
 const real=win.SirenHelp.create;win.SirenHelp={create(config){const h=real(config);return {open(value){offers.push(value);if(helpThrows)throw Error('Finite optional manual refusal');return h.open(value);},close:()=>h.close(),dispose:()=>h.dispose()};}};
 delete realm.window;delete realm.document;vm.runInContext(entry.replace(/^import .*;\r?\n/gm,'').replace('export function bootTerminalEntry','function bootTerminalEntry')+'\nthis.boot=bootTerminalEntry;',realm,{timeout:1000});realm.window=win;realm.document=doc;
 const api=realm.boot({window:win,document:doc,createSatellite:options=>{satellite=createTerminalSatellite({...options,createAdapter:()=>({terminalFactory(options){const e={options,open(){},write(text,done){done();},clear(){},dispose(){},onData(fn){this.input=fn;return{dispose:()=>this.input=null};},onResize(fn){this.resize=fn;return{dispose:()=>this.resize=null};}};emulators.push(e);return e;},search:{}}),createControls:opts=>{const c=createTerminalControls({...opts,operationId:()=> 'own_help_'+(++op)});controls.push({c,opts});return c;}});return satellite;}});
 await tick();assert.equal(api.snapshot().available,true,'Actual composed satellite publishes real controls');
 return {api,doc,calls,reads,offers,controls,bridge,all,emulators,current:()=>controls.at(-1).c,action:()=>all().find(n=>n.dataset.action==='explain-error'),panel:()=>doc.getElementById('sirenHelpDiagnostics'),release(i,override={}){reads[i].resolve({ok:true,readable:true,role:'terminal',windowId:wid,projectId:'project1',epoch:1,...override});},invalidate(){for(const f of [...subs.get('Context')||[]])f({});},cover(){doc.body.inert=true;doc.body.inert=false;for(const o of observers)if(o.active)o.cb([{type:'attributes',target:doc.body,attributeName:'inert'}]);},pagehide(){events.get('pagehide')();},async end(){api.dispose();await satellite.drain();}};
}
