import {createRenderAppearanceContract} from '../src/appearance/render.mjs';
import {buildDiagramMetadata} from '../build/diagram-metadata.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const code=[buildDiagramMetadata(),await read('../src/ui/diagram/annotations.js'),await read('../src/ui/diagram/draft.js'),await read('../src/ui/diagram/walkthrough.js'),await read('../src/ui/windows/diagram.js')].join('\n');
async function fixture(){
 class Element{children=[];listeners={};style={setProperty(){}};dataset={};attrs={};hidden=false;value='system';clientWidth=598;clientHeight=398;offsetWidth=600;offsetHeight=400;clientLeft=1;clientTop=1;isConnected=true;tagName='BUTTON';
  append(...items){for(const item of items){item.parent=this;this.children.push(item);}}replaceChildren(...items){this.children=[];this.append(...items);}contains(n){return n===this||this.children.some(c=>c.contains(n));}addEventListener(k,fn){this.listeners[k]=fn;}removeEventListener(k){delete this.listeners[k];}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}remove(){this.isConnected=false;}focus(){}getBoundingClientRect(){return this.rect??{left:0,top:0,width:600,height:400};}closest(){return null;}}
 const elements=new Map(),$=id=>{if(!elements.has(id)){const e=new Element();e.id=id;elements.set(id,e);}return elements.get(id);},callbacks={},events={},sessionCalls=[],timers=[];
 const inert=()=>({paint(){},reset(){},dispose(){},pause(){},setTargets(){},isEditing:()=>false,commit:()=>true});
 const window={SirenNativeDiagramStyle:{appearance:createRenderAppearanceContract()},addEventListener:(k,fn)=>events[k]=fn,SirenNativeViewIdentity:{set(){},clear(){}},SirenNativeDiagramStyleView:{create:o=>{callbacks.style=o;return inert();}},SirenNativeDiagramBuildView:{create:o=>{callbacks.build=o;return inert();}},SirenNativeGuidedView:{create:()=>inert()},SirenPresentationAuthoring:{create:()=>inert()},SirenNativeDiagramHistoryView:{create:o=>{callbacks.history=o;return {...inert(),keydown(){}};}},sirenDeckNavigation:{onAuthoring:fn=>callbacks.author=fn},SirenNativeDiagramSession:{create:o=>{callbacks.session=o;return {invalidate(){sessionCalls.push('invalidate');return true;},refresh(){sessionCalls.push('refresh');},renderLocal(){sessionCalls.push('render');},pause:async()=>true,resume(){},dispose(){}};}},SirenNativeDiagramTransfer:{whenPlaced:async()=>true},sirenDiagramEdit:{onReferenceChanged:fn=>{callbacks.reference=fn;return ()=>{};}},sirenDiagramRead:{},sirenWindow:{onReady:fn=>callbacks.ready=fn},sirenViewControl:{onPrepare:fn=>callbacks.prepare=fn,onResume:fn=>callbacks.resume=fn}};
 const media={matches:false,addEventListener:(k,fn)=>callbacks.media=fn};const document={getElementById:$,createElement:()=>new Element(),body:new Element(),head:new Element(),documentElement:new Element()};
 $('diagramTheme').value='system';
 vm.runInNewContext(code,{window,document,matchMedia:()=>media,crypto:webcrypto,structuredClone,TextEncoder,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},confirm:()=>true,ResizeObserver:class{observe(){}disconnect(){}}});await Promise.resolve();
 const diagram={id:'D',name:'Exact colours',source:'flowchart TD\nA-->B\nstyle A fill:#ff3366'},context={ok:true,readonly:false,diagram,version:1,sha256:'a'.repeat(64),projectRevision:1};callbacks.session.onSource(context);
 const svg=new Element(),a=new Element(),b=new Element();a.rect={left:100,top:80,width:40,height:30};a.textContent='Start';b.rect={left:200,top:180,width:40,height:30};b.textContent='Next';svg.append(a,b);const render=()=>callbacks.session.onPreview({svg,targets:[{id:'A',groups:[a]},{id:'B',groups:[b]}],fontDeclared:false});render();
 const field=id=>$('diagramWalkthroughControls').children.find(c=>c.id===id);return{$,field,callbacks,sessionCalls,timers,render,context,events,document};
}
test('real native controller mounts readonly-safe browsing and retires target authority at every edit intent',async()=>{
 const f=await fixture();assert.ok(f.field('diagramWalkthroughStart'),'walkthrough must be mounted in the native window');
 const start=()=>f.field('diagramWalkthroughStart').listeners.click(),retired=()=>{assert.equal(f.$('diagramWalkthroughOverlay').hidden,true);assert.equal(f.field('diagramWalkthroughStart').disabled,true);assert.equal(f.sessionCalls.at(-1),'invalidate');};
 start();assert.equal(f.$('diagramWalkthroughOverlay').hidden,false);f.$('diagramSource').value='flowchart TD\nC-->D';f.$('diagramSource').listeners.input();retired();
 f.render();start();f.callbacks.style.onStyle({fontSize:20});retired();
 f.render();start();f.callbacks.history.onRestore();retired();
 f.render();start();f.$('diagramTheme').listeners.change();assert.equal(f.$('diagramWalkthroughOverlay').hidden,true);assert.equal(f.sessionCalls.slice(-2)[0],'invalidate');assert.equal(f.sessionCalls.at(-1),'render');
 f.render();start();f.callbacks.session.onError();assert.equal(f.$('diagramWalkthroughOverlay').hidden,true);assert.equal(f.field('diagramWalkthroughStart').disabled,true);
 f.render();start();f.$('diagramWorkspaceMode').listeners.click();retired();f.render();assert.equal(f.field('diagramWalkthroughStart').disabled,true);
});
test('Refresh retires before placement resolves; common prepare/disposal clear browsing before async work',async()=>{
 const f=await fixture();assert.ok(f.field('diagramWalkthroughStart'));f.field('diagramWalkthroughStart').listeners.click();const refresh=f.$('refreshDiagram').listeners.click();assert.equal(f.$('diagramWalkthroughOverlay').hidden,true);assert.equal(f.sessionCalls.at(-1),'invalidate');await refresh;
 f.render();f.field('diagramWalkthroughStart').listeners.click();const prepare=f.callbacks.prepare();assert.equal(f.$('diagramWalkthroughOverlay').hidden,true);assert.equal(f.field('diagramWalkthroughStart').disabled,true);await prepare;f.callbacks.resume();assert.equal(f.$('diagramWalkthroughOverlay').hidden,true);f.render();assert.equal(f.field('diagramWalkthroughStart').disabled,false);f.events.pagehide();assert.equal(f.$('diagramWalkthroughControls').children.length,0);
});
test('walkthrough asset is scoped to native Diagram, decoration stays outside SVG and uses shared theme',async()=>{
 const builder=await read('../build/diagram-window.mjs'),template=await read('../src/ui/diagram/window.html');assert.ok(builder.includes("../src/ui/diagram/walkthrough.js"));assert.ok(template.includes('id="diagramWalkthroughControls"'));assert.ok(template.includes('<div id="diagramCanvas"></div><div id="diagramWalkthroughOverlay"'));assert.match(template,/#diagramWalkthroughOverlay\{[^}]*pointer-events:none/);assert.match(template,/var\(--siren-accent/);
 for(const p of ['../build/diagram-vector.mjs','../build/presentation-render.mjs']){const other=await read(p);assert.equal(other.includes('walkthrough.js'),false);}
});
