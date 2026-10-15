// Test-only extension to the exact preserved host guard, within its namespace.
// Main alone owns both Job handles. No renderer/product/native admission.
const napi_type_tag sessionTag={0x5147b03e90e54fe1ULL,0x90d743423aef5889ULL};
std::atomic<unsigned> sessionCount{0};
struct Session:Owner {
 Member shell;Handle watchedHost;HANDLE shellWait=nullptr;napi_env env=nullptr;napi_ref hostRef=nullptr;
 DWORD hostPid=0;bool atomicBeforeResume=false,counted=false;
 std::atomic<bool> shellMonitorFired{false},shellMonitorTerminated{false};
 bool DisposeSession(){
  // Never cancel a callback while holding terminationLock.
  if(shellWait&&!UnregisterWaitEx(shellWait,INVALID_HANDLE_VALUE))return false;
  shellWait=nullptr;
  if(!Dispose())return false;
  shell.process=Handle();watchedHost=Handle();
  if(hostRef){napi_delete_reference(env,hostRef);hostRef=nullptr;}
  if(counted){--sessionCount;counted=false;}return true;
 }
};
struct DeleteSession {void operator()(Session* p)const{if(p&&p->DisposeSession())delete p;}};
using OwnedSession=std::unique_ptr<Session,DeleteSession>;
void FinalizeSession(napi_env,void* p,void*){DeleteSession{}(static_cast<Session*>(p));}
Session* SessionGet(napi_env env,napi_value value){
 napi_valuetype type;bool valid=false;void* data=nullptr;
 if(napi_typeof(env,value,&type)!=napi_ok||type!=napi_object||napi_check_object_type_tag(env,value,&sessionTag,&valid)!=napi_ok||!valid||napi_unwrap(env,value,&data)!=napi_ok||!data){Refuse(env,"SESSION_REQUEST_REFUSED");return nullptr;}
 return static_cast<Session*>(data);
}
void CALLBACK ShellExit(PVOID context,BOOLEAN timedOut){
 if(timedOut)return;auto* p=static_cast<Session*>(context);
 std::lock_guard<std::mutex> lock(p->terminationLock);
 p->shellMonitorFired.store(true);
 // A dead control host has its own Host Job monitor/79 authority. Do not
 // race that cause with a second shell-exit termination code.
 if(!p->stopping.load()&&WaitForSingleObject(p->watchedHost.h,0)==WAIT_TIMEOUT){
  bool terminated=TerminateJobObject(p->job.h,80)!=FALSE;
  p->shellMonitorTerminated.store(terminated);if(terminated)p->stopping.store(true);
 }
}
bool FixedPath(const std::wstring& s,bool directory){
 if(s.size()<4||s[1]!=L':'||(s[2]!=L'\\'&&s[2]!=L'/')||!((s[0]>=L'A'&&s[0]<=L'Z')||(s[0]>=L'a'&&s[0]<=L'z'))||s.find(L'"')!=std::wstring::npos||s.find(L':',2)!=std::wstring::npos||s.back()==L'\\')return false;
 DWORD a=GetFileAttributesW(s.c_str());return a!=INVALID_FILE_ATTRIBUTES&&!(a&FILE_ATTRIBUTE_REPARSE_POINT)&&((a&FILE_ATTRIBUTE_DIRECTORY)!=0)==directory;
}
bool CreatorEnvironment(std::vector<wchar_t>& result){
 LPWCH block=GetEnvironmentStringsW();if(!block)return false;
 size_t total=0;bool valid=true;std::vector<std::wstring> entries;
 for(const wchar_t* p=block;*p;p+=wcslen(p)+1){
  size_t n=wcslen(p);total+=n+1;if(total>65536){valid=false;break;}
  if((n>=5&&CompareStringOrdinal(p,5,L"NODE_",5,TRUE)==CSTR_EQUAL)||(n>=9&&CompareStringOrdinal(p,9,L"ELECTRON_",9,TRUE)==CSTR_EQUAL))continue;
  entries.emplace_back(p,n);
 }
 FreeEnvironmentStringsW(block);
 if(!valid)return false;
 const std::wstring fixed=L"ELECTRON_RUN_AS_NODE=1";
 auto at=entries.begin();for(;at!=entries.end();++at)if(CompareStringOrdinal(at->c_str(),-1,fixed.c_str(),-1,TRUE)==CSTR_GREATER_THAN)break;
 entries.insert(at,fixed);for(const auto& entry:entries){result.insert(result.end(),entry.begin(),entry.end());result.push_back(0);}result.push_back(0);return result.size()<=65536;
}
struct Attributes {
 std::vector<unsigned char> bytes;LPPROC_THREAD_ATTRIBUTE_LIST list=nullptr;
 ~Attributes(){if(list)DeleteProcThreadAttributeList(list);}
 bool Init(HANDLE* jobs){
  SIZE_T size=0;InitializeProcThreadAttributeList(nullptr,1,0,&size);
  if(size==0||size>65536)return false;bytes.resize(size);
  auto* p=reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(bytes.data());
  if(!InitializeProcThreadAttributeList(p,1,0,&size))return false;list=p;
  return UpdateProcThreadAttribute(list,0,PROC_THREAD_ATTRIBUTE_JOB_LIST,jobs,2*sizeof(HANDLE),nullptr,nullptr)!=FALSE;
 }
};
napi_value SessionSnapshot(napi_env env,Session* p){
 auto result=Snapshot(env,p);if(!result)return nullptr;
 napi_value shell=Boolean(env,false);if(p->shell.process.h){shell=MemberValue(env,p->shell);if(!shell)return nullptr;}
 if(!Set(env,result,"shell",shell)||!Set(env,result,"hostPid",Integer(env,p->hostPid))||!Set(env,result,"atomicBeforeResume",Boolean(env,p->atomicBeforeResume))||!Set(env,result,"shellMonitorFired",Boolean(env,p->shellMonitorFired.load()))||!Set(env,result,"shellMonitorTerminated",Boolean(env,p->shellMonitorTerminated.load())))return Refuse(env,"NAPI_FAILURE");return result;
}
napi_value CreateSession(napi_env env,napi_callback_info info){
 napi_value a[4];if(!Args(env,info,4,a))return nullptr;
 auto* host=Get(env,a[0]);if(!host)return nullptr;
 std::lock_guard<std::mutex> hostFence(host->terminationLock);
 if(host->closed||host->stopping.load()||WaitForSingleObject(host->root.process.h,0)!=WAIT_TIMEOUT)return Refuse(env,"HOST_UNAVAILABLE");
 if(sessionCount.load()>=8)return Refuse(env,"SESSION_CAPACITY_REFUSED");
 std::wstring exe,script,directory;
 if(!String(env,a[1],exe)||!String(env,a[2],script)||!String(env,a[3],directory)||!FixedPath(exe,false)||!FixedPath(script,false)||!FixedPath(directory,true)||CompareStringOrdinal(exe.c_str(),-1,host->root.image.c_str(),-1,TRUE)!=CSTR_EQUAL)return Refuse(env,"SESSION_FIXED_PATH_REFUSED");
 OwnedSession p(new Session());p->env=env;p->hostPid=host->root.pid;
 HANDLE hostProcess=nullptr;if(!DuplicateHandle(GetCurrentProcess(),host->root.process.h,GetCurrentProcess(),&hostProcess,0,FALSE,DUPLICATE_SAME_ACCESS))return Refuse(env,"SESSION_HOST_IDENTITY_FAILED");p->watchedHost=Handle(hostProcess);
 if(napi_create_reference(env,a[0],1,&p->hostRef)!=napi_ok)return Refuse(env,"NAPI_FAILURE");
 p->job=Handle(CreateJobObjectW(nullptr,nullptr));JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
 if(!p->job.h||!SetInformationJobObject(p->job.h,JobObjectExtendedLimitInformation,&limits,sizeof(limits)))return Refuse(env,"SESSION_CREATE_FAILED");
 HANDLE jobs[]={host->job.h,p->job.h};Attributes attributes;if(!attributes.Init(jobs))return Refuse(env,"SESSION_ATTRIBUTE_FAILED");
 std::vector<wchar_t> environment;if(!CreatorEnvironment(environment))return Refuse(env,"SESSION_ENVIRONMENT_FAILED");
 std::wstring command=L"\""+exe+L"\" \""+script+L"\" \""+directory+L"\"";if(command.size()>32766)return Refuse(env,"SESSION_COMMAND_REFUSED");
 STARTUPINFOEXW si{};si.StartupInfo.cb=sizeof(si);si.lpAttributeList=attributes.list;PROCESS_INFORMATION child{};
 if(!CreateProcessW(exe.c_str(),command.data(),nullptr,nullptr,FALSE,CREATE_SUSPENDED|CREATE_NO_WINDOW|CREATE_UNICODE_ENVIRONMENT|EXTENDED_STARTUPINFO_PRESENT,environment.data(),directory.c_str(),&si.StartupInfo,&child))return Refuse(env,"SESSION_SUSPENDED_CREATE_FAILED");
 p->root.process=Handle(child.hProcess);p->root.pid=child.dwProcessId;Handle thread(child.hThread);
 auto abort=[&](const char* why)->napi_value{
  // Process was never resumed on failure. Both an owned Job and the exact held
  // process are terminated. Cancellation completes before context deletion.
  TerminateJobObject(p->job.h,98);BOOL terminated=TerminateProcess(p->root.process.h,98);
  DWORD waited=WaitForSingleObject(p->root.process.h,3000);
  if(waited!=WAIT_OBJECT_0)return Refuse(env,"SESSION_STARTUP_EXIT_UNVERIFIED");
  (void)terminated;return Refuse(env,why);
 };
 if(!ReadIdentity(p->root)||!MemberOf(p->root.process.h,host->job.h)||!MemberOf(p->root.process.h,p->job.h)||WaitForSingleObject(p->root.process.h,0)!=WAIT_TIMEOUT)return abort("SESSION_ATOMIC_ASSIGNMENT_FAILED");
 if(!RegisterWaitForSingleObject(&p->wait,p->root.process.h,HostExit,static_cast<Owner*>(p.get()),INFINITE,WT_EXECUTEONLYONCE))return abort("SESSION_CREATOR_MONITOR_FAILED");
 p->atomicBeforeResume=true;
 napi_value object;
 if(napi_create_object(env,&object)!=napi_ok||napi_type_tag_object(env,object,&sessionTag)!=napi_ok)return abort("NAPI_FAILURE");
 // Install finalization BEFORE Resume; failure cannot orphan a running creator.
 if(napi_wrap(env,object,p.get(),FinalizeSession,nullptr,nullptr)!=napi_ok)return abort("NAPI_FAILURE");
 if(WaitForSingleObject(p->watchedHost.h,0)!=WAIT_TIMEOUT||ResumeThread(thread.h)!=1){
  void* removed=nullptr;bool unwrapped=napi_remove_wrap(env,object,&removed)==napi_ok;
  auto failure=abort("SESSION_RESUME_FAILED");if(!unwrapped)p.release();return failure;
 }
 ++sessionCount;p->counted=true;p.release();return object;
}
napi_value WatchRoot(napi_env env,napi_callback_info info){
 napi_value a[4];if(!Args(env,info,4,a))return nullptr;auto* p=SessionGet(env,a[0]);if(!p)return nullptr;
 DWORD pid=0;std::wstring image;uint64_t since=0;bool lossless=false;
 if(p->closed||p->shell.process.h||p->stopping.load()||!Number(env,a[1],pid)||pid==p->root.pid||!String(env,a[2],image)||napi_get_value_bigint_uint64(env,a[3],&since,&lossless)!=napi_ok||!lossless)return Refuse(env,"SESSION_ROOT_REQUEST_REFUSED");
 Member shell;shell.pid=pid;shell.process=Handle(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION|SYNCHRONIZE,FALSE,pid));
 if(!shell.process.h||!ReadIdentity(shell)||!MemberOf(shell.process.h,p->job.h)||shell.created<since||since>Now()||WaitForSingleObject(shell.process.h,0)!=WAIT_TIMEOUT||CompareStringOrdinal(shell.image.c_str(),-1,image.c_str(),-1,TRUE)!=CSTR_EQUAL)return Refuse(env,"SESSION_ROOT_IDENTITY_REFUSED");
 p->shell=std::move(shell);
#ifndef SIREN_TEST_DISABLE_SESSION_ROOT_MONITOR
 if(!RegisterWaitForSingleObject(&p->shellWait,p->shell.process.h,ShellExit,p,INFINITE,WT_EXECUTEONLYONCE)){p->shell.process=Handle();return Refuse(env,"SESSION_ROOT_MONITOR_FAILED");}
#endif
 return SessionSnapshot(env,p);
}
napi_value CaptureSession(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=SessionGet(env,a);if(!p)return nullptr;
 if(p->closed||!p->shell.process.h||!p->held.empty())return Refuse(env,"SESSION_CAPTURE_REFUSED");
 alignas(JOBOBJECT_BASIC_PROCESS_ID_LIST) unsigned char buffer[sizeof(JOBOBJECT_BASIC_PROCESS_ID_LIST)+32*sizeof(ULONG_PTR)]{};
 auto* list=reinterpret_cast<JOBOBJECT_BASIC_PROCESS_ID_LIST*>(buffer);
 if(!QueryInformationJobObject(p->job.h,JobObjectBasicProcessIdList,list,sizeof(buffer),nullptr)||list->NumberOfAssignedProcesses!=list->NumberOfProcessIdsInList||list->NumberOfProcessIdsInList<5||list->NumberOfProcessIdsInList>32)return Refuse(env,"SESSION_SET_UNKNOWN");
 std::vector<Member> held;bool creator=false,shell=false;
 for(DWORD i=0;i<list->NumberOfProcessIdsInList;i++){
  ULONG_PTR id=list->ProcessIdList[i];if(id==0||id>0xFFFFFFFF)return Refuse(env,"SESSION_SET_UNKNOWN");
  Member m;m.pid=static_cast<DWORD>(id);m.process=Handle(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION|SYNCHRONIZE,FALSE,m.pid));
  if(!m.process.h||!MemberOf(m.process.h,p->job.h)||!ReadIdentity(m)||WaitForSingleObject(m.process.h,0)!=WAIT_TIMEOUT)return Refuse(env,"SESSION_IDENTITY_UNKNOWN");
  for(const auto& prior:held)if(prior.pid==m.pid)return Refuse(env,"SESSION_DUPLICATE_IDENTITY");
  creator|=m.pid==p->root.pid&&m.created==p->root.created;shell|=m.pid==p->shell.pid&&m.created==p->shell.created;held.push_back(std::move(m));
 }
 if(!creator||!shell)return Refuse(env,"SESSION_REQUIRED_IDENTITY_MISSING");
 p->held=std::move(held);return SessionSnapshot(env,p);
}
napi_value ReadSession(napi_env env,napi_callback_info info){napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=SessionGet(env,a);return p?SessionSnapshot(env,p):nullptr;}
napi_value StopSession(napi_env env,napi_callback_info info){
 napi_value a[2];if(!Args(env,info,2,a))return nullptr;auto* p=SessionGet(env,a[0]);if(!p)return nullptr;DWORD code=0;
 if(p->closed||!Number(env,a[1],code)||(code!=77&&code!=98))return Refuse(env,"SESSION_STOP_REFUSED");
 std::lock_guard<std::mutex> lock(p->terminationLock);
 if(!TerminateJobObject(p->job.h,code))return Refuse(env,"SESSION_STOP_FAILED");p->stopping.store(true);return Boolean(env,true);
}
napi_value CloseSession(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=SessionGet(env,a);if(!p)return nullptr;if(p->closed)return Boolean(env,false);DWORD count=0;
 if(!Active(p,count)||count!=0||WaitForSingleObject(p->root.process.h,0)!=WAIT_OBJECT_0)return Refuse(env,"SESSION_EXIT_UNVERIFIED");
 for(const auto& m:p->held)if(WaitForSingleObject(m.process.h,0)!=WAIT_OBJECT_0)return Refuse(env,"SESSION_EXIT_UNVERIFIED");
 if(p->shell.process.h&&WaitForSingleObject(p->shell.process.h,0)!=WAIT_OBJECT_0)return Refuse(env,"SESSION_EXIT_UNVERIFIED");
 if(!p->DisposeSession())return Refuse(env,"SESSION_MONITOR_CANCEL_FAILED");return Boolean(env,true);
}
napi_value RefreshCompositionHost(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=Get(env,a);if(!p)return nullptr;
 if(p->closed)return Refuse(env,"OWNERSHIP_CLOSED");
 // The external Safety observer still retains the earlier stage handles.
 // Replace this finite native capture only once all earlier descendants died.
 for(const auto& m:p->held)if(m.pid!=p->root.pid&&WaitForSingleObject(m.process.h,0)!=WAIT_OBJECT_0)return Refuse(env,"COMPOSITION_PREVIOUS_STAGE_LIVE");
 p->held.clear();return Capture(env,info);
}
