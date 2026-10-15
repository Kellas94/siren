// Prospective entry contract authored by /root/session_native_failure_diagnosis.
// Actual entry + Help/catalog/resolver code; finite DOM/bridge/satellite doubles only.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const files=await Promise.all(['../src/ui/terminal/entry.js','../src/ui/shared/help.js','../src/help/catalog.mjs','../src/help/resolve.mjs'].map(path=>readFile(new URL(path,import.meta.url),'utf8')));
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

test('each actual contextual operation reads fresh Help scope then resolves the real offline article despite unavailable execution',async()=>{
 for(const [operation,code,title]of [['pick-cwd','CWD_REFUSED','Choose the folder your command works in'],['create','CWD_REQUIRED','Choose the folder your command works in'],['input','PIN_REQUIRED','Lock, background work and Stop']]){
  const f=fixture();assert.equal(f.api.snapshot().available,false);const pending=f.explain(f.identity(operation,code));assert.equal(f.requests.length,1);assert.equal(panel(f),undefined);f.release(0);assert.equal(await pending,true);assert.equal(panel(f).open,true);
  assert.equal(f.doc.getElementById('sirenHelpArticle').children[0].textContent,title);assert.equal(f.doc.getElementById('sirenHelpContext').textContent,'Explanation for the reported terminal operation · '+code+'.');f.api.dispose();
 }
});
test('valid unknown bounded code uses the actual unknown fallback without inventing a Terminal diagnosis',async()=>{
 const f=fixture(),pending=f.explain(f.identity('create','UNRECOGNIZED_SAFE_CODE'));f.release(0);assert.equal(await pending,true);assert.equal(f.doc.getElementById('sirenHelpArticle').children[0].textContent,'An error without a known explanation');assert.equal(f.doc.getElementById('sirenHelpContext').textContent,'Unknown error identity · UNRECOGNIZED_SAFE_CODE. The exact cause is unavailable.');f.api.dispose();
});
test('wrong namespace/operation/shape/code/accessor refuses before read IPC and never evaluates getter',async()=>{
 const f=fixture();let getters=0;f.context.readGetter=()=>{getters++;};
 const malformed=[null,{},[],{namespace:'sources',operation:'input',code:'PIN_REQUIRED'},{namespace:'terminal',operation:'detach',code:'PIN_REQUIRED'},{namespace:'terminal',operation:'input',code:'lower'},{namespace:'terminal',operation:'input',code:'A'.repeat(97)},{namespace:'terminal',operation:'input',code:'PIN_REQUIRED',message:'C:/private-secret'}];
 for(const value of malformed){const raw=vm.runInContext('('+JSON.stringify(value)+')',f.context);assert.equal(await f.explain(raw),false);}
 const accessor=vm.runInContext('Object.defineProperty({namespace:"terminal",operation:"input"},"code",{enumerable:true,get(){readGetter();return "PIN_REQUIRED";}})',f.context);assert.equal(await f.explain(accessor),false);const revoked=vm.runInContext('(()=>{const r=Proxy.revocable({},{});r.revoke();return r.proxy;})()',f.context);assert.equal(await f.explain(revoked),false);assert.equal(getters,0);assert.equal(f.requests.length,0);assert.equal(f.opens.length,0);f.api.dispose();
});
test('only a detached exact three-field identity crosses Help.open; caller mutation during await cannot replace it',async()=>{
 const f=fixture(),identity=f.identity('input','PIN_REQUIRED'),pending=f.explain(identity);assert.equal(f.requests.length,1);identity.operation='create';identity.code='SPOOFED_CODE';identity.path='C:/private-secret';f.release(0);assert.equal(await pending,true);
 const forwarded=f.opens[0];assert.deepEqual(Reflect.ownKeys(forwarded),['errorIdentity']);assert.notEqual(forwarded.errorIdentity,identity);assert.deepEqual(JSON.parse(JSON.stringify(forwarded.errorIdentity)),{namespace:'terminal',operation:'input',code:'PIN_REQUIRED'});assert.deepEqual(Reflect.ownKeys(forwarded.errorIdentity).sort(),['code','namespace','operation']);assert.equal(f.doc.body.textContent.includes('private-secret'),false);f.api.dispose();
});
test('onExplain construction and invalidation-subscription reentry stay closed until boot fully establishes Help',async()=>{
 const f=fixture({early:true,duringSubscription:true});assert.equal(await f.earlyResult,false);assert.equal(await f.subscriptionResult,false);assert.equal(f.requests.length,0);assert.equal(f.opens.length,0);const pending=f.explain(f.identity());f.release(0);assert.equal(await pending,true);f.api.dispose();
});
test('missing read or failed context binding and already covered document never acquire contextual Help',async()=>{
 for(const options of [{missingRead:true},{invalidSubscription:'throw'},{invalidSubscription:'nonfunction'}]){const f=fixture(options);assert.equal(await f.explain(f.identity()),false);assert.equal(f.requests.length,0);assert.equal(f.opens.length,0);f.api.dispose();}
 const f=fixture();f.doc.body.inert=true;assert.equal(await f.explain(f.identity()),false);f.doc.body.inert=false;f.doc.documentElement.dataset.desktopLocked='true';assert.equal(await f.explain(f.identity()),false);assert.equal(f.requests.length,0);f.api.dispose();
});
test('context change and transient document cover retire held contextual requests; dispose fences retained callback',async()=>{
 const f=fixture();let pending=f.explain(f.identity());f.invalidate();f.release(0);assert.equal(await pending,false);assert.equal(panel(f),undefined);
 pending=f.explain(f.identity());f.doc.body.inert=true;f.doc.body.inert=false;f.mutate(f.doc.body,'inert');f.release(1);assert.equal(await pending,false);assert.equal(panel(f),undefined);
 pending=f.explain(f.identity());f.api.dispose();f.release(2);assert.equal(await pending,false);assert.equal(await f.explain(f.identity()),false);assert.equal(f.requests.length,3);assert.equal(f.opens.length,0);assert.equal(f.calls.filter(c=>c==='observer-off').length,1);assert.equal(f.calls.filter(c=>c==='off-context').length,1);
});
test('new contextual read retires older identity and ordinary Help button/F1 remain identity-free fresh handshakes',async()=>{
 const f=fixture(),first=f.explain(f.identity('input','PIN_REQUIRED')),second=f.explain(f.identity('pick-cwd','CWD_REFUSED'));assert.equal(f.requests.length,2);f.release(0);assert.equal(await first,false);f.release(1);assert.equal(await second,true);assert.equal(f.doc.getElementById('sirenHelpArticle').children[0].textContent,'Choose the folder your command works in');
 f.click();assert.equal(f.requests.length,3);assert.equal(panel(f),undefined);f.release(2);await tick();assert.equal(f.doc.getElementById('sirenHelpContext').textContent,'Offline reference · No automatic changes to your work.');assert.equal(f.opens.at(-1),undefined);
 f.command();assert.equal(f.requests.length,4);f.release(3);await tick();assert.equal(f.opens.at(-1),undefined);assert.equal(f.doc.getElementById('sirenHelpArticle').children[0].textContent,'Find your next step');f.api.dispose();
});
test('refused/foreign read receipt or transport rejection never forwards identity, opens or automatically retries',async()=>{
 for(const receipt of [{ok:false,code:'ACCESS_REFUSED'},{role:'docs'},{windowId:'22222222-2222-4222-8222-222222222222'},{epoch:0}]){const f=fixture(),pending=f.explain(f.identity());f.release(0,receipt);assert.equal(await pending,false);assert.equal(f.opens.length,0);assert.equal(panel(f),undefined);await tick();assert.equal(f.requests.length,1);f.api.dispose();}
 const f=fixture(),pending=f.explain(f.identity());f.requests[0].reject(Error('finite bridge refusal'));assert.equal(await pending,false);await tick();assert.equal(f.requests.length,1);assert.equal(f.opens.length,0);f.api.dispose();
});
