// Prospective entry contract authored by /root/session_native_failure_diagnosis.
// Actual entry + Help/catalog/resolver code; finite DOM/bridge/satellite doubles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const files=await Promise.all(['../../src/ui/terminal/entry.js','../../src/ui/shared/help.js','../../src/help/catalog.mjs','../../src/help/resolve.mjs'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
const [entry,helpSource,catalogSource,resolverSource]=files;
const wid='11111111-1111-4111-8111-111111111111';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Element{
 constructor(tag,doc){this.tagName=tag;this.document=doc;this.children=[];this.listeners=new Map();this.attributes={};this.dataset={};this.style={visibility:'visible',setProperty(){}};this.open=false;this.value='';this.hidden=false;this.inert=false;this._text='';}
 get isConnected(){return this.parent?this.parent.isConnected:this._connected===true;}
 set textContent(value){this._text=String(value);for(const c of this.children)c.parent=null;this.children=[];}
 get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
 set innerHTML(_){throw Error('No HTML injection');}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 replaceChildren(...nodes){for(const n of [...this.children])n.remove();this._text='';this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null;this._connected=false;}
 setAttribute(key,value){this.attributes[key]=String(value);}
 addEventListener(type,fn){const rows=this.listeners.get(type)||[];rows.push(fn);this.listeners.set(type,rows);}
 dispatch(type,extra={}){for(const fn of this.listeners.get(type)||[])fn({preventDefault(){},stopPropagation(){},...extra});}
 focus(){this.document.activeElement=this;}
 showModal(){this.open=true;}
 close(){this.open=false;this.dispatch('close');}
}
function fixture({early=false,duringSubscription=false,missingRead=false,invalidSubscription=null}={}){
 const doc={createElement(tag){return new Element(tag,this);},getElementById(id){let found;const walk=n=>{if(n.id===id)found=n;for(const c of n.children)walk(c);};walk(this.body);return found;}};
 doc.body=new Element('body',doc);doc.body._connected=true;doc.documentElement=new Element('html',doc);doc.documentElement.dataset.desktopLocked='false';
 for(const id of ['terminalWorkspace','terminalHelp','terminalPlacement']){const n=doc.createElement('button');n.id=id;doc.body.append(n);}
 const requests=[],opens=[],observers=[],events=new Map(),subscriptions=new Map(),calls=[];let options,earlyResult,subscriptionResult;
 class MutationObserver{constructor(callback){this.callback=callback;this.targets=[];this.active=true;observers.push(this);}observe(target,config){this.targets.push({target,config});}disconnect(){this.active=false;calls.push('observer-off');}}
 const bridge={getTerminalHelpContext(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});requests.push({resolve,reject});return promise;},getTerminalTheme:async()=>({ok:false}),onTerminalContext(fn){subscriptions.set('context',fn);if(duringSubscription&&typeof options?.onExplain==='function')subscriptionResult=options.onExplain(identity());if(invalidSubscription==='throw')throw Error('finite refusal');return invalidSubscription==='nonfunction'?null:()=>calls.push('off-context');},onTerminalHelp(fn){subscriptions.set('help',fn);return()=>calls.push('off-help');},onTerminalTheme(){return()=>{};}};
 if(missingRead)delete bridge.getTerminalHelpContext;
 const win={sirenTerminal:bridge,MutationObserver,location:{href:'siren://app/windows/terminal.html?windowId='+wid},requestAnimationFrame(){},cancelAnimationFrame(){},ResizeObserver:class{},addEventListener:(name,fn)=>events.set(name,fn)};
 const context=vm.createContext({window:win,document:doc,URL,Terminal:class{},FitAddon:class{},SearchAddon:class{},createTerminalSatellite(){throw Error('Explicit finite satellite required');}});
 vm.runInContext(catalogSource.replace(/^export /gm,'')+'\nwindow.SirenHelpCatalog=HELP_ARTICLES;',context,{timeout:1000});
 vm.runInContext(resolverSource.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')+'\nwindow.SirenHelpResolver=createHelpResolver(window.SirenHelpCatalog);',context,{timeout:1000});
 vm.runInContext(helpSource,context,{timeout:1000});
 const originalCreate=win.SirenHelp.create;
 // Instrument only the real Help boundary. The actual Help implementation paints the finite DOM.
 win.SirenHelp=Object.freeze({create(config){const real=originalCreate(config);return {open(value){opens.push(value);return real.open(value);},close:()=>real.close(),dispose:()=>real.dispose()};}});
 const satellite={snapshot:()=>({available:false}),refresh:async()=>false,setTheme:()=>({ok:false}),dispose:()=>calls.push('satellite-off'),drain:async()=>{}};
 const source=entry.replace(/^import .*;\r?\n/gm,'').replace('export function bootTerminalEntry','function bootTerminalEntry')+'\nthis.boot=bootTerminalEntry;';
 // Evaluate the unmodified boot body without auto-booting its browser-global footer.
 delete context.window;delete context.document;vm.runInContext(source,context,{timeout:1000});context.window=win;context.document=doc;
 function identity(operation='input',code='PIN_REQUIRED'){return vm.runInContext('('+JSON.stringify({namespace:'terminal',operation,code})+')',context);}
 const api=context.boot({window:win,document:doc,createSatellite(value){options=value;if(early){assert.equal(typeof value.onExplain,'function','Actual entry must supply contextual onExplain to the satellite');earlyResult=value.onExplain(identity());}return satellite;}});
 const explain=value=>{assert.equal(typeof options.onExplain,'function','Actual entry must supply contextual onExplain to the satellite');return options.onExplain(value);};
 const release=(at,override={})=>requests[at].resolve(vm.runInContext('('+JSON.stringify({ok:true,readable:true,role:'terminal',windowId:wid,projectId:'project1',epoch:1,...override})+')',context));
 const mutate=(target,attributeName)=>{for(const o of observers)if(o.active&&o.targets.some(t=>t.target===target&&t.config.attributeFilter.includes(attributeName)))o.callback([{type:'attributes',target,attributeName}],o);};
 return {api,context,doc,requests,opens,calls,identity,explain,release,earlyResult,subscriptionResult,mutate,invalidate:()=>subscriptions.get('context')?.(),click:()=>doc.getElementById('terminalHelp').dispatch('click'),command:()=>subscriptions.get('help')?.('desktopHelpDiagnostics')};
}
const panel=f=>f.doc.getElementById('sirenHelpDiagnostics');


export {fixture,panel,tick};
