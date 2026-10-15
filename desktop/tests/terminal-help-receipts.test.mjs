import test from 'node:test';
import assert from 'node:assert/strict';
import {HELP_ARTICLES} from '../src/help/catalog.mjs';
import {createHelpResolver} from '../src/help/resolve.mjs';
import {createTerminalControls} from '../src/ui/terminal/controls.js';
import {setup,count} from './fixtures/terminal-help.mjs';
const resolver=createHelpResolver(HELP_ARTICLES);
const resolve=(operation,code)=>resolver.resolve({namespace:'terminal',operation,code});

test('independent existing folder and input identities retain their exact explanations',()=>{
 assert.equal(resolve('pick-cwd','CWD_REFUSED').id,'terminal-project-folder');assert.equal(resolve('create','CWD_REFUSED').id,'terminal-project-folder');assert.equal(resolve('input','INPUT_RECEIPT_EXPIRED').id,'terminal-command-receipt');assert.equal(resolve('input','PIN_REQUIRED').id,'terminal-lock');assert.equal(resolve('input','READONLY').id,'terminal-lock');
});

test('independent actual create-without-folder receipt should reach the existing folder explanation',async()=>{
 const s=setup();try{const reply=await s.api.createSession();assert.equal(reply.code,'CWD_REQUIRED');assert.equal(count(s,'Create'),0);assert.equal(resolve('create',reply.code).id,'terminal-project-folder','Known folder requirement must not become unknown-error');}finally{await s.close();}
});

test('independent actual default-unavailable receipt should reach the existing availability explanation',async()=>{
 class Node{constructor(doc){this.ownerDocument=doc;this.children=[];this.style={};this.dataset={};}append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}setAttribute(){}addEventListener(){}removeEventListener(){}focus(){}}
 const document={createElement:()=>new Node(document)},container=new Node(document);const controls=createTerminalControls({container});
 try{const reply=await controls.createSession();assert.equal(reply.code,'TERMINAL_UNAVAILABLE');assert.equal(resolve('create',reply.code).id,'terminal-unavailable','Known default source-only availability must not become unknown-error');}finally{controls.dispose();await controls.drain();}
});

test('independent replay and refused control paste are real local receipts have exact searchable manual meaning',async()=>{
 const replay=setup({direct:true});try{await replay.attach();const reply=await replay.api.paste('hello');assert.equal(reply.code,'REPLAY_PENDING');assert.equal(count(replay,'Input'),0);assert.equal(resolve('input',reply.code).id,reply.code==='REPLAY_PENDING'?'terminal-replay':'terminal-paste');assert.ok(resolver.search({query:reply.code}).includes(resolve('input',reply.code).id));}finally{await replay.close();}
 const paste=setup({direct:true,end:0});try{await paste.attach();const reply=await paste.api.paste('\u001b[31m');assert.equal(reply.code,'PASTE_CONTROL_REFUSED');assert.equal(count(paste,'Input'),0);assert.equal(resolve('input',reply.code).id,reply.code==='REPLAY_PENDING'?'terminal-replay':'terminal-paste');assert.ok(resolver.search({query:reply.code}).includes(resolve('input',reply.code).id));}finally{await paste.close();}
});

test('independent uncertain Stop remains blocked but its cleanup explanation is available in manual mapping and search',async()=>{
 const s=setup({end:0});try{await s.attach();assert.equal((await s.api.stopSession()).code,'RESPONSE_REFUSED');assert.equal(count(s,'Stop'),1);const retry=await s.api.stopSession();assert.equal(retry.code,'CLEANUP_UNVERIFIED');assert.equal(count(s,'Stop'),1);assert.equal(resolve('stop',retry.code).id,'terminal-cleanup');assert.ok(resolver.search({query:retry.code}).includes('terminal-cleanup'));}finally{await s.close();}
});

test('independent native diagnostic stage is not misdiagnosed as an ordinary Terminal command error',()=>{
 assert.equal(resolve('input','RAW_ENVIRONMENT').id,'unknown-error');assert.equal(resolve('input','ARM_CHALLENGE_COUNT').id,'unknown-error');assert.equal(resolver.resolve({code:'CWD_REFUSED'}).id,'unknown-error');
});
