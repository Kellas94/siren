// Candidate MAIN transport. No Electron import, graph factory or native loader.
import {types} from 'node:util';
import {WindowRegistry} from '../windows/registry.mjs';
import {TerminalProductionManager} from './production-manager.mjs';
import {TerminalProductionAccessTransitions} from './production-access-transitions.mjs';
import {TerminalRequestRouter} from './request-router.mjs';
import {captureTerminalGraphAuthorities} from './shutdown-graph.mjs';
import {validateTerminalEvent} from './events.mjs';
import {validateTerminalRequest} from './contracts.mjs';
const capture=(T,k)=>Object.getOwnPropertyDescriptor(T.prototype,k).value,apply=Reflect.apply;
const rc=capture(WindowRegistry,'capture'),current=capture(WindowRegistry,'isCurrent');
const ar=capture(TerminalProductionAccessTransitions,'currentRouter'),route=capture(TerminalRequestRouter,'route'),canonical=capture(TerminalRequestRouter,'captureDesktopCaller');
const deliver=capture(TerminalProductionManager,'deliverAvailable'),commit=capture(TerminalProductionManager,'commitOutputHandoff');
const fail=code=>Object.freeze({ok:false,code});
export function createDesktopTerminalBridge({graph,registry,projectId,getProjectId,isReady,send,schedule=setTimeout,cancel=clearTimeout,intervalMs=100}={}){
 const members=captureTerminalGraphAuthorities(graph,registry,projectId);
 if(!members||![getProjectId,isReady,send,schedule,cancel].every(f=>typeof f==='function')||!Number.isInteger(intervalMs)||intervalMs<50||intervalMs>1000)throw TypeError('Genuine graph and private MAIN adapters required');
 let disposed=false,serial=0;const rows=new Map();
 const router=()=>{try{return !disposed&&getProjectId()===projectId&&isReady()===true?apply(ar,members.access,[]):null;}catch{return null;}};
 function grant(event){try{if(!router())return null;const g=apply(rc,registry,[event]);return g?.projectId===projectId&&g.role==='terminal'?g:null;}catch{return null;}}
 function live(row){try{return rows.get(row.grant.windowId)===row&&router()&&apply(current,registry,[row.grant])===true&&row.event.sender.mainFrame===row.event.senderFrame;}catch{return false;}}
 function retire(row){if(rows.get(row.grant.windowId)===row)rows.delete(row.grant.windowId);if(row.timer!==null){cancel(row.timer);row.timer=null;}}
 function emit(row,method,value){const checked=validateTerminalEvent(method,value);if(!checked.ok||!live(row))throw Error('DELIVERY_RETIRED');const channel={terminalData:'siren:terminal-data',terminalGap:'siren:terminal-gap',terminalState:'siren:terminal-state'}[method];if(send(row.event,channel,checked.event)!==undefined||!live(row))throw Error('DELIVERY_RETIRED');}
 function later(row){if(!live(row)){retire(row);return;}if(row.timer!==null||row.pending||row.waiting)return;row.timer=schedule(()=>{row.timer=null;void pump(row);},intervalMs);row.timer?.unref?.();}
 async function states(row){const r=router();if(!r||!live(row))return;const result=await apply(route,r,[{event:row.event,method:'terminalList',payload:{operationId:'desktop_state_'+ ++serial,epoch:row.grant.epoch}}]);if(!live(row)||!result.ok)return;for(const session of result.value){const signature=JSON.stringify(session);if(row.states.get(session.sessionId)!==signature){emit(row,'terminalState',{epoch:row.grant.epoch,session});row.states.set(session.sessionId,signature);}}}
 async function pump(row){
  if(!live(row)){retire(row);return;}if(row.pending||row.waiting)return;
  const work=(async()=>{await Promise.resolve();try{
   let sent=false;
   const result=await apply(deliver,members.manager,[row.grant,{operationId:'desktop_output_'+ ++serial,epoch:row.grant.epoch,...row.lease},transfer=>{
    if(!live(row))throw Error('DELIVERY_RETIRED');
    const common={epoch:transfer.epoch,sessionId:transfer.sessionId,leaseId:transfer.leaseId,generation:transfer.generation};
    if(transfer.gap)emit(row,'terminalGap',{...common,droppedUtf8Bytes:transfer.gap.droppedUtf8Bytes,resumeSequence:transfer.gap.resumeSequence});
    if(transfer.chunk){emit(row,'terminalData',{...common,...transfer.chunk});sent=true;row.waiting=true;}
   }]);
   if(!live(row))return;
   if(!result.ok){retire(row);return;}
   if(sent&&(!result.value.handoffTicket||apply(commit,members.manager,[result.value.handoffTicket]).ok!==true)){retire(row);return;}
   await states(row);
  }catch{retire(row);}})();row.pending=work;
  try{await work;}finally{row.pending=null;later(row);}
 }
 function context(event,...extra){if(extra.length)return fail('REQUEST_REFUSED');const g=grant(event);return g?Object.freeze({windowId:g.windowId,role:g.role,projectId:g.projectId,epoch:g.epoch,mode:'normal',access:'write',available:true}):fail('TERMINAL_UNAVAILABLE');}
 async function invoke(event,method,payload,...extra){
  if(extra.length||types.isProxy(payload))return fail('REQUEST_REFUSED');const checked=validateTerminalRequest(method,payload);if(!checked.ok)return checked;
  // ACK-waiting rows have no timer. Retire revoked native callers before they
  // can consume attachment capacity; this never stops the running session.
  for(const row of [...rows.values()])if(!live(row))retire(row);
  const g=grant(event);if(!g)return fail('SENDER_REFUSED');const pinned=Object.freeze({sender:event.sender,senderFrame:event.senderFrame}),old=rows.get(g.windowId);
  if(['terminalInput','terminalResize','terminalAck'].includes(method)&&(!old||!live(old)||['sessionId','leaseId','generation'].some(k=>old.lease[k]!==checked.payload[k])))return fail('LEASE_STALE');
  if(method==='terminalAttach'&&!old&&rows.size>=8)return fail('CAPACITY_EXCEEDED');
  if(method==='terminalAck'&&old?.pending)await old.pending;
  if(method==='terminalAck'&&(!live(old)||rows.get(g.windowId)!==old))return fail('LEASE_STALE');
  const r=router();if(!r||apply(current,registry,[g])!==true)return fail('SENDER_REFUSED');
  const result=await apply(route,r,[{event:pinned,method,payload:checked.payload}]);
  if(!router()||apply(current,registry,[g])!==true)return fail('SENDER_REFUSED');
  if(result.ok&&method==='terminalAttach'){
   if(old)retire(old);if(rows.size>=8)return fail('CAPACITY_EXCEEDED');
   const attachmentGrant=apply(canonical,r,[pinned]);if(!attachmentGrant)return fail('SENDER_REFUSED');
   const row={grant:attachmentGrant,event:pinned,lease:{sessionId:checked.payload.sessionId,leaseId:result.value.leaseId,generation:result.value.generation},timer:null,pending:null,waiting:false,states:new Map()};rows.set(g.windowId,row);later(row);
  }else if(result.ok&&method==='terminalAck'&&old&&live(old)){old.waiting=false;later(old);}
  else if(result.ok&&['terminalDetach','terminalStop'].includes(method)){for(const row of [...rows.values()])if(row.lease.sessionId===checked.payload.sessionId){if(method==='terminalStop')await states(row);retire(row);}}
  return result;
 }
 function invalidate(){for(const row of [...rows.values()])retire(row);}
 function dispose(){if(disposed)return;disposed=true;invalidate();}
 return Object.freeze({context,invoke,invalidate,dispose,snapshot:()=>Object.freeze({disposed,attachments:rows.size,pending:[...rows.values()].filter(r=>r.pending).length})});
}

