import test from 'node:test';
import assert from 'node:assert/strict';
import {control} from './terminal-session-composition-test-fixture.mjs';
import {isComposedMainLossObserved} from './terminal-composed-main-loss-verdict.mjs';
export function mainLossControl(negative=false){
 const source=control(),groups=source.groups.slice(0,2),main={pid:1,image:groups[0].before.root.image,createdFileTime:'133000000000000000',alive:true,exitCode:259};
 for(const group of groups)group.before.killOnClose=!negative;
 const hostRoot={...main,pid:10},hostSnapshot={active:11,root:hostRoot,held:[hostRoot,...groups.flatMap(g=>g.before.held)],killOnClose:!negative,breakaway:false,inheritable:false};
 const ready={mainPid:1,held:hostSnapshot.held,hostSnapshot,groups,runtime:source.runtime,negative,fixtureAgeMs:1000};
 const before=[main,...hostSnapshot.held],after=before.map(p=>({...p,alive:negative&&p.pid!==1,exitCode:p.pid===1?101:negative?259:0}));
 const cleanup=after.map(p=>({...p,alive:false,exitCode:p.alive?98:p.exitCode}));
 return JSON.parse(JSON.stringify({admitted:false,status:'COMPOSED_MAIN_LOSS_OBSERVED_NOT_ADMITTED',guardEnabled:!negative,atomicSafety:true,safetyKillOnClose:true,safetyInheritable:false,main,mainExit:after[0],mainTerminationCode:101,ready,before,after,observeMs:negative?2000:20,mainAgeMs:negative?3500:1500,abortCheck:{checkedAfterMainExit:true,present:false,pending:false,firstGoPresent:false},safetyOpenAtObservation:true,activeBeforeSafetyCleanup:negative?11:0,cleanup:{verified:true,active:0,held:cleanup}}));
}
for(const negative of [false,true])test('complete '+(negative?'disabled-both-kills':'positive')+' control accepted',()=>assert.equal(isComposedMainLossObserved(mainLossControl(negative),negative),true));
const changes=[
 ['wrong main termination',r=>r.mainExit.exitCode=0],['unheld main',r=>r.before.shift()],
 ['wrong creation time',r=>r.after[3].createdFileTime='133000000000000001'],['missing later identity',r=>r.after.pop()],
 ['duplicate identity',r=>r.before.push(r.before[1])],['omitted native member',r=>r.ready.held.pop()],
 ['ready duplicate state disagrees',r=>{r.ready.held[1].alive=false;r.ready.held[1].exitCode=98;}],
 ['missing fixture',r=>r.ready.groups[0].fixturePids.detached=999],['creator duplicate disagrees',r=>r.ready.groups[0].before.root.exitCode=0],
 ['host duplicate disagrees',r=>r.ready.hostSnapshot.root.image='C:\\wrong.exe'],['wrong runtime',r=>r.ready.runtime.electron='1'],
 ['unobserved OS ConPTY',r=>r.ready.groups[0].ready.osConpty=false],['writes present',r=>r.ready.groups[0].ready.inputWrites=1],
 ['helper not observed',r=>r.ready.groups[0].ready.helperListObserved=false],['breakaway allowed',r=>r.ready.groups[0].before.breakaway=true],
 ['Job inherited',r=>r.ready.hostSnapshot.inheritable=true],['not atomic',r=>r.ready.groups[1].before.atomicBeforeResume=false],
 ['Safety already closed',r=>r.safetyOpenAtObservation=false],['Safety lacked containment',r=>r.safetyKillOnClose=false],
 ['cleanup missing',r=>delete r.cleanup],['cleanup accounts nonzero',r=>r.cleanup.active=1],
 ['cleanup changed already dead cause',r=>r.cleanup.held[0].exitCode=98],['deadline exceeded',r=>r.observeMs=3000],
 ['fixture fallback possible',r=>r.ready.fixtureAgeMs=11000],['failure field present',r=>r.error=null],
 ['abort check absent',r=>delete r.abortCheck],['abort check before main exit',r=>r.abortCheck.checkedAfterMainExit=false],
 ['abort committed',r=>r.abortCheck.present=true],['abort publication pending',r=>r.abortCheck.pending=true],
 ['first stage acknowledged before kill',r=>r.abortCheck.firstGoPresent=true],['abort absence unknown',r=>delete r.abortCheck.pending],
 ['total age missing',r=>delete r.mainAgeMs],['delayed ready read beyond fallback bound',r=>r.mainAgeMs=11000],
 ['delayed hold and pre-kill scheduling',r=>r.mainAgeMs=14900],['observation total overrun',r=>r.mainAgeMs=25000],
 ['total age omits ready interval',r=>r.mainAgeMs=r.ready.fixtureAgeMs+r.observeMs-1],
];
for(const [name,change] of changes)for(const negative of [false,true])test('refuses '+name+' '+negative,()=>{const r=mainLossControl(negative);change(r);assert.equal(isComposedMainLossObserved(r,negative),false);});
test('positive requires every observed process exited before Safety cleanup',()=>{const r=mainLossControl();r.after[4].alive=true;r.after[4].exitCode=259;r.activeBeforeSafetyCleanup=1;assert.equal(isComposedMainLossObserved(r),false);});
test('negative requires both native ownership levels disabled and ten exact canaries alive after two seconds',()=>{
 for(const change of [r=>r.ready.hostSnapshot.killOnClose=true,r=>r.ready.groups[1].before.killOnClose=true,r=>r.observeMs=1999,r=>{r.after[4].alive=false;r.after[4].exitCode=0;r.activeBeforeSafetyCleanup--;r.cleanup.held[4].exitCode=0;}]){const r=mainLossControl(true);change(r);assert.equal(isComposedMainLossObserved(r,true),false);}
});
test('negative utility IPC exit is separate from ten live creators and fixture canaries',()=>{
 const r=mainLossControl(true);r.after[1].alive=false;r.after[1].exitCode=0;r.activeBeforeSafetyCleanup--;r.cleanup.held[1].exitCode=0;assert.equal(isComposedMainLossObserved(r,true),true);
});
