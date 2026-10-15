// Actual private composed JS, controlled output authority; not native proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {TerminalProductionAttachmentOutput} from '../src/terminal/production-attachment-output.mjs';
import {privateManager,deferred,until,inertTick} from './fixtures/terminal-production-manager-private.mjs';
test('late history completion releases cancelled manager session without explicit reconciliation',async()=>{
 let enabled=false,entered=0;const hold=deferred(),h=privateManager({deadlineMs:25,wrap:{readHistory:({invoke})=>{if(enabled){entered++;return hold.promise;}return invoke();}}});let calls=0;
 try{const s=await h.ready(),l=(await h.attach(s)).value,first=await h.deliver(l);assert.equal(h.manager.commitOutputHandoff(first.value.handoffTicket).ok,true);assert.equal((await h.ack(l,7)).ok,true);enabled=true;const later=h.deliver(l,()=>{calls++;});await until(()=>entered===1,'actual history entered');assert.equal((await later).code,'HOST_UNAVAILABLE');await h.manager.stop(h.grant,h.packet(s.sessionId));assert.equal(h.manager.stats().reservedSessions,1);hold.resolve({ok:false,code:'CONTROLLED_LATE'});await until(()=>h.manager.stats().pendingOperations===0,'original history unwound');await inertTick();assert.equal(h.manager.stats().reservedSessions,0,'actual output authority must notify manager without another external operation');assert.equal(calls,0);assert.equal(h.manager.stats().outputHandoffTickets,0);}
 finally{enabled=false;hold.resolve({ok:false,code:'CLEANUP'});await h.end();}
});
for(const valid of [true,false])test((valid?'exact delayed':'foreign')+' output completion controls manager capacity',async()=>{
 const capture=TerminalProductionAttachmentOutput.prototype.captureOutputSettlement,hold=deferred();let captured;
 TerminalProductionAttachmentOutput.prototype.captureOutputSettlement=function(request){const original=Reflect.apply(capture,this,[request]);if(!original)return original;captured=original;return Object.freeze({sessionId:original.sessionId,ownerId:original.ownerId,actualSettled:hold.promise,snapshot:original.snapshot});};
 const h=privateManager();try{const s=await h.ready();assert.ok(captured,'manager must capture exact output authority at registration');await h.manager.stop(h.grant,h.packet(s.sessionId));assert.equal(h.manager.stats().reservedSessions,1);assert.equal(captured.snapshot().actualSettled,true,'actual output has finished; delayed joining observer still owns manager charge');hold.resolve(Object.freeze({scope:'OUTPUT_SOURCE',sessionId:valid?s.sessionId:'foreign-session',ownerId:captured.ownerId,actualSettled:true,nativeExecutionAdmitted:false}));await inertTick();assert.equal(h.manager.stats().reservedSessions,valid?0:1);}
 finally{hold.resolve();TerminalProductionAttachmentOutput.prototype.captureOutputSettlement=capture;await h.end();}
});
test('unusable output capture fails closed without invoking accessor and keeps its reservation',async()=>{
 const capture=TerminalProductionAttachmentOutput.prototype.captureOutputSettlement;let reads=0;
 TerminalProductionAttachmentOutput.prototype.captureOutputSettlement=function(request){const h=Reflect.apply(capture,this,[request]);return Object.freeze(Object.defineProperty({sessionId:h.sessionId,ownerId:h.ownerId,snapshot:h.snapshot},'actualSettled',{enumerable:true,get(){reads++;return Promise.resolve();}}));};
 const h=privateManager();try{assert.equal((await h.manager.resumeInput()).ok,true);const made=await h.manager.create(h.grant,{operationId:'bad-output-capture',epoch:h.grant.epoch,cwdId:'cwd1',profileId:'powershell',cols:120,rows:40});assert.equal(made.ok,false);await inertTick();assert.equal(reads,0);assert.equal(h.manager.stats().reservedSessions,1);}
 finally{TerminalProductionAttachmentOutput.prototype.captureOutputSettlement=capture;await h.end();}
});
