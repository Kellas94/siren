// Browser-only display boundary. Not a PTY parser or an execution permission.
// OSC/DCS/APC/PM/SOS and window operations are deliberately unsupported: output
// cannot request clipboard, titles, links, images or native window changes.
import {TERMINAL_LIMITS as limits} from '../../terminal/contracts.mjs';
const encoder=new TextEncoder();
export function createTerminalDisplayFilter(){
 let mode='ground',pending='',bytes=0,discard=false,stringEscape=false,omittedUtf8Bytes=0;
 const reset=()=>{omittedUtf8Bytes+=bytes;mode='ground';pending='';bytes=0;discard=false;stringEscape=false;};
 const snapshot=()=>Object.freeze({mode,pendingUtf8Bytes:bytes,omittedUtf8Bytes});
 function push(data){
  if(typeof data!=='string'||data.length>limits.outputBytes||!data.isWellFormed()||encoder.encode(data).length>limits.outputBytes)return Object.freeze({ok:false,code:'OUTPUT_REFUSED'});
  const before=omittedUtf8Bytes;let output='';
  const accept=char=>{const count=encoder.encode(char).length;if(discard){omittedUtf8Bytes+=count;return;}if(bytes+count>limits.vtSequenceBytes){omittedUtf8Bytes+=bytes+count;pending='';bytes=0;discard=true;}else{pending+=char;bytes+=count;}};
  const complete=allowed=>{if(allowed&&!discard)output+=pending;else omittedUtf8Bytes+=bytes;mode='ground';pending='';bytes=0;discard=false;stringEscape=false;};
  for(const char of data){
   const code=char.codePointAt(0);
   if(mode==='ground'){
    mode=char==='\x1b'?'escape':code===0x9b?'csi':code===0x9d?'osc':[0x90,0x98,0x9e,0x9f].includes(code)?'string':'ground';
    if(mode==='ground'){if(code===0x9c){omittedUtf8Bytes+=encoder.encode(char).length;}else output+=char;continue;}accept(char);continue;
   }
   if(code===0x18||code===0x1a){accept(char);complete(false);continue;}
   // C1 introducers/ESC preempt an incomplete CSI/escape in the real parser.
   // Never retain them inside a sequence that could later be passed through.
   if(mode!=='osc'&&mode!=='string'){
    const next=char==='\x1b'?'escape':code===0x9b?'csi':code===0x9d?'osc':[0x90,0x98,0x9e,0x9f].includes(code)?'string':null;
    if(next){complete(false);mode=next;accept(char);continue;}
    if(code>0x7e){accept(char);complete(false);continue;}
   }
   accept(char);
   if(mode==='osc'||mode==='string'){
    if(code===0x9c||mode==='osc'&&code===7||stringEscape&&char==='\\')complete(false);else stringEscape=char==='\x1b';
   }else if(mode==='csi'){
    if(code>=0x40&&code<=0x7e)complete(char!=='t');
   }else if(mode==='escape'){
    if(char==='[')mode='csi';else if(char===']')mode='osc';else if(['P','X','^','_'].includes(char))mode='string';
    else if(code>=0x20&&code<=0x2f)mode='intermediate';else if(code>=0x30&&code<=0x7e)complete(true);else if(code>0x7f)complete(false);
   }else if(mode==='intermediate'&&code>=0x30&&code<=0x7e)complete(true);
  }
  return Object.freeze({ok:true,data:output,omittedUtf8Bytes:omittedUtf8Bytes-before});
 }
 return Object.freeze({push,reset,snapshot});
}
