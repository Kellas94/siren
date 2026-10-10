// Isolated async-host native WIP candidate. SOURCE_ONLY / NOT_ADMITTED.
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
const napi_type_tag tag={0x334c414e454f574eULL,0x2026100900040001ULL};
struct Handle {
 HANDLE h=nullptr;
 Handle()=default;explicit Handle(HANDLE value):h(value){}
 Handle(const Handle&)=delete;Handle& operator=(const Handle&)=delete;
 Handle(Handle&& other) noexcept:h(other.h){other.h=nullptr;}
 Handle& operator=(Handle&& other) noexcept {if(h)CloseHandle(h);h=other.h;other.h=nullptr;return *this;}
 ~Handle(){if(h)CloseHandle(h);}
};
struct Member {Handle process;DWORD pid=0;ULONGLONG created=0;std::wstring image;};
struct Owner;struct Session;struct HostAsyncShutdown;
struct HostPeerOwnerToken {};
void HostShutdownFinalize(napi_env,Owner*);
void PeerRetireOwner(Owner*);void PeerRetireSession(Session*);
struct Owner {
 std::atomic<bool> asyncPending{false};
 HostAsyncShutdown* hostShutdown=nullptr;
 std::shared_ptr<HostPeerOwnerToken> peerOwnerToken=std::make_shared<HostPeerOwnerToken>();
 Handle job;Member root;HANDLE wait=nullptr;std::vector<Member> held;bool closed=false;
 std::mutex terminationLock;
 std::atomic<bool> stopping{false},monitorFired{false},monitorTerminateSucceeded{false};
 bool Dispose(){
  if(closed)return true;
  if(hostShutdown)return false; // Unknown async host operation owns every context.
  // Query-only peer Job duplicates must never postpone required termination.
  PeerRetireOwner(this);if(job.h&&!TerminateJobObject(job.h,77))return false;
  // Never close the watched process or free callback context before cancellation
  // completes. Never hold terminationLock while unregistering: the callback
  // may be waiting for it. Callback takes no JS locks and never unregisters.
  if(wait&&!UnregisterWaitEx(wait,INVALID_HANDLE_VALUE))return false;
  wait=nullptr;job=Handle();root.process=Handle();held.clear();closed=true;return true;
 }
};
struct DeleteOwner {void operator()(Owner* p)const{if(p&&p->Dispose())delete p;/* On cancellation error retain native context until process teardown. */}};
using Owned=std::unique_ptr<Owner,DeleteOwner>;
void Finalize(napi_env env,void* raw,void*){auto* p=static_cast<Owner*>(raw);if(p->hostShutdown){HostShutdownFinalize(env,p);return;}DeleteOwner{}(p);}
void CALLBACK HostExit(PVOID context,BOOLEAN timedOut){
 auto* p=static_cast<Owner*>(context);if(timedOut)return;
 std::lock_guard<std::mutex> lock(p->terminationLock);
 p->monitorFired.store(true);
 if(!p->stopping.load()){bool terminated=TerminateJobObject(p->job.h,79)!=FALSE;p->monitorTerminateSucceeded.store(terminated);if(terminated)p->stopping.store(true);}
}
napi_value Refuse(napi_env env,const char* code){napi_throw_error(env,code,code);return nullptr;}
#define CHECK(call) if((call)!=napi_ok)return Refuse(env,"NAPI_FAILURE")
bool Args(napi_env env,napi_callback_info info,size_t expected,napi_value* values){
 size_t count=6;napi_value args[6];
 if(napi_get_cb_info(env,info,&count,args,nullptr,nullptr)!=napi_ok||count!=expected){Refuse(env,"OWNERSHIP_REQUEST_REFUSED");return false;}
 for(size_t i=0;i<expected;i++)values[i]=args[i];return true;
}
Owner* GetHostIdentity(napi_env env,napi_value value){
 napi_valuetype type;bool valid=false;void* data=nullptr;
 if(napi_typeof(env,value,&type)!=napi_ok||type!=napi_object||napi_check_object_type_tag(env,value,&tag,&valid)!=napi_ok||!valid||napi_unwrap(env,value,&data)!=napi_ok||!data){Refuse(env,"OWNERSHIP_REQUEST_REFUSED");return nullptr;}
 return static_cast<Owner*>(data);
}
Owner* Get(napi_env env,napi_value value){auto* p=GetHostIdentity(env,value);if(p&&(p->asyncPending.load()||p->hostShutdown)){Refuse(env,"HOST_ASYNC_PENDING");return nullptr;}return p;}
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
 p->stopping.store(true);PeerRetireOwner(p);return Boolean(env,true);
}
napi_value Close(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=Get(env,a);if(!p)return nullptr;if(p->closed)return Boolean(env,false);DWORD count=0;
 if(!Active(p,count)||count!=0)return Refuse(env,"OWNERSHIP_EXIT_UNVERIFIED");for(const auto& m:p->held)if(WaitForSingleObject(m.process.h,0)!=WAIT_OBJECT_0)return Refuse(env,"OWNERSHIP_EXIT_UNVERIFIED");
 if(!p->Dispose())return Refuse(env,"HOST_MONITOR_CANCEL_FAILED");return Boolean(env,true);
}
// Atomically pre-contained creator and held-identity Session ownership.
// Main alone owns both Job handles; no renderer capability or raw HANDLE.
const napi_type_tag sessionTag={0x334c414e45534553ULL,0x2026100900040002ULL};
std::atomic<unsigned> sessionCount{0};
struct Session:Owner {
 Member shell;Handle watchedHost;HANDLE shellWait=nullptr;napi_env env=nullptr;napi_ref hostRef=nullptr;
 DWORD hostPid=0;bool atomicBeforeResume=false,counted=false;
 std::atomic<bool> shellMonitorFired{false},shellMonitorTerminated{false};
 bool DisposeSession(){
  PeerRetireSession(this);
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
 auto* p=static_cast<Session*>(data);if(p->asyncPending.load()){Refuse(env,"SESSION_ASYNC_PENDING");return nullptr;}return p;
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
// Separate bounded stdin bootstrap; source-only until new native qualification.
struct BootstrapPacket {
 std::vector<unsigned char> bytes;
 ~BootstrapPacket(){if(!bytes.empty())SecureZeroMemory(bytes.data(),bytes.size());}
};
bool BootstrapId(const unsigned char* p,size_t size){
 if(size==0||size>128)return false;
 for(size_t i=0;i<size;++i){unsigned char c=p[i];bool alnum=(c>='a'&&c<='z')||(c>='0'&&c<='9');if(!alnum&&(i==0||(c!='_'&&c!='-')))return false;}return true;
}
bool BootstrapName(const unsigned char* p,size_t size,const char* prefix){
 size_t n=std::char_traits<char>::length(prefix);if(size!=n+32)return false;
 for(size_t i=0;i<n;++i)if(p[i]!=static_cast<unsigned char>(prefix[i]))return false;
 for(size_t i=n;i<size;++i)if(!((p[i]>='0'&&p[i]<='9')||(p[i]>='a'&&p[i]<='f')))return false;return true;
}
bool ReadBootstrap(napi_env env,napi_value value,BootstrapPacket& packet){
 bool buffer=false;void* data=nullptr;size_t size=0;
 if(napi_is_buffer(env,value,&buffer)!=napi_ok||!buffer||napi_get_buffer_info(env,value,&data,&size)!=napi_ok||!data||size<80||size>2048)return false;
 auto* p=static_cast<unsigned char*>(data);const char magic[]="SIRENTB1";
 for(size_t i=0;i<8;++i)if(p[i]!=static_cast<unsigned char>(magic[i]))return false;
 size_t offset=16;const unsigned char* fields[4];size_t lengths[4];
 for(size_t i=0;i<4;++i){size_t n=(static_cast<size_t>(p[8+i*2])<<8)|p[9+i*2];if(n==0||n>size-64-offset)return false;fields[i]=p+offset;lengths[i]=n;offset+=n;}
 if(offset+64!=size||!BootstrapId(fields[0],lengths[0])||!BootstrapId(fields[1],lengths[1])||!BootstrapName(fields[2],lengths[2],"\\\\.\\pipe\\siren-terminal-control-")||!BootstrapName(fields[3],lengths[3],"\\\\.\\pipe\\siren-terminal-data-"))return false;
 unsigned char control=0,channel=0,different=0;for(size_t i=0;i<32;++i){control|=p[offset+i];channel|=p[offset+32+i];different|=p[offset+i]^p[offset+32+i];}
 if(control==0||channel==0||different==0)return false;packet.bytes.assign(p,p+size);return true;
}
// Version-specific transport bootstrap. Legacy SIRENTB1 remains unchanged.
bool ThreeLaneBootstrapFields(const unsigned char* p,size_t size,const unsigned char* (&fields)[5],size_t (&lengths)[5]){
 if(!p||size<114||size>2048)return false;const char magic[]="SIRENTB2";
 for(size_t i=0;i<8;++i)if(p[i]!=static_cast<unsigned char>(magic[i]))return false;
 size_t offset=18;
 for(size_t i=0;i<5;++i){size_t n=(static_cast<size_t>(p[8+i*2])<<8)|p[9+i*2];
  if(offset>size-96||n==0||n>size-96-offset)return false;fields[i]=p+offset;lengths[i]=n;offset+=n;
 }
 if(offset+96!=size||!BootstrapId(fields[0],lengths[0])||!BootstrapId(fields[1],lengths[1])||
  !BootstrapName(fields[2],lengths[2],"\\\\.\\pipe\\siren-terminal-control-")||
  !BootstrapName(fields[3],lengths[3],"\\\\.\\pipe\\siren-terminal-data-")||
  !BootstrapName(fields[4],lengths[4],"\\\\.\\pipe\\siren-terminal-command-"))return false;
 unsigned char present[3]{},different[3]{};
 for(size_t i=0;i<32;++i){
  present[0]|=p[offset+i];present[1]|=p[offset+32+i];present[2]|=p[offset+64+i];
  different[0]|=p[offset+i]^p[offset+32+i];different[1]|=p[offset+i]^p[offset+64+i];different[2]|=p[offset+32+i]^p[offset+64+i];
 }
 return present[0]!=0&&present[1]!=0&&present[2]!=0&&different[0]!=0&&different[1]!=0&&different[2]!=0;
}
bool ReadThreeLaneBootstrap(napi_env env,napi_value value,BootstrapPacket& packet){
 bool buffer=false;void* data=nullptr;size_t size=0;
 if(napi_is_buffer(env,value,&buffer)!=napi_ok||!buffer||napi_get_buffer_info(env,value,&data,&size)!=napi_ok)return false;
 auto* p=static_cast<unsigned char*>(data);const unsigned char* fields[5]{};size_t lengths[5]{};
 if(!ThreeLaneBootstrapFields(p,size,fields,lengths))return false;packet.bytes.assign(p,p+size);return true;
}
struct BootstrapPipe {
 Handle read,write,discard;
 bool Init(){
  SECURITY_ATTRIBUTES security{};security.nLength=sizeof(security);security.bInheritHandle=TRUE;
  HANDLE reader=nullptr,writer=nullptr;if(!CreatePipe(&reader,&writer,&security,4096))return false;
  read=Handle(reader);write=Handle(writer);if(!SetHandleInformation(write.h,HANDLE_FLAG_INHERIT,0))return false;
  HANDLE sink=CreateFileW(L"NUL",GENERIC_WRITE,FILE_SHARE_READ|FILE_SHARE_WRITE,&security,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr);
  if(sink==INVALID_HANDLE_VALUE)return false;discard=Handle(sink);return true;
 }
 bool Fill(const std::vector<unsigned char>& bytes){
  DWORD written=0;BOOL ok=WriteFile(write.h,bytes.data(),static_cast<DWORD>(bytes.size()),&written,nullptr);
  write=Handle();return ok&&written==bytes.size();
 }
};
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
 bool InitBootstrap(HANDLE* jobs,HANDLE* inherited){
  SIZE_T size=0;InitializeProcThreadAttributeList(nullptr,2,0,&size);
  if(size==0||size>65536)return false;bytes.resize(size);
  auto* p=reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(bytes.data());
  if(!InitializeProcThreadAttributeList(p,2,0,&size))return false;list=p;
  return UpdateProcThreadAttribute(list,0,PROC_THREAD_ATTRIBUTE_JOB_LIST,jobs,2*sizeof(HANDLE),nullptr,nullptr)&&UpdateProcThreadAttribute(list,0,PROC_THREAD_ATTRIBUTE_HANDLE_LIST,inherited,2*sizeof(HANDLE),nullptr,nullptr);
 }
 bool InitPeerBootstrap(HANDLE* jobs,HANDLE* inherited){
  SIZE_T size=0;InitializeProcThreadAttributeList(nullptr,2,0,&size);
  if(size==0||size>65536)return false;bytes.resize(size);
  auto* p=reinterpret_cast<LPPROC_THREAD_ATTRIBUTE_LIST>(bytes.data());
  if(!InitializeProcThreadAttributeList(p,2,0,&size))return false;list=p;
  return UpdateProcThreadAttribute(list,0,PROC_THREAD_ATTRIBUTE_JOB_LIST,jobs,2*sizeof(HANDLE),nullptr,nullptr)&&UpdateProcThreadAttribute(list,0,PROC_THREAD_ATTRIBUTE_HANDLE_LIST,inherited,3*sizeof(HANDLE),nullptr,nullptr);
 }
};
napi_value SessionSnapshot(napi_env env,Session* p){
 auto result=Snapshot(env,p);if(!result)return nullptr;
 napi_value shell=Boolean(env,false);if(p->shell.process.h){shell=MemberValue(env,p->shell);if(!shell)return nullptr;}
 if(!Set(env,result,"shell",shell)||!Set(env,result,"hostPid",Integer(env,p->hostPid))||!Set(env,result,"atomicBeforeResume",Boolean(env,p->atomicBeforeResume))||!Set(env,result,"shellMonitorFired",Boolean(env,p->shellMonitorFired.load()))||!Set(env,result,"shellMonitorTerminated",Boolean(env,p->shellMonitorTerminated.load())))return Refuse(env,"NAPI_FAILURE");return result;
}
#include "peer-endpoints.inc"

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
napi_value CreatePeerSession(napi_env env,napi_callback_info info){
 napi_value a[6];if(!Args(env,info,6,a))return nullptr;
 BootstrapPacket packet;if(!ReadThreeLaneBootstrap(env,a[4],packet))return Refuse(env,"SESSION_BOOTSTRAP_REFUSED");
 auto* pair=PeerPairGet(env,a[5]);if(!pair)return nullptr;
 struct Guard {PeerPair* pair;bool committed=false;~Guard(){if(!committed)PeerAbortStartup(pair);}} guard{pair};
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
 BootstrapPipe bootstrap;if(!bootstrap.Init())return Refuse(env,"SESSION_BOOTSTRAP_PIPE_FAILED");
 Handle inheritedWitness;BootstrapPacket peerPacket;
 if(!PeerPrepareStartup(env,pair,host,packet,inheritedWitness,peerPacket))return Refuse(env,"PEER_STARTUP_REFUSED");
 HANDLE inherited[]={bootstrap.read.h,bootstrap.discard.h,inheritedWitness.h};
 HANDLE jobs[]={host->job.h,p->job.h};Attributes attributes;if(!attributes.InitPeerBootstrap(jobs,inherited))return Refuse(env,"SESSION_ATTRIBUTE_FAILED");
 std::vector<wchar_t> environment;if(!CreatorEnvironment(environment,directory))return Refuse(env,"SESSION_ENVIRONMENT_FAILED");
 std::wstring command=L"\""+exe+L"\" \""+script+L"\" \""+directory+L"\"";if(command.size()>32766)return Refuse(env,"SESSION_COMMAND_REFUSED");
 STARTUPINFOEXW si{};si.StartupInfo.cb=sizeof(si);si.lpAttributeList=attributes.list;PROCESS_INFORMATION child{};
 si.StartupInfo.dwFlags|=STARTF_USESTDHANDLES;si.StartupInfo.hStdInput=bootstrap.read.h;si.StartupInfo.hStdOutput=bootstrap.discard.h;si.StartupInfo.hStdError=bootstrap.discard.h;
 if(!CreateProcessW(exe.c_str(),command.data(),nullptr,nullptr,TRUE,CREATE_SUSPENDED|CREATE_NO_WINDOW|CREATE_UNICODE_ENVIRONMENT|EXTENDED_STARTUPINFO_PRESENT,environment.data(),directory.c_str(),&si.StartupInfo,&child))return Refuse(env,"SESSION_SUSPENDED_CREATE_FAILED");
 bootstrap.read=Handle();bootstrap.discard=Handle();inheritedWitness=Handle();
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
 if(!PeerBindCreator(env,pair,p.get()))return abort("PEER_CREATOR_BINDING_REFUSED");
 if(!bootstrap.Fill(peerPacket.bytes))return abort("SESSION_BOOTSTRAP_WRITE_FAILED");
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
 guard.committed=true;++sessionCount;p->counted=true;p.release();return object;
}
napi_value CreateBootstrappedSession(napi_env env,napi_callback_info info){
 napi_value a[5];if(!Args(env,info,5,a))return nullptr;
 BootstrapPacket packet;if(!ReadBootstrap(env,a[4],packet))return Refuse(env,"SESSION_BOOTSTRAP_REFUSED");
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
 BootstrapPipe bootstrap;if(!bootstrap.Init())return Refuse(env,"SESSION_BOOTSTRAP_PIPE_FAILED");
 HANDLE inherited[]={bootstrap.read.h,bootstrap.discard.h};
 HANDLE jobs[]={host->job.h,p->job.h};Attributes attributes;if(!attributes.InitBootstrap(jobs,inherited))return Refuse(env,"SESSION_ATTRIBUTE_FAILED");
 std::vector<wchar_t> environment;if(!CreatorEnvironment(environment,directory))return Refuse(env,"SESSION_ENVIRONMENT_FAILED");
 std::wstring command=L"\""+exe+L"\" \""+script+L"\" \""+directory+L"\"";if(command.size()>32766)return Refuse(env,"SESSION_COMMAND_REFUSED");
 STARTUPINFOEXW si{};si.StartupInfo.cb=sizeof(si);si.lpAttributeList=attributes.list;PROCESS_INFORMATION child{};
 si.StartupInfo.dwFlags|=STARTF_USESTDHANDLES;si.StartupInfo.hStdInput=bootstrap.read.h;si.StartupInfo.hStdOutput=bootstrap.discard.h;si.StartupInfo.hStdError=bootstrap.discard.h;
 if(!CreateProcessW(exe.c_str(),command.data(),nullptr,nullptr,TRUE,CREATE_SUSPENDED|CREATE_NO_WINDOW|CREATE_UNICODE_ENVIRONMENT|EXTENDED_STARTUPINFO_PRESENT,environment.data(),directory.c_str(),&si.StartupInfo,&child))return Refuse(env,"SESSION_SUSPENDED_CREATE_FAILED");
 bootstrap.read=Handle();bootstrap.discard=Handle();
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
 if(!bootstrap.Fill(packet.bytes))return abort("SESSION_BOOTSTRAP_WRITE_FAILED");
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
// Cleanup only: startup remains synchronous and separately unqualified.
struct AsyncStopWork {
 Session* owner=nullptr;napi_ref ownerRef=nullptr;napi_async_work task=nullptr;napi_deferred deferred=nullptr;
 DWORD code=0;ULONGLONG deadline=0;const char* error=nullptr;
};
bool AsyncExited(HANDLE process,bool& dead){
 DWORD state=WaitForSingleObject(process,0);if(state!=WAIT_OBJECT_0&&state!=WAIT_TIMEOUT)return false;
 dead=dead&&state==WAIT_OBJECT_0;return true;
}
void AsyncStopExecute(napi_env,void* context){
 auto* work=static_cast<AsyncStopWork*>(context);auto* p=work->owner;
 if(GetTickCount64()>=work->deadline){work->error="ASYNC_STOP_DEADLINE";return;}
 {
  std::lock_guard<std::mutex> lock(p->terminationLock);
  if(!TerminateJobObject(p->job.h,work->code)){work->error="SESSION_STOP_FAILED";return;}p->stopping.store(true);
 }
 for(;;){
  if(GetTickCount64()>=work->deadline){work->error="ASYNC_STOP_DEADLINE";return;}
  DWORD count=0;if(!Active(p,count)){work->error="SESSION_EXIT_UNVERIFIED";return;}
  bool dead=true;if(!AsyncExited(p->root.process.h,dead)){work->error="SESSION_EXIT_UNVERIFIED";return;}
  for(const auto& held:p->held)if(!AsyncExited(held.process.h,dead)){work->error="SESSION_EXIT_UNVERIFIED";return;}
  if(p->shell.process.h&&!AsyncExited(p->shell.process.h,dead)){work->error="SESSION_EXIT_UNVERIFIED";return;}
  if(count==0&&dead)break;Sleep(2);
 }
 // Cancellation can wait for native callbacks: it never blocks the JS thread.
 // No callback context, process handle or owner is freed in this worker.
 if(p->shellWait&&!UnregisterWaitEx(p->shellWait,INVALID_HANDLE_VALUE)){work->error="SESSION_MONITOR_CANCEL_FAILED";return;}p->shellWait=nullptr;
 if(p->wait&&!UnregisterWaitEx(p->wait,INVALID_HANDLE_VALUE)){work->error="HOST_MONITOR_CANCEL_FAILED";return;}p->wait=nullptr;
 if(GetTickCount64()>=work->deadline)work->error="ASYNC_STOP_DEADLINE";
}
void AsyncStopComplete(napi_env env,napi_status status,void* context){
 std::unique_ptr<AsyncStopWork> work(static_cast<AsyncStopWork*>(context));auto* p=work->owner;
 if(status!=napi_ok)work->error="ASYNC_STOP_CANCELLED";
 if(!work->error&&GetTickCount64()>=work->deadline)work->error="ASYNC_STOP_DEADLINE";
 napi_value result=nullptr;
 if(!work->error){
  // Sample the actual held handles while they still exist. Never manufacture
  // exit identities/accounting from a Boolean after native handles are closed.
  napi_value snapshot=SessionSnapshot(env,p);
  if(!snapshot||napi_create_object(env,&result)!=napi_ok||!Set(env,result,"snapshot",snapshot))work->error="SESSION_FINAL_OBSERVATION_FAILED";
 }
 // The worker cancelled both waits after verified exit. DisposeSession now
 // closes owned handles and releases the host JS reference on the JS thread.
 if(!work->error&&!p->DisposeSession())work->error="SESSION_CLOSE_FAILED";
 if(!work->error&&!Set(env,result,"closed",Boolean(env,true)))work->error="SESSION_FINAL_OBSERVATION_FAILED";
 if(!work->error&&GetTickCount64()>=work->deadline)work->error="ASYNC_STOP_DEADLINE";
 p->asyncPending.store(false);
 if(work->error){
  bool pending=false;napi_is_exception_pending(env,&pending);if(pending){napi_value discarded;napi_get_and_clear_last_exception(env,&discarded);}
  napi_value text,error;napi_create_string_utf8(env,work->error,NAPI_AUTO_LENGTH,&text);napi_create_error(env,text,text,&error);napi_reject_deferred(env,work->deferred,error);
 }else napi_resolve_deferred(env,work->deferred,result);
 napi_delete_reference(env,work->ownerRef);napi_delete_async_work(env,work->task);
}
napi_value StopAndCloseSessionAsync(napi_env env,napi_callback_info info){
 napi_value a[3];if(!Args(env,info,3,a))return nullptr;auto* p=SessionGet(env,a[0]);if(!p)return nullptr;DWORD code=0,timeout=0;
 if(p->closed||!Number(env,a[1],code)||(code!=77&&code!=98)||!Number(env,a[2],timeout)||timeout>10000)return Refuse(env,"SESSION_ASYNC_STOP_REFUSED");
 auto work=std::make_unique<AsyncStopWork>();work->owner=p;work->code=code;work->deadline=GetTickCount64()+timeout;
 napi_value promise,name;
 if(napi_create_promise(env,&work->deferred,&promise)!=napi_ok)return Refuse(env,"NAPI_FAILURE");
 if(napi_create_reference(env,a[0],1,&work->ownerRef)!=napi_ok)return Refuse(env,"NAPI_FAILURE");
 auto failure=[&]()->napi_value{p->asyncPending.store(false);if(work->task)napi_delete_async_work(env,work->task);napi_delete_reference(env,work->ownerRef);return Refuse(env,"NAPI_FAILURE");};
 if(napi_create_string_utf8(env,"siren-terminal-session-cleanup",NAPI_AUTO_LENGTH,&name)!=napi_ok)return failure();
 if(napi_create_async_work(env,nullptr,name,AsyncStopExecute,AsyncStopComplete,work.get(),&work->task)!=napi_ok)return failure();
 p->asyncPending.store(true);if(napi_queue_async_work(env,work->task)!=napi_ok)return failure();
 PeerRetireSession(p);work.release();return promise;
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
 if(!TerminateJobObject(p->job.h,code))return Refuse(env,"SESSION_STOP_FAILED");p->stopping.store(true);PeerRetireSession(p);return Boolean(env,true);
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
 if(!PeerInitialize(env))return Refuse(env,"PEER_ENVIRONMENT_FAILED");
 const napi_property_descriptor methods[]={
  {"createPeerSession",nullptr,CreatePeerSession,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"createPeerListeners",nullptr,PeerCreateListeners,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"acceptPeerLane",nullptr,PeerAcceptLane,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"connectPeerLane",nullptr,PeerConnectLane,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"peerRead",nullptr,PeerRead,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"peerWrite",nullptr,PeerWrite,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"assertPeerCurrent",nullptr,PeerAssertCurrent,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"closePeerEndpoint",nullptr,PeerCloseEndpoint,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"closePeerListeners",nullptr,PeerCloseListeners,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"peerSnapshot",nullptr,PeerSnapshot,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"consumePeerBootstrap",nullptr,PeerConsumeBootstrap,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"closePeerWitness",nullptr,PeerCloseWitness,nullptr,nullptr,nullptr,napi_default,nullptr},

  {"stopAndCloseHostAsync",nullptr,StopAndCloseHostAsync,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"stopAndCloseSessionAsync",nullptr,StopAndCloseSessionAsync,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"createBootstrappedSession",nullptr,CreateBootstrappedSession,nullptr,nullptr,nullptr,napi_default,nullptr},
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
