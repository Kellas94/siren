// Test-only common credit authority. Does not grant renderer/project/PTY rights.
// Retains actual unacknowledged chunks; history remains in the eight host rings.
import {TerminalOutputCredits} from '../../src/terminal/credits.mjs';
const int=n=>Number.isSafeInteger(n)&&n>=0;
const fail=code=>Object.freeze({ok:false,code});
const pass=value=>Object.freeze({ok:true,value});
export function createAggregateFlowDelivery({read}={}){
 if(typeof read!=='function')throw TypeError('Fixed trusted read seam required');
 const credits=new TerminalOutputCredits(),views=new Map(),busy=new Set();let epoch=0,serial=0,closed=true,inFlight=0,maxInFlight=0,maxOutstanding=0;
 const lookup=t=>t&&views.get(t.slot)?.token===t&&!closed?views.get(t.slot):null;
 const revoke=(t)=>{const v=views.get(t.slot);if(v?.token===t){credits.detach(t.leaseId);views.delete(t.slot);}};
 return Object.freeze({
  nativeExecutionAdmitted:false,
  resume(){closed=false;},
  detach(token){if(!lookup(token))return fail('LEASE_STALE');revoke(token);return pass(null);},
  suspend(){closed=true;epoch++;for(const v of views.values())credits.detach(v.token.leaseId);views.clear();/* In-flight replies keep their reservations until they settle. */},
  attach(slot,fromSequence=0){
   if(closed)return fail('PIN_REQUIRED');if(!int(slot)||slot>=8)return fail('CAPACITY_EXCEEDED');if(!int(fromSequence)||views.has(slot))return fail('REQUEST_REFUSED');
   const token=Object.freeze({slot,epoch,leaseId:'aggregate-'+serial++});const attached=credits.attach(token.leaseId,fromSequence);if(!attached.ok)return attached;
   views.set(slot,{token,cursor:fromSequence,bytes:0,frames:[]});return pass(token);
  },
  async read(token){
   const view=lookup(token);if(!view)return fail('LEASE_STALE');if(busy.has(token.slot))return fail('TEST_LANE_BUSY');
   if(view.bytes+32768>262144||credits.stats().outstandingUtf8Bytes+inFlight+32768>2097152)return fail('CAPACITY_EXCEEDED');
   busy.add(token.slot);inFlight+=32768;maxInFlight=Math.max(maxInFlight,inFlight);
   try{
    const reply=await read(token.slot,view.cursor);if(lookup(token)!==view)return fail('LEASE_STALE');
    const r=reply?.result;if(!r||!Array.isArray(r.chunks)||r.chunks.length>128)throw Error('OUTPUT_RECORD');
    let cursor=view.cursor,total=0;
    if(r.gap){const g=r.gap;if(!int(g.resumeSequence)||g.resumeSequence<=cursor||g.fromSequence!==cursor||g.droppedUtf8Bytes!==g.resumeSequence-cursor||g.resetParser!==true)throw Error('OUTPUT_GAP');cursor=g.resumeSequence;}
    for(const c of r.chunks){if(c.sequence!==cursor||typeof c.data!=='string'||!c.data.isWellFormed()||!int(c.utf8Bytes)||c.utf8Bytes<1||Buffer.byteLength(c.data)!==c.utf8Bytes)throw Error('OUTPUT_CHUNK');total+=c.utf8Bytes;cursor+=c.utf8Bytes;if(total>32768||!int(cursor))throw Error('OUTPUT_BUDGET');}
    if(r.nextSequence!==cursor)throw Error('OUTPUT_CURSOR');
    if(r.gap){const advanced=credits.advanceToRetained(token.leaseId,r.gap.resumeSequence);if(!advanced.ok)return fail('CAPACITY_EXCEEDED');view.cursor=r.gap.resumeSequence;}
    // Exchange the finite read reservation for actual queued frames. No await
    // occurs between refund and reserve, so another reader cannot steal it.
    inFlight-=32768;
    for(const c of r.chunks){const reserved=credits.reserve(token.leaseId,{sequence:c.sequence,utf8Bytes:c.utf8Bytes});if(!reserved.ok)throw Error('OUTPUT_CREDIT_INVARIANT');view.cursor+=c.utf8Bytes;view.bytes+=c.utf8Bytes;view.frames.push({end:view.cursor,data:c.data,bytes:c.utf8Bytes});}
    maxOutstanding=Math.max(maxOutstanding,credits.stats().outstandingUtf8Bytes);return pass(reply);
   }catch{revoke(token);return fail('TEST_OUTPUT_REFUSED');}
   finally{
    // A successful reservation exchange already refunded this read. A failed,
    // rejected or stale reply still owns its original finite reservation.
    if(busy.has(token.slot)){busy.delete(token.slot);inFlight=busy.size*32768;}
   }
  },
  ack(token,throughSequence){const view=lookup(token);if(!view)return fail('LEASE_STALE');const result=credits.ack(token.leaseId,throughSequence);if(result.ok){view.bytes-=result.value.releasedUtf8Bytes;while(view.frames[0]?.end<=throughSequence)view.frames.shift();}return result;},
  stats(){return Object.freeze({...credits.stats(),closed,epoch,inFlightBytes:inFlight,pendingReads:busy.size,maxInFlightBytes:maxInFlight,maxOutstandingUtf8Bytes:maxOutstanding,payloadUtf8Bytes:[...views.values()].reduce((n,v)=>n+v.bytes,0),views:Object.freeze([...views.values()].map(v=>Object.freeze({slot:v.token.slot,epoch:v.token.epoch,cursor:v.cursor,pendingUtf8Bytes:v.bytes,frames:v.frames.length})))});},
 });
}
