import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {buildDiagramMetadata} from '../build/diagram-metadata.mjs';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const code=[buildDiagramMetadata(),await read('../src/ui/diagram/draft.js'),await read('../src/ui/diagram/walkthrough.js'),await read('../src/ui/diagram/annotations.js'),await read('../src/ui/windows/diagram.js')].join('\n');
async function fixture(){
 class Element{constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.listeners={};this.style={setProperty(){}};this.dataset={};this.attrs={};this.hidden=false;this.value='';this.isConnected=true;this.clientWidth=598;this.clientHeight=398;this.offsetWidth=600;this.offsetHeight=400;this.clientLeft=1;this.clientTop=1;}
  append(...items){for(const item of items){item.parentElement=this;this.children.push(item);}}replaceChildren(...items){this.children=[];this.append(...items);}contains(n){return n===this||this.children.some(c=>c.contains(n));}addEventListener(k,fn){this.listeners[k]=fn;}removeEventListener(k){delete this.listeners[k];}setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}removeAttribute(k){delete this.attrs[k];}remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(c=>c!==this);this.isConnected=false;}focus(){}getBoundingClientRect(){return this.rect??{left:0,top:0,width:600,height:400};}closest(){return null;}querySelectorAll(){return [];}}
 const elements=new Map(),$=id=>{if(!elements.has(id)){const e=new Element();e.id=id;elements.set(id,e);}return elements.get(id);},callbacks={},events={},sessionCalls=[],timers=[];
 const inert=()=>({paint(){},reset(){},dispose(){},pause(){},setTargets(){},isEditing:()=>false,commit:()=>true});
 const window={addEventListener:(k,fn)=>events[k]=fn,SirenNativeViewIdentity:{set(){},clear(){}},SirenNativeDiagramStyleView:{create:o=>{callbacks.style=o;return inert();}},SirenNativeDiagramBuildView:{create:o=>{callbacks.build=o;return inert();}},SirenNativeGuidedView:{create:()=>inert()},SirenPresentationAuthoring:{create:()=>inert()},SirenNativeDiagramHistoryView:{create:o=>{callbacks.history=o;return {...inert(),keydown(){}};}},sirenDeckNavigation:{onAuthoring:fn=>callbacks.author=fn},SirenNativeDiagramSession:{create:o=>{callbacks.session=o;return {invalidate(){sessionCalls.push('invalidate');return true;},refresh(){sessionCalls.push('refresh');},renderLocal(){sessionCalls.push('render');},pause:async()=>true,resume(){},dispose(){}};}},SirenNativeDiagramTransfer:{whenPlaced:async()=>true},sirenDiagramEdit:{onReferenceChanged:fn=>{callbacks.reference=fn;return ()=>{};}},sirenDiagramRead:{},sirenWindow:{onReady:fn=>callbacks.ready=fn},sirenViewControl:{onPrepare:fn=>callbacks.prepare=fn,onResume:fn=>callbacks.resume=fn}};
 const media={matches:false,addEventListener:(k,fn)=>callbacks.media=fn},document={getElementById:$,createElement:tag=>new Element(tag),body:new Element(),head:new Element(),documentElement:new Element()};
 vm.runInNewContext(code,{window,document,getComputedStyle:()=>({opacity:'1'}),matchMedia:()=>media,crypto:webcrypto,structuredClone,TextEncoder,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},confirm:()=>true,ResizeObserver:class{observe(){}disconnect(){}}});await Promise.resolve();
 const diagram={id:'D',name:'Exact colours',source:'flowchart TD\nA-->B\nstyle A fill:#ff3366'},context={ok:true,readonly:false,diagram,version:1,sha256:'a'.repeat(64),projectRevision:1};callbacks.session.onSource(context);
 const svg=new Element('svg'),a=new Element('g'),b=new Element('g');a.rect={left:100,top:80,width:40,height:30};a.textContent='Start';b.rect={left:200,top:180,width:40,height:30};b.textContent='Next';svg.append(a,b);const render=()=>callbacks.session.onPreview({svg,targets:[{id:'A',groups:[a]},{id:'B',groups:[b]}],fontDeclared:false});render();
 const field=id=>{const walk=n=>n.id===id?n:n.children.map(walk).find(Boolean);return walk($('diagramInspectorPanel'));};return{$,field,callbacks,sessionCalls,timers,render,context,events,document};
}

function pointer(f,type,x,y,id=1){const target={closest:()=>null};return f.$('diagramViewport').listeners[type]({button:0,buttons:type==='pointerup'?0:1,pointerId:id,clientX:x,clientY:y,target});}
function pan(f){return f.$('diagramCanvas').style.transform;}
test('pan applies the genuine release endpoint even without an intervening pointermove',async()=>{
 const f=await fixture();f.$('diagramViewport').setPointerCapture=()=>{};pointer(f,'pointerdown',100.25,200.5);pointer(f,'pointerup',145.25,225.5);assert.equal(pan(f),'translate(45px,25px) scale(1)');
});
test('pan release consumes its final endpoint after an earlier coalesced move and does not drift on a click',async()=>{
 const f=await fixture();f.$('diagramViewport').setPointerCapture=()=>{};pointer(f,'pointerdown',100,200);pointer(f,'pointermove',120,210);pointer(f,'pointerup',145,225);assert.equal(pan(f),'translate(45px,25px) scale(1)');pointer(f,'pointerdown',200,200);pointer(f,'pointerup',200,200);assert.equal(pan(f),'translate(45px,25px) scale(1)');
});
test('foreign pointer release/cancel/lost-capture cannot terminate the owning pan',async()=>{
 for(const end of ['pointerup','pointercancel','lostpointercapture']){const f=await fixture();f.$('diagramViewport').setPointerCapture=()=>{};pointer(f,'pointerdown',100,200,1);pointer(f,end,500,500,2);pointer(f,'pointermove',145,225,1);assert.equal(pan(f),'translate(45px,25px) scale(1)');}
});
test('matching cancellation/lost-capture ends the pan without applying an invented release endpoint',async()=>{
 for(const end of ['pointercancel','lostpointercapture']){const f=await fixture();f.$('diagramViewport').setPointerCapture=()=>{};pointer(f,'pointerdown',100,200);pointer(f,'pointermove',110,205);pointer(f,end,500,500);pointer(f,'pointermove',145,225);pointer(f,'pointerup',145,225);assert.equal(pan(f),'translate(10px,5px) scale(1)');}
});
test('private prepare retires pan before a late release and later rollback does not restore a drag',async()=>{
 const f=await fixture();f.$('diagramViewport').setPointerCapture=()=>{};pointer(f,'pointerdown',100,200);pointer(f,'pointermove',110,205);const before=pan(f);await f.callbacks.prepare();pointer(f,'pointerup',145,225);assert.equal(pan(f),before);f.callbacks.resume();pointer(f,'pointermove',200,200);assert.equal(pan(f),before);
});
