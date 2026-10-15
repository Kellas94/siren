// Pure fixed-fixture state. Never loads Electron/PTY or executes a command.
import {HostInputGate} from '../../src/terminal/input-gate.mjs';
export const NORMAL_BEGIN='SIREN_NORMAL_BEGIN_Ω_😀';
export const NORMAL_DONE='SIREN_NORMAL_DONE_Ω_😀';
const chars=s=>Array.from({length:s.length},(_,i)=>s.charCodeAt(i)).join(',');
const marker=s=>'[Console]::WriteLine((-join [char[]]('+chars(s)+')))';
export const NORMAL_COMMAND_KIND='FIXED_INSTRUMENTED_DIAGNOSTIC_NOT_ORIGINAL_COMMAND';
const milestone=stage=>"[System.IO.File]::WriteAllText('normal-script-"+stage+".json','1');";
const command='[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;'+milestone('before-begin')+marker(NORMAL_BEGIN)+';'+milestone('after-begin')+'Start-Sleep -Milliseconds 1200;'+milestone('after-sleep')+marker(NORMAL_DONE)+';'+milestone('after-done')+'\r';
const fail=()=>Object.freeze({ok:false});
export class NormalShellProbe {
 #gate=new HostInputGate();#write;#append;#clock;#tail='';#attempted=false;#known=false;#refused=0;#bytes=0;#begin=null;#done=null;#lock=null;
 constructor({writeInput,appendOutput,clock=()=>performance.now()}={}){if(![writeInput,appendOutput,clock].every(f=>typeof f==='function'))throw TypeError('Fixed probe dependencies required');this.#write=writeInput;this.#append=appendOutput;this.#clock=clock;}
 applyGate(packet){const r=this.#gate.apply(packet);if(r.ok&&!r.open&&this.#begin!==null&&this.#done===null&&this.#lock===null)this.#lock=this.#clock();return r;}
 requestCommand(generation){
  if(!this.#gate.allows(generation)){this.#refused++;return fail();}if(this.#attempted)return fail();this.#attempted=true;
  try{this.#write(command);this.#known=true;return Object.freeze({ok:true});}catch{return fail();}
 }
 ingest(data){
  if(typeof data!=='string'||data.length>32768||!data.isWellFormed()||Buffer.byteLength(data)>32768)throw TypeError('Bounded valid output required');
  this.#append(data);this.#bytes+=Buffer.byteLength(data);const window=this.#tail+data;
  // Search the bounded incoming window before retaining only the final tail.
  if(this.#begin===null&&window.includes(NORMAL_BEGIN))this.#begin=this.#clock();
  if(this.#done===null&&window.includes(NORMAL_DONE))this.#done=this.#clock();
  this.#tail=window.slice(-1024);
 }
 snapshot(){return Object.freeze({inputWrites:this.#attempted?1:0,writeKnown:this.#known,refusedInput:this.#refused,receivedBytes:this.#bytes,beginMs:this.#begin,lockMs:this.#lock,doneMs:this.#done,parserCharacters:this.#tail.length});}
}
