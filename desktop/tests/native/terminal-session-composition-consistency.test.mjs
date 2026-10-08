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
