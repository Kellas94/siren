// Inactive Windows read-only candidate. No native execution admission is exported.
// Repeated path/handle observations are not atomic handle-relative traversal.
#include <node_api.h>
#include <windows.h>
#include <algorithm>
#include <array>
#include <atomic>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace {
constexpr size_t kPending = 8, kAncestors = 128, kHandles = 129;
constexpr size_t kPathUnits = 32763, kBufferUnits = 32768; // + four-unit \\?\ prefix
const napi_type_tag kInspectorTag{0xd0efc7933b01a562ULL, 0x8cf54162a49bd7e0ULL};
struct Handle {
  HANDLE value = INVALID_HANDLE_VALUE;
  bool* closeUnknown=nullptr; // worker-owned, never supplied by JavaScript.
  explicit Handle(HANDLE v = INVALID_HANDLE_VALUE,bool* unknown=nullptr) : value(v),closeUnknown(unknown) {}
  void Close() noexcept {if(value!=INVALID_HANDLE_VALUE&&!CloseHandle(value)&&closeUnknown)*closeUnknown=true;value=INVALID_HANDLE_VALUE;}
  ~Handle() { Close(); }
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
  Handle(Handle&& o) noexcept : value(o.value),closeUnknown(o.closeUnknown) { o.value = INVALID_HANDLE_VALUE; }
  Handle& operator=(Handle&& o) noexcept {
    if (this != &o) { Close();value=o.value;closeUnknown=o.closeUnknown;o.value=INVALID_HANDLE_VALUE; } return *this;
  }
};
struct Observation { std::wstring path; std::string identity; bool directory=false; DWORD attributes=0; };
struct Held { Handle handle; Observation observed; };
struct Result { Observation leaf; std::vector<Observation> ancestors; };
struct Environment;
struct Work;
struct Inspector {
  std::shared_ptr<Environment> environment;
  bool retired=false, deliveryUnknown=false;
  size_t pending=0;
  napi_ref retirement=nullptr;
  napi_deferred retirementDeferred=nullptr;
};
struct Environment {
  napi_env env=nullptr;
  napi_async_cleanup_hook_handle cleanup=nullptr;
  std::atomic<bool> closing{false};
  std::vector<Work*> work; // JS/cleanup thread only; workers never access it.
};
enum class Operation { System, Directory, File };
struct Work {
  std::shared_ptr<Environment> environment;
  std::shared_ptr<Inspector> inspector;
  napi_async_work async=nullptr;
  napi_ref receiver=nullptr;
  napi_deferred deferred=nullptr;
  Operation operation=Operation::Directory;
  std::wstring path;
  Result result;
  const char* error=nullptr;
  bool handlesUnknown=false;
};

bool Same(const std::wstring& a, const std::wstring& b) {
  return a.size()==b.size() && CompareStringOrdinal(a.c_str(),static_cast<int>(a.size()),b.c_str(),static_cast<int>(b.size()),TRUE)==CSTR_EQUAL;
}
bool WellFormed(const std::wstring& v) {
  for(size_t i=0;i<v.size();++i) {
    unsigned c=v[i];
    if(c>=0xd800 && c<=0xdbff) { if(++i==v.size() || v[i]<0xdc00 || v[i]>0xdfff) return false; }
    else if(c>=0xdc00 && c<=0xdfff) return false;
  } return true;
}
bool Reserved(const std::wstring& segment) {
  std::wstring name=segment.substr(0,segment.find(L'.'));
  if(Same(name,L"CON")||Same(name,L"PRN")||Same(name,L"AUX")||Same(name,L"NUL")||Same(name,L"CONIN$")||Same(name,L"CONOUT$"))return true;
  if(name.size()==4 && (Same(name.substr(0,3),L"COM")||Same(name.substr(0,3),L"LPT"))) {
    wchar_t c=name[3];return (c>=L'1'&&c<=L'9')||c==0x00b9||c==0x00b2||c==0x00b3;
  } return false;
}
bool Path(const std::wstring& value) {
  if(value.size()<3||value.size()>kPathUnits||!WellFormed(value)||value[1]!=L':'||value[2]!=L'\\'||!((value[0]>=L'A'&&value[0]<=L'Z')||(value[0]>=L'a'&&value[0]<=L'z')))return false;
  for(size_t i=0;i<value.size();++i) {
    wchar_t c=value[i];if(c<32 || (c>=127&&c<=159)||c==L'/'||c==L'"'||c==L'<'||c==L'>'||c==L'|'||c==L'?'||c==L'*'||(c==L':'&&i!=1))return false;
  }
  if(value.size()==3)return true;
  size_t start=3;
  while(start<value.size()) {
    size_t end=value.find(L'\\',start);if(end==std::wstring::npos)end=value.size();
    auto part=value.substr(start,end-start);
    if(part.empty()||part==L"."||part==L".."||part.find(L'~')!=std::wstring::npos||part.back()==L'.'||part.back()==L' '||Reserved(part))return false;
    if(end==value.size())return true;
    start=end+1;if(start==value.size())return false;
  } return false;
}
std::string HexIdentity(const FILE_ID_INFO& info) {
  const char* hex="0123456789abcdef";std::string out;out.reserve(49);
  for(int n=15;n>=0;--n)out.push_back(hex[(info.VolumeSerialNumber>>(4*n))&15]);
  out.push_back(':');for(BYTE b:info.FileId.Identifier){out.push_back(hex[b>>4]);out.push_back(hex[b&15]);}return out;
}
const char* Observe(HANDLE handle,const std::wstring& expected,bool directory,Observation& out) {
  FILE_ATTRIBUTE_TAG_INFO attributes{};FILE_ID_INFO identity{};
  if(!GetFileInformationByHandleEx(handle,FileAttributeTagInfo,&attributes,sizeof(attributes)))return "FS_IDENTITY_FAILED";
  if((attributes.FileAttributes&FILE_ATTRIBUTE_REPARSE_POINT)!=0)return "FS_REPARSE_REFUSED";
  if(((attributes.FileAttributes&FILE_ATTRIBUTE_DIRECTORY)!=0)!=directory || GetFileType(handle)!=FILE_TYPE_DISK)return "FS_TYPE_REFUSED";
  if(!GetFileInformationByHandleEx(handle,FileIdInfo,&identity,sizeof(identity)))return "FS_IDENTITY_FAILED";
  std::array<wchar_t,kBufferUnits> buffer{};
  DWORD size=GetFinalPathNameByHandleW(handle,buffer.data(),static_cast<DWORD>(buffer.size()),FILE_NAME_NORMALIZED|VOLUME_NAME_DOS);
  if(size==0 || size>=buffer.size())return "FS_CANONICAL_REFUSED";
  std::wstring canonical(buffer.data(),size);
  if(canonical.rfind(L"\\\\?\\",0)!=0)return "FS_CANONICAL_REFUSED";
  canonical.erase(0,4);
  if(!Path(canonical)||!Same(canonical,expected))return "FS_CANONICAL_REFUSED";
  out={canonical,HexIdentity(identity),directory,attributes.FileAttributes};return nullptr;
}
const char* Open(const std::wstring& path,bool directory,Held& out,bool& closeUnknown) {
  std::wstring extended=L"\\\\?\\"+path;
  Handle handle(CreateFileW(extended.c_str(),FILE_READ_ATTRIBUTES,FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE,nullptr,OPEN_EXISTING,FILE_FLAG_OPEN_REPARSE_POINT|FILE_FLAG_BACKUP_SEMANTICS,nullptr),&closeUnknown);
  if(handle.value==INVALID_HANDLE_VALUE)return "FS_OPEN_FAILED";
  Observation observation;const char* error=Observe(handle.value,path,directory,observation);if(error)return error;
  out.handle=std::move(handle);out.observed=std::move(observation);return nullptr;
}
const char* Inspect(const std::wstring& path,bool directory,Result& result,bool& closeUnknown) {
  if(!Path(path))return "FS_ARGUMENT_REFUSED";
  if(GetDriveTypeW(path.substr(0,3).c_str())!=DRIVE_FIXED)return "FS_ARGUMENT_REFUSED";
  std::vector<std::wstring> names{path.substr(0,3)};
  for(size_t start=3;start<path.size();) {
    size_t end=path.find(L'\\',start);if(end==std::wstring::npos)end=path.size();
    names.push_back(path.substr(0,end));start=end+1;
  }
  const size_t ancestors=directory?names.size():names.size()-1;
  // Reserve the 129th slot for one temporary path re-open while ALL originals
  // remain held. A file with 128 ancestors is conservatively refused.
  if(!ancestors||ancestors>kAncestors||names.size()>=kHandles)return "FS_ARGUMENT_REFUSED";
  std::vector<Held> held;held.reserve(names.size());
  for(size_t i=0;i<names.size();++i) {
    Held entry;const char* error=Open(names[i],i<ancestors,entry,closeUnknown);if(error)return error;
    held.push_back(std::move(entry));
  }
  // Retain all original handles while reopening EACH exact path. An observable
  // rename/replacement/reparse cannot masquerade as a current ancestry snapshot.
  for(size_t i=0;i<held.size();++i) {
    Observation again;auto& item=held[i];
    const char* error=Observe(item.handle.value,names[i],i<ancestors,again);if(error)return error;
    if(again.identity!=item.observed.identity||again.attributes!=item.observed.attributes)return "FS_CHANGED";
    Held reopened;error=Open(names[i],i<ancestors,reopened,closeUnknown);if(error)return error;
    if(reopened.observed.identity!=item.observed.identity||reopened.observed.attributes!=item.observed.attributes)return "FS_CHANGED";
  }
  result.leaf=held.back().observed;result.ancestors.reserve(ancestors);
  for(size_t i=0;i<ancestors;++i)result.ancestors.push_back(held[i].observed);
  return nullptr; // Every HANDLE closes here, BEFORE any JS promise delivery.
}

// Define OWN DATA, never invoke inherited Object/Array prototype setters.
bool Set(napi_env e,napi_value object,const char* key,napi_value v){
  if(!v)return false;
  napi_property_descriptor d{key,nullptr,nullptr,nullptr,nullptr,v,napi_enumerable,nullptr};
  return napi_define_properties(e,object,1,&d)==napi_ok;
}
// Private transport guard: Promise resolution must NOT read an inherited then
// getter. Adapter validates this exact descriptor and strips it into null-proto
// closed DATA. Nested records are never resolved as independent Promise values.
bool Guard(napi_env e,napi_value object){
  napi_value undefined=nullptr;if(napi_get_undefined(e,&undefined)!=napi_ok)return false;
  napi_property_descriptor d{"then",nullptr,nullptr,nullptr,nullptr,undefined,napi_default,nullptr};
  return napi_define_properties(e,object,1,&d)==napi_ok;
}
napi_value Text(napi_env e,const char* v){napi_value r=nullptr;napi_create_string_utf8(e,v,NAPI_AUTO_LENGTH,&r);return r;}
napi_value Wide(napi_env e,const std::wstring& v){napi_value r=nullptr;std::u16string units(v.begin(),v.end());napi_create_string_utf16(e,units.data(),units.size(),&r);return r;}
napi_value Boolean(napi_env e,bool v){napi_value r=nullptr;napi_get_boolean(e,v,&r);return r;}
napi_value Zero(napi_env e){napi_value r=nullptr;napi_create_uint32(e,0,&r);return r;}
napi_value Error(napi_env e,const char* code){napi_value r=nullptr,message=Text(e,code);if(message)napi_create_error(e,Text(e,code),message,&r);return r;}
napi_value Throw(napi_env e,const char* code){napi_throw_error(e,code,code);return nullptr;}
napi_value Retirement(napi_env e){napi_value r=nullptr;if(napi_create_object(e,&r)!=napi_ok||!Set(e,r,"retired",Boolean(e,true))||!Set(e,r,"actualSettled",Boolean(e,true))||!Set(e,r,"pending",Zero(e))||!Guard(e,r)||napi_object_freeze(e,r)!=napi_ok)return nullptr;return r;}
napi_value Data(napi_env e,const Result& r) {
  napi_value out=nullptr,ancestors=nullptr;
  if(napi_create_object(e,&out)!=napi_ok||napi_create_array_with_length(e,r.ancestors.size(),&ancestors)!=napi_ok)return nullptr;
  for(size_t i=0;i<r.ancestors.size();++i){const auto& a=r.ancestors[i];napi_value item=nullptr;
    if(napi_create_object(e,&item)!=napi_ok||!Set(e,item,"path",Wide(e,a.path))||!Set(e,item,"identity",Text(e,a.identity.c_str()))||!Set(e,item,"directory",Boolean(e,true))||!Set(e,item,"reparse",Boolean(e,false))||napi_object_freeze(e,item)!=napi_ok||!Set(e,ancestors,std::to_string(i).c_str(),item))return nullptr;
  }
  if(napi_object_freeze(e,ancestors)!=napi_ok||!Set(e,out,"canonicalPath",Wide(e,r.leaf.path))||!Set(e,out,"identity",Text(e,r.leaf.identity.c_str()))||!Set(e,out,r.leaf.directory?"directory":"file",Boolean(e,true))||!Set(e,out,"reparse",Boolean(e,false))||!Set(e,out,"ancestors",ancestors)||!Guard(e,out)||napi_object_freeze(e,out)!=napi_ok)return nullptr;
  return out;
}
void SettleRetirement(const std::shared_ptr<Inspector>& s) {
  if(s->retired&&!s->pending&&!s->deliveryUnknown&&s->retirementDeferred&&!s->environment->closing) {
    napi_value result=Retirement(s->environment->env);
    auto deferred=s->retirementDeferred;s->retirementDeferred=nullptr; // Reserve BEFORE possible Promise hooks.
    if(!result||napi_resolve_deferred(s->environment->env,deferred,result)!=napi_ok)s->deliveryUnknown=true;
  }
}
void FinishCleanup(const std::shared_ptr<Environment>& e) {
  if(e->closing&&e->work.empty()&&e->cleanup){auto hook=e->cleanup;e->cleanup=nullptr;napi_remove_async_cleanup_hook(hook);}
}
void Execute(napi_env,void* value) {
  auto* w=static_cast<Work*>(value);
  try {
    if(w->environment->closing){w->error="FS_RETIRED";return;}
    if(w->operation==Operation::System) {
      std::array<wchar_t,kBufferUnits> buffer{};UINT n=GetSystemDirectoryW(buffer.data(),static_cast<UINT>(buffer.size()));
      if(!n||n>=buffer.size()){w->error="FS_SYSTEM_DIRECTORY_FAILED";return;}
      w->path.assign(buffer.data(),n);
    }
    w->error=Inspect(w->path,w->operation!=Operation::File,w->result,w->handlesUnknown);
    if(w->handlesUnknown)w->error="FS_INTERNAL";
  }catch(...){w->error="FS_INTERNAL";}
}
void Complete(napi_env env,napi_status status,void* value) {
  std::unique_ptr<Work> w(static_cast<Work*>(value));auto e=w->environment;auto s=w->inspector;
  bool delivered=e->closing;
  if(!e->closing) {
    try {
      const char* error=status==napi_ok?w->error:"FS_RETIRED";
      if(!error&&s->retired)error="FS_RETIRED";
      napi_value output=error?Error(env,error):(w->operation==Operation::System?Wide(env,w->result.leaf.path):Data(env,w->result));
      if(!output){error="FS_INTERNAL";output=Error(env,error);}
      if(output)delivered=(error?napi_reject_deferred(env,w->deferred,output):napi_resolve_deferred(env,w->deferred,output))==napi_ok;
    }catch(...){delivered=false;}
  }
  if(w->receiver&&napi_delete_reference(env,w->receiver)!=napi_ok)delivered=false;
  if(w->async&&napi_delete_async_work(env,w->async)!=napi_ok)delivered=false;
  if(!delivered||w->handlesUnknown)s->deliveryUnknown=true; // Never refund unknown closure/delivery.
  else if(s->pending)--s->pending;
  e->work.erase(std::remove(e->work.begin(),e->work.end(),w.get()),e->work.end());
  SettleRetirement(s);FinishCleanup(e);
}
bool Receiver(napi_env env,napi_callback_info info,size_t wanted,napi_value* argv,napi_value& self,std::shared_ptr<Inspector>& state) {
  size_t count=2; // all APIs have <=1 arguments; detects ANY extra argument.
  napi_value values[2]{};if(napi_get_cb_info(env,info,&count,values,&self,nullptr)!=napi_ok||count!=wanted)return false;
  bool tagged=false;if(napi_check_object_type_tag(env,self,&kInspectorTag,&tagged)!=napi_ok||!tagged)return false;
  void* p=nullptr;if(napi_unwrap(env,self,&p)!=napi_ok||!p)return false;
  state=*static_cast<std::shared_ptr<Inspector>*>(p);if(wanted)argv[0]=values[0];return true;
}
bool String(napi_env env,napi_value value,std::wstring& out) {
  napi_valuetype type=napi_undefined;if(napi_typeof(env,value,&type)!=napi_ok||type!=napi_string)return false;
  size_t length=0;if(napi_get_value_string_utf16(env,value,nullptr,0,&length)!=napi_ok||length>kPathUnits)return false;
  std::vector<char16_t> buffer(length+1);size_t copied=0;
  if(napi_get_value_string_utf16(env,value,buffer.data(),buffer.size(),&copied)!=napi_ok||copied!=length)return false;
  out.assign(buffer.begin(),buffer.begin()+copied);return Path(out);
}
// No callback was queued on these paths. Free work storage only after trying
// actual N-API cleanup; failed cleanup remains charged and permanently UNKNOWN.
bool ReleaseUnqueued(Work* w) {
  auto s=w->inspector;auto env=w->environment->env;bool clean=true;
  if(w->receiver&&napi_delete_reference(env,w->receiver)!=napi_ok)clean=false;
  if(w->async&&napi_delete_async_work(env,w->async)!=napi_ok)clean=false;
  if(!clean)s->deliveryUnknown=true;else if(!s->deliveryUnknown&&s->pending)--s->pending;
  SettleRetirement(s);
  return clean;
}
napi_value Query(napi_env env,napi_callback_info info,Operation operation) {
  try {
    napi_value self=nullptr,argv[1]{};std::shared_ptr<Inspector> s;
    size_t wanted=operation==Operation::System?0:1;
    if(!Receiver(env,info,wanted,argv,self,s))return Throw(env,"FS_ARGUMENT_REFUSED");
    if(s->retired||s->environment->closing)return Throw(env,"FS_RETIRED");
    if(s->deliveryUnknown)return Throw(env,"FS_INTERNAL");
    if(s->pending>=kPending)return Throw(env,"FS_CAPACITY");
    auto w=std::make_unique<Work>();w->environment=s->environment;w->inspector=s;w->operation=operation;
    if(wanted&&!String(env,argv[0],w->path))return Throw(env,"FS_ARGUMENT_REFUSED");
    ++s->pending; // Charged BEFORE Promise/async-resource hooks can reenter.
    napi_value promise=nullptr;
    if(napi_create_promise(env,&w->deferred,&promise)!=napi_ok){if(w->deferred)s->deliveryUnknown=true;ReleaseUnqueued(w.get());return Throw(env,"FS_INTERNAL");}
    if(s->retired||s->environment->closing){ReleaseUnqueued(w.get());return Throw(env,"FS_RETIRED");}
    if(napi_create_reference(env,self,1,&w->receiver)!=napi_ok){ReleaseUnqueued(w.get());return Throw(env,"FS_INTERNAL");}
    napi_value name=Text(env,"SIRENFilesystemRead");
    if(!name||napi_create_async_work(env,nullptr,name,Execute,Complete,w.get(),&w->async)!=napi_ok){ReleaseUnqueued(w.get());return Throw(env,"FS_INTERNAL");}
    if(s->retired||s->environment->closing){ReleaseUnqueued(w.get());return Throw(env,"FS_RETIRED");}
    // Register before queueing. Failed setup/queueing has no scheduled callback.
    try{s->environment->work.push_back(w.get());}catch(...){ReleaseUnqueued(w.get());return Throw(env,"FS_INTERNAL");}
    if(napi_queue_async_work(env,w->async)!=napi_ok){s->environment->work.pop_back();ReleaseUnqueued(w.get());return Throw(env,"FS_INTERNAL");}
    w.release();return promise;
  }catch(...){return Throw(env,"FS_INTERNAL");}
}
napi_value System(napi_env e,napi_callback_info i){return Query(e,i,Operation::System);}
napi_value Directory(napi_env e,napi_callback_info i){return Query(e,i,Operation::Directory);}
napi_value File(napi_env e,napi_callback_info i){return Query(e,i,Operation::File);}
napi_value Retire(napi_env env,napi_callback_info info) {
  try {
    napi_value self=nullptr;std::shared_ptr<Inspector> s;if(!Receiver(env,info,0,nullptr,self,s))return Throw(env,"FS_ARGUMENT_REFUSED");
    napi_value promise=nullptr;
    if(!s->retirement||napi_get_reference_value(env,s->retirement,&promise)!=napi_ok){s->retired=true;s->deliveryUnknown=true;return Throw(env,"FS_INTERNAL");}
    s->retired=true;SettleRetirement(s);return promise;
  }catch(...){return Throw(env,"FS_INTERNAL");}
}
void Finalize(napi_env env,void* data,void*) {
  auto* pointer=static_cast<std::shared_ptr<Inspector>*>(data);auto s=*pointer;s->retired=true;
  if(s->retirement)napi_delete_reference(env,s->retirement);delete pointer;
}
void Cleanup(napi_async_cleanup_hook_handle handle,void* data) {
  std::unique_ptr<std::shared_ptr<Environment>> owner(static_cast<std::shared_ptr<Environment>*>(data));auto e=*owner;
  e->cleanup=handle;e->closing=true;
  for(Work* w:e->work)napi_cancel_async_work(e->env,w->async); // Running work is NOT freed/counted settled.
  FinishCleanup(e); // Otherwise Complete removes hook only after actual work exits.
}
napi_value Factory(napi_env env,napi_callback_info info) {
  try {
    size_t count=1;napi_value arg,self;void* p=nullptr;
    if(napi_get_cb_info(env,info,&count,&arg,&self,&p)!=napi_ok||count!=0||!p)return Throw(env,"FS_ARGUMENT_REFUSED");
    auto e=*static_cast<std::shared_ptr<Environment>*>(p);if(e->closing)return Throw(env,"FS_RETIRED");
    auto s=std::make_shared<Inspector>();s->environment=e;auto owner=std::make_unique<std::shared_ptr<Inspector>>(s);
    napi_value result=nullptr;if(napi_create_object(env,&result)!=napi_ok)return Throw(env,"FS_INTERNAL");
    napi_property_descriptor methods[]={
      {"getSystemDirectory",nullptr,System,nullptr,nullptr,nullptr,napi_default,nullptr},
      {"inspectDirectory",nullptr,Directory,nullptr,nullptr,nullptr,napi_default,nullptr},
      {"inspectFile",nullptr,File,nullptr,nullptr,nullptr,napi_default,nullptr},
      {"retire",nullptr,Retire,nullptr,nullptr,nullptr,napi_default,nullptr}};
    if(napi_define_properties(env,result,4,methods)!=napi_ok||napi_type_tag_object(env,result,&kInspectorTag)!=napi_ok)return Throw(env,"FS_INTERNAL");
    if(napi_wrap(env,result,owner.get(),Finalize,nullptr,nullptr)!=napi_ok)return Throw(env,"FS_INTERNAL");owner.release();
    // Stable retirement is allocated while this instance is still unpublished.
    // A Promise init hook cannot obtain/reenter Retire on this instance.
    napi_value retirement=nullptr;
    if(napi_create_promise(env,&s->retirementDeferred,&retirement)!=napi_ok)return Throw(env,"FS_INTERNAL");
    if(napi_create_reference(env,retirement,1,&s->retirement)!=napi_ok)return Throw(env,"FS_INTERNAL");
    return result;
  }catch(...){return Throw(env,"FS_INTERNAL");}
}
napi_value Init(napi_env env,napi_value exports) {
  try {
    auto e=std::make_shared<Environment>();e->env=env;
    auto cleanupOwner=std::make_unique<std::shared_ptr<Environment>>(e);
    if(napi_add_async_cleanup_hook(env,Cleanup,cleanupOwner.get(),&e->cleanup)!=napi_ok)return Throw(env,"FS_INTERNAL");cleanupOwner.release();
    // Factory userdata is private module-owned state, never provided by JS.
    auto factoryOwner=std::make_unique<std::shared_ptr<Environment>>(e);napi_value factory=nullptr;
    if(napi_create_function(env,"createFilesystemInspector",NAPI_AUTO_LENGTH,Factory,factoryOwner.get(),&factory)!=napi_ok)return Throw(env,"FS_INTERNAL");
    if(napi_add_finalizer(env,factory,factoryOwner.get(),[](napi_env,void* p,void*){delete static_cast<std::shared_ptr<Environment>*>(p);},nullptr,nullptr)!=napi_ok)return Throw(env,"FS_INTERNAL");factoryOwner.release();
    if(!Set(env,exports,"createFilesystemInspector",factory))return Throw(env,"FS_INTERNAL");return exports;
  }catch(...){return Throw(env,"FS_INTERNAL");}
}
} // namespace
NAPI_MODULE(NODE_GYP_MODULE_NAME,Init)
