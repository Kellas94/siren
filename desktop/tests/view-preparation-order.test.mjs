import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeAllWorkspaceBarrier} from '../src/windows/source-barrier.mjs';

test('all captured views are covered before mutable flushes; immutable and Home seals describe the final saved revision',async()=>{
 const grants=[{role:'workspace',windowId:'home'},{role:'docs',windowId:'read'},{role:'docs',windowId:'working'}],roster={grants,epoch:1},events=[];let revision=1,paused=false;
 const registry={freezeRoster:()=>roster,isRosterCurrent:r=>r===roster,releaseRoster:()=>true};
 const owner={pause:()=>{paused=true;},resume:()=>{},drain:async()=>[],captureQuiescence:()=>({}),isQuiescent:()=>true,reconcileSourceReceipts:()=>{},
  isReadonlyForPreparation:grant=>grant.windowId!=='working',
  reconcileWorkspaceReceipts:async(_grants,receipts)=>receipts.every(r=>r.revision===revision)?{ok:true,refs:[]}:{ok:false,code:'READONLY_PROOF_FAILED'}};
 const control={cancelView:()=>{},flushView:async grant=>{
  assert.equal(paused,true);assert.equal(events.filter(e=>e.startsWith('cover:')).length,3);
  if(grant.windowId==='working'){await new Promise(r=>setImmediate(r));revision++;events.push('saved');}
  else events.push('seal:'+grant.windowId);
  return {ok:true,receipts:[{ok:true,revision}]};
 }};
 const barrier=new NativeAllWorkspaceBarrier({registry,owner,control,cover:g=>events.push('cover:'+g.windowId)});
 const result=await barrier.prepare('lock');assert.equal(result.ok,true,JSON.stringify(result));assert.ok(events.indexOf('saved')<events.indexOf('seal:home'));assert.ok(events.indexOf('saved')<events.indexOf('seal:read'));assert.equal(events.length,6);barrier.dispose();
});
