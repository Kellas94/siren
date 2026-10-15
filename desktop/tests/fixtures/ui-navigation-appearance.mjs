// Live-source regression fixture; path adaptation by /root from the sealed owner fixture.
// No Electron/native/browser/network/Git/product mutation is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {invokeShell} from '../../src/appearance/ipc.mjs';
const load=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const homeSource=load('src/ui/workspace/home.js'),syncSource=load('src/ui/shared/appearance-sync.js'),shellSource=load('src/ui/shared/shell.js');
const hold=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tick=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
class Element{
 constructor(tag,doc){Object.assign(this,{tagName:tag.toUpperCase(),doc,children:[],parent:null,dataset:{},style:{setProperty(k,v){this[k]=v;}},attributes:{},className:'',value:'',disabled:false,hidden:false,open:false,ownText:'',handlers:new Map()});this.classList={add:(...v)=>{this.className+=' '+v.join(' ');}};}
 append(...values){for(const v of values){v.remove();v.parent=this;this.children.push(v);}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(v=>v!==this);this.parent=null;}
 replaceChildren(...values){for(const v of this.children)v.parent=null;this.children=[];this.ownText='';this.append(...values);}
 set textContent(v){this.replaceChildren();this.ownText=String(v);}get textContent(){return this.ownText+this.children.map(v=>v.textContent).join('');}
 setAttribute(k,v){this.attributes[k]=String(v);}
 addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(fn);}
 removeEventListener(type,fn){this.handlers.set(type,(this.handlers.get(type)??[]).filter(v=>v!==fn));}
 dispatchEvent(event){event.target??=this;for(const fn of [...(this.handlers.get(event.type)??[])])fn(event);return true;}
 click(){if(!this.disabled)this.dispatchEvent({type:'click',preventDefault(){}});}
 focus(){this.doc.activeElement=this;}showModal(){this.open=true;}close(){if(this.open){this.open=false;this.dispatchEvent({type:'close'});}}
 insertBefore(node,before){node.remove();node.parent=this;const index=this.children.indexOf(before);this.children.splice(index<0?this.children.length:index,0,node);}
 querySelectorAll(query){const selectors=query.split(',').map(v=>v.trim()),matches=node=>selectors.some(s=>s.startsWith('#')?node.id===s.slice(1):s.startsWith('.')?node.className.split(/\s+/).includes(s.slice(1)):node.tagName===s.toUpperCase()),out=[];for(const n of this.children){if(matches(n))out.push(n);out.push(...n.querySelectorAll(query));}return out;}
 querySelector(query){return this.querySelectorAll(query)[0]??null;}
}
function dom(role){const callbacks={},document={readyState:'complete',activeElement:null,createElement(tag){return new Element(tag,this);},getElementById(id){return this.documentElement.querySelector('#'+id);},addEventListener(type,fn){(callbacks[type]??=[]).push(fn);},dispatchEvent(e){for(const fn of callbacks[e.type]??[])fn(e);}};document.documentElement=new Element('html',document);document.body=new Element('body',document);document.body.dataset.role=role;document.documentElement.append(document.body);return{document,callbacks};}
function timers(){const timeouts=[],intervals=[];return{timeouts,intervals,setTimeout(fn,delay){timeouts.push({fn,delay,cancelled:false,fired:false});return timeouts.length;},clearTimeout(id){if(timeouts[id-1])timeouts[id-1].cancelled=true;},pending(){return timeouts.filter(t=>!t.cancelled&&!t.fired);},fire(t){t.fired=true;t.fn();},setInterval(fn,delay){intervals.push({fn,delay});return intervals.length;},clearInterval(){}};}
const state=id=>({mode:'normal',selectedProjectId:id,projectFormat:'desktop',projects:[{projectId:id,label:id,availability:'cached'}],continuation:null,views:[],capabilities:{diagrams:true,docs:true,code:true,present:true}});
async function homeFixture(initialRead=null){const{document}=dom('home'),clock=timers(),root=document.createElement('main');root.id='homeRoot';document.body.append(root);let project='project-a',read=initialRead,navigate;const catalogue=[];
 const bridge={getHomeState:()=>read?read.promise:Promise.resolve({ok:true,state:state(project)}),getCatalog:async request=>{catalogue.push({project,request:structuredClone(request)});return{ok:true,items:[],nextCursor:0,hasMore:false,total:0};},openModule:async()=>({ok:true}),onNavigate(fn){navigate=fn;return()=>{};}};
 const window={sirenDesktopBootstrap:{mode:'locked'},SirenModuleIcon(){},SirenHelpWorkspace:{cover(){},resume(){}}};vm.runInNewContext(homeSource,{window,document,location:{href:'siren://app/home.html'},queueMicrotask,...clock});const home=window.renderSirenHome({container:root,bridge,desktop:{},bootstrap:{mode:'normal'}});const ready=home.refresh();if(!initialRead)await ready;return{ready,window,document,clock,home,catalogue,navigate:surface=>navigate(surface),setProject(id){project=id;},setRead(d){read=d;}};}

export {homeFixture,hold,tick,load,vm};