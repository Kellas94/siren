// Test-only predicate. Raw native held-handle observations remain authoritative.
const pid=n=>Number.isSafeInteger(n)&&n>0;
const time=n=>Number.isFinite(n)&&n>=0;
const unique=a=>Array.isArray(a)&&a.length>0&&a.every(pid)&&new Set(a).size===a.length;
const row=p=>pid(p?.pid)&&typeof p.image==='string'&&p.image.length>0&&/^[1-9][0-9]*$/.test(p.createdFileTime)&&typeof p.alive==='boolean'&&Number.isInteger(p.exitCode)&&typeof p.inA==='boolean'&&typeof p.inB==='boolean'&&!(p.inA&&p.inB);
const same=(a,b)=>Array.isArray(b)&&a.length===b.length&&unique(b.map(p=>p?.pid))&&a.every(p=>b.some(q=>row(q)&&p.pid===q.pid&&p.image===q.image&&p.createdFileTime===q.createdFileTime&&p.inA===q.inA&&p.inB===q.inB));
function common(r,negative){
 if(!r||r.negative!==negative||r.admitted!==false||r.workerBeforeResume?.A!==!negative||r.workerBeforeResume?.B!==true||!time(r.fixtureAgeMs)||r.fixtureAgeMs>=11000||!time(r.stopMs)||r.stopMs>=3000||r.stopMs>r.fixtureAgeMs)return false;
 const images=[r.fixtureImage,r.electronImage,r.systemConhostImage];if(!images.every(s=>typeof s==='string'&&s.length>0)||new Set(images.map(s=>s.toLowerCase())).size!==3)return false;
 const a=r.fixturePids?.A,b=r.fixturePids?.B,wa=r.workerPids?.A,wb=r.workerPids?.B;
 if(!unique(a)||a.length!==4||!unique(b)||b.length!==4||!unique([wa,wb,...a,...b])||r.rootPids?.A!==a[0]||r.rootPids?.B!==b[0])return false;
 for(const label of ['A','B']){const w=r.workers?.[label],v=w?.runtime;
  if(!w||w.workerPid!==r.workerPids[label]||w.rootPid!==r.rootPids[label]||v?.electron!=='44.5.1'||v.node!=='24.21.0'||v.modules!=='149'||v.napi!=='10'||v.arch!=='x64'||v.platform!=='win32'||w.nodePty!=='1.1.0'||w.osConpty!==true||w.inputWrites!==0||!pid(w.receivedBytes)||!pid(w.retainedBytes)||w.retainedBytes>4194304||w.retainedBytes>w.receivedBytes||!pid(w.rssBytes)||w.helperListObserved!==true||w.helperExitCode!==0||!pid(w.helperPid)||!unique(w.consolePids)||!w.consolePids.includes(w.rootPid))return false;
 }
 const before=r.before,after=r.after,c=r.cleanup;
 if(!Array.isArray(before)||before.length<12||before.length>32||!unique(before.map(p=>p?.pid))||r.hostActiveBefore!==before.length||!before.every(p=>row(p)&&p.alive&&p.exitCode===259&&images.some(i=>i.toLowerCase()===p.image.toLowerCase()))||!same(before,after)||!same(before,c?.held)||c.verified!==true||c.active!==0)return false;
 for(const [n,inA,inB,image] of [[wa,!negative,false,r.electronImage],[wb,false,true,r.electronImage],...a.map(n=>[n,!negative,false,r.fixtureImage]),...b.map(n=>[n,false,true,r.fixtureImage])])if(!before.some(p=>p.pid===n&&p.inA===inA&&p.inB===inB&&p.image.toLowerCase()===image.toLowerCase()))return false;
 const helpers=before.filter(p=>p.image.toLowerCase()===r.systemConhostImage.toLowerCase());if(!helpers.some(p=>negative?!p.inB:p.inA)||!helpers.some(p=>p.inB))return false;
 if(negative?before.some(p=>p.inA):before.some(p=>p.inA===p.inB))return false;
 return after.every(p=>negative?p.alive&&p.exitCode===259:p.inA?!p.alive&&p.exitCode===77:p.alive&&p.exitCode===259)&&c.held.every(p=>!p.alive&&p.exitCode===(!negative&&p.inA?77:98));
}
export function isElectronBrokerObserved(r){
 if(!common(r,false)||r.status!=='ELECTRON_NODE_PTY_BROKER_OBSERVED_NOT_ADMITTED'||r.sessionActiveAfterStop!==0)return false;
 const a=r.before.filter(p=>p.inA).map(p=>p.pid),waits=r.stopWaits;
 return Array.isArray(waits)&&waits.length===a.length&&unique(waits.map(p=>p?.pid))&&waits.every(p=>a.includes(p.pid)&&[0,258].includes(p.initialWait)&&p.finalWait===0&&time(p.elapsedMs)&&p.elapsedMs<=r.stopMs&&p.elapsedMs<3000);
}
export const isExpectedElectronBrokerRefusal=r=>common(r,true)&&r.status==='EXPECTED_ELECTRON_BROKER_ASSIGNMENT_REFUSED'&&r.stopMs>=2000;
