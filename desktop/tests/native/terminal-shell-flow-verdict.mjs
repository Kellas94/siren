// Refusal-first interpretation of independent native observations. Source,
// binary/dependency graph identities and exact original logs are bound by the
// runner/builder and retained/reviewed separately. Never product admission.
import {isDeepStrictEqual as equal} from 'node:util';
const n=x=>Number.isSafeInteger(x)&&x>=0,hash=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const identity=(a,b)=>a?.pid===b?.pid&&a?.image===b?.image&&a?.createdFileTime===b?.createdFileTime;
export function isShellFlowObserved(value){
 try{
  const {native:r,observer:o,ready,finish}=value;
  if(r.admitted!==false||o.admitted!==false||r.status!=='SHELL_FLOW_OBSERVED_NOT_ADMITTED'||o.status!=='SHELL_FLOW_SAFETY_OBSERVED_NOT_ADMITTED'||r.error||o.error||r.cleanupError||r.hostCleanupError||o.cleanupError)return false;
  if(!equal(ready,o.ready)||!equal(finish,o.finish)||!equal(ready.session,r.before)||!equal(ready.host,r.hostBefore)||!equal(ready.worker,r.worker)||!equal(ready.fixturePids,r.fixturePids)||!equal(finish.flood,r.flood)||!equal(finish.finalStats,r.finalStats)||!equal(finish.controller,r.controller))return false;
  if(ready.mainPid!==finish.mainPid||ready.mainPid!==o.main.pid||!o.main.alive)return false;
  const runtime=r.runtime;if(runtime.electron!=='44.5.1'||runtime.modules!=='149'||runtime.arch!=='x64'||runtime.platform!=='win32'||r.worker.osConpty!==true||r.worker.useConptyDll!==false||r.worker.nodePty!=='1.1.0')return false;
  if(!n(r.ageMs)||r.ageMs>=100000||!n(o.ageMs)||o.ageMs>=100000||o.cleanupVerified!==true||o.safetyOpenAtObservation!==true||o.activeBeforeSafetyCleanup!==0||r.sessionClosed!==true||r.hostClosed!==true||!n(r.stopMs)||r.stopMs>=3000)return false;
  const before=r.before,after=r.stopped;if(!Array.isArray(before.held)||before.held.length<6||before.held.length>32||before.active!==before.held.length||before.killOnClose!==true||before.breakaway!==false||before.inheritable!==false||after.active!==0||after.root.alive!==false||after.shell.alive!==false||after.held.length!==before.held.length)return false;
  if(r.worker.workerPid!==before.root.pid||r.worker.rootPid!==before.shell.pid||before.root.pid===before.shell.pid||!before.held.some(p=>identity(p,before.root))||!before.held.some(p=>identity(p,before.shell)))return false;
  if(Object.keys(r.fixturePids).sort().join(',')!=='branch,detached,grandchild,root'||new Set(Object.values(r.fixturePids)).size!==4||Object.values(r.fixturePids).some(pid=>!before.held.some(p=>p.pid===pid)||pid===before.root.pid||pid===before.shell.pid))return false;
  const host=r.hostBefore;if(host.killOnClose!==true||host.breakaway!==false||host.inheritable!==false||host.active!==before.held.length+1||host.held.length!==host.active||before.held.some(p=>!host.held.some(q=>identity(p,q)))||before.held.some(p=>p.pid===host.root.pid)||!host.held.some(p=>identity(p,host.root))||new Set(host.held.map(p=>p.pid)).size!==host.held.length)return false;
  const ids=new Set();for(const p of before.held){if(!n(p.pid)||p.pid===0||ids.has(p.pid)||!p.alive)return false;ids.add(p.pid);if(!after.held.some(q=>identity(p,q)&&q.alive===false&&q.exitCode===77)||!o.before.some(q=>identity(p,q)&&q.alive===true)||!o.after.some(q=>identity(p,q)&&q.alive===false&&q.exitCode===77))return false;}
  if(o.before.length!==o.after.length||o.after.some(p=>p.alive!==false)||new Set(o.before.map(p=>p.pid)).size!==o.before.length)return false;
  for(const p of o.before)if(!o.after.some(q=>identity(p,q)))return false;
  const f=r.flood;if(!n(f.elapsedMs)||f.elapsedMs<60000||f.elapsedMs>=75000||f.admitted!==false||f.minimumMs!==60000||f.byteCap!==134217728||!n(f.generatedAsciiBytes)||f.generatedAsciiBytes<=4194304||f.generatedAsciiBytes>f.byteCap||f.blocks*8192!==f.generatedAsciiBytes)return false;
  const c=r.completedWhileLocked,s=r.finalStats,first=r.commands.first,fresh=r.commands.fresh;
  if(!n(first.bytes)||first.bytes<1||first.bytes>32768||!n(fresh.bytes)||fresh.bytes<1||fresh.bytes>32768)return false;
  if(c.open!==false||c.unavailable!==false||c.inputWrites!==1||c.inputWriteAttempts!==1||c.inputUtf8Bytes!==first.bytes||c.inputWriteSha256!==first.sha256||c.inputAttemptSha256!==first.sha256||s.inputWrites!==2||s.inputWriteAttempts!==2||s.inputUtf8Bytes!==first.bytes+fresh.bytes||s.inputWriteSha256!==s.inputAttemptSha256)return false;
  if(!hash(first.sha256)||!hash(fresh.sha256)||!hash(s.inputWriteSha256)||r.locked.result.ok!==false||r.locked.stats.inputWrites!==1||r.locked.stats.open!==false)return false;
  if(!Array.isArray(r.samples)||r.samples.length<2||r.samples.length>90)return false;
  const ring=t=>n(t.receivedUtf8Bytes)&&t.receivedUtf8Bytes===t.nextSequence&&n(t.retainedUtf8Bytes)&&t.retainedUtf8Bytes<=4194304&&n(t.allocatedBytes)&&t.allocatedBytes>=t.retainedUtf8Bytes&&t.allocatedBytes<=4194304&&n(t.droppedUtf8Bytes)&&t.retainedUtf8Bytes+t.droppedUtf8Bytes===t.receivedUtf8Bytes&&t.firstSequence===t.droppedUtf8Bytes;
  if(!ring(c)||!ring(s)||c.receivedUtf8Bytes<=4194304||s.receivedUtf8Bytes<c.receivedUtf8Bytes||!equal(r.samples.at(-1).stats,s))return false;
  let previous=0,sampleAge=-1,cursor=0,delivered=0,omitted=0,gapCount=0;
  for(const sample of r.samples){const t=sample.stats;if(!ring(t)||t.receivedUtf8Bytes<previous||!n(sample.ageMs)||sample.ageMs<sampleAge||sample.ageMs>r.ageMs)return false;previous=t.receivedUtf8Bytes;sampleAge=sample.ageMs;
   if(sample.gap){const g=sample.gap;if(g.fromSequence!==cursor||cursor>=t.firstSequence||g.resumeSequence!==t.firstSequence||g.droppedUtf8Bytes!==t.firstSequence-cursor||g.resetParser!==true)return false;omitted+=g.droppedUtf8Bytes;cursor=g.resumeSequence;gapCount++;}
   if(cursor<t.firstSequence||cursor>t.nextSequence)return false;
   let bytes=0;for(const chunk of sample.chunks){if(chunk.sequence!==cursor||!n(chunk.utf8Bytes)||chunk.utf8Bytes<1||chunk.utf8Bytes>32768||cursor+chunk.utf8Bytes>t.nextSequence||!hash(chunk.sha256))return false;bytes+=chunk.utf8Bytes;cursor+=chunk.utf8Bytes;delivered+=chunk.utf8Bytes;}if(bytes>32768)return false;
   if(sample.tailGap){const g=sample.tailGap;if(g.fromSequence!==cursor||!n(g.toSequence)||g.toSequence<=cursor||g.toSequence>t.nextSequence||g.droppedUtf8Bytes!==g.toSequence-cursor||g.resetParser!==true||g.reason!=='fixed-probe-tail-selection')return false;omitted+=g.droppedUtf8Bytes;cursor=g.toSequence;gapCount++;}
  }
  // A well-shaped subset is insufficient: the complete transport must account
  // for every byte from cursor zero through the final drained observation.
  if(cursor!==s.nextSequence||delivered+omitted!==s.receivedUtf8Bytes||gapCount!==r.history.gaps||gapCount!==r.history.scanner.gaps)return false;
  if(!n(r.history.maxRetained)||r.history.maxRetained>4194304||!n(r.history.maxAllocated)||r.history.maxAllocated>4194304||!n(r.history.gaps)||r.history.gaps<1||c.droppedUtf8Bytes<=0||!r.history.scanner.seen.includes('done')||!r.history.scanner.seen.includes('start')||!r.finalScanner.seen.includes('fresh'))return false;
  if(r.controller.nativeExecutionAdmitted!==false||r.controller.requests>128||r.controller.dataPending!==0||r.controller.control.pending!==0||r.controller.gateAckMs.length!==3||r.controller.inputAckMs.length!==2||[...r.controller.gateAckMs,...r.controller.inputAckMs].some(ms=>!n(ms)||ms>500))return false;
  const replay=r.historyReplay;if(!ring(replay.stats)||replay.stats.inputWrites!==1||replay.stats.inputWriteAttempts!==1||replay.stats.open!==false||replay.stats.inputAttemptSha256!==first.sha256||replay.gap.fromSequence!==0||replay.gap.resumeSequence!==replay.stats.firstSequence||replay.gap.droppedUtf8Bytes!==replay.stats.firstSequence||replay.gap.droppedUtf8Bytes<=0||replay.gap.resetParser!==true)return false;
  if(!n(o.measurementMs)||o.measurementMs<60000||!n(o.peakSafetyJobMemoryBytes)||o.peakSafetyJobMemoryBytes===0||!Array.isArray(o.samples)||o.samples.length<2||o.samples.length>400)return false;
  let interval=-1,peak=0;for(const sample of o.samples){if(!n(sample.intervalMs)||sample.intervalMs<=interval||sample.intervalMs>o.measurementMs||!n(sample.ageMs)||sample.ageMs<sample.intervalMs||sample.ageMs>o.ageMs||!n(sample.peakSafetyJobMemoryBytes)||sample.peakSafetyJobMemoryBytes<peak||sample.peakSafetyJobMemoryBytes>o.peakSafetyJobMemoryBytes||sample.heldCount!==o.before.length||sample.active!==o.before.length)return false;interval=sample.intervalMs;peak=sample.peakSafetyJobMemoryBytes;}
  return interval>=59000;
 }catch{return false;}
}
