#include <windows.h>
#include <node_api.h>
#include <atomic>
#include <memory>
#include <string>
#include <vector>

// Test-owned prototype. Only main loads it. No process creation, raw HANDLE
// exposure, PTY import, renderer entrypoint or product admission.
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
 std::atomic<bool> stopping{false},monitorFired{false},monitorTerminateSucceeded{false};
 bool Dispose(){
  // Never close the watched process or free callback context before cancellation
  // completes. Callback takes no JS/main-thread locks and never unregisters itself.
  if(wait&&!UnregisterWaitEx(wait,INVALID_HANDLE_VALUE))return false;
  wait=nullptr;job=Handle();root.process=Handle();held.clear();closed=true;return true;
 }
};
struct DeleteOwner {void operator()(Owner* p)const{if(p&&p->Dispose())delete p;/* On cancellation error retain native context until process teardown. */}};
using Owned=std::unique_ptr<Owner,DeleteOwner>;
void Finalize(napi_env,void* p,void*){DeleteOwner{}(static_cast<Owner*>(p));}
void CALLBACK HostExit(PVOID context,BOOLEAN timedOut){
 auto* p=static_cast<Owner*>(context);if(timedOut)return;
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
 if(!Set(env,result,"active",Integer(env,count))||!Set(env,result,"root",root)||!Set(env,result,"held",array)||!Set(env,result,"killOnClose",Boolean(env,(f&JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE)!=0))||!Set(env,result,"breakaway",Boolean(env,(f&(JOB_OBJECT_LIMIT_BREAKAWAY_OK|JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK))!=0))||!Set(env,result,"inheritable",Boolean(env,(flags&HANDLE_FLAG_INHERIT)!=0))||!Set(env,result,"monitorFired",Boolean(env,p->monitorFired.load()))||!Set(env,result,"monitorTerminateSucceeded",Boolean(env,p->monitorTerminateSucceeded.load())))return Refuse(env,"NAPI_FAILURE");return result;
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
#ifndef SIREN_TEST_DISABLE_HOST_MONITOR
 if(!RegisterWaitForSingleObject(&owner->wait,owner->root.process.h,HostExit,owner.get(),INFINITE,WT_EXECUTEONLYONCE))return Refuse(env,"HOST_MONITOR_FAILED");
#endif
 napi_value object;CHECK(napi_create_object(env,&object));CHECK(napi_type_tag_object(env,object,&tag));CHECK(napi_wrap(env,object,owner.get(),Finalize,nullptr,nullptr));owner.release();return object;
}
napi_value Read(napi_env env,napi_callback_info info){napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=Get(env,a);return p?Snapshot(env,p):nullptr;}
napi_value Capture(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=Get(env,a);if(!p)return nullptr;if(p->closed)return Refuse(env,"OWNERSHIP_CLOSED");if(!p->held.empty())return Refuse(env,"ALREADY_CAPTURED");
 alignas(JOBOBJECT_BASIC_PROCESS_ID_LIST) unsigned char buffer[sizeof(JOBOBJECT_BASIC_PROCESS_ID_LIST)+64*sizeof(ULONG_PTR)]{};
 auto* list=reinterpret_cast<JOBOBJECT_BASIC_PROCESS_ID_LIST*>(buffer);
 if(!QueryInformationJobObject(p->job.h,JobObjectBasicProcessIdList,list,sizeof(buffer),nullptr)||list->NumberOfAssignedProcesses!=list->NumberOfProcessIdsInList||list->NumberOfProcessIdsInList==0||list->NumberOfProcessIdsInList>64)return Refuse(env,"OWNED_SET_UNKNOWN");
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
 p->stopping.store(true);if(!TerminateJobObject(p->job.h,code))return Refuse(env,"OWNERSHIP_STOP_FAILED");return Boolean(env,true);
}
napi_value Close(napi_env env,napi_callback_info info){
 napi_value a;if(!Args(env,info,1,&a))return nullptr;auto* p=Get(env,a);if(!p)return nullptr;if(p->closed)return Boolean(env,false);DWORD count=0;
 if(!Active(p,count)||count!=0)return Refuse(env,"OWNERSHIP_EXIT_UNVERIFIED");for(const auto& m:p->held)if(WaitForSingleObject(m.process.h,0)!=WAIT_OBJECT_0)return Refuse(env,"OWNERSHIP_EXIT_UNVERIFIED");
 if(!p->Dispose())return Refuse(env,"HOST_MONITOR_CANCEL_FAILED");return Boolean(env,true);
}
}
NAPI_MODULE_INIT(){
 const napi_property_descriptor methods[]={
  {"mark",nullptr,Mark,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"start",nullptr,Start,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"capture",nullptr,Capture,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"snapshot",nullptr,Read,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"stop",nullptr,Stop,nullptr,nullptr,nullptr,napi_default,nullptr},
  {"close",nullptr,Close,nullptr,nullptr,nullptr,napi_default,nullptr}
 };CHECK(napi_define_properties(env,exports,sizeof(methods)/sizeof(methods[0]),methods));return exports;
}
