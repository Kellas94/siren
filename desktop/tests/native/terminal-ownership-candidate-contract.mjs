// Pure validation/publication contract. Never imports builders or native code.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isSessionCompositionObserved} from './terminal-session-composition-verdict.mjs';
export const CANDIDATE_BRANCH='probe/terminal-ownership-candidate-2026-10-08';
export const CANDIDATE_SCOPE='ACTUAL_CANDIDATE_COMPATIBILITY_NOT_ADMITTED';
export const PUBLICATION_INPUTS=Object.freeze([
 '.github/workflows/terminal-ownership-candidate.yml',
 '.github/workflows/terminal-prerequisite.yml',
 'desktop/package.json','desktop/package-lock.json',
 'desktop/native/terminal-ownership/ownership.cc',
 'desktop/native/terminal-ownership/binding.gyp',
 'desktop/tests/native/build-terminal-ownership-candidate.mjs',
 'desktop/tests/native/terminal-ownership-candidate-contract.mjs',
 'desktop/tests/native/terminal-ownership-candidate.test.mjs',
 'desktop/tests/native/terminal-session-composition.mjs',
 'desktop/tests/native/terminal-session-composition-derive.mjs',
 'desktop/tests/native/terminal-session-composition-verdict.mjs',
 'desktop/tests/native/terminal-session-composition-test-fixture.mjs',
 'desktop/tests/native/terminal-conpty-platform.mjs',
 'desktop/tests/native/terminal-electron-broker-worker.mjs',
 'desktop/tests/native/terminal-candidate-graph.mjs',
 'desktop/tests/fixtures/terminal-host-guard/host.cc',
 'desktop/tests/fixtures/terminal-session-composition.inc',
 'desktop/tests/fixtures/terminal-job-list.cs',
 'desktop/tests/fixtures/terminal-main-owner-observer.cs',
 'desktop/tests/fixtures/terminal-session-composition-observer.cs',
 'desktop/tests/fixtures/terminal-node-pty/package.json',
 'desktop/tests/fixtures/terminal-node-pty/package-lock.json',
]);
const at=name=>'desktop/tests/native/'+name;
export const DECLARED_DEPENDENCIES=Object.freeze({
 [at('build-terminal-ownership-candidate.mjs')]:PUBLICATION_INPUTS.filter(p=>p!==at('build-terminal-ownership-candidate.mjs')),
 [at('terminal-ownership-candidate-contract.mjs')]:[at('terminal-session-composition-verdict.mjs')],
 [at('terminal-ownership-candidate.test.mjs')]:[at('terminal-ownership-candidate-contract.mjs'),at('terminal-session-composition-test-fixture.mjs')],
 [at('terminal-session-composition-test-fixture.mjs')]:[],
 [at('terminal-session-composition.mjs')]:[
  at('terminal-session-composition-derive.mjs'),at('terminal-session-composition-verdict.mjs'),at('terminal-conpty-platform.mjs'),at('terminal-electron-broker-worker.mjs'),
  'desktop/tests/fixtures/terminal-host-guard/host.cc','desktop/tests/fixtures/terminal-session-composition.inc','desktop/tests/fixtures/terminal-job-list.cs',
  'desktop/tests/fixtures/terminal-main-owner-observer.cs','desktop/tests/fixtures/terminal-session-composition-observer.cs',
  'desktop/tests/fixtures/terminal-node-pty/package.json','desktop/tests/fixtures/terminal-node-pty/package-lock.json',
 ],
 [at('terminal-session-composition-derive.mjs')]:[],
 [at('terminal-session-composition-verdict.mjs')]:[at('terminal-conpty-platform.mjs')],
 [at('terminal-conpty-platform.mjs')]:[],
 [at('terminal-electron-broker-worker.mjs')]:[at('terminal-conpty-platform.mjs')],
 [at('terminal-candidate-graph.mjs')]:['desktop/tests/fixtures/terminal-node-pty/package.json','desktop/tests/fixtures/terminal-node-pty/package-lock.json'],
 'desktop/native/terminal-ownership/binding.gyp':['desktop/native/terminal-ownership/ownership.cc'],
});
export function validatePublicationInputs(paths){
 assert.ok(Array.isArray(paths)&&new Set(paths).size===paths.length,'PUBLICATION_CLOSURE_DUPLICATE');
 assert.deepEqual([...paths].sort(),[...PUBLICATION_INPUTS].sort(),'PUBLICATION_CLOSURE_MISMATCH');
}
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateOwnershipCandidate({source,binding}){
 assert.ok(Buffer.isBuffer(source)&&Buffer.isBuffer(binding),'CANDIDATE_BYTES_REQUIRED');
 assert.equal(hash(source),'f0557cefb26dc337f4acfbc2f8e3302822f2f3f2371a9842e6c9c8b5cf536d3c','CANDIDATE_SOURCE_DRIFT');
 assert.equal(hash(binding),'559f2a28158cc4695324494e526114627696589c6f91514687d8f9138bc95ce0','CANDIDATE_BINDING_DRIFT');
 assert.deepEqual(JSON.parse(binding),{targets:[{target_name:'siren_terminal_ownership',sources:['ownership.cc'],defines:['NAPI_VERSION=10','_WIN32_WINNT=0x0A00','WIN32_LEAN_AND_MEAN','NOMINMAX'],win_delay_load_hook:'true',libraries:['kernel32.lib'],msvs_settings:{VCCLCompilerTool:{AdditionalOptions:['/std:c++20']}}}]},'CANDIDATE_BINDING_SHAPE');
 return {sourceSha256:hash(source),bindingSha256:hash(binding),target:'siren_terminal_ownership'};
}
export function requireCandidateCi({platform,arch,node,env}){
 assert.ok(platform==='win32'&&arch==='x64'&&node==='v24.16.0'&&env?.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Windows'&&env.GITHUB_REF==='refs/heads/'+CANDIDATE_BRANCH,'CANDIDATE_CI_ONLY');
}
function validateSafety(result,electron){
 const fail=message=>'CANDIDATE_SAFETY_'+message;
 const identity=p=>{
  assert.ok(p&&Number.isInteger(p.pid)&&p.pid>0&&p.pid<=0xffffffff,fail('PID'));
  assert.ok(typeof p.image==='string'&&p.image.length>0&&p.image.length<=32768&&!p.image.includes('\0'),fail('IMAGE'));
  assert.ok(typeof p.createdFileTime==='string'&&/^[1-9][0-9]{0,19}$/.test(p.createdFileTime)&&BigInt(p.createdFileTime)<=0xffffffffffffffffn,fail('BIRTH'));
  assert.ok(typeof p.alive==='boolean'&&Number.isInteger(p.exitCode)&&p.exitCode>=0&&p.exitCode<=0xffffffff,fail('STATE'));
  if(p.alive)assert.equal(p.exitCode,259,fail('LIVE_EXIT'));
  return p;
 };
 const same=(a,b)=>a.pid===b.pid&&a.image.toLowerCase()===b.image.toLowerCase()&&a.createdFileTime===b.createdFileTime;
 const set=(rows,max)=>{
  assert.ok(Array.isArray(rows)&&rows.length>0&&rows.length<=max,fail('BOUNDS'));
  const map=new Map();for(const p of rows){identity(p);assert.ok(!map.has(p.pid),fail('DUPLICATE'));map.set(p.pid,p);}return map;
 };
 const observer=result.observer,main=identity(observer.main),host=identity(result.native.hostLoss.root);
 assert.equal(main.alive,true,fail('INITIAL_MAIN'));
 assert.equal(main.image.toLowerCase(),electron.path.toLowerCase(),fail('MAIN_IMAGE'));
 assert.equal(host.image.toLowerCase(),electron.path.toLowerCase(),fail('HOST_IMAGE'));
 const final=set([{...main,alive:false,exitCode:0},host,...result.native.cleanup.flatMap(g=>g.snapshot.held)],128);
 const requiredFirst=set([main,host,...result.native.groups.slice(0,2).flatMap(g=>g.before.held)],64);
 const first=set(observer.firstHeld,64),all=set(observer.allHeldBeforeFinal,128),after=set(observer.after,128);
 const coverage=(required,actual)=>{for(const [pid,p] of required)assert.ok(actual.has(pid)&&same(p,actual.get(pid)),fail('COVERAGE'));};
 coverage(requiredFirst,first);coverage(final,all);coverage(first,all);coverage(all,after);
 assert.equal(after.size,all.size,fail('FINAL_COUNT'));
 for(const [pid,p] of first){
  if(requiredFirst.has(pid))continue;
  assert.ok(!final.has(pid),fail('EARLY_SESSION'));
  assert.equal(p.image.toLowerCase(),electron.path.toLowerCase(),fail('FOREIGN_FIRST'));
 }
 for(const [pid,p] of all){
  assert.ok(BigInt(p.createdFileTime)>=BigInt(main.createdFileTime),fail('OLDER_PROCESS'));
  if(!final.has(pid))assert.equal(p.image.toLowerCase(),electron.path.toLowerCase(),fail('FOREIGN'));
  const end=after.get(pid);assert.equal(end.alive,false,fail('FINAL_LIVE'));
  if(final.has(pid)){assert.ok(same(p,final.get(pid)),fail('NATIVE_IDENTITY'));assert.equal(end.exitCode,final.get(pid).exitCode,fail('NATIVE_EXIT'));}
  for(const previous of [first.get(pid),p])if(previous&&!previous.alive){assert.equal(end.exitCode,previous.exitCode,fail('EXIT_CHANGED'));if(previous===first.get(pid))assert.equal(p.alive,false,fail('REVIVED'));}
 }
}
export function validateCandidateObservation({result,addon,electron}){
 assert.equal(result.admitted,false,'CANDIDATE_ADMISSION_REFUSED');
 assert.equal(result.negative,false);assert.equal(result.compileOnly,false);assert.equal(result.inputsUnchanged,true);
 assert.equal(result.processStarted,true);assert.equal(result.outerExitObserved,true);assert.equal(result.outerExitCode,0);assert.equal(result.qualified,true);
 assert.equal(result.deadlineExceeded,undefined);assert.equal(result.outputTruncated,undefined);
 assert.equal(result.status,'SESSION_COMPOSITION_OBSERVED_NOT_ADMITTED');
 assert.equal(result.native?.negative,false,'CANDIDATE_POSITIVE_NATIVE_REQUIRED');
 assert.equal(result.native.status,result.status);
 for(const scope of [result,result.native,result.observer]){
  assert.ok(scope);assert.equal(scope.error,undefined,'CANDIDATE_ERROR');assert.equal(scope.cleanupError,undefined,'CANDIDATE_CLEANUP_ERROR');
 }
 assert.equal(result.observer.admitted,false);
 assert.equal(result.observer?.status,'COMPOSITION_SAFETY_OBSERVED_NOT_ADMITTED');
 assert.equal(result.observer.cleanupVerified,true);assert.equal(result.observer.safetyOpenAtObservation,true);assert.equal(result.observer.activeBeforeSafetyCleanup,0);
 assert.equal(isSessionCompositionObserved(result.native),true,'CANDIDATE_NATIVE_OBSERVATION_INCOMPLETE');
 validateSafety(result,electron);
 assert.ok(Array.isArray(result.inputs));
 const match=expected=>{
  const found=result.inputs.filter(row=>row.path===expected.path);assert.equal(found.length,1,'LOADED_INPUT_IDENTITY_COUNT');
  assert.equal(found[0].sha256,expected.sha256,'LOADED_INPUT_IDENTITY_CHANGED');assert.equal(found[0].bytes,expected.bytes,'LOADED_INPUT_SIZE_CHANGED');return found[0];
 };
 const loadedAddon=match(addon);match(electron);
 return {loadedAddon,loadedRuntime:result.native.runtime};
}
// Parse only the explicit workflow subset used here. Unknown branch declarations
// fail closed. In particular pull_request.paths cannot constrain push events.
function event(text,name){return new RegExp('^  '+name+':[^\\n]*\\n((?:^    .*\\n|^\\n)*)','m').exec(text)?.[1]??'';}
function branches(block){
 const match=/^    branches: \[([^\]]*)\]\r?$/m.exec(block);
 assert.ok(match,'WORKFLOW_BRANCH_DECLARATION_REFUSED');
 const values=[...match[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert.ok(values.length>0&&values.map(v=>"'"+v+"'").join(', ')===match[1],'WORKFLOW_BRANCH_DECLARATION_REFUSED');
 return values;
}
export function requireWorkflowIsolation({candidate,historical}){
 const push=event(candidate,'push');
 assert.deepEqual(branches(push),[CANDIDATE_BRANCH],'CANDIDATE_BRANCH_REFUSED');
 const paths=/^    paths:\r?\n((?:^      - '[^']+'\r?\n)+)/m.exec(push);
 assert.ok(paths,'CANDIDATE_PUSH_PATHS_REQUIRED');
 const listed=[...paths[1].matchAll(/^      - '([^']+)'/gm)].map(m=>m[1]);
 validatePublicationInputs(listed);
 const oldPush=event(historical,'push');
 if(/^  push:/m.test(historical)){
  const patterns=branches(oldPush);
  for(const pattern of patterns){
   assert.ok(!/[*?!\[\]{}]/.test(pattern),'HISTORICAL_PUSH_PATTERN_REFUSED');
   assert.notEqual(pattern,CANDIDATE_BRANCH,'HISTORICAL_PUSH_COLLISION');
  }
 }
 return {isolated:true,branch:CANDIDATE_BRANCH,paths:listed};
}
