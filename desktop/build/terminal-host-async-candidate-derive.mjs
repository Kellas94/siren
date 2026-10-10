// WIP source derivation only. Importing this module never loads/builds native code.
// Exact old bytes are inputs; new candidate normalizes line endings to LF.
import {createHash} from 'node:crypto';
export const HOST_ASYNC_BASE=Object.freeze({
 ownership:'c1e603ba57daacb8051f06dd846f0cb057d6f3754f6e65d835e6f65fcbb142c9',
 peer:'5ab996ae571763b82d1d839ee6c34a8696253e811250a87e184fc274174ab384',
 binding:'77ed3cfe728eb3273a80106b84cc3c70b4d4d3d98aff0334f96ee2483e7b8cb4'
});
const hash=b=>createHash('sha256').update(b).digest('hex');
function once(text,from,to,label){if(text.split(from).length!==2)throw Error('HOST_ASYNC_ANCHOR_DRIFT:'+label);return text.replace(from,to);}
function betweenOnce(text,start,end,replacement,label){if(text.split(start).length!==2||text.split(end).length!==2)throw Error('HOST_ASYNC_SECTION_DRIFT:'+label);const from=text.indexOf(start),to=text.indexOf(end,from+start.length);if(to<0)throw Error('HOST_ASYNC_SECTION_ORDER:'+label);return text.slice(0,from)+replacement+text.slice(to);}
const peerReleaseHelpers=String.raw`
// Unknown release retains this exact pair and its finite counted slot. There
// can be at most eight main pairs plus one creator pair in this addon instance.
std::vector<std::shared_ptr<PeerPair>> peerPairQuarantine;
void PeerRetainPair(const std::shared_ptr<PeerPair>& p){
 std::lock_guard<std::mutex> registry(peerRegistryLock);
 std::lock_guard<std::recursive_mutex> guard(p->lock);
 p->finalizationFailed=true;p->nativeReaped=false;
 if(!p->quarantined){p->quarantined=true;peerPairQuarantine.push_back(p);}
}
bool PeerCloseHandleLocked(PeerPair* p,Handle& value){
 if(!value.h)return true;
 if(!CloseHandle(value.h)){p->handleCloseError=GetLastError();p->finalizationFailed=true;p->nativeReaped=false;return false;}
 value.h=nullptr;return true;
}
bool PeerCloseDrainHandlesLocked(PeerPair* p){
 for(auto& l:p->lanes){if(!PeerCloseHandleLocked(p,l.pipe))return false;l.connected=false;}
 return PeerCloseHandleLocked(p,p->peer.process)&&PeerCloseHandleLocked(p,p->hostWitness.process)&&PeerCloseHandleLocked(p,p->mainWitness.process)&&PeerCloseHandleLocked(p,p->commonJob)&&PeerCloseHandleLocked(p,p->sessionJob);
}
bool PeerCloseFinalHandlesLocked(PeerPair* p){
 if(!PeerCloseHandleLocked(p,p->thread))return false;
 for(auto& l:p->lanes)if(!PeerCloseHandleLocked(p,l.pipe)||!PeerCloseHandleLocked(p,l.readEvent)||!PeerCloseHandleLocked(p,l.writeEvent))return false;
 return PeerCloseHandleLocked(p,p->wake)&&PeerCloseDrainHandlesLocked(p);
}
`;
const peerEnvironment=String.raw`
// Environment slots remain occupied until hook removal is confirmed. A failed
// attempt is terminal: never retry removal against an unknown callback state.
constexpr size_t peerEnvironmentLimit=9;
bool PeerCloseEnvironment(PeerEnvironment* e){
 {std::lock_guard<std::mutex> registry(peerRegistryLock);
  if(!e||!e->closing||e->active!=0||e->releaseFailed||e->releaseAttempted)return false;
  e->releaseAttempted=true;
 }
 if(napi_remove_async_cleanup_hook(e->hook)!=napi_ok){
  std::lock_guard<std::mutex> registry(peerRegistryLock);e->releaseFailed=true;return false;
 }
 e->hook=nullptr;
 {std::lock_guard<std::mutex> registry(peerRegistryLock);
  for(auto it=peerEnvironments.begin();it!=peerEnvironments.end();++it)if(*it==e){peerEnvironments.erase(it);break;}
 }
 delete e;return true;
}
bool PeerEnvironmentFinished(PeerEnvironment* e){
 bool close=false;
 {std::lock_guard<std::mutex> registry(peerRegistryLock);
  if(!e||e->releaseFailed||e->releaseAttempted||e->active==0)return false;
  --e->active;close=e->closing&&e->active==0;
 }
 return !close||PeerCloseEnvironment(e);
}
void PeerEnvironmentCleanup(napi_async_cleanup_hook_handle,void* data){
 auto* e=static_cast<PeerEnvironment*>(data);bool empty=false;
 {std::lock_guard<std::mutex> registry(peerRegistryLock);e->closing=true;
  for(auto& weak:peerRegistry)if(auto p=weak.lock()){
   std::lock_guard<std::recursive_mutex> guard(p->lock);if(p->environment==e)PeerRetireLocked(p.get(),"PEER_ENVIRONMENT_CLOSING");
  }
  empty=e->active==0;
 }
 if(empty)PeerCloseEnvironment(e); // Failure retains e/hook and the quota slot.
}
bool PeerInitialize(napi_env env){
 std::lock_guard<std::mutex> registry(peerRegistryLock);
 for(auto* e:peerEnvironments)if(e->env==env)return !e->closing&&!e->releaseFailed&&!e->releaseAttempted;
 if(peerEnvironments.size()>=peerEnvironmentLimit)return false;
 std::unique_ptr<PeerEnvironment> e(new PeerEnvironment());e->env=env;
 if(napi_add_async_cleanup_hook(env,PeerEnvironmentCleanup,e.get(),&e->hook)!=napi_ok)return false;
 peerEnvironments.push_back(e.release());return true;
}
`;
const peerFinalization=String.raw`
// A TSFN callback returning does not prove its producer thread has exited.
// Join the actual thread on a native async worker, never on the JS thread.
struct PeerFinalizationWork {std::shared_ptr<PeerPair> pair;napi_async_work task=nullptr;bool joined=false,quarantined=false;};
std::vector<PeerFinalizationWork*> peerFinalizationQuarantine;
void PeerRetainFinalization(PeerFinalizationWork* work){
 PeerRetainPair(work->pair);
 std::lock_guard<std::mutex> registry(peerRegistryLock);
 // A TSFN creates one finalization transaction, queued at most once. Its
 // counted quarantined pair cannot be replaced, bounding raw contexts at nine.
 if(!work->quarantined){work->quarantined=true;peerFinalizationQuarantine.push_back(work);}
}
bool PeerFinishFinalization(napi_env env,const std::shared_ptr<PeerPair>& p){
 PeerEnvironment* environment=nullptr;bool closing=!env;
 {std::lock_guard<std::mutex> registry(peerRegistryLock);environment=p->environment;closing=closing||!environment||environment->closing;}
 {std::lock_guard<std::recursive_mutex> guard(p->lock);
  if(p->finalizationFailed)return false;
  bool delivered=!closing&&!p->deliveryAbandoned;
  for(const auto& r:p->requests)delivered=delivered&&r->nativeDone&&r->jsDone&&!r->delivering&&r->bytesReleased;
  if(!p->nativeReaped||!delivered)return false;
  PeerObserveLocked(p.get());if(p->peer.process.h)p->peerObservedBeforeClose=true;
  if(!PeerCloseFinalHandlesLocked(p.get()))return false;
 }
 if(!PeerEnvironmentFinished(environment))return false;
 {std::lock_guard<std::recursive_mutex> guard(p->lock);
  for(auto& l:p->lanes){l.start.reset();l.read.reset();l.writes.clear();l.writeReserved=0;}
  p->requests.clear();p->tsfn=nullptr;p->jsDeliveryVerified=true;
 }
 {std::lock_guard<std::mutex> registry(peerRegistryLock);
  for(auto it=peerRegistry.begin();it!=peerRegistry.end();){auto item=it->lock();if(!item||item.get()==p.get())it=peerRegistry.erase(it);else ++it;}
 }
 PeerReleaseCapacity(p.get());
 {std::lock_guard<std::recursive_mutex> guard(p->lock);p->environment=nullptr;p->hostOwnerToken.reset();p->tsfnFinalized=true;}
 return true;
}
void PeerFinalizationExecute(napi_env,void* context){
 auto* work=static_cast<PeerFinalizationWork*>(context);HANDLE thread=nullptr;
 {std::lock_guard<std::recursive_mutex> guard(work->pair->lock);thread=work->pair->thread.h;}
 // This wait has no JS dependency. Host's independent deadline never refunds it.
 work->joined=!thread||WaitForSingleObject(thread,INFINITE)==WAIT_OBJECT_0;
}
void PeerFinalizationComplete(napi_env env,napi_status status,void* context){
 std::unique_ptr<PeerFinalizationWork> work(static_cast<PeerFinalizationWork*>(context));
 if(status!=napi_ok||!work->joined){PeerRetainFinalization(work.release());return;}
 if(napi_delete_async_work(env,work->task)!=napi_ok){PeerRetainFinalization(work.release());return;}
 work->task=nullptr;
 if(!PeerFinishFinalization(env,work->pair)){PeerRetainFinalization(work.release());return;}
}
void PeerThreadsafeFinalize(napi_env env,void* data,void*){
 std::unique_ptr<std::shared_ptr<PeerPair>> held(static_cast<std::shared_ptr<PeerPair>*>(data));
 auto work=std::make_unique<PeerFinalizationWork>();work->pair=*held;napi_value name=nullptr;
 bool failed=false;{std::lock_guard<std::recursive_mutex> guard(work->pair->lock);failed=work->pair->finalizationFailed;}
 if(failed){PeerRetainFinalization(work.release());return;}
 if(!env||napi_create_string_utf8(env,"siren-terminal-peer-finalization",NAPI_AUTO_LENGTH,&name)!=napi_ok||
    napi_create_async_work(env,nullptr,name,PeerFinalizationExecute,PeerFinalizationComplete,work.get(),&work->task)!=napi_ok||
    napi_queue_async_work(env,work->task)!=napi_ok){PeerRetainFinalization(work.release());return;}
 work.release();
}
`;
const peerRoster=String.raw`
// Stable shared membership survives ownerKey/sessionKey retirement. It is not
// a process/Job count and never dereferences a potentially retired Owner key.
bool PeerCaptureAndRetireHost(Owner* owner,std::vector<std::shared_ptr<PeerPair>>& rows){
 std::lock_guard<std::mutex> registry(peerRegistryLock);rows.reserve(8);
 for(auto& weak:peerRegistry)if(auto p=weak.lock()){
  std::lock_guard<std::recursive_mutex> guard(p->lock);
  if(p->hostOwnerToken!=owner->peerOwnerToken)continue;
  if(!p->server||rows.size()>=8)return false;
  rows.push_back(p); // Retain exact shared_ptr BEFORE ownerKey is cleared.
  p->ownerKey=nullptr;PeerRetireLocked(p.get(),"PEER_HOST_ASYNC_RETIRED");
 }
 return true;
}
int PeerHostRosterJoined(const std::vector<std::shared_ptr<PeerPair>>& rows){
 bool joined=true;for(const auto& p:rows){std::lock_guard<std::recursive_mutex> guard(p->lock);
  if(p->finalizationFailed||p->deliveryAbandoned)return -1;
  joined=joined&&p->nativeReaped&&p->jsDeliveryVerified&&p->tsfnFinalized&&p->requests.empty()&&p->environment==nullptr&&!p->thread.h&&!p->tsfn;
 }return joined?1:0;
}
`;
const hostExtension=String.raw`
// WIP HOST + EXACT PEER ROSTER ONLY. Full JS Session/allocation cleanup join is
// deliberately UNIMPLEMENTED and must be consumed separately before app exit.
struct HostAsyncShutdown {
 Owner* owner=nullptr;napi_env env=nullptr;napi_ref ownerRef=nullptr,promiseRef=nullptr;
 napi_async_work task=nullptr;napi_deferred deferred=nullptr;napi_async_cleanup_hook_handle cleanupHook=nullptr;
 std::atomic<bool> environmentClosing{false};
 DWORD code=0,timeout=0;ULONGLONG deadline=0;std::wstring shutdownId;const char* error=nullptr;
 Handle cancelEvent;bool cancellationRequested=false,workerCompleted=false;
 std::vector<std::shared_ptr<PeerPair>> peers;
};
bool HostCloseHandleVerified(Handle&);
void HostAsyncEnvironmentCleanup(napi_async_cleanup_hook_handle,void* context){
 auto* work=static_cast<HostAsyncShutdown*>(context);work->environmentClosing.store(true);
 // Strong refs prevent GC, not environment destruction. This hook stays until
 // verified completion. Unknown/timeout intentionally retains it (may stall
 // teardown); forced process exit still needs external Safety qualification.
}
bool HostShutdownId(napi_env env,napi_value value,std::wstring& text){
 if(!String(env,value,text)||text.size()>128)return false;
 for(wchar_t c:text)if(!((c>=L'a'&&c<=L'z')||(c>=L'A'&&c<=L'Z')||(c>=L'0'&&c<=L'9')||c==L'_'||c==L'-'))return false;
 return true;
}
bool HostExactExited(const Member& m,bool& dead){
 if(!m.process.h||GetProcessId(m.process.h)!=m.pid)return false;
 FILETIME c,e,k,u;if(!GetProcessTimes(m.process.h,&c,&e,&k,&u)||Ticks(c)!=m.created)return false;
 wchar_t image[32768];DWORD length=32768;
 if(!QueryFullProcessImageNameW(m.process.h,0,image,&length)||length!=m.image.size()||CompareStringOrdinal(image,static_cast<int>(length),m.image.c_str(),static_cast<int>(m.image.size()),TRUE)!=CSTR_EQUAL)return false;
 DWORD state=WaitForSingleObject(m.process.h,0),code=0;
 if((state!=WAIT_OBJECT_0&&state!=WAIT_TIMEOUT)||!GetExitCodeProcess(m.process.h,&code))return false;
 dead=dead&&state==WAIT_OBJECT_0;return true;
}
bool HostCaptureCurrentMembers(Owner* p){
 alignas(JOBOBJECT_BASIC_PROCESS_ID_LIST) unsigned char buffer[sizeof(JOBOBJECT_BASIC_PROCESS_ID_LIST)+128*sizeof(ULONG_PTR)]{};
 auto* list=reinterpret_cast<JOBOBJECT_BASIC_PROCESS_ID_LIST*>(buffer);
 if(!QueryInformationJobObject(p->job.h,JobObjectBasicProcessIdList,list,sizeof(buffer),nullptr)||list->NumberOfAssignedProcesses!=list->NumberOfProcessIdsInList||list->NumberOfProcessIdsInList>128)return false;
 for(DWORD i=0;i<list->NumberOfProcessIdsInList;i++){
  ULONG_PTR raw=list->ProcessIdList[i];if(!raw||raw>0xFFFFFFFF)return false;DWORD pid=static_cast<DWORD>(raw);
  bool known=pid==p->root.pid;for(const auto& m:p->held)known=known||m.pid==pid;if(known)continue;
  if(p->held.size()>=128)return false;Member m;m.pid=pid;m.process=Handle(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION|SYNCHRONIZE,FALSE,pid));
  if(!m.process.h||!MemberOf(m.process.h,p->job.h)||!ReadIdentity(m))return false;
  p->held.push_back(std::move(m));
 }return true;
}
bool HostDeadline(HostAsyncShutdown* work){return !work->environmentClosing.load()&&GetTickCount64()<work->deadline;}
bool HostCancelMonitor(HostAsyncShutdown* work){
 auto* p=work->owner;if(!p->wait)return true;
 work->cancelEvent=Handle(CreateEventW(nullptr,TRUE,FALSE,nullptr));if(!work->cancelEvent.h)return false;
 BOOL requested=UnregisterWaitEx(p->wait,work->cancelEvent.h);DWORD error=requested?ERROR_SUCCESS:GetLastError();
 if(!requested&&error!=ERROR_IO_PENDING)return false;work->cancellationRequested=true;
 ULONGLONG now=GetTickCount64();if(now>=work->deadline)return false;
 if(WaitForSingleObject(work->cancelEvent.h,static_cast<DWORD>(work->deadline-now))!=WAIT_OBJECT_0)return false;
 p->wait=nullptr;if(!HostCloseHandleVerified(work->cancelEvent))return false;return HostDeadline(work);
}
void HostAsyncExecute(napi_env,void* context){
 auto* work=static_cast<HostAsyncShutdown*>(context);auto* p=work->owner;
 if(!HostDeadline(work)){work->error="HOST_ASYNC_DEADLINE";return;}
 // No Session fields are touched. Session workers own independent Job/process
 // handles; their real JS cleanup receipts remain a separate required join.
 if(!HostCaptureCurrentMembers(p)){work->error="HOST_HELD_ROSTER_UNKNOWN";return;}
 {
  std::lock_guard<std::mutex> termination(p->terminationLock);
  if(!p->stopping.load()){
   if(!TerminateJobObject(p->job.h,work->code)){work->error="HOST_ASYNC_STOP_FAILED";return;}
   p->stopping.store(true);
  }
 }
 for(;;){
  if(!HostDeadline(work)){work->error="HOST_ASYNC_DEADLINE";return;}
  DWORD active=0;bool dead=true;
  if(!Active(p,active)||!HostExactExited(p->root,dead)){work->error="HOST_EXIT_UNVERIFIED";return;}
  for(const auto& m:p->held)if(!HostExactExited(m,dead)){work->error="HOST_EXIT_UNVERIFIED";return;}
  if(active==0&&dead)break;Sleep(2);
 }
 // Event-signaled unregister, outside terminationLock and off JS. Timeout
 // retains wait/event/context; no Dispose fallback or second Terminate.
 if(!HostCancelMonitor(work)){work->error="HOST_MONITOR_CANCEL_UNVERIFIED";return;}
 for(;;){
  if(!HostDeadline(work)){work->error="HOST_ASYNC_DEADLINE";return;}
  const int peers=PeerHostRosterJoined(work->peers);
  if(peers<0){work->error="HOST_PEER_FINALIZATION_UNVERIFIED";return;}if(peers==1)break;Sleep(2);
 }
}
bool HostCloseHandleVerified(Handle& value){if(!value.h)return true;if(!CloseHandle(value.h))return false;value.h=nullptr;return true;}
bool HostCloseVerified(Owner* p){
 // Called only after actual exit, cancellation and exact peer finalization.
 // Does not invoke Dispose(), PeerRetireOwner() or TerminateJobObject().
 if(p->wait)return false;
 for(auto& m:p->held)if(!HostCloseHandleVerified(m.process))return false;
 if(!HostCloseHandleVerified(p->root.process)||!HostCloseHandleVerified(p->job))return false;
 p->held.clear();p->closed=true;return true;
}
void HostRejectRetained(napi_env env,HostAsyncShutdown* work){
 if(!env||work->environmentClosing.load())return;
 bool pending=false;napi_is_exception_pending(env,&pending);if(pending){napi_value exception;napi_get_and_clear_last_exception(env,&exception);}
 napi_value text=nullptr,error=nullptr;
 if(napi_create_string_utf8(env,work->error?work->error:"HOST_SHUTDOWN_UNVERIFIED",NAPI_AUTO_LENGTH,&text)==napi_ok&&napi_create_error(env,text,text,&error)==napi_ok)napi_reject_deferred(env,work->deferred,error);
 // Unknown operation keeps asyncPending, strong refs, exact peers, task and
 // async cleanup hook. Rejected public Promise never refunds native capacity.
}
void HostAsyncComplete(napi_env env,napi_status status,void* context){
 auto* work=static_cast<HostAsyncShutdown*>(context);auto* p=work->owner;work->workerCompleted=true;
 if(status!=napi_ok)work->error="HOST_ASYNC_CANCELLED";
 if(!HostDeadline(work))work->error="HOST_ASYNC_DEADLINE";
 napi_value result=nullptr,shutdownId=nullptr,scope=nullptr,peers=nullptr;
 if(!work->error){
  // Native observations are sampled BEFORE any held HANDLE is closed.
  napi_value snapshot=Snapshot(env,p);
  if(!snapshot||napi_create_object(env,&result)!=napi_ok||napi_create_string_utf16(env,reinterpret_cast<const char16_t*>(work->shutdownId.data()),work->shutdownId.size(),&shutdownId)!=napi_ok||napi_create_string_utf8(env,"HOST_AND_EXACT_PEER_ROSTER_ONLY",NAPI_AUTO_LENGTH,&scope)!=napi_ok||napi_create_array_with_length(env,work->peers.size(),&peers)!=napi_ok)work->error="HOST_FINAL_OBSERVATION_FAILED";
  for(size_t i=0;!work->error&&i<work->peers.size();i++){
   auto& p=work->peers[i];std::lock_guard<std::recursive_mutex> guard(p->lock);napi_value row=nullptr;
   if(!p->nativeReaped||!p->jsDeliveryVerified||!p->tsfnFinalized||napi_create_object(env,&row)!=napi_ok||!Set(env,row,"pairOrdinal",Integer(env,p->shutdownOrdinal))||!Set(env,row,"nativeReaped",Boolean(env,p->nativeReaped))||!Set(env,row,"jsDeliveryVerified",Boolean(env,p->jsDeliveryVerified))||!Set(env,row,"tsfnFinalized",Boolean(env,p->tsfnFinalized))||napi_set_element(env,peers,static_cast<uint32_t>(i),row)!=napi_ok)work->error="HOST_PEER_FINAL_OBSERVATION_FAILED";
  }
  if(!work->error&&(!Set(env,result,"version",Integer(env,1))||!Set(env,result,"shutdownId",shutdownId)||!Set(env,result,"code",Integer(env,work->code))||!Set(env,result,"deadlineMs",Integer(env,work->timeout))||!Set(env,result,"snapshot",snapshot)||!Set(env,result,"peers",peers)||!Set(env,result,"scope",scope)||!Set(env,result,"sessionCleanupJoined",Boolean(env,false))||!Set(env,result,"closed",Boolean(env,true))))work->error="HOST_FINAL_OBSERVATION_FAILED";
 }
 if(!work->error&&(!HostDeadline(work)||PeerHostRosterJoined(work->peers)!=1))work->error="HOST_FINAL_ADMISSION_FAILED";
 if(!work->error&&!HostCloseVerified(p))work->error="HOST_CLOSE_UNVERIFIED";
 if(!work->error&&!HostDeadline(work))work->error="HOST_ASYNC_DEADLINE";
 if(work->error){HostRejectRetained(env,work);return;}
 // Observe NAPI cleanup failures before publishing closed:true. A local handle
 // retains the genuine Owner across deletion of its operation strong reference.
 napi_handle_scope handles=nullptr;napi_value heldOwner=nullptr;
 if(napi_open_handle_scope(env,&handles)!=napi_ok||napi_get_reference_value(env,work->ownerRef,&heldOwner)!=napi_ok||!heldOwner){work->error="HOST_REFERENCE_UNVERIFIED";HostRejectRetained(env,work);if(handles)napi_close_handle_scope(env,handles);return;}
 if(napi_remove_async_cleanup_hook(work->cleanupHook)!=napi_ok){work->error="HOST_ENVIRONMENT_JOIN_UNVERIFIED";HostRejectRetained(env,work);napi_close_handle_scope(env,handles);return;}work->cleanupHook=nullptr;
 if(napi_delete_async_work(env,work->task)!=napi_ok){work->error="HOST_WORK_RELEASE_UNVERIFIED";HostRejectRetained(env,work);napi_close_handle_scope(env,handles);return;}work->task=nullptr;
 if(napi_delete_reference(env,work->ownerRef)!=napi_ok){work->error="HOST_REFERENCE_RELEASE_UNVERIFIED";HostRejectRetained(env,work);napi_close_handle_scope(env,handles);return;}work->ownerRef=nullptr;
 if(!HostDeadline(work)||napi_resolve_deferred(env,work->deferred,result)!=napi_ok){
  work->error="HOST_RECEIPT_UNDELIVERED";napi_create_reference(env,heldOwner,1,&work->ownerRef);HostRejectRetained(env,work);napi_close_handle_scope(env,handles);return;
 }
 // The exact Promise remains referenced for duplicates until Owner finalization.
 p->asyncPending.store(false);work->peers.clear();napi_close_handle_scope(env,handles);
}
void HostShutdownFinalize(napi_env env,Owner* p){
 auto* work=p->hostShutdown;
 if(!env||!work||p->asyncPending.load()||!p->closed||work->ownerRef||work->task||work->cleanupHook)return;
 if(work->promiseRef)napi_delete_reference(env,work->promiseRef);p->hostShutdown=nullptr;delete work;DeleteOwner{}(p);
}
napi_value StopAndCloseHostAsync(napi_env env,napi_callback_info info){
 napi_value a[4];if(!Args(env,info,4,a))return nullptr;auto* p=GetHostIdentity(env,a[0]);if(!p)return nullptr;
 DWORD code=0,timeout=0;std::wstring shutdownId;
 if(!Number(env,a[1],code)||(code!=77&&code!=98)||!Number(env,a[2],timeout)||timeout>10000||!HostShutdownId(env,a[3],shutdownId))return Refuse(env,"HOST_ASYNC_REQUEST_REFUSED");
 if(p->hostShutdown){
  auto* prior=p->hostShutdown;if(prior->code!=code||prior->timeout!=timeout||prior->shutdownId!=shutdownId)return Refuse(env,"HOST_SHUTDOWN_CONFLICT");
  napi_value same=nullptr;if(napi_get_reference_value(env,prior->promiseRef,&same)!=napi_ok||!same)return Refuse(env,"HOST_SHUTDOWN_PROMISE_UNAVAILABLE");return same;
 }
 if(p->closed||p->asyncPending.load())return Refuse(env,"HOST_ASYNC_PENDING");
 auto work=std::make_unique<HostAsyncShutdown>();work->owner=p;work->env=env;work->code=code;work->timeout=timeout;work->shutdownId=shutdownId;work->deadline=GetTickCount64()+timeout;
 napi_value promise=nullptr,name=nullptr;
 if(napi_create_promise(env,&work->deferred,&promise)!=napi_ok||napi_create_reference(env,a[0],1,&work->ownerRef)!=napi_ok)return Refuse(env,"NAPI_FAILURE");
 auto setupFailure=[&]()->napi_value{if(work->cleanupHook)napi_remove_async_cleanup_hook(work->cleanupHook);if(work->task)napi_delete_async_work(env,work->task);if(work->promiseRef)napi_delete_reference(env,work->promiseRef);napi_delete_reference(env,work->ownerRef);return Refuse(env,"NAPI_FAILURE");};
 if(napi_create_reference(env,promise,1,&work->promiseRef)!=napi_ok||napi_create_string_utf8(env,"siren-terminal-host-cleanup",NAPI_AUTO_LENGTH,&name)!=napi_ok||napi_create_async_work(env,nullptr,name,HostAsyncExecute,HostAsyncComplete,work.get(),&work->task)!=napi_ok||napi_add_async_cleanup_hook(env,HostAsyncEnvironmentCleanup,work.get(),&work->cleanupHook)!=napi_ok)return setupFailure();
 // Admission is synchronous and permanent on unknown work. Duplicates alone
 // can use raw identity; every other host entry goes through fenced Get().
 p->asyncPending.store(true);p->hostShutdown=work.release();auto* owned=p->hostShutdown;
 if(!PeerCaptureAndRetireHost(p,owned->peers)){owned->error="HOST_PEER_ROSTER_UNKNOWN";HostRejectRetained(env,owned);return promise;}
 if(napi_queue_async_work(env,owned->task)!=napi_ok){owned->error="HOST_ASYNC_QUEUE_FAILED";HostRejectRetained(env,owned);return promise;}
 return promise;
}
`;

export function deriveHostAsyncCandidate(inputs){
 for(const k of Object.keys(HOST_ASYNC_BASE))if(hash(inputs[k])!==HOST_ASYNC_BASE[k])throw Error('HOST_ASYNC_BASE_DRIFT:'+k);
 let ownership=inputs.ownership.toString().replaceAll('\r\n','\n'),peer=inputs.peer.toString().replaceAll('\r\n','\n');
 // Every incompatible opaque family is isolated from genuine legacy addon
 // capabilities by a distinct tag, checked before unwrap/layout dereference.
 ownership=once(ownership,'const napi_type_tag tag={0x334c414e454f574eULL,0x2026100800030001ULL};','const napi_type_tag tag={0x334c414e454f574eULL,0x2026100900040001ULL};','v2 Owner capability family');
 ownership=once(ownership,'const napi_type_tag sessionTag={0x334c414e45534553ULL,0x2026100800030002ULL};','const napi_type_tag sessionTag={0x334c414e45534553ULL,0x2026100900040002ULL};','v2 Session capability family');
 for(const [name,low]of [['peerPairTag','0003'],['peerEndpointTag','0004'],['peerWitnessTag','0005']])peer=once(peer,'const napi_type_tag '+name+'={0x454e44504f494e54ULL,0x202610080003'+low+'ULL};','const napi_type_tag '+name+'={0x454e44504f494e54ULL,0x202610090004'+low+'ULL};','v2 '+name+' capability family');
 ownership=once(ownership,'// Three-lane native source candidate. Separate Windows qualification required; NOT_ADMITTED.','// Isolated async-host native WIP candidate. SOURCE_ONLY / NOT_ADMITTED.','candidate classification');
 ownership=once(ownership,'struct Owner;struct Session;','struct Owner;struct Session;struct HostAsyncShutdown;\nstruct HostPeerOwnerToken {};\nvoid HostShutdownFinalize(napi_env,Owner*);','forward declarations');
 ownership=once(ownership,' std::atomic<bool> asyncPending{false};',' std::atomic<bool> asyncPending{false};\n HostAsyncShutdown* hostShutdown=nullptr;\n std::shared_ptr<HostPeerOwnerToken> peerOwnerToken=std::make_shared<HostPeerOwnerToken>();','owner lifetime state');
 ownership=once(ownership,' bool Dispose(){',' bool Dispose(){\n  if(closed)return true;\n  if(hostShutdown)return false; // Unknown async host operation owns every context.','no Dispose fallback');
 ownership=once(ownership,'void Finalize(napi_env,void* p,void*){DeleteOwner{}(static_cast<Owner*>(p));}','void Finalize(napi_env env,void* raw,void*){auto* p=static_cast<Owner*>(raw);if(p->hostShutdown){HostShutdownFinalize(env,p);return;}DeleteOwner{}(p);}','host finalizer fencing');
 ownership=once(ownership,' if(!p->stopping.load())p->monitorTerminateSucceeded.store(TerminateJobObject(p->job.h,79)!=FALSE);',' if(!p->stopping.load()){bool terminated=TerminateJobObject(p->job.h,79)!=FALSE;p->monitorTerminateSucceeded.store(terminated);if(terminated)p->stopping.store(true);}','monitor Stop-once');
 ownership=once(ownership,'Owner* Get(napi_env env,napi_value value){','Owner* GetHostIdentity(napi_env env,napi_value value){','raw identity only duplicate');
 ownership=once(ownership,' return static_cast<Owner*>(data);\n}',' return static_cast<Owner*>(data);\n}\nOwner* Get(napi_env env,napi_value value){auto* p=GetHostIdentity(env,value);if(p&&(p->asyncPending.load()||p->hostShutdown)){Refuse(env,"HOST_ASYNC_PENDING");return nullptr;}return p;}','fenced Get');
 ownership=once(ownership,'#include "peer-endpoints.inc"','#include "peer-endpoints.inc"\n'+hostExtension,'host async extension');
 ownership=once(ownership,'  {"stopAndCloseSessionAsync",nullptr,StopAndCloseSessionAsync','  {"stopAndCloseHostAsync",nullptr,StopAndCloseHostAsync,nullptr,nullptr,nullptr,napi_default,nullptr},\n  {"stopAndCloseSessionAsync",nullptr,StopAndCloseSessionAsync','host export');
 peer=once(peer,' const Owner* ownerKey=nullptr;const Session* sessionKey=nullptr;',' const Owner* ownerKey=nullptr;const Session* sessionKey=nullptr;\n std::shared_ptr<HostPeerOwnerToken> hostOwnerToken;\n DWORD shutdownOrdinal=0,handleCloseError=0;\n bool nativeReaped=false,jsDeliveryVerified=false,tsfnFinalized=false,deliveryAbandoned=false,finalizationFailed=false,quarantined=false;','stable peer membership');
 peer=once(peer,' unsigned active=0;bool closing=false;',' unsigned active=0;bool closing=false,releaseAttempted=false,releaseFailed=false;','v2 environment release ownership');
 peer=once(peer,'std::atomic<unsigned> peerMainPairs{0},peerCreatorPairs{0};','std::atomic<unsigned> peerMainPairs{0},peerCreatorPairs{0};\nstd::atomic<DWORD> peerShutdownOrdinal{0};\nbool PeerNextShutdownOrdinal(DWORD& out){DWORD value=peerShutdownOrdinal.load();for(;;){if(value==0xFFFFFFFF)return false;if(peerShutdownOrdinal.compare_exchange_weak(value,value+1)){out=value+1;return true;}}}','native ordinal');
 peer=once(peer,'PeerPair::~PeerPair(){PeerReleaseCapacity(this);}','PeerPair::~PeerPair(){PeerReleaseCapacity(this);}\n'+peerReleaseHelpers,'v2 retained peer HANDLE release');
 peer=betweenOnce(peer,'void PeerEnvironmentFinished(','void PeerThreadsafeFinalize(',peerEnvironment+'\n','v2 checked bounded environment hook');
 peer=betweenOnce(peer,'void PeerThreadsafeFinalize(','bool PeerReject(',peerFinalization,'v2 finalization transaction');
 peer=once(peer,'  if(!env){delivery.settled=true;continue;}','  if(!env){{std::lock_guard<std::recursive_mutex> guard(p->lock);p->deliveryAbandoned=true;}delivery.settled=true;continue;}','environment abandonment');
 peer=once(peer,' p->ownerKey=nullptr;p->sessionKey=nullptr;p->settled=true;',' p->ownerKey=nullptr;p->sessionKey=nullptr;p->settled=true;p->nativeReaped=true;','native reap observation');
 peer=once(peer,'bool PeerDrainLocked(PeerPair* p){','bool PeerDrainLocked(PeerPair* p){\n if(p->finalizationFailed)return false; // Unknown close is never retried.','v2 no close retry');
 peer=once(peer,' for(auto& l:p->lanes){l.pipe=Handle();l.connected=false;}\n p->peer.process=Handle();p->hostWitness.process=Handle();p->mainWitness.process=Handle();p->commonJob=Handle();p->sessionJob=Handle();',' if(!PeerCloseDrainHandlesLocked(p))return false;','v2 checked native drain handles');
 peer=once(peer,'bool notify=false,done=false,waitValid=true;','bool notify=false,done=false,waitValid=true,failed=false;','v2 worker unknown state');
 peer=once(peer,'   if(p->retiring)done=PeerDrainLocked(p.get());','   if(p->retiring)done=PeerDrainLocked(p.get());\n   failed=p->finalizationFailed;if(p->finalizationFailed)done=true;','v2 stop failed drain without retry');
 peer=once(peer,'  if(notify)PeerNotify(p.get());if(done)break;if(!waitValid)continue;','  if(notify)PeerNotify(p.get());if(done){if(failed)PeerRetainPair(p);break;}if(!waitValid)continue;','v2 retain failed pair before worker exits');
 peer=once(peer,' auto p=std::make_shared<PeerPair>();p->server=server;p->counted=true;',' auto p=std::make_shared<PeerPair>();p->server=server;p->counted=true;if(!PeerNextShutdownOrdinal(p->shutdownOrdinal)){Refuse(env,"PEER_ORDINAL_EXHAUSTED");return {};}','pair ordinal allocation');
 peer=once(peer,'auto p=PeerNewPair(env,true);if(!p)return nullptr;p->ownerKey=host;','auto p=PeerNewPair(env,true);if(!p)return nullptr;p->ownerKey=host;p->hostOwnerToken=host->peerOwnerToken;','persistent host association');
 peer=once(peer,'void PeerRetireSession(Session* session){',peerRoster+'\nvoid PeerRetireSession(Session* session){','exact host roster join');
 peer=once(peer,' if(!Set(env,result,"lane",lane)||',' if(!Set(env,result,"pairOrdinal",Integer(env,p->shutdownOrdinal))||!Set(env,result,"lane",lane)||','pre-trigger ordinal observation');
 const binding=JSON.parse(inputs.binding.toString());if(binding.targets.length!==1||binding.targets[0].target_name!=='siren_terminal_creator_three_lane')throw Error('HOST_ASYNC_BINDING_DRIFT');binding.targets[0].target_name='siren_terminal_creator_host_async';
 return Object.freeze({ownership:Buffer.from(ownership),peer:Buffer.from(peer),binding:Buffer.from(JSON.stringify(binding,null,2)+'\n')});
}
export const HOST_ASYNC_DERIVATION_NOTES=Object.freeze(['Exact SHA256 of all three old inputs required; every edit/section anchor explicit and unique.','Candidate output line endings normalized to LF; old files never rewritten.','New host API + fencing + shared peer owner identity + asynchronous finalization join only.','v2: checked peer HANDLE close retains failed handle and counted pair; no nativeReaped/join or retry after unknown release.','v2: checked async-work deletion precedes peer finalization/capacity publication; unknown raw work/context retained.','v2: checked environment-hook removal retains context and finite environment slot on failure; no retry.','v2: all five opaque capability families have tags distinct from genuine legacy source before unwrap.','Existing Session cleanup implementation remains unchanged and is not joined by this host-only receipt.','Unknown work permanently retains native/NAPI contexts and cleanup hooks; environment teardown may stall.','Structural source tests cannot prove Windows/NAPI behavior or compile correctness.']);
