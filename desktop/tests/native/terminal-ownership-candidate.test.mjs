// Pure source/contract checks only: never import the builder or native entrypoints.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {control} from './terminal-session-composition-test-fixture.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const read=path=>readFile(resolve(root,path),'utf8');
async function contract(){
 const text=await read('desktop/tests/native/terminal-ownership-candidate-contract.mjs').catch(()=>null);
 assert.ok(text,'dedicated candidate validation/publication contract is missing');
 return import('./terminal-ownership-candidate-contract.mjs');
}
const addon={path:'C:\\fixed\\siren_terminal_ownership.node',bytes:4096,sha256:'a'.repeat(64)};
const electron={path:'C:\\fixed\\electron.exe',bytes:8192,sha256:'b'.repeat(64)};
function observed(){
 const native=control();
 native.hostLoss.root.image=electron.path;native.hostLoss.held[0].image=electron.path;
 const main={pid:999,image:electron.path,createdFileTime:'133000000000000000',alive:true,exitCode:259};
 const host={...native.hostLoss.root,alive:true,exitCode:259};
 return {admitted:false,negative:false,compileOnly:false,inputsUnchanged:true,processStarted:true,outerExitObserved:true,outerExitCode:0,qualified:true,status:'SESSION_COMPOSITION_OBSERVED_NOT_ADMITTED',
  inputs:structuredClone([addon,electron]),native,observer:{admitted:false,status:'COMPOSITION_SAFETY_OBSERVED_NOT_ADMITTED',cleanupVerified:true,safetyOpenAtObservation:true,activeBeforeSafetyCleanup:0,main,
   firstHeld:structuredClone([main,host,...native.groups.slice(0,2).flatMap(g=>g.before.held)]),
   allHeldBeforeFinal:structuredClone([main,host,...native.cleanup.slice(0,2).flatMap(g=>g.snapshot.held),...native.groups.slice(2).flatMap(g=>g.before.held)]),
   after:structuredClone([{...main,alive:false,exitCode:0},native.hostLoss.root,...native.cleanup.flatMap(g=>g.snapshot.held)])}};
}
test('candidate validation refuses mutated bytes, extra targets, and fault defines',async()=>{
 const {validateOwnershipCandidate}=await contract();
 const source=await readFile(resolve(root,'desktop/native/terminal-ownership/ownership.cc'));
 const binding=await readFile(resolve(root,'desktop/native/terminal-ownership/binding.gyp'));
 const valid=validateOwnershipCandidate({source,binding});
 assert.equal(valid.sourceSha256,'f0557cefb26dc337f4acfbc2f8e3302822f2f3f2371a9842e6c9c8b5cf536d3c');
 assert.equal(valid.target,'siren_terminal_ownership');
 assert.throws(()=>validateOwnershipCandidate({source:Buffer.concat([source,Buffer.from('\n')]),binding}),/SOURCE_DRIFT/);
 const extra=JSON.parse(binding);extra.targets.push({...extra.targets[0],target_name:'negative'});
 assert.throws(()=>validateOwnershipCandidate({source,binding:Buffer.from(JSON.stringify(extra))}),/BINDING_DRIFT/);
 const fault=JSON.parse(binding);fault.targets[0].defines.push('SIREN_TEST_DISABLE_SESSION_ROOT_MONITOR=1');
 assert.throws(()=>validateOwnershipCandidate({source,binding:Buffer.from(JSON.stringify(fault))}),/BINDING_DRIFT/);
});
test('execution admission refuses local, wrong platform, arch, Node, and branch',async()=>{
 const {requireCandidateCi}=await contract();
 const valid={platform:'win32',arch:'x64',node:'v24.16.0',env:{GITHUB_ACTIONS:'true',RUNNER_OS:'Windows',GITHUB_REF:'refs/heads/probe/terminal-ownership-candidate-2026-10-08'}};
 assert.doesNotThrow(()=>requireCandidateCi(valid));
 for(const value of [{...valid,platform:'linux'},{...valid,arch:'arm64'},{...valid,node:'v24.21.0'},{...valid,env:{}},{...valid,env:{...valid.env,GITHUB_REF:'refs/heads/main'}}])assert.throws(()=>requireCandidateCi(value),/CI_ONLY/);
});
test('publication closure rejects omitted, extra, duplicate and unresolved inputs',async()=>{
 const {PUBLICATION_INPUTS,DECLARED_DEPENDENCIES,validatePublicationInputs}=await contract();
 assert.equal(new Set(PUBLICATION_INPUTS).size,PUBLICATION_INPUTS.length);
 assert.doesNotThrow(()=>validatePublicationInputs(PUBLICATION_INPUTS));
 assert.throws(()=>validatePublicationInputs(PUBLICATION_INPUTS.slice(1)),/CLOSURE/);
 assert.throws(()=>validatePublicationInputs([...PUBLICATION_INPUTS,'desktop/src/main.mjs']),/CLOSURE/);
 assert.throws(()=>validatePublicationInputs([...PUBLICATION_INPUTS,PUBLICATION_INPUTS[0]]),/CLOSURE/);
 for(const [entry,dependencies] of Object.entries(DECLARED_DEPENDENCIES)){
  assert.ok(PUBLICATION_INPUTS.includes(entry),entry);
  for(const dependency of dependencies)assert.ok(PUBLICATION_INPUTS.includes(dependency),`${entry} -> ${dependency}`);
  if(!entry.endsWith('.mjs'))continue;
  const text=await read(entry);
  const refs=[...text.matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g)].map(m=>m[2]);
  for(const ref of refs){
   const path=resolve(root,dirname(entry),ref).slice(root.length).replaceAll('\\','/').replace(/^\//,'');
   assert.ok(dependencies.includes(path),`undeclared import ${entry} -> ${path}`);
  }
 }
 for(const entry of PUBLICATION_INPUTS)assert.ok((await readFile(resolve(root,entry))).length>0,entry);
});
test('push trigger isolation cannot be inferred from pull_request paths',async()=>{
 const {requireWorkflowIsolation}=await contract();
 const candidate=await read('.github/workflows/terminal-ownership-candidate.yml');
 const historical=await read('.github/workflows/terminal-prerequisite.yml');
 assert.doesNotThrow(()=>requireWorkflowIsolation({candidate,historical}));
 const historicalSameBranch=historical.replace("branches: ['probe/terminal-native-2026-10-08']","branches: ['probe/terminal-ownership-candidate-2026-10-08']");
 assert.throws(()=>requireWorkflowIsolation({candidate,historical:historicalSameBranch}),/HISTORICAL_PUSH/);
 assert.throws(()=>requireWorkflowIsolation({candidate:candidate.replace(/    paths:[\s\S]*?  workflow_dispatch:/,'  workflow_dispatch:'),historical}),/PUSH_PATHS/);
 assert.throws(()=>requireWorkflowIsolation({candidate:candidate.replace('probe/terminal-ownership-candidate-2026-10-08','main'),historical}),/BRANCH/);
});
test('dedicated builder copies exact checked-in bytes and invokes only the positive existing runner',async()=>{
 assert.equal((await contract()).CANDIDATE_SCOPE,'ACTUAL_CANDIDATE_COMPATIBILITY_NOT_ADMITTED');
 const builder=await read('desktop/tests/native/build-terminal-ownership-candidate.mjs');
 assert.match(builder,/requireCandidateCi\(/);
 assert.match(builder,/validateOwnershipCandidate\(/);
 assert.match(builder,/await writeFile\(destination,bytes,\{flag:'wx'\}\)/);
 assert.match(builder,/assert\.deepEqual\(await readFile\(destination\),bytes/);
 assert.match(builder,/siren_terminal_ownership\.vcxproj/);
 assert.match(builder,/composed-stop-root-utility-control/);
 assert.match(builder,/receipt.status=CANDIDATE_SCOPE/);
 assert.match(builder,/recheckTerminalCandidateGraph/);
 assert.match(builder,/loadedAddon/);
 assert.match(builder,/runtimeDistribution/);
 assert.doesNotMatch(builder,/--negative|SIREN_TEST_|replaceAll\(|deriveSessionComposition|build-terminal-composition-eight|60000.*stress/);
});
test('receipt validation refuses claimed success with wrong binary/runtime or incomplete observation',async()=>{
 const {validateCandidateObservation}=await contract();
 assert.equal(typeof validateCandidateObservation,'function','independent receipt validation missing');
 // The pre-existing inert fixture is synthetic test data, never hosted proof.
 const result=observed();
 assert.deepEqual(validateCandidateObservation({result,addon,electron}),{loadedAddon:addon,loadedRuntime:result.native.runtime});
 for(const mutate of [
  r=>{r.admitted=true;},r=>{r.negative=true;},r=>{r.compileOnly=true;},r=>{r.inputsUnchanged=false;},r=>{r.processStarted=false;},
  r=>{r.outerExitObserved=false;},r=>{r.outerExitCode=1;},r=>{r.deadlineExceeded=true;},r=>{r.outputTruncated=true;},
  r=>{r.inputs[0].path='C:\\other\\siren_terminal_ownership.node';},r=>{r.inputs[0].sha256='c'.repeat(64);},
  r=>{r.inputs.push(r.inputs[0]);},r=>{r.inputs[1].sha256='d'.repeat(64);},r=>{r.native.runtime.electron='44.5.0';},
  r=>{r.native.cleanup[0].closed=false;},r=>{r.observer.cleanupVerified=false;},r=>{r.observer.activeBeforeSafetyCleanup=1;},
 ]){const bad=structuredClone(result);mutate(bad);assert.throws(()=>validateCandidateObservation({result:bad,addon,electron}));}
});

test('positive candidate refuses negative native scope and error contradictions',async()=>{
 const {validateCandidateObservation:validate}=await contract();
 for(const mutate of [r=>{r.native=control(true);},r=>{r.status='FAILED';},r=>{r.native.status='FAILED';},r=>{r.error='failed';},r=>{r.observer.cleanupError='failed';},r=>{r.observer.admitted=true;}]){
  const result=observed();mutate(result);assert.throws(()=>validate({result,addon,electron}));
 }
});

test('Safety proof requires unique full identities, coverage, continuity and consistent final exits',async()=>{
 const {validateCandidateObservation:validate}=await contract();
 for(const mutate of [
  r=>{delete r.observer.main;},r=>{delete r.observer.firstHeld;},r=>{delete r.observer.allHeldBeforeFinal;},r=>{delete r.observer.after;},
  r=>{r.observer.main.alive=false;r.observer.main.exitCode=0;},r=>{r.observer.after[0].alive=true;r.observer.after[0].exitCode=259;},
  r=>{const pid=r.native.groups[2].before.shell.pid;for(const key of ['allHeldBeforeFinal','after'])r.observer[key]=r.observer[key].filter(p=>p.pid!==pid);},
  r=>{r.observer.firstHeld.splice(2,1);},r=>{r.observer.after.push(r.observer.after[0]);},
  r=>{r.observer.after[0].createdFileTime='133000000000000001';},r=>{r.observer.after[2].image='C:\\foreign.exe';},
  r=>{r.observer.after[2].exitCode=0;},r=>{r.observer.allHeldBeforeFinal[2].exitCode=0;},
  r=>{r.observer.firstHeld[0].pid=0;},r=>{r.observer.firstHeld[0].createdFileTime='-1';},
  r=>{const extra={pid:998,image:'C:\\foreign.exe',createdFileTime:'133000000000000001',alive:true,exitCode:259};r.observer.firstHeld.push(extra);r.observer.allHeldBeforeFinal.push(extra);r.observer.after.push({...extra,alive:false,exitCode:0});},
  r=>{const extra={pid:998,image:electron.path,createdFileTime:'132999999999999999',alive:true,exitCode:259};r.observer.firstHeld.push(extra);r.observer.allHeldBeforeFinal.push(extra);r.observer.after.push({...extra,alive:false,exitCode:0});},
  r=>{r.observer.after=Array.from({length:129},()=>r.observer.after[0]);},
 ]){const result=observed();mutate(result);assert.throws(()=>validate({result,addon,electron}));}
});

test('Safety retains newer Electron infrastructure and accepts members exiting after stage release',async()=>{
 const {validateCandidateObservation:validate}=await contract();
 const result=observed(),extra={pid:998,image:electron.path.toUpperCase(),createdFileTime:'133000000000000001',alive:true,exitCode:259};
 result.observer.firstHeld.push(structuredClone(extra));result.observer.allHeldBeforeFinal.push(structuredClone(extra));result.observer.after.push({...extra,alive:false,exitCode:0});
 result.observer.firstHeld[2]=structuredClone(result.observer.after[2]);
 result.observer.allHeldBeforeFinal[1]=structuredClone(result.observer.after[1]);
 assert.doesNotThrow(()=>validate({result,addon,electron}));
 for(const mutate of [r=>{r.observer.allHeldBeforeFinal.pop();r.observer.after.pop();},r=>{r.observer.after.pop();},r=>{r.observer.allHeldBeforeFinal.at(-1).image='C:\\foreign.exe';}]){
  const bad=structuredClone(result);mutate(bad);assert.throws(()=>validate({result:bad,addon,electron}));
 }
});
test('workflow bounds one native experiment and retains originals on failure',async()=>{
 await contract();
 const workflow=await read('.github/workflows/terminal-ownership-candidate.yml');
 assert.match(workflow,/runs-on: windows-2025/);
 assert.match(workflow,/node-version: '24\.16\.0'/);
 assert.match(workflow,/timeout-minutes: 12/);
 assert.match(workflow,/npm ci --ignore-scripts/);
 assert.match(workflow,/npm run runtime:install/);
 assert.match(workflow,/working-directory: desktop\/tests\/fixtures\/terminal-node-pty/);
 assert.equal((workflow.match(/node desktop\/tests\/native\/build-[^\s]+/g)??[]).length,1);
 assert.match(workflow,/if: always\(\)/);
 for(const path of ['desktop/evidence/terminal-ownership-candidate-build/','desktop/evidence/terminal-session-composition/','desktop/native/terminal-ownership/ownership.cc','desktop/native/terminal-ownership/binding.gyp','desktop/evidence/terminal-ownership-candidate-tool-discovery.json'])assert.ok(workflow.includes(path),path);
 assert.doesNotMatch(workflow,/npm (?:start|run (?:build|package|release))|build-terminal-session-composition\.mjs|build-terminal-composition-eight\.mjs/);
});
