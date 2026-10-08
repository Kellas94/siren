// Pure CI source/receipt tests: never import a guarded builder or runner.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../../../',import.meta.url),read=p=>readFile(new URL(p,root),'utf8');
const contract=await import('./terminal-minimal-env-contract.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const derive=await import('./terminal-minimal-env-derive.mjs').catch(e=>{if(e.code!=='ERR_MODULE_NOT_FOUND')throw e;return {};});
const historicalSource=await read('desktop/native/terminal-ownership/ownership.cc');
test('new variant CI refuses local runtime, wrong branch and the historical artifact',async()=>{
 assert.equal(typeof contract.requireCandidateCi,'function');
 const valid={platform:'win32',arch:'x64',node:'v24.16.0',env:{GITHUB_ACTIONS:'true',RUNNER_OS:'Windows',GITHUB_REF:'refs/heads/probe/terminal-minimal-env-2026-10-08'}};
 assert.doesNotThrow(()=>contract.requireCandidateCi(valid));for(const r of [{...valid,env:{}},{...valid,platform:'linux'},{...valid,env:{...valid.env,GITHUB_REF:'refs/heads/probe/terminal-ownership-candidate-2026-10-08'}}])assert.throws(()=>contract.requireCandidateCi(r),/CI_ONLY/);
 const source=Buffer.from(await read('desktop/native/terminal-ownership-minimal-env/ownership.cc')),binding=Buffer.from(await read('desktop/native/terminal-ownership-minimal-env/binding.gyp'));
 assert.equal(contract.validateOwnershipCandidate({source,binding}).target,'siren_terminal_ownership_minimal_env');
 assert.throws(()=>contract.validateOwnershipCandidate({source:Buffer.from('unknown'),binding}),/SOURCE_DRIFT/);
 assert.throws(()=>contract.validateOwnershipCandidate({source:Buffer.from(historicalSource),binding}),/SOURCE_DRIFT/);
});
test('publication closure includes every literal relative import without publishing product source',async()=>{
 assert.equal(typeof contract.validatePublicationInputs,'function');contract.validatePublicationInputs(contract.PUBLICATION_INPUTS);
 assert.throws(()=>contract.validatePublicationInputs(contract.PUBLICATION_INPUTS.slice(1)),/CLOSURE/);
 for(const path of contract.PUBLICATION_INPUTS){const text=await read(path);assert.ok(text.length);if(!path.endsWith('.mjs'))continue;for(const match of text.matchAll(/(?:from\s*|import\s*\()(['"])(\.[^'"]+)\1/g)){const resolved=new URL(match[2],new URL(path,root)).href.slice(root.href.length);assert.ok(contract.PUBLICATION_INPUTS.includes(resolved),`${path} -> ${resolved}`);}}
 assert.equal(contract.PUBLICATION_INPUTS.includes('desktop/src/main.mjs'),false);
});
test('new workflow has a distinct push branch and cannot repeat historical workflows',async()=>{
 assert.equal(typeof contract.requireWorkflowIsolation,'function');const candidate=await read('.github/workflows/terminal-minimal-env.yml'),historical=await read('.github/workflows/terminal-prerequisite.yml'),previous=await read('.github/workflows/terminal-ownership-candidate.yml');
 assert.doesNotThrow(()=>contract.requireWorkflowIsolation({candidate,historical,previous}));assert.throws(()=>contract.requireWorkflowIsolation({candidate:previous,historical,previous}),/BRANCH/);
 assert.match(candidate,/if: always\(\)/);assert.match(candidate,/persist-credentials: false/);assert.doesNotMatch(candidate,/npm run start|npm test/);
});
test('generated builder/runner/workflow preserve pinned parents and implement explicit new env observation',async()=>{
 assert.equal(typeof derive.deriveMinimalEnvironmentCi,'function');const inputs={builder:await read('desktop/tests/native/build-terminal-ownership-candidate.mjs'),runner:await read('desktop/tests/native/terminal-session-composition.mjs'),workflow:await read('.github/workflows/terminal-ownership-candidate.yml')};
 const r=derive.deriveMinimalEnvironmentCi(inputs);for(const [kind,path] of Object.entries({builder:'desktop/tests/native/build-terminal-minimal-env.mjs',runner:'desktop/tests/native/terminal-minimal-env.mjs',workflow:'.github/workflows/terminal-minimal-env.yml'}))assert.equal(await read(path),r[kind]);
 assert.throws(()=>derive.deriveMinimalEnvironmentCi({...inputs,runner:inputs.runner+'\n'}),/INPUT_DRIFT/);
 assert.match(r.runner,/creatorEnvironment/);assert.match(r.runner,/SIREN_PRIVATE_ENV_CANARY/);assert.match(r.builder,/siren_terminal_ownership_minimal_env\.node/);assert.match(r.runner,/requireCandidateCi\(/);
 assert.match(r.runner,/SIREN env Ω space/);assert.ok(r.runner.indexOf('result.parentEnvironmentSeeded=seedKeys')<r.runner.indexOf('native.createSession('));
});
const observedOutput='C:\\fixed\\SIREN env Ω space-run';
function proof(label,pid){const directory=observedOutput+'\\'+label,system='C:\\Windows\\System32';return {label,directory,before:{root:{pid}},creatorEnvironment:{pid,cwd:directory,keys:['ComSpec','ELECTRON_RUN_AS_NODE','PATH','SystemRoot','TEMP','TMP','windir'],values:{ComSpec:system+'\\cmd.exe',ELECTRON_RUN_AS_NODE:'1',PATH:system+';C:\\Windows',SystemRoot:'C:\\Windows',TEMP:directory,TMP:directory,windir:'C:\\Windows'}}};}
test('environment validator rejects missing, inherited, wrong-owner and guessed-directory observations',()=>{
 assert.equal(typeof contract.validateCreatorEnvironments,'function');const r={parentEnvironmentSeeded:['SIREN_PRIVATE_ENV_CANARY','OPENAI_API_KEY','PRIVATE_APPLICATION_SECRET'],groups:['A','B','C','D'].map((n,i)=>proof(n,i+1))};
 assert.doesNotThrow(()=>contract.validateCreatorEnvironments(r,observedOutput));for(const change of [r=>r.groups.pop(),r=>r.groups[0].creatorEnvironment.keys.push('OPENAI_API_KEY'),r=>r.groups[0].creatorEnvironment.pid=999,r=>r.groups[0].creatorEnvironment.values.TEMP='C:\\parent',r=>r.groups[0].creatorEnvironment.values.PATH+=';C:\\injected',r=>r.parentEnvironmentSeeded=[]]){const copy=structuredClone(r);change(copy);assert.throws(()=>contract.validateCreatorEnvironments(copy,observedOutput),/ENVIRONMENT/);}
});

test('private creator directories must match the canonical Unicode/spaces run root and session label',()=>{
 const r={parentEnvironmentSeeded:['SIREN_PRIVATE_ENV_CANARY','OPENAI_API_KEY','PRIVATE_APPLICATION_SECRET'],groups:['A','B','C','D'].map((n,i)=>proof(n,i+1))};
 for(const output of [undefined,'C:\\fixed\\ascii-only','C:\\fixed\\..\\SIREN env Ω space-run'])assert.throws(()=>contract.validateCreatorEnvironments(r,output),/ENVIRONMENT/);
 for(const directory of ['C:\\Windows\\Temp','C:\\fixed\\ascii-only',observedOutput+'\\A\\..\\..\\shared',observedOutput+'\\B']){
  const c=structuredClone(r),g=c.groups[0];g.directory=directory;g.creatorEnvironment.cwd=directory;g.creatorEnvironment.values.TEMP=directory;g.creatorEnvironment.values.TMP=directory;
  assert.throws(()=>contract.validateCreatorEnvironments(c,observedOutput),/ENVIRONMENT/);
 }
});
