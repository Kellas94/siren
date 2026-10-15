// OWNER fixture copied from maintained docs-refresh-regressions.test.mjs.
// Changes: export fixture utilities, static import depth, count flush calls,
// parameterize reference notification, and expose only the finite 250ms refresh timer.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {createHash,webcrypto} from 'node:crypto';
import {createDocumentActivityContract} from '../../src/documents/document-activity.mjs';

// Actual renderer scripts in a finite inert DOM. No native window,
// IPC transport, project repository or filesystem mutation is exercised here.
const scripts=await Promise.all(['diagram-embeds.js','draft.js','reader.js','activity.js','../windows/docs.js'].map(path=>readFile(new URL('../../src/ui/docs/'+path,import.meta.url),'utf8')));
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
export async function settle(){await new Promise(resolve=>setImmediate(resolve));await new Promise(resolve=>setImmediate(resolve));}
export async function waitFor(predicate){for(let i=0;i<250;i++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,2));}assert.ok(predicate(),'Expected genuine local Save acknowledgement');}

export async function fixture({readonly=false,embed=false,pauseExport=async()=>{}}={}){
 let document,prepare,resume,reference,pendingDiagram,revision=1,writes=0,flushes=0,reads=0,refreshCallback=null,readOverride=null,confirmations=0,saveGate=null,flushOverride=null;
 const nodes=[],events={};
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.events={};this.hidden=false;this.disabled=false;this.className='';this._text='';this.parent=null;this.selectionStart=0;this.selectionEnd=0;this.classList={contains:name=>this.className.split(' ').includes(name)};nodes.push(this);}
  get isConnected(){return this===document?.body||this===document?.documentElement||!!this.parent?.isConnected;}
  get textContent(){return this._text+this.children.map(child=>child.textContent??'').join('');}
  set textContent(value){this._text=String(value);this.replaceChildren();}
  append(...children){for(const child of children){child.remove?.();child.parent=this;this.children.push(child);}}
  insertBefore(child,before){child.remove?.();child.parent=this;const at=this.children.indexOf(before);if(at<0)this.children.push(child);else this.children.splice(at,0,child);}
  setAttribute(key,value){this[key]=String(value);}
  addEventListener(key,callback){this.events[key]=callback;}
  removeEventListener(key,callback){if(this.events[key]===callback)delete this.events[key];}
  emit(key='click'){if(key==='click'&&this.disabled)return;return this.events[key]?.({target:this,preventDefault(){}});}
  replaceChildren(...children){for(const child of this.children)child.parent=null;this.children=[];this.append(...children);}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  querySelectorAll(selector){const all=this.children.flatMap(child=>[child,...(child.querySelectorAll?.('*')??[])]);return all.filter(node=>{
   if(selector==='*')return true;if(selector.startsWith('.'))return node.classList?.contains(selector.slice(1));
   if(selector===':scope > h1')return node.parent===this&&node.tagName==='H1';
   if(selector.startsWith('[data-')){const match=selector.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);if(!match)return false;const key=match[1].replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase());return Object.hasOwn(node.dataset??{},key)&&(match[2]===undefined||node.dataset[key]===match[2]);}
   return false;
  });}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
  get lastElementChild(){return this.children.at(-1);}
  scrollIntoView(){}
  focus(){document.activeElement=this;}
  contains(node){return node===this||this.children.some(child=>child.contains?.(node));}
  closest(selector){for(let node=this;node;node=node.parent)if(selector.startsWith('.')&&node.classList?.contains(selector.slice(1)))return node;return null;}
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
 }
 const body=new Node('body'),html=new Node('html');
 const ids=['documentContent','documentOutline','viewStatus','viewTitle','retryDocument','documentTheme','openWorkingDocument','saveDocument','documentChangesNotice','documentChangesMessage','exportDocument','revealDocumentExport','documentContext','documentActivity','documentActivityPanel','reviewLatestDocument','replaceLatestDocument'];
 const elements=Object.fromEntries(ids.map(id=>{const node=new Node(id==='documentContent'?'article':'div');node.id=id;body.append(node);return [id,node];}));elements.documentTheme.value='light';
 document={body,documentElement:html,activeElement:null,createElement:tag=>new Node(tag),createTextNode:text=>({textContent:text,children:[],querySelectorAll:()=>[],contains:()=>false}),getElementById:id=>nodes.find(node=>node.id===id&&node.isConnected),getSelection:()=>null};
 let saved={id:'refresh-doc',title:'Agent notes',blocks:[{id:'heading-a',kind:'heading',level:2,text:'Saved heading'},...(!readonly?[{id:'text-a',kind:'text',html:'<p>Saved text</p>'}]:[])],comments:[],revisions:[]};
 const read=()=>({ok:true,readonly,canEdit:true,document:structuredClone(saved),version:String(revision).repeat(64),sha256:hash(saved),projectRevision:revision});
 const getDocument=async()=>{reads++;return readOverride?readOverride():read();};
 const window={SirenDocumentActivity:createDocumentActivityContract(),SirenNativeDocsExportView:{create:()=>({update(){},reset(){},pause:pauseExport,resume(){},dispose(){}})},SirenNativeViewIdentity:{clear(){},set(){}},SirenDocsContext:{open(){},close(){}},SirenNativeDocsRichText:{editable:()=>false},SirenStructuredDocs:{isEditableBlock:()=>false,names:{}},sirenDocsRead:{getDocument},sirenDocsEdit:{onReferenceChanged:()=>()=>{},applyDocument:async request=>{writes++;if(saveGate)await saveGate.promise;saved={...saved,...structuredClone(request.payload)};revision++;return {ok:true,domain:'docs',entityId:saved.id,operationId:request.operationId,version:read().version,sha256:hash(saved),projectRevision:revision,durability:'committed'};},flushDocument:async request=>(flushes++,flushOverride?await flushOverride(request):{ok:true,domain:'docs',entityId:saved.id,version:request.expectedVersion,sha256:hash(saved),projectRevision:revision,durability:'committed'})},sirenViewControl:{onPrepare(callback){prepare=callback;},onResume(callback){resume=callback;}},addEventListener:(name,callback)=>events[name]=callback};
 window.sirenDocsEdit.onReferenceChanged=callback=>{reference=callback;return()=>reference=null;};window.sirenDocsDiagramEvents={onPending:callback=>{pendingDiagram=callback;return()=>pendingDiagram=null;}};
 const embedCalls=[];if(embed)saved.blocks.splice(1,0,{id:'embed-a',kind:'diagram-embed',diagramId:'flow-a',caption:'Reviewed flow',mode:'live',status:'current',snapshot:{sourceVersion:2},display:{height:320,fit:'contain'}});
 window.sirenDocsDiagrams={readEmbed:async p=>{embedCalls.push(p);return {ok:true,block:saved.blocks.find(b=>b.id===p.blockId),visual:{kind:'svg',base64:'PHN2Zy8+'}};}};
 const context={window,document,structuredClone,crypto:webcrypto,TextEncoder,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),confirm:()=>{confirmations++;return true;},setTimeout:(callback,delay)=>{if(delay===250){refreshCallback=callback;return callback;}return setTimeout(callback,delay);},clearTimeout:timer=>{if(timer===refreshCallback)refreshCallback=null;else clearTimeout(timer);}};
 for(const code of scripts)runInNewContext(code,context);assert.equal(await window.sirenNativeDocsView.connect(),true);
 const input=id=>elements.documentContent.querySelectorAll('*').find(node=>node.tagName==='TEXTAREA'&&node.dataset.blockId===id);
 const edit=(id,value)=>{const node=input(id);assert.ok(node);assert.equal(node.disabled,false,'The actual field must accept the user edit');node.value=value;node.emit('input');return node;};
 return {window,document,elements,input,edit,read,events,nodes,embedCalls,notify:(ref)=>reference?.(ref??{documentId:saved.id,version:read().version,projectRevision:revision}),pendingDiagram:()=>pendingDiagram?.({documentId:saved.id,diagramId:'flow-a',reason:'working-draft'}),get saved(){return saved;},get writes(){return writes;},get flushes(){return flushes;},setFlush:callback=>flushOverride=callback,runRefreshTimer(){const callback=refreshCallback;refreshCallback=null;callback?.();},get reads(){return reads;},get confirmations(){return confirmations;},holdRead(){const held=deferred();readOverride=()=>held.promise;return held;},holdSave(){saveGate=deferred();return saveGate;},releaseReads(){readOverride=null;},store(value){saved=structuredClone(value);revision++;},prepare:()=>prepare(),resume:()=>resume(),refresh:()=>window.sirenNativeDocsView.connect(),title(value){const node=document.getElementById('documentTitleInput');assert.ok(node);node.value=value;node.emit('input');return node;}};
}

