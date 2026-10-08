// Pure source derivation only. No native entrypoint/import/compilation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
let deriveEightMainLoss,deriveEightMainLossRunner,deriveEightMainLossBuilder;
try{({deriveEightMainLoss,deriveEightMainLossRunner,deriveEightMainLossBuilder}=await import('./terminal-eight-main-loss-derive.mjs'));}catch(e){if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const desktop=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,desktop),'utf8');
const inputs={host:await read('tests/fixtures/terminal-host-guard/host.cc'),fixture:await read('tests/fixtures/terminal-job-list.cs'),extension:await read('tests/fixtures/terminal-session-composition.inc'),observerBase:await read('tests/fixtures/terminal-main-owner-observer.cs'),observerStage:await read('tests/fixtures/terminal-session-composition-observer.cs'),mainLossObserver:await read('tests/fixtures/terminal-composed-main-loss-observer.cs')};
const runner=await read('tests/native/terminal-composition-eight.mjs'),builder=await read('tests/native/build-terminal-composition-eight.mjs');
test('separate eight main-loss derivation preserves Session32/admission8 and disables both kill-on-close levels only in negative build',()=>{
 assert.equal(typeof deriveEightMainLoss,'function');const d=deriveEightMainLoss(inputs);
 assert.equal(d.host.split('#ifndef SIREN_TEST_DISABLE_COMPOSED_KILL_ON_CLOSE').length-1,2);
 assert.match(d.host,/NumberOfProcessIdsInList>128/);assert.match(d.host,/NumberOfProcessIdsInList>32/);assert.match(d.host,/sessionCount.load\(\)>=8/);
 assert.match(d.observerBase,/count<=128/);assert.match(d.observerStage,/groups.Length==8/);assert.match(d.observerStage,/canaries.Count==40/);
 assert.match(d.observerStage,/MAIN_LOSS_CAPACITY_REFUSED/);assert.match(d.observerStage,/AllHeldExited\(held\)/);
 assert.ok(d.observerStage.indexOf('MAIN_LOSS_ABORT_MARKED')>d.observerStage.indexOf('MAIN_LOSS_MAIN_EXIT_NOT_CAUSAL'));
 assert.equal(d.fixture.includes('12000'),true);
});
test('derivation refuses drift in each immutable source, runner and builder',()=>{
 assert.equal(typeof deriveEightMainLoss,'function');for(const key of Object.keys(inputs))assert.throws(()=>deriveEightMainLoss({...inputs,[key]:inputs[key]+'\n'}));
 assert.throws(()=>deriveEightMainLossRunner({runner:runner+'\n',desktop}),/DRIFT/);assert.throws(()=>deriveEightMainLossBuilder({builder:builder+'\n',desktop}),/DRIFT/);
});
test('runner captures full eight readiness/capacity and arms abort before first ready; no killed-main native result is required',()=>{
 assert.equal(typeof deriveEightMainLossRunner,'function');const s=deriveEightMainLossRunner({runner,desktop});
 assert.match(s,/groups:owned/);assert.match(s,/capacity:result.capacity/);assert.match(s,/fixtureAgeMs:now\(\)-age/);assert.match(s,/mainLossArmed=true/);
 assert.ok(s.indexOf("if(label==='first')mainLossArmed=true")<s.indexOf("await persist(join(config.output,'composition-'+label+'-ready.json')"));
 assert.match(s,/catch\{await new Promise\(\(\)=>\{\}\);\}/);assert.match(s,/receipt.ready=JSON.parse/);assert.doesNotMatch(s,/receipt.native=JSON.parse/);
 assert.match(s,/isEightMainLossObserved\(receipt.observer,negative\)/);assert.match(s,/COMPOSED_READY_READBACK_CHANGED/);
});
test('builder preserves graph/tool/addon identity checks and selects disabled-both-kills control',()=>{
 assert.equal(typeof deriveEightMainLossBuilder,'function');const s=deriveEightMainLossBuilder({builder,desktop});
 assert.match(s,/SIREN_TEST_DISABLE_COMPOSED_KILL_ON_CLOSE=1/);assert.doesNotMatch(s,/SIREN_TEST_DISABLE_SESSION_ROOT_MONITOR=1/);assert.match(s,/recheckTerminalCandidateGraph/);
 assert.match(s,/disabled-both-kill-on-close-control/);assert.match(s,/isEightMainLossObserved\(r.observer,index===1\)/);assert.match(s,/terminal_eight_main_loss_negative/);
 assert.match(s,/fileURLToPath\(import.meta.url\).slice\(desktop.length\)/);
});
