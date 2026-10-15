// Source-only preparation: never compile/load the native variant locally.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');const source=await read('../native/terminal-creator-bootstrap/ownership.cc'),binding=await read('../native/terminal-creator-bootstrap/binding.gyp');
const api=await import('../src/terminal/async-cleanup-source.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
test('async cleanup has separate pinned source and target and refuses drift',async()=>{
 assert.equal(typeof api.deriveAsyncCleanupOwnership,'function');const r=api.deriveAsyncCleanupOwnership({source,binding});assert.equal(r.compiled,false);assert.equal(r.admitted,false);
 assert.equal(r.source,await read('../native/terminal-creator-async/ownership.cc'));assert.deepEqual(r.binding,JSON.parse(await read('../native/terminal-creator-async/binding.gyp')));assert.equal(r.binding.targets[0].target_name,'siren_terminal_creator_async');assert.throws(()=>api.deriveAsyncCleanupOwnership({source:source+'\n',binding}),/ASYNC_SOURCE_DRIFT/);
});
test('blocking Stop, process waits and callback cancellation run only in execute callback',()=>{
 assert.equal(typeof api.deriveAsyncCleanupOwnership,'function');const s=api.deriveAsyncCleanupOwnership({source,binding}).source;
 // AsyncExited is the worker-only helper that samples held process handles.
 const execute=s.slice(s.indexOf('bool AsyncExited('),s.indexOf('void AsyncStopComplete('));assert.match(execute,/TerminateJobObject/);assert.match(execute,/WaitForSingleObject/);assert.match(execute,/UnregisterWaitEx/);assert.doesNotMatch(execute,/napi_[a-z_]+\(/);
 const start=s.slice(s.indexOf('napi_value StopAndCloseSessionAsync('),s.indexOf('napi_value WatchRoot('));assert.match(start,/napi_queue_async_work/);assert.doesNotMatch(start,/WaitForSingleObject|UnregisterWaitEx|TerminateJobObject|Sleep\(/);
});
test('pending async cleanup retains the opaque owner and refuses competing operations',()=>{
 assert.equal(typeof api.deriveAsyncCleanupOwnership,'function');const s=api.deriveAsyncCleanupOwnership({source,binding}).source;
 assert.match(s,/std::atomic<bool> asyncPending\{false\}/);assert.match(s,/napi_create_reference\(env,a\[0\],1,&work->ownerRef\)/);assert.match(s,/if\(p->asyncPending\.load\(\)\).*SESSION_ASYNC_PENDING/);
 const complete=s.slice(s.indexOf('void AsyncStopComplete('),s.indexOf('napi_value StopAndCloseSessionAsync('));assert.match(complete,/DisposeSession\(\)/);assert.match(complete,/napi_delete_reference/);assert.match(complete,/napi_delete_async_work/);assert.match(complete,/asyncPending\.store\(false\)/);
});
test('async deadline includes queue time and requires accounting plus every held process exit',()=>{
 assert.equal(typeof api.deriveAsyncCleanupOwnership,'function');const s=api.deriveAsyncCleanupOwnership({source,binding}).source;
 assert.match(s,/work->deadline=GetTickCount64\(\)\+timeout/);assert.match(s,/GetTickCount64\(\)>=work->deadline/);assert.match(s,/!Active\(p,count\)/);assert.match(s,/for\(const auto& held:p->held\)/);assert.match(s,/p->shell\.process\.h/);assert.match(s,/ASYNC_STOP_DEADLINE/);assert.match(s,/timeout>10000/);
 const bootstrap=source.slice(source.indexOf('napi_value CreateBootstrappedSession('),source.indexOf('napi_value WatchRoot('));assert.ok(s.includes(bootstrap));
});
test('async retirement returns an actual bounded native observation captured before disposal',()=>{
 assert.equal(typeof api.deriveAsyncCleanupOwnership,'function');const s=api.deriveAsyncCleanupOwnership({source,binding}).source;
 const callback=s.slice(s.indexOf('void AsyncStopComplete('),s.indexOf('napi_value StopAndCloseSessionAsync('));
 const snapshot=callback.indexOf('SessionSnapshot(env,p)'),dispose=callback.indexOf('DisposeSession()'),publish=callback.indexOf('napi_resolve_deferred(env,work->deferred,result)');
 assert.ok(snapshot>=0&&snapshot<dispose&&dispose<publish,'Final held-handle observation must precede disposal');
 assert.match(callback,/Set\(env,result,"snapshot",snapshot\)/);assert.match(callback,/Set\(env,result,"closed",Boolean\(env,true\)\)/);
 const closed=callback.indexOf('Set(env,result,"closed"'),guard=callback.lastIndexOf('GetTickCount64()>=work->deadline');assert.ok(closed<guard&&guard<publish);
});
