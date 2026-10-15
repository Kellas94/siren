// STRUCTURAL SOURCE DERIVATION ONLY. Never imports/loads an addon or native probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {deriveHostAsyncCandidate,HOST_ASYNC_BASE} from '../build/terminal-host-async-candidate-derive.mjs';
const old=new URL('../native/terminal-creator-three-lane/',import.meta.url),candidate=new URL('../native/terminal-creator-host-async/',import.meta.url),names={ownership:'ownership.cc',peer:'peer-endpoints.inc',binding:'binding.gyp'};
const base=Object.fromEntries(await Promise.all(Object.entries(names).map(async([k,f])=>[k,await readFile(new URL(f,old))]))),derived=deriveHostAsyncCandidate(base);
function section(source,start,end){const from=source.indexOf(start),to=source.indexOf(end,from+start.length);assert(from>=0&&to>from,'bounded source section');return source.slice(from,to);}
for(const[key,name]of Object.entries(names))test('STRUCTURAL exact derived bytes equal separate WIP '+name,async()=>assert.deepEqual(await readFile(new URL(name,candidate)),derived[key]));
for(const key of Object.keys(HOST_ASYNC_BASE))test('STRUCTURAL exact base drift refuses '+key,()=>assert.throws(()=>deriveHostAsyncCandidate({...base,[key]:Buffer.concat([base[key],Buffer.from('\n')])}),/HOST_ASYNC_BASE_DRIFT/));
const ownership=derived.ownership.toString(),peer=derived.peer.toString(),host=section(ownership,'struct HostAsyncShutdown {','napi_value CreateSession(');
test('STRUCTURAL new API retains exact duplicate Promise, operation identity and original deadline',()=>{
 const api=section(host,'napi_value StopAndCloseHostAsync(', 'return promise;\n}');
 assert.match(api,/GetHostIdentity\(env,a\[0\]\)/);assert.match(api,/prior->code!=code\|\|prior->timeout!=timeout\|\|prior->shutdownId!=shutdownId/);assert.match(api,/napi_get_reference_value\(env,prior->promiseRef,&same\)/);assert.match(api,/return same/);
 assert(api.indexOf('if(p->hostShutdown)')<api.indexOf('work->deadline=GetTickCount64()+timeout'));assert.match(api,/napi_create_reference\(env,a\[0\],1,&work->ownerRef\)/);assert.match(api,/p->asyncPending.store\(true\);p->hostShutdown=work.release\(\)/);
 assert.match(ownership,/Owner\* Get\([^\n]+p->asyncPending.load\(\)\|\|p->hostShutdown/);
});
test('STRUCTURAL host-only worker uses termination lock once, actual held identities and active-zero',()=>{
 const execute=section(host,'void HostAsyncExecute(', 'bool HostCloseHandleVerified(');
 assert.equal((execute.match(/TerminateJobObject\(/g)??[]).length,1);assert.match(execute,/if\(!p->stopping.load\(\)\)/);assert.match(execute,/std::lock_guard<std::mutex> termination\(p->terminationLock\)/);assert.match(execute,/Active\(p,active\)/);assert.match(execute,/HostExactExited\(p->root,dead\)/);assert.match(execute,/for\(const auto& m:p->held\)/);assert.match(execute,/if\(active==0&&dead\)break/);
 assert.doesNotMatch(execute,/SessionSnapshot|DisposeSession|sessionCount|SessionGet/);
 assert.match(host,/GetProcessId\(m.process.h\)!=m.pid/);assert.match(host,/Ticks\(c\)!=m.created/);assert.match(host,/QueryFullProcessImageNameW/);
});
test('STRUCTURAL bounded monitor cancellation stays off JS and never substitutes Dispose',()=>{
 const cancel=section(host,'bool HostCancelMonitor(', 'void HostAsyncExecute('),close=section(host,'bool HostCloseVerified(', 'void HostRejectRetained(');
 assert.match(cancel,/UnregisterWaitEx\(p->wait,work->cancelEvent.h\)/);assert.match(cancel,/ERROR_IO_PENDING/);assert.match(cancel,/work->deadline-now/);assert.doesNotMatch(cancel,/INVALID_HANDLE_VALUE|INFINITE|terminationLock/);
 assert.doesNotMatch(close.replace(/\/\/[^\n]*/g,''),/\bDispose\(\)|TerminateJobObject\(/);assert.match(close,/HostCloseHandleVerified\(p->root.process\)/);assert.match(close,/HostCloseHandleVerified\(p->job\)/);
});
test('STRUCTURAL final native snapshot precedes HANDLE closure and delivered host-only receipt',()=>{
 const complete=section(host,'void HostAsyncComplete(', 'void HostShutdownFinalize(');
 assert(complete.indexOf('Snapshot(env,p)')<complete.indexOf('HostCloseVerified(p)'));assert(complete.indexOf('HostCloseVerified(p)')<complete.indexOf('napi_resolve_deferred'));
 assert.match(complete,/HOST_AND_EXACT_PEER_ROSTER_ONLY/);assert.match(complete,/"sessionCleanupJoined",Boolean\(env,false\)/);assert.match(complete,/"shutdownId",shutdownId/);assert.match(complete,/PeerHostRosterJoined\(work->peers\)!=1/);
 assert(complete.indexOf('napi_remove_async_cleanup_hook')<complete.indexOf('napi_resolve_deferred'));assert(complete.indexOf('napi_delete_async_work')<complete.indexOf('napi_resolve_deferred'));
});
test('STRUCTURAL exact shared peer membership survives ownerKey retirement and is retained before clear',()=>{
 const roster=section(peer,'bool PeerCaptureAndRetireHost(', 'void PeerRetireSession(');
 assert.match(roster,/p->hostOwnerToken!=owner->peerOwnerToken/);assert(roster.indexOf('rows.push_back(p)')<roster.indexOf('p->ownerKey=nullptr'));assert.match(peer,/p->hostOwnerToken=host->peerOwnerToken/);assert.match(roster,/rows.size\(\)>=8/);
 assert.match(roster,/p->nativeReaped&&p->jsDeliveryVerified&&p->tsfnFinalized/);assert.doesNotMatch(roster,/return p->settled|peerMainPairs.load/);
});
test('STRUCTURAL TSFN finalization joins real worker asynchronously and verifies deliveries before wipe',()=>{
 const finalize=section(peer,'struct PeerFinalizationWork {','bool PeerReject(');
 const call=section(peer,'void PeerThreadsafeFinalize(', 'bool PeerReject(');assert.match(call,/napi_create_async_work/);assert.doesNotMatch(call,/WaitForSingleObject/);
 assert.match(finalize,/work->joined=!thread\|\|WaitForSingleObject\(thread,INFINITE\)==WAIT_OBJECT_0/);assert.match(finalize,/r->nativeDone&&r->jsDone&&!r->delivering&&r->bytesReleased/);
 assert(finalize.indexOf('if(!p->nativeReaped||!delivered)return false')<finalize.indexOf('p->requests.clear()'));assert(finalize.indexOf('PeerEnvironmentFinished(environment)')<finalize.indexOf('p->tsfnFinalized=true'));
 assert.match(peer,/p->deliveryAbandoned=true/);assert.match(finalize,/peerFinalizationQuarantine.push_back\(work\)/);
});
test('STRUCTURAL timeout/error retains context and async environment hook; legacy Session cleanup stays separate',()=>{
 const reject=section(host,'void HostRejectRetained(', 'void HostAsyncComplete('),hook=section(host,'void HostAsyncEnvironmentCleanup(', 'bool HostShutdownId(');
 assert.doesNotMatch(reject,/napi_delete_reference|napi_delete_async_work|asyncPending.store\(false\)|peers.clear/);assert.doesNotMatch(hook,/napi_remove_async_cleanup_hook|delete work|closed.*true/);assert.match(hook,/environmentClosing.store\(true\)/);
 const oldSession=section(base.ownership.toString().replaceAll('\r\n','\n'),'// Cleanup only: startup remains synchronous','napi_value WatchRoot('),newSession=section(ownership,'// Cleanup only: startup remains synchronous','napi_value WatchRoot(');assert.equal(newSession,oldSession);
});
test('STRUCTURAL separate binding keeps required Windows flags and distinct target',()=>{const b=JSON.parse(derived.binding);assert.equal(b.targets[0].target_name,'siren_terminal_creator_host_async');assert(b.targets[0].defines.includes('NAPI_VERSION=10'));assert(b.targets[0].defines.includes('_WIN32_WINNT=0x0A00'));assert.deepEqual(b.targets[0].sources,['ownership.cc']);});

// Four v2 source guards correspond to the genuine independent v1 findings.
// Their RED against v1 and subsequent source correction are retained separately.
test('CORRECTION HANDLE failure retains exact peer identity, membership and counted quarantine without false reap',()=>{
 const drain=section(peer,'bool PeerDrainLocked(', 'bool PeerAppendWait('),finish=section(peer,'bool PeerFinishFinalization(', 'void PeerFinalizationExecute(');
 assert.doesNotMatch(drain.replace(/\/\/[^\n]*/g,''),/=Handle\(\)/,'unchecked drain reset loses the failed handle');
 assert.doesNotMatch(finish.replace(/\/\/[^\n]*/g,''),/=Handle\(\)/,'unchecked finalizer reset loses the failed handle');
 const close=section(peer,'bool PeerCloseHandleLocked(', 'bool PeerCloseDrainHandlesLocked(');
 assert.match(close,/if\(!CloseHandle\(value.h\)\)/);assert(close.indexOf('return false')<close.indexOf('value.h=nullptr'));
 assert.match(close,/p->finalizationFailed=true/);assert.match(close,/p->nativeReaped=false/);assert.match(close,/p->handleCloseError=GetLastError\(\)/);
 assert(drain.indexOf('PeerCloseDrainHandlesLocked(p)')<drain.indexOf('p->nativeReaped=true'));
 const worker=section(peer,'DWORD WINAPI PeerWorker(', 'std::shared_ptr<PeerPair> PeerNewPair(');
 assert.match(worker,/if\(p->finalizationFailed\)done=true/);assert.match(worker,/PeerRetainPair\(p\)/);
 const retain=section(peer,'void PeerRetainPair(', 'bool PeerCloseHandleLocked(');
 assert.match(retain,/if\(!p->quarantined\)/);assert.match(retain,/peerPairQuarantine.push_back\(p\)/);assert.doesNotMatch(retain,/PeerReleaseCapacity|hostOwnerToken.reset|ownerKey=nullptr/);
});
test('CORRECTION async-work deletion failure retains raw transaction before any final join or capacity refund',()=>{
 const complete=section(peer,'void PeerFinalizationComplete(', 'void PeerThreadsafeFinalize(');
 assert.match(complete,/if\(napi_delete_async_work\(env,work->task\)!=napi_ok\)/);
 assert(complete.indexOf('napi_delete_async_work')<complete.indexOf('PeerFinishFinalization'));
 const failed=section(complete,'if(napi_delete_async_work', 'work->task=nullptr');
 assert.match(failed,/PeerRetainFinalization\(work.release\(\)\);return/);assert.doesNotMatch(failed,/PeerReleaseCapacity|delete work|PeerFinishFinalization/);
 const retain=section(peer,'void PeerRetainFinalization(', 'bool PeerFinishFinalization(');
 assert.match(retain,/PeerRetainPair\(work->pair\)/);assert.match(retain,/peerFinalizationQuarantine.push_back\(work\)/);
 assert.doesNotMatch(retain,/napi_delete_async_work|PeerReleaseCapacity/);
});
test('CORRECTION cleanup-hook removal failure keeps finite environment slot and raw callback ownership',()=>{
 assert.match(peer,/constexpr size_t peerEnvironmentLimit=9/);
 const close=section(peer,'bool PeerCloseEnvironment(', 'bool PeerEnvironmentFinished(');
 assert.match(close,/if\(napi_remove_async_cleanup_hook\(e->hook\)!=napi_ok\)/);
 const failed=section(close,'if(napi_remove_async_cleanup_hook', 'e->hook=nullptr');
 assert.match(failed,/e->releaseFailed=true/);assert.match(failed,/return false/);assert.doesNotMatch(failed,/delete e|peerEnvironments.erase|hook=nullptr/);
 assert(close.indexOf('e->releaseAttempted=true')<close.indexOf('napi_remove_async_cleanup_hook'));
 const initialize=section(peer,'bool PeerInitialize(', '// A TSFN callback');
 assert.match(initialize,/peerEnvironments.size\(\)>=peerEnvironmentLimit/);assert.match(initialize,/!e->closing&&!e->releaseFailed&&!e->releaseAttempted/);
 const finish=section(peer,'bool PeerFinishFinalization(', 'void PeerFinalizationExecute(');
 assert(finish.indexOf('if(!PeerEnvironmentFinished(environment))return false')<finish.indexOf('PeerReleaseCapacity'));
});
test('CORRECTION genuine legacy source capability families are rejected by new tags before unwrap/layout reads',async()=>{
 const oldHost=base.ownership.toString(),oldPeer=base.peer.toString(),tags=(s)=>new Map([...s.matchAll(/const napi_type_tag (\w+)=\{([^}]+)\}/g)].map(m=>[m[1],m[2]]));
 const legacy=tags(oldHost+'\n'+oldPeer),current=tags(ownership+'\n'+peer),families=['tag','sessionTag','peerPairTag','peerEndpointTag','peerWitnessTag'];
 assert.equal(current.size,5);assert.equal(new Set(current.values()).size,5);
 for(const family of families){assert(legacy.has(family),'genuine old source tag exists');assert.notEqual(current.get(family),legacy.get(family),family+' must reject genuine legacy capabilities');}
 for(const [text,start,end]of [[ownership,'Owner* GetHostIdentity(','Owner* Get('],[ownership,'Session* SessionGet(','void CALLBACK ShellExit('],[peer,'PeerCapability* PeerGetCapability(','PeerPair* PeerPairGet(']]){
  const get=section(text,start,end);assert(get.indexOf('napi_check_object_type_tag')<get.indexOf('napi_unwrap'));assert(get.indexOf('napi_unwrap')<get.indexOf('static_cast<'));assert.match(get,/!valid|!yes/);
 }
});
