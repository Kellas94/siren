// NEW, UNQUALIFIED Windows candidate. Included inside ownership.cc's namespace.
// No Node private handles, PID reopen, persistent libuv worker, or reconnect.
// Public timeout arguments are integer milliseconds in [1,10000].
// Closing either endpoint deliberately retires its complete two-lane pair.
const napi_type_tag peerPairTag={0x454e44504f494e54ULL,0x2026100800010001ULL};
const napi_type_tag peerEndpointTag={0x454e44504f494e54ULL,0x2026100800010002ULL};
const napi_type_tag peerWitnessTag={0x454e44504f494e54ULL,0x2026100800010003ULL};
constexpr DWORD peerProcessRights=PROCESS_QUERY_LIMITED_INFORMATION|SYNCHRONIZE;
constexpr DWORD peerPipeRights=FILE_READ_DATA|FILE_WRITE_DATA|FILE_READ_ATTRIBUTES|SYNCHRONIZE;
constexpr size_t peerReadLimit=32768,peerWriteLimits[2]={2048,90120};
constexpr size_t peerWriteCountLimit=32,peerCloseCountLimit=32,peerRequestLimit=100;
struct PeerPair;
struct PeerEnvironment {
 napi_env env=nullptr;napi_async_cleanup_hook_handle hook=nullptr;
 unsigned active=0;bool closing=false;
};
enum class PeerRequestKind {Accept,Connect,Read,Write,Close};
struct PeerRequest {
 PeerRequestKind kind;unsigned lane=0;ULONGLONG deadline=0;
 napi_deferred deferred=nullptr;bool nativeDone=false,jsDone=false,delivering=false,bytesReleased=false,notify=false,active=false,eof=false;
 const char* error=nullptr;DWORD bytes=0;std::vector<unsigned char> buffer;
 explicit PeerRequest(PeerRequestKind k):kind(k){}
 ~PeerRequest(){if(!buffer.empty())SecureZeroMemory(buffer.data(),buffer.size());}
};
struct PeerLane {
 Handle pipe,readEvent,writeEvent;OVERLAPPED readOverlapped{},writeOverlapped{};
 std::wstring name;bool started=false,connected=false,readPending=false,writePending=false,connectPending=false;
 bool bothJobsChecked=false,commonJobMember=false,sessionJobMember=false;
 DWORD queriedPeerPid=0;size_t writeReserved=0;
 std::shared_ptr<PeerRequest> start,read;
 std::vector<std::shared_ptr<PeerRequest>> writes;
};
struct PeerPair {
 std::recursive_mutex lock;PeerEnvironment* environment=nullptr;napi_threadsafe_function tsfn=nullptr;
 Handle wake,thread;PeerLane lanes[2];Member peer,hostWitness,mainWitness;
 Handle commonJob,sessionJob;
 // Keys are compared only, under registry + pair locks. Never dereferenced.
 const Owner* ownerKey=nullptr;const Session* sessionKey=nullptr;
 bool server=false,bound=false,startupPrepared=false,retiring=false,settled=false,counted=false;
 bool peerObservationKnown=false,peerObservedAlive=false,peerObservedBeforeClose=false;
 DWORD peerObservedExitCode=0,mainPid=0,creatorPid=0;ULONGLONG generation=1,startupDeadline=0;
 const char* retirementError="PEER_RETIRED";
 std::atomic<bool> notificationQueued{false},tsfnUsable{true};
 std::vector<std::shared_ptr<PeerRequest>> requests;
 ~PeerPair();
};
struct PeerCapability {
 std::shared_ptr<PeerPair> pair;unsigned lane=0;bool closed=false;const napi_type_tag* type=nullptr;
};
struct PeerWipe {
 void* data=nullptr;size_t bytes=0;bool preserve=false;
 PeerWipe()=default;PeerWipe(void* p,size_t n):data(p),bytes(n){}
 ~PeerWipe(){if(data&&bytes&&!preserve)SecureZeroMemory(data,bytes);}
};
std::mutex peerRegistryLock;
std::vector<std::weak_ptr<PeerPair>> peerRegistry;
std::vector<PeerEnvironment*> peerEnvironments;
std::atomic<unsigned> peerMainPairs{0},peerCreatorPairs{0};

bool PeerReserve(bool server){
 auto& n=server?peerMainPairs:peerCreatorPairs;unsigned limit=server?8:1,value=n.load();
 while(value<limit){if(n.compare_exchange_weak(value,value+1))return true;}return false;
}
void PeerReleaseCapacity(PeerPair* p){if(p->counted){(p->server?peerMainPairs:peerCreatorPairs).fetch_sub(1);p->counted=false;}}
PeerPair::~PeerPair(){PeerReleaseCapacity(this);}
bool PeerDuplicate(HANDLE source,DWORD rights,Handle& result,bool inherited=false){
 HANDLE h=nullptr;if(!source||source==INVALID_HANDLE_VALUE||!DuplicateHandle(GetCurrentProcess(),source,GetCurrentProcess(),&h,rights,inherited?TRUE:FALSE,0))return false;
 result=Handle(h);return true;
}
bool PeerCopyMember(const Member& source,Member& result){
 if(!PeerDuplicate(source.process.h,peerProcessRights,result.process))return false;
 result.pid=source.pid;result.created=source.created;result.image=source.image;return true;
}
bool PeerHeldCurrent(const Member& m){
 if(!m.process.h||GetProcessId(m.process.h)!=m.pid||WaitForSingleObject(m.process.h,0)!=WAIT_TIMEOUT)return false;
 FILETIME c,e,k,u;if(!GetProcessTimes(m.process.h,&c,&e,&k,&u)||Ticks(c)!=m.created)return false;
 wchar_t image[32768];DWORD size=32768;
 return QueryFullProcessImageNameW(m.process.h,0,image,&size)&&size==m.image.size()&&CompareStringOrdinal(image,static_cast<int>(size),m.image.c_str(),static_cast<int>(m.image.size()),TRUE)==CSTR_EQUAL&&WaitForSingleObject(m.process.h,0)==WAIT_TIMEOUT;
}
void PeerObserveLocked(PeerPair* p){
 if(!p->peer.process.h)return;DWORD state=WaitForSingleObject(p->peer.process.h,0),code=0;
 if((state==WAIT_TIMEOUT||state==WAIT_OBJECT_0)&&GetExitCodeProcess(p->peer.process.h,&code)){
  p->peerObservationKnown=true;p->peerObservedAlive=state==WAIT_TIMEOUT;p->peerObservedExitCode=code;
 }
}
bool PeerCurrentLocked(PeerPair* p,unsigned lane){
 if(p->retiring||p->settled||!p->bound||lane>1||!p->lanes[lane].connected||!PeerHeldCurrent(p->peer))return false;
 auto& l=p->lanes[lane];ULONG observed=0;
 BOOL queried=p->server?GetNamedPipeClientProcessId(l.pipe.h,&observed):GetNamedPipeServerProcessId(l.pipe.h,&observed);
 l.queriedPeerPid=observed;if(!queried||observed!=p->peer.pid)return false;
 if(p->server){
  l.bothJobsChecked=true;l.commonJobMember=MemberOf(p->peer.process.h,p->commonJob.h);l.sessionJobMember=MemberOf(p->peer.process.h,p->sessionJob.h);
  if(!l.commonJobMember||!l.sessionJobMember||!PeerHeldCurrent(p->hostWitness))return false;
 }
 PeerObserveLocked(p);return WaitForSingleObject(p->peer.process.h,0)==WAIT_TIMEOUT;
}
void PeerCompleteLocked(const std::shared_ptr<PeerRequest>& r,const char* error=nullptr){
 r->active=false;r->nativeDone=true;if(!r->error)r->error=error;r->notify=true;
}
void PeerReleaseRequestBytesLocked(PeerPair* p,const std::shared_ptr<PeerRequest>& r){
 if(!r->nativeDone||!r->jsDone||r->bytesReleased)return;
 if(r->kind==PeerRequestKind::Write)p->lanes[r->lane].writeReserved-=r->buffer.size();
 if(!r->buffer.empty())SecureZeroMemory(r->buffer.data(),r->buffer.size());
 std::vector<unsigned char>().swap(r->buffer);r->bytesReleased=true;
}
void PeerCleanupRequestsLocked(PeerPair* p){
 for(auto it=p->requests.begin();it!=p->requests.end();){auto r=*it;
  if(r->nativeDone&&r->jsDone){
   // A completed write still owns its original buffer until its JS receipt
   // settles. Charge that resident buffer, not only the kernel request.
   PeerReleaseRequestBytesLocked(p,r);
   it=p->requests.erase(it);
  }else ++it;
 }
}
bool PeerReadOccupiedLocked(PeerPair* p,unsigned lane){
 for(auto& r:p->requests)if(r->kind==PeerRequestKind::Read&&r->lane==lane&&(!r->nativeDone||!r->jsDone))return true;return false;
}
size_t PeerWriteOccupiedLocked(PeerPair* p,unsigned lane){
 size_t count=0;for(auto& r:p->requests)if(r->kind==PeerRequestKind::Write&&r->lane==lane&&(!r->nativeDone||!r->jsDone))++count;return count;
}
void PeerRetireLocked(PeerPair* p,const char* reason){
 if(!p->retiring){p->retiring=true;++p->generation;p->retirementError=reason;}
 // Cancellation is a request. Every OVERLAPPED/buffer remains owned until reap.
 for(auto& l:p->lanes)if(l.pipe.h)CancelIoEx(l.pipe.h,nullptr);
 if(p->wake.h)SetEvent(p->wake.h);
}
void PeerAbortStartup(PeerPair* p){if(p){std::lock_guard<std::recursive_mutex> guard(p->lock);PeerRetireLocked(p,"PEER_STARTUP_ABORTED");}}
void PeerRetireOwner(Owner* owner){
 std::lock_guard<std::mutex> registry(peerRegistryLock);
 for(auto& weak:peerRegistry)if(auto p=weak.lock()){
  std::lock_guard<std::recursive_mutex> guard(p->lock);
  if(p->ownerKey==owner){p->ownerKey=nullptr;PeerRetireLocked(p.get(),"PEER_OWNER_RETIRED");}
 }
}
void PeerRetireSession(Session* session){
 std::lock_guard<std::mutex> registry(peerRegistryLock);
 for(auto& weak:peerRegistry)if(auto p=weak.lock()){
  std::lock_guard<std::recursive_mutex> guard(p->lock);
  if(p->sessionKey==session){p->sessionKey=nullptr;PeerRetireLocked(p.get(),"PEER_SESSION_RETIRED");}
 }
}
void PeerNotify(PeerPair* p){
 if(!p->tsfnUsable.load()||p->notificationQueued.exchange(true))return;
 napi_status status=napi_call_threadsafe_function(p->tsfn,nullptr,napi_tsfn_nonblocking);
 if(status==napi_ok||status==napi_queue_full)return;
 p->notificationQueued.store(false);
 // Receiving napi_closing ends this thread's right to use the TSFN.
 if(status==napi_closing)p->tsfnUsable.store(false);
 std::lock_guard<std::recursive_mutex> guard(p->lock);PeerRetireLocked(p,"PEER_ENVIRONMENT_CLOSING");
}
void PeerFinalizeCapability(napi_env,void* data,void*){
 std::unique_ptr<PeerCapability> cap(static_cast<PeerCapability*>(data));if(!cap||!cap->pair||cap->closed)return;
 std::lock_guard<std::recursive_mutex> guard(cap->pair->lock);
 // A consumed witness may be released after both lanes connected; the pair
 // independently retains its held main process. Releasing other capabilities
 // fences their whole pair, including outstanding uncompleted operations.
 if(cap->type==&peerWitnessTag&&cap->pair->lanes[0].connected&&cap->pair->lanes[1].connected)return;
 PeerRetireLocked(cap->pair.get(),"PEER_CAPABILITY_FINALIZED");
}
napi_value PeerWrap(napi_env env,const std::shared_ptr<PeerPair>& p,const napi_type_tag* type,unsigned lane=0){
 std::unique_ptr<PeerCapability> cap(new PeerCapability());cap->pair=p;cap->lane=lane;cap->type=type;
 napi_value result=nullptr;
 if(napi_create_object(env,&result)!=napi_ok||napi_type_tag_object(env,result,type)!=napi_ok||napi_wrap(env,result,cap.get(),PeerFinalizeCapability,nullptr,nullptr)!=napi_ok)return Refuse(env,"PEER_NAPI_FAILURE");
 cap.release();return result;
}
PeerCapability* PeerGetCapability(napi_env env,napi_value value,const napi_type_tag* tag,bool allowClosed=false){
 bool yes=false;void* data=nullptr;
 if(napi_check_object_type_tag(env,value,tag,&yes)!=napi_ok||!yes||napi_unwrap(env,value,&data)!=napi_ok||!data){Refuse(env,"PEER_CAPABILITY_REFUSED");return nullptr;}
 auto* cap=static_cast<PeerCapability*>(data);
 if(!cap->pair||(!allowClosed&&cap->closed)){Refuse(env,"PEER_CAPABILITY_CLOSED");return nullptr;}return cap;
}
PeerPair* PeerPairGet(napi_env env,napi_value value){auto* cap=PeerGetCapability(env,value,&peerPairTag);return cap?cap->pair.get():nullptr;}
bool PeerLaneArgument(napi_env env,napi_value value,unsigned& lane){
 std::wstring name;if(!String(env,value,name))return false;
 if(name==L"control"){lane=0;return true;}if(name==L"history"){lane=1;return true;}return false;
}
bool PeerTimeout(napi_env env,napi_value value,ULONGLONG& deadline){DWORD ms=0;if(!Number(env,value,ms)||ms>10000)return false;deadline=GetTickCount64()+ms;return true;}
bool PeerName(const std::wstring& name,unsigned lane){
 const std::wstring prefix=lane==0?L"\\\\.\\pipe\\siren-terminal-control-":L"\\\\.\\pipe\\siren-terminal-data-";
 if(name.size()!=prefix.size()+32||name.compare(0,prefix.size(),prefix)!=0)return false;
 for(size_t i=prefix.size();i<name.size();++i)if(!((name[i]>=L'0'&&name[i]<=L'9')||(name[i]>=L'a'&&name[i]<=L'f')))return false;return true;
}
bool PeerPacketNames(const BootstrapPacket& packet,std::wstring& control,std::wstring& history){
 if(packet.bytes.size()<80||packet.bytes.size()>2048)return false;size_t offset=16;
 for(unsigned i=0;i<4;++i){size_t n=(static_cast<size_t>(packet.bytes[8+i*2])<<8)|packet.bytes[9+i*2];
  if(offset+n>packet.bytes.size()-64)return false;
  if(i>=2){std::wstring& out=i==2?control:history;out.clear();for(size_t j=0;j<n;++j)out.push_back(static_cast<wchar_t>(packet.bytes[offset+j]));}
  offset+=n;
 }
 return offset+64==packet.bytes.size()&&PeerName(control,0)&&PeerName(history,1);
}

// A single non-inherited logon-SID allow ACE; no generic write/create-instance.
bool PeerListenerSecurity(std::vector<unsigned char>& storage,SECURITY_DESCRIPTOR& descriptor,SECURITY_ATTRIBUTES& security){
 HANDLE raw=nullptr;if(!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&raw))return false;Handle token(raw);
 DWORD needed=0;GetTokenInformation(token.h,TokenLogonSid,nullptr,0,&needed);if(!needed||needed>65536)return false;
 std::vector<unsigned char> groupsBytes(needed);
 if(!GetTokenInformation(token.h,TokenLogonSid,groupsBytes.data(),needed,&needed))return false;
 auto* groups=reinterpret_cast<TOKEN_GROUPS*>(groupsBytes.data());
 if(groups->GroupCount!=1||!IsValidSid(groups->Groups[0].Sid))return false;
 DWORD aclBytes=sizeof(ACL)+sizeof(ACCESS_ALLOWED_ACE)-sizeof(DWORD)+GetLengthSid(groups->Groups[0].Sid);
 if(aclBytes>65536)return false;storage.resize(aclBytes);auto* acl=reinterpret_cast<PACL>(storage.data());
 if(!InitializeAcl(acl,aclBytes,ACL_REVISION)||!AddAccessAllowedAceEx(acl,ACL_REVISION,0,peerPipeRights,groups->Groups[0].Sid)||!InitializeSecurityDescriptor(&descriptor,SECURITY_DESCRIPTOR_REVISION)||!SetSecurityDescriptorDacl(&descriptor,TRUE,acl,FALSE))return false;
 security.nLength=sizeof(security);security.lpSecurityDescriptor=&descriptor;security.bInheritHandle=FALSE;return true;
}
void PeerEnvironmentFinished(PeerEnvironment* e){
 bool dispose=false;
 {std::lock_guard<std::mutex> registry(peerRegistryLock);if(e->active)--e->active;
  if(e->closing&&e->active==0){for(auto it=peerEnvironments.begin();it!=peerEnvironments.end();++it)if(*it==e){peerEnvironments.erase(it);break;}dispose=true;}}
 if(dispose){napi_remove_async_cleanup_hook(e->hook);delete e;}
}
void PeerEnvironmentCleanup(napi_async_cleanup_hook_handle,void* data){
 auto* e=static_cast<PeerEnvironment*>(data);bool empty=false;
 {std::lock_guard<std::mutex> registry(peerRegistryLock);e->closing=true;
  for(auto& weak:peerRegistry)if(auto p=weak.lock()){
   std::lock_guard<std::recursive_mutex> guard(p->lock);if(p->environment==e)PeerRetireLocked(p.get(),"PEER_ENVIRONMENT_CLOSING");
  }
  empty=e->active==0;
  if(empty)for(auto it=peerEnvironments.begin();it!=peerEnvironments.end();++it)if(*it==e){peerEnvironments.erase(it);break;}
 }
 if(empty){napi_remove_async_cleanup_hook(e->hook);delete e;}
}
bool PeerInitialize(napi_env env){
 std::lock_guard<std::mutex> registry(peerRegistryLock);for(auto* e:peerEnvironments)if(e->env==env)return !e->closing;
 std::unique_ptr<PeerEnvironment> e(new PeerEnvironment());e->env=env;
 if(napi_add_async_cleanup_hook(env,PeerEnvironmentCleanup,e.get(),&e->hook)!=napi_ok)return false;
 peerEnvironments.push_back(e.release());return true;
}
void PeerThreadsafeFinalize(napi_env,void* data,void*){
 std::unique_ptr<std::shared_ptr<PeerPair>> held(static_cast<std::shared_ptr<PeerPair>*>(data));auto p=*held;
 // This callback runs only after the I/O thread relinquishes its TSFN. The
 // thread has no remaining JS dependency; never detach or free active I/O.
 if(p->thread.h)WaitForSingleObject(p->thread.h,INFINITE);
 PeerEnvironment* environment=nullptr;
 {std::lock_guard<std::recursive_mutex> guard(p->lock);
  p->thread=Handle();
  // The worker has reaped every operation and TSFN delivery has drained. Old
  // JS metadata capabilities must not retain native events or resident data.
  PeerObserveLocked(p.get());if(p->peer.process.h)p->peerObservedBeforeClose=true;
  for(auto& l:p->lanes){l.pipe=Handle();l.readEvent=Handle();l.writeEvent=Handle();l.start.reset();l.read.reset();l.writes.clear();l.writeReserved=0;}
  for(auto& r:p->requests)if(!r->buffer.empty())SecureZeroMemory(r->buffer.data(),r->buffer.size());p->requests.clear();
  p->wake=Handle();p->peer.process=Handle();p->hostWitness.process=Handle();p->mainWitness.process=Handle();p->commonJob=Handle();p->sessionJob=Handle();p->tsfn=nullptr;
  environment=p->environment;
 }
 {std::lock_guard<std::mutex> registry(peerRegistryLock);
  for(auto it=peerRegistry.begin();it!=peerRegistry.end();){auto item=it->lock();if(!item||item.get()==p.get())it=peerRegistry.erase(it);else ++it;}
 }
 PeerReleaseCapacity(p.get());
 PeerEnvironmentFinished(environment);
 {std::lock_guard<std::recursive_mutex> guard(p->lock);p->environment=nullptr;}
}
bool PeerReject(napi_env env,napi_deferred deferred,const char* code){
 napi_value message=nullptr,error=nullptr;
 return napi_create_string_utf8(env,code,NAPI_AUTO_LENGTH,&message)==napi_ok&&napi_create_error(env,message,message,&error)==napi_ok&&napi_reject_deferred(env,deferred,error)==napi_ok;
}
struct PeerDelivery {
 PeerPair* pair;std::shared_ptr<PeerRequest> request;bool settled=false;
 PeerDelivery(PeerPair* p,const std::shared_ptr<PeerRequest>& r):pair(p),request(r){}
 ~PeerDelivery(){std::lock_guard<std::recursive_mutex> guard(pair->lock);
  request->delivering=false;
  if(settled){request->jsDone=true;request->notify=false;PeerReleaseRequestBytesLocked(pair,request);}
  else{request->error="PEER_NAPI_FAILURE";request->notify=true;PeerRetireLocked(pair,"PEER_NAPI_FAILURE");}
 }
};
void PeerThreadsafeCall(napi_env env,napi_value,void* context,void*){
 auto* held=static_cast<std::shared_ptr<PeerPair>*>(context);auto p=*held;
 std::shared_ptr<PeerRequest> ready[peerRequestLimit];size_t readyCount=0;
 {std::lock_guard<std::recursive_mutex> guard(p->lock);p->notificationQueued.store(false);
  for(auto& r:p->requests)if(r->notify&&!r->jsDone&&!r->delivering){r->delivering=true;r->notify=false;ready[readyCount++]=r;}
 }
 for(size_t index=0;index<readyCount;++index){auto r=ready[index];ready[index].reset();PeerDelivery delivery(p.get(),r);
  if(!env){delivery.settled=true;continue;}const char* error=nullptr;
  {std::lock_guard<std::recursive_mutex> guard(p->lock);error=r->error;
   // An active read has no idle expiry. Its validated timeout is solely a
   // cancellation ceiling; explicit close has its own bounded deadline.
   if(!error&&r->kind!=PeerRequestKind::Read&&GetTickCount64()>=r->deadline)error="PEER_DEADLINE";
   if(!error&&r->kind!=PeerRequestKind::Close&&!r->eof&&!PeerCurrentLocked(p.get(),r->lane))error="PEER_STALE_COMPLETION";
  }
  if(error){delivery.settled=PeerReject(env,r->deferred,error);continue;}
  napi_value result=nullptr;
  if(r->kind==PeerRequestKind::Accept||r->kind==PeerRequestKind::Connect)result=PeerWrap(env,p,&peerEndpointTag,r->lane);
  else if(r->kind==PeerRequestKind::Read){if(r->eof)napi_get_null(env,&result);else napi_create_buffer_copy(env,r->bytes,r->buffer.data(),nullptr,&result);}
  else if(r->kind==PeerRequestKind::Write){if(napi_create_object(env,&result)==napi_ok&&!Set(env,result,"bytes",Integer(env,r->bytes)))result=nullptr;}
  else result=Boolean(env,true);
  if(result){
   std::lock_guard<std::recursive_mutex> guard(p->lock);
   const char* finalError=r->error;
   if(!finalError&&r->kind!=PeerRequestKind::Read&&GetTickCount64()>=r->deadline)finalError="PEER_DEADLINE";
   if(!finalError&&r->kind!=PeerRequestKind::Close&&!r->eof&&!PeerCurrentLocked(p.get(),r->lane))finalError="PEER_STALE_COMPLETION";
   if(finalError){delivery.settled=PeerReject(env,r->deferred,finalError);continue;}
  }
  if(result)delivery.settled=napi_resolve_deferred(env,r->deferred,result)==napi_ok;
  else{bool pending=false;napi_is_exception_pending(env,&pending);if(pending){napi_value discarded;napi_get_and_clear_last_exception(env,&discarded);}delivery.settled=PeerReject(env,r->deferred,"PEER_NAPI_FAILURE");}
 }
 {std::lock_guard<std::recursive_mutex> guard(p->lock);
  PeerCleanupRequestsLocked(p.get());
 }
 SetEvent(p->wake.h);
}

void PeerFinishReadLocked(PeerPair* p,unsigned lane,DWORD bytes,DWORD error){
 auto& l=p->lanes[lane];auto r=l.read;if(!r)return;l.readPending=false;r->bytes=bytes;
 if(error==ERROR_BROKEN_PIPE||error==ERROR_PIPE_NOT_CONNECTED||(!error&&bytes==0)){
  r->eof=true;PeerCompleteLocked(r);PeerRetireLocked(p,"PEER_EOF");
 }else if(error){PeerCompleteLocked(r,"PEER_READ_FAILED");PeerRetireLocked(p,"PEER_READ_FAILED");}
 else if(bytes>peerReadLimit){PeerCompleteLocked(r,"PEER_READ_LIMIT");PeerRetireLocked(p,"PEER_READ_LIMIT");}
 else PeerCompleteLocked(r);
 l.read.reset();ResetEvent(l.readEvent.h);
}
void PeerFinishWriteLocked(PeerPair* p,unsigned lane,DWORD bytes,DWORD error){
 auto& l=p->lanes[lane];if(l.writes.empty())return;auto r=l.writes.front();l.writePending=false;r->bytes=bytes;
 const char* failure=error?"PEER_WRITE_FAILED":bytes!=r->buffer.size()?"PEER_PARTIAL_WRITE":nullptr;
 PeerCompleteLocked(r,failure);l.writes.erase(l.writes.begin());ResetEvent(l.writeEvent.h);
 if(failure)PeerRetireLocked(p,failure);
}
void PeerFinishConnectLocked(PeerPair* p,unsigned lane,DWORD error){
 auto& l=p->lanes[lane];auto r=l.start;if(!r)return;l.connectPending=false;
 if(error){PeerCompleteLocked(r,"PEER_CONNECT_FAILED");PeerRetireLocked(p,"PEER_CONNECT_FAILED");}
 else{l.connected=true;if(!PeerCurrentLocked(p,lane)){PeerCompleteLocked(r,"PEER_IDENTITY_REFUSED");PeerRetireLocked(p,"PEER_IDENTITY_REFUSED");}else PeerCompleteLocked(r);}
 l.start.reset();ResetEvent(l.readEvent.h);
}
void PeerReapLocked(PeerPair* p,unsigned lane){
 auto& l=p->lanes[lane];DWORD bytes=0;
 if((l.connectPending||l.readPending)&&WaitForSingleObject(l.readEvent.h,0)==WAIT_OBJECT_0){
  BOOL ok=GetOverlappedResult(l.pipe.h,&l.readOverlapped,&bytes,FALSE);DWORD error=ok?0:GetLastError();
  if(error!=ERROR_IO_INCOMPLETE){if(l.connectPending)PeerFinishConnectLocked(p,lane,error);else PeerFinishReadLocked(p,lane,bytes,error);}
 }
 if(l.writePending&&WaitForSingleObject(l.writeEvent.h,0)==WAIT_OBJECT_0){
  BOOL ok=GetOverlappedResult(l.pipe.h,&l.writeOverlapped,&bytes,FALSE);DWORD error=ok?0:GetLastError();
  if(error!=ERROR_IO_INCOMPLETE)PeerFinishWriteLocked(p,lane,bytes,error);
 }
}
void PeerIssueLocked(PeerPair* p,unsigned lane){
 auto& l=p->lanes[lane];DWORD bytes=0;
 if(l.start&&!l.start->nativeDone&&!l.connectPending){
  if(GetTickCount64()>=l.start->deadline){l.start->error="PEER_DEADLINE";l.start->notify=true;PeerRetireLocked(p,"PEER_DEADLINE");return;}
  if(p->server){
   if(!p->bound)return;l.readOverlapped={};l.readOverlapped.hEvent=l.readEvent.h;ResetEvent(l.readEvent.h);
   BOOL ok=ConnectNamedPipe(l.pipe.h,&l.readOverlapped);DWORD error=ok?0:GetLastError();
   if(!ok&&error==ERROR_IO_PENDING){l.connectPending=true;l.start->active=true;}
   else PeerFinishConnectLocked(p,lane,error==ERROR_PIPE_CONNECTED?0:error);
  }else{
   HANDLE pipe=CreateFileW(l.name.c_str(),peerPipeRights,0,nullptr,OPEN_EXISTING,FILE_FLAG_OVERLAPPED|SECURITY_SQOS_PRESENT|SECURITY_IDENTIFICATION,nullptr);
   if(pipe==INVALID_HANDLE_VALUE){PeerFinishConnectLocked(p,lane,GetLastError());return;}l.pipe=Handle(pipe);PeerFinishConnectLocked(p,lane,0);
  }
 }
 if(p->retiring||!l.connected)return;
 if(l.read&&!l.readPending){
  if(!PeerCurrentLocked(p,lane)){PeerRetireLocked(p,"PEER_IDENTITY_LOST");return;}
  l.readOverlapped={};l.readOverlapped.hEvent=l.readEvent.h;ResetEvent(l.readEvent.h);
  BOOL ok=ReadFile(l.pipe.h,l.read->buffer.data(),static_cast<DWORD>(l.read->buffer.size()),&bytes,&l.readOverlapped);DWORD error=ok?0:GetLastError();
  if(!ok&&error==ERROR_IO_PENDING){l.readPending=true;l.read->active=true;}else PeerFinishReadLocked(p,lane,bytes,error);
 }
 if(p->retiring)return;
 if(!l.writes.empty()&&!l.writePending){
  if(!PeerCurrentLocked(p,lane)){PeerRetireLocked(p,"PEER_IDENTITY_LOST");return;}
  auto r=l.writes.front();
  if(GetTickCount64()>=r->deadline){r->error="PEER_DEADLINE";r->notify=true;PeerRetireLocked(p,"PEER_DEADLINE");return;}
  l.writeOverlapped={};l.writeOverlapped.hEvent=l.writeEvent.h;ResetEvent(l.writeEvent.h);
  BOOL ok=WriteFile(l.pipe.h,r->buffer.data(),static_cast<DWORD>(r->buffer.size()),&bytes,&l.writeOverlapped);DWORD error=ok?0:GetLastError();
  if(!ok&&error==ERROR_IO_PENDING){l.writePending=true;r->active=true;}else PeerFinishWriteLocked(p,lane,bytes,error);
 }
}
bool PeerDrainLocked(PeerPair* p){
 bool pending=false;
 for(auto& l:p->lanes){
  pending=pending||l.connectPending||l.readPending||l.writePending;
  if(l.start&&!l.connectPending){PeerCompleteLocked(l.start,p->retirementError);l.start.reset();}
  if(l.read&&!l.readPending){PeerCompleteLocked(l.read,p->retirementError);l.read.reset();}
  size_t first=l.writePending?1:0;
  while(l.writes.size()>first){auto r=l.writes.back();PeerCompleteLocked(r,p->retirementError);l.writes.pop_back();}
 }
 if(pending)return false;
 PeerObserveLocked(p);p->peerObservedBeforeClose=true;
 for(auto& l:p->lanes){l.pipe=Handle();l.connected=false;}
 p->peer.process=Handle();p->hostWitness.process=Handle();p->mainWitness.process=Handle();p->commonJob=Handle();p->sessionJob=Handle();
 p->ownerKey=nullptr;p->sessionKey=nullptr;p->settled=true;
 for(auto& r:p->requests)if(r->kind==PeerRequestKind::Close&&!r->nativeDone)PeerCompleteLocked(r);
 return true;
}
DWORD WINAPI PeerWorker(void* context){
 std::unique_ptr<std::shared_ptr<PeerPair>> incoming(static_cast<std::shared_ptr<PeerPair>*>(context));auto p=*incoming;incoming.reset();
 for(;;){
  HANDLE waits[7];DWORD count=0,timeout=100;bool notify=false,done=false;
  {std::lock_guard<std::recursive_mutex> guard(p->lock);ULONGLONG now=GetTickCount64();
   for(unsigned lane=0;lane<2;++lane)PeerReapLocked(p.get(),lane);
   if(!p->retiring){
    if((p->bound&&!PeerHeldCurrent(p->peer))||(p->server&&!PeerHeldCurrent(p->hostWitness)))PeerRetireLocked(p.get(),"PEER_PROCESS_EXITED");
    if(now>=p->startupDeadline&&(!p->lanes[0].connected||!p->lanes[1].connected))PeerRetireLocked(p.get(),"PEER_STARTUP_DEADLINE");
   }
   for(auto& r:p->requests)if(r->kind!=PeerRequestKind::Read&&!r->jsDone&&now>=r->deadline){
    if(!r->error)r->error="PEER_DEADLINE";r->notify=true;PeerRetireLocked(p.get(),"PEER_DEADLINE");
   }
   if(!p->retiring){for(unsigned lane=0;lane<2;++lane)PeerIssueLocked(p.get(),lane);}
   if(p->retiring)done=PeerDrainLocked(p.get());
   PeerCleanupRequestsLocked(p.get());
   for(auto& r:p->requests){notify=notify||(r->notify&&!r->jsDone&&!r->delivering);
    if(r->kind!=PeerRequestKind::Read&&!r->jsDone&&r->deadline>now){ULONGLONG left=r->deadline-now;if(left<timeout)timeout=static_cast<DWORD>(left);}}
   waits[count++]=p->wake.h;
   for(auto& l:p->lanes){if(l.readPending||l.connectPending)waits[count++]=l.readEvent.h;if(l.writePending)waits[count++]=l.writeEvent.h;}
   if(!p->retiring&&p->bound&&p->peer.process.h)waits[count++]=p->peer.process.h;
   if(!p->retiring&&p->server&&p->hostWitness.process.h)waits[count++]=p->hostWitness.process.h;
  }
  if(notify)PeerNotify(p.get());if(done)break;
  DWORD waited=WaitForMultipleObjects(count,waits,FALSE,timeout);
  if(waited==WAIT_FAILED){std::lock_guard<std::recursive_mutex> guard(p->lock);PeerRetireLocked(p.get(),"PEER_WAIT_FAILED");}
 }
 if(p->tsfnUsable.exchange(false))napi_release_threadsafe_function(p->tsfn,napi_tsfn_release);
 return 0;
}
std::shared_ptr<PeerPair> PeerNewPair(napi_env env,bool server){
 if(!PeerReserve(server)){Refuse(env,"PEER_CAPACITY_REFUSED");return {};}
 auto p=std::make_shared<PeerPair>();p->server=server;p->counted=true;p->startupDeadline=GetTickCount64()+10000;
 p->requests.reserve(peerRequestLimit);p->wake=Handle(CreateEventW(nullptr,FALSE,FALSE,nullptr));if(!p->wake.h){Refuse(env,"PEER_EVENT_FAILED");return {};}
 for(auto& l:p->lanes){l.writes.reserve(peerWriteCountLimit);l.readEvent=Handle(CreateEventW(nullptr,TRUE,FALSE,nullptr));l.writeEvent=Handle(CreateEventW(nullptr,TRUE,FALSE,nullptr));if(!l.readEvent.h||!l.writeEvent.h){Refuse(env,"PEER_EVENT_FAILED");return {};}}
 {std::lock_guard<std::mutex> registry(peerRegistryLock);for(auto* e:peerEnvironments)if(e->env==env&&!e->closing){p->environment=e;break;}}
 if(!p->environment){Refuse(env,"PEER_ENVIRONMENT_UNAVAILABLE");return {};}return p;
}
bool PeerStartThread(napi_env env,const std::shared_ptr<PeerPair>& p){
 auto* held=new std::shared_ptr<PeerPair>(p);std::unique_ptr<std::shared_ptr<PeerPair>> context(new std::shared_ptr<PeerPair>(p));napi_value name=nullptr;
 if(napi_create_string_utf8(env,"siren-terminal-native-peer",NAPI_AUTO_LENGTH,&name)!=napi_ok||napi_create_threadsafe_function(env,nullptr,nullptr,name,1,1,held,PeerThreadsafeFinalize,held,PeerThreadsafeCall,&p->tsfn)!=napi_ok){delete held;Refuse(env,"PEER_TSFN_FAILED");return false;}
 {std::lock_guard<std::mutex> registry(peerRegistryLock);++p->environment->active;
  for(auto it=peerRegistry.begin();it!=peerRegistry.end();)if(it->expired())it=peerRegistry.erase(it);else ++it;peerRegistry.push_back(p);}
 HANDLE thread=CreateThread(nullptr,512*1024,PeerWorker,context.get(),STACK_SIZE_PARAM_IS_A_RESERVATION,nullptr);
 if(!thread){p->retiring=true;p->settled=true;p->tsfnUsable.store(false);napi_release_threadsafe_function(p->tsfn,napi_tsfn_abort);Refuse(env,"PEER_THREAD_FAILED");return false;}context.release();
 p->thread=Handle(thread);return true;
}
bool PeerEnqueueLocked(napi_env env,PeerPair* p,const std::shared_ptr<PeerRequest>& r,napi_value& promise){
 if(p->requests.size()>=peerRequestLimit)return false;
 if(napi_create_promise(env,&r->deferred,&promise)!=napi_ok)return false;p->requests.push_back(r);SetEvent(p->wake.h);return true;
}
napi_value PeerCreateListeners(napi_env env,napi_callback_info info){
 napi_value a[3];if(!Args(env,info,3,a))return nullptr;auto* host=Get(env,a[0]);if(!host)return nullptr;
 std::lock_guard<std::mutex> fence(host->terminationLock);
 if(host->closed||host->stopping.load()||!PeerHeldCurrent(host->root))return Refuse(env,"PEER_HOST_UNAVAILABLE");
 std::wstring names[2];if(!String(env,a[1],names[0])||!String(env,a[2],names[1])||!PeerName(names[0],0)||!PeerName(names[1],1))return Refuse(env,"PEER_NAME_REFUSED");
 auto p=PeerNewPair(env,true);if(!p)return nullptr;p->ownerKey=host;
 if(!PeerCopyMember(host->root,p->hostWitness)||!PeerDuplicate(host->job.h,JOB_OBJECT_QUERY,p->commonJob))return Refuse(env,"PEER_IDENTITY_DUPLICATE_FAILED");
 // GetCurrentProcess is the documented -1 pseudo handle; do not pass it
 // through the helper that correctly rejects INVALID_HANDLE_VALUE inputs.
 HANDLE actualMain=nullptr;
 if(!DuplicateHandle(GetCurrentProcess(),GetCurrentProcess(),GetCurrentProcess(),&actualMain,peerProcessRights,FALSE,0))return Refuse(env,"PEER_MAIN_IDENTITY_FAILED");
 p->mainWitness.process=Handle(actualMain);
 p->mainWitness.pid=GetCurrentProcessId();if(!ReadIdentity(p->mainWitness))return Refuse(env,"PEER_MAIN_IDENTITY_FAILED");p->mainPid=p->mainWitness.pid;
 std::vector<unsigned char> acl;SECURITY_DESCRIPTOR descriptor{};SECURITY_ATTRIBUTES security{};
 if(!PeerListenerSecurity(acl,descriptor,security))return Refuse(env,"PEER_DACL_FAILED");
 for(unsigned lane=0;lane<2;++lane){p->lanes[lane].name=names[lane];HANDLE pipe=CreateNamedPipeW(names[lane].c_str(),PIPE_ACCESS_DUPLEX|FILE_FLAG_FIRST_PIPE_INSTANCE|FILE_FLAG_OVERLAPPED,PIPE_TYPE_BYTE|PIPE_READMODE_BYTE|PIPE_WAIT|PIPE_REJECT_REMOTE_CLIENTS,1,32768,32768,0,&security);
  if(pipe==INVALID_HANDLE_VALUE)return Refuse(env,"PEER_LISTENER_CREATE_FAILED");p->lanes[lane].pipe=Handle(pipe);}
 if(!PeerStartThread(env,p))return nullptr;auto result=PeerWrap(env,p,&peerPairTag);if(!result)PeerAbortStartup(p.get());return result;
}
bool PeerPrepareStartup(napi_env env,PeerPair* p,Owner* host,const BootstrapPacket& oldPacket,Handle& inheritedWitness,BootstrapPacket& packet){
 std::wstring control,history;if(!p||!PeerPacketNames(oldPacket,control,history)){Refuse(env,"PEER_BOOTSTRAP_REFUSED");return false;}
 std::lock_guard<std::recursive_mutex> guard(p->lock);
 if(!p->server||p->retiring||p->bound||p->startupPrepared||p->ownerKey!=host||control!=p->lanes[0].name||history!=p->lanes[1].name||!PeerHeldCurrent(p->hostWitness)||!PeerHeldCurrent(p->mainWitness)){Refuse(env,"PEER_STARTUP_REFUSED");return false;}
 if(!PeerDuplicate(p->mainWitness.process.h,peerProcessRights,inheritedWitness,true)){Refuse(env,"PEER_WITNESS_DUPLICATE_FAILED");return false;}
 const unsigned char magic[8]={'S','I','R','E','N','T','P','2'};packet.bytes.assign(magic,magic+8);
 uint64_t value=static_cast<uint64_t>(reinterpret_cast<ULONG_PTR>(inheritedWitness.h));for(int i=7;i>=0;--i)packet.bytes.push_back(static_cast<unsigned char>(value>>(i*8)));
 packet.bytes.insert(packet.bytes.end(),oldPacket.bytes.begin(),oldPacket.bytes.end());p->startupPrepared=true;return true;
}
bool PeerBindCreator(napi_env env,PeerPair* p,Session* session){
 if(!p||!session){Refuse(env,"PEER_BIND_REFUSED");return false;}std::lock_guard<std::recursive_mutex> guard(p->lock);
 if(p->retiring||!p->server||!p->startupPrepared||p->bound||!PeerCopyMember(session->root,p->peer)||!PeerDuplicate(session->job.h,JOB_OBJECT_QUERY,p->sessionJob)||!PeerHeldCurrent(p->peer)||!MemberOf(p->peer.process.h,p->commonJob.h)||!MemberOf(p->peer.process.h,p->sessionJob.h)){PeerRetireLocked(p,"PEER_BIND_REFUSED");Refuse(env,"PEER_BIND_REFUSED");return false;}
 p->sessionKey=session;p->creatorPid=p->peer.pid;p->bound=true;PeerObserveLocked(p);SetEvent(p->wake.h);return true;
}
napi_value PeerConsumeBootstrap(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;bool buffer=false;void* raw=nullptr;size_t size=0;
 if(napi_is_buffer(env,a,&buffer)!=napi_ok||!buffer||napi_get_buffer_info(env,a,&raw,&size)!=napi_ok)return Refuse(env,"PEER_BOOTSTRAP_REFUSED");
 PeerWipe inputWipe(raw,size>2064?2064:size);
 if(size<96||size>2064)return Refuse(env,"PEER_BOOTSTRAP_REFUSED");
 auto* bytes=static_cast<unsigned char*>(raw);const unsigned char magic[8]={'S','I','R','E','N','T','P','2'};
 for(unsigned i=0;i<8;++i)if(bytes[i]!=magic[i])return Refuse(env,"PEER_BOOTSTRAP_REFUSED");
 uint64_t value=0;for(unsigned i=8;i<16;++i)value=(value<<8)|bytes[i];
 if(!value||value>static_cast<uint64_t>(~static_cast<ULONG_PTR>(0))||static_cast<ULONG_PTR>(value)==reinterpret_cast<ULONG_PTR>(INVALID_HANDLE_VALUE))return Refuse(env,"PEER_WITNESS_REFUSED");
 HANDLE inherited=reinterpret_cast<HANDLE>(static_cast<ULONG_PTR>(value));DWORD flags=0,pid=GetProcessId(inherited);
 if(!pid||pid==GetCurrentProcessId()||!GetHandleInformation(inherited,&flags)||!(flags&HANDLE_FLAG_INHERIT))return Refuse(env,"PEER_WITNESS_REFUSED");
 // Adopt immediately after process/type/inheritance validation. All later
 // errors, including capacity/allocation errors, close this original. Strip
 // inheritance before any allocation or helper startup can fail.
 Handle original(inherited);Member witnessIdentity;
 if(!SetHandleInformation(original.h,HANDLE_FLAG_INHERIT,0)||!PeerDuplicate(original.h,peerProcessRights,witnessIdentity.process))return Refuse(env,"PEER_WITNESS_REFUSED");
 if(!CloseHandle(original.h))return Refuse(env,"PEER_WITNESS_CLOSE_FAILED");original.h=nullptr;
 witnessIdentity.pid=pid;if(!ReadIdentity(witnessIdentity)||!PeerHeldCurrent(witnessIdentity))return Refuse(env,"PEER_WITNESS_REFUSED");
 napi_value payload=nullptr;void* payloadBytes=nullptr;
 if(napi_create_buffer_copy(env,size-16,bytes+16,&payloadBytes,&payload)!=napi_ok)return Refuse(env,"PEER_NAPI_FAILURE");
 PeerWipe payloadWipe(payloadBytes,size-16);
 BootstrapPacket oldPacket;if(!ReadBootstrap(env,payload,oldPacket))return Refuse(env,"PEER_BOOTSTRAP_REFUSED");
 std::wstring control,history;if(!PeerPacketNames(oldPacket,control,history))return Refuse(env,"PEER_BOOTSTRAP_REFUSED");
 auto p=PeerNewPair(env,false);if(!p)return nullptr;p->peer=std::move(witnessIdentity);
 p->bound=true;p->mainPid=pid;p->creatorPid=GetCurrentProcessId();p->lanes[0].name=control;p->lanes[1].name=history;PeerObserveLocked(p.get());
 if(!PeerStartThread(env,p))return nullptr;napi_value result=nullptr,witnessValue=PeerWrap(env,p,&peerWitnessTag);
 if(!witnessValue||napi_create_object(env,&result)!=napi_ok||!Set(env,result,"witness",witnessValue)||!Set(env,result,"payload",payload)){PeerAbortStartup(p.get());return Refuse(env,"PEER_NAPI_FAILURE");}payloadWipe.preserve=true;return result;
}
napi_value PeerAcceptLane(napi_env env,napi_callback_info info){
 napi_value a[3];if(!Args(env,info,3,a))return nullptr;auto* cap=PeerGetCapability(env,a[0],&peerPairTag);unsigned lane=0;ULONGLONG deadline=0;
 if(!cap)return nullptr;if(!PeerLaneArgument(env,a[1],lane)||!PeerTimeout(env,a[2],deadline))return Refuse(env,"PEER_REQUEST_REFUSED");auto p=cap->pair;
 std::lock_guard<std::recursive_mutex> guard(p->lock);auto& l=p->lanes[lane];
 if(!p->server||p->retiring||l.started)return Refuse(env,"PEER_ACCEPT_REFUSED");
 auto r=std::make_shared<PeerRequest>(PeerRequestKind::Accept);r->lane=lane;r->deadline=deadline;napi_value promise=nullptr;
 if(!PeerEnqueueLocked(env,p.get(),r,promise))return Refuse(env,"PEER_REQUEST_CAPACITY");l.started=true;l.start=r;return promise;
}
napi_value PeerConnectLane(napi_env env,napi_callback_info info){
 napi_value a[4];if(!Args(env,info,4,a))return nullptr;auto* cap=PeerGetCapability(env,a[0],&peerWitnessTag);unsigned lane=0;ULONGLONG deadline=0;std::wstring name;
 if(!cap)return nullptr;if(!String(env,a[1],name)||!PeerLaneArgument(env,a[2],lane)||!PeerTimeout(env,a[3],deadline))return Refuse(env,"PEER_REQUEST_REFUSED");auto p=cap->pair;
 std::lock_guard<std::recursive_mutex> guard(p->lock);auto& l=p->lanes[lane];
 if(p->server||p->retiring||l.started||name!=l.name||!PeerHeldCurrent(p->peer))return Refuse(env,"PEER_CONNECT_REFUSED");
 auto r=std::make_shared<PeerRequest>(PeerRequestKind::Connect);r->lane=lane;r->deadline=deadline;napi_value promise=nullptr;
 if(!PeerEnqueueLocked(env,p.get(),r,promise))return Refuse(env,"PEER_REQUEST_CAPACITY");l.started=true;l.start=r;return promise;
}
napi_value PeerRead(napi_env env,napi_callback_info info){
 napi_value a[2];if(!Args(env,info,2,a))return nullptr;auto* cap=PeerGetCapability(env,a[0],&peerEndpointTag);ULONGLONG deadline=0;
 if(!cap)return nullptr;if(!PeerTimeout(env,a[1],deadline))return Refuse(env,"PEER_REQUEST_REFUSED");auto p=cap->pair;std::lock_guard<std::recursive_mutex> guard(p->lock);auto& l=p->lanes[cap->lane];
 if(!PeerCurrentLocked(p.get(),cap->lane)){PeerRetireLocked(p.get(),"PEER_IDENTITY_LOST");return Refuse(env,"PEER_ENDPOINT_STALE");}
 if(PeerReadOccupiedLocked(p.get(),cap->lane))return Refuse(env,"PEER_READ_BUSY");auto r=std::make_shared<PeerRequest>(PeerRequestKind::Read);r->lane=cap->lane;r->deadline=deadline;r->buffer.resize(peerReadLimit);napi_value promise=nullptr;
 if(!PeerEnqueueLocked(env,p.get(),r,promise))return Refuse(env,"PEER_REQUEST_CAPACITY");l.read=r;return promise;
}
napi_value PeerWrite(napi_env env,napi_callback_info info){
 napi_value a[3];if(!Args(env,info,3,a))return nullptr;auto* cap=PeerGetCapability(env,a[0],&peerEndpointTag);ULONGLONG deadline=0;bool buffer=false;void* bytes=nullptr;size_t size=0;
 if(!cap)return nullptr;if(!PeerTimeout(env,a[2],deadline)||napi_is_buffer(env,a[1],&buffer)!=napi_ok||!buffer||napi_get_buffer_info(env,a[1],&bytes,&size)!=napi_ok||size==0||size>peerWriteLimits[cap->lane])return Refuse(env,"PEER_WRITE_REFUSED");
 auto p=cap->pair;std::lock_guard<std::recursive_mutex> guard(p->lock);auto& l=p->lanes[cap->lane];
 if(!PeerCurrentLocked(p.get(),cap->lane)){PeerRetireLocked(p.get(),"PEER_IDENTITY_LOST");return Refuse(env,"PEER_ENDPOINT_STALE");}
 if(PeerWriteOccupiedLocked(p.get(),cap->lane)>=peerWriteCountLimit||size>peerWriteLimits[cap->lane]-l.writeReserved)return Refuse(env,"PEER_WRITE_CAPACITY");
 auto r=std::make_shared<PeerRequest>(PeerRequestKind::Write);r->lane=cap->lane;r->deadline=deadline;auto* source=static_cast<unsigned char*>(bytes);r->buffer.assign(source,source+size);napi_value promise=nullptr;
 if(!PeerEnqueueLocked(env,p.get(),r,promise))return Refuse(env,"PEER_REQUEST_CAPACITY");l.writeReserved+=size;l.writes.push_back(r);return promise;
}
napi_value PeerAssertCurrent(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* cap=PeerGetCapability(env,a,&peerEndpointTag);if(!cap)return nullptr;
 std::lock_guard<std::recursive_mutex> guard(cap->pair->lock);if(!PeerCurrentLocked(cap->pair.get(),cap->lane)){PeerRetireLocked(cap->pair.get(),"PEER_IDENTITY_LOST");return Refuse(env,"PEER_ENDPOINT_STALE");}return Boolean(env,true);
}
napi_value PeerClose(napi_env env,napi_callback_info info,const napi_type_tag* type){
 napi_value a[2];if(!Args(env,info,2,a))return nullptr;auto* cap=PeerGetCapability(env,a[0],type,true);ULONGLONG deadline=0;
 if(!cap)return nullptr;if(!PeerTimeout(env,a[1],deadline))return Refuse(env,"PEER_REQUEST_REFUSED");auto p=cap->pair;std::lock_guard<std::recursive_mutex> guard(p->lock);
 cap->closed=true;PeerRetireLocked(p.get(),"PEER_EXPLICIT_CLOSE");
 unsigned closes=0;for(auto& r:p->requests)if(r->kind==PeerRequestKind::Close&&(!r->nativeDone||!r->jsDone))++closes;
 if(closes>=peerCloseCountLimit)return Refuse(env,"PEER_CLOSE_CAPACITY");
 auto r=std::make_shared<PeerRequest>(PeerRequestKind::Close);r->deadline=deadline;napi_value promise=nullptr;
 if(p->settled){if(napi_create_promise(env,&r->deferred,&promise)!=napi_ok)return Refuse(env,"PEER_NAPI_FAILURE");napi_resolve_deferred(env,r->deferred,Boolean(env,true));return promise;}
 if(!PeerEnqueueLocked(env,p.get(),r,promise))return Refuse(env,"PEER_REQUEST_CAPACITY");return promise;
}
napi_value PeerCloseEndpoint(napi_env env,napi_callback_info info){return PeerClose(env,info,&peerEndpointTag);}
napi_value PeerCloseListeners(napi_env env,napi_callback_info info){return PeerClose(env,info,&peerPairTag);}
napi_value PeerCloseWitness(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* cap=PeerGetCapability(env,a,&peerWitnessTag,true);if(!cap)return nullptr;
 std::lock_guard<std::recursive_mutex> guard(cap->pair->lock);if(cap->closed)return Boolean(env,true);cap->closed=true;
 if(!cap->pair->lanes[0].connected||!cap->pair->lanes[1].connected)PeerRetireLocked(cap->pair.get(),"PEER_WITNESS_CLOSED");return Boolean(env,true);
}
napi_value PeerSnapshot(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* cap=PeerGetCapability(env,a,&peerEndpointTag,true);if(!cap)return nullptr;auto p=cap->pair;std::lock_guard<std::recursive_mutex> guard(p->lock);auto& l=p->lanes[cap->lane];PeerObserveLocked(p.get());
 napi_value result=nullptr,peer=nullptr,lane=nullptr,direction=nullptr,created=nullptr,image=nullptr,unknown=nullptr;
 CHECK(napi_create_object(env,&result));CHECK(napi_create_object(env,&peer));CHECK(napi_get_null(env,&unknown));
 CHECK(napi_create_string_utf8(env,cap->lane==0?"control":"history",NAPI_AUTO_LENGTH,&lane));CHECK(napi_create_string_utf8(env,p->server?"client":"server",NAPI_AUTO_LENGTH,&direction));
 auto birth=std::to_string(p->peer.created);CHECK(napi_create_string_utf8(env,birth.c_str(),birth.size(),&created));CHECK(napi_create_string_utf16(env,reinterpret_cast<const char16_t*>(p->peer.image.data()),p->peer.image.size(),&image));
 if(!Set(env,peer,"pid",Integer(env,p->peer.pid))||!Set(env,peer,"createdFileTime",created)||!Set(env,peer,"image",image)||!Set(env,peer,"alive",p->peerObservationKnown?Boolean(env,p->peerObservedAlive):unknown)||!Set(env,peer,"exitCode",p->peerObservationKnown?Integer(env,p->peerObservedExitCode):unknown)||!Set(env,peer,"observedBeforeClose",Boolean(env,p->peerObservedBeforeClose)))return Refuse(env,"PEER_NAPI_FAILURE");
 if(!Set(env,result,"lane",lane)||!Set(env,result,"server",Boolean(env,p->server))||!Set(env,result,"connected",Boolean(env,l.connected))||!Set(env,result,"retiring",Boolean(env,p->retiring))||!Set(env,result,"settled",Boolean(env,p->settled))||!Set(env,result,"peer",peer)||!Set(env,result,"mainPid",Integer(env,p->mainPid))||!Set(env,result,"creatorPid",Integer(env,p->creatorPid))||!Set(env,result,"queriedPeerPid",Integer(env,l.queriedPeerPid))||!Set(env,result,"nativeDirection",direction)||!Set(env,result,"bothJobsChecked",Boolean(env,l.bothJobsChecked))||!Set(env,result,"commonJobMember",l.bothJobsChecked?Boolean(env,l.commonJobMember):unknown)||!Set(env,result,"sessionJobMember",l.bothJobsChecked?Boolean(env,l.sessionJobMember):unknown)||!Set(env,result,"readPending",Boolean(env,PeerReadOccupiedLocked(p.get(),cap->lane)))||!Set(env,result,"writePending",Boolean(env,l.writeReserved!=0))||!Set(env,result,"readReservedBytes",Integer(env,PeerReadOccupiedLocked(p.get(),cap->lane)?static_cast<DWORD>(peerReadLimit):0))||!Set(env,result,"writeReservedBytes",Integer(env,static_cast<DWORD>(l.writeReserved)))||!Set(env,result,"heldPeerClosed",Boolean(env,!p->peer.process.h))||!Set(env,result,"generation",Integer(env,static_cast<DWORD>(p->generation)))||!Set(env,result,"readIdleTimeout",Boolean(env,false))||!Set(env,result,"nativeExecutionAdmitted",Boolean(env,false)))return Refuse(env,"PEER_NAPI_FAILURE");return result;
}
