// Shared owner fixture adapted transparently from the independent identification
// probes frozen in docs-present-followup-identification-20261009. This is the same
// finite inert environment, not an independent browser/native qualification.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash,webcrypto} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {runInNewContext} from 'node:vm';
import {WindowRegistry} from '../../src/windows/registry.mjs';
import {PresentationSession} from '../../src/windows/presentation.mjs';

export const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
export const tick=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));};
const sourceRoot=new URL('../../src/',import.meta.url);
const rendererSource=async path=>readFile(new URL(path,sourceRoot),'utf8');
class Element{
 children=[];dataset={};style={};events={};disabled=false;hidden=false;value='';className='';_text='';
 constructor(tag='div'){this.tagName=tag.toUpperCase();}
 set textContent(value){this.replaceChildren();this._text=String(value);}
 get textContent(){return this._text+this.children.map(child=>child.textContent??'').join('');}
 append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
 replaceChildren(...children){this._text='';this.children=[];this.append(...children);}
 insertBefore(child,before){const at=this.children.indexOf(before);child.parent=this;this.children.splice(at<0?this.children.length:at,0,child);}
 setAttribute(key,value){this[key]=value;}
 addEventListener(name,callback){this.events[name]=callback;}
 emit(name='click'){if(name==='click'&&this.disabled)return;return this.events[name]?.({target:this,preventDefault(){}});}
 querySelectorAll(selector){const all=this.children.flatMap(child=>[child,...(child.querySelectorAll?.('*')??[])]);return all.filter(node=>selector==='*'||selector===':scope > h1'&&node.parent===this&&node.tagName==='H1'||selector.startsWith('.')&&node.className.split(' ').includes(selector.slice(1)));}
 querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}

export async function docsFixture(){
 let prepare,resume;
 const ids=['documentContent','documentOutline','viewStatus','viewTitle','retryDocument','documentTheme','openWorkingDocument','saveDocument','documentChangesNotice','documentChangesMessage','exportDocument','revealDocumentExport','documentContext','documentActivity','documentActivityPanel','reviewLatestDocument','replaceLatestDocument'];
 const nodes=new Map(ids.map(id=>[id,new Element()])),body=new Element('body'),html=new Element('html'),events={};body.append(...nodes.values());nodes.get('documentTheme').value='light';
 const document={body,documentElement:html,getElementById:id=>nodes.get(id),createElement:tag=>new Element(tag)};
 const saved={id:'doc-a',title:'Saved document',blocks:[]},hash=createHash('sha256').update(JSON.stringify(saved)).digest('hex');
 const window={
  SirenNativeDocsExportView:{create:()=>({update(){},reset(){},pause:async()=>{},resume(){},dispose(){}})},
  SirenNativeDocsActivity:{create:()=>({setContext(){},invalidate(){},updateState(){},pause(){},resume(){},dispose(){}})},
  SirenNativeViewIdentity:{clear(){},set(){}},SirenDocsContext:{open(){},close(){}},SirenNativeDocsReader:{render:()=>({reveal:()=>({ok:true})})},
  sirenDocsRead:{getDocument:async()=>({ok:true,readonly:true,canEdit:true,document:saved,version:'a'.repeat(64),sha256:hash,projectRevision:1})},
  sirenDocsEdit:{onReferenceChanged:()=>()=>{},openWorkingCopy:async()=>({ok:true}),openLatest:async()=>({ok:true})},
  sirenViewControl:{onPrepare:callback=>prepare=callback,onResume:callback=>resume=callback},addEventListener:(name,callback)=>events[name]=callback
 };
 const context={window,document,structuredClone,crypto:webcrypto,TextEncoder,matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){}}),setTimeout,clearTimeout};
 for(const path of ['ui/docs/draft.js','ui/windows/docs.js'])runInNewContext(await rendererSource(path),context);
 assert.equal(await window.sirenNativeDocsView.connect(),true);
 return {window,document,nodes,prepare:()=>prepare(),resume:()=>resume(),events};
}

export async function presentFixture(){
 const windows=[],sent=[];
 const registry=new WindowRegistry({
  authorize:request=>({projectId:'project-a',mode:'normal',access:request.role==='audience'?'presentation':'read',entityIds:['deck-a']}),
  createWindow:async options=>{
   const window=new EventEmitter();window.id=windows.length+1;
   window.isDestroyed=()=>window.destroyed===true;window.isMinimized=()=>false;window.show=()=>{};window.restore=()=>{};window.focus=()=>{};
   window.destroy=()=>{window.destroyed=true;window.webContents.emit('destroyed');window.emit('closed');};window.close=window.destroy;
   window.webContents=new EventEmitter();Object.assign(window.webContents,{
    id:100+window.id,mainFrame:{url:options.mainFrameUrl},getURL:()=>options.mainFrameUrl,isDestroyed:()=>false,
    send(channel,frame){if(this.failSend)throw Error('Inert send adapter failure');sent.push({windowId:window.id,channel,frame:structuredClone(frame)});}
   });windows.push(window);return window;
  }
 });
 for(const role of ['presenter','audience','audience'])await registry.openView({role,entityId:'deck-a'});
 const grants=windows.map(window=>registry.capture({sender:window.webContents,senderFrame:window.webContents.mainFrame}));
 const version='a'.repeat(64),deck={projectId:'project-a',deckId:'deck-a',version,title:'Exact saved deck',slides:[
  {id:'first',title:'First',notes:'NOTES_FIRST',render:{}}, {id:'second',title:'Second',notes:'NOTES_SECOND',render:{}}
 ]};
 let renderFailure=false,imageGate=null,imageDecodeCalls=0;
 const session=new PresentationSession({registry,loadDeck:async()=>structuredClone(deck),renderPublicSlide:async({slide})=>{if(renderFailure)throw Error('Inert render failure');return imageGate?{kind:'image',title:slide.title,image:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII='}:{kind:'text',title:slide.title,body:'Public '+slide.title};},
  // Actual adapter call shape from main.mjs. Only the sender/window is inert.
  sendFrame:(grant,frame)=>{const event=registry.eventFor(grant);if(!event)return false;event.sender.send('siren:presentation-frame',frame);return true;}
 });
 assert.equal((await session.admit(grants[0])).ok,true);
 for(const audience of grants.slice(1))assert.equal(session.bindAudience(grants[0],audience).ok,true);
 const ids=['editDeck','viewStatus','publicSlide','viewTitle','slideList','presenterNotes','position','audienceDisplay','closeView','fullscreen','previousSlide','nextSlide','refreshDeck','openAudience','exportNotes','revealNotesExport'];
 const nodes=new Map(ids.map(id=>[id,new Element()])),body=new Element(),callbacks={},requests=[];body.dataset.role='presenter';
 const document={body,documentElement:{style:{}},getElementById:id=>nodes.get(id),createElement:()=>new Element(),querySelectorAll:()=>[...nodes.values(),...nodes.get('slideList').children],addEventListener:(name,callback)=>callbacks[name]=callback};
 const bridge={
  getPresenter:async()=>session.getPresenter(grants[0]),getDisplays:async()=>({ok:true,displays:[]}),getPreview:async()=>session.getPreview(grants[0]),
  navigate:async request=>{const result=await session.navigate(grants[0],structuredClone(request));requests.push({request,result});return result;},
  onFrame:callback=>callbacks.frame=callback,onFullscreen:callback=>callbacks.fullscreen=callback
 };
 runInNewContext(await rendererSource('ui/presentation/window.js'),{document,Image:class extends Element{decode(){imageDecodeCalls++;return imageGate?.promise??Promise.resolve();}},window:{
  SirenAppearancePalette:[{id:'matrix',mode:'dark'}],sirenPresentation:bridge,SirenPresenterNotesExport:{create:()=>({update(){},reset(){},pause:()=>({ok:true}),resume(){}})},
  sirenWindow:{getView:async()=>({ok:true,view:grants[0]}),onReady:callback=>callbacks.ready=callback},
  sirenViewControl:{onPrepare:callback=>callbacks.prepare=callback,onResume:callback=>callbacks.resume=callback},addEventListener:(name,callback)=>callbacks[name]=callback
 }});
 await tick();assert.equal(body.dataset.publicReady,'true');assert.equal(nodes.get('position').textContent,'1 / 2');
 for(const audience of grants.slice(1))assert.equal(session.acknowledge(audience,{deckVersion:version,sequence:1}).ok,true);
 return {nodes,body,callbacks,bridge,requests,windows,sent,grants,session,version,get imageDecodeCalls(){return imageDecodeCalls;},failRender:()=>{renderFailure=true;},holdImage:()=>imageGate=deferred(),next:()=>nodes.get('nextSlide').emit(),status:()=>nodes.get('viewStatus').textContent};
}
