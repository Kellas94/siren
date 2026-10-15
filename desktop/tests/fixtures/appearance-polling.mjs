// Original independent inert fixture; live-loader adaptation by /root.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=(kind,p)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
export const hold=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
export const flush=async()=>{for(let i=0;i<8;i++)await new Promise(setImmediate);};
export class Clock{
 constructor(){this.next=0;this.now=0;this.timers=new Map();this.history=[];this.setTimeout=(fn,delay)=>this.add(fn,delay,false);this.clearTimeout=id=>this.clear(id);this.setInterval=(fn,delay)=>this.add(fn,delay,true);this.clearInterval=id=>this.clear(id);}
 add(fn,delay,interval){const id=++this.next,t={id,fn,delay,due:this.now+delay,interval,cancelled:false};this.timers.set(id,t);this.history.push(t);return id;}
 clear(id){const t=this.timers.get(id);if(t)t.cancelled=true;this.timers.delete(id);}
 get pending(){return [...this.timers.values()].filter(t=>!t.interval);}
 fire(id,{stale=false}={}){const t=stale?this.history.find(t=>t.id===id):this.timers.get(id);if(!t)return false;if(!t.interval)this.timers.delete(id);else t.due+=t.delay;this.now=Math.max(this.now,t.due);t.fn();return true;}
 advance(ms){const target=this.now+ms;for(let bound=0;bound<10000;bound++){const next=[...this.timers.values()].filter(t=>t.due<=target).sort((a,b)=>a.due-b.due||a.id-b.id)[0];if(!next){this.now=target;return;}this.fire(next.id);}throw Error('Fixture runaway clock');}
 api(){return {setTimeout:this.setTimeout,clearTimeout:this.clearTimeout,setInterval:this.setInterval,clearInterval:this.clearInterval};}
}
export class Node{
 constructor(tag,doc){Object.assign(this,{tagName:tag.toUpperCase(),ownerDocument:doc,children:[],parentElement:null,dataset:{},attributes:{},handlers:new Map(),style:{setProperty(k,v){this[k]=String(v);}},className:'',value:'',hidden:false,disabled:false,open:false,ownText:''});this.classList={add:(...s)=>{this.className=[this.className,...s].join(' ');}};}
 append(...nodes){for(const n of nodes){n.remove();n.parentElement=this;this.children.push(n);}}
 remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
 replaceChildren(...nodes){for(const n of this.children)n.parentElement=null;this.children=[];this.ownText='';this.append(...nodes);}
 set textContent(value){this.replaceChildren();this.ownText=String(value);}get textContent(){return this.ownText+this.children.map(n=>n.textContent).join('');}
 setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k]??null;}
 addEventListener(type,fn){const list=this.handlers.get(type)??[];list.push(fn);this.handlers.set(type,list);}
 removeEventListener(type,fn){this.handlers.set(type,(this.handlers.get(type)??[]).filter(f=>f!==fn));}
 dispatchEvent(event){event.target??=this;for(const fn of [...(this.handlers.get(event.type)??[])])fn(event);return true;}
 click(){if(!this.disabled)this.dispatchEvent({type:'click',preventDefault(){}});}
 showModal(){this.open=true;}close(){if(this.open){this.open=false;this.dispatchEvent({type:'close'});}}
 focus(){this.ownerDocument.activeElement=this;}
 insertBefore(n,before){n.remove();n.parentElement=this;const index=this.children.indexOf(before);this.children.splice(index<0?this.children.length:index,0,n);}
 querySelectorAll(selector){const selectors=selector.split(',').map(s=>s.trim());const match=n=>selectors.some(s=>s[0]==='#'?n.id===s.slice(1):s[0]==='.'?n.className.split(/\s+/).includes(s.slice(1)):n.tagName===s.toUpperCase());const result=[];for(const n of this.children){if(match(n))result.push(n);result.push(...n.querySelectorAll(selector));}return result;}
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
}
export function dom(role){const listeners=new Map();const document={readyState:'complete',createElement(tag){return new Node(tag,this);},getElementById(id){return this.documentElement.querySelector('#'+id);},addEventListener(type,fn){const a=listeners.get(type)??[];a.push(fn);listeners.set(type,a);},dispatchEvent(event){for(const f of [...(listeners.get(event.type)??[])])f(event);}};document.documentElement=new Node('html',document);document.body=new Node('body',document);document.body.dataset.role=role;document.documentElement.append(document.body);return document;}
export const homeState=(id='project-a',extra={})=>({mode:'normal',selectedProjectId:id,projectFormat:'desktop',projects:id===null?[]:[{projectId:id,label:id,availability:'cached'}],continuation:null,views:[],capabilities:{diagrams:true,docs:true,code:true,present:true},...extra});
export async function homeFixture({kind='candidate',initial=true,initialState=homeState(),onFind=()=>{},onCatalog=()=>null}={}){
 const document=dom('home'),clock=new Clock(),root=document.createElement('main');root.id='homeRoot';document.body.append(root);
 const trace=[],reads=[],catalogReads=[];let state=initialState,read=null,navigate,invalidated,catalogChanged,subscribed=true;
 const bridge={getHomeState(){const deferred=read;reads.push({deferred});return deferred?.promise??Promise.resolve({ok:true,state});},getCatalog(request){const call={project:state.selectedProjectId,request:structuredClone(request)};catalogReads.push(call);trace.push({type:'catalog',...call});return onCatalog(call)??Promise.resolve({ok:true,items:[],hasMore:false,total:0,nextCursor:0});},openModule(request){trace.push({type:'module',project:state.selectedProjectId,request:structuredClone(request)});return Promise.resolve({ok:true});},onNavigate(fn){navigate=fn;return()=>{subscribed=false;};},onInvalidated(fn){invalidated=fn;return()=>{};},onCatalogChanged(fn){catalogChanged=fn;return()=>{};}};
 const window={sirenDesktopBootstrap:{mode:'locked'},SirenModuleIcon(){},SirenHelpWorkspace:{cover(){trace.push({type:'cover'});},resume(){trace.push({type:'resume'});}},SirenProjectSearch:{open(){trace.push({type:'find',project:state.selectedProjectId});onFind();}}};
 vm.runInNewContext(source(kind,'src/ui/workspace/home.js'),{window,document,location:{href:'siren://app/home.html'},queueMicrotask,...clock.api()},{filename:kind+'/home.js'});
 const home=window.renderSirenHome({container:root,bridge,desktop:{},bootstrap:{mode:'normal'}});
 const f={home,window,bridge,document,root,clock,trace,reads,catalogReads,navigate(surface){navigate(surface);},get subscribed(){return subscribed;},invalidate(){invalidated();},catalogChanged(){catalogChanged();},setRead(v){read=v;},setState(v){state=v;}};
 if(initial)await home.refresh();return f;
}
export function syncFixture({kind='candidate',get,set,apply,rejected,unavailable}={}){const window={};vm.runInNewContext(source(kind,'src/ui/shared/appearance-sync.js'),{window},{filename:kind+'/appearance-sync.js'});const readQueue=[],writeQueue=[],seen=[],refused=[],hidden=[];const sync=window.SirenAppearanceSync.create({get:get??(()=>{const d=hold();readQueue.push(d);return d.promise;}),set:set??(value=>{const d=hold();writeQueue.push({...d,value:structuredClone(value)});return d.promise;}),apply:apply??(value=>seen.push(structuredClone(value))),rejected:rejected??((value,context)=>refused.push({value:structuredClone(value),context})),unavailable:unavailable??(()=>hidden.push(true))});return {sync,readQueue,writeQueue,seen,refused,hidden};}
export function shellFixture({kind='candidate',systemDark=false,read=()=>{const d=hold();return d;}}={}){
 const document=dom('docs'),clock=new Clock(),events=[],reads=[],writes=[],windowEvents=new Map(),mediaHandlers=[],resumeHandlers=[],readyHandlers=[];
 const field=document.createElement('select');field.id='documentTheme';document.body.append(field);document.addEventListener('siren-appearance',event=>events.push(structuredClone(event.detail)));
 const media={matches:systemDark,addEventListener(_type,fn){mediaHandlers.push(fn);}};
 const window={SirenAppearancePalette:[{id:'light',name:'Light',mode:'light',colors:{'app-bg':'#fff'}},{id:'dark',name:'Dark',mode:'dark',colors:{'app-bg':'#000'}}],sirenShell:{getAppearance(){const d=read(reads.length);reads.push(d);return d.promise;},async setAppearance(value){writes.push(structuredClone(value));return {ok:true,theme:value.theme};}},addEventListener(type,fn){windowEvents.set(type,fn);},sirenViewControl:{onResume(fn){resumeHandlers.push(fn);return()=>resumeHandlers.splice(resumeHandlers.indexOf(fn),1);}},sirenWindow:{onReady(fn){readyHandlers.push(fn);return()=>readyHandlers.splice(readyHandlers.indexOf(fn),1);}}};
 class Event{constructor(type){this.type=type;}}class CustomEvent extends Event{constructor(type,{detail}){super(type);this.detail=detail;}}
 vm.runInNewContext(source(kind,'src/ui/shared/appearance-sync.js')+'\n'+source('shared','src/ui/shared/shell.js'),{window,document,location:{pathname:'/windows/docs.html'},matchMedia:()=>media,Event,CustomEvent,...clock.api()},{filename:kind+'/full-sync-and-shell.js'});
 return {window,document,clock,events,reads,writes,field,media,mediaHandlers,resumeHandlers,readyHandlers,pagehide(){windowEvents.get('pagehide')();}};
}
