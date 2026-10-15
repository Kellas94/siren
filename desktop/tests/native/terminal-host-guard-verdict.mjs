// Verdicts consume actual captured process handles/accounting; no PID-tree kill.
const runtime=r=>r?.versions?.electron==='44.5.1'&&r.versions.node==='24.21.0'&&r.versions.modules==='149'&&r.versions.napi==='10'&&r.arch==='x64';
const member=p=>Number.isInteger(p?.pid)&&p.pid>0&&typeof p.image==='string'&&p.image.length>0&&/^[1-9][0-9]+$/.test(p.createdFileTime)&&typeof p.alive==='boolean'&&Number.isInteger(p.exitCode);
const flags=s=>s?.killOnClose===true&&s.breakaway===false&&s.inheritable===false;
const identity=(a,b)=>member(a)&&member(b)&&a.pid===b.pid&&a.image===b.image&&a.createdFileTime===b.createdFileTime;
function same(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a.map(p=>p.pid)).size===a.length&&new Set(b.map(p=>p.pid)).size===b.length&&a.every(p=>b.some(q=>identity(p,q)));}
const rootConsistent=s=>member(s?.root)&&Array.isArray(s.held)&&s.held.some(p=>identity(s.root,p)&&s.root.alive===p.alive&&s.root.exitCode===p.exitCode);
const survivorPids=c=>['branch','grandchild','detached'].map(k=>c.fixturePids[k]);
function captured(c){const s=c?.captured,pids=Object.values(c?.fixturePids??{});return flags(s)&&rootConsistent(s)&&s.root.alive&&s.held.length>=5&&s.held.length<=9&&s.active===s.held.length&&s.held.every(p=>member(p)&&p.alive)&&new Set(s.held.map(p=>p.pid)).size===s.held.length&&pids.length===4&&new Set([s.root.pid,...pids]).size===5&&[s.root.pid,...pids].every(pid=>s.held.some(p=>p.pid===pid));}
const matches=(s,c)=>flags(s)&&rootConsistent(s)&&identity(s.root,c.captured.root)&&same(s.held,c.captured.held);
const exited=(s,c)=>matches(s,c)&&!s.root.alive&&s.active===0&&s.held.every(p=>!p.alive);
function common(r,e){
 const n=r?.native;
 return r?.exitObserved===true&&!r.outerDeadlineExceeded&&r.addonUnchanged===true&&r.addonSha256===e.addonSha256&&r.addonReadbackSha256===e.addonSha256&&r.runnerSha256===e.runnerSha256&&r.executableSha256===e.executableSha256&&runtime(n?.runtime)&&Array.isArray(n.cases)&&n.cases.length===2&&n.cases.every(captured)&&n.blockedMs>=2000&&n.blockedMs<6000&&Array.isArray(n.cleanup)&&n.cleanup.length===2&&n.cleanup.every((c,i)=>c.verified===true&&exited(c.snapshot,n.cases[i]))&&exited(n.stop,n.cases[0])&&n.stop.held.every(p=>p.exitCode===77)&&matches(n.otherHostStillAlive,n.cases[1])&&n.otherHostStillAlive.active===n.otherHostStillAlive.held.length&&n.otherHostStillAlive.held.every(p=>p.alive)&&matches(n.afterBlockedHostExit,n.cases[1])&&!n.afterBlockedHostExit.root.alive&&n.afterBlockedHostExit.root.exitCode===0;
}
function positive(r,e){
 const n=r?.native,s=n?.afterBlockedHostExit;
 return common(r,e)&&r.status==='HOST_GUARD_PASSED'&&r.exitCode===0&&n.status==='HOST_GUARD_PASSED'&&exited(s,n.cases[1])&&s.monitorFired===true&&s.monitorTerminateSucceeded===true&&survivorPids(n.cases[1]).every(pid=>s.held.some(p=>p.pid===pid&&p.exitCode===79))&&s.held.filter(p=>p.pid!==s.root.pid).every(p=>p.exitCode===0||p.exitCode===79);
}
function refused(r,e,monitorFired){
 const n=r?.native,s=n?.afterBlockedHostExit;
 return common(r,e)&&r.status==='FAILED'&&r.exitCode===1&&n.status==='FAILED'&&n.error?.code==='ERR_ASSERTION'&&/^HOST_DEATH_LEFT_OWNED_DESCENDANTS\b/.test(n.error?.message??'')&&s.active>0&&s.monitorFired===monitorFired&&s.monitorTerminateSucceeded===false&&survivorPids(n.cases[1]).every(pid=>s.held.some(p=>p.pid===pid&&p.alive))&&s.held.every(p=>{
  const cleaned=n.cleanup[1].snapshot.held.find(q=>q.pid===p.pid);
  // Anything observed live must have died from this explicit cleanup98;
  // an earlier exit must retain its exact observed code.
  return cleaned.exitCode===(p.alive?98:p.exitCode);
 });
}
function failedStop(r,stopping){
 const n=r?.native,f=n?.failedStop,s=f?.snapshot;
 return r?.stopFailureControl===true&&f?.code==='OWNERSHIP_STOP_FAILED'&&matches(s,n.cases[1])&&s.active===s.held.length&&s.held.every(p=>p.alive)&&s.stopping===stopping&&s.injectedStopFailures===1&&s.monitorFired===false;
}
export const isHostGuardComplete=(r,e)=>r?.stopFailureControl!==true&&positive(r,e);
export const isExpectedHostMonitorRefusal=(r,e)=>r?.stopFailureControl!==true&&refused(r,e,false);
export const isFailedStopGuardComplete=(r,e)=>positive(r,e)&&failedStop(r,false);
export const isExpectedFailedStopMonitorRefusal=(r,e)=>refused(r,e,true)&&failedStop(r,true);
