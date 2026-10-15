import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
const code=await readFile(new URL('../src/ui/docs/diagram-embeds.js',import.meta.url),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
const transferCode=await readFile(new URL('../src/ui/diagram/docs-transfer.js',import.meta.url),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
const tick=()=>new Promise(r=>setImmediate(r)),block=()=>({id:'embed-a',kind:'diagram-embed',diagramId:'flow-a',mode:'live',caption:'Saved flow',display:{height:320,fit:'contain'},snapshot:{sourceVersion:2,sourceHash:'a'.repeat(64)},status:'current',scope:'whole',nodeIds:[]});
function fixture(){
 const nodes=[],observers=[],calls=[],messages=[],changed=[];let context={version:'b'.repeat(64),dirty:false,readonly:false,blocks:[{id:'text-a',kind:'text',html:'<p>Context</p>'}]},answer,active;
 class Node{constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.listeners={};this.hidden=false;this.disabled=false;this.isConnected=true;this.scrollTop=91;this.value='';nodes.push(this);}append(...items){items.forEach(n=>{n.parent=this;this.children.push(n);});}setAttribute(k,v){this[k]=v;}addEventListener(k,v){this.listeners[k]=v;}removeEventListener(k){delete this.listeners[k];}emit(k='click',e={}){return this.listeners[k]?.(e);}replaceChildren(...items){this.children=[];this.append(...items);}remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(v=>v!==this);}focus(){active=this;}showModal(){this.open=true;}close(){this.open=false;this.emit('close');}get firstChild(){return this.children[0];}}
 const document={createElement:tag=>new Node(tag),body:new Node('body'),get activeElement(){return active;}},window={};class IntersectionObserver{constructor(fn){this.fn=fn;observers.push(this);}observe(node){this.node=node;}unobserve(){}disconnect(){this.dead=true;}}
 const api=Object.fromEntries(['listDocuments','sendToDocs','getProposal','listDiagrams','inspectSelection','preview','insert','readEmbed','setMode','update','openSource'].map(method=>[method,async p=>{calls.push({method,p:JSON.parse(JSON.stringify(p))});return typeof answer==='function'?answer(method,p):answer??{ok:true,block:block(),visual:{kind:'svg',base64:Buffer.from('<svg/>').toString('base64')}};}]));
 runInNewContext(code+'\n'+transferCode,{window,document,IntersectionObserver,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},setTimeout,clearTimeout,TextEncoder});assert.equal(typeof window.createDiagramEmbedView,'function','Missing diagram embed view');
 const view=window.createDiagramEmbedView({api,getContext:()=>context,onChanged:v=>changed.push(v),onStatus:v=>messages.push(v)});
 return {window,api,view,nodes,calls,messages,changed,document,context:v=>context={...context,...v},answer:v=>answer=v,find:(action,id)=>nodes.find(n=>n.dataset.embedAction===action&&(!id||n.dataset.embedId===id)),intersect:id=>{const o=observers.find(v=>v.node.dataset.embedId===id);o.fn([{isIntersecting:true,target:o.node}]);},Node};
}
test('multiple inline diagrams load lazily with one read active and preserve local scroll/focus',async()=>{
 const f=fixture();let release;f.answer((method,p)=>new Promise(r=>release=()=>r({ok:true,block:{...block(),id:p.blockId},visual:{kind:'svg',base64:'PHN2Zy8+'}})));
 const a=f.view.render(block()),b=f.view.render({...block(),id:'embed-b'});assert.equal(f.calls.length,0);a.focus();f.intersect('embed-a');f.intersect('embed-b');await tick();assert.equal(f.calls.length,1);assert.equal(f.calls[0].method,'readEmbed');release();await tick();assert.equal(f.calls.length,2);release();await f.view.drain();assert.equal(a.scrollTop,91);assert.equal(f.document.activeElement,a);assert.equal(f.nodes.filter(n=>n.tagName==='img'&&n.src?.startsWith('data:image/svg+xml;base64,')).length,2);assert.ok(b);
});
test('restored diagram explains suspension and offers an explicit Resume Live command',async()=>{
 const f=fixture();f.answer({ok:true,block:block(),refreshSuspended:true,visual:{kind:'svg',base64:'PHN2Zy8+'}});f.view.render(block());f.intersect('embed-a');await f.view.drain();assert.match(f.find('status','embed-a').textContent,/paused.*undo/i);const resume=f.find('resume-live','embed-a');assert.ok(resume);assert.equal(resume.hidden,false);f.answer(method=>method==='preview'?{ok:true,previewId:'current-preview',sourceVersion:3,visual:{kind:'svg',base64:'PHN2Zy8+'}}:{ok:true});resume.emit();await f.view.drain();assert.equal(f.calls.at(-1).method,'preview');assert.equal(f.changed.length,0);f.find('confirm-live','embed-a').emit();await f.view.drain();assert.equal(f.calls.at(-1).method,'setMode');assert.equal(f.calls.at(-1).p.mode,'live');assert.equal(f.calls.at(-1).p.previewId,'current-preview');
});
test('keyboard zoom, Fit and Expand use the same passive image without replacing Docs content',async()=>{
 const f=fixture(),card=f.view.render(block());f.intersect('embed-a');await f.view.drain();const viewport=f.find('viewport','embed-a');let prevented=0;viewport.emit('keydown',{key:'+',preventDefault:()=>prevented++});assert.equal(f.find('zoom','embed-a').textContent,'125%');f.find('fit','embed-a').emit();assert.equal(f.find('zoom','embed-a').textContent,'Fit');f.find('expand','embed-a').emit();assert.equal(f.nodes.find(n=>n.tagName==='dialog').open,true);assert.equal(card.scrollTop,91);assert.equal(f.calls.length,1);assert.equal(prevented,1);
});
test('diagram height has a visible pointer and keyboard resize control with bounded retired gestures',async()=>{
 const f=fixture();f.view.render(block());const handle=f.find('resize','embed-a'),viewport=f.find('viewport','embed-a');assert.ok(handle,'Missing dedicated resize control');let captured,released;handle.setPointerCapture=id=>captured=id;handle.releasePointerCapture=id=>released=id;viewport.getBoundingClientRect=()=>({height:parseInt(viewport.style.height)});const event=(y,extra={})=>({pointerId:7,button:0,clientY:y,preventDefault(){},...extra});
 handle.emit('pointerdown',event(500));assert.equal(captured,7);assert.equal(f.document.activeElement,handle,'Pointer resize must retain keyboard focus');handle.emit('pointermove',event(440));assert.equal(viewport.style.height,'260px');handle.emit('pointerup',event(440));assert.equal(released,7);handle.emit('keydown',{key:'ArrowDown',preventDefault(){}});assert.equal(viewport.style.height,'280px');handle.emit('keydown',{key:'End',preventDefault(){}});assert.equal(viewport.style.height,'1600px');handle.emit('pointerdown',event(500));handle.emit('pointermove',event(-5000));assert.equal(viewport.style.height,'80px');await f.view.pause();handle.emit('pointermove',event(5000));handle.emit('keydown',{key:'End',preventDefault(){}});assert.equal(viewport.style.height,'80px');assert.equal(f.calls.length,0,'local viewport resize must not mint a document write');
});
test('Fixed mode and manual update use only saved CAS and dirty drafts are refused',async()=>{
 const f=fixture();f.view.render(block());f.answer({ok:true,domain:'docs',version:'c'.repeat(64)});f.find('mode','embed-a').value='fixed';f.find('mode','embed-a').emit('change');await f.view.drain();assert.deepEqual(f.calls[0],{method:'setMode',p:{blockId:'embed-a',mode:'fixed',expectedDocumentVersion:'b'.repeat(64),operationId:'00000000-0000-4000-8000-000000000001'}});assert.equal(f.changed.length,1);
 f.context({dirty:true});f.find('update','embed-a').emit();await f.view.drain();assert.equal(f.calls.length,1);assert.match(f.messages.at(-1),/save/i);
});
test('a refused saved diagram command exposes its bounded error code without presenting a success',async()=>{
 const f=fixture();f.view.render(block());f.answer({ok:false,code:'WRITER_BUSY'});f.find('mode','embed-a').value='fixed';f.find('mode','embed-a').emit('change');await f.view.drain();assert.match(f.messages.at(-1),/WRITER_BUSY/);assert.equal(f.changed.length,0);assert.equal(f.find('mode','embed-a').value,'live');
 f.answer({ok:false,code:'<untrusted detail>'});f.find('update','embed-a').emit();await f.view.drain();assert.doesNotMatch(f.messages.at(-1),/untrusted/);
});
test('picker previews whole saved diagram and inserts after chosen text with Live implied',async()=>{
 const f=fixture();f.answer((method)=>method==='listDiagrams'?{ok:true,items:[{id:'flow-a',label:'Branching flow'}],hasMore:false}:method==='preview'?{ok:true,previewId:'receipt-a',sourceHash:'a'.repeat(64),visual:{kind:'svg',base64:'PHN2Zy8+'}}:{ok:true,domain:'docs',version:'c'.repeat(64)});
 f.view.insert({afterBlockId:'text-a'});await f.view.drain();const select=f.find('choose-diagram');select.value='flow-a';f.find('preview').emit();await f.view.drain();f.find('confirm-insert').emit();await f.view.drain();assert.equal(f.calls.at(-1).method,'insert');assert.equal(f.calls.at(-1).p.afterBlockId,'text-a');assert.equal(f.calls.at(-1).p.previewId,'receipt-a');assert.equal(Object.hasOwn(f.calls.at(-1).p,'mode'),false);assert.equal(f.changed.length,1);
});
test('pause joins pending preview and late results cannot show images or publish after resume',async()=>{
 const f=fixture();let release;f.answer(()=>new Promise(r=>release=r));f.view.render(block());f.intersect('embed-a');await tick();let joined=false;const paused=f.view.pause().then(()=>joined=true);await tick();assert.equal(joined,false);release({ok:true,block:block(),visual:{kind:'svg',base64:'PHN2Zy8+'}});await paused;f.view.resume();assert.equal(f.nodes.filter(n=>n.tagName==='img'&&n.src).length,0);assert.equal(f.changed.length,0);
});
test('Open source uses a saved block identity, and failed visual preserves caption with explicit warning',async()=>{
 const f=fixture();f.answer({ok:false,code:'DIAGRAM_EMBED_ASSET_CORRUPT'});const card=f.view.render({...block(),status:'missing'});f.intersect('embed-a');await f.view.drain();assert.ok(card.children.length);assert.match(f.find('status','embed-a').textContent,/unavailable|missing/i);f.find('open-source','embed-a').emit();await f.view.drain();assert.equal(f.calls.at(-1).method,'openSource');assert.equal(f.calls.at(-1).p.blockId,'embed-a');assert.equal(Object.hasOwn(f.calls.at(-1).p,'diagramId'),false);
});
test('changing chosen diagram retires an in-flight preview so it cannot enable insertion of the previous diagram',async()=>{
 const f=fixture();let release;f.answer(method=>method==='listDiagrams'?{ok:true,items:[{id:'flow-a',label:'A'},{id:'flow-b',label:'B'}]}:new Promise(r=>release=r));f.view.insert();await f.view.drain();const select=f.find('choose-diagram');select.value='flow-a';f.find('preview').emit();await tick();select.value='flow-b';select.emit('change');release({ok:true,previewId:'old-a',visual:{kind:'svg',base64:'PHN2Zy8+'}});await f.view.drain();assert.equal(f.find('confirm-insert').disabled,true);f.find('confirm-insert').emit();await f.view.drain();assert.equal(f.calls.some(c=>c.method==='insert'),false);
});
test('Lock closes expanded visuals and a refused mode change restores the actual saved mode',async()=>{
 const f=fixture();f.view.render(block());f.intersect('embed-a');await f.view.drain();f.find('expand','embed-a').emit();const dialog=f.nodes.find(n=>n.tagName==='dialog');assert.equal(dialog.open,true);await f.view.pause();assert.equal(dialog.isConnected,false);f.view.resume();
 f.context({dirty:true});f.view.render({...block(),id:'embed-b'});const mode=f.find('mode','embed-b');mode.value='fixed';mode.emit('change');await f.view.drain();await tick();assert.equal(mode.value,'live');assert.equal(f.calls.filter(c=>c.method==='setMode').length,0);
});
test('picker can reach diagrams beyond the first64 and search saved labels without accepting arbitrary source bytes',async()=>{
 const f=fixture();f.answer((method,p)=>({ok:true,items:p.cursor===64?[{id:'flow-65',label:'Sixty fifth'}]:p.query?[{id:'flow-match',label:'Matching diagram'}]:Array.from({length:64},(_,i)=>({id:'flow-'+i,label:'Flow '+i})),nextCursor:p.cursor===64?65:64,hasMore:!p.cursor&&!p.query}));
 f.view.insert();await f.view.drain();assert.ok(f.find('more-diagrams'),'Missing picker pagination');f.find('more-diagrams').emit();await f.view.drain();assert.equal(f.find('choose-diagram').children.some(n=>n.value==='flow-65'),true);assert.deepEqual(f.calls.at(-1).p,{cursor:64,query:''});
 const search=f.find('search-diagrams');search.value='Matching';search.emit('input');await f.view.drain();assert.equal(f.calls.at(-1).p.query,'Matching');assert.equal(f.find('choose-diagram').children.length,1);assert.equal(f.find('choose-diagram').children[0].value,'flow-match');
});
test('a queued mode command is retired if the user starts editing before it reaches IPC',async()=>{
 const f=fixture();let release;f.answer(method=>method==='readEmbed'?new Promise(r=>release=r):{ok:true,version:'c'.repeat(64)});f.view.render(block());f.intersect('embed-a');await tick();const mode=f.find('mode','embed-a');mode.value='fixed';mode.emit('change');f.context({dirty:true});release({ok:true,block:block(),visual:{kind:'svg',base64:'PHN2Zy8+'}});await f.view.drain();assert.equal(f.calls.filter(c=>c.method==='setMode').length,0);assert.equal(f.changed.length,0);
});
test('queued insertion is retired when the document becomes dirty or changes identity',async()=>{
 for(const change of [{dirty:true},{documentId:'other-document'},{version:'d'.repeat(64)}]){
  const f=fixture();let release;f.answer(method=>method==='listDiagrams'?{ok:true,items:[{id:'flow-a',label:'A'}]}:method==='preview'?{ok:true,previewId:'receipt-a',visual:{kind:'svg',base64:'PHN2Zy8+'}}:method==='readEmbed'?new Promise(r=>release=r):{ok:true});
  f.view.insert();await f.view.drain();f.find('choose-diagram').value='flow-a';f.find('preview').emit();await f.view.drain();f.view.render(block());f.intersect('embed-a');await tick();f.find('confirm-insert').emit();f.context(change);release({ok:true,block:block(),visual:{kind:'svg',base64:'PHN2Zy8+'}});await f.view.drain();assert.equal(f.calls.filter(c=>c.method==='insert').length,0);assert.equal(f.changed.length,0);
 }
});
test('picker qualifies selected saved IDs, shows boundary count and offers whole diagram on unsupported grammar',async()=>{
 const f=fixture();f.answer(method=>method==='listDiagrams'?{ok:true,items:[{id:'flow-a',label:'Flow'}]}:method==='inspectSelection'?{ok:true,nodes:[{id:'A',label:'Start'},{id:'B',label:'End'}]}:method==='preview'?{ok:true,previewId:'selection-preview',boundary:[{from:'B',to:'C',direction:'outgoing'}],visual:{kind:'svg',base64:'PHN2Zy8+'}}:{ok:true});
 f.view.insert();await f.view.drain();f.find('choose-diagram').value='flow-a';const scope=f.find('choose-scope');assert.ok(scope,'Missing semantic selection control');scope.value='selection';scope.emit('change');await f.view.drain();const nodes=f.nodes.filter(n=>n.dataset.embedAction==='select-node');assert.equal(nodes.length,2);nodes[0].checked=true;nodes[0].emit('change');f.find('preview').emit();await f.view.drain();assert.deepEqual(f.calls.at(-1).p,{diagramId:'flow-a',scope:'selection',nodeIds:['A']});assert.ok(f.nodes.some(n=>/1 connection/.test(n.textContent??'')));
 f.answer(method=>method==='inspectSelection'?{ok:false,code:'DIAGRAM_EMBED_SELECTION_UNSUPPORTED',wholeDiagramAvailable:true}:{ok:true});scope.value='whole';scope.emit('change');scope.value='selection';scope.emit('change');await f.view.drain();assert.equal(scope.value,'whole');assert.ok(f.nodes.some(n=>/whole diagram/i.test(n.textContent??'')));
});
test('source Send to Docs picker transfers saved identifiers and refuses dirty source; Lock joins pending discovery',async()=>{
 const f=fixture();assert.equal(typeof f.window.createDiagramDocsTransfer,'function');let dirty=false;
 f.answer(method=>method==='listDocuments'?{ok:true,items:[{id:'doc-a',label:'Document'}]}:{ok:true});
 const view=f.window.createDiagramDocsTransfer({api:f.api,getContext:()=>({version:3,sha256:'a'.repeat(64),dirty}),inspect:()=>({ok:true,nodes:[{id:'A',label:'Start'}]}),onStatus:v=>f.messages.push(v)});view.open();await view.drain();f.find('send-document').value='doc-a';f.find('send-scope').value='selection';f.find('send-scope').emit('change');const node=f.find('send-node','A');node.checked=true;node.emit('change');f.find('send-confirm').emit();await view.drain();assert.deepEqual(f.calls.at(-1).p,{documentId:'doc-a',scope:'selection',nodeIds:['A'],expectedVersion:3,expectedSha256:'a'.repeat(64)});assert.equal(Object.hasOwn(f.calls.at(-1).p,'source'),false);
 dirty=true;view.open();assert.match(f.messages.at(-1),/save/i);dirty=false;let release;f.answer(()=>new Promise(r=>release=r));view.open();await tick();let joined=false;const wait=view.pause().then(()=>joined=true);await tick();assert.equal(joined,false);release({ok:true,items:[]});await wait;assert.equal(f.nodes.filter(n=>n.tagName==='dialog'&&n.isConnected&&n.open).length,0);
});
test('Docs receives a transfer as a preselected preview proposal and keeps readonly documents unchanged',async()=>{
 const f=fixture();const proposal={diagramId:'flow-a',scope:'selection',nodeIds:['A']};f.answer(method=>method==='getProposal'?{ok:true,proposal}:method==='listDiagrams'?{ok:true,items:[{id:'flow-a',label:'Flow'}]}:method==='inspectSelection'?{ok:true,nodes:[{id:'A',label:'Start'},{id:'B',label:'Other'}]}:{ok:true});
 assert.equal(typeof f.view.offerProposal,'function');f.context({readonly:true});await f.view.offerProposal();await f.view.drain();assert.equal(f.nodes.some(n=>n.tagName==='dialog'),false);assert.match(f.messages.at(-1),/working copy/i);
 f.context({readonly:false});await f.view.offerProposal();await f.view.drain();assert.equal(f.find('choose-diagram').value,'flow-a');assert.equal(f.find('choose-scope').value,'selection');assert.equal(f.find('select-node','A').checked,true);assert.equal(f.find('confirm-insert').disabled,true);assert.equal(f.calls.some(c=>c.method==='insert'),false);
});
test('switching from Selected steps back to Whole re-enables preview without retaining selected IDs',async()=>{
 const f=fixture();f.answer(method=>method==='listDiagrams'?{ok:true,items:[{id:'flow-a',label:'Flow'}]}:method==='inspectSelection'?{ok:true,nodes:[{id:'A',label:'Start'}]}:{ok:true});f.view.insert();await f.view.drain();f.find('choose-diagram').value='flow-a';const scope=f.find('choose-scope');scope.value='selection';scope.emit('change');await f.view.drain();assert.equal(f.find('preview').disabled,true);scope.value='whole';scope.emit('change');assert.equal(f.find('preview').disabled,false);
});

test('missing selected IDs, source identity and retained version remain visible in working and readonly Docs',async()=>{
 for(const readonly of [false,true]){
  const f=fixture();f.context({readonly});const value={...block(),caption:'',scope:'selection',nodeIds:['A','C'],missingNodeIds:['C'],status:'missing'};f.view.render(value);
  const text=()=>f.nodes.map(n=>n.textContent??'').join(' | ');
  assert.match(text(),/Selected steps/);assert.match(text(),/A, C/);assert.match(text(),/flow-a/);assert.match(text(),/Version 2/);assert.match(text(),/Missing: C/);
  f.answer({ok:true,block:value,sourceName:'Reviewed branch',visual:{kind:'svg',base64:'PHN2Zy8+'}});f.intersect('embed-a');await f.view.drain();assert.match(text(),/Reviewed branch/);assert.match(text(),/Missing: C/);assert.match(text(),/Version 2/);assert.deepEqual(value.nodeIds,['A','C']);
 }
});
test('pending, render-error and Undo suspension keep saved identity visible',async()=>{
 for(const status of ['pending','render-error']){const f=fixture(),value={...block(),status};f.view.render(value);f.answer({ok:true,block:value,refreshSuspended:true,sourceName:'Exact saved name',visual:{kind:'svg',base64:'PHN2Zy8+'}});f.intersect('embed-a');await f.view.drain();const text=f.nodes.map(n=>n.textContent??'').join(' | ');assert.match(text,/Whole diagram/);assert.match(text,/Version 2/);assert.match(text,/Exact saved name/);assert.match(text,/paused.*Undo/i);}
});

async function refusedPicker(code,help){
 const f=fixture();if(help)f.window.SirenHelpWorkspace={explain:help};
 f.answer(method=>method==='listDiagrams'?{ok:true,items:[{id:'flow-a',label:'Flow'}]}:method==='preview'?{ok:true,previewId:'receipt-a',visual:{kind:'svg',base64:'PHN2Zy8+'}}:{ok:false,code,message:'PRIVATE_SOURCE_DETAIL'});
 f.view.insert();await f.view.drain();f.find('choose-diagram').value='flow-a';f.find('preview').emit();await f.view.drain();return f;
}
test('insertion refusal exposes only the bounded code and an operation-scoped manual offer',async()=>{
 const offers=[],f=await refusedPicker('PENDING_CLEANUP_FAILED',(host,identity)=>offers.push({host,identity:JSON.parse(JSON.stringify(identity))}));
 f.find('confirm-insert').emit();await f.view.drain();
 const status=f.nodes.find(n=>n.role==='status');assert.match(status.textContent,/PENDING_CLEANUP_FAILED/);assert.doesNotMatch(status.textContent,/PRIVATE_SOURCE_DETAIL|Preview the latest/);
 assert.equal(offers.length,1);assert.equal(offers[0].host,status);assert.deepEqual(offers[0].identity,{namespace:'docs-diagram',operation:'insert',code:'PENDING_CLEANUP_FAILED'});
 assert.equal(f.changed.length,0);assert.equal(f.find('confirm-insert').disabled,true);assert.equal(f.nodes.find(n=>n.tagName==='dialog').open,true);
});
test('unknown bounded insertion codes remain generic and malformed private content never reaches help',async()=>{
 for(const code of ['UNRECOGNIZED_CODE','<private detail>',{},'A'.repeat(97),undefined]){
  const offers=[],f=await refusedPicker(code,(host,identity)=>offers.push(identity));f.find('confirm-insert').emit();await f.view.drain();
  const status=f.nodes.find(n=>n.role==='status');assert.doesNotMatch(status.textContent,/private|PRIVATE_SOURCE_DETAIL|object Object/);
  assert.equal(offers.length,code==='UNRECOGNIZED_CODE'?1:0);assert.equal(f.changed.length,0);
 }
});
test('Lock retires a pending insertion refusal before any manual offer or changed callback',async()=>{
 const offers=[],f=await refusedPicker('WRITER_BUSY',(...args)=>offers.push(args));let release;f.answer(()=>new Promise(r=>release=r));f.find('confirm-insert').emit();await tick();
 const paused=f.view.pause();release({ok:false,code:'WRITER_BUSY'});await paused;f.view.resume();assert.equal(offers.length,0);assert.equal(f.changed.length,0);assert.equal(f.nodes.find(n=>n.tagName==='dialog').isConnected,false);
});
