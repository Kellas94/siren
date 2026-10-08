// Pure new-artifact CI source/receipt contract tests. Never import guarded runners.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const api=await import('./terminal-bootstrap-async-derive.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const contract=await import('./terminal-bootstrap-async-contract.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const inputs={builder:await read('./build-terminal-minimal-env.mjs'),runner:await read('./terminal-minimal-env.mjs'),workflow:await read('../../../.github/workflows/terminal-minimal-env.yml')};
test('new bootstrap async CI derives only exact preserved builder/runner/workflow inputs',async()=>{
 assert.equal(typeof api.deriveBootstrapAsyncCi,'function');const r=api.deriveBootstrapAsyncCi(inputs);assert.equal(r.nativeExecuted,false);assert.equal(r.admitted,false);
 for(const [key,path] of [['builder','./build-terminal-bootstrap-async.mjs'],['runner','./terminal-bootstrap-async.mjs'],['workflow','../../../.github/workflows/terminal-bootstrap-async.yml']])assert.equal(r[key],await read(path));
 assert.throws(()=>api.deriveBootstrapAsyncCi({...inputs,runner:inputs.runner+'\n'}),/BOOTSTRAP_CI_INPUT_DRIFT/);
});
test('new CI only admits its isolated Windows branch and exact new native source bytes',async()=>{
 assert.equal(typeof contract.requireCandidateCi,'function');const good={platform:'win32',arch:'x64',node:'v24.16.0',env:{GITHUB_ACTIONS:'true',RUNNER_OS:'Windows',GITHUB_REF:'refs/heads/probe/terminal-bootstrap-async-2026-10-08'}};contract.requireCandidateCi(good);
 for(const ref of ['main','probe/terminal-minimal-env-2026-10-08'])assert.throws(()=>contract.requireCandidateCi({...good,env:{...good.env,GITHUB_REF:'refs/heads/'+ref}}),/BOOTSTRAP_ASYNC_CI_ONLY/);
 const source=Buffer.from(await read('../../native/terminal-creator-async/ownership.cc')),binding=Buffer.from(await read('../../native/terminal-creator-async/binding.gyp'));assert.equal(contract.validateOwnershipCandidate({source,binding}).target,'siren_terminal_creator_async');assert.throws(()=>contract.validateOwnershipCandidate({source:Buffer.concat([source,Buffer.from('x')]),binding}));
});
test('CI uses actual stdin codec and pre-disposal async observation rather than synthetic exits',()=>{
 assert.equal(typeof api.deriveBootstrapAsyncCi,'function');const {runner}=api.deriveBootstrapAsyncCi(inputs);
 assert.match(runner,/readTerminalBootstrap\(process\.stdin/);assert.match(runner,/native\.createBootstrappedSession/);assert.match(runner,/await native\.stopAndCloseSessionAsync/);assert.match(runner,/result\.stoppedA=retired\.snapshot/);assert.doesNotMatch(runner,/result\.stoppedA=\{[^}]*alive:false/);
});
test('workflow source closure includes runtime imports and stays isolated from historical probes',()=>{
 assert.equal(typeof api.deriveBootstrapAsyncCi,'function');const {builder,workflow}=api.deriveBootstrapAsyncCi(inputs);
 assert.ok(contract.PUBLICATION_INPUTS.includes('desktop/src/terminal/bootstrap-reader.mjs'));assert.ok(contract.PUBLICATION_INPUTS.includes('desktop/src/terminal/bootstrap-codec.mjs'));
 assert.match(builder,/native\/terminal-creator-async\/ownership\.cc/);assert.match(builder,/siren_terminal_creator_async\.node/);
 contract.requireWorkflowIsolation({candidate:workflow,historical:inputs.workflow,previous:inputs.workflow});
});
test('bootstrap receipt requires four distinct deliveries, actual EOF and exact owner identity',()=>{
 assert.equal(typeof contract.validateBootstrapProofs,'function');
 // Synthetic validator fixture only; never presented as native observation.
 const native={rejectedBootstrapPackets:['empty','oversized','magic'],groups:['A','B','C','D'].map((label,i)=>{const expected={sessionId:'probe-'+label.toLowerCase(),channelId:'bootstrap-'+label.toLowerCase(),controlPipe:'\\\\.\\pipe\\siren-terminal-control-'+String(i*2+1).repeat(32),dataPipe:'\\\\.\\pipe\\siren-terminal-data-'+String(i*2+2).repeat(32),controlSha256:String(i*2+1).repeat(64),dataSha256:String(i*2+2).repeat(64)};return {label,before:{root:{pid:i+1}},bootstrap:{expected,observed:{...expected,pid:i+1,stdinClosed:true}}};}),asyncRetirement:{closed:true,elapsedMs:20,ticks:2,maxGapMs:10}};
 assert.equal(contract.validateBootstrapProofs(native).creators,4);
 const mutations=[n=>n.groups.splice(0),n=>n.groups[0].bootstrap.observed.stdinClosed=false,n=>n.groups[0].bootstrap.observed.pid=999,n=>n.groups[0].bootstrap.observed.rawSecret='forbidden',n=>{n.groups[1].bootstrap.expected.controlPipe=n.groups[0].bootstrap.expected.controlPipe;n.groups[1].bootstrap.observed.controlPipe=n.groups[0].bootstrap.expected.controlPipe;},n=>n.asyncRetirement.closed=false,n=>n.asyncRetirement.maxGapMs=500];
 for(const mutate of mutations){const copy=structuredClone(native);mutate(copy);assert.throws(()=>contract.validateBootstrapProofs(copy));}
});
