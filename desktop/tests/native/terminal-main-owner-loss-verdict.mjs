// External held-handle observer evidence only; no process execution/admission.
const member=p=>Number.isInteger(p?.pid)&&p.pid>0&&typeof p.image==='string'&&p.image.length>0&&/^[1-9][0-9]+$/.test(p.createdFileTime)&&typeof p.alive==='boolean'&&Number.isInteger(p.exitCode);
const identity=(a,b)=>member(a)&&member(b)&&a.pid===b.pid&&a.image===b.image&&a.createdFileTime===b.createdFileTime;
const unique=a=>Array.isArray(a)&&a.length>0&&new Set(a).size===a.length;
const equalSet=(a,b)=>unique(a)&&unique(b)&&a.length===b.length&&a.every(x=>b.includes(x));
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&equalSet(a.map(p=>p.pid),b.map(p=>p.pid))&&a.every(p=>b.some(q=>identity(p,q)));
function common(r,negative){
 if(!r||r.guardEnabled!==!negative||r.outerExitObserved!==true||r.mainExitObserved!==true||r.mainTerminationCode!==101||r.safetyJobStillOpenAtObservation!==true||!(r.fixtureAgeMs>=0&&r.fixtureAgeMs<6000)||!(r.observeMs>=0&&r.observeMs<3000)||!member(r.main)||!r.main.alive||!identity(r.main,r.mainExit)||r.mainExit.alive||r.mainExit.exitCode!==101||!same(r.held,r.before)||!same(r.held,r.after)||!r.before.every(p=>p.alive)||!r.after.some(p=>identity(p,r.mainExit)&&!p.alive&&p.exitCode===101)||!Array.isArray(r.groups)||r.groups.length!==2)return false;
 const required=[],canaries=[];
 for(const g of r.groups){
  const fixture=['root','branch','grandchild','detached'].map(k=>g?.fixturePids?.[k]),keys=[g?.hostPid,...fixture];
  if(!unique(keys)||keys.length!==5||!unique(g.requiredPids)||!keys.every(pid=>g.requiredPids.includes(pid))||!g.requiredPids.every(pid=>r.held.some(p=>p.pid===pid))||g.requiredPids.includes(r.main.pid))return false;
  required.push(...g.requiredPids);canaries.push(...fixture.slice(1));
 }
 if(!equalSet(required,r.requiredPids)||!equalSet(canaries,r.canaryPids)||canaries.length!==6)return false;
 const c=r.cleanup;
 return c?.verified===true&&c.active===0&&same(r.held,c.held)&&c.held.every(p=>!p.alive&&p.exitCode===(r.after.find(q=>q.pid===p.pid).alive?98:r.after.find(q=>q.pid===p.pid).exitCode));
}
export function isMainOwnerLossComplete(r,negative=false){return negative===false&&common(r,false)&&r.status==='MAIN_OWNER_LOSS_PASSED'&&r.outerExitCode===0&&r.requiredPids.every(pid=>r.after.some(p=>p.pid===pid&&!p.alive));}
export function isExpectedMainOwnerLossRefusal(r,negative=true){return negative===true&&common(r,true)&&r.status==='EXPECTED_OWNED_FAMILY_SURVIVED'&&r.outerExitCode===1&&r.observeMs>=2000&&r.canaryPids.every(pid=>r.after.some(p=>p.pid===pid&&p.alive));}
