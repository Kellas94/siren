// Fixed-fixture Safety-universe observation only. No product admission.
const pid=n=>Number.isSafeInteger(n)&&n>0;
const time=n=>Number.isFinite(n)&&n>=0;
const unique=a=>Array.isArray(a)&&a.length>0&&a.every(pid)&&new Set(a).size===a.length;
const row=p=>pid(p?.pid)&&typeof p.image==='string'&&p.image.length>0&&/^[1-9][0-9]*$/.test(p.createdFileTime)&&typeof p.alive==='boolean'&&Number.isInteger(p.exitCode)&&typeof p.inA==='boolean'&&typeof p.inB==='boolean'&&!(p.inA&&p.inB);
const identity=(a,b)=>row(a)&&row(b)&&a.pid===b.pid&&a.image===b.image&&a.createdFileTime===b.createdFileTime&&a.inA===b.inA&&a.inB===b.inB;
const same=(a,b)=>Array.isArray(b)&&a.length===b.length&&unique(b.map(p=>p?.pid))&&a.every(p=>b.some(q=>identity(p,q)));
function common(r,negative){
 if(!r||r.negative!==negative||r.pseudoConsoles!==2||typeof r.fixtureImage!=='string'||typeof r.systemConhostImage!=='string'||r.fixtureImage===r.systemConhostImage||r.workerBeforeResume?.A!==!negative||r.workerBeforeResume?.B!==true||r.rootBeforeResume?.A!==!negative||r.rootBeforeResume?.B!==true||!time(r.fixtureAgeMs)||r.fixtureAgeMs>=6000||!time(r.stopMs)||r.stopMs>=3000||r.stopMs>r.fixtureAgeMs)return false;
 const before=r.before,after=r.after,cleanup=r.cleanup;
 if(!Array.isArray(before)||before.length<12||before.length>20||r.hostActiveBefore!==before.length||!unique(before.map(p=>p?.pid))||!before.every(p=>row(p)&&p.alive&&p.exitCode===259)||!same(before,after)||!same(before,cleanup?.held)||cleanup.verified!==true||cleanup.active!==0)return false;
 const a=r.fixturePids?.A,b=r.fixturePids?.B,wa=r.workerPids?.A,wb=r.workerPids?.B;
 if(!unique(a)||a.length!==4||!unique(b)||b.length!==4||!unique([wa,wb,...a,...b])||r.rootPids?.A!==a[0]||r.rootPids?.B!==b[0])return false;
 const fixed=[wa,wb,...a,...b],setA=[wa,...a],setB=[wb,...b];
 if(!fixed.every(n=>before.some(p=>p.pid===n&&p.image.toLowerCase()===r.fixtureImage.toLowerCase()))||!setA.every(n=>before.some(p=>p.pid===n&&p.inA===!negative&&!p.inB))||!setB.every(n=>before.some(p=>p.pid===n&&!p.inA&&p.inB)))return false;
 const helpers=before.filter(p=>!fixed.includes(p.pid));
 if(!helpers.every(p=>p.image.toLowerCase()===r.systemConhostImage.toLowerCase())||!helpers.some(p=>p.inB)||!helpers.some(p=>negative?!p.inB:p.inA))return false;
 if(negative?before.some(p=>p.inA):before.some(p=>p.inA===p.inB))return false;
 if(!after.every(p=>negative?p.alive&&p.exitCode===259:p.inA?!p.alive&&p.exitCode===77:p.alive&&p.exitCode===259))return false;
 if(!cleanup.held.every(p=>!p.alive&&p.exitCode===(!negative&&p.inA?77:98)))return false;
 return true;
}
export function isConptyBrokerObserved(r){
 if(!common(r,false)||r.status!=='CONPTY_BROKER_CONTAINMENT_OBSERVED_TERMINAL_NOT_ADMITTED'||r.sessionActiveAfterStop!==0)return false;
 const a=r.before.filter(p=>p.inA).map(p=>p.pid),waits=r.stopWaits;
 return Array.isArray(waits)&&waits.length===a.length&&unique(waits.map(p=>p?.pid))&&waits.every(p=>a.includes(p.pid)&&[0,258].includes(p.initialWait)&&p.finalWait===0&&time(p.elapsedMs)&&p.elapsedMs<=r.stopMs&&p.elapsedMs<3000);
}
export function isExpectedConptyBrokerRefusal(r){return common(r,true)&&r.status==='EXPECTED_BROKER_SESSION_ASSIGNMENT_REFUSED'&&r.stopMs>=2000;}
