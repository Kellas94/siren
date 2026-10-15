// UIR-3 owner-authored controls regression contract. Whole UI script executes
// unchanged in a VM over inert DOM/geometry/pointer boundaries only. This is
// not browser layout, native focus, Electron, package or visual qualification.
// When split.js is absent the first checks prove absence; behavior is SKIPPED,
// never presented as tested or passing before the controller exists.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Script} from 'node:vm';

const script=await readFile(new URL('../src/ui/code/split.js',import.meta.url),'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
const buildSource=await readFile(new URL('../build/windows.mjs',import.meta.url),'utf8');
const analysisSource=await readFile(new URL('../src/ui/code/analysis.js',import.meta.url),'utf8');
const behavior=(name,fn)=>test(name,{skip:script===null?'NOT_EXECUTED: proposed split.js is absent':false},fn);
const close=(actual,wanted,tolerance=0.001)=>assert(Math.abs(actual-wanted)<=tolerance,`${actual} must be within ${tolerance} of ${wanted}`);

function fixture(initialWidth=1200){
 const geometry={width:initialWidth,left:100},frames=new Map(),observers=[],captures=[],releases=[],forbidden=[];let nextFrame=0;
 class Target {
  constructor(){this.listeners=new Map();}
  addEventListener(type,callback,options={}){const rows=this.listeners.get(type)??[];if(!rows.some(row=>row.callback===callback))rows.push({callback,once:options?.once===true});this.listeners.set(type,rows);}
  removeEventListener(type,callback){this.listeners.set(type,(this.listeners.get(type)??[]).filter(row=>row.callback!==callback));}
  deliver(event){event.currentTarget=this;for(const row of [...(this.listeners.get(event.type)??[])]){if(row.once)this.removeEventListener(event.type,row.callback);row.callback.call(this,event);}const handler=this['on'+event.type];if(typeof handler==='function')handler.call(this,event);}
 }
 class Style {
  constructor(){this.values=new Map();}
  setProperty(name,value){this.values.set(name,String(value));}
  getPropertyValue(name){return this.values.get(name)??'';}
  removeProperty(name){const value=this.getPropertyValue(name);this.values.delete(name);return value;}
 }
 class Element extends Target {
  constructor(id){super();this.id=id;this.hidden=false;this.disabled=false;this.style=new Style();this.dataset={};this.attributes=new Map();this.children=[];this.isConnected=true;this.parentElement=null;this.capture=new Set();this.textContent='';this.tabIndex=0;this.nodeType=1;
   const classes=new Set();this.classList={add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name)),contains:name=>classes.has(name),toggle:(name,force)=>{const add=force===undefined?!classes.has(name):Boolean(force);if(add)classes.add(name);else classes.delete(name);return add;}};
  }
  setAttribute(name,value){this.attributes.set(name,String(value));}
  getAttribute(name){return this.attributes.get(name)??null;}
  hasAttribute(name){return this.attributes.has(name);}
  removeAttribute(name){this.attributes.delete(name);}
  setPointerCapture(id){this.capture.add(id);captures.push(id);}
  hasPointerCapture(id){return this.capture.has(id);}
  releasePointerCapture(id){this.capture.delete(id);releases.push(id);}
  getBoundingClientRect(){const width=this===layout?geometry.width:this===panel?Number.parseFloat(layout.style.getPropertyValue('--code-analysis-width'))||0:6;return {x:geometry.left,y:0,left:geometry.left,right:geometry.left+width,top:0,bottom:600,width,height:600};}
  get clientWidth(){return this.getBoundingClientRect().width;}
  get offsetWidth(){return this.clientWidth;}
  focus(){document.activeElement=this;}
  append(){forbidden.push('append');throw Error('Splitter must not mount content');}
  appendChild(){forbidden.push('appendChild');throw Error('Splitter must not mount content');}
  replaceChildren(){forbidden.push('replaceChildren');throw Error('Splitter must not replace source or analysis content');}
  remove(){forbidden.push('remove');throw Error('Splitter must not remove source or analysis content');}
 }
 const document=new Target(),window=new Target();document.documentElement=new Element('root');document.body=new Element('body');document.body.dataset={sourceId:'retained_source',sourceVersion:'7',sourceSha256:'a'.repeat(64)};document.activeElement=null;
 const layout=new Element('codeLayout'),separator=new Element('codeAnalysisSplitter'),panel=new Element('codeAnalysis'),resetButton=new Element('resetAnalysisLayout'),editor=new Element('codeSurface');
 separator.hidden=true;panel.hidden=true;separator.setAttribute('role','separator');separator.setAttribute('aria-orientation','vertical');separator.setAttribute('tabindex','0');separator.setAttribute('aria-label','Analysis panel width');resetButton.textContent='Reset layout';
 panel.dataset={analysisState:'complete',foldedNode:'exact_fold',comparisonVersion:'7'};panel.textContent='EXACT analysis result';panel.children=[Object.freeze({id:'retained-analysis-child'})];editor.textContent='def retained_source():\n    return 7';editor.dataset={selectionFrom:'4',selectionTo:'19',draftVersion:'7'};
 layout.children=[editor,separator,panel];for(const element of [layout,separator,panel,resetButton,editor])element.ownerDocument=document;separator.parentElement=panel.parentElement=editor.parentElement=layout;
 const elements=new Map([layout,separator,panel,resetButton,editor].map(element=>[element.id,element]));document.getElementById=id=>elements.get(id)??null;document.createElement=()=>{forbidden.push('createElement');throw Error('Splitter must not mount a component');};
 const requestAnimationFrame=callback=>{const id=++nextFrame;frames.set(id,callback);return id;},cancelAnimationFrame=id=>frames.delete(id);
 class ResizeObserver {
  constructor(callback){this.callback=callback;this.targets=new Set();this.disconnected=false;observers.push(this);}
  observe(target){this.targets.add(target);}
  unobserve(target){this.targets.delete(target);}
  disconnect(){this.disconnected=true;this.targets.clear();}
 }
 const getComputedStyle=element=>({getPropertyValue:name=>element.style.getPropertyValue(name),width:element.clientWidth+'px',display:element.hidden?'none':'grid',direction:'ltr'});
 Object.assign(window,{document,Element,HTMLElement:Element,ResizeObserver,requestAnimationFrame,cancelAnimationFrame,getComputedStyle,innerWidth:1600});
 for(const name of ['sirenSourceAnalysis','sirenSourceEdit','sirenCodeEditor','sirenDesktop','localStorage'])Object.defineProperty(window,name,{get(){forbidden.push(name);throw Error('Splitter must not access editor, source, bridge or persistence');}});
 const options={layout,separator,panel,resetButton};
 const context={window,document,Element,HTMLElement:Element,ResizeObserver,requestAnimationFrame,cancelAnimationFrame,getComputedStyle,console};
 new Script(script,{filename:'desktop/src/ui/code/split.js'}).runInNewContext(context,{timeout:250});
 assert.equal(typeof window.SirenCodeSplit?.create,'function');const api=window.SirenCodeSplit.create(options);
 function flush(){for(let n=0;frames.size&&n<10;n++){const work=[...frames.values()];frames.clear();for(const callback of work)callback(n*16);}assert.equal(frames.size,0,'UI update must settle finitely');}
 function emit(target,type,values={}){
  const event={type,target,currentTarget:null,defaultPrevented:false,propagationStopped:false,button:0,buttons:1,pointerId:9,isPrimary:true,pointerType:'mouse',clientX:700,shiftKey:false,ctrlKey:false,metaKey:false,altKey:false,...values,preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.propagationStopped=true;}};
  const path=[target];if(target!==window&&target!==document){for(let parent=target.parentElement;parent;parent=parent.parentElement)path.push(parent);path.push(document,window);}else if(target===document)path.push(window);
  for(const current of path){current.deliver(event);if(event.propagationStopped)break;}flush();return event;
 }
 function show(value=true){panel.hidden=!value;api.setVisible(value);flush();}
 function resize(width){geometry.width=width;for(const observer of observers)if(!observer.disconnected&&observer.targets.has(layout))observer.callback([{target:layout,contentRect:layout.getBoundingClientRect()}],observer);emit(window,'resize');flush();}
 const width=()=>{const value=layout.style.getPropertyValue('--code-analysis-width');assert.match(value,/^\d+(?:\.\d+)?px$/,'analysis width must be a finite nonnegative pixel value');return Number.parseFloat(value);};
 const key=(name,extra={})=>emit(separator,'keydown',{key:name,...extra});
 const down=(x=700,extra={})=>emit(separator,'pointerdown',{clientX:x,...extra});
 const move=(x,extra={})=>emit(separator,'pointermove',{clientX:x,...extra});
 const up=(x=700,extra={})=>emit(separator,'pointerup',{clientX:x,buttons:0,...extra});
 const aria=(min,max)=>{close(Number(separator.getAttribute('aria-valuemin')),min,1);close(Number(separator.getAttribute('aria-valuemax')),max,1);close(Number(separator.getAttribute('aria-valuenow')),width(),1);const text=separator.getAttribute('aria-valuetext');assert(text&&/pixel|px/i.test(text));const described=Number.parseFloat(text.match(/\d+(?:\.\d+)?/)?.[0]);close(described,width(),1);};
 flush();return {window,document,layout,separator,panel,resetButton,editor,api,options,geometry,observers,captures,releases,forbidden,flush,emit,show,resize,width,key,down,move,up,aria};
}

test('UIR-3 whole standalone splitter module exists and exposes its frozen controller API',()=>{
 assert.equal(typeof script,'string','ABSENCE RED: proposed desktop/src/ui/code/split.js does not exist; behavior is unexecuted');
 const f=fixture();assert.equal(Object.isFrozen(f.api),true);assert.deepEqual(Object.keys(f.api).sort(),['dispose','pause','resume','setVisible']);for(const name of Object.keys(f.api))assert.equal(typeof f.api[name],'function');f.api.dispose();
});

test('native Code build source contains an accessible focusable vertical analysis separator',()=>{
 const tag=buildSource.match(/<[^>]+\bid=["']codeAnalysisSplitter["'][^>]*>/)?.[0];assert(tag,'ABSENCE RED: native Code markup has no analysis separator');
 assert.match(tag,/\brole=["']separator["']/);assert.match(tag,/\baria-orientation=["']vertical["']/);assert.match(tag,/\btabindex=["']0["']/);assert.match(tag,/\baria-label=["'][^"']+[^"']*["']/);
});

test('native Code build includes the splitter before analysis with an explicit analysis Reset layout control',()=>{
 assert(buildSource.includes('../src/ui/code/split.js'),'ABSENCE RED: native Code script composition does not include split.js');
 assert(buildSource.indexOf('../src/ui/code/split.js')<buildSource.indexOf('../src/ui/code/analysis.js'),'splitter must load before its analysis controller integration');
 assert.match(analysisSource,/make\(["']button["'],\s*["']Reset layout["'],\s*["']resetAnalysisLayout["']\)/);
});

behavior('initial analysis width uses layout geometry with meaningful synchronized ARIA values',()=>{
 const f=fixture();try{f.show();close(f.width(),336);f.aria(160,765.7);assert.equal(f.separator.hidden,false);assert.equal(f.separator.getAttribute('role'),'separator');assert.equal(f.separator.getAttribute('aria-orientation'),'vertical');}finally{f.api.dispose();}
});

behavior('primary drag captures one pointer and moving left grows the right-hand analysis panel',()=>{
 const f=fixture();try{
  f.show();const initial=f.width();f.down(700,{button:2});f.move(600);close(f.width(),initial);assert.equal(f.captures.length,0);
  f.down(700,{isPrimary:false});f.move(600);close(f.width(),initial);assert.equal(f.captures.length,0);
  assert.equal(f.down(700).defaultPrevented,true);assert.equal(f.separator.hasPointerCapture(9),true);
  f.move(650);close(f.width(),initial+50);f.move(500,{pointerId:17});close(f.width(),initial+50);
  f.down(500,{pointerId:17});assert.deepEqual(f.captures,[9]);f.up(650);assert.equal(f.separator.hasPointerCapture(9),false);assert(f.releases.includes(9));
  f.move(400);close(f.width(),initial+50);f.aria(160,765.7);
 }finally{f.api.dispose();}
});

behavior('drag extremes clamp within editor-preserving minimum and maximum bounds',()=>{
 const f=fixture();try{f.show();f.down();f.move(-10000);assert(f.width()<=765.7&&f.width()>=764.7);f.up();f.down();f.move(10000);close(f.width(),160);f.up();f.aria(160,765.7);}finally{f.api.dispose();}
});

behavior('Left and Right use 16 pixels, Shift uses 64, and Home/End reach bounds',()=>{
 const f=fixture();try{
  f.show();assert.equal(f.key('ArrowLeft').defaultPrevented,true);close(f.width(),352);f.key('ArrowRight');close(f.width(),336);
  f.key('ArrowLeft',{shiftKey:true});close(f.width(),400);f.key('ArrowRight',{shiftKey:true});close(f.width(),336);
  assert.equal(f.key('a').defaultPrevented,false);close(f.width(),336);f.key('Home');close(f.width(),160);f.key('End');assert(f.width()<=765.7&&f.width()>=764.7);f.aria(160,765.7);
 }finally{f.api.dispose();}
});

behavior('Enter, double-click and Reset layout independently restore the current layout default',()=>{
 const f=fixture(1000);try{
  f.show();close(f.width(),280);f.key('End');assert.equal(f.key('Enter').defaultPrevented,true);close(f.width(),280);
  f.key('Home');f.emit(f.separator,'dblclick');close(f.width(),280);f.key('End');f.emit(f.resetButton,'click');close(f.width(),280);f.aria(160,635.7);
 }finally{f.api.dispose();}
});

behavior('Escape cancels an active drag, restores its initial width and releases capture',()=>{
 const f=fixture();try{
  f.show();f.down();f.move(620);close(f.width(),416);f.key('Escape');close(f.width(),336);assert.equal(f.separator.hasPointerCapture(9),false);
  f.move(500);f.up(500);close(f.width(),336);f.key('ArrowLeft');f.key('Escape');close(f.width(),352);
 }finally{f.api.dispose();}
});

behavior('hidden analysis releases capture and ignores mouse, keyboard and reset until shown',()=>{
 const f=fixture();try{
  f.show();f.down();f.move(660);f.show(false);assert.equal(f.separator.hidden,true);assert.equal(f.separator.hasPointerCapture(9),false);const hidden=f.width();
  f.move(400);f.up();f.down();f.key('ArrowLeft');f.key('Enter');f.emit(f.separator,'dblclick');f.emit(f.resetButton,'click');close(f.width(),hidden);
  f.show();f.key('ArrowLeft');close(f.width(),hidden+16);assert.equal(f.separator.hidden,false);
 }finally{f.api.dispose();}
});

behavior('pause releases capture and ignores gestures while resume restores only a visible controller',()=>{
 const f=fixture();try{
  f.show();f.down();f.move(660);f.api.pause();assert.equal(f.separator.hasPointerCapture(9),false);const paused=f.width();
  f.move(300);f.up();f.down();f.key('ArrowLeft');f.emit(f.resetButton,'click');close(f.width(),paused);
  f.api.resume();f.key('ArrowLeft');close(f.width(),paused+16);f.show(false);f.api.pause();f.api.resume();const hidden=f.width();f.key('ArrowLeft');close(f.width(),hidden);
 }finally{f.api.dispose();}
});

behavior('pointer cancellation and lost capture cannot leave a stale drag accepting more movement',()=>{
 const f=fixture();try{
  f.show();f.down();f.move(650);f.emit(f.separator,'pointercancel');assert.equal(f.separator.hasPointerCapture(9),false);const cancelled=f.width();f.move(500);close(f.width(),cancelled);
  f.down();f.move(680);f.separator.capture.delete(9);f.emit(f.separator,'lostpointercapture');const lost=f.width();f.move(500);close(f.width(),lost);f.up();
  f.down();f.move(690);f.up();close(f.width(),lost+10);
 }finally{f.api.dispose();}
});

behavior('element resize reclamps safely down to narrow and zero-width geometry and reset uses fresh bounds',()=>{
 const f=fixture();try{
  f.show();f.key('End');for(const [layoutWidth,min,max]of [[500,160,238],[300,38,38],[240,0,0],[22,0,0],[0,0,0]]){f.resize(layoutWidth);assert(f.width()>=min&&f.width()<=max,`analysis must fit layout ${layoutWidth}`);f.aria(min,max);}
  f.resize(1200);assert(f.width()>=160&&f.width()<=765.7);f.emit(f.resetButton,'click');close(f.width(),336);f.aria(160,765.7);
 }finally{f.api.dispose();}
});

behavior('dispose releases pointer capture and permanently ignores events, resize and later resume',()=>{
 const f=fixture();f.show();f.down();f.move(650);f.api.dispose();assert.equal(f.separator.hasPointerCapture(9),false);const disposed=f.width();
 f.move(200);f.up();f.down();f.key('ArrowLeft');f.emit(f.resetButton,'click');f.resize(500);f.api.resume();f.api.setVisible(true);f.key('End');close(f.width(),disposed);
 for(const observer of f.observers)assert.equal(observer.disconnected,true);f.api.dispose();
});

behavior('layout gestures preserve analysis/fold/comparison and source/selection sentinels without any mount or bridge access',()=>{
 const f=fixture();try{
  const retained=JSON.stringify({analysis:f.panel.dataset,text:f.panel.textContent,children:f.panel.children,source:f.editor.textContent,selection:f.editor.dataset,identity:f.document.body.dataset});
  f.show();for(let n=0;n<12;n++){f.down();f.move(690-n);f.up();f.key('ArrowLeft');f.key('ArrowRight');}f.emit(f.resetButton,'click');f.resize(1000);f.api.pause();f.api.resume();
  assert.equal(JSON.stringify({analysis:f.panel.dataset,text:f.panel.textContent,children:f.panel.children,source:f.editor.textContent,selection:f.editor.dataset,identity:f.document.body.dataset}),retained);assert.deepEqual(f.forbidden,[]);
 }finally{f.api.dispose();}
});

behavior('disposing then recreating a controller does not leave duplicate keyboard or pointer handlers',()=>{
 const f=fixture();f.show();f.api.dispose();const next=f.window.SirenCodeSplit.create(f.options);try{
  f.panel.hidden=false;next.setVisible(true);f.flush();f.emit(f.resetButton,'click');const initial=f.width();f.key('ArrowLeft');close(f.width(),initial+16);
  const captures=f.captures.length;f.down();assert.equal(f.captures.length,captures+1);f.move(680);f.up();close(f.width(),initial+36);
 }finally{next.dispose();}
});

behavior('Escape cancellation restores responsive default mode while preserving an explicit width preference',()=>{
 let responsiveWidth;
 const responsive=fixture();try{
  responsive.show();close(responsive.width(),336);responsive.down();responsive.move(620);close(responsive.width(),416);
  responsive.key('Escape');close(responsive.width(),336);assert.equal(responsive.separator.hasPointerCapture(9),false);
  responsive.resize(1000);responsiveWidth=responsive.width();
 }finally{responsive.api.dispose();}
 const custom=fixture();try{
  custom.show();custom.key('ArrowLeft');close(custom.width(),352);custom.down();custom.move(620);close(custom.width(),432);
  custom.key('Escape');close(custom.width(),352);assert.equal(custom.separator.hasPointerCapture(9),false);
  custom.resize(1000);close(custom.width(),352);
 }finally{custom.api.dispose();}
 close(responsiveWidth,280);
});

behavior('pointercancel restores responsive default mode while preserving an explicit width preference',()=>{
 let responsiveWidth;
 const responsive=fixture();try{
  responsive.show();close(responsive.width(),336);responsive.down();responsive.move(620);close(responsive.width(),416);
  responsive.emit(responsive.separator,'pointercancel');close(responsive.width(),336);assert.equal(responsive.separator.hasPointerCapture(9),false);
  responsive.resize(1000);responsiveWidth=responsive.width();
 }finally{responsive.api.dispose();}
 const custom=fixture();try{
  custom.show();custom.key('ArrowLeft');close(custom.width(),352);custom.down();custom.move(620);close(custom.width(),432);
  custom.emit(custom.separator,'pointercancel');close(custom.width(),352);assert.equal(custom.separator.hasPointerCapture(9),false);
  custom.resize(1000);close(custom.width(),352);
 }finally{custom.api.dispose();}
 close(responsiveWidth,280);
});
