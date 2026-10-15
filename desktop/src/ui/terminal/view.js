// SOURCE_ONLY candidate: injected xterm-compatible emulator, no product wiring.
// Main must separately revoke caller/lease authority on Lock/window destruction.
import {createTerminalClient} from './client.js';
import {createTerminalDisplayFilter} from './display-filter.js';
import {TERMINAL_LIMITS as limits,validateTerminalRequest} from '../../terminal/contracts.mjs';
import {validateTerminalEvent} from '../../terminal/events.mjs';
const encoder=new TextEncoder(),fail=code=>Object.freeze({ok:false,code}),pass=value=>Object.freeze({ok:true,value});
const id=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(v),uint=v=>Number.isSafeInteger(v)&&v>=0;
function own(value,keys){
 try{if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==keys.length)return null;const result=Object.create(null);for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;result[key]=d.value;}return result;}catch{return null;}
}
function attachment(value,epoch,sessionId){
 const v=own(value,['session','leaseId','generation','firstSequence','nextSequence']);if(!v||!id(v.leaseId)||!uint(v.generation)||v.generation<1||!uint(v.firstSequence)||!uint(v.nextSequence)||v.firstSequence>v.nextSequence)return null;
 const checked=validateTerminalEvent('terminalState',{epoch,session:v.session});return checked.ok&&checked.event.session.sessionId===sessionId?{...v,session:checked.event.session}:null;
}
const inputShape=data=>validateTerminalRequest('terminalInput',{operationId:'view_check',epoch:0,sessionId:'session',leaseId:'lease',generation:1,inputSequence:0,data}).ok;
const geometryShape=(cols,rows)=>validateTerminalRequest('terminalResize',{operationId:'view_check',epoch:0,sessionId:'session',leaseId:'lease',generation:1,cols,rows}).ok;
const sameGeometry=(a,b)=>!!a&&!!b&&a.cols===b.cols&&a.rows===b.rows;
export function createTerminalView({container,bridge,epoch,terminalFactory,operationId,reviewPaste=async()=>false,search=null,onDisplayState=()=>{},captureRawInput=null}){
 if(!container||typeof container.replaceChildren!=='function'||typeof terminalFactory!=='function'||typeof reviewPaste!=='function'||typeof onDisplayState!=='function')throw TypeError('Terminal view adapters required');
 let dispatchGuard=null;
 const mintOperationId=operationId??(()=>crypto.randomUUID());
 const client=createTerminalClient({bridge,epoch,operationId:()=>{const guard=dispatchGuard,value=mintOperationId();if(guard&&!guard())throw Error('VIEW_INACTIVE');return value;}});
 const pending=new Set();let current=null,disposed=false,lastCode=null,theme={},inputBytes=0,inputEntries=0,displayNotifying=false;
 const track=work=>{pending.add(work);work.then(()=>pending.delete(work),()=>pending.delete(work));return work;};
 const live=s=>!!s&&!disposed&&current===s&&!s.retired;
 const scope=s=>({sessionId:s.sessionId,leaseId:s.lease.leaseId,generation:s.lease.generation});
 function request(s,name,payload,retiredCleanup=false){
  const previous=dispatchGuard,lease=s.lease;
  // Preserve this invocation's guard across identity-factory reentry. Cleanup
  // may use the retired lease, but display/input requests need the live view.
  dispatchGuard=()=>retiredCleanup?s.lease===lease:live(s)&&s.lease===lease&&(!['input','resize'].includes(name)||ready(s)===null);
  try{return client[name](payload);}finally{dispatchGuard=previous;}
 }
 const ready=s=>!live(s)?'VIEW_INACTIVE':!s.lease?'ATTACH_PENDING':s.replaying?'REPLAY_PENDING':s.stopRequested?'STOP_PENDING':s.state!=='running'?'SESSION_NOT_RUNNING':s.failed?'VIEW_INACTIVE':null;
 // Local observation is display DATA only, never a new input/attachment grant.
 function notifyDisplay(s){
  if(disposed||current!==s)return;
  const active=live(s),code=active?null:typeof lastCode==='string'&&lastCode.length<=128&&/^[A-Z][A-Z0-9_]*$/.test(lastCode)?lastCode:'VIEW_INACTIVE';
  const value=Object.freeze({active,sessionId:s.sessionId,replaying:active?s.replaying:false,code}),prior=s.displayState;
  if(prior&&prior.active===value.active&&prior.replaying===value.replaying&&prior.code===value.code)return;
  s.displayState=value;const previous=displayNotifying;displayNotifying=true;
  try{onDisplayState(value);}catch{/* A local observer cannot replace lifecycle results. */}finally{displayNotifying=previous;}
 }
 function enable(s){if(live(s)&&s.emulator)s.emulator.options.disableStdin=!!ready(s);flushGeometry(s);notifyDisplay(s);}
 function retire(s,code){
  if(!s||s.retired)return;s.retired=true;s.failed=true;lastCode=code;s.output.length=0;s.early.length=0;s.queuedBytes=0;s.geometry=null;s.resized=null;
  for(const off of s.disposers.splice(0))try{off.dispose();}catch{}
  try{if(s.emulator){s.emulator.options.disableStdin=true;s.emulator.dispose();}}catch{}
  try{container.replaceChildren();}catch{}
  notifyDisplay(s);
 }
 function detachLease(s){
  if(s.detachWork)return s.detachWork;if(s.stopped)return s.detachWork=Promise.resolve(pass({retired:true,basis:'STOPPED_SESSION',sessionId:s.sessionId,epoch}));if(!s.lease)return Promise.resolve(pass({detached:true}));
  // Reserve and retain the actual cleanup receipt before bridge callbacks can
  // reenter. Automatic retirement and explicit restore share this same work.
  let resolve;const work=new Promise(r=>resolve=r);s.detachWork=work;s.detachSent=true;track(work);
  try{Promise.resolve(request(s,'detach',scope(s),true)).then(resolve,()=>resolve(fail('DETACH_UNVERIFIED')));}catch{resolve(fail('DETACH_UNVERIFIED'));}
  return work;
 }
 function fence(s,code){if(!live(s))return;retire(s,code);detachLease(s);}
 function queue(s,item){
  if(!live(s))return;if(s.output.length>=128||s.queuedBytes+item.bytes>limits.attachmentOutputBytes){fence(s,'OUTPUT_OVERFLOW');return;}
  s.queuedBytes+=item.bytes;s.output.push(item);pump(s);
 }
 function marker(s,dropped,resume){queue(s,{bytes:0,end:resume,ack:false,gap:true,text:`\x18\r\n[Terminal history incomplete: ${dropped} UTF-8 bytes omitted.]\r\n`});}
 function pump(s){
  if(!live(s)||!s.emulator||s.writing||!s.output.length)return;
  const item=s.output.shift();s.writing=true;let text=item.text;
  if(item.gap)s.filter.reset();else{const filtered=s.filter.push(text);if(!filtered.ok){fence(s,filtered.code);return;}text=filtered.data;if(filtered.omittedUtf8Bytes)text+=`\r\n[Terminal control data omitted: ${filtered.omittedUtf8Bytes} UTF-8 bytes.]\r\n`;}
  // The completion runs after write returns, even for synchronous adapters.
  // Replay replies therefore remain fenced through the entire last write.
  let called=false;
  const done=()=>{if(called)return;called=true;queueMicrotask(()=>{track((async()=>{
   if(!live(s))return;
   if(item.ack&&!s.stopped){const reply=await request(s,'ack',{...scope(s),throughSequence:item.end});if(!live(s))return;if(!s.stopped&&(!reply.ok||own(reply.value,['acknowledged'])?.acknowledged!==true)){fence(s,reply.code??'ACK_REFUSED');return;}}
   s.queuedBytes-=item.bytes;s.processed=item.end;s.writing=false;
   if(s.processed>=s.replayEnd)s.replaying=false;enable(s);pump(s);
  })());});};
  try{s.emulator.write(text,done);}catch{fence(s,'DISPLAY_FAILED');}
 }
 function deliver(s,event,type){
  if(!live(s)||event.sessionId!==s.sessionId)return;
  if(!s.lease){const bytes=type==='data'?event.utf8Bytes:0;if(s.early.length>=128||s.earlyBytes+bytes>limits.attachmentOutputBytes){fence(s,'OUTPUT_OVERFLOW');return;}s.early.push({type,event});s.earlyBytes+=bytes;return;}
  if(event.leaseId!==s.lease.leaseId||event.generation!==s.lease.generation)return;
  if(type==='gap'){
   if(event.resumeSequence<=s.received)return;marker(s,event.droppedUtf8Bytes,event.resumeSequence);s.received=event.resumeSequence;return;
  }
  if(event.sequence<s.received)return;
  if(event.sequence>s.received)marker(s,event.sequence-s.received,event.sequence);
  s.received=event.sequence+event.utf8Bytes;queue(s,{bytes:event.utf8Bytes,end:s.received,ack:true,gap:false,text:event.data});
 }
 client.onData(event=>{if(current)deliver(current,event,'data');});
 client.onGap(event=>{if(current)deliver(current,event,'gap');});
 client.onState(event=>{const s=current;if(!live(s)||s.stopped||event.session.sessionId!==s.sessionId)return;s.latestState=event.session;s.state=event.session.state;enable(s);});
 function attach(sessionId,stopRequested=false){
  // A retained controls Stop uncertainty can only decrease local authority.
  // Capture it before bridge/factory callbacks, not after attachment enables.
  if(typeof stopRequested!=='boolean')return Promise.resolve(fail('REQUEST_REFUSED'));
  if(disposed)return Promise.resolve(fail('VIEW_DISPOSED'));if(displayNotifying)return Promise.resolve(fail('VIEW_INACTIVE'));if(!id(sessionId))return Promise.resolve(fail('REQUEST_REFUSED'));if(current&&!current.retired)return Promise.resolve(fail('CAPACITY_EXCEEDED'));
  const s={sessionId,stopRequested,lease:null,retired:false,failed:false,state:'starting',latestState:null,early:[],earlyBytes:0,output:[],queuedBytes:0,writing:false,replaying:true,disposers:[],emulator:null,filter:createTerminalDisplayFilter(),received:0,processed:0,replayEnd:0,inputSequence:0,inputTail:Promise.resolve(),geometry:null,resized:null,resizeWork:null};current=s;lastCode=null;
  return track((async()=>{
   const reply=await request(s,'attach',{sessionId});const value=reply.ok?attachment(reply.value,epoch,sessionId):null;
   if(!live(s)){if(value){s.lease=value;await detachLease(s);}return fail('VIEW_INACTIVE');}
   if(!value){fence(s,reply.code??'ATTACH_REFUSED');return fail(reply.code??'ATTACH_REFUSED');}
   s.lease=value;s.state=(s.latestState??value.session).state;s.received=value.firstSequence;s.processed=value.firstSequence;s.replayEnd=value.nextSequence;s.replaying=value.firstSequence<value.nextSequence;
   try{
    const emulator=terminalFactory({disableStdin:true,scrollback:limits.scrollbackLines,allowProposedApi:false,windowOptions:{},theme,linkHandler:{activate(){},hover(){},leave(){}}});
    if(!live(s)){try{emulator.dispose();}catch{}return fail('VIEW_INACTIVE');}s.emulator=emulator;
    emulator.open(container);if(!live(s))return fail('VIEW_INACTIVE');
    const dataOff=emulator.onData(data=>{
     if(ready(s)!==null)return;
     let observe=null;try{if(typeof captureRawInput==='function')observe=captureRawInput(s.sessionId);}catch{}
     // Optional local Help can reenter/retire. It never grants input authority.
     if(ready(s)!==null)return;
     sendInput(data).then(reply=>{if(!disposed&&current===s&&typeof observe==='function')try{observe(reply);}catch{}},()=>{});
    });
    if(!live(s)){try{dataOff.dispose();}catch{}return fail('VIEW_INACTIVE');}s.disposers.push(dataOff);
    const resizeOff=emulator.onResize(size=>{if(live(s))resizeFor(s,size?.cols,size?.rows).catch(()=>{});});
    if(!live(s)){try{resizeOff.dispose();}catch{}return fail('VIEW_INACTIVE');}s.disposers.push(resizeOff);
    if(value.firstSequence>0)marker(s,value.firstSequence,value.firstSequence);
    const early=s.early.splice(0);s.earlyBytes=0;for(const item of early)deliver(s,item.event,item.type);enable(s);
   }catch{fence(s,'DISPLAY_FAILED');return fail('DISPLAY_FAILED');}
   if(!live(s))return fail('VIEW_INACTIVE');
   return pass({session:s.latestState??value.session,replaying:s.replaying});
  })());
 }
 function input(data,paste){
  if(displayNotifying)return Promise.resolve(fail('VIEW_INACTIVE'));
  const s=current,code=ready(s);if(code)return Promise.resolve(fail(code));if(!inputShape(data)||!data.length)return Promise.resolve(fail('REQUEST_REFUSED'));
  // Paste must not carry invisible terminal control actions. Keyboard Ctrl+C
  // and Enter stay on the unchanged sendInput path. Never strip pasted bytes.
  if(paste&&/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/.test(data))return Promise.resolve(fail('PASTE_CONTROL_REFUSED'));
  const bytes=encoder.encode(data).length;if(inputEntries>=128||inputBytes+bytes>limits.inputQueueBytes)return Promise.resolve(fail('CAPACITY_EXCEEDED'));
  if(!paste&&data.length>1&&/[\r\n]/.test(data))return Promise.resolve(fail('PASTE_REVIEW_REQUIRED'));
  // Reserve before entering the review adapter, which can reenter or detach.
  inputBytes+=bytes;inputEntries++;
  const previous=s.inputTail;let resolve;const work=new Promise(yes=>resolve=yes);s.inputTail=work.then(()=>{});track(work);
  (async()=>{try{
   await previous;let code=ready(s);if(code)return fail(code);
   if(paste&&/[\r\n]/.test(data)){let approved=false;try{approved=await reviewPaste(data);}catch{}if(approved!==true)return fail('PASTE_CANCELLED');}
   code=ready(s);if(code)return fail(code);if(!uint(s.inputSequence+1))return fail('INPUT_SEQUENCE_EXHAUSTED');
   const sequence=s.inputSequence++,reply=await request(s,'input',{...scope(s),inputSequence:sequence,data});if(!live(s))return fail('VIEW_INACTIVE');const value=reply.ok?own(reply.value,['inputSequence','accepted']):null;
   if(!value||value.inputSequence!==sequence||value.accepted!==true){fence(s,reply.code??'INPUT_REFUSED');return fail(reply.code??'INPUT_REFUSED');}return reply;
  }catch{fence(s,'INPUT_REFUSED');return fail('INPUT_REFUSED');}finally{inputBytes-=bytes;inputEntries--;}})().then(resolve);
  return work;
 }
 const sendInput=data=>input(data,false),paste=data=>input(data,true);
 function flushGeometry(s){
  if(ready(s)||!s.geometry||s.resizeWork||sameGeometry(s.resized,s.geometry))return null;
  const geometry=s.geometry,lease=s.lease;
  // Reserve one actual request before operation-ID/bridge callbacks can reenter.
  // Only two bounded dimensions are retained; intermediate fits are discarded.
  let resolve;const work=new Promise(yes=>resolve=yes),record={geometry,work};s.resizeWork=record;track(work);
  (async()=>{try{
   const reply=await request(s,'resize',{...scope(s),...geometry});
   if(!live(s)||s.lease!==lease)return fail('VIEW_INACTIVE');
   const value=reply.ok?own(reply.value,['resized']):null;
   if(!live(s)||s.lease!==lease)return fail('VIEW_INACTIVE');
   if(!value||value.resized!==true){fence(s,reply.code??'RESIZE_REFUSED');return fail(reply.code??'RESIZE_REFUSED');}
   s.resized=geometry;return reply;
  }catch{fence(s,'RESIZE_REFUSED');return fail('RESIZE_REFUSED');}
  finally{if(s.resizeWork===record)s.resizeWork=null;}})().then(result=>{
   resolve(result);if(live(s)&&s.lease===lease)flushGeometry(s);
  });return work;
 }
 function resizeFor(s,cols,rows){
  if(displayNotifying)return Promise.resolve(fail('VIEW_INACTIVE'));
  if(!live(s))return Promise.resolve(fail('VIEW_INACTIVE'));
  if(!geometryShape(cols,rows))return Promise.resolve(fail('REQUEST_REFUSED'));
  s.geometry={cols,rows};const code=ready(s);if(code)return Promise.resolve(fail(code));
  if(s.resizeWork)return sameGeometry(s.resizeWork.geometry,s.geometry)?s.resizeWork.work:Promise.resolve(pass({queued:true}));
  // These are local receipts, never a claim that the PTY accepted a new resize.
  if(sameGeometry(s.resized,s.geometry))return Promise.resolve(pass({unchanged:true}));
  return flushGeometry(s);
 }
 function resize(cols,rows){return resizeFor(current,cols,rows);}
 // Local monotonic fence only: not a native Stop/exit/cleanup receipt.
 // Keep output processing, ACK and the emulator available for final output.
 function beginStop(sessionId){
  const s=current;if(displayNotifying||!live(s)||!s.lease||s.sessionId!==sessionId)return fail('VIEW_INACTIVE');
  s.stopRequested=true;enable(s);return pass({localInputClosed:true});
 }
 // Only a correlated, validated Stop outcome supplied by the owning controls
 // establishes this local read-only basis. A generic State event does not.
 // It decreases local input authority and never fabricates a Detach receipt.
 function observeStoppedSession(event){
  const s=current;if(displayNotifying||!live(s)||!s.lease)return fail('VIEW_INACTIVE');
  const checked=validateTerminalEvent('terminalState',event),session=checked.ok?checked.event.session:null,prior=s.lease.session;
  if(!checked.ok||checked.event.epoch!==epoch||!session||session.state!=='exited'||session.sessionId!==s.sessionId||session.projectId!==prior.projectId||session.profileId!==prior.profileId||session.cwdDisplay!==prior.cwdDisplay)return fail('RESPONSE_REFUSED');
  // Descriptor validation can reenter; capture first and recheck before mutation.
  if(!live(s)||s.detachWork)return fail('VIEW_INACTIVE');
  s.stopped=true;s.state='exited';s.latestState=session;s.geometry=null;s.resized=null;enable(s);return pass({readOnly:true});
 }
 function detach(){const s=current;if(!s)return Promise.resolve(pass({detached:true}));retire(s,'VIEW_DETACHED');return detachLease(s);}
 function dispose(){if(disposed)return;disposed=true;const s=current;retire(s,'VIEW_DISPOSED');if(s)detachLease(s);client.dispose();}
 async function drain(){while(pending.size)await Promise.all([...pending]);await client.drain();}
 function clearView(){if(!live(current)||!current.emulator)return fail('VIEW_INACTIVE');try{current.emulator.clear();return pass({cleared:true});}catch{return fail('DISPLAY_FAILED');}}
 function find(query){if(!live(current)||typeof query!=='string'||!query||query.length>4096)return false;try{return search?.findNext(query)===true;}catch{return false;}}
 function setTheme(value){
  const allowed=['background','foreground','cursor','selectionBackground','black','red','green','yellow','blue','magenta','cyan','white','brightBlack','brightRed','brightGreen','brightYellow','brightBlue','brightMagenta','brightCyan','brightWhite'];
  try{if(!value||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return fail('THEME_REFUSED');const result={};for(const key of Reflect.ownKeys(value)){if(!allowed.includes(key))return fail('THEME_REFUSED');const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value')||typeof d.value!=='string'||!/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(d.value))return fail('THEME_REFUSED');result[key]=d.value;}theme=Object.freeze(result);if(live(current)&&current.emulator)current.emulator.options.theme=theme;return pass({updated:true});}catch{return fail('THEME_REFUSED');}
 }
 const snapshot=()=>Object.freeze({active:live(current),sessionId:current?.sessionId??null,replaying:live(current)?current.replaying:false,code:lastCode,queuedOutputUtf8Bytes:current?.queuedBytes??0,queuedInputUtf8Bytes:inputBytes,inputEntries});
 return Object.freeze({attach,detach,beginStop,observeStoppedSession,clearView,find,setTheme,resize,sendInput,paste,dispose,drain,snapshot});
}
