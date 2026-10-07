import test from 'node:test';
import assert from 'node:assert/strict';
import {invokeDesktop} from '../src/ipc.mjs';

test('Home permits native PIN and update controls while refusing workspace envelopes and project bytes',async()=>{
 const context={isMainFrame:true,senderUrl:'siren://app/home.html'},localAccess={state:()=>({unlocked:true})};
 const services={getPinState:async()=>({unlocked:true}),checkForUpdates:async()=>({ok:true}),saveProject:async()=>assert.fail('Home cannot submit envelopes'),exportProject:async()=>assert.fail('Home cannot fetch project bytes')};
 assert.equal((await invokeDesktop({context,localAccess,services,method:'getPinState'})).unlocked,true);
 assert.equal((await invokeDesktop({context,localAccess,services,method:'checkForUpdates'})).ok,true);
 for(const [method,payload] of [['saveProject',{projectId:'owned',baseRevision:1,json:'{}',purpose:'workspace'}],['exportProject','owned']])assert.equal((await invokeDesktop({context,localAccess,services,method,payload})).code,'SENDER_REFUSED');
});
test('only the genuine App route can request Home, and locked access or extra fields refuse it',async()=>{
 const services={goHome:async()=>({ok:true,epoch:1})},app={isMainFrame:true,senderUrl:'siren://app/app.html'};
 assert.equal((await invokeDesktop({context:app,services,method:'goHome',localAccess:{state:()=>({unlocked:true})}})).ok,true);
 assert.equal((await invokeDesktop({context:app,services,method:'goHome',payload:{url:'siren://app/home.html'}})).code,'REQUEST_REFUSED');
 assert.equal((await invokeDesktop({context:app,services,method:'goHome',localAccess:{state:()=>({unlocked:false})}})).code,'PIN_REQUIRED');
 assert.equal((await invokeDesktop({context:{...app,senderUrl:'siren://app/home.html'},services,method:'goHome'})).code,'SENDER_REFUSED');
});
