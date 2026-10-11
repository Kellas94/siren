// Pure fixed probe-fragment regressions. No Electron/native/PTY is evaluated.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,win32} from 'node:path';
import {runInNewContext} from 'node:vm';
const parent=readFileSync(new URL('./native/terminal-session-runtime.mjs',import.meta.url),'utf8');
const worker=readFileSync(new URL('./native/terminal-session-runtime-worker.mjs',import.meta.url),'utf8');
test('actual controller root expression yields canonical resource root without terminal separator',()=>{
 const match=parent.match(/const root=(.+?),suffix=context.run/);assert.ok(match);
 const expression=match[1].replace('import.meta.url','moduleUrl');
 const root=runInNewContext(expression,{fileURLToPath,URL,resolve,moduleUrl:new URL('./native/terminal-session-runtime.mjs',import.meta.url).href});
 assert.equal(root,resolve(root),'resource inspector refuses trailing empty path components');
 assert.equal(win32.basename(root),'portable');
});
test('actual pre-Lock observation reads existing held capabilities without recapturing them',()=>{
 const start=worker.indexOf('const beforeSession='),end=worker.indexOf('const expected=',start);assert.ok(start>0&&end>start);
 const host={},session={},calls=[];
 const native={capture(){assert.fail('host held set already captured');},captureSession(){assert.fail('backend already captured Session held set');},snapshot(cap){assert.equal(cap,host);calls.push('host');return{root:{alive:true}};},snapshotSession(cap){assert.equal(cap,session);calls.push('session');return{shell:{alive:true}};}};
 const observed=runInNewContext(worker.slice(start,end)+';({beforeSession,beforeHost})',{native,nativeState:{host,sessions:[session]}});
 assert.equal(observed.beforeSession.shell.alive,true);assert.equal(observed.beforeHost.root.alive,true);assert.deepEqual(calls,['session','host']);
});

test('post-Lock refusal uses the original captured event without touching a destroyed Electron window',async()=>{
 const start=worker.indexOf('const refused=await first.router.route'),end=worker.indexOf(';assert.equal(refused.ok',start);assert.ok(start>0&&end>start);
 const caller={sender:{},senderFrame:{}},first={caller,grant:{epoch:1},lease:{sessionId:'session1'},w:{}};
 first.router={async route(q){assert.equal(q.event,caller);return{ok:false};}};
 const observed=await runInNewContext('(async()=>{'+worker.slice(start,end)+';return refused;})()',{
  first,event(){throw Error('Electron window is already destroyed');},request:(_grant,fields)=>fields,fixture:{forbiddenInput:'fixed probe only'}
 });
 assert.equal(observed.ok,false);
});

test('actual failure path keeps the native capability in scope and preserves history before cleanup',async()=>{
 const declaration=worker.match(/^ let graph[^\n]+/m)[0];
 const nativeLine=worker.match(/^  (?:const native=|native=)[^\n]+/m)[0].replace('import.meta.url','moduleUrl');
 const start=worker.indexOf('  if(members)try{'),end=worker.indexOf('\n  if(graph)try{',start);assert.ok(start>0&&end>start);
 const saved=[],cap={},snapshot={alive:true},history={chunks:['fixed fixture error']},result={};
 await runInNewContext('(async()=>{'+declaration+';members=fixtureMembers;try{'+nativeLine+';throw Error("fixed probe failure");}catch{'+worker.slice(start,end)+'} })()',{
  fixtureMembers:{ownership:{snapshot:()=>({sessions:[{state:'running',sessionOwnerId:'owner'}]})},backend:{readHistory:async q=>{assert.equal(q.ownerId,'owner');return history;}}},
  createRequire:()=>()=>({mark:()=>0,snapshotSession:q=>{assert.equal(q,cap);return snapshot;}}),moduleUrl:'fixed probe',addonPath:'fixed addon',
  nativeState:{sessions:[cap]},Object,result,bounded:async p=>p,save:async(name,value)=>saved.push({name,value})
 });
 assert.equal(result.failureDiagnosticError,undefined);
 assert.deepEqual(saved.map(r=>r.name),['failure-ownership.json','failure-native-session.json','failure-history.json']);
 assert.equal(saved[2].value,history);
});
