// Separate deterministic source candidate. No compiler, loader or execution.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const hash=b=>createHash('sha256').update(b).digest('hex');
const SOURCE='ff7ce2656234f45b90f8f079e3fb0f482ceb75a58e1d93ceb75a0107bd86dfcc',BINDING='412c6d7e176ab78c1d6152d04f20be39b4ba37fa74f66cf8a905b5c1dd9f610b';
const asyncCleanup=String.raw`// Cleanup only: startup remains synchronous and separately unqualified.
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
 work.release();return promise;
}
`;
function once(s,old,next){assert.equal(s.split(old).length,2,'ASYNC_SOURCE_ANCHOR_DRIFT');return s.replace(old,()=>next);}
export function deriveAsyncCleanupOwnership({source,binding}={}){
 assert.equal(typeof source,'string','ASYNC_SOURCE_DRIFT');assert.equal(typeof binding,'string','ASYNC_SOURCE_DRIFT');assert.equal(hash(source),SOURCE,'ASYNC_SOURCE_DRIFT');assert.equal(hash(binding),BINDING,'ASYNC_SOURCE_DRIFT');
 let s=once(source,' Handle job;Member root;',' std::atomic<bool> asyncPending{false};\n Handle job;Member root;');
 s=once(s,' return static_cast<Session*>(data);',' auto* p=static_cast<Session*>(data);if(p->asyncPending.load()){Refuse(env,"SESSION_ASYNC_PENDING");return nullptr;}return p;');
 s=once(s,'napi_value WatchRoot(',asyncCleanup+'napi_value WatchRoot(');
 s=once(s,'  {"createBootstrappedSession",','  {"stopAndCloseSessionAsync",nullptr,StopAndCloseSessionAsync,nullptr,nullptr,nullptr,napi_default,nullptr},\n  {"createBootstrappedSession",');
 const build=JSON.parse(binding);build.targets[0].target_name='siren_terminal_creator_async';
 return Object.freeze({source:s,binding:build,sha256:hash(s),baseSha256:SOURCE,baseBindingSha256:BINDING,compiled:false,admitted:false});
}
