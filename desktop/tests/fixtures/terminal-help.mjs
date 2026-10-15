// Reuses independently authored inert Terminal fixture for actual local receipts.
// Reuses original independently authored reviewer fixture; no original file edited.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTerminalControls} from '../../src/ui/terminal/controls.js';
import {createTerminalView} from '../../src/ui/terminal/view.js';
const turn=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
function held(){let resolve;return {promise:new Promise(r=>resolve=r),resolve};}
const session=id=>({sessionId:id,projectId:'project_a',profileId:'powershell',cwdDisplay:'C:\\Project',state:'running',exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_a'});
function setup({end=3,direct=false,notify=()=>{},ack=null,detachReply=null}={}){
 const calls=[],nodes=[],emulators=[],listeners={Data:new Set(),Gap:new Set(),State:new Set()};let operation=0,lease=0;
 const document={createElement:tag=>new Element(tag)};
 class Element{
  constructor(tag){this.tagName=tag;this.ownerDocument=document;this.children=[];this.dataset={};this.style={};this.attrs={};this.events={};this.textContent='';this.value='';this.disabled=false;nodes.push(this);}
  append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}
  setAttribute(k,v){this.attrs[k]=String(v);}addEventListener(k,f){this.events[k]=f;}removeEventListener(k,f){if(this.events[k]===f)delete this.events[k];}focus(){}
 }
 const container=new Element('main');
 const bridge={};
 for(const method of ['PickCwd','ListProfiles','Create','List','Attach','Input','Resize','Ack','Detach','Stop'])bridge['terminal'+method]=request=>{
  calls.push({method,request});assert.ok(calls.length<80,'bounded reviewer bridge');
  if(method==='Ack'&&ack)return ack(request);
  if(method==='Detach'&&detachReply)return detachReply(request);
  const value=method==='ListProfiles'?[{profileId:'powershell',label:'PowerShell',available:true}]:method==='List'?[session('session_a'),session('session_b')]:method==='Attach'?{session:session(request.sessionId),leaseId:'lease_'+(++lease),generation:lease,firstSequence:0,nextSequence:request.sessionId==='session_a'?end:0}:method==='Ack'?{acknowledged:true}:method==='Detach'?{detached:true}:method==='Resize'?{resized:true}:method==='Input'?{inputSequence:request.inputSequence,accepted:true}:{};
  return Promise.resolve({ok:true,value,operationId:request.operationId});
 };
 for(const kind of Object.keys(listeners))bridge['onTerminal'+kind]=fn=>{listeners[kind].add(fn);return()=>listeners[kind].delete(fn);};
 const terminalFactory=options=>{const emulator={options,callbacks:[],clears:0,disposed:0,open(){},write(text,done){this.callbacks.push(done);},clear(){this.clears++;},dispose(){this.disposed++;},onData(fn){this.data=fn;return {dispose(){}};},onResize(fn){this.resize=fn;return {dispose(){}};}};emulators.push(emulator);return emulator;};
 const config={container,bridge,epoch:4,terminalFactory,operationId:()=>`review_${++operation}`};
 const api=direct?createTerminalView({...config,onDisplayState:notify}):createTerminalControls({...config,projectId:'project_a',available:true});
 const find=name=>nodes.find(n=>n.dataset.action===name);
 return {api,calls,nodes,container,emulators,find,status:()=>nodes.find(n=>n.attrs.role==='status')?.textContent,async attach(id='session_a'){if(!direct)assert.equal((await api.refresh()).ok,true);return direct?api.attach(id):api.selectSession(id);},output(data='abc',sequence=0){for(const callback of listeners.Data)callback({epoch:4,sessionId:'session_a',leaseId:'lease_1',generation:1,sequence,utf8Bytes:new TextEncoder().encode(data).length,data});},async close(){api.dispose();await api.drain();}};
}
const count=(s,method)=>s.calls.filter(c=>c.method===method).length;


export {setup,held,turn,count};
