// Owner regression against immutable failed CI; no native execution or mutation.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';
import {isSessionCompositionObserved} from './native/terminal-session-composition-verdict.mjs';
const base=new URL('../evidence/workspace-surface/ci37818992385/original/desktop/evidence/terminal-bootstrap-async-observation/',import.meta.url);
const name=(await readdir(base))[0],native=JSON.parse(await readFile(new URL(name+'/native-result.json',base),'utf8'));
test('original failed CI retains fractional timing; one counterfactual isolates legacy format mismatch',()=>{
 assert.equal(Number.isInteger(native.stopMs),false);assert.equal(isSessionCompositionObserved(native),false);
 const copy=structuredClone(native);copy.stopMs=Math.ceil(copy.stopMs);assert.equal(isSessionCompositionObserved(copy),true);
 assert.equal(native.stopMs,15.18999999999994);assert.equal(copy.stopMs,16);
});
test('new harness preserves exact async duration while rounding legacy integer timing upward',async()=>{
 const runner=await readFile(new URL('./native/terminal-bootstrap-async.mjs',import.meta.url),'utf8');
 assert.match(runner,/const elapsedMs=performance\.now\(\)-stopping;result\.stopMs=Math\.ceil\(elapsedMs\)/);
 assert.match(runner,/result\.asyncRetirement=\{closed:true,elapsedMs,ticks,maxGapMs\}/);
});
