// Pure readback only; never synthesizes native success or executes a process.
import {isQualifiedOsConptyObservation} from './terminal-conpty-platform.mjs';
const int=n=>Number.isSafeInteger(n)&&n>=0;
const identity=p=>p&&int(p.pid)&&p.pid>0&&typeof p.image==='string'&&p.image.length>0&&/^[1-9][0-9]{0,19}$/.test(p.createdFileTime)&&typeof p.alive==='boolean'&&int(p.exitCode)&&p.exitCode<=0xffffffff&&(p.alive?p.exitCode===259:true);
const same=(a,b)=>identity(a)&&identity(b)&&a.pid===b.pid&&a.image===b.image&&a.createdFileTime===b.createdFileTime;
const observed=(s,p)=>identity(p)&&s.held.some(q=>same(p,q)&&p.alive===q.alive&&p.exitCode===q.exitCode);
const runtime=r=>r?.electron==='44.5.1'&&r.node==='24.21.0'&&r.modules==='149'&&r.napi==='10'&&r.arch==='x64'&&r.platform==='win32';
const guards=s=>s?.killOnClose===true&&s.breakaway===false&&s.inheritable===false;
const rows=s=>Array.isArray(s?.held)&&s.held.length>=5&&s.held.length<=128&&s.held.every(identity)&&new Set(s.held.map(p=>p.pid)).size===s.held.length;
const sessionRows=s=>rows(s)&&s.held.length<=32&&observed(s,s.root)&&observed(s,s.shell);
// A held process that has already exited cannot acquire a different exit cause later.
const terminalAgreement=(final,prior)=>final.held.every(p=>{
 const before=prior.held.find(q=>same(p,q));
 return before&&(before.alive||(!p.alive&&p.exitCode===before.exitCode));
});
const causal=(s,g,code,shellCode=code)=>{
 if(!sessionRows(s)||s.active!==0||s.held.some(p=>p.alive)||!guards(s)||s.atomicBeforeResume!==true||s.hostPid!==g.before.hostPid||s.held.length!==g.before.held.length)return false;
 if(!s.held.every(p=>g.before.held.some(q=>same(p,q)))||!same(s.root,g.before.root)||!same(s.shell,g.before.shell))return false;
 const required=[g.ready.workerPid,...Object.values(g.fixturePids)];
 return s.held.every(p=>required.includes(p.pid)?p.exitCode===(p.pid===g.ready.rootPid?shellCode:code):[code,0].includes(p.exitCode));
};
export function isEightCompositionObserved(r){
 try{
  if(r?.admitted!==false||['error','cleanupError','hostCleanupError'].some(key=>Object.hasOwn(r,key))||r.status!=='EIGHT_SESSION_COMPOSITION_OBSERVED_NOT_ADMITTED'||typeof r.negative!=='boolean'||!runtime(r.runtime)||!Array.isArray(r.groups)||r.groups.length!==8)return false;
  const [a,b,c,d]=r.groups,all=new Set();
  for(const [i,g] of r.groups.entries()){
   const s=g.before,w=g.ready,f=g.fixturePids;
   if(g.label!=='ABCDEFGH'[i]||!guards(s)||!sessionRows(s)||s.atomicBeforeResume!==true||s.active!==s.held.length||s.held.some(p=>!p.alive)||!runtime(w?.runtime)||!isQualifiedOsConptyObservation(w)||w.nodePty!=='1.1.0'||w.inputWrites!==0||w.helperListObserved!==true||w.helperExitCode!==0||!int(w.receivedBytes)||w.receivedBytes===0||!int(w.retainedBytes)||w.retainedBytes>w.receivedBytes||w.retainedBytes>4194304||!int(w.rssBytes)||w.rssBytes<=0)return false;
   if(!f||Object.keys(f).sort().join(',')!=='branch,detached,grandchild,root'||f.root!==w.rootPid||w.workerPid!==s.root.pid||w.rootPid!==s.shell.pid||!int(s.hostPid)||s.hostPid===0)return false;
   const required=[w.workerPid,...Object.values(f)];if(new Set(required).size!==5)return false;
   for(const pid of required)if(!s.held.some(p=>p.pid===pid))return false;
   if(!s.held.some(p=>same(p,s.root))||!s.held.some(p=>same(p,s.shell)))return false;
   for(const p of s.held){if(all.has(p.pid))return false;all.add(p.pid);}
  }
  if(r.groups.some(g=>g.before.hostPid!==a.before.hostPid))return false;
  if(!int(r.stopMs)||r.stopMs>=3000||!int(r.fixtureAgeMs)||r.fixtureAgeMs>=11000||!int(r.blockedRootMs)||r.blockedRootMs<2000||r.blockedRootMs>=3000||!int(r.rootWaitMs)||r.rootWaitMs<2000||r.rootWaitMs>=3000||!int(r.blockedHostMs)||r.blockedHostMs<2000||r.blockedHostMs>=3000)return false;
  if(!causal(r.stoppedA,a,77)||!Array.isArray(r.otherAlive)||r.otherAlive.length!==7)return false;
  for(const [i,other] of r.otherAlive.entries()){
   const prior=r.groups[i+1].before;
   if(!sessionRows(other)||!guards(other)||other.atomicBeforeResume!==true||other.hostPid!==prior.hostPid||other.active!==other.held.length||other.active!==prior.active||other.held.length!==prior.held.length||!same(other.root,prior.root)||!same(other.shell,prior.shell)||!other.held.every(p=>p.alive&&observed(prior,p)))return false;
  }
  const cap=r.capacity;
  if(cap?.code!=='SESSION_CAPACITY_REFUSED'||cap.attemptedLabel!=='I'||cap.creatorEntered!==false)return false;
  for(const snapshot of [cap.hostBefore,cap.hostAfter]){
   const expected=[snapshot?.root,...r.groups.flatMap(g=>g.before.held)];
   if(!rows(snapshot)||!guards(snapshot)||!observed(snapshot,snapshot.root)||snapshot.root.pid!==a.before.hostPid||snapshot.active!==expected.length||snapshot.held.length!==expected.length||!snapshot.held.every(p=>p.alive&&expected.some(q=>same(p,q)&&p.alive===q.alive&&p.exitCode===q.exitCode)))return false;
  }
  if(!same(cap.hostBefore.root,cap.hostAfter.root)||!cap.hostBefore.held.every(p=>observed(cap.hostAfter,p)))return false;
  const rb=r.rootB;
  if(r.negative){
   if(!sessionRows(rb)||!guards(rb)||rb.atomicBeforeResume!==true||rb.hostPid!==b.before.hostPid||rb.held.length!==b.before.held.length||!rb.held.every(p=>b.before.held.some(q=>same(p,q)))||!same(rb.shell,b.before.shell)||rb.shell.alive||rb.shell.exitCode!==51||rb.shellMonitorTerminated!==false||rb.shellMonitorFired!==false||!same(rb.root,b.before.root)||!rb.root.alive)return false;
   for(const pid of [b.ready.workerPid,b.fixturePids.branch,b.fixturePids.grandchild,b.fixturePids.detached])if(!rb.held.some(p=>p.pid===pid&&p.alive))return false;
   if(rb.active!==rb.held.filter(p=>p.alive).length)return false;
  }else if(!causal(rb,b,80,51)||rb.shellMonitorFired!==true||rb.shellMonitorTerminated!==true)return false;
  const h=r.hostLoss;
  if(!rows(h)||!observed(h,h.root)||!guards(h)||h.active!==0||h.held.some(p=>p.alive)||!same(cap.hostAfter.root,h.root)||h.root?.pid!==a.before.hostPid||h.root.alive||h.root.exitCode!==0||h.monitorFired!==true||h.monitorTerminateSucceeded!==true)return false;
  const expected=[h.root,...r.groups.slice(2).flatMap(g=>g.before.held)];
  if(h.held.length!==expected.length||!h.held.every(p=>expected.some(q=>same(p,q))))return false;
  for(const g of r.groups.slice(2))for(const pid of [g.ready.workerPid,...Object.values(g.fixturePids)])if(!h.held.some(p=>p.pid===pid&&p.exitCode===79))return false;
  if(!Array.isArray(r.cleanup)||r.cleanup.length!==8||r.hostClosed!==true)return false;
  for(const [i,entry] of r.cleanup.entries())if(entry.label!=='ABCDEFGH'[i]||entry.closed!==true||!causal(entry.snapshot,r.groups[i],(i===0?77:i===1?(r.negative?98:80):79),i===1?51:i===0?77:79)||!terminalAgreement(entry.snapshot,(i===0?r.stoppedA:i===1?r.rootB:h)))return false;
  return true;
 }catch{return false;}
}
