import test from 'node:test';
import assert from 'node:assert/strict';
import { HomeAuthority } from '../src/navigation/authority.mjs';
import { invokeHome } from '../src/navigation/ipc.mjs';

function fixture() {
  let state={unlocked:true,projectId:null,mode:'normal',generation:1};
  const frame={url:'siren://app/home.html'};
  const sender={id:3,mainFrame:frame,isDestroyed:()=>false,getURL:()=>frame.url};
  const window={id:2,webContents:sender,isDestroyed:()=>false};
  const authority=new HomeAuthority({workspace:window,state:()=>state});
  const event={sender,senderFrame:frame};
  const home={mode:'normal',selectedProjectId:null,projects:[],continuation:null,views:[],capabilities:{diagrams:false,docs:false,code:false,present:false}};
  const services={getHomeState:async()=>home};
  return {authority,event,sender,frame,home,services,state:()=>state,setState:value=>{state=value;}};
}
const call=(f,method='getHomeState',payload={})=>invokeHome({event:f.event,method,payload,authority:f.authority,services:f.services});
test('metadata-only Home has genuine native caller without a selected project or source grant',async()=>{
  const f=fixture();assert.deepEqual(await call(f),{ok:true,state:f.home});assert.equal(f.authority.capture(f.event).projectId,null);
  assert.equal((await call(f,'recordLocation',{surface:'code',entityId:'source-a'})).code,'ACCESS_REFUSED');
});
test('same-origin forged sender subframe and non-exact URL cannot read Home',async()=>{
  for(const mutate of [f=>f.event.sender={...f.sender},f=>f.event.senderFrame={...f.frame},f=>f.frame.url='siren://app/home.html?forged=1',f=>f.frame.url='siren://app/app.html/other',f=>f.sender.getURL=()=> 'siren://app/app.html']){
    const f=fixture();mutate(f);assert.equal((await call(f)).code,'SENDER_REFUSED');
  }
});
test('locked Home request and an old grant after lock/unlock are refused',async()=>{
  const f=fixture();const captured=f.authority.capture(f.event);f.authority.invalidate();assert.equal(f.authority.isCurrent(captured),false);
  f.setState({...f.state(),unlocked:false});assert.equal((await call(f)).code,'ACCESS_REFUSED');
});
test('Lock generation and frame replacement during asynchronous read suppress metadata',async()=>{
  for(const mutate of [f=>f.authority.invalidate(),f=>f.setState({...f.state(),generation:2}),f=>f.setState({...f.state(),unlocked:false}),f=>{f.sender.mainFrame={url:f.frame.url};}]){
    const f=fixture();let release;const gate=new Promise(resolve=>{release=resolve;});f.services.getHomeState=async()=>{await gate;return f.home;};
    const pending=call(f);mutate(f);release();assert.equal((await pending).code,'ACCESS_REFUSED');
  }
});
test('request getters extra fields inherited fields and unknown methods never dispatch',async()=>{
  const f=fixture();let invoked=0;f.services.getHomeState=async()=>{invoked++;return f.home;};
  const getter={};Object.defineProperty(getter,'text',{get(){throw Error('getter executed');},enumerable:true});
  for(const payload of [getter,{projectId:'forged'},Object.create({text:'secret'}),{[Symbol('extra')]:1}])assert.equal((await call(f,'getHomeState',payload)).code,'REQUEST_REFUSED');
  assert.equal((await call(f,'saveProject',{})).code,'REQUEST_REFUSED');assert.equal(invoked,0);
});
test('Home result refuses content fields oversized lists or planted private values',async()=>{
  for(const patch of [{snapshot:{json:'PLANTED_SOURCE'}},{projects:Array.from({length:13},()=>({projectId:'p',label:'P',availability:'cached'}))},{capabilities:{diagrams:true,docs:true,code:true,present:true,token:'PLANTED_TOKEN'}},{views:[{windowId:'w',role:'code',entityId:'source-a',label:'S',state:'open',text:'PLANTED_SOURCE'}]}]){
    const f=fixture();f.services.getHomeState=async()=>({...f.home,...patch});const result=await call(f);assert.equal(result.code,'HOME_RESULT_REFUSED');assert.equal(JSON.stringify(result).includes('PLANTED'),false);
  }
});
test('location write derives native project and carries a live access fence',async()=>{
  const f=fixture();f.setState({...f.state(),projectId:'project-a'});let observed;
  f.services.recordLocation=async(input,scope)=>{observed={input,scope};return {ok:true};};
  const input={surface:'code',entityId:'source-a',cursor:{anchor:1,head:2}};
  assert.deepEqual(await call(f,'recordLocation',input),{ok:true});assert.equal(observed.scope.projectId,'project-a');assert.equal(observed.scope.isCurrent(),true);assert.equal(Object.hasOwn(observed.input,'projectId'),false);
  f.authority.invalidate();assert.equal(observed.scope.isCurrent(),false);
});
test('metadata projections preserve exact immutable Continue reference and finite view identity',async()=>{
  const f=fixture();f.setState({...f.state(),projectId:'project-a'});f.home.selectedProjectId='project-a';
  f.home.projects=[{projectId:'project-a',label:'P',availability:'cached',lastVisited:'2026-10-03T07:00:00.000Z'}];
  f.home.continuation={location:{schema:1,projectId:'project-a',surface:'code',entityId:'source-a',sourceRef:{sourceId:'source-a',version:7,sha256:'a'.repeat(64)}},availability:'saved'};
  f.home.views=[{windowId:'native-a',role:'code',entityId:'source-a',label:'Source A',state:'minimized'}];
  const result=await call(f);assert.equal(result.ok,true);assert.deepEqual(result.state,f.home);assert.notEqual(result.state.projects,f.home.projects);
});
test('no selected project may offer Continue for a listed project without granting its data',async()=>{
  const f=fixture();f.home.projects=[{projectId:'project-a',label:'Previous project',availability:'cached'}];
  f.home.continuation={location:{schema:1,projectId:'project-a',surface:'code',entityId:'source-a'},availability:'saved'};
  const result=await call(f);assert.equal(result.ok,true);assert.equal(result.state.selectedProjectId,null);assert.equal(result.state.continuation.location.projectId,'project-a');
  f.home.continuation.location.projectId='unknown-project';assert.equal((await call(f)).code,'HOME_RESULT_REFUSED');
});
test('unexpected native revalidation failure is a sanitized refusal instead of a rejected promise',async()=>{
  const f=fixture();const original=f.authority.isCurrent.bind(f.authority);let reads=0;
  f.authority.isCurrent=grant=>{if(++reads>1)throw Error('PRIVATE_NATIVE_ERROR');return original(grant);};
  const result=await call(f);assert.deepEqual(result,{ok:false,code:'ACCESS_REFUSED'});assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
});
