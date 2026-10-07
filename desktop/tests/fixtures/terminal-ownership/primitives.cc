#include <windows.h>
#include <node_api.h>
#include <memory>
#include <new>

// Test-owned primitive, NOT the product ownership guard. No process creation,
// adoption, arbitrary PID/handle input, shell or renderer bridge is exposed.
namespace {
const napi_type_tag kTag = {0x8a66b1eac25f4109ULL, 0xa231737da58b9281ULL};
struct Owner {
  HANDLE job = nullptr;
  ~Owner() { if (job) CloseHandle(job); }
};
void Finalize(napi_env, void* data, void*) { delete static_cast<Owner*>(data); }
napi_value Refuse(napi_env env, const char* code) {
  napi_throw_error(env, code, code); return nullptr;
}
#define CHECK_NAPI(call) if ((call) != napi_ok) return Refuse(env, "NAPI_FAILURE")
bool Arguments(napi_env env, napi_callback_info info, size_t expected, napi_value* value) {
  size_t count = 2; napi_value values[2];
  if (napi_get_cb_info(env, info, &count, values, nullptr, nullptr) != napi_ok || count != expected) {
    Refuse(env, "OWNERSHIP_REQUEST_REFUSED"); return false;
  }
  if (expected == 1) *value = values[0];
  return true;
}
Owner* Unwrap(napi_env env, napi_callback_info info) {
  napi_value value; if (!Arguments(env, info, 1, &value)) return nullptr;
  napi_valuetype type; bool tagged = false;
  if (napi_typeof(env, value, &type) != napi_ok || type != napi_object ||
      napi_check_object_type_tag(env, value, &kTag, &tagged) != napi_ok || !tagged) {
    Refuse(env, "OWNERSHIP_REQUEST_REFUSED"); return nullptr;
  }
  void* data = nullptr;
  if (napi_unwrap(env, value, &data) != napi_ok || !data) {
    Refuse(env, "OWNERSHIP_REQUEST_REFUSED"); return nullptr;
  }
  return static_cast<Owner*>(data);
}
napi_value Create(napi_env env, napi_callback_info info) {
  if (!Arguments(env, info, 0, nullptr)) return nullptr;
  std::unique_ptr<Owner> owner(new (std::nothrow) Owner());
  if (!owner) return Refuse(env, "OWNERSHIP_ALLOCATION_FAILED");
  owner->job = CreateJobObjectW(nullptr, nullptr);
  if (!owner->job) return Refuse(env, "OWNERSHIP_CREATE_FAILED");
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  if (!SetInformationJobObject(owner->job, JobObjectExtendedLimitInformation, &limits, sizeof(limits)))
    return Refuse(env, "OWNERSHIP_LIMIT_FAILED");
  DWORD flags = 0;
  if (!GetHandleInformation(owner->job, &flags) || (flags & HANDLE_FLAG_INHERIT))
    return Refuse(env, "OWNERSHIP_INHERITANCE_REFUSED");
  napi_value result;
  CHECK_NAPI(napi_create_object(env, &result));
  CHECK_NAPI(napi_type_tag_object(env, result, &kTag));
  CHECK_NAPI(napi_wrap(env, result, owner.get(), Finalize, nullptr, nullptr));
  owner.release(); return result;
}
napi_value Describe(napi_env env, napi_callback_info info) {
  Owner* owner = Unwrap(env, info); if (!owner) return nullptr;
  if (!owner->job) return Refuse(env, "OWNERSHIP_CLOSED");
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
  JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting{}; DWORD flags = 0;
  if (!QueryInformationJobObject(owner->job, JobObjectExtendedLimitInformation, &limits, sizeof(limits), nullptr) ||
      !QueryInformationJobObject(owner->job, JobObjectBasicAccountingInformation, &accounting, sizeof(accounting), nullptr) ||
      !GetHandleInformation(owner->job, &flags)) return Refuse(env, "OWNERSHIP_QUERY_FAILED");
  napi_value result, kill, inherit, active;
  CHECK_NAPI(napi_create_object(env, &result));
  CHECK_NAPI(napi_get_boolean(env, (limits.BasicLimitInformation.LimitFlags & JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE) != 0, &kill));
  CHECK_NAPI(napi_get_boolean(env, (flags & HANDLE_FLAG_INHERIT) != 0, &inherit));
  CHECK_NAPI(napi_create_uint32(env, accounting.ActiveProcesses, &active));
  CHECK_NAPI(napi_set_named_property(env, result, "killOnClose", kill));
  CHECK_NAPI(napi_set_named_property(env, result, "inheritable", inherit));
  CHECK_NAPI(napi_set_named_property(env, result, "activeProcesses", active));
  return result;
}
napi_value Close(napi_env env, napi_callback_info info) {
  Owner* owner = Unwrap(env, info); if (!owner) return nullptr;
  bool wasOpen = owner->job != nullptr;
  if (wasOpen) {
    if (!CloseHandle(owner->job)) return Refuse(env, "OWNERSHIP_CLOSE_FAILED");
    owner->job = nullptr;
  }
  napi_value result; CHECK_NAPI(napi_get_boolean(env, wasOpen, &result)); return result;
}
napi_value Count(napi_env env, napi_callback_info info) {
  if (!Arguments(env, info, 0, nullptr)) return nullptr;
  DWORD count = 0;
  if (!GetProcessHandleCount(GetCurrentProcess(), &count)) return Refuse(env, "OWNERSHIP_COUNT_FAILED");
  napi_value result; CHECK_NAPI(napi_create_uint32(env, count, &result)); return result;
}
}
NAPI_MODULE_INIT() {
  const napi_property_descriptor methods[] = {
    {"createJob", nullptr, Create, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"describeJob", nullptr, Describe, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"closeJob", nullptr, Close, nullptr, nullptr, nullptr, napi_default, nullptr},
    {"processHandleCount", nullptr, Count, nullptr, nullptr, nullptr, napi_default, nullptr}
  };
  CHECK_NAPI(napi_define_properties(env, exports, sizeof(methods)/sizeof(methods[0]), methods));
  return exports;
}
