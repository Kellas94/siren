// Strict, inert readback of a separate externally observed composed main loss.
import {isQualifiedOsConptyObservation} from './terminal-conpty-platform.mjs';
const uint=n=>Number.isSafeInteger(n)&&n>=0&&n<=0xffffffff;
const processRow=p=>p&&uint(p.pid)&&p.pid>0&&typeof p.image==='string'&&p.image.length>0&&/^[1-9][0-9]{0,19}$/.test(p.createdFileTime)&&typeof p.alive==='boolean'&&uint(p.exitCode)&&(!p.alive||p.exitCode===259);
const same=(a,b)=>processRow(a)&&processRow(b)&&a.pid===b.pid&&a.image===b.image&&a.createdFileTime===b.createdFileTime;
const rows=a=>Array.isArray(a)&&a.length>0&&a.length<=64&&a.every(processRow)&&new Set(a.map(p=>p.pid)).size===a.length;
const sameSet=(a,b)=>rows(a)&&rows(b)&&a.length===b.length&&a.every(p=>b.some(q=>same(p,q)));
const observed=(p,held)=>held.some(q=>same(p,q)&&p.alive===q.alive&&p.exitCode===q.exitCode);
const guards=(s,negative)=>s?.killOnClose===!negative&&s.breakaway===false&&s.inheritable===false;
const runtime=r=>r?.electron==='44.5.1'&&r.node==='24.21.0'&&r.modules==='149'&&r.napi==='10'&&r.arch==='x64'&&r.platform==='win32';
export function isComposedMainLossObserved(r,negative=false){
 try {
  if(typeof negative!=='boolean'||r?.admitted!==false||r.status!=='COMPOSED_MAIN_LOSS_OBSERVED_NOT_ADMITTED'||r.guardEnabled!==!negative||['error','cleanupError'].some(k=>Object.hasOwn(r,k)))return false;
  if(r.atomicSafety!==true||r.safetyKillOnClose!==true||r.safetyInheritable!==false||r.safetyOpenAtObservation!==true||r.mainTerminationCode!==101)return false;
  if(!processRow(r.main)||!r.main.alive||!same(r.main,r.mainExit)||r.mainExit.alive||r.mainExit.exitCode!==101||!uint(r.observeMs)||r.observeMs>=3000||(negative&&r.observeMs<2000))return false;
  const abort=r.abortCheck;
  if(abort?.checkedAfterMainExit!==true||abort.present!==false||abort.pending!==false||abort.firstGoPresent!==false||!uint(r.mainAgeMs)||r.mainAgeMs>=11000)return false;
  if(!rows(r.before)||!r.before.every(p=>p.alive)||!observed(r.main,r.before)||!sameSet(r.before,r.after)||!observed(r.mainExit,r.after))return false;
  if(!uint(r.activeBeforeSafetyCleanup)||r.activeBeforeSafetyCleanup!==r.after.filter(p=>p.alive).length||(!negative&&r.activeBeforeSafetyCleanup!==0))return false;
  const ready=r.ready,h=ready?.hostSnapshot;
  if(ready?.negative!==negative||ready.mainPid!==r.main.pid||!runtime(ready.runtime)||!uint(ready.fixtureAgeMs)||ready.fixtureAgeMs>=6000||ready.fixtureAgeMs+r.observeMs>r.mainAgeMs)return false;
  if(!Array.isArray(ready.groups)||ready.groups.length!==2||!guards(h,negative)||!rows(h.held)||h.active!==h.held.length||!h.held.every(p=>p.alive)||!observed(h.root,h.held)||h.root.pid===r.main.pid||h.root.image!==r.main.image||!sameSet(ready.held,h.held))return false;
  const expected=[h.root],canaries=[];
  for(const [i,g] of ready.groups.entries()) {
   const s=g.before,w=g.ready,f=g.fixturePids;
   if(g.label!=='AB'[i]||!guards(s,negative)||s.atomicBeforeResume!==true||!rows(s.held)||s.held.length<5||s.held.length>32||s.active!==s.held.length||!s.held.every(p=>p.alive)||!observed(s.root,s.held)||!observed(s.shell,s.held)||s.hostPid!==h.root.pid)return false;
   if(!runtime(w?.runtime)||!isQualifiedOsConptyObservation(w)||w.nodePty!=='1.1.0'||w.inputWrites!==0||w.helperListObserved!==true||w.helperExitCode!==0||!uint(w.receivedBytes)||w.receivedBytes===0||!uint(w.retainedBytes)||w.retainedBytes>w.receivedBytes||w.retainedBytes>4194304||!Number.isSafeInteger(w.rssBytes)||w.rssBytes<=0)return false;
   if(!f||Object.keys(f).sort().join(',')!=='branch,detached,grandchild,root'||w.workerPid!==s.root.pid||w.rootPid!==s.shell.pid||f.root!==w.rootPid||s.root.image!==r.main.image)return false;
   const required=[w.workerPid,...Object.values(f)];
   if(new Set(required).size!==5||!required.every(pid=>s.held.some(p=>p.pid===pid))||!Object.values(f).every(pid=>s.held.some(p=>p.pid===pid&&p.image===s.shell.image)))return false;
   canaries.push(...required);expected.push(...s.held);
  }
  if(new Set(canaries).size!==10||!sameSet(expected,h.held)||!h.held.every(p=>observed(p,r.before)))return false;
  if(negative&&!canaries.every(pid=>r.after.some(p=>p.pid===pid&&p.alive)))return false;
  const c=r.cleanup;
  if(c?.verified!==true||c.active!==0||!sameSet(r.after,c.held)||c.held.some(p=>p.alive))return false;
  return c.held.every(p=>{const before=r.after.find(q=>same(p,q));return p.exitCode===(before.alive?98:before.exitCode);});
 } catch {return false;}
}
