// Pure source derivation checks only. Never import or execute guarded builders.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const api=await import('./native/terminal-normal-powershell-derive.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const inputs={builder:await read('./native/build-terminal-bootstrap-async.mjs'),workflow:await read('../../.github/workflows/terminal-bootstrap-async.yml')};

test('normal shell source preparation derives deterministic bytes from pinned preserved inputs',async()=>{
 assert.equal(typeof api.deriveNormalPowerShellCi,'function');
 const result=api.deriveNormalPowerShellCi(inputs);
 assert.equal(result.nativeExecuted,false);assert.equal(result.admitted,false);
 assert.equal(result.builder,await read('./native/build-terminal-normal-powershell.mjs'));
 assert.equal(result.workflow,await read('../../.github/workflows/terminal-normal-powershell.yml'));
 for(const key of ['builder','workflow'])assert.throws(()=>api.deriveNormalPowerShellCi({...inputs,[key]:inputs[key]+'\n'}),/NORMAL_CI_INPUT_DRIFT/);
});

test('normal experiment keeps actual native target and all final source runtime input graph rechecks',()=>{
 assert.equal(typeof api.deriveNormalPowerShellCi,'function');const {builder}=api.deriveNormalPowerShellCi(inputs);
 assert.match(builder,/requireCandidateCi\(\{platform:process\.platform/);
 assert.match(builder,/native\/terminal-creator-async\/ownership\.cc/);assert.match(builder,/siren_terminal_creator_async\.node/);
 assert.match(builder,/phase\('normal-powershell-control-history'/);
 assert.match(builder,/receipt\.normalShellObservation=validateCandidateObservation\(\{result,addon:binary,electron\}\)\.normalShell/);
 assert.doesNotMatch(builder,/creatorEnvironmentObservation|bootstrapAsyncObservation|normalTwoMemberObservation/);
 for(const text of ['for(const artifact of recorded.values())','PRESERVED_ORIGINAL_CHANGED','RUNNER_INPUT_IDENTITY_CHANGED','RUNNER_INPUT_SIZE_CHANGED','recheckTerminalCandidateGraph','NODE_HEADER_LINEAGE_MISSING','WINDOWS_HEADER_LINEAGE_MISSING','COMPILER_HEADER_TRACKING_MISSING'])assert.ok(builder.includes(text),text);
});

test('normal workflow has exact closure one isolated branch and finite always-retained evidence',async()=>{
 assert.equal(typeof api.deriveNormalPowerShellCi,'function');const {workflow}=api.deriveNormalPowerShellCi(inputs);
 const contract=await import('./native/terminal-normal-powershell-contract.mjs');
 const paths=[...workflow.matchAll(/^      - '([^']+)'$/gm)].map(m=>m[1]);contract.validatePublicationInputs(paths);
 assert.equal(new Set(paths).size,paths.length);assert.match(workflow,/branches: \['probe\/terminal-normal-powershell-2026-10-08'\]/);
 assert.match(workflow,/if: github\.ref == 'refs\/heads\/probe\/terminal-normal-powershell-2026-10-08'/);
 assert.match(workflow,/timeout-minutes: 12/);assert.match(workflow,/if: always\(\)/);assert.match(workflow,/normal-observer\.exe/);
 assert.doesNotMatch(workflow,/fixed-composition-child\.exe|composition-observer\.exe/);
 for(const p of ['desktop/tests/terminal-normal-builder.test.mjs','desktop/tests/terminal-normal-contract.test.mjs','desktop/tests/terminal-normal-probe.test.mjs','desktop/src/terminal/history-channel.mjs','desktop/src/terminal/remote-output.mjs'])assert.ok(paths.includes(p),p);
});
