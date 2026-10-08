// Owner-authored inert fixture. No process is executed.
import test from 'node:test';
import assert from 'node:assert/strict';
let isEightMainLossObserved;
try{({isEightMainLossObserved}=await import('./terminal-eight-main-loss-verdict.mjs'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
import {eightMainControl} from './terminal-eight-main-loss-test-fixture.mjs';

for(const negative of [false,true])test('complete eight main-loss inert control '+negative,()=>{assert.equal(typeof isEightMainLossObserved,'function');assert.equal(isEightMainLossObserved(eightMainControl(negative),negative),true);});
const changes=[
 ['missing capacity',r=>delete r.ready.capacity],['wrong ninth refusal',r=>r.ready.capacity.code='SESSION_FIXED_PATH_REFUSED'],['ninth entered',r=>r.ready.capacity.creatorEntered=true],['wrong ninth label',r=>r.ready.capacity.attemptedLabel='J'],
 ['capacity omission',r=>r.ready.capacity.hostBefore.held.pop()],['capacity extra',r=>r.ready.capacity.hostAfter.held.push({...r.before[2],pid:999})],
 ['capacity coherent Host swap',r=>{for(const s of [r.ready.capacity.hostBefore,r.ready.capacity.hostAfter]){s.root.image='C:\\other.exe';s.root.createdFileTime='133000000000000001';s.held[0]={...s.root};}}],
 ['capacity live state contradiction',r=>{r.ready.capacity.hostAfter.held[1].alive=false;r.ready.capacity.hostAfter.held[1].exitCode=98;}],
 ['capacity guard mismatch',r=>r.ready.capacity.hostBefore.killOnClose=!r.ready.capacity.hostBefore.killOnClose],
 ['missing eighth group',r=>r.ready.groups.pop()],['duplicate eighth label',r=>r.ready.groups[7].label='G'],['eighth missing detached',r=>r.ready.groups[7].fixturePids.detached=999],
 ['eighth unqualified ConPTY',r=>r.ready.groups[7].ready.osConpty=false],['eighth input writes',r=>r.ready.groups[7].ready.inputWrites=1],
 ['ready duplicate dead',r=>{r.ready.held[1].alive=false;r.ready.held[1].exitCode=98;}],['cleanup rewrites dead main cause',r=>r.cleanup.held[0].exitCode=98],
 ['missing later identity',r=>r.after.pop()],['coherent later identity drift',r=>{r.after[2].image='C:\\other.exe';r.cleanup.held[2].image='C:\\other.exe';}],
 ['Safety already closed',r=>r.safetyOpenAtObservation=false],['abort pending',r=>r.abortCheck.pending=true],['abort committed',r=>r.abortCheck.present=true],['go acknowledged',r=>r.abortCheck.firstGoPresent=true],
 ['total crosses fallback bound',r=>r.mainAgeMs=11000],['ready exceeds six seconds',r=>r.ready.fixtureAgeMs=6000],['missing total age',r=>delete r.mainAgeMs],['failure field',r=>r.error=null],
 ['Session33 below aggregate128',r=>{const g=r.ready.groups[7];const extra=Array.from({length:25},(_,i)=>({...g.before.held[4],pid:2000+i}));g.before.held.push(...extra);g.before.active=33;for(const s of [r.ready.hostSnapshot,r.ready.capacity.hostBefore,r.ready.capacity.hostAfter]){s.held.push(...structuredClone(extra));s.active+=25;}r.ready.held.push(...structuredClone(extra));r.before.push(...structuredClone(extra));const after=extra.map(p=>({...p,alive:r.guardEnabled===false,exitCode:r.guardEnabled===false?259:0}));r.after.push(...after);r.activeBeforeSafetyCleanup+=after.filter(p=>p.alive).length;r.cleanup.held.push(...after.map(p=>({...p,alive:false,exitCode:p.alive?98:p.exitCode})));}],
];
for(const [name,change] of changes)for(const negative of [false,true])test('eight main loss refuses '+name+' '+negative,()=>{assert.equal(typeof isEightMainLossObserved,'function');const r=eightMainControl(negative);change(r);assert.equal(isEightMainLossObserved(r,negative),false);});
test('positive requires all held dead before Safety cleanup',()=>{const r=eightMainControl();r.after.at(-1).alive=true;r.after.at(-1).exitCode=259;r.activeBeforeSafetyCleanup=1;assert.equal(isEightMainLossObserved(r),false);});
test('negative requires all forty creator/fixture canaries alive for two seconds',()=>{for(const change of [r=>r.observeMs=1999,r=>{const pid=r.ready.groups[7].fixturePids.detached,p=r.after.find(p=>p.pid===pid);p.alive=false;p.exitCode=0;r.activeBeforeSafetyCleanup--;r.cleanup.held.find(p=>p.pid===pid).exitCode=0;}]){const r=eightMainControl(true);change(r);assert.equal(isEightMainLossObserved(r,true),false);}});
test('negative utility exit0 is permitted while forty required canaries survive',()=>{const r=eightMainControl(true);r.after[1].alive=false;r.after[1].exitCode=0;r.activeBeforeSafetyCleanup--;r.cleanup.held[1].exitCode=0;assert.equal(isEightMainLossObserved(r,true),true);});
