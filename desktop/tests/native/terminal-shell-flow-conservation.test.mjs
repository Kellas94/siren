// SF-P2-04 owner regressions. Inert data only, never native execution evidence.
import test from 'node:test';import assert from 'node:assert/strict';
import {inertShellFlowObservation} from './terminal-shell-flow-test-fixture.mjs';
import {isShellFlowObserved} from './terminal-shell-flow-verdict.mjs';
const fixture=()=>{const r=inertShellFlowObservation(),s=r.native.samples;
 s[0].gap={fromSequence:0,resumeSequence:4194304,droppedUtf8Bytes:4194304,resetParser:true};
 s[0].tailGap={fromSequence:4227072,toSequence:8355840,droppedUtf8Bytes:4128768,resetParser:true,reason:'fixed-probe-tail-selection'};
 s[1].chunks=[{sequence:8355840,utf8Bytes:32768,sha256:'a'.repeat(64)}];
 r.native.history.gaps=2;r.native.history.scanner.gaps=2;return r;};
test('inert ring omission, delivered chunks and tail selection account for every received byte',()=>assert.equal(isShellFlowObserved(fixture()),true));
for(const [name,mutate]of [
 ['all explicit tail omissions deleted',r=>{for(const s of r.native.samples)s.tailGap=null;}],
 ['first ring omission deleted',r=>r.native.samples[0].gap=null],
 ['second sample replays an old chunk',r=>r.native.samples[1].chunks[0].sequence=4194304],
 ['second sample silently skips bytes',r=>{r.native.samples[1].chunks[0].sequence+=1;r.native.samples[1].chunks[0].utf8Bytes-=1;}],
 ['final unread tail hidden',r=>r.native.samples[1].chunks=[]],
 ['gap counter inflated',r=>r.native.history.gaps++],
 ['scanner gap counter missing',r=>delete r.native.history.scanner.gaps],
])test('refuses transport conservation contradiction: '+name,()=>{const r=fixture();mutate(r);assert.equal(isShellFlowObserved(r),false);});
