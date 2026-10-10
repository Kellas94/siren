// Fixed-fixture DATA consistency only; never authentication or product authority.
import {isDeepStrictEqual} from 'node:util';
import {win32} from 'node:path';
import {validateHostAsyncReceipt} from '../../src/terminal/host-async-receipt-contract.mjs';
export const graphNativeModes=Object.freeze(['graph-empty','graph-lock','graph-held-cwd','graph-host-loss','negative-provider-held']);
const eq=isDeepStrictEqual,uint=n=>Number.isInteger(n)&&n>=0&&n<=0xffffffff,pid=n=>uint(n)&&n>0;
const image=p=>typeof p==='string'&&p.length<=32767&&p.isWellFormed()&&/^(?:[A-Za-z]:[\\/]|\\\\[^\\]+\\[^\\]+)/.test(p)&&!/[\x00-\x1f\x7f"]/.test(p);
const identity=p=>({pid:p?.pid,image:p?.image,createdFileTime:p?.createdFileTime});
const validIdentity=p=>pid(p?.pid)&&image(p.image)&&typeof p.createdFileTime==='string'&&/^[1-9][0-9]{0,19}$/.test(p.createdFileTime)&&BigInt(p.createdFileTime)<=0xffffffffffffffffn;
const identities=rows=>rows.map(identity).sort((a,b)=>a.pid-b.pid);
const members=rows=>Array.isArray(rows)&&rows.length>0&&rows.length<=64&&new Set(rows.map(p=>p?.pid)).size===rows.length&&rows.every(p=>validIdentity(p)&&typeof p.alive==='boolean'&&uint(p.exitCode));
const sameSet=(a,b)=>members(a)&&members(b)&&eq(identities(a),identities(b));
const alive=rows=>rows.filter(p=>p.alive).length;
const pending=r=>r?.requested===true&&r.actualSettled===false&&r.hostStarted===false&&r.stopCalls===0&&r.rootAlive===true;
const flagsFalse=g=>['hostNativeJoined','sessionCleanupJoined','rosterAuthorityEstablished','nativeExecutionAdmitted'].every(k=>g?.[k]===false);
const watchdog=e=>{if(e==='EXTERNAL_WATCHDOG_DEADLINE:after.json')return true;const prefix='EXTERNAL_WATCHDOG_DEADLINE:after.json:';if(typeof e!=='string'||!e.startsWith(prefix))return false;const suffix=e.slice(prefix.length),n=Number(suffix);return Number.isInteger(n)&&n>=-2147483648&&n<=2147483647&&String(n)===suffix;};
const pathKey=p=>win32.normalize(p).toLowerCase();
const requiredInputs=['desktop/tests/native/terminal-graph-native-worker.mjs','desktop/tests/native/terminal-graph-native-verdict.mjs','desktop/tests/native/terminal-graph-native-inputs.json','desktop/native/terminal-host-roster-candidate/ownership.cc','desktop/native/terminal-host-roster-candidate/peer-endpoints.inc','node.exe','csc.exe','graph-observer.cs','graph-observer.exe','siren_terminal_host_roster_candidate.node'];
function inputPins(rows){return Array.isArray(rows)&&rows.length<=192&&new Set(rows.map(r=>typeof r?.path==='string'?pathKey(r.path):null)).size===rows.length&&rows.every(r=>image(r?.path)&&Number.isSafeInteger(r.bytes)&&r.bytes>0&&/^[a-f0-9]{64}$/.test(r.sha256))&&requiredInputs.every(name=>rows.filter(r=>pathKey(r.path).endsWith('\\'+name.replaceAll('/','\\'))).length===1);}
export function graphNativeCasePassed(value){
 try{
  const {mode,exit,result:r,blocked}=value;
  if(!graphNativeModes.includes(mode)||r?.scope!=='LOCAL_WINDOWS_NODE_ROSTER_QUALIFICATION'||r.nativeExecutionAdmitted!==false||r.cleanupVerified!==true||r.cleanupFinalActive!==0||!members(r.before)||!r.before.every(p=>p.alive)||!sameSet(r.before,r.cleanupFinalHeld)||alive(r.cleanupFinalHeld)!==0)return false;
  const b=r.nativeBefore,n=b?.before;
  if(b?.mode!==mode||b.sessionCount!==0||b.peerCount!==0||!Array.isArray(b.sessionCaptures)||b.sessionCaptures.length||b.syntheticWindow!==true||!pid(b.mainPid)||!pid(b.canaryPid)||b.mainPid===b.canaryPid||!members(n?.held)||n.held.length>2||n.active!==n.held.length||!n.held.every(p=>p.alive)||!validIdentity(n.root)||n.root.alive!==true||!uint(n.root.exitCode)||!n.held.some(p=>eq(identity(p),identity(n.root)))||n.held.some(p=>p.pid!==n.root.pid&&!/[\\/]conhost\.exe$/i.test(p.image)))return false;
  const initial=b.graphBefore;if(initial?.scope!=='MAIN_PRIVATE_TERMINAL_GRAPH_JS'||initial.projectId!=='project1'||initial.started!==true||initial.requested!==false||initial.actualSettled!==false||initial.hostStarted!==false||initial.unknown!==false||!flagsFalse(initial))return false;
  const nativeIds=new Set(n.held.map(p=>p.pid)),main=r.before.find(p=>p.pid===b.mainPid),canary=r.before.find(p=>p.pid===b.canaryPid);
  if(nativeIds.has(b.mainPid)||nativeIds.has(b.canaryPid)||!main||!canary||!n.held.every(p=>r.before.some(q=>eq(identity(p),identity(q)))))return false;
  const extra=r.before.filter(p=>!nativeIds.has(p.pid)&&p.pid!==b.mainPid&&p.pid!==b.canaryPid);
  if(!Number.isInteger(r.outsideConsoleHelpers)||r.outsideConsoleHelpers!==extra.length||extra.length>3||extra.some(p=>!/[\\/]conhost\.exe$/i.test(p.image)))return false;
  if(!sameSet(r.before,r.cleanupEntryHeld)||!Number.isInteger(r.cleanupEntryActive)||r.cleanupEntryActive!==alive(r.cleanupEntryHeld))return false;
  if(mode==='negative-provider-held')return exit===1&&r.status==='FAILED'&&r.nativeAfter===undefined&&watchdog(r.error)&&r.watchdogWorkerAlive===true&&r.watchdogProtocol==='after.json'&&Number.isInteger(r.watchdogElapsedMs)&&r.watchdogElapsedMs>=20000&&r.watchdogElapsedMs<25000&&r.cleanupEntryHeld.some(p=>eq(identity(p),identity(n.root))&&p.alive)&&r.cleanupEntryHeld.some(p=>p.pid===b.mainPid&&p.alive)&&pending(blocked);
  const a=r.nativeAfter,g=a?.graph;
  if(exit!==0||r.status!=='LOCAL_NATIVE_CASE_PASSED'||r.nativeGroupDeadBeforeSafetyCleanup!==true||r.canaryAliveBeforeSafetyCleanup!==true||r.finalActiveBeforeSafetyCleanup!==0||a?.status!=='GRAPH_NATIVE_OPERATION_COMPLETED'||a.scope!=='BOUNDED_WINDOWS_NODE_GRAPH_COMPOSITION'||a.mode!==mode||a.nativeExecutionAdmitted!==false||a.checked?.ok!==true||a.startCalls!==1||a.stopCalls!==1||a.duplicateSame!==true||a.conflictRefused!==true)return false;
  if(!sameSet(r.before,r.afterBeforeSafetyCleanup)||r.activeBeforeSafetyCleanup!==alive(r.afterBeforeSafetyCleanup)||!sameSet(r.before,r.finalBeforeSafetyCleanup)||alive(r.finalBeforeSafetyCleanup)!==0)return false;
  if(!r.afterBeforeSafetyCleanup.every(p=>nativeIds.has(p.pid)?p.alive===false: p.pid===b.mainPid||p.pid===b.canaryPid?p.alive===true:true))return false;
  if(validateHostAsyncReceipt(a.expected,a.receipt).ok!==true||a.expected.request.shutdownId!=='native_'+mode||a.expected.request.code!==77||a.expected.request.deadlineMs!==5000||a.expected.pairOrdinals.length!==0||!eq(identity(a.expected.root),identity(n.root))||!eq(identities(a.expected.held),identities(n.held)))return false;
  if(!a.receipt.snapshot.held.every(p=>r.afterBeforeSafetyCleanup.some(q=>eq(p,q)))||!r.afterBeforeSafetyCleanup.some(p=>eq(p,a.receipt.snapshot.root)))return false;
  if(g?.scope!=='MAIN_PRIVATE_TERMINAL_GRAPH_JS'||g.projectId!=='project1'||g.requested!==true||g.started!==true||g.hostStarted!==true||g.actualSettled!==true||g.unknown!==false||g.upperJsSettled!==true||g.hostJsSettled!==true||g.activeFrames!==0||g.pendingObservers!==0||!flagsFalse(g))return false;
  if(mode==='graph-lock'&&a.lockPreserved!==true)return false;
  if(mode==='graph-held-cwd'&&(!pending(a.hold)||!Number.isFinite(a.hold.elapsedMs)||a.hold.elapsedMs<5500||!eq(a.hold,blocked)))return false;
  return true;
 }catch{return false;}
}
export function graphNativeBatchPassed(value){
 try{return value.scope==='BOUNDED_WINDOWS_NODE_GRAPH_COMPOSITION'&&value.nativeExecutionAdmitted===false&&inputPins(value.inputs)&&eq(value.boundaries,{syntheticWindow:true,realNativeAddon:true,sessions:0,electron:false,pty:false,connectedPeers:false,fullFaultMatrix:false,productActivation:false})&&Array.isArray(value.cases)&&value.cases.length===5&&value.cases.every((c,i)=>c.mode===graphNativeModes[i]&&graphNativeCasePassed(c));}catch{return false;}
}
export function graphNativeRecordsPassed(batch,records){try{return graphNativeBatchPassed(batch)&&Array.isArray(records)&&records.length===5&&records.every((record,i)=>eq(record,batch.cases[i])&&graphNativeCasePassed(record));}catch{return false;}}
export function graphNativeProvenancePassed(batch,initial,details){
 try{
  if(!graphNativeBatchPassed(batch)||batch.status!=='BOUNDED_GRAPH_CASES_PASSED'||!eq(initial,{...Object.fromEntries(Object.entries(batch).filter(([k])=>k!=='status')),cases:[]})||!Array.isArray(details)||details.length!==5)return false;
  const find=name=>batch.inputs.find(p=>pathKey(p.path).endsWith('\\'+name.replaceAll('/','\\'))),addon=find('siren_terminal_host_roster_candidate.node'),node=find('node.exe'),payload=find('desktop/tests/fixtures/terminal-host-roster-local-payload.mjs');if(!payload)return false;
  return details.every((d,i)=>{
   const c=batch.cases[i],cfg=d?.config;if(d?.mode!==c.mode||!eq(d.before,c.result.nativeBefore)||cfg?.mode!==c.mode||!eq(cfg.inputs,batch.inputs)||pathKey(cfg.addon)!==pathKey(addon.path)||cfg.addonHash!==addon.sha256||cfg.nodeHash!==node.sha256||pathKey(cfg.payload)!==pathKey(payload.path))return false;
   if(c.mode!=='negative-provider-held'&&!eq(d.after,c.result.nativeAfter))return false;
   if(c.mode==='graph-lock'){const l=d.lock,g=l?.graph;if(l?.lockPreserved!==true||l.stopCalls!==0||l.ownerRetired!==false||l.managerRetired!==false||l.inputClosed!==true||!eq(identity(l.root),identity(d.before.before.root))||l.root.alive!==true||g?.requested!==false||g.actualSettled!==false||g.hostStarted!==false||g.unknown!==false||!flagsFalse(g))return false;}
   return true;
  });
 }catch{return false;}
}
