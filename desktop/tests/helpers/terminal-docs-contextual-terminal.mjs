// Preparation-only desired behavior. Actual controls/client/view; inert DOM and emulator.
import test from 'node:test';import assert from 'node:assert/strict';
import {createTerminalControls} from '../../src/ui/terminal/controls.js';
import {HELP_ARTICLES} from '../../src/help/catalog.mjs';import {createHelpResolver} from '../../src/help/resolve.mjs';
const resolver=createHelpResolver(HELP_ARTICLES),tick=async()=>{for(let i=0;i<30;i++)await Promise.resolve();},defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
class Element{
 constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.listeners=new Map();this.style={};this.dataset={};this.textContent='';this.value='';this.disabled=false;this.hidden=false;}
 append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}replaceChildren(...nodes){for(const n of this.children)n.parentNode=null;this.children=[];this.append(...nodes);}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
 get isConnected(){return this.parentNode?this.parentNode.isConnected:this===this.ownerDocument.root;}
 setAttribute(k,v){this.attributes[k]=String(v);}addEventListener(k,f){this.listeners.set(k,f);}removeEventListener(k,f){if(this.listeners.get(k)===f)this.listeners.delete(k);}focus(){this.ownerDocument.activeElement=this;}click(){if(!this.disabled)this.listeners.get('click')?.({target:this,preventDefault(){}});}
}
const info=()=>({sessionId:'session_a',projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Owned',state:'running',exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_a'});
function fixture({dispatch,explain=true,available=true}={}){
 const document={createElement:tag=>new Element(tag,document)},container=new Element('main',document),calls=[],explained=[],emulators=[],listeners=new Map();let operation=0;
 const bridge=Object.fromEntries(['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'].map(name=>['terminal'+name,p=>{
  calls.push({name,p});assert.ok(calls.length<64,'Finite bridge');const value=name==='PickCwd'?{cwdId:'cwd_a',projectId:'project_a',displayPath:'C:\\Owned'}:name==='ListProfiles'?[{profileId:'powershell',label:'PowerShell',available:true}]:name==='List'?[info()]:name==='Attach'?{session:info(),leaseId:'lease_a',generation:1,firstSequence:0,nextSequence:0}:name==='Input'?{inputSequence:p.inputSequence,accepted:true}:name==='Ack'?{acknowledged:true}:name==='Detach'?{detached:true}:{};
  return dispatch?.(name,p,value)??Promise.resolve({ok:true,value,operationId:p.operationId});
 }]));
 for(const name of ['Data','Gap','State'])bridge['onTerminal'+name]=f=>{const set=listeners.get(name)??new Set();set.add(f);listeners.set(name,set);return()=>set.delete(f);};
 const terminalFactory=options=>{const emulator={options,open(){},write(data,done){done();},clear(){},dispose(){},onData(fn){this.input=fn;return{dispose:()=>this.input=null};},onResize(fn){this.resize=fn;return{dispose:()=>this.resize=null};}};emulators.push(emulator);return emulator;};
 document.root=container;const controls=createTerminalControls({container,bridge,epoch:4,projectId:'project_a',available,terminalFactory,operationId:()=>`help_${++operation}`,...(explain===true?{onExplain:identity=>{explained.push(identity);return true;}}:explain===false?{}:{onExplain:explain})});
 const nodes=()=>{const all=[],visit=n=>{all.push(n);for(const c of n.children)visit(c);};visit(container);return all;};
 const action=()=>nodes().find(n=>n.dataset.action==='explain-error');
 return{controls,calls,explained,emulators,nodes,action,async paste(value){const output=nodes().find(n=>n.attributes['aria-label']==='Terminal output');let prevented=0,stopped=0;output.listeners.get('paste')({cancelable:true,defaultPrevented:false,preventDefault(){prevented++;},stopImmediatePropagation(){stopped++;},clipboardData:{getData:format=>{assert.equal(format,'text/plain');return value;}}});await controls.drain();assert.equal(prevented,1);assert.equal(stopped,1);},async end(){controls.dispose();await controls.drain();}};
}
function expectIdentity(s,operation,code,article){const button=s.action();assert.ok(button,'owned Explain error action must exist');assert.equal(s.explained.length,0,'no implicit Help open');button.click();assert.deepEqual(s.explained,[{namespace:'terminal',operation,code}]);assert.deepEqual(Object.keys(s.explained[0]).sort(),['code','namespace','operation']);assert.equal(resolver.resolve(s.explained[0]).id,article);}


export {fixture};
