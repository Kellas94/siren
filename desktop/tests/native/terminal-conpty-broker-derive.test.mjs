import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {deriveBrokerSources}=await import('./terminal-conpty-broker-derive.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const original=await readFile(new URL('../fixtures/terminal-job-list.cs',import.meta.url),'utf8'),shared=await readFile(new URL('../fixtures/terminal-conpty-membership.cs',import.meta.url),'utf8');
test('broker derivation preserves fixed fixture logic and shared study except three exact seam changes',()=>{
 assert.equal(typeof deriveBrokerSources,'function');const d=deriveBrokerSources({original,shared});
 assert.equal(d.original.replace('internal static partial class TerminalJobListProbe {','internal static class TerminalJobListProbe {').replace('static int OriginalMain(string[] args) {','static int Main(string[] args) {'),original);
 assert.equal(d.shared.replace('static int SharedStudyMain(string[] args) {','static int Main(string[] args) {').replace('out bool beforeResume,bool inheritedSession=false)','out bool beforeResume)').replace('beforeResume==(!omitSession||inheritedSession)','beforeResume==!omitSession'),shared);
});
test('unknown, drifted or ambiguous source refuses derivation',()=>{
 assert.equal(typeof deriveBrokerSources,'function');for(const inputs of [{original:original+'\n',shared},{original,shared:shared+'\n'},{original:'',shared},{original,shared:shared.replace('static int Main','static int UnknownMain')}])assert.throws(()=>deriveBrokerSources(inputs));
});
