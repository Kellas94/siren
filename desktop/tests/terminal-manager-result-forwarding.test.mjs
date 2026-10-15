// Internal result forwarding only; actual composed JS, no shell/native proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import {privateManager,inertTick} from './fixtures/terminal-production-manager-private.mjs';
const then=Promise.prototype.then;
for(const kind of ['accessor','callable','proxy prototype'])test('command continuation does not assimilate late '+kind+' from settled resize result',async()=>{
 let reads=0,calls=0;const value={accepted:true};
 const h=privateManager({deadlineMs:30,wrap:{resize:({invoke})=>{
  const raw=Reflect.apply(then,invoke(),[()=>value]);
  Reflect.apply(then,raw,[()=>{queueMicrotask(()=>queueMicrotask(()=>{
   if(kind==='proxy prototype')Object.setPrototypeOf(value,new Proxy({}, {get(){reads++;return ()=>calls++;},getOwnPropertyDescriptor(){reads++;throw Error('No proxy descriptors');},getPrototypeOf(){reads++;throw Error('No proxy prototype');}}));
   else Object.defineProperty(value,'then',kind==='accessor'?{get(){reads++;throw Error('No late assimilation');}}:{value(){calls++;}});
  }));}]);return raw;
 }}});
 try{const s=await h.ready(),lease=(await h.attach(s)).value;const reply=await h.resize(lease);await inertTick();assert.equal(reads,0);assert.equal(calls,0);assert.equal(h.calls.resize,1);assert.equal(h.composition.state.resizes.length,1);assert.equal(h.manager.stats().pendingCommands,0);assert.equal(h.manager.stats().quarantinedOperations,0);assert.equal(reply.ok,false,'unsupported late outcome must not grant success');}
 finally{await h.end();}
});
for(const operation of ['resize','input','stopSession'])for(const kind of ['own accessor','own callable','inherited accessor','inherited callable','proxy prototype'])for(let delay=0;delay<6;delay++)test(operation+' late '+kind+' at microtask '+delay+' never runs through forwarding',async()=>{
 let reads=0,calls=0;const value=operation==='stopSession'?{ok:true}:{accepted:true};
 const h=privateManager({deadlineMs:25,wrap:{[operation]:({invoke})=>{
  const raw=Reflect.apply(then,invoke(),[()=>value]);
  const mutate=()=>{const d=kind.includes('accessor')?{get(){reads++;throw Error('Late getter');}}:{value(){calls++;}};
   if(kind.startsWith('own'))Object.defineProperty(value,'then',d);
   else if(kind.startsWith('inherited'))Object.setPrototypeOf(value,Object.defineProperty({},'then',d));
   else Object.setPrototypeOf(value,new Proxy({}, {get(){reads++;return ()=>calls++;},getOwnPropertyDescriptor(){reads++;throw Error('Proxy descriptor');},getPrototypeOf(){reads++;throw Error('Proxy prototype');}}));
  };
  Reflect.apply(then,raw,[()=>{let run=mutate;for(let i=0;i<delay;i++){const next=run;run=()=>queueMicrotask(next);}run();}]);return raw;
 }}});
 try{const s=await h.ready(),lease=(await h.attach(s)).value;
  if(operation==='resize')await h.resize(lease);
  else if(operation==='input')await h.input(lease,0,'real controlled write');
  else await h.manager.stop(h.grant,h.packet(s.sessionId));
  await inertTick();assert.equal(reads,0);assert.equal(calls,0);assert.equal(h.calls[operation],1);assert.equal(h.manager.stats().pendingCommands,0);assert.equal(h.manager.stats().pendingOperations,0);assert.equal(h.manager.stats().quarantinedOperations,0);
  if(operation==='resize')assert.equal(h.composition.state.resizes.length,1);
  if(operation==='input')assert.deepEqual(h.composition.state.writes,['real controlled write']);
 }finally{await h.end();}
});
