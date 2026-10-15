// Actual private manager composition, inert native transport; not native proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {privateManager} from './fixtures/terminal-production-manager-private.mjs';
const methods=['create','list','attach','detach','resize','input','ack','deliver','stop','commit'];
async function setup(){
 let thrown,armed=false;const h=privateManager({onPolicy(){if(armed)throw thrown;}}),s=await h.ready(),l=(await h.attach(s)).value,frame=await h.deliver(l),ticket=frame.value.handoffTicket;
 return{h,arm(value){thrown=value;armed=true;},clear(){armed=false;},invoke(name){return name==='create'?h.manager.create(h.grant,{operationId:'error-create',epoch:h.grant.epoch,cwdId:'cwd1',profileId:'powershell',cols:120,rows:40}):name==='list'?h.manager.list(h.grant,{operationId:'error-list',epoch:h.grant.epoch}):name==='attach'?h.attach(s):name==='detach'?h.detach(l):name==='resize'?h.resize(l):name==='input'?h.input(l):name==='ack'?h.ack(l,7):name==='deliver'?h.deliver(l):name==='stop'?h.manager.stop(h.grant,h.packet(s.sessionId)):h.manager.commitOutputHandoff(ticket);}};
}
for(const kind of ['null','undefined','accessor','proxy'])for(const method of methods)test(method+' contains thrown '+kind+' without reading arbitrary code',async()=>{
 const x=await setup();let getters=0;const value=kind==='null'?null:kind==='undefined'?undefined:kind==='accessor'?Object.defineProperty({},'code',{get(){getters++;throw Error('Do not inspect thrown getter');}}):new Proxy({}, {get(){getters++;return 'SENDER_REFUSED';},getOwnPropertyDescriptor(){getters++;throw Error('Do not inspect proxy');},getPrototypeOf(){getters++;throw Error('Do not inspect proxy');}});
 try{x.arm(value);const reply=await x.invoke(method);assert.equal(reply.ok,false);assert.equal(reply.code,'HOST_UNAVAILABLE');assert.equal(getters,0);x.clear();assert.equal((await x.h.attach({sessionId:x.h.manager.list(x.h.grant,{operationId:'after-error',epoch:x.h.grant.epoch}).value[0].sessionId})).ok,true,'entry error must not poison fresh attachment');}
 finally{x.clear();await x.h.end();}
});
for(const method of ['list','attach','commit'])test(method+' preserves own DATA error code without reading inherited code accessor',async()=>{
 const x=await setup();let getters=0;const inherited=Object.create(Object.defineProperty({},'code',{get(){getters++;throw Error('Inherited getter');}}));
 try{x.arm(inherited);assert.equal((await x.invoke(method)).code,'HOST_UNAVAILABLE');assert.equal(getters,0);x.clear();const fresh=await setup();try{fresh.arm(Object.assign(new Error('known refusal'),{code:'SENDER_REFUSED'}));assert.equal((await fresh.invoke(method)).code,'SENDER_REFUSED');}finally{fresh.clear();await fresh.h.end();}}
 finally{x.clear();await x.h.end();}
});
for(const code of [17,'',{},'x'.repeat(129),'bad code'])test('malformed own error code returns bounded fallback: '+(typeof code==='string'?code.length:typeof code),async()=>{
 const x=await setup();try{x.arm({code});const reply=await x.invoke('list');assert.equal(reply.code,'HOST_UNAVAILABLE');assert.equal(reply.message,'HOST_UNAVAILABLE');}finally{x.clear();await x.h.end();}
});
