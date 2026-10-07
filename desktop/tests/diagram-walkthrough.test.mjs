import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const code=await readFile(new URL('../src/ui/diagram/walkthrough.js',import.meta.url),'utf8').catch(e=>{if(e.code!=='ENOENT')throw e;return '';});
function fixture(){
 class Element{
  children=[];listeners={};attrs={};style={};hidden=false;disabled=false;textContent='';tagName='BUTTON';
  append(...items){for(const item of items){item.parent=this;this.children.push(item);}}
  replaceChildren(...items){this.children=[];this.append(...items);}
  addEventListener(k,fn){this.listeners[k]=fn;}removeEventListener(k,fn){if(this.listeners[k]===fn)delete this.listeners[k];}
  setAttribute(k,v){this.attrs[k]=v;}contains(n){return n===this||this.children.some(c=>c.contains(n));}
  focus(){this.focused=true;}getBoundingClientRect(){return this.rect;}
 }
 const window={},document={createElement:()=>new Element()};vm.runInNewContext(code,{window,document});assert.equal(typeof window.SirenNativeDiagramWalkthrough?.create,'function');
 const host=new Element(),overlay=new Element(),viewport=new Element();viewport.rect={left:20,top:30,width:400,height:300};Object.assign(viewport,{offsetWidth:400,offsetHeight:300,clientWidth:398,clientHeight:298,clientLeft:1,clientTop:1});
 const svg={isConnected:true,contains:g=>g.owner===svg},focus=[],overview=[];let enabled=true;
 const view=window.SirenNativeDiagramWalkthrough.create({host,overlay,viewport,enabled:()=>enabled,onFocus:b=>focus.push(b),onOverview:()=>overview.push(true)});
 const field=id=>host.children.find(c=>c.id===id),group=(label,x=100)=>Object.freeze({isConnected:true,owner:svg,textContent:label,getBoundingClientRect:()=>({left:x,top:80,width:40,height:30})});
 const event=(key,target=field('diagramWalkthroughNext'),extra={})=>({key,target,prevented:false,preventDefault(){this.prevented=true;},...extra});
 return{view,host,overlay,viewport,svg,field,group,focus,overview,event,document,enable:v=>enabled=v};
}
test('semantic multi-group nodes count once, traverse locally and never mutate SVG/source fields',()=>{
 const f=fixture(),a=f.group('Start'),b=f.group('Second',220),duplicate=f.group('Start copy',145),source=Object.freeze({source:'flowchart TD\nA-->B',nodeStyles:Object.freeze({A:Object.freeze({fill:'#ff3366'})})}),before=JSON.stringify(source);
 f.view.bind(f.svg,[{id:'A',groups:[a,duplicate]},{id:'A',groups:[a]},{id:'B',groups:[b]}]);assert.equal(f.view.getState().count,2);assert.equal(f.field('diagramWalkthroughStart').hidden,false);assert.equal(f.view.start(),true);assert.equal(f.view.getState().index,0);assert.equal(f.focus.length,1);assert.equal(f.focus[0].width,85);assert.equal(f.overlay.hidden,false);assert.equal(f.overlay.style.left,'79px');assert.equal(f.overlay.style.width,'85px');assert.equal(f.field('diagramWalkthroughPrevious').disabled,true);
 f.field('diagramWalkthroughNext').listeners.click();assert.equal(f.view.getState().index,1);assert.equal(f.field('diagramWalkthroughNext').disabled,true);assert.equal(f.view.step(1),false);assert.equal(f.view.step(-1),true);f.field('diagramWalkthroughOverview').listeners.click();assert.equal(f.view.getState().active,false);assert.equal(f.overlay.hidden,true);assert.equal(f.overview.length,1);assert.equal(JSON.stringify(source),before);
});
test('admission, captions and geometry are bounded and disconnected or foreign groups are refused',()=>{
 const f=fixture(),rows=Array.from({length:250},(_,i)=>({id:'N'+i,groups:[f.group('\u202e'+('x'.repeat(500)))]}));Object.defineProperty(rows,250,{get(){throw Error('unbounded targets');}});f.view.bind(f.svg,rows);assert.equal(f.view.getState().count,250);f.view.start();assert.ok(f.view.getState().label.length<=160);assert.equal(f.view.getState().label.includes('\u202e'),false);
 const groups=Array.from({length:8},()=>f.group('Admitted'));Object.defineProperty(groups,8,{get(){throw Error('unbounded groups');}});f.view.bind(f.svg,[{id:'A',groups},{id:'B',groups:[{isConnected:false}]},{id:'C',groups:[{isConnected:true,owner:{}}]}]);assert.equal(f.view.getState().count,1);assert.equal(f.view.start(),true);
 f.view.bind(f.svg,[{id:'A',groups:[Object.freeze({isConnected:true,owner:f.svg,textContent:'Invalid',getBoundingClientRect:()=>({left:NaN,top:0,width:4,height:5})})]}]);assert.equal(f.view.start(),false);assert.equal(f.overlay.hidden,true);
});
test('invalidated, paused, hidden and disposed views cannot navigate or revive stale targets',()=>{
 const f=fixture(),targets=[{id:'A',groups:[f.group('A')]}];f.view.bind(f.svg,targets);f.view.start();const old=f.field('diagramWalkthroughNext').listeners.click;f.view.invalidate();old();assert.equal(f.view.getState().count,0);assert.equal(f.overlay.hidden,true);assert.equal(f.view.start(),false);
 f.view.pause();f.view.bind(f.svg,targets);assert.equal(f.view.start(),false);f.view.resume();assert.equal(f.view.start(),false);f.view.bind(f.svg,targets);f.enable(false);assert.equal(f.view.start(),false);f.enable(true);f.view.bind(f.svg,targets);f.svg.isConnected=false;assert.equal(f.view.start(),false);f.view.dispose();f.view.bind(f.svg,targets);assert.equal(f.host.children.length,0);assert.equal(f.view.start(),false);
});
test('only focused walkthrough controls own navigation keys; editor/composition/modifiers remain untouched',()=>{
 const f=fixture();f.view.bind(f.svg,[{id:'A',groups:[f.group('A')]},{id:'B',groups:[f.group('B')]}]);f.view.start();const handler=f.host.listeners.keydown;
 for(const extra of [{isComposing:true},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true},{defaultPrevented:true},{target:{tagName:'TEXTAREA'}}]){const e=f.event('ArrowRight',undefined,extra);handler(e);assert.equal(e.prevented,false);assert.equal(f.view.getState().index,0);}
 let e=f.event('ArrowRight');handler(e);assert.equal(e.prevented,true);assert.equal(f.view.getState().index,1);e=f.event('ArrowLeft');handler(e);assert.equal(f.view.getState().index,0);e=f.event('Escape');handler(e);assert.equal(f.view.getState().active,false);assert.equal(f.overview.length,1);
});
test('overlay follows actual viewport scaling and geometry without changing node attributes',()=>{
 const f=fixture();Object.assign(f.viewport,{offsetWidth:200,offsetHeight:150,clientWidth:198,clientHeight:148});f.view.bind(f.svg,[{id:'A',groups:[f.group('A')]}]);f.view.start();assert.equal(f.overlay.style.left,'39px');assert.equal(f.overlay.style.top,'24px');assert.equal(f.overlay.style.width,'20px');f.viewport.rect.left=40;f.view.updateGeometry();assert.equal(f.overlay.style.left,'29px');f.view.overview();f.view.updateGeometry();assert.equal(f.overlay.hidden,true);
});
test('pointer browsing preserves focused valid pending form input instead of causing blur-change commits',()=>{
 const f=fixture();f.view.bind(f.svg,[{id:'A',groups:[f.group('A')]},{id:'B',groups:[f.group('B')]}]);const input={tagName:'INPUT',value:'20'};f.document.activeElement=input;const e=f.event('',f.field('diagramWalkthroughStart'),{button:0});assert.equal(typeof f.host.listeners.pointerdown,'function');f.host.listeners.pointerdown(e);assert.equal(e.prevented,true);f.view.start();assert.equal(f.field('diagramWalkthroughOverview').focused,undefined);f.view.step(1);f.view.overview();assert.equal(f.field('diagramWalkthroughStart').focused,undefined);assert.equal(f.document.activeElement,input);assert.equal(input.value,'20');
});
test('actual SVG outer rows preserve wrapped Unicode words and inline spans remain a single word',()=>{
 const f=fixture(),rows=[{textContent:'Început'},{textContent:'Ș😀'},{textContent:'Inline'}],text={textContent:'ÎnceputȘ😀Inline',querySelectorAll:()=>rows},group={...f.group('ÎnceputȘ😀Inline'),querySelectorAll:()=>[text]};
 f.view.bind(f.svg,[{id:'A',groups:[group]}]);f.view.start();assert.equal(f.view.getState().label,'Început Ș😀 Inline');
 const plain={...f.group('FirstSecond'),querySelectorAll:()=>[{textContent:'First',querySelectorAll:()=>[]},{textContent:'Second',querySelectorAll:()=>[]}]};f.view.bind(f.svg,[{id:'B',groups:[plain]}]);f.view.start();assert.equal(f.view.getState().label,'First Second');
 const many=Array.from({length:32},(_,i)=>({textContent:'word'+i}));Object.defineProperty(many,32,{get(){throw Error('unbounded SVG lines');}});const texts=Array.from({length:16},()=>({textContent:'ignored whole label',querySelectorAll:()=>many}));Object.defineProperty(texts,16,{get(){throw Error('unbounded SVG text');}});f.view.bind(f.svg,[{id:'C',groups:[{...f.group('fallback'),querySelectorAll:()=>texts}]}]);f.view.start();assert.ok(f.view.getState().label.startsWith('word0 word1'));assert.ok(f.view.getState().label.length<=160);
});
test('250-entry caption discloses the shown set rather than claiming the full diagram count',()=>{
 const f=fixture();f.view.bind(f.svg,Array.from({length:250},(_,i)=>({id:'A'+i,groups:[f.group('Node')]})));assert.match(f.field('diagramWalkthroughStart').textContent,/250 blocks shown/);assert.match(f.field('diagramWalkthroughStart').title,/250/);
});
