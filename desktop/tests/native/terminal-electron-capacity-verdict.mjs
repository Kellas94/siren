// Startup/ownership at eight sessions only. No throughput, peak-memory or admission claim.
import {isQualifiedOsConptyObservation} from './terminal-conpty-platform.mjs';
const labels=[...'ABCDEFGH'],pid=n=>Number.isSafeInteger(n)&&n>0,time=n=>Number.isFinite(n)&&n>=0;
const unique=a=>Array.isArray(a)&&a.length>0&&a.every(pid)&&new Set(a).size===a.length;
const row=p=>pid(p?.pid)&&typeof p.image==='string'&&p.image.length>0&&/^[1-9][0-9]*$/.test(p.createdFileTime)&&typeof p.alive==='boolean'&&Number.isInteger(p.exitCode)&&(p.session===null||labels.includes(p.session))&&p.inA===(p.session==='A')&&p.inB===(p.session==='B');
const same=(a,b)=>Array.isArray(b)&&a.length===b.length&&unique(b.map(p=>p?.pid))&&a.every(p=>b.some(q=>row(q)&&p.pid===q.pid&&p.image===q.image&&p.createdFileTime===q.createdFileTime&&p.session===q.session));
function common(r,negative){
 if(!r||r.negative!==negative||r.admitted!==false||typeof r.os!=='string'||!/^\d+\.\d+\.\d+$/.test(r.os)||!time(r.fixtureAgeMs)||r.fixtureAgeMs>=11000||!time(r.stopMs)||r.stopMs>=3000||r.stopMs>r.fixtureAgeMs)return false;
 const images=[r.fixtureImage,r.electronImage,r.systemConhostImage];if(!images.every(s=>typeof s==='string'&&s.length>0)||new Set(images.map(s=>s.toLowerCase())).size!==3)return false;
 const groups=r.groups,before=r.before,c=r.cleanup;
 if(!Array.isArray(groups)||groups.length!==8||new Set(groups.map(g=>g?.label)).size!==8||!groups.every(g=>labels.includes(g.label)))return false;
 if(!Array.isArray(before)||before.length<48||before.length>128||!unique(before.map(p=>p?.pid))||r.hostActiveBefore!==before.length||!before.every(p=>row(p)&&p.alive&&p.exitCode===259&&images.some(i=>i.toLowerCase()===p.image.toLowerCase()))||!same(before,r.after)||!same(before,c?.held)||c.verified!==true||c.active!==0)return false;
 const fixed=[];let rss=0;
 for(const g of groups){const expected=negative&&g.label==='A'?null:g.label,w=g.workerReady,v=w?.runtime;
  if(!pid(g.workerPid)||!unique(g.fixturePids)||g.fixturePids.length!==4||g.rootPid!==g.fixturePids[0]||g.workerBeforeResume!==(expected!==null))return false;
  fixed.push(g.workerPid,...g.fixturePids);
  if(!before.some(p=>p.pid===g.workerPid&&p.session===expected&&p.image.toLowerCase()===r.electronImage.toLowerCase())||!g.fixturePids.every(n=>before.some(p=>p.pid===n&&p.session===expected&&p.image.toLowerCase()===r.fixtureImage.toLowerCase())))return false;
  if(!before.some(p=>p.session===expected&&p.image.toLowerCase()===r.systemConhostImage.toLowerCase()))return false;
  if(w?.workerPid!==g.workerPid||w.rootPid!==g.rootPid||v?.electron!=='44.5.1'||v.node!=='24.21.0'||v.modules!=='149'||v.napi!=='10'||v.arch!=='x64'||v.platform!=='win32'||w.nodePty!=='1.1.0'||!isQualifiedOsConptyObservation(w)||w.windowsRelease!==r.os||w.inputWrites!==0||!pid(w.receivedBytes)||!pid(w.retainedBytes)||w.retainedBytes>4194304||w.retainedBytes>w.receivedBytes||!pid(w.rssBytes)||w.helperListObserved!==true||w.helperExitCode!==0||!pid(w.helperPid)||!unique(w.consolePids)||!w.consolePids.includes(w.rootPid))return false;
  rss+=w.rssBytes;
 }
 if(!unique(fixed)||!Number.isSafeInteger(rss)||r.workersRssTotalBytes!==rss)return false;
 if(negative?before.some(p=>p.session==='A'):before.some(p=>p.session===null))return false;
 return r.after.every(p=>negative?p.alive&&p.exitCode===259:p.session==='A'?!p.alive&&p.exitCode===77:p.alive&&p.exitCode===259)&&c.held.every(p=>!p.alive&&p.exitCode===(!negative&&p.session==='A'?77:98));
}
export function isElectronCapacityObserved(r){
 if(!common(r,false)||r.status!=='EIGHT_ELECTRON_CREATORS_OBSERVED_NOT_ADMITTED'||r.sessionActiveAfterStop!==0)return false;
 const a=r.before.filter(p=>p.session==='A').map(p=>p.pid),waits=r.stopWaits;
 return Array.isArray(waits)&&waits.length===a.length&&unique(waits.map(p=>p?.pid))&&waits.every(p=>a.includes(p.pid)&&[0,258].includes(p.initialWait)&&p.finalWait===0&&time(p.elapsedMs)&&p.elapsedMs<=r.stopMs&&p.elapsedMs<3000);
}
export const isExpectedElectronCapacityRefusal=r=>common(r,true)&&r.status==='EXPECTED_EIGHT_SESSION_ASSIGNMENT_REFUSED'&&r.stopMs>=2000;
