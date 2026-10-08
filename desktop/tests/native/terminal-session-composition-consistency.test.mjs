import test from 'node:test';
import assert from 'node:assert/strict';
import {control} from './terminal-session-composition-test-fixture.mjs';
import {isSessionCompositionObserved} from './terminal-session-composition-verdict.mjs';
const duplicates=[
 ['captured creator contradicts held row',r=>{r.groups[0].before.root={...r.groups[0].before.root,alive:false,exitCode:98};}],
 ['captured shell contradicts held row',r=>{r.groups[0].before.shell={...r.groups[0].before.shell,alive:false,exitCode:98};}],
 ['stopped creator contradicts held row',r=>{r.stoppedA.root={...r.stoppedA.root,alive:true,exitCode:259};}],
 ['stopped shell contradicts held row',r=>{r.stoppedA.shell={...r.stoppedA.shell,alive:true,exitCode:259};}],
 ['exited shell contradicts held row',r=>{r.rootB.shell={...r.rootB.shell,exitCode:0};}],
 ['host utility contradicts held row',r=>{r.hostLoss.held[0]={...r.hostLoss.held[0],exitCode:98};}],
 ['cleanup creator contradicts held row',r=>{r.cleanup[2].snapshot.root={...r.cleanup[2].snapshot.root,alive:true,exitCode:259};}],
];
for(const [name,change] of duplicates)test(name,()=>{const r=control();change(r);assert.equal(isSessionCompositionObserved(r),false);});
const survival=[
 ['survival lost killOnClose',r=>{r.otherAlive={...r.otherAlive,killOnClose:false};}],
 ['survival allowed breakaway',r=>{r.otherAlive={...r.otherAlive,breakaway:true};}],
 ['survival Job became inheritable',r=>{r.otherAlive={...r.otherAlive,inheritable:true};}],
 ['survival creator is separately dead',r=>{r.otherAlive={...r.otherAlive,root:{...r.otherAlive.root,alive:false,exitCode:98}};}],
];
for(const [name,change] of survival)test(name,()=>{const r=control();change(r);assert.equal(isSessionCompositionObserved(r),false);});
test('survival cannot omit a previously captured sixth helper',()=>{
 const r=control(),b=r.groups[1],helper={pid:999,image:'C:\\fixed\\conhost.exe',createdFileTime:'133000000000000001',alive:true,exitCode:259};
 b.before.held.push(helper);b.before.active=6;r.rootB.held.push({...helper,alive:false,exitCode:80});r.cleanup[1].snapshot.held.push({...helper,alive:false,exitCode:80});r.otherAlive=structuredClone(b.before);
 assert.equal(isSessionCompositionObserved(r),true,'six-helper control must be valid before the omission');
 r.otherAlive.held.pop();assert.equal(isSessionCompositionObserved(r),false);
});
for(const key of ['error','cleanupError','hostCleanupError'])for(const [label,value] of [['object',{message:'failed'}],['string','failed'],['null',null],['undefined',undefined]])test('success refuses '+key+' '+label,()=>{const r=control();r[key]=value;assert.equal(isSessionCompositionObserved(r),false);});
function sample(negative,index){const r=JSON.parse(JSON.stringify(control(negative))),g=r.groups[index],helper={pid:901+index,image:'C:\\fixed\\conhost.exe',createdFileTime:'133000000000000001',alive:true,exitCode:259},ended=code=>({...helper,alive:false,exitCode:code});g.before.held.push(helper);g.before.active++;
if(index===0){r.stoppedA.held.push(ended(77));r.cleanup[0].snapshot.held.push(ended(77));}
else if(index===1){r.otherAlive.held.push({...helper});r.otherAlive.active++;r.rootB.held.push(negative?{...helper}:ended(80));if(negative)r.rootB.active++;r.cleanup[1].snapshot.held.push(ended(negative?98:80));}
else {r.hostLoss.held.push(ended(79));r.cleanup[index].snapshot.held.push(ended(79));}return {r,helper};}
for(const negative of [false,true])for(const index of [0,1,2,3])test('already ended helper keeps its exit cause through cleanup '+(negative?'negative ':'positive ')+'ABCD'[index],()=>{const {r,helper}=sample(negative,index);assert.equal(isSessionCompositionObserved(r),true);const prior=index===0?r.stoppedA:index===1?r.rootB:r.hostLoss,p=prior.held.find(p=>p.pid===helper.pid);if(p.alive){p.alive=false;prior.active--;}p.exitCode=index<2?0:98;assert.equal(isSessionCompositionObserved(r),false,'CONTRADICTORY_TERMINAL_HELPER_CAUSE');});
for(const negative of [false,true])test('consistent naturally ended optional helper is permitted '+negative,()=>{for(const index of [0,1,2,3]){const {r,helper}=sample(negative,index),prior=index===0?r.stoppedA:index===1?r.rootB:r.hostLoss,p=prior.held.find(p=>p.pid===helper.pid);if(p.alive){p.alive=false;prior.active--;}p.exitCode=0;r.cleanup[index].snapshot.held.find(p=>p.pid===helper.pid).exitCode=0;assert.equal(isSessionCompositionObserved(r),true);}});
