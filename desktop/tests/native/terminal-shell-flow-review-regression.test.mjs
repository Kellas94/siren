// Owner regressions for independently reported SF-P2-01/02. Original peer
// report/probes stay unchanged. No native execution or simulated native PASS.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {createShellFlowCore} from './terminal-shell-flow-core.mjs';import {ShellFlowMarkerScanner,fixedShellFlowProbe} from './terminal-shell-flow-probe.mjs';import {isShellFlowObserved} from './terminal-shell-flow-verdict.mjs';import {inertShellFlowObservation} from './terminal-shell-flow-test-fixture.mjs';
for(const blocks of [160,640])test('actual main.observe records tail skips and ring truncation at '+blocks+' blocks/poll',async()=>{
 const source=await readFile(new URL('terminal-shell-flow-main.mjs',import.meta.url),'utf8'),begin=source.indexOf('async function observe(){'),end=source.indexOf('\n  }\n  await wait',begin);assert.ok(begin>=0&&end>begin);const fn=source.slice(begin,end+4);
 const core=createShellFlowCore({write(){throw Error('unexpected write');},resize(){}}),scanner=new ShellFlowMarkerScanner(fixedShellFlowProbe().markers),result={samples:[]};
 const context=vm.createContext({assert,Buffer,Math,scanner,result,now:()=>1,age:0,hash:s=>createHash('sha256').update(s).digest('hex'),controller:{read:async cursor=>({result:core.read({fromSequence:cursor}),stats:core.stats()})}});
 vm.runInContext('let cursor=0,last,maxRetained=0,maxAllocated=0,gaps=0;'+fn+';globalThis.step=observe;globalThis.state=()=>({cursor,gaps});',context);
 const perSecond=('x'.repeat(8190)+'\r\n').repeat(blocks);let delivered=0,skipped=0,ringSkipped=0;
 for(let second=0;second<60;second++){core.append(perSecond);await context.step();const s=result.samples.at(-1);for(const c of s.chunks)delivered+=c.utf8Bytes;if(s.tailGap){assert.equal(s.tailGap.droppedUtf8Bytes,s.tailGap.toSequence-s.tailGap.fromSequence);skipped+=s.tailGap.droppedUtf8Bytes;}if(s.gap)ringSkipped+=s.gap.droppedUtf8Bytes;}
 assert.ok(context.state().gaps>0);assert.ok(skipped>70*1024*1024);assert.equal(delivered+skipped+ringSkipped+32768,core.stats().receivedUtf8Bytes);assert.equal(ringSkipped>0,blocks===640);assert.equal(core.stats().inputWriteAttempts,0);
});
const cases=[
 ['no output received',r=>{r.native.samples=r.native.samples.map(s=>({...s,stats:{...s.stats,receivedUtf8Bytes:0,nextSequence:0,retainedUtf8Bytes:0,allocatedBytes:0,droppedUtf8Bytes:0},chunks:[]}));}],
 ['impossible dropped bytes',r=>{for(const s of r.native.samples)s.stats.droppedUtf8Bytes=999999999999;}],
 ['negative command lengths',r=>{r.native.commands.first.bytes=-100;r.native.commands.fresh.bytes=300;r.native.completedWhileLocked.inputUtf8Bytes=-100;}],
 ['memory sample after observation end',r=>r.observer.samples[1].intervalMs=99000],
 ['wrong worker and shell ids',r=>{r.native.worker.workerPid=999;r.native.worker.rootPid=998;}],
];
for(const [name,change] of cases)test('refuses genuine peer semantic contradiction with stage equality preserved: '+name,()=>{const r=inertShellFlowObservation();change(r);r.ready.session=structuredClone(r.native.before);r.ready.host=structuredClone(r.native.hostBefore);r.ready.worker=structuredClone(r.native.worker);r.ready.fixturePids=structuredClone(r.native.fixturePids);r.observer.ready=structuredClone(r.ready);r.finish.flood=structuredClone(r.native.flood);r.finish.finalStats=structuredClone(r.native.finalStats);r.finish.controller=structuredClone(r.native.controller);r.observer.finish=structuredClone(r.finish);assert.equal(isShellFlowObserved(r),false);});
