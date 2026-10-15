import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
const code=await readFile(new URL('../../src/ui/docs/diagram-embeds.js',import.meta.url),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
const transferCode=await readFile(new URL('../../src/ui/diagram/docs-transfer.js',import.meta.url),'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
const tick=()=>new Promise(r=>setImmediate(r)),block=()=>({id:'embed-a',kind:'diagram-embed',diagramId:'flow-a',mode:'live',caption:'Saved flow',display:{height:320,fit:'contain'},snapshot:{sourceVersion:2,sourceHash:'a'.repeat(64)},status:'current',scope:'whole',nodeIds:[]});
function fixture(){
 const nodes=[],observers=[],calls=[],messages=[],changed=[];let context={version:'b'.repeat(64),dirty:false,readonly:false,blocks:[{id:'text-a',kind:'text',html:'<p>Context</p>'}]},answer,active;
 class Node{constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.listeners={};this.hidden=false;this.disabled=false;this.isConnected=true;this.scrollTop=91;this.value='';nodes.push(this);}append(...items){items.forEach(n=>{n.parent=this;this.children.push(n);});}setAttribute(k,v){this[k]=v;}addEventListener(k,v){this.listeners[k]=v;}removeEventListener(k){delete this.listeners[k];}emit(k='click',e={}){return this.listeners[k]?.(e);}replaceChildren(...items){this.children=[];this.append(...items);}remove(){this.isConnected=false;if(this.parent)this.parent.children=this.parent.children.filter(v=>v!==this);}focus(){active=this;}showModal(){this.open=true;}close(){this.open=false;this.emit('close');}get firstChild(){return this.children[0];}}
 const document={createElement:tag=>new Node(tag),body:new Node('body'),get activeElement(){return active;}},window={};class IntersectionObserver{constructor(fn){this.fn=fn;observers.push(this);}observe(node){this.node=node;}unobserve(){}disconnect(){this.dead=true;}}
 const api=Object.fromEntries(['listDocuments','sendToDocs','getProposal','listDiagrams','inspectSelection','preview','insert','readEmbed','setMode','update','openSource'].map(method=>[method,async p=>{calls.push({method,p:JSON.parse(JSON.stringify(p))});return typeof answer==='function'?answer(method,p):answer??{ok:true,block:block(),visual:{kind:'svg',base64:Buffer.from('<svg/>').toString('base64')}};}]));
 const realm=createContext({window,document,IntersectionObserver,crypto:{randomUUID:()=> '00000000-0000-4000-8000-000000000001'},setTimeout,clearTimeout,TextEncoder});runInContext(code+'\n'+transferCode,realm);assert.equal(typeof window.createDiagramEmbedView,'function','Missing diagram embed view');
 const view=window.createDiagramEmbedView({api,getContext:()=>context,onChanged:v=>changed.push(v),onStatus:v=>messages.push(v)});
 return {realm,window,api,view,nodes,calls,messages,changed,document,context:v=>context={...context,...v},answer:v=>answer=v,find:(action,id)=>nodes.find(n=>n.dataset.embedAction===action&&(!id||n.dataset.embedId===id)),intersect:id=>{const o=observers.find(v=>v.node.dataset.embedId===id);o.fn([{isIntersecting:true,target:o.node}]);},Node};
}

export {fixture,block,tick};
