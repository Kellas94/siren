// Pure DATA gate only. Actual executable provenance requires retained artifacts.
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),pin=v=>!!v&&Number.isSafeInteger(v.bytes)&&v.bytes>0&&sha(v.sha256);
export function electronRosterAbiPassed(r){
 try{
  if(r.scope!=='ELECTRON_ROSTER_ABI_ONLY'||r.nativeExecutionAdmitted!==false||r.exitObserved!==true||r.exitCode!==0||r.outerDeadlineExceeded!==false)return false;
  const b=r.build,n=r.native;
  if(b.status!=='COMPILED_ELECTRON_TARGET_NOT_RUNTIME_QUALIFIED'||b.target!=='44.5.1'||b.arch!=='x64'||b.napi!==10||b.delayLoadHook!==true||!pin(b.hook)||!pin(b.binary)||!pin(r.executable))return false;
  if(b.sourceSha256!=='d7014c6401e4e1186f3180a7377594cd044b16a84006a0ef38d6b6903c366fdd'||b.includeSha256!=='aa4ccd3428a1c547a5e8dccc1116ebab45a3be6972c1229903db36c5081be476'||r.addonReadbackSha256!==b.binary.sha256||r.runtimeReadbackSha256!==r.executable.sha256)return false;
  if(n.status!=='ABI_PAIR_PASSED'||n.hostExitObserved!==true||n.hostExitCode!==0||n.deadlineExceeded!==false)return false;
  for(const role of ['main','utility']){
   const c=n[role],v=c.runtime;
   if(c.status!=='ABI_CONTEXT_PASSED'||c.role!==role||!Number.isInteger(c.pid)||c.pid<=0||c.pid>0xffffffff||c.addonSha256!==b.binary.sha256||c.executableSha256!==r.executable.sha256||c.exportsChecked!==30||c.markSamples!==2048||c.markMonotonic!==true||c.forgedRefusals!==9||c.getterCalls!==0)return false;
   if(v.electron!=='44.5.1'||v.modules!=='149'||v.napi!=='10'||v.arch!=='x64'||v.platform!=='win32'||v.electronRunAsNode!==false)return false;
  }
  return n.main.pid!==n.utility.pid;
 }catch{return false;}
}
