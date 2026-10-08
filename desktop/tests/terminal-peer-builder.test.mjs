// Pure checked-in builder preparation. Do not import guarded entrypoints.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {PUBLICATION_INPUTS,CANDIDATE_BRANCH,requireWorkflowIsolation} from './native/terminal-peer-endpoints-contract.mjs';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const api=await import('./native/terminal-peer-ci-derive.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const inputs={builder:await read('./native/build-terminal-normal-powershell.mjs'),workflow:await read('../../.github/workflows/terminal-normal-powershell.yml')};
test('new peer builder and workflow derive from preserved hash-pinned normal experiment',async()=>{
 assert.equal(typeof api.derivePeerEndpointCi,'function');const r=api.derivePeerEndpointCi(inputs);
 assert.equal(r.nativeExecuted,false);assert.equal(r.admitted,false);
 assert.equal(r.builder,await read('./native/build-terminal-peer-endpoints.mjs'));
 assert.equal(r.workflow,await read('../../.github/workflows/terminal-peer-endpoints.yml'));
 for(const key of ['builder','workflow'])assert.throws(()=>api.derivePeerEndpointCi({...inputs,[key]:inputs[key]+'\n'}),/PEER_CI_INPUT_DRIFT/);
});
test('three native source inputs are copied and recorded in compiler lineage; final input graph rechecks remain',()=>{
 assert.equal(typeof api.derivePeerEndpointCi,'function');const {builder}=api.derivePeerEndpointCi(inputs);
 for(const text of ['peer-endpoints.inc','endpointSource','siren_terminal_creator_peer.node','receipt.nativePeerObservation','manifestBytes','runtimeBytes','recheckTerminalCandidateGraph','PRESERVED_ORIGINAL_CHANGED','RUNNER_INPUT_IDENTITY_CHANGED','COMPILER_HEADER_TRACKING_MISSING','requireCandidateCi({platform:process.platform'])assert.ok(builder.includes(text),text);
 assert.doesNotMatch(builder,/native\/terminal-creator-async\/ownership\.cc/);
});
test('new peer workflow is isolated and always preserves raw failures and include bytes',async()=>{
 assert.equal(typeof api.derivePeerEndpointCi,'function');const {workflow}=api.derivePeerEndpointCi(inputs);
 const paths=[...workflow.matchAll(/^      - '([^']+)'$/gm)].map(m=>m[1]);assert.deepEqual(paths,PUBLICATION_INPUTS);
 requireWorkflowIsolation({candidate:workflow,historical:await read('../../.github/workflows/terminal-prerequisite.yml'),previous:await read('../../.github/workflows/terminal-normal-powershell.yml')});
 assert.ok(workflow.includes("if: github.ref == 'refs/heads/"+CANDIDATE_BRANCH+"'"));
 assert.match(workflow,/if: always\(\)/);assert.match(workflow,/candidate\/peer-endpoints\.inc/);
 assert.match(workflow,/timeout-minutes: 12/);
});
