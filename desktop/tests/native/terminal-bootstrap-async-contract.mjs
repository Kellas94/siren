// Pure source/receipt checks, never native execution or product admission.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {PUBLICATION_INPUTS as previousInputs,validateCandidateObservation as previousObservation} from './terminal-minimal-env-contract.mjs';
export const CANDIDATE_BRANCH='probe/terminal-bootstrap-async-2026-10-08';
export const CANDIDATE_SCOPE='ACTUAL_BOOTSTRAP_ASYNC_FINITE_COMPATIBILITY_NOT_ADMITTED';
export const PUBLICATION_INPUTS=Object.freeze([...previousInputs,
 '.github/workflows/terminal-bootstrap-async.yml',
 'desktop/native/terminal-creator-bootstrap/ownership.cc','desktop/native/terminal-creator-bootstrap/binding.gyp',
 'desktop/native/terminal-creator-async/ownership.cc','desktop/native/terminal-creator-async/binding.gyp',
 'desktop/src/terminal/bootstrap-codec.mjs','desktop/src/terminal/bootstrap-reader.mjs','desktop/src/terminal/creator-bootstrap-source.mjs','desktop/src/terminal/async-cleanup-source.mjs','desktop/src/terminal/creator-environment-source.mjs',
 'desktop/tests/terminal-bootstrap-codec.test.mjs','desktop/tests/terminal-bootstrap-reader.test.mjs','desktop/tests/terminal-creator-bootstrap-source.test.mjs','desktop/tests/terminal-async-cleanup-source.test.mjs','desktop/tests/terminal-bootstrap-review-regressions.test.mjs',
 'desktop/tests/native/build-terminal-bootstrap-async.mjs','desktop/tests/native/terminal-bootstrap-async.mjs','desktop/tests/native/terminal-bootstrap-async-contract.mjs','desktop/tests/native/terminal-bootstrap-async-derive.mjs','desktop/tests/native/terminal-bootstrap-async.test.mjs',
]);
const digest=b=>createHash('sha256').update(b).digest('hex');
export function validatePublicationInputs(rows){assert.ok(Array.isArray(rows)&&new Set(rows).size===rows.length,'BOOTSTRAP_PUBLICATION_DUPLICATE');assert.deepEqual([...rows].sort(),[...PUBLICATION_INPUTS].sort(),'BOOTSTRAP_PUBLICATION_CLOSURE');}
export function requireCandidateCi({platform,arch,node,env}){assert.ok(platform==='win32'&&arch==='x64'&&node==='v24.16.0'&&env?.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Windows'&&env.GITHUB_REF==='refs/heads/'+CANDIDATE_BRANCH,'BOOTSTRAP_ASYNC_CI_ONLY');}
export function validateOwnershipCandidate({source,binding}){
 assert.ok(Buffer.isBuffer(source)&&Buffer.isBuffer(binding));assert.equal(digest(source),'69b6780f6edf1fa838f97fbf0835a819d9433d01dbf6a4460f8294336c090659','BOOTSTRAP_SOURCE_DRIFT');assert.equal(digest(binding),'8d2847b9e34fa5466d16a2f53e94c795ab7f745d49967752e39789072eee4751','BOOTSTRAP_BINDING_DRIFT');return {sourceSha256:digest(source),bindingSha256:digest(binding),target:'siren_terminal_creator_async'};
}
function branch(text){return /^    branches: \['([^']+)'\]$/m.exec(text)?.[1];}
export function requireWorkflowIsolation({candidate,historical,previous}){
 assert.equal(branch(candidate),CANDIDATE_BRANCH,'BOOTSTRAP_WORKFLOW_BRANCH');const paths=[...candidate.matchAll(/^      - '([^']+)'$/gm)].map(m=>m[1]);validatePublicationInputs(paths);
 for(const old of [historical,previous]){const b=branch(old);assert.ok(b&&!/[*?!\[\]{}]/.test(b));assert.notEqual(b,CANDIDATE_BRANCH,'BOOTSTRAP_WORKFLOW_COLLISION');}
}
export function validateBootstrapProofs(native){
 assert.deepEqual(native.rejectedBootstrapPackets,['empty','oversized','magic'],'BOOTSTRAP_NEGATIVE_SCOPE');
 assert.ok(Array.isArray(native.groups)&&native.groups.length===4,'BOOTSTRAP_GROUP_COUNT');assert.deepEqual(native.groups.map(g=>g.label),['A','B','C','D']);
 const names=new Set(),keys=new Set();
 for(const g of native.groups){
  const proof=g.bootstrap;assert.ok(proof&&proof.expected&&proof.observed,'BOOTSTRAP_PROOF_MISSING');
  const {expected,observed}=proof;assert.deepEqual(Object.keys(expected).sort(),['channelId','controlPipe','controlSha256','dataPipe','dataSha256','sessionId']);
  assert.deepEqual(Object.keys(observed).sort(),['channelId','controlPipe','controlSha256','dataPipe','dataSha256','pid','sessionId','stdinClosed']);
  assert.equal(expected.sessionId,'probe-'+g.label.toLowerCase());assert.equal(expected.channelId,'bootstrap-'+g.label.toLowerCase());
  for(const k of ['controlSha256','dataSha256'])assert.match(expected[k],/^[a-f0-9]{64}$/);assert.notEqual(expected.controlSha256,expected.dataSha256);
  assert.match(expected.controlPipe,/^\\\\\.\\pipe\\siren-terminal-control-[a-f0-9]{32}$/);assert.match(expected.dataPipe,/^\\\\\.\\pipe\\siren-terminal-data-[a-f0-9]{32}$/);
  for(const k of ['controlPipe','dataPipe']){assert.ok(!names.has(expected[k]),'BOOTSTRAP_REUSED_PIPE');names.add(expected[k]);}
  for(const k of ['controlSha256','dataSha256']){assert.ok(!keys.has(expected[k]),'BOOTSTRAP_REUSED_KEY');keys.add(expected[k]);}
  for(const k of Object.keys(expected))assert.equal(observed[k],expected[k],'BOOTSTRAP_DELIVERY_'+k);assert.equal(observed.stdinClosed,true);assert.equal(observed.pid,g.before.root.pid);
 }
 const a=native.asyncRetirement;assert.ok(a&&a.closed===true&&Number.isFinite(a.elapsedMs)&&a.elapsedMs>=0&&a.elapsedMs<3000);assert.ok(Number.isInteger(a.ticks)&&a.ticks>=0&&Number.isFinite(a.maxGapMs)&&a.maxGapMs>=0&&a.maxGapMs<250);
 assert.ok(a.elapsedMs<50||a.ticks>0,'ASYNC_STOP_MAIN_LOOP_BLOCKED');
 return {creators:4,negativePackets:3,asyncClosed:true,elapsedMs:a.elapsedMs,ticks:a.ticks,maxGapMs:a.maxGapMs};
}
export function validateCandidateObservation(input){const checked=previousObservation(input);return {...checked,bootstrapAsync:validateBootstrapProofs(input.result.native)};}
