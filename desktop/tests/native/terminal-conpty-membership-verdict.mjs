// Pure validation of a fixed Win32-only observation, never Terminal admission.
const unique=a=>Array.isArray(a)&&a.length>0&&new Set(a).size===a.length;
const row=p=>Number.isInteger(p?.pid)&&p.pid>0&&typeof p.image==='string'&&p.image.length>0&&/^[1-9][0-9]+$/.test(p.createdFileTime)&&typeof p.alive==='boolean'&&Number.isInteger(p.exitCode)&&typeof p.inA==='boolean'&&typeof p.inB==='boolean'&&!(p.inA&&p.inB);
const identity=(a,b)=>row(a)&&row(b)&&a.pid===b.pid&&a.image===b.image&&a.createdFileTime===b.createdFileTime&&a.inA===b.inA&&a.inB===b.inB;
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&unique(a.map(p=>p.pid))&&unique(b.map(p=>p.pid))&&a.every(p=>b.some(q=>identity(p,q)));
function common(r,negative){
 if(!r||r.negative!==negative||r.pseudoConsoles!==2||r.rootBeforeResume?.A!==!negative||r.rootBeforeResume?.B!==true||!(r.fixtureAgeMs>=0&&r.fixtureAgeMs<6000)||!(r.stopMs>=0&&r.stopMs<3000)||!Array.isArray(r.before)||r.before.length<11||r.before.length>32||r.hostActiveBefore!==r.before.length||!r.before.every(p=>row(p)&&p.alive)||!same(r.before,r.after)||!same(r.before,r.cleanup?.held)||r.cleanup.verified!==true||r.cleanup.active!==0)return false;
 const a=r.fixturePids?.A,b=r.fixturePids?.B;
 if(!unique(a)||a.length!==4||!unique(b)||b.length!==4||a.some(pid=>b.includes(pid))||r.rootPids?.A!==a[0]||r.rootPids?.B!==b[0]||a.includes(r.workerPid)||b.includes(r.workerPid))return false;
 if(!r.before.some(p=>p.pid===r.workerPid&&!p.inA&&!p.inB)||!a.every(pid=>r.before.some(p=>p.pid===pid&&p.inA===!negative&&!p.inB))||!b.every(pid=>r.before.some(p=>p.pid===pid&&!p.inA&&p.inB))||negative&&r.before.some(p=>p.inA))return false;
 if(!r.after.filter(p=>p.inB).every(p=>p.alive))return false;
 if(!r.cleanup.held.every(p=>!p.alive&&p.exitCode===(r.after.find(q=>q.pid===p.pid).alive?98:r.after.find(q=>q.pid===p.pid).exitCode)))return false;
 return true;
}
export function isConptyMembershipObserved(r){return common(r,false)&&r.status==='CONPTY_MEMBERSHIP_OBSERVED_TERMINAL_NOT_ADMITTED'&&r.after.filter(p=>p.inA).every(p=>!p.alive&&p.exitCode===77);}
export function isExpectedConptyMembershipRefusal(r){return common(r,true)&&r.status==='EXPECTED_SESSION_ASSIGNMENT_REFUSED'&&r.stopMs>=2000&&r.fixturePids.A.every(pid=>r.after.some(p=>p.pid===pid&&p.alive));}
