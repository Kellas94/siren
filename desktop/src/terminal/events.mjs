// Pure, browser-compatible display-event shapes for future typed preload use.
// No Electron/Node/PTY import, delivery authority, HTML conversion or side effect.
// IPC structured clones are data. Accessors are refused without reading them;
// exotic Proxy traps are caught, not claimed to be a native identity boundary.
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
const integer=v=>Number.isSafeInteger(v)&&v>=0;
const positive=v=>integer(v)&&v>0;
const fail=()=>Object.freeze({ok:false,code:'EVENT_REFUSED'});
function record(value,fields){
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))return null;
 const keys=Reflect.ownKeys(value);if(keys.length!==fields.length||keys.some(k=>typeof k!=='string'||!fields.includes(k)))return null;
 const out={};for(const k of fields){const d=Object.getOwnPropertyDescriptor(value,k);if(!d?.enumerable||!Object.hasOwn(d,'value'))return null;out[k]=d.value;}return out;
}
function utf8Bytes(text){
 if(typeof text!=='string'||text.length>32768)return null;let bytes=0;
 for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);
  if(c<128)bytes++;else if(c<2048)bytes+=2;
  else if(c>=0xd800&&c<=0xdbff){const low=text.charCodeAt(++i);if(!(low>=0xdc00&&low<=0xdfff))return null;bytes+=4;}
  else if(c>=0xdc00&&c<=0xdfff)return null;else bytes+=3;
  if(bytes>32768)return null;
 }return bytes;
}
const scope=['epoch','sessionId','leaseId','generation'];
const states=new Set(['starting','running','exited','host-failed','stopping','cleanup-failed']);
function session(value){
 const s=record(value,['sessionId','projectId','profileId','cwdDisplay','state','exitCode','droppedUtf8Bytes','attachedWindowId']);
 if(!s||![s.sessionId,s.projectId,s.profileId].every(id)||typeof s.cwdDisplay!=='string'||s.cwdDisplay.length>32768||!s.cwdDisplay.isWellFormed()||/[\x00-\x1f\x7f]/.test(s.cwdDisplay)||!states.has(s.state)||
  !(s.exitCode===null||integer(s.exitCode)&&s.exitCode<=0xffffffff)||!integer(s.droppedUtf8Bytes)||!(s.attachedWindowId===null||id(s.attachedWindowId)))return null;
 return Object.freeze(s);
}
export function validateTerminalEvent(name,value){
 try{
  if(typeof name!=='string')return fail();let event;
  if(name==='terminalData'){
   event=record(value,[...scope,'sequence','data','utf8Bytes']);if(!event)return fail();
   const bytes=utf8Bytes(event.data);
   if(bytes===null||!integer(event.sequence)||!integer(event.utf8Bytes)||event.utf8Bytes!==bytes||!Number.isSafeInteger(event.sequence+bytes))return fail();
  }else if(name==='terminalGap'){
   event=record(value,[...scope,'droppedUtf8Bytes','resumeSequence']);
   if(!event||!integer(event.droppedUtf8Bytes)||!integer(event.resumeSequence))return fail();
  }else if(name==='terminalState'){
   event=record(value,['epoch','session']);if(!event||!positive(event.epoch))return fail();
   const normalized=session(event.session);if(!normalized)return fail();
   return Object.freeze({ok:true,event:Object.freeze({epoch:event.epoch,session:normalized})});
  }else return fail();
  if(!positive(event.epoch)||!id(event.sessionId)||!id(event.leaseId)||!positive(event.generation))return fail();
  return Object.freeze({ok:true,event:Object.freeze(event)});
 }catch{return fail();}
}

