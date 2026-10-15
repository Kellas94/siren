import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTerminalEvent} from '../src/terminal/events.mjs';

const lease={epoch:4,sessionId:'session_1',leaseId:'lease_2',generation:2};
const data=()=>({...lease,sequence:10,data:'Ș😀\u001b[31m',utf8Bytes:11});
const gap=()=>({...lease,droppedUtf8Bytes:32,resumeSequence:64});
const session=()=>({sessionId:'session_1',projectId:'project_1',profileId:'powershell',cwdDisplay:'C:\\project țară',state:'running',exitCode:null,droppedUtf8Bytes:0,attachedWindowId:'window_2'});

test('terminal output preserves exact Unicode/VT bytes in a detached immutable data record',()=>{
 const input=data(),r=validateTerminalEvent('terminalData',input);assert.equal(r.ok,true);assert.equal(r.event.data,input.data);assert.equal(Object.getPrototypeOf(r.event),null);assert.equal(Object.isFrozen(r.event),true);input.sequence=100;assert.equal(r.event.sequence,10);
});
test('gap and passive state metadata retain exact validated scope without issuing authority',()=>{
 const g=validateTerminalEvent('terminalGap',gap());assert.equal(g.ok,true);assert.equal(g.event.resumeSequence,64);
 const input={epoch:4,session:session()},r=validateTerminalEvent('terminalState',input);assert.equal(r.ok,true);input.session.state='exited';assert.equal(r.event.session.state,'running');assert.equal(Object.isFrozen(r.event.session),true);assert.equal(Object.hasOwn(r.event,'inputAllowed'),false);
});
test('events refuse hidden/accessor/symbol/extra fields and never execute property getters',()=>{
 let reads=0;const getter=data();Object.defineProperty(getter,'data',{enumerable:true,get(){reads++;return 'bad';}});
 for(const payload of [getter,{...data(),extra:1},{...data(),[Symbol('secret')]:1},Object.create(data()),[],null])assert.equal(validateTerminalEvent('terminalData',payload).ok,false);
 const hidden=data();Object.defineProperty(hidden,'sequence',{value:10,enumerable:false});assert.equal(validateTerminalEvent('terminalData',hidden).ok,false);assert.equal(reads,0);
});
test('output byte credits cannot lie, overflow or split malformed Unicode',()=>{
 for(const changes of [{utf8Bytes:1},{data:'\ud800',utf8Bytes:3},{data:'x'.repeat(32769),utf8Bytes:32769},{data:'😀'.repeat(8193),utf8Bytes:32772},{data:'',utf8Bytes:0},{sequence:Number.MAX_SAFE_INTEGER},{sequence:-1},{generation:0},{epoch:NaN}])assert.equal(validateTerminalEvent('terminalData',{...data(),...changes}).ok,false);
 const boundary={...lease,sequence:0,data:'😀'.repeat(8192),utf8Bytes:32768};assert.equal(validateTerminalEvent('terminalData',boundary).ok,true);
});
test('wrong method, missing scope and arbitrary executable/HTML payloads are refused',()=>{
 for(const method of ['terminalInput','terminalExecute','__proto__',{},null])assert.equal(validateTerminalEvent(method,data()).ok,false);
 for(const changes of [{sessionId:'../other'},{leaseId:''},{generation:1.5},{epoch:'4'},{html:'<script>bad</script>'},{environment:{PATH:'bad'}}])assert.equal(validateTerminalEvent('terminalData',{...data(),...changes}).ok,false);
 const missing=data();delete missing.leaseId;assert.equal(validateTerminalEvent('terminalData',missing).ok,false);
});
test('gap and nested passive state reject ambiguous data and unsafe counters',()=>{
 for(const changes of [{droppedUtf8Bytes:0},{resumeSequence:-1},{generation:0}])assert.equal(validateTerminalEvent('terminalGap',{...gap(),...changes}).ok,false);
 for(const changes of [{state:'trusted'},{cwdDisplay:'x'.repeat(32769)},{exitCode:-1},{attachedWindowId:1},{droppedUtf8Bytes:Infinity},{extra:true}])assert.equal(validateTerminalEvent('terminalState',{epoch:4,session:{...session(),...changes}}).ok,false);
 let reads=0;const bad=session();Object.defineProperty(bad,'state',{enumerable:true,get(){reads++;return 'running';}});assert.equal(validateTerminalEvent('terminalState',{epoch:4,session:bad}).ok,false);assert.equal(reads,0);
 for(const state of ['starting','running','exited','host-failed','stopping','cleanup-failed'])assert.equal(validateTerminalEvent('terminalState',{epoch:0,session:{...session(),state,cwdDisplay:'',attachedWindowId:null,exitCode:0}}).ok,true);
});

test('nested metadata is normalized once rather than validated then reread',()=>{
 let stateReads=0;const value=new Proxy(session(),{getOwnPropertyDescriptor(target,key){const d=Reflect.getOwnPropertyDescriptor(target,key);if(key==='state'){stateReads++;return {...d,value:stateReads===1?'running':'invalid'};}return d;}});
 const r=validateTerminalEvent('terminalState',{epoch:4,session:value});assert.equal(r.ok,true);assert.equal(r.event.session.state,'running');assert.equal(stateReads,1);assert.notEqual(r.event.session,value);
});
