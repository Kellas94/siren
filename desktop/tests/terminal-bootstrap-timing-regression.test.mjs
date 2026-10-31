// Owner regression against immutable failed CI; no native execution or mutation.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {isSessionCompositionObserved} from './fixtures/terminal-peer-terminal-session-composition-verdict-baseline.mjs';
// Exact original failed native record, retained as a deterministic test fixture.
const bytes=await readFile(new URL('./fixtures/terminal-bootstrap-fractional-ci37818992385.json',import.meta.url));
const {createHash}=await import('node:crypto');
assert.equal(createHash('sha256').update(bytes).digest('hex'),'57b4a52bc26c05096ba5b37691548812a04528809f6700eba382b5df8b65cd98');
const native=JSON.parse(bytes.toString('utf8'));
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
