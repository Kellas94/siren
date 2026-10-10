// Deterministic WIP source derivation only; never builds/loads/executes an addon.
import {createHash} from 'node:crypto';import {types} from 'node:util';
export const HOST_ROSTER_BASE=Object.freeze({ownership:'2b3315e0cb9c8db807291bf313854ff4e3c0e86176cce4eadd201e0dcb008fff',peer:'59c1dee87a64de2cab4fb4ac21b7da6eea96e723f201c55b77d426b11071a34f',binding:'a68e28e5cdb7c062c476cdd19fab1f1426c6c1a40125418474f8f189d21a1a1c'});
const hash=b=>createHash('sha256').update(b).digest('hex'),decode=Buffer.prototype.toString,apply=Reflect.apply;
const byteLength=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'byteLength').get,set=Uint8Array.prototype.set,allocate=Buffer.alloc;
const BASE_BYTES=Object.freeze({ownership:62634,peer:52173,binding:537});
function once(text,from,to,label){if(text.split(from).length!==2)throw Error('HOST_ROSTER_ANCHOR_DRIFT:'+label);return text.replace(from,to);}
const helpers=String.raw`
// Capture exact native-owned ordinals before any async work can publish a
// receipt. Fixed storage survives peers.clear(); no endpoint/receipt inference.
bool HostCapturePeerOrdinalData(HostAsyncShutdown* work){
 if(work->peerRosterCaptured||work->peers.size()>8)return false;
 for(size_t i=0;i<work->peers.size();i++){
  const auto& p=work->peers[i];if(!p)return false;
  std::lock_guard<std::recursive_mutex> guard(p->lock);
  if(!p->server||p->hostOwnerToken!=work->owner->peerOwnerToken||!p->shutdownOrdinal)return false;
  for(size_t j=0;j<i;j++)if(work->peerOrdinals[j]==p->shutdownOrdinal)return false;
  work->peerOrdinals[i]=p->shutdownOrdinal;
 }
 work->peerOrdinalCount=work->peers.size();work->peerRosterCaptured=true;return true;
}
napi_value HostCapturedOrdinalArray(napi_env env,const HostAsyncShutdown* work){
 if(!work->peerRosterCaptured||work->peerOrdinalCount>8)return Refuse(env,"HOST_PEER_ROSTER_UNKNOWN");
 napi_value result=nullptr;CHECK(napi_create_array_with_length(env,work->peerOrdinalCount,&result));
 for(size_t i=0;i<work->peerOrdinalCount;i++)CHECK(napi_set_element(env,result,static_cast<uint32_t>(i),Integer(env,work->peerOrdinals[i])));
 CHECK(napi_object_freeze(env,result));return result;
}
napi_value HostExpectedIdentityData(napi_env env,const Member& m){
 if(!m.pid||!m.created||m.image.empty()||m.image.size()>32767)return Refuse(env,"HOST_EXPECTED_IDENTITY_UNKNOWN");
 napi_value result=nullptr,image=nullptr,created=nullptr;CHECK(napi_create_object(env,&result));
 CHECK(napi_create_string_utf16(env,reinterpret_cast<const char16_t*>(m.image.data()),m.image.size(),&image));
 const auto time=std::to_string(m.created);CHECK(napi_create_string_utf8(env,time.c_str(),time.size(),&created));
 if(!Set(env,result,"pid",Integer(env,m.pid))||!Set(env,result,"image",image)||!Set(env,result,"createdFileTime",created))return Refuse(env,"NAPI_FAILURE");
 CHECK(napi_object_freeze(env,result));return result;
}
bool HostCaptureExpectedData(napi_env env,HostAsyncShutdown* work){
 auto* owner=work->owner;
 if(work->env!=env||work->expectationRef||!work->workerCompleted||!work->peerRosterCaptured||owner->held.size()>128)return false;
 napi_value result=nullptr,request=nullptr,held=nullptr,shutdownId=nullptr;
 if(napi_create_object(env,&result)!=napi_ok||napi_create_object(env,&request)!=napi_ok||napi_create_array_with_length(env,owner->held.size(),&held)!=napi_ok||napi_create_string_utf16(env,reinterpret_cast<const char16_t*>(work->shutdownId.data()),work->shutdownId.size(),&shutdownId)!=napi_ok)return false;
 const auto root=HostExpectedIdentityData(env,owner->root);if(!root)return false;
 for(size_t i=0;i<owner->held.size();i++){
  const auto row=HostExpectedIdentityData(env,owner->held[i]);
  if(!row||napi_set_element(env,held,static_cast<uint32_t>(i),row)!=napi_ok)return false;
 }
 const auto ordinals=HostCapturedOrdinalArray(env,work);if(!ordinals)return false;
 if(!Set(env,request,"shutdownId",shutdownId)||!Set(env,request,"code",Integer(env,work->code))||!Set(env,request,"deadlineMs",Integer(env,work->timeout))||napi_object_freeze(env,request)!=napi_ok||napi_object_freeze(env,held)!=napi_ok)return false;
 if(!Set(env,result,"request",request)||!Set(env,result,"root",root)||!Set(env,result,"held",held)||!Set(env,result,"pairOrdinals",ordinals)||napi_object_freeze(env,result)!=napi_ok)return false;
 return napi_create_reference(env,result,1,&work->expectationRef)==napi_ok;
}
HostAsyncShutdown* HostGetShutdownIdentity(napi_env env,napi_callback_info info){
 napi_value a[2];if(!Args(env,info,2,a))return nullptr;
 auto* owner=GetHostIdentity(env,a[0]);if(!owner)return nullptr;
 std::wstring id;if(!HostShutdownId(env,a[1],id)||!owner->hostShutdown||owner->hostShutdown->env!=env||owner->hostShutdown->shutdownId!=id||owner->hostShutdown->environmentClosing.load()){
  Refuse(env,"HOST_EXPECTATION_REQUEST_REFUSED");return nullptr;
 }
 return owner->hostShutdown;
}
napi_value CaptureHostShutdownPeerRoster(napi_env env,napi_callback_info info){
 auto* work=HostGetShutdownIdentity(env,info);if(!work)return nullptr;
 const auto ordinals=HostCapturedOrdinalArray(env,work);if(!ordinals)return nullptr;
 napi_value result=nullptr,shutdownId=nullptr,scope=nullptr;CHECK(napi_create_object(env,&result));
 CHECK(napi_create_string_utf16(env,reinterpret_cast<const char16_t*>(work->shutdownId.data()),work->shutdownId.size(),&shutdownId));
 CHECK(napi_create_string_utf8(env,"HOST_ASYNC_CAPTURED_PEER_ROSTER",NAPI_AUTO_LENGTH,&scope));
 if(!Set(env,result,"version",Integer(env,1))||!Set(env,result,"shutdownId",shutdownId)||!Set(env,result,"scope",scope)||!Set(env,result,"pairOrdinals",ordinals))return Refuse(env,"NAPI_FAILURE");
 CHECK(napi_object_freeze(env,result));return result;
}
napi_value CaptureHostShutdownExpectation(napi_env env,napi_callback_info info){
 auto* work=HostGetShutdownIdentity(env,info);if(!work)return nullptr;
 if(work->error||!work->workerCompleted||!work->receiptDelivered||!work->owner->closed||work->owner->asyncPending.load()||!work->expectationRef)return Refuse(env,"HOST_EXPECTATION_UNAVAILABLE");
 napi_value result=nullptr;CHECK(napi_get_reference_value(env,work->expectationRef,&result));
 return result?result:Refuse(env,"HOST_EXPECTATION_UNAVAILABLE");
}
`;
export function deriveHostRosterCandidate(value,...extra){
 if(extra.length||!value||typeof value!=='object'||types.isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw Error('HOST_ROSTER_INPUT_REFUSED');
 const keys=Reflect.ownKeys(value);if(keys.length!==3||keys.some(k=>!Object.hasOwn(HOST_ROSTER_BASE,k)))throw Error('HOST_ROSTER_INPUT_REFUSED');
 const input=Object.create(null);for(const key of Object.keys(HOST_ROSTER_BASE)){const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value')||types.isProxy(d.value)||!types.isUint8Array(d.value)||!Buffer.isBuffer(d.value))throw Error('HOST_ROSTER_INPUT_REFUSED');const size=apply(byteLength,d.value,[]);if(size!==BASE_BYTES[key])throw Error('HOST_ROSTER_BASE_DRIFT:'+key);const copy=allocate(size);apply(set,copy,[d.value]);input[key]=copy;}
 for(const [key,expected]of Object.entries(HOST_ROSTER_BASE))if(hash(input[key])!==expected)throw Error('HOST_ROSTER_BASE_DRIFT:'+key);
 let ownership=apply(decode,input.ownership,[]).replaceAll('\r\n','\n'),peer=apply(decode,input.peer,[]).replaceAll('\r\n','\n');
 ownership=once(ownership,'// Isolated async-host native WIP candidate. SOURCE_ONLY / NOT_ADMITTED.','// Isolated native-owned host roster WIP candidate. SOURCE_ONLY / NOT_ADMITTED.','header');
 for(let i=1;i<=5;i++){const from='0x202610090004000'+i+'ULL',to='0x202610100005000'+i+'ULL';if(i<=2)ownership=once(ownership,from,to,'opaque-family'+i);else peer=once(peer,from,to,'opaque-family'+i);}
 ownership=once(ownership,'napi_ref ownerRef=nullptr,promiseRef=nullptr;','napi_ref ownerRef=nullptr,promiseRef=nullptr,expectationRef=nullptr;','expected-reference');
 ownership=once(ownership,'Handle cancelEvent;bool cancellationRequested=false,workerCompleted=false;','Handle cancelEvent;bool cancellationRequested=false,workerCompleted=false,receiptDelivered=false;\n DWORD peerOrdinals[8]{};size_t peerOrdinalCount=0;bool peerRosterCaptured=false;','fixed-roster');
 const exitStart=ownership.indexOf('bool HostExactExited(const Member& m,bool& dead){'),exitEnd=ownership.indexOf('bool HostCaptureCurrentMembers(',exitStart);
 if(exitStart<0||exitEnd<=exitStart)throw Error('HOST_ROSTER_ANCHOR_DRIFT:held-exit-observation');
 ownership=ownership.slice(0,exitStart)+`bool HostExactExited(const Member& m,bool& dead){
 if(!m.process.h||m.image.empty()||GetProcessId(m.process.h)!=m.pid)return false;
 FILETIME c,e,k,u;if(!GetProcessTimes(m.process.h,&c,&e,&k,&u)||Ticks(c)!=m.created)return false;
 DWORD state=WaitForSingleObject(m.process.h,0),code=0;
 if((state!=WAIT_OBJECT_0&&state!=WAIT_TIMEOUT)||!GetExitCodeProcess(m.process.h,&code))return false;
 // The exact retained HANDLE identifies the object after exit. Windows may
 // no longer provide its executable path; image was checked while it was live.
 if(state==WAIT_OBJECT_0)return true;
 wchar_t image[32768];DWORD length=32768;
 if(!QueryFullProcessImageNameW(m.process.h,0,image,&length)){
  // Exit can race the live observation. Unknown or still-live query failure
  // remains a refusal; only the same signaled HANDLE with exit data can pass.
  return WaitForSingleObject(m.process.h,0)==WAIT_OBJECT_0&&GetExitCodeProcess(m.process.h,&code);
 }
 if(length!=m.image.size()||CompareStringOrdinal(image,static_cast<int>(length),m.image.c_str(),static_cast<int>(m.image.size()),TRUE)!=CSTR_EQUAL)return false;
 dead=false;return true;
}
`+ownership.slice(exitEnd);
 ownership=once(ownership,'bool HostExactExited(const Member& m,bool& dead){',helpers+'\nbool HostExactExited(const Member& m,bool& dead){','native-expected-accessors');
 ownership=once(ownership,'if(!work->error&&!HostCloseVerified(p))work->error="HOST_CLOSE_UNVERIFIED";','if(!work->error&&!HostCaptureExpectedData(env,work))work->error="HOST_EXPECTATION_CAPTURE_FAILED";\n if(!work->error&&!HostCloseVerified(p))work->error="HOST_CLOSE_UNVERIFIED";','expected-before-close');
 ownership=once(ownership,'p->asyncPending.store(false);work->peers.clear();napi_close_handle_scope(env,handles);','work->receiptDelivered=true;p->asyncPending.store(false);work->peers.clear();napi_close_handle_scope(env,handles);','publish-success-only');
 ownership=once(ownership,'if(!env||!work||p->asyncPending.load()||!p->closed||work->ownerRef||work->task||work->cleanupHook)return;','if(!env||!work||work->env!=env||p->asyncPending.load()||!p->closed||work->ownerRef||work->task||work->cleanupHook)return;','finalizer-environment');
 ownership=once(ownership,'auto* prior=p->hostShutdown;if(prior->code!=code||prior->timeout!=timeout||prior->shutdownId!=shutdownId)return Refuse(env,"HOST_SHUTDOWN_CONFLICT");','auto* prior=p->hostShutdown;if(prior->env!=env)return Refuse(env,"HOST_ENVIRONMENT_REFUSED");\n  if(prior->code!=code||prior->timeout!=timeout||prior->shutdownId!=shutdownId)return Refuse(env,"HOST_SHUTDOWN_CONFLICT");','duplicate-environment');
 ownership=once(ownership,'if(work->promiseRef)napi_delete_reference(env,work->promiseRef);p->hostShutdown=nullptr;delete work;DeleteOwner{}(p);','if(work->expectationRef){if(napi_delete_reference(env,work->expectationRef)!=napi_ok)return;work->expectationRef=nullptr;}\n if(work->promiseRef){if(napi_delete_reference(env,work->promiseRef)!=napi_ok)return;work->promiseRef=nullptr;}\n p->hostShutdown=nullptr;delete work;DeleteOwner{}(p);','verified-reference-finalization');
 ownership=once(ownership,'if(napi_queue_async_work(env,owned->task)!=napi_ok){owned->error="HOST_ASYNC_QUEUE_FAILED";HostRejectRetained(env,owned);return promise;}','if(!HostCapturePeerOrdinalData(owned)){owned->error="HOST_PEER_ORDINAL_CAPTURE_FAILED";HostRejectRetained(env,owned);return promise;}\n if(napi_queue_async_work(env,owned->task)!=napi_ok){owned->error="HOST_ASYNC_QUEUE_FAILED";HostRejectRetained(env,owned);return promise;}','capture-before-queue');
 ownership=once(ownership,'{"stopAndCloseHostAsync",nullptr,StopAndCloseHostAsync,nullptr,nullptr,nullptr,napi_default,nullptr},','{"captureHostShutdownPeerRoster",nullptr,CaptureHostShutdownPeerRoster,nullptr,nullptr,nullptr,napi_default,nullptr},\n  {"captureHostShutdownExpectation",nullptr,CaptureHostShutdownExpectation,nullptr,nullptr,nullptr,napi_default,nullptr},\n  {"stopAndCloseHostAsync",nullptr,StopAndCloseHostAsync,nullptr,nullptr,nullptr,napi_default,nullptr},','new-exports');
 const binding=JSON.parse(apply(decode,input.binding,[]));if(binding.targets.length!==1||binding.targets[0].target_name!=='siren_terminal_creator_host_async')throw Error('HOST_ROSTER_BINDING_DRIFT');binding.targets[0].target_name='siren_terminal_host_roster_candidate';
 return Object.freeze({ownership:Buffer.from(ownership),peer:Buffer.from(peer),binding:Buffer.from(JSON.stringify(binding,null,2)+'\n')});
}
