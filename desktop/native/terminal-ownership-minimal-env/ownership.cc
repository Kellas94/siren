// Minimal-environment variant; separate source/artifact qualification required.
#include <windows.h>
#include <node_api.h>
#include <atomic>
#include <memory>
#include <mutex>
#include <string>
#include <vector>

// Candidate reusable ownership core. Main-only opaque capabilities.
// Source preparation is not native qualification or product admission.
namespace {
const napi_type_tag tag={0x506eb4ba9e124a07ULL,0x880cfe94dbdc69a1ULL};
struct Handle {
 HANDLE h=nullptr;
 Handle()=default;explicit Handle(HANDLE value):h(value){}
 Handle(const Handle&)=delete;Handle& operator=(const Handle&)=delete;
 Handle(Handle&& other) noexcept:h(other.h){other.h=nullptr;}
 Handle& operator=(Handle&& other) noexcept {if(h)CloseHandle(h);h=other.h;other.h=nullptr;return *this;}
 ~Handle(){if(h)CloseHandle(h);}
};
struct Member {Handle process;DWORD pid=0;ULONGLONG created=0;std::wstring image;};
struct Owner {
 Handle job;Member root;HANDLE wait=nullptr;std::vector<Member> held;bool closed=false;
 std::mutex terminationLock;
 std::atomic<bool> stopping{false},monitorFired{false},monitorTerminateSucceeded{false};
 bool Dispose(){
  // Never close the watched process or free callback context before cancellation
  // completes. Never hold terminationLock while unregistering: the callback
  // may be waiting for it. Callback takes no JS locks and never unregisters.
  if(wait&&!UnregisterWaitEx(wait,INVALID_HANDLE_VALUE))return false;
  wait=nullptr;job=Handle();root.process=Handle();held.clear();closed=true;return true;
 }
};
struct DeleteOwner {void operator()(Owner* p)const{if(p&&p->Dispose())delete p;/* On cancellation error retain native context until process teardown. */}};
using Owned=std::unique_ptr<Owner,DeleteOwner>;
void Finalize(napi_env,void* p,void*){DeleteOwner{}(static_cast<Owner*>(p));}
void CALLBACK HostExit(PVOID context,BOOLEAN timedOut){
 auto* p=static_cast<Owner*>(context);if(timedOut)return;
 std::lock_guard<std::mutex> lock(p->terminationLock);
 p->monitorFired.store(true);
 if(!p->stopping.load())p->monitorTerminateSucceeded.store(TerminateJobObject(p->job.h,79)!=FALSE);
}
napi_value Refuse(napi_env env,const char* code){napi_throw_error(env,code,code);return nullptr;}
#define CHECK(call) if((call)!=napi_ok)return Refuse(env,"NAPI_FAILURE")
bool Args(napi_env env,napi_callback_info info,size_t expected,napi_value* values){
 size_t count=5;napi_value args[5];
 if(napi_get_cb_info(env,info,&count,args,nullptr,nullptr)!=napi_ok||count!=expected){Refuse(env,"OWNERSHIP_REQUEST_REFUSED");return false;}
 for(size_t i=0;i<expected;i++)values[i]=args[i];return true;
}
Owner* Get(napi_env env,napi_value value){
 napi_valuetype type;bool valid=false;void* data=nullptr;
 if(napi_typeof(env,value,&type)!=napi_ok||type!=napi_object||napi_check_object_type_tag(env,value,&tag,&valid)!=napi_ok||!valid||napi_unwrap(env,value,&data)!=napi_ok||!data){Refuse(env,"OWNERSHIP_REQUEST_REFUSED");return nullptr;}
 return static_cast<Owner*>(data);
}
ULONGLONG Ticks(FILETIME t){return (static_cast<ULONGLONG>(t.dwHighDateTime)<<32)|t.dwLowDateTime;}
ULONGLONG Now(){FILETIME time;GetSystemTimeAsFileTime(&time);return Ticks(time);}
bool ReadIdentity(Member& p){
 FILETIME c,e,k,u;if(!GetProcessTimes(p.process.h,&c,&e,&k,&u))return false;p.created=Ticks(c);
 wchar_t buffer[32768];DWORD size=32768;if(!QueryFullProcessImageNameW(p.process.h,0,buffer,&size)||!size)return false;
 p.image.assign(buffer,size);return true;
}
bool Active(Owner* p,DWORD& count){JOBOBJECT_BASIC_ACCOUNTING_INFORMATION a{};if(!QueryInformationJobObject(p->job.h,JobObjectBasicAccountingInformation,&a,sizeof(a),nullptr))return false;count=a.ActiveProcesses;return true;}
bool MemberOf(HANDLE process,HANDLE job){BOOL yes=FALSE;return IsProcessInJob(process,job,&yes)&&yes;}
bool Number(napi_env env,napi_value v,DWORD& n){double d;napi_valuetype t;return napi_typeof(env,v,&t)==napi_ok&&t==napi_number&&napi_get_value_double(env,v,&d)==napi_ok&&d>=1&&d<=0xFFFFFFFF&&d==static_cast<DWORD>(d)&&(n=static_cast<DWORD>(d),true);}
bool String(napi_env env,napi_value v,std::wstring& out){
 napi_valuetype t;size_t size=0;if(napi_typeof(env,v,&t)!=napi_ok||t!=napi_string||napi_get_value_string_utf16(env,v,nullptr,0,&size)!=napi_ok||size==0||size>32767)return false;
 std::vector<char16_t> b(size+1);size_t actual=0;if(napi_get_value_string_utf16(env,v,b.data(),b.size(),&actual)!=napi_ok||actual!=size)return false;
 out.assign(reinterpret_cast<const wchar_t*>(b.data()),size);return out.find(L'\0')==std::wstring::npos;
}
bool Set(napi_env e,napi_value o,const char* k,napi_value v){return napi_set_named_property(e,o,k,v)==napi_ok;}
napi_value Boolean(napi_env e,bool b){napi_value v=nullptr;napi_get_boolean(e,b,&v);return v;}
napi_value Integer(napi_env e,DWORD n){napi_value v=nullptr;napi_create_uint32(e,n,&v);return v;}
napi_value MemberValue(napi_env env,const Member& p){
 DWORD observed=WaitForSingleObject(p.process.h,0),exit=0;
 if(observed!=WAIT_TIMEOUT&&observed!=WAIT_OBJECT_0)return Refuse(env,"PROCESS_EXIT_UNKNOWN");
 if(!GetExitCodeProcess(p.process.h,&exit))return Refuse(env,"PROCESS_EXIT_UNKNOWN");
 napi_value result,image,created;CHECK(napi_create_object(env,&result));
 CHECK(napi_create_string_utf16(env,reinterpret_cast<const char16_t*>(p.image.data()),p.image.size(),&image));
 auto time=std::to_string(p.created);CHECK(napi_create_string_utf8(env,time.c_str(),time.size(),&created));
 if(!Set(env,result,"pid",Integer(env,p.pid))||!Set(env,result,"image",image)||!Set(env,result,"createdFileTime",created)||!Set(env,result,"alive",Boolean(env,observed==WAIT_TIMEOUT))||!Set(env,result,"exitCode",Integer(env,exit)))return Refuse(env,"NAPI_FAILURE");return result;
}
napi_value Snapshot(napi_env env,Owner* p){
 if(p->closed)return Refuse(env,"OWNERSHIP_CLOSED");DWORD count=0,flags=0;JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
 if(!Active(p,count)||!GetHandleInformation(p->job.h,&flags)||!QueryInformationJobObject(p->job.h,JobObjectExtendedLimitInformation,&limits,sizeof(limits),nullptr))return Refuse(env,"OWNERSHIP_QUERY_FAILED");
 napi_value result,array;CHECK(napi_create_object(env,&result));CHECK(napi_create_array_with_length(env,p->held.size(),&array));
 for(size_t i=0;i<p->held.size();i++){auto v=MemberValue(env,p->held[i]);if(!v)return nullptr;CHECK(napi_set_element(env,array,static_cast<uint32_t>(i),v));}
 auto root=MemberValue(env,p->root);if(!root)return nullptr;
 DWORD f=limits.BasicLimitInformation.LimitFlags;
 if(!Set(env,result,"active",Integer(env,count))||!Set(env,result,"root",root)||!Set(env,result,"held",array)||!Set(env,result,"killOnClose",Boolean(env,(f&JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE)!=0))||!Set(env,result,"breakaway",Boolean(env,(f&(JOB_OBJECT_LIMIT_BREAKAWAY_OK|JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK))!=0))||!Set(env,result,"inheritable",Boolean(env,(flags&HANDLE_FLAG_INHERIT)!=0))||!Set(env,result,"monitorFired",Boolean(env,p->monitorFired.load()))||!Set(env,result,"monitorTerminateSucceeded",Boolean(env,p->monitorTerminateSucceeded.load()))||!Set(env,result,"stopping",Boolean(env,p->stopping.load())))return Refuse(env,"NAPI_FAILURE");return result;
}
napi_value Mark(napi_env env,napi_callback_info info){if(!Args(env,info,0,nullptr))return nullptr;napi_value result;CHECK(napi_create_bigint_uint64(env,Now(),&result));return result;}
napi_value Start(napi_env env,napi_callback_info info){
 napi_value a[3];if(!Args(env,info,3,a))return nullptr;DWORD pid=0;std::wstring image;uint64_t since=0;bool lossless=false;
 if(!Number(env,a[0],pid)||pid==GetCurrentProcessId()||!String(env,a[1],image)||napi_get_value_bigint_uint64(env,a[2],&since,&lossless)!=napi_ok||!lossless)return Refuse(env,"OWNERSHIP_REQUEST_REFUSED");
 Owned owner(new Owner());owner->root.pid=pid;owner->root.process=Handle(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION|PROCESS_SET_QUOTA|PROCESS_TERMINATE|SYNCHRONIZE,FALSE,pid));
 if(!owner->root.process.h||!ReadIdentity(owner->root)||owner->root.created<since||since>Now()||WaitForSingleObject(owner->root.process.h,0)!=WAIT_TIMEOUT||CompareStringOrdinal(owner->root.image.c_str(),-1,image.c_str(),-1,TRUE)!=CSTR_EQUAL)return Refuse(env,"HOST_IDENTITY_REFUSED");
 owner->job=Handle(CreateJobObjectW(nullptr,nullptr));if(!owner->job.h)return Refuse(env,"OWNERSHIP_CREATE_FAILED");
 JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
 if(!SetInformationJobObject(owner->job.h,JobObjectExtendedLimitInformation,&limits,sizeof(limits))||!AssignProcessToJobObject(owner->job.h,owner->root.process.h)||!MemberOf(owner->root.process.h,owner->job.h))return Refuse(env,"HOST_ASSIGNMENT_FAILED");
 if(!RegisterWaitForSingleObject(&owner->wait,owner->root.process.h,HostExit,owner.get(),INFINITE,WT_EXECUTEONLYONCE))return Refuse(env,"HOST_MONITOR_FAILED");
 napi_value object;CHECK(napi_create_object(env,&object));CHECK(napi_type_tag_object(env,object,&tag));CHECK(napi_wrap(env,object,owner.get(),Finalize,nullptr,nullptr));owner.release();return object;
}
napi_value Read(napi_env env,napi_callback_info info){napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=Get(env,a);return p?Snapshot(env,p):nullptr;}
napi_value Capture(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=Get(env,a);if(!p)return nullptr;if(p->closed)return Refuse(env,"OWNERSHIP_CLOSED");if(!p->held.empty())return Refuse(env,"ALREADY_CAPTURED");
 alignas(JOBOBJECT_BASIC_PROCESS_ID_LIST) unsigned char buffer[sizeof(JOBOBJECT_BASIC_PROCESS_ID_LIST)+128*sizeof(ULONG_PTR)]{};
 auto* list=reinterpret_cast<JOBOBJECT_BASIC_PROCESS_ID_LIST*>(buffer);
 if(!QueryInformationJobObject(p->job.h,JobObjectBasicProcessIdList,list,sizeof(buffer),nullptr)||list->NumberOfAssignedProcesses!=list->NumberOfProcessIdsInList||list->NumberOfProcessIdsInList==0||list->NumberOfProcessIdsInList>128)return Refuse(env,"OWNED_SET_UNKNOWN");
 std::vector<Member> held;
 for(DWORD i=0;i<list->NumberOfProcessIdsInList;i++){
  auto value=list->ProcessIdList[i];if(value==0||value>0xFFFFFFFF)return Refuse(env,"OWNED_SET_UNKNOWN");
  Member m;m.pid=static_cast<DWORD>(value);m.process=Handle(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION|SYNCHRONIZE,FALSE,m.pid));
  if(!m.process.h||!MemberOf(m.process.h,p->job.h)||!ReadIdentity(m)||WaitForSingleObject(m.process.h,0)!=WAIT_TIMEOUT)return Refuse(env,"OWNED_IDENTITY_UNKNOWN");held.push_back(std::move(m));
 }
 p->held=std::move(held);return Snapshot(env,p);
}
napi_value Stop(napi_env env,napi_callback_info info){
 napi_value a[2];if(!Args(env,info,2,a))return nullptr;auto* p=Get(env,a[0]);DWORD code;if(!p)return nullptr;if(p->closed)return Refuse(env,"OWNERSHIP_CLOSED");
 if(!Number(env,a[1],code)||(code!=77&&code!=98))return Refuse(env,"OWNERSHIP_REQUEST_REFUSED");
 std::lock_guard<std::mutex> lock(p->terminationLock);
 BOOL terminated=FALSE;
 terminated=TerminateJobObject(p->job.h,code);
 if(!terminated)return Refuse(env,"OWNERSHIP_STOP_FAILED");
 // A failed API call must leave host-loss monitoring armed. Serialize this
 // decision with HostExit so a callback cannot skip during a failed request.
 p->stopping.store(true);return Boolean(env,true);
}
napi_value Close(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=Get(env,a);if(!p)return nullptr;if(p->closed)return Boolean(env,false);DWORD count=0;
 if(!Active(p,count)||count!=0)return Refuse(env,"OWNERSHIP_EXIT_UNVERIFIED");for(const auto& m:p->held)if(WaitForSingleObject(m.process.h,0)!=WAIT_OBJECT_0)return Refuse(env,"OWNERSHIP_EXIT_UNVERIFIED");
 if(!p->Dispose())return Refuse(env,"HOST_MONITOR_CANCEL_FAILED");return Boolean(env,true);
}
// Atomically pre-contained creator and held-identity Session ownership.
// Main alone owns both Job handles; no renderer capability or raw HANDLE.
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
bool SystemEnvironmentDirectory(UINT (WINAPI *read)(LPWSTR,UINT),std::wstring& value){
 std::vector<wchar_t> path(32768);UINT n=read(path.data(),static_cast<UINT>(path.size()));
 if(n==0||n>=path.size())return false;
 value.assign(path.data(),n);return FixedPath(value,true)&&value.find(L';')==std::wstring::npos;
}
bool CreatorEnvironment(std::vector<wchar_t>& result,const std::wstring& privateDirectory){
 // No parent environment reads, mutation, PATH/TEMP fallback or private keys.
 std::wstring windows,system;
 if(!SystemEnvironmentDirectory(GetSystemWindowsDirectoryW,windows)||!SystemEnvironmentDirectory(GetSystemDirectoryW,system)||!FixedPath(privateDirectory,true))return false;
 const std::vector<std::wstring> entries={
  L"ComSpec="+system+L"\\cmd.exe",
  L"ELECTRON_RUN_AS_NODE=1",
  L"PATH="+system+L";"+windows,
  L"SystemRoot="+windows,
  L"TEMP="+privateDirectory,
  L"TMP="+privateDirectory,
  L"windir="+windows
 };
 result.clear();
 for(size_t i=0;i<entries.size();++i){
  if(i&&CompareStringOrdinal(entries[i-1].c_str(),-1,entries[i].c_str(),-1,TRUE)!=CSTR_LESS_THAN)return false;
  if(result.size()+entries[i].size()+2>65536)return false;
  result.insert(result.end(),entries[i].begin(),entries[i].end());result.push_back(0);
 }
 result.push_back(0);return true;
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
 std::vector<wchar_t> environment;if(!CreatorEnvironment(environment,directory))return Refuse(env,"SESSION_ENVIRONMENT_FAILED");
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
 if(!RegisterWaitForSingleObject(&p->shellWait,p->shell.process.h,ShellExit,p,INFINITE,WT_EXECUTEONLYONCE)){p->shell.process=Handle();return Refuse(env,"SESSION_ROOT_MONITOR_FAILED");}
 return SessionSnapshot(env,p);
}
napi_value CaptureSession(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=SessionGet(env,a);if(!p)return nullptr;
 if(p->closed||!p->shell.process.h||!p->held.empty())return Refuse(env,"SESSION_CAPTURE_REFUSED");
 alignas(JOBOBJECT_BASIC_PROCESS_ID_LIST) unsigned char buffer[sizeof(JOBOBJECT_BASIC_PROCESS_ID_LIST)+32*sizeof(ULONG_PTR)]{};
 auto* list=reinterpret_cast<JOBOBJECT_BASIC_PROCESS_ID_LIST*>(buffer);
 if(!QueryInformationJobObject(p->job.h,JobObjectBasicProcessIdList,list,sizeof(buffer),nullptr)||list->NumberOfAssignedProcesses!=list->NumberOfProcessIdsInList||list->NumberOfProcessIdsInList<2||list->NumberOfProcessIdsInList>32)return Refuse(env,"SESSION_SET_UNKNOWN");
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
}
NAPI_MODULE_INIT(){
 const napi_property_descriptor methods[]={
  {"createSession",nullptr,CreateSession,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"watchRoot",nullptr,WatchRoot,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"captureSession",nullptr,CaptureSession,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"snapshotSession",nullptr,ReadSession,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"stopSession",nullptr,StopSession,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"closeSession",nullptr,CloseSession,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"captureCompositionHost",nullptr,RefreshCompositionHost,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"mark",nullptr,Mark,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"start",nullptr,Start,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"capture",nullptr,Capture,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"snapshot",nullptr,Read,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"stop",nullptr,Stop,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"close",nullptr,Close,nullptr,nullptr,nullptr,napi_default,nullptr}
 };CHECK(napi_define_properties(env,exports,sizeof(methods)/sizeof(methods[0]),methods));return exports;
}
