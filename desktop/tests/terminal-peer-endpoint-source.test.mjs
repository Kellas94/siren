// Pure source preparation only. Never load/compile the candidate addon here.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const hash=b=>createHash('sha256').update(b).digest('hex');
const source=await read('../native/terminal-creator-async/ownership.cc');
const binding=await read('../native/terminal-creator-async/binding.gyp');
const api=await import('../src/terminal/peer-endpoint-source.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
async function candidate(){
 assert.equal(typeof api.derivePeerEndpointOwnership,'function','Separate peer derivation must exist');
 const endpointSource=await read('../native/terminal-creator-peer/peer-endpoints.inc');
 return api.derivePeerEndpointOwnership({source,binding,endpointSource});
}
test('historical qualified async inputs are still exact raw pinned bytes',()=>{
 assert.equal(hash(source),'69b6780f6edf1fa838f97fbf0835a819d9433d01dbf6a4460f8294336c090659');
 assert.equal(hash(binding),'8d2847b9e34fa5466d16a2f53e94c795ab7f745d49967752e39789072eee4751');
});
test('peer variant has a separate target and exact deterministic checked-in derivation',async()=>{
 const r=await candidate();assert.equal(r.compiled,false);assert.equal(r.admitted,false);
 assert.equal(r.source,await read('../native/terminal-creator-peer/ownership.cc'));
 assert.deepEqual(r.binding,JSON.parse(await read('../native/terminal-creator-peer/binding.gyp')));
 assert.equal(r.binding.targets[0].target_name,'siren_terminal_creator_peer');
 assert.ok(r.binding.targets[0].libraries.includes('advapi32.lib'));
 assert.equal(r.sha256,hash(r.source));assert.equal(r.endpointSha256,hash(r.endpointSource));
});
test('source derivation refuses changed base, build recipe and native endpoint implementation',async()=>{
 const r=await candidate();
 for(const key of ['source','binding','endpointSource']){
  const args={source,binding,endpointSource:r.endpointSource};args[key]+='\n';
  assert.throws(()=>api.derivePeerEndpointOwnership(args),/PEER_SOURCE_DRIFT/);
 }
});
test('old bootstrapped creation and native asynchronous retirement worker remain unchanged',async()=>{
 const r=await candidate();
 const start=source.indexOf('napi_value CreateBootstrappedSession('),end=source.indexOf('// Cleanup only:');
 assert.ok(start>=0&&end>start);assert.ok(r.source.includes(source.slice(start,end)));
 const worker=source.slice(source.indexOf('struct AsyncStopWork {'),source.indexOf('napi_value StopAndCloseSessionAsync('));assert.ok(r.source.includes(worker));
});
test('main witness is the third explicit inherited handle and never a command/environment argument',async()=>{
 const r=await candidate(),s=r.source.slice(r.source.indexOf('napi_value CreatePeerSession('),r.source.indexOf('napi_value CreateBootstrappedSession('));
 assert.match(s,/HANDLE inherited\[\]=\{bootstrap\.read\.h,bootstrap\.discard\.h,inheritedWitness\.h\}/);
 assert.match(s,/attributes\.InitPeerBootstrap\(jobs,inherited\)/);
 assert.match(r.source,/PROC_THREAD_ATTRIBUTE_HANDLE_LIST,inherited,3\*sizeof\(HANDLE\)/);
 const command=s.slice(s.indexOf('std::wstring command='),s.indexOf('STARTUPINFOEXW'));
 assert.doesNotMatch(command,/peerPacket|inheritedWitness|packet|secret|HANDLE/);
 assert.match(s,/inheritedWitness=Handle\(\)/);
});
test('exact held creator binding and bootstrap filling occur before Resume',async()=>{
 const r=await candidate(),s=r.source.slice(r.source.indexOf('napi_value CreatePeerSession('),r.source.indexOf('napi_value CreateBootstrappedSession('));
 const identity=s.indexOf('ReadIdentity(p->root)'),bind=s.indexOf('PeerBindCreator(env,pair,p.get())'),fill=s.indexOf('bootstrap.Fill(peerPacket.bytes)'),resume=s.indexOf('ResumeThread(thread.h)');
 assert.ok(identity>=0&&identity<bind&&bind<fill&&fill<resume);
 assert.match(s,/PeerAbortStartup\(pair\)/);assert.match(s,/guard\.committed=true/);
});
test('query-job duplicates cannot postpone explicit owner and session termination',async()=>{
 const r=await candidate(),s=r.source;
 const dispose=s.slice(s.indexOf('bool Dispose(){'),s.indexOf('bool Dispose(){')+1100);
 assert.match(dispose,/PeerRetireOwner\(this\)/);
 assert.match(dispose,/if\(job\.h&&!TerminateJobObject\(job\.h,77\)\)return false/);
 assert.ok(dispose.indexOf('TerminateJobObject')<dispose.indexOf('job=Handle()'));
 const session=s.slice(s.indexOf('bool DisposeSession(){'),s.indexOf('bool DisposeSession(){')+900);
 assert.match(session,/PeerRetireSession\(this\)/);
});
test('explicit async Stop fences copied endpoint authority only after work is committed',async()=>{
 const {source:s}=await candidate(),callback=s.slice(s.indexOf('napi_value StopAndCloseSessionAsync('),s.indexOf('napi_value WatchRoot('));
 const queue=callback.indexOf('napi_queue_async_work'),retire=callback.indexOf('PeerRetireSession(p)'),release=callback.indexOf('work.release()');
 assert.ok(queue>=0&&queue<retire&&retire<release);
 assert.match(callback,/if\(napi_queue_async_work\(env,work->task\)!=napi_ok\)return failure\(\)/);
});
test('only new opaque peer APIs are added and no admission claim is generated',async()=>{
 const r=await candidate();
 for(const name of ['createPeerSession','createPeerListeners','acceptPeerLane','connectPeerLane','peerRead','peerWrite','assertPeerCurrent','closePeerEndpoint','closePeerListeners','peerSnapshot','consumePeerBootstrap','closePeerWitness'])
  assert.ok(r.source.includes('{"'+name+'",'));
 assert.match(r.source,/PeerInitialize\(env\)/);
 assert.doesNotMatch(r.source,/nativeExecutionAdmitted[=:]true|ADMITTED_TERMINAL/);
});
test('native endpoints use both kernel query directions and retained handles without PID reopening',async()=>{
 const {endpointSource:s}=await candidate();
 for(const text of ['GetNamedPipeClientProcessId','GetNamedPipeServerProcessId','GetProcessTimes','QueryFullProcessImageNameW','MemberOf','PROCESS_QUERY_LIMITED_INFORMATION|SYNCHRONIZE','JOB_OBJECT_QUERY','FILE_FLAG_FIRST_PIPE_INSTANCE','PIPE_REJECT_REMOTE_CLIENTS','TokenLogonSid'])assert.ok(s.includes(text),text);
 assert.doesNotMatch(s,/OpenProcess\(|WaitNamedPipe|DisconnectNamedPipe|FlushFileBuffers|napi_async_work|napi_queue_async_work|uv_threadpool/);
});
test('native cancellation reaps overlapped work and idle reads retain bounded occupied slots',async()=>{
 const {endpointSource:s}=await candidate();
 for(const text of ['CancelIoEx','GetOverlappedResult','WaitForMultipleObjects','PeerReadOccupiedLocked','PeerWriteOccupiedLocked','peerReadLimit=32768','peerWriteLimits[2]={2048,90120}','readIdleTimeout'])assert.ok(s.includes(text),text);
 assert.match(s,/r->kind!=PeerRequestKind::Read[^\n]*now>=r->deadline/);
 assert.match(s,/r->kind!=PeerRequestKind::Read[^\n]*GetTickCount64\(\)>=r->deadline/);
 assert.match(s,/PeerReleaseCapacity/);assert.match(s,/napi_add_async_cleanup_hook/);
});
