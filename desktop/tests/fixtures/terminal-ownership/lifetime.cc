#include <windows.h>
#include <node_api.h>
#include <memory>
#include <string>

// Test-only OS object-lifetime oracle. Jobs contain no processes. A private
// name lets OpenJobObject independently distinguish live from destroyed jobs.
// The negative build deliberately retains one handle until process teardown.
namespace {
const napi_type_tag tag={0x195366bb729a4d81ULL,0xaba71a53c1864327ULL};
volatile LONG64 serial=0;
struct Canary {
  HANDLE job=nullptr, retainedNegative=nullptr;
  std::wstring name;
  ~Canary(){if(job)CloseHandle(job);if(retainedNegative)CloseHandle(retainedNegative);}
};
napi_value Refuse(napi_env env,const char* code){napi_throw_error(env,code,code);return nullptr;}
#define CHECK(call) if((call)!=napi_ok)return Refuse(env,"NAPI_FAILURE")
bool Args(napi_env env,napi_callback_info info,size_t expected,napi_value* value){
  size_t count=2;napi_value values[2];
  if(napi_get_cb_info(env,info,&count,values,nullptr,nullptr)!=napi_ok||count!=expected){Refuse(env,"OWNERSHIP_REQUEST_REFUSED");return false;}
  if(expected)*value=values[0];return true;
}
Canary* Get(napi_env env,napi_callback_info info){
  napi_value value;if(!Args(env,info,1,&value))return nullptr;
  napi_valuetype type;bool valid=false;void* data=nullptr;
  if(napi_typeof(env,value,&type)!=napi_ok||type!=napi_object||napi_check_object_type_tag(env,value,&tag,&valid)!=napi_ok||!valid||napi_unwrap(env,value,&data)!=napi_ok||!data){Refuse(env,"OWNERSHIP_REQUEST_REFUSED");return nullptr;}
  return static_cast<Canary*>(data);
}
void Finalize(napi_env,void* data,void*){delete static_cast<Canary*>(data);}
napi_value Create(napi_env env,napi_callback_info info){
  if(!Args(env,info,0,nullptr))return nullptr;
  auto owner=std::make_unique<Canary>();LARGE_INTEGER ticks;
  if(!QueryPerformanceCounter(&ticks))return Refuse(env,"CLOCK_FAILED");
  owner->name=L"Local\\SIREN.Test.JobLifetime."+std::to_wstring(GetCurrentProcessId())+L"."+std::to_wstring(ticks.QuadPart)+L"."+std::to_wstring(InterlockedIncrement64(&serial));
  SetLastError(ERROR_SUCCESS);owner->job=CreateJobObjectW(nullptr,owner->name.c_str());
  if(!owner->job)return Refuse(env,"OWNERSHIP_CREATE_FAILED");
  if(GetLastError()==ERROR_ALREADY_EXISTS)return Refuse(env,"CANARY_COLLISION");
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  DWORD flags=0;
  if(!SetInformationJobObject(owner->job,JobObjectExtendedLimitInformation,&limits,sizeof(limits))||!GetHandleInformation(owner->job,&flags)||(flags&HANDLE_FLAG_INHERIT))return Refuse(env,"OWNERSHIP_LIMIT_FAILED");
  napi_value object;CHECK(napi_create_object(env,&object));CHECK(napi_type_tag_object(env,object,&tag));
  CHECK(napi_wrap(env,object,owner.get(),Finalize,nullptr,nullptr));owner.release();return object;
}
napi_value Probe(napi_env env,napi_callback_info info){
  auto* owner=Get(env,info);if(!owner)return nullptr;
  SetLastError(ERROR_SUCCESS);HANDLE observed=OpenJobObjectW(JOB_OBJECT_QUERY,FALSE,owner->name.c_str());
  bool exists=observed!=nullptr;
  if(observed){if(!CloseHandle(observed))return Refuse(env,"PROBE_CLOSE_FAILED");}
  else if(GetLastError()!=ERROR_FILE_NOT_FOUND)return Refuse(env,"OS_OBJECT_STATE_UNKNOWN");
  napi_value result,open,present;CHECK(napi_create_object(env,&result));
  CHECK(napi_get_boolean(env,owner->job!=nullptr,&open));CHECK(napi_get_boolean(env,exists,&present));
  CHECK(napi_set_named_property(env,result,"ownerOpen",open));CHECK(napi_set_named_property(env,result,"objectExists",present));return result;
}
napi_value Close(napi_env env,napi_callback_info info){
  auto* owner=Get(env,info);if(!owner)return nullptr;bool open=owner->job!=nullptr;
  if(open){
#ifdef SIREN_LIFETIME_FAULT_RETAIN_OWNER
    owner->retainedNegative=owner->job; // Bounded fault: no process is assigned.
#else
    if(!CloseHandle(owner->job))return Refuse(env,"OWNERSHIP_CLOSE_FAILED");
#endif
    owner->job=nullptr;
  }
  napi_value result;CHECK(napi_get_boolean(env,open,&result));return result;
}
}
NAPI_MODULE_INIT(){
  const napi_property_descriptor methods[]={
    {"create",nullptr,Create,nullptr,nullptr,nullptr,napi_default,nullptr},
    {"probe",nullptr,Probe,nullptr,nullptr,nullptr,napi_default,nullptr},
    {"close",nullptr,Close,nullptr,nullptr,nullptr,napi_default,nullptr}
  };
  CHECK(napi_define_properties(env,exports,sizeof(methods)/sizeof(methods[0]),methods));return exports;
}
