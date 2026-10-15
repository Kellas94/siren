import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {Text} from '@codemirror/state';
import {createEditorAdapter} from '../src/ui/code/editor-adapter.js';
import {createCodeViewLifecycle} from '../src/ui/code/view-lifecycle.js';
const [windowCode,editorCode]=await Promise.all(['../src/ui/windows/code.js','../src/ui/code/editor.js'].map(p=>readFile(new URL(p,import.meta.url),'utf8')));
const normalized=editorCode.replaceAll('\r\n','\n'),start=normalized.indexOf('  return Object.freeze({ open, flush, pauseView'),end=normalized.indexOf('\n  });\n}',start);
assert.ok(start>=0&&end>start,'Use actual final public API composition, not a hard-coded replica');
const publicComposition=normalized.slice(start,end+'\n  });'.length);
const held=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture({initialConnect=true}={}){
 const nodes=[],callbacks={},editors=[],clients=[];let document,nextReference=null,metricsRefusal=false,analysisUpdates=0,edits=0,sourceHooks=null,documentFocused=true;
 const noop=()=>{};
 class Node{constructor(){this.children=[];this.parentNode=null;this.dataset={};this.style={};this.listeners={};this.hidden=false;this.disabled=false;this.textContent='';this.classList={toggle:noop};nodes.push(this);}append(...ns){for(const n of ns){n.remove();n.parentNode=this;this.children.push(n);}}contains(node){for(let value=node;value;value=value.parentNode)if(value===this)return true;return false;}replaceChildren(...ns){for(const n of this.children)n.parentNode=null;this.children=[];this.append(...ns);}get childNodes(){return this.children;}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}addEventListener(k,fn){this.listeners[k]=fn;}removeEventListener(){}focus(){document.activeElement=this;}}
 document={body:new Node(),documentElement:new Node(),getElementById:id=>nodes.find(n=>n.id===id),createElement:()=>new Node(),removeEventListener:noop,hasFocus:()=>documentFocused};
 for(const id of ['codeSurface','viewStatus','retrySource','codeTheme','openWorkingCopy','linkCodeDocs','sourceChangesNotice','sourceChangesMessage','reviewLatestSource','toggleAnalysis','compareSources','codeAnalysis','replaceLatestSource']){const n=new Node();n.id=id;document.body.append(n);}document.getElementById('codeTheme').value='light';
 const ref={sourceId:'source1',version:1,sha256:'a'.repeat(64)},text='saved code\n';
 const reference=()=>({ok:true,readonly:false,canEdit:true,sourceRef:{...ref},displayName:'Original.py',language:'python'});
 const sourceClient=({sourceRef})=>{
  const state={...sourceRef,disposed:false,paused:false,fenced:false,pending:0},subscribers=[];
  const client={getState:()=>({...state}),getMetrics:async()=>metricsRefusal?{ok:false}:{ok:true,utf8Bytes:Buffer.byteLength(text),utf16Units:text.length,lines:2},loadDocument:async()=>({ok:true,...sourceRef,doc:Text.of(text.split('\n')),metrics:{utf16Units:text.length,utf8Bytes:Buffer.byteLength(text)}}),applyEdit:async q=>{edits++;state.version++;state.sha256='b'.repeat(64);const receipt={ok:true,sourceId:state.sourceId,version:state.version,sha256:state.sha256,operationId:q.operationId,durability:'draft'};for(const fn of subscribers)fn(receipt);return receipt;},commitSource:async q=>({ok:true,sourceId:state.sourceId,version:state.version,sha256:state.sha256,operationId:q.operationId,durability:'committed'}),pauseView:()=>{state.paused=true;return {ok:true};},resumeView:()=>{state.paused=false;return {ok:true};},drain:async()=>({ok:true}),subscribeSource:fn=>{subscribers.push(fn);return noop;},dispose(){state.disposed=true;}};
  clients.push({client,emit:value=>subscribers.forEach(fn=>fn(value))});return client;
 };
 const api={sourceClient,createCodeEditor({client,readonly,container}){
  const adapter=createEditorAdapter({client,readonly}),lifecycle=createCodeViewLifecycle({editor:adapter,client}),root=new Node(),surface=new Node();
  // Exact public return expression from editor.js executes unchanged. Only its
  // DOM EditorView/theme/menu collaborators are inert; real adapter/lifecycle
  // functions own all pause/resume/save behavior. This is not full editor DOM.
  root.append(surface);container.append(root);
  const context={adapter,lifecycle,clearDiagnostic:noop,open:adapter.open,flush:adapter.flush,view:{contentDOM:surface,focus:()=>surface.focus(),get hasFocus(){return document.hasFocus()&&document.activeElement===surface;},dispatch:spec=>adapter.dispatch(spec),destroy:noop},disposed:false,unsubscribe:noop,document,root,surface,outside:noop,onContext:noop,menuKeys:noop,onSearchInput:noop,theme:'light',paintTheme:noop,colors:{reconfigure:()=>null},appearance:()=>null};
  const view=runInNewContext('(function(){'+publicComposition+'})()',context);editors.push({view,adapter,surface,root});return view;
 }};
 const window={SirenNativeViewIdentity:{clear:noop,set:noop},SirenNativeDocsLinks:{create:()=>({pause:noop,dispose:noop})},SirenNativeSourceChanges:{create:hooks=>{sourceHooks=hooks;return {reset:noop,reconcile:noop,pause:noop,resume:noop,dispose:noop};}},SirenNativeAnalysis:{create:()=>({reset:noop,reconcile:()=>analysisUpdates++,pause:noop,resume:noop,dispose:noop})},sirenSourceRead:{getReference:()=>nextReference?nextReference.promise:Promise.resolve(reference())},sirenSource:{},sirenSourceEdit:{onReferenceChanged:()=>noop},sirenViewControl:{onPrepare:fn=>callbacks.prepare=fn,onResume:fn=>callbacks.resume=fn},addEventListener:noop,confirm:()=>true};
 runInNewContext(windowCode,{window,document,SirenCodeEditor:api,matchMedia:()=>({matches:false,addEventListener:noop,removeEventListener:noop})});if(initialConnect)assert.equal(await window.sirenNativeCodeView.connect(),true);
 return {window,document,editors,clients,reference,callbacks,get sourceHooks(){return sourceHooks;},get edits(){return edits;},get analysisUpdates(){return analysisUpdates;},setDocumentFocus(value){documentFocused=value;},holdReference(){return nextReference=held();},releaseReference(){nextReference=null;},refuseMetrics(value=true){metricsRefusal=value;},refresh:()=>window.sirenNativeCodeView.connect({preserveCurrent:true})};
}

for(const route of ['direct','automatic'])for(const move of ['outside-before','outside-during','document-blur'])test('successful '+route+' refresh preserves focus intent: '+move,async()=>{
 const f=await fixture(),old=f.editors[0],theme=f.document.getElementById('codeTheme');
 old.view.select(2,4);assert.equal(f.document.activeElement,old.surface);
 if(move==='outside-before')theme.focus();
 const gate=f.holdReference(),refresh=route==='automatic'?f.sourceHooks.onReload():f.refresh();
 if(move==='outside-during')theme.focus();
 if(move==='document-blur')f.setDocumentFocus(false);
 const before=f.document.activeElement;gate.resolve(f.reference());assert.equal(await refresh,true);
 if(move==='document-blur')assert.notEqual(f.document.activeElement,f.editors.at(-1).surface,'refresh must not focus an editor in a blurred document');
 else assert.equal(f.document.activeElement,before,'refresh must not take focus from another control');
 if(route==='automatic'){const selection=f.editors.at(-1).adapter.getState().selection.main;assert.equal(selection.anchor,2);assert.equal(selection.head,4);}
});

test('successful automatic refresh retains focused editor and exact selection',async()=>{
 const f=await fixture(),old=f.editors[0];old.view.select(2,4);assert.equal(await f.sourceHooks.onReload(),true);
 const next=f.editors.at(-1);assert.equal(f.document.activeElement,next.surface);
 assert.equal(next.adapter.getState().selection.main.anchor,2);assert.equal(next.adapter.getState().selection.main.head,4);
});

for(const controlName of ['find','toolbar'])for(const moment of ['before','during'])test('automatic refresh retains an active editor '+controlName+' control '+moment,async()=>{
 const f=await fixture(),old=f.editors[0],control=f.document.createElement(controlName==='find'?'input':'button');
 old.root.append(control);const gate=moment==='during'?f.holdReference():null;
 if(moment==='before')control.focus();const refresh=f.sourceHooks.onReload();
 if(moment==='during'){control.focus();gate.resolve(f.reference());}assert.equal(await refresh,false);
 assert.equal(f.document.activeElement,control);assert.equal(old.adapter.getStatus().disposed,false);
 assert.equal(old.adapter.getStatus().paused,false);assert.equal(f.editors.length,moment==='during'?2:1);
 if(moment==='during')assert.equal(f.editors.at(-1).adapter.getStatus().disposed,true);
});
// Window blur retains Chromium's active element for focus restoration.
// Refresh must retain that control, but may replace blurred content (above).
for(const controlName of ['find','toolbar'])for(const moment of ['before','during'])test('automatic refresh retains a blurred editor '+controlName+' control '+moment,async()=>{
 const f=await fixture(),old=f.editors[0],control=f.document.createElement(controlName==='find'?'input':'button');
 old.root.append(control);control.value='retained query';const gate=moment==='during'?f.holdReference():null;
 if(moment==='before'){control.focus();f.setDocumentFocus(false);}const refresh=f.sourceHooks.onReload();
 if(moment==='during'){control.focus();f.setDocumentFocus(false);gate.resolve(f.reference());}
 assert.equal(await refresh,false,'automatic refresh must defer while an editor control owns the retained active element');
 assert.equal(f.document.body.contains(old.root),true);assert.equal(old.root.contains(control),true);
 assert.equal(old.adapter.getStatus().disposed,false);assert.equal(old.adapter.getStatus().paused,false);
 assert.equal(f.document.activeElement,control);assert.equal(control.value,'retained query');
 f.setDocumentFocus(true);assert.equal(f.document.activeElement,control,'the same control remains the return-focus target');
 assert.equal(f.editors.length,moment==='during'?2:1);
 if(moment==='during')assert.equal(f.editors.at(-1).adapter.getStatus().disposed,true);
});
for(const failure of ['reference','metrics'])test('failed '+failure+' refresh retains an editable exact old Code owner',async()=>{
 const f=await fixture(),old=f.editors[0],before=old.adapter.getState().doc.toString();
 if(failure==='metrics')f.refuseMetrics();const gate=failure==='reference'?f.holdReference():null,refresh=f.refresh();
 assert.equal(old.adapter.getStatus().paused,true);assert.equal(old.adapter.dispatch({changes:{from:0,insert:'held '}}).code,'EDITOR_PAUSED');gate?.reject(Error('controlled read refusal'));
 assert.equal(await refresh,false);assert.equal(old.adapter.getStatus().paused,false);assert.equal(old.adapter.getState().doc.toString(),before);assert.equal(old.adapter.getStatus().disposed,false);
 assert.equal(old.adapter.dispatch({changes:{from:0,insert:'after '}}).ok,true);await tick();assert.equal(old.adapter.getStatus().fenced,false);assert.equal(f.edits,1);
});
test('failed refresh keeps actual retained editor and client metadata subscriptions live',async()=>{
 const f=await fixture(),old=f.editors[0],gate=f.holdReference(),refresh=f.refresh();gate.reject(Error('controlled read refusal'));assert.equal(await refresh,false);
 // Isolate observer continuity from the separate pause rollback regression.
 // Before its fix this raw pure adapter resume is a diagnostic-only seam.
 assert.equal(old.adapter.resumeView().ok,true);const before=f.analysisUpdates;
 assert.equal(old.adapter.dispatch({changes:{from:0,insert:'new '}}).ok,true);await tick();
 assert.equal(old.adapter.getStatus().sourceRef.version,2);assert.equal(old.adapter.getStatus().dirty,true);
 assert.equal(f.document.body.dataset.sourceVersion,'2');assert.equal(f.document.body.dataset.sourceSha256,'b'.repeat(64));assert.equal(f.document.body.dataset.sourceUnits,'15');assert.match(f.document.getElementById('viewStatus').textContent,/Local draft/);assert.ok(f.analysisUpdates>before);
});
test('superseded failed refresh cannot resume the old editor still held by its newer attempt',async()=>{
 const f=await fixture(),old=f.editors[0],a=f.holdReference(),first=f.refresh(),b=f.holdReference(),second=f.refresh();
 a.reject(Error('old refusal'));assert.equal(await first,false);assert.equal(old.adapter.getStatus().paused,true);
 b.reject(Error('new refusal'));assert.equal(await second,false);assert.equal(old.adapter.getStatus().paused,false);assert.equal(old.adapter.getStatus().disposed,false);
});
test('successful refresh retires old clients and their later events cannot repaint the replacement',async()=>{
 const f=await fixture(),old=f.editors[0];assert.equal(await f.refresh(),true);assert.equal(old.adapter.getStatus().disposed,true);assert.equal(f.editors.length,2);
 f.clients[0].emit({version:99,sha256:'f'.repeat(64)});assert.equal(f.document.body.dataset.sourceVersion,'1');assert.equal(f.document.body.dataset.sourceSha256,'a'.repeat(64));assert.equal(f.editors[1].adapter.getStatus().paused,false);
});
test('refresh final guard retains an old owner changed by a controlled admission reentry',async()=>{
 const f=await fixture(),old=f.editors[0],gate=f.holdReference(),refresh=f.refresh();assert.equal(old.adapter.resumeView().ok,true);
 assert.equal(old.adapter.dispatch({changes:{from:0,insert:'retained '}}).ok,true);await tick();gate.resolve(f.reference());
 assert.equal(await refresh,false);assert.equal(old.adapter.getStatus().disposed,false);assert.equal(old.adapter.getState().doc.toString(),'retained saved code\n');assert.equal(old.adapter.getStatus().dirty,true);
});
test('Lock preparation during a held refresh retains strict lifecycle resume and permits later refresh',async()=>{
 const f=await fixture(),old=f.editors[0],gate=f.holdReference(),refresh=f.refresh();assert.equal((await f.callbacks.prepare()).ok,true);
 gate.reject(Error('while covered'));assert.equal(await refresh,false);assert.equal(old.adapter.getStatus().paused,true);assert.equal(f.document.body.inert,true);
 f.callbacks.resume();assert.equal(old.adapter.getStatus().paused,false);assert.equal(f.document.body.inert,false);f.releaseReference();assert.equal(await f.refresh(),true);
});
test('failed candidate reference never changes installed source identity or working-copy controls',async()=>{
 const f=await fixture(),old=f.editors[0],working=f.document.getElementById('openWorkingCopy');assert.equal(working.hidden,true);assert.equal(f.sourceHooks.sourceIdFor(),'source1');
 const gate=f.holdReference();f.refuseMetrics();const refresh=f.refresh();gate.resolve({...f.reference(),readonly:true,canEdit:true,sourceRef:{sourceId:'candidate2',version:1,sha256:'c'.repeat(64)}});
 assert.equal(await refresh,false);assert.equal(f.sourceHooks.sourceIdFor(),'source1');assert.equal(working.hidden,true);assert.equal(f.document.body.dataset.sourceId,'source1');assert.equal(old.adapter.getStatus().readonly,false);
});

// Initial/explicit-load focus intent is distinct from automatic refresh.
for(const moment of ['before','during','blurred-during'])test('initial load retains a live external control '+moment,async()=>{
 const f=await fixture({initialConnect:false}),control=f.document.createElement('select');control.id='sirenAppTheme';f.document.body.append(control);
 const gate=f.holdReference();if(moment==='before')control.focus();const loading=f.window.sirenNativeCodeView.connect();
 if(moment!=='before')control.focus();if(moment==='blurred-during')f.setDocumentFocus(false);
 gate.resolve(f.reference());assert.equal(await loading,true);assert.equal(f.editors.at(-1).adapter.getStatus().ready,true);
 assert.equal(f.document.activeElement,control,'initial load must retain the live external focus owner');
});
test('initial load keeps ordinary default autofocus',async()=>{
 const f=await fixture({initialConnect:false});assert.equal(await f.window.sirenNativeCodeView.connect(),true);assert.equal(f.document.activeElement,f.editors.at(-1).surface);
});
test('a disconnected former focus owner does not block initial autofocus',async()=>{
 const f=await fixture({initialConnect:false}),control=f.document.createElement('button');f.document.body.append(control);control.focus();const gate=f.holdReference(),loading=f.window.sirenNativeCodeView.connect();control.remove();gate.resolve(f.reference());assert.equal(await loading,true);assert.equal(f.document.activeElement,f.editors.at(-1).surface);
});
test('explicit retry load retains a subsequently focused external control',async()=>{
 const f=await fixture(),control=f.document.createElement('select');control.id='sirenAppTheme';f.document.body.append(control);const gate=f.holdReference();
 f.document.getElementById('retrySource').listeners.click();control.focus();gate.resolve(f.reference());await tick();await tick();
 assert.equal(f.editors.at(-1).adapter.getStatus().ready,true);assert.equal(f.document.activeElement,control,'retry must retain a subsequent explicit control focus');
});

for(const route of ['initial','retry'])test('background '+route+' load keeps the default editor return-focus target',async()=>{
 const f=await fixture({initialConnect:route==='retry'});f.document.activeElement=f.document.body;f.setDocumentFocus(false);
 if(route==='initial')assert.equal(await f.window.sirenNativeCodeView.connect(),true);
 else {f.document.getElementById('retrySource').listeners.click();await tick();await tick();}
 assert.equal(f.document.activeElement,f.editors.at(-1).surface);
 f.setDocumentFocus(true);assert.equal(f.document.activeElement,f.editors.at(-1).surface);
});


// Hidden Retry may remain the connected active element until browser focus fixup.
// This inert-DOM regression models that conditional state; native timing is separate.
for(const focused of [true,false])test('genuine failed-load Retry retains default editor focus when hidden Retry is still active: '+focused,async()=>{
 const f=await fixture({initialConnect:false});f.refuseMetrics();assert.equal(await f.window.sirenNativeCodeView.connect(),false);
 const retry=f.document.getElementById('retrySource');assert.equal(retry.hidden,false);retry.focus();f.setDocumentFocus(focused);f.refuseMetrics(false);
 const gate=f.holdReference();retry.listeners.click();assert.equal(retry.hidden,true);assert.equal(f.document.activeElement,retry);
 gate.resolve(f.reference());await tick();await tick();assert.equal(f.editors.at(-1).adapter.getStatus().ready,true);
 assert.equal(f.document.activeElement,f.editors.at(-1).surface,'hidden Retry must not block default editor focus');
});
