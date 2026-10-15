// Pure controller for a fixed, owned CI probe. Not a production manager,
// renderer grant, project authority or PTY lifetime/ownership implementation.
import {TerminalInputFence} from '../../src/terminal/input-gate.mjs';
import {TerminalGateLink} from '../../src/terminal/gate-link.mjs';
import {TERMINAL_LIMITS as limits} from '../../src/terminal/contracts.mjs';
const int=n=>Number.isSafeInteger(n)&&n>=0;
const refuse=code=>Object.freeze({ok:false,code});
export function createShellFlowController({exchange,isAlive,now,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 if(![exchange,isAlive,now,setTimer,clearTimer].every(f=>typeof f==='function'))throw TypeError('Bounded fixed probe dependencies required');
 let closed=true,lost=false,sequence=0,dataBusy=false,endpoint;
 const measurements={gateAckMs:[],inputAckMs:[]};
 const ledger={closeInput(){closed=true;},resumeInput(){if(!lost)closed=false;}};
 const lose=()=>{lost=true;closed=true;link?.dispose();};let link;
 const alive=()=>{let yes=false;try{yes=!lost&&isAlive()===true;}catch{}if(!yes)lose();return yes;};
 async function request(kind,fields){
  if(!alive())return refuse('HOST_UNAVAILABLE');
  if(sequence>=128){lose();return refuse('TEST_CONTROL_CAPACITY');}
  const packet=Object.freeze({sequence:sequence++,kind,...fields});
  try{
   const reply=await exchange(packet);
   if(!alive()||!reply||reply.admitted!==false||reply.sequence!==packet.sequence||reply.kind!==kind||!reply.result||typeof reply.result!=='object')throw Error('TEST_REPLY_BINDING');
   return reply;
  }catch{lose();return refuse('HOST_UNAVAILABLE');}
 }
 link=new TerminalGateLink({channelId:'fixed-shell-flow',setTimer,clearTimer,
  subscribe:e=>{endpoint=e;return ()=>{endpoint=null;};},
  send:packet=>{
   const started=now();
   void request('gate',{generation:packet.generation,open:packet.open}).then(reply=>{
    if(reply.ok===false){lose();return;}
    measurements.gateAckMs.push(now()-started);
    const result=reply.result;
    endpoint?.message({channelId:packet.channelId,requestId:packet.requestId,generation:result.generation,open:result.open,ok:result.ok});
   });
  },
 });
 const fence=new TerminalInputFence({ledger,gateLink:link,setTimer,clearTimer});
 async function data(kind,fields){
  if(!alive())return refuse('HOST_UNAVAILABLE');
  if(dataBusy)return refuse('TEST_LANE_BUSY');dataBusy=true;
  try{return await request(kind,fields);}finally{dataBusy=false;}
 }
 return Object.freeze({
  nativeExecutionAdmitted:false,
  unlock:()=>fence.resumeInput(),lock:()=>fence.closeInput('fixed-probe-lock'),
  snapshot:()=>Object.freeze({...fence.snapshot(),closed:closed||fence.snapshot().closed,lost}),
  async submit(value){
   if(!alive())return refuse('HOST_UNAVAILABLE');
   if(closed||fence.snapshot().closed||!fence.snapshot().hostAcknowledged)return refuse('PIN_REQUIRED');
   if(typeof value!=='string'||!value.length||!value.isWellFormed()||Buffer.byteLength(value)>limits.inputBytes)return refuse('REQUEST_REFUSED');
   const started=now(),reply=await data('input',{generation:fence.snapshot().generation,data:value});
   if(reply.result?.ok===true){measurements.inputAckMs.push(now()-started);return Object.freeze({ok:true,receipt:reply});}
   return reply.ok===false?reply:refuse(reply.result?.code??'REQUEST_REFUSED');
  },
  read:cursor=>int(cursor)?data('snapshot',{fromSequence:cursor}):Promise.resolve(refuse('REQUEST_REFUSED')),
  // Explicit adversarial test hook, never a renderer/product endpoint. It must
  // return a host refusal with zero seam writes; native harness checks both.
  probeStaleInput:(generation,value)=>int(generation)&&typeof value==='string'&&Buffer.byteLength(value)<=limits.inputBytes?data('input',{generation,data:value}):Promise.resolve(refuse('REQUEST_REFUSED')),
  resize(cols,rows){
   if(closed||fence.snapshot().closed)return Promise.resolve(refuse('PIN_REQUIRED'));
   if(!int(cols)||cols<2||cols>500||!int(rows)||rows<1||rows>200)return Promise.resolve(refuse('REQUEST_REFUSED'));
   return data('resize',{generation:fence.snapshot().generation,cols,rows});
  },
  dispose:lose,
  metrics:()=>Object.freeze({nativeExecutionAdmitted:false,requests:sequence,dataPending:dataBusy?1:0,control:link.stats(),gateAckMs:Object.freeze([...measurements.gateAckMs]),inputAckMs:Object.freeze([...measurements.inputAckMs])}),
 });
}
