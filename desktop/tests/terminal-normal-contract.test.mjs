// Pure receipt validator tests. Every observation here is explicitly synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as contract from './native/terminal-normal-powershell-contract.mjs';
import {syntheticNormalObservation,fixtureKind} from './native/terminal-normal-contract-fixture.mjs';
const validate=input=>{assert.equal(typeof contract.validateCandidateObservation,'function');return contract.validateCandidateObservation(input);};
test('synthetic owner receipt validates only the bounded normal-shell claim',()=>{
 assert.equal(fixtureKind,'SYNTHETIC_NORMAL_CONTRACT_NOT_NATIVE_EVIDENCE');const input=syntheticNormalObservation(),r=validate(input);assert.equal(r.loadedAddon.path,input.addon.path);assert.deepEqual(r.loadedRuntime,input.result.native.runtime);assert.equal(r.normalShell.admitted,false);assert.equal(r.normalShell.logicalRequiredMembers,2);assert.equal(r.normalShell.sessionHeldMembers,3);assert.equal(r.normalShell.safetyHeldMembers,6);
});
test('synthetic receipts cannot omit, duplicate, replace or revive held identities',()=>{
 const mutations=[r=>r.native.before.held.pop(),r=>r.native.before.held.push(r.native.before.held[0]),r=>r.native.hostBefore.held.pop(),r=>r.native.stopped.snapshot.held[0].alive=true,r=>r.native.stopped.snapshot.held[0].exitCode=98,r=>r.native.hostAfter.active=1,r=>r.observer.after.pop(),r=>r.observer.before.push(r.observer.before[0]),r=>r.observer.after[0].alive=true,r=>r.observer.after[0].exitCode=98,r=>r.observer.after[2].createdFileTime='133000000000009999',r=>r.observer.before[1].image='C:\\foreign.exe',r=>r.native.before.shell.createdFileTime='133000000000008888',r=>r.native.ready.rootPid=999];
 for(const mutate of mutations){const input=syntheticNormalObservation();mutate(input.result);assert.throws(()=>validate(input));}
});
test('synthetic command echo, missing Lock, premature completion and stale history are refused',()=>{
 const mutations=[r=>r.native.completion.inputWrites=0,r=>r.native.completion.inputWrites=2,r=>r.native.completion.writeKnown=false,r=>r.native.completion.refusedInput=1,r=>r.native.completion.beginMs=null,r=>r.native.completion.lockMs=99,r=>r.native.completion.doneMs=150,r=>r.native.ready.initial.inputWrites=1,r=>r.native.openAck.hostAcknowledged=false,r=>r.native.lockAck.hostAcknowledged=false,r=>r.native.lockAck.localInputFenced=false,r=>r.native.lockAck.generation=1,r=>r.native.replayInputFence.closed=false,r=>r.native.replayInputFence.generation=3,r=>r.native.oldViewRefused=false,r=>r.native.lockedStats.attachments=1,r=>r.native.lockedStats.reservedUtf8Bytes=32768,r=>r.native.lockedStats.retainedUtf8Bytes=900,r=>r.native.historyReplay.begin=false,r=>r.native.historyReplay.done=false,r=>r.native.historyReplay.frames=0,r=>r.native.historyReplay.bytes=1];
 for(const mutate of mutations){const input=syntheticNormalObservation();mutate(input.result);assert.throws(()=>validate(input));}
});
test('synthetic ring, runtime, provenance and cleanup claims fail closed',()=>{
 const mutations=[r=>r.admitted=true,r=>r.qualified=false,r=>r.inputsUnchanged=false,r=>r.compileOnly=true,r=>r.deadlineExceeded=true,r=>r.native.runtime.modules='148',r=>r.native.ready.nodePty='1.0.0',r=>r.native.ready.osConpty=false,r=>r.native.ready.useConptyDll=true,r=>r.native.ready.environmentKeys.push('OPENAI_API_KEY'),r=>r.native.completion.history.allocatedBytes=4194305,r=>r.native.completion.history.retainedUtf8Bytes=0,r=>r.native.completion.history.droppedUtf8Bytes=1,r=>r.native.completion.parserCharacters=1025,r=>r.native.asyncRetirement.elapsedMs=3000,r=>r.native.asyncRetirement.maxGapMs=250,r=>{r.native.asyncRetirement.elapsedMs=100;r.native.asyncRetirement.ticks=0;},r=>r.native.stopped.closed=false,r=>r.native.hostClosed=false,r=>r.observer.cleanupVerified=false,r=>r.observer.safetyHeldBeforeGo=false,r=>r.observer.ageMs=25000,r=>r.inputs[0].sha256='c'.repeat(64),r=>r.inputs.push(r.inputs[0])];
 for(const mutate of mutations){const input=syntheticNormalObservation();mutate(input.result);assert.throws(()=>validate(input));}
});
test('exact native source and Windows-only isolated branch remain pinned',async()=>{
 const good={platform:'win32',arch:'x64',node:'v24.16.0',env:{GITHUB_ACTIONS:'true',RUNNER_OS:'Windows',GITHUB_REF:'refs/heads/'+contract.CANDIDATE_BRANCH}};contract.requireCandidateCi(good);
 for(const ref of ['main','probe/terminal-bootstrap-async-2026-10-08'])assert.throws(()=>contract.requireCandidateCi({...good,env:{...good.env,GITHUB_REF:'refs/heads/'+ref}}));assert.throws(()=>contract.requireCandidateCi({...good,platform:'linux'}));
 const source=await readFile(new URL('../native/terminal-creator-async/ownership.cc',import.meta.url)),binding=await readFile(new URL('../native/terminal-creator-async/binding.gyp',import.meta.url));assert.equal(contract.validateOwnershipCandidate({source,binding}).target,'siren_terminal_creator_async');assert.throws(()=>contract.validateOwnershipCandidate({source:Buffer.concat([source,Buffer.from('x')]),binding}));
 contract.validatePublicationInputs([...contract.PUBLICATION_INPUTS]);assert.throws(()=>contract.validatePublicationInputs([...contract.PUBLICATION_INPUTS,contract.PUBLICATION_INPUTS[0]]));assert.throws(()=>contract.validatePublicationInputs(contract.PUBLICATION_INPUTS.slice(1)));
});
