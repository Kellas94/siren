// Pure controlled-fixture DATA checks. No kernel authority or product admission.
export const localNativeModes=Object.freeze(['zero','eight','listeners','accepts','captured','gc','session-async','host-loss','negative-no-stop','negative-js-hang']);
export function localNativeCasePassed(value){
 try{
  const {mode,exit,result:r}=value;
  if(!localNativeModes.includes(mode)||!r||r.scope!=='LOCAL_WINDOWS_NODE_ROSTER_QUALIFICATION'||r.nativeExecutionAdmitted!==false||r.cleanupVerified!==true)return false;
  const before=r.nativeBefore;
  if(!before||before.mode!==mode||before.sessionCount!==(mode==='zero'?0:8)||before.peerCount!==(['listeners','accepts','captured','gc','session-async'].includes(mode)?8:0)||!Array.isArray(r.before)||r.before.length===0)return false;
  if(mode.startsWith('negative-')){
   if(exit!==1||r.status!=='FAILED'||!Number.isInteger(r.cleanupEntryActive)||r.cleanupEntryActive<=0)return false;
   if(mode==='negative-js-hang')return r.error==='EXTERNAL_WATCHDOG_DEADLINE:after.json'&&r.nativeAfter===undefined&&r.watchdogWorkerAlive===true&&Number.isInteger(r.watchdogElapsedMs)&&r.watchdogElapsedMs>=20000&&r.watchdogElapsedMs<25000&&r.watchdogProtocol==='after.json';
   return r.error==='NATIVE_LEFT_LIVE_DESCENDANT'&&r.nativeAfter?.status==='DELIBERATELY_FALSE_SUCCESS_NEGATIVE_CONTROL'&&Array.isArray(r.afterBeforeSafetyCleanup)&&r.afterBeforeSafetyCleanup.some(p=>p.alive===true);
  }
  return exit===0&&r.status==='LOCAL_NATIVE_CASE_PASSED'&&r.nativeGroupDeadBeforeSafetyCleanup===true&&r.canaryAliveBeforeSafetyCleanup===true&&r.finalActiveBeforeSafetyCleanup===0&&r.nativeAfter?.status==='NATIVE_OPERATION_COMPLETED'&&r.nativeAfter.mode===mode&&r.nativeAfter.checked?.ok===true&&r.nativeAfter.nativeExecutionAdmitted===false;
 }catch{return false;}
}
export function localNativeBatchPassed(value){
 try{return value.scope==='LOCAL_WINDOWS_NODE_ROSTER_QUALIFICATION'&&value.status==='BOUNDED_LOCAL_NATIVE_CASES_PASSED'&&value.nativeExecutionAdmitted===false&&Array.isArray(value.cases)&&value.cases.length===10&&value.cases.every((c,i)=>c.mode===localNativeModes[i]&&c.passed===true&&c.negative===c.mode.startsWith('negative-')&&c.exit===(c.negative?1:0));}catch{return false;}
}
