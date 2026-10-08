// Test-only finite aggregate budget. Original native sources are never overwritten.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deriveSessionComposition} from './terminal-session-composition-derive.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const once=(s,a,b)=>{assert.equal(s.split(a).length,2,'EIGHT_ANCHOR_DRIFT');return s.replace(a,()=>b);};
export function deriveEightComposition({host,fixture,extension,observerBase,observerStage}){
 assert.equal(sha(extension),'2cd157f5534a10659c582d538b34dee9e136148ab0192dfe8b2b433102a9b00d','EIGHT_EXTENSION_DRIFT');
 assert.equal(sha(observerBase),'19222580db0df96b9fc30f8dbc0e232a31360ef2f71210101569d1bd84322bbc','EIGHT_OBSERVER_BASE_DRIFT');
 assert.equal(sha(observerStage),'c6c2a4b901d246121b19e107901a128446323e3b5890ec18d3f1ff9fd23da1d1','EIGHT_OBSERVER_STAGE_DRIFT');
 const derived=deriveSessionComposition({host,fixture,extension});
 host=once(derived.host,'+64*sizeof(ULONG_PTR)','+128*sizeof(ULONG_PTR)');
 host=once(host,'list->NumberOfProcessIdsInList>64','list->NumberOfProcessIdsInList>128');
 // External Safety and individual Session owners retain earlier held identities.
 // This separate experiment recaptures remaining live Host members after A/B die.
 host=once(host,'for(const auto& m:p->held)if(m.pid!=p->root.pid&&WaitForSingleObject(m.process.h,0)!=WAIT_OBJECT_0)return Refuse(env,"COMPOSITION_PREVIOUS_STAGE_LIVE");','// Eight-session live Host recapture; prior identity handles remain in Safety/Session owners.');
 observerBase=observerBase.replaceAll('\r\n','\n');observerStage=observerStage.replaceAll('\r\n','\n');
 observerBase=once(observerBase,'internal static class TerminalMainOwnerObserver {','internal static partial class TerminalMainOwnerObserver {');
 observerBase=once(observerBase,'static int Main(string[] args) {','static int HistoricalMain(string[] args) {');
 observerBase=once(observerBase,'count<=64,"JOB_SET_REFUSED"','count<=128,"JOB_SET_REFUSED"');
 observerStage=once(observerStage,'required.Length<=64','required.Length<=128');
 observerStage=once(observerStage,'static int Main(string[] args) {','static bool AllCapacityHeldExited(List<Held> held){foreach(var p in held)if(WaitForSingleObject(p.handle,0)!=0)return false;return true;}\n    static int Main(string[] args) {');
 observerStage=observerStage.replaceAll('while(Active(safety)!=0&&','while((Active(safety)!=0||!AllCapacityHeldExited(held))&&');
 observerStage=once(observerStage,'result["after"]=Observe(held);','Require(age.ElapsedMilliseconds<11000,"CAPACITY_TOTAL_AGE_REFUSED");\n            result["after"]=Observe(held);');
 return {host,fixture:derived.fixture,observerBase,observerStage};
}
