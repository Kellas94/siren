// Pure source/receipt contract for a distinct new native artifact, not admission.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {win32 as path} from 'node:path';
import {PUBLICATION_INPUTS as historicalInputs,validateCandidateObservation as validateHistoricalObservation} from './terminal-ownership-candidate-contract.mjs';
export const CANDIDATE_BRANCH='probe/terminal-minimal-env-2026-10-08';
export const CANDIDATE_SCOPE='ACTUAL_MINIMAL_CREATOR_ENV_COMPATIBILITY_NOT_ADMITTED';
export const PUBLICATION_INPUTS=Object.freeze([...historicalInputs,
 '.github/workflows/terminal-minimal-env.yml',
 'desktop/native/terminal-ownership-minimal-env/ownership.cc',
 'desktop/native/terminal-ownership-minimal-env/binding.gyp',
 'desktop/tests/native/build-terminal-minimal-env.mjs',
 'desktop/tests/native/terminal-minimal-env-contract.mjs',
 'desktop/tests/native/terminal-minimal-env-derive.mjs',
 'desktop/tests/native/terminal-minimal-env.test.mjs',
 'desktop/tests/native/terminal-minimal-env.mjs',
 'desktop/tests/fixtures/terminal-minimal-env-observer.cs',
]);
export function validatePublicationInputs(rows){assert.ok(Array.isArray(rows)&&new Set(rows).size===rows.length,'ENV_PUBLICATION_CLOSURE');assert.deepEqual([...rows].sort(),[...PUBLICATION_INPUTS].sort(),'ENV_PUBLICATION_CLOSURE');}
export function requireCandidateCi({platform,arch,node,env}){assert.ok(platform==='win32'&&arch==='x64'&&node==='v24.16.0'&&env?.GITHUB_ACTIONS==='true'&&env.RUNNER_OS==='Windows'&&env.GITHUB_REF==='refs/heads/'+CANDIDATE_BRANCH,'MINIMAL_ENV_CI_ONLY');}
export function validateOwnershipCandidate({source,binding}){
 const hash=b=>createHash('sha256').update(b).digest('hex');assert.ok(Buffer.isBuffer(source)&&Buffer.isBuffer(binding),'ENV_BYTES_REQUIRED');
 assert.equal(hash(source),'f0de9350b5f3ee66df6f989e43e6a70e397144cb4a2d29010e2ce93002fdef3f','ENV_SOURCE_DRIFT');
 assert.equal(hash(binding),'e9c2927fe014c1a12a9357cfcf8da8a98ded95caf6c910a923b6aacd34063366','ENV_BINDING_DRIFT');
 return {sourceSha256:hash(source),bindingSha256:hash(binding),target:'siren_terminal_ownership_minimal_env'};
}
export function validateCreatorEnvironments(native,output){
 const check=(condition,label)=>assert.ok(condition,'CREATOR_ENVIRONMENT_'+label);
 check(typeof output==='string'&&/^[a-z]:\\/i.test(output)&&!/[\0/]/.test(output)&&path.normalize(output)===output,'RUN_DIRECTORY');
 check(path.basename(output).startsWith('SIREN env Ω space-'),'UNICODE_SPACE_SCOPE');
 const expected=['COMSPEC','ELECTRON_RUN_AS_NODE','PATH','SYSTEMROOT','TEMP','TMP','WINDIR'];
 const seeds=['SIREN_PRIVATE_ENV_CANARY','OPENAI_API_KEY','PRIVATE_APPLICATION_SECRET'];
 check(Array.isArray(native?.parentEnvironmentSeeded)&&JSON.stringify(native.parentEnvironmentSeeded)===JSON.stringify(seeds),'PARENT_SEED');
 check(Array.isArray(native.groups)&&native.groups.length===4,'GROUP_COUNT');
 check(JSON.stringify(native.groups.map(g=>g.label))===JSON.stringify(['A','B','C','D']),'GROUPS');
 for(const g of native.groups){
  const p=g.creatorEnvironment;check(p&&Number.isInteger(p.pid)&&p.pid>0&&p.pid===g.before?.root?.pid,'OWNER');
  check(g.directory===path.join(output,g.label)&&p.cwd===g.directory,'DIRECTORY');
  check(Array.isArray(p.keys)&&p.keys.length===7&&p.keys.every(k=>typeof k==='string'),'KEYS');
  check(JSON.stringify(p.keys.map(k=>k.toUpperCase()).sort())===JSON.stringify(expected),'KEY_SET');
  check(p.values&&[Object.prototype,null].includes(Object.getPrototypeOf(p.values))&&Object.keys(p.values).length===7,'VALUES');
  const values=Object.create(null);for(const [k,v] of Object.entries(p.values)){check(typeof v==='string'&&expected.includes(k.toUpperCase())&&!Object.hasOwn(values,k.toUpperCase()),'VALUE_KEY');values[k.toUpperCase()]=v;}
  check(Object.keys(values).length===7&&typeof values.SYSTEMROOT==='string'&&/^[a-z]:\\/i.test(values.SYSTEMROOT),'WINDOWS');
  const system=path.join(values.SYSTEMROOT,'System32');
  check(values.ELECTRON_RUN_AS_NODE==='1'&&values.WINDIR===values.SYSTEMROOT,'RUNTIME');
  // Windows API path casing is not fixed (observed system32 versus System32).
  // Compare only casing; no normalization, expansion or extra PATH entries.
  check(values.PATH.toLowerCase()===(system+';'+values.SYSTEMROOT).toLowerCase()&&values.COMSPEC.toLowerCase()===path.join(system,'cmd.exe').toLowerCase(),'FIXED_PATH');
  check(values.TEMP===g.directory&&values.TMP===g.directory,'PRIVATE_TEMP');
 }
 return {creators:4,keys:expected.length,privateSeedKeys:seeds.length};
}
export function validateCandidateObservation(input){const result=validateHistoricalObservation(input);return {...result,creatorEnvironments:validateCreatorEnvironments(input.result.native,input.result.output)};}
function push(text){return /^  push:[^\n]*\n((?:^    .*\n|^\n)*)/m.exec(text)?.[1]??'';}
function branches(text){const declaration=/^    branches: \[([^\]]*)\]\r?$/m.exec(push(text));assert.ok(declaration,'ENV_WORKFLOW_BRANCH');const rows=[...declaration[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);assert.equal(rows.map(x=>"'"+x+"'").join(', '),declaration[1],'ENV_WORKFLOW_BRANCH');return rows;}
export function requireWorkflowIsolation({candidate,historical,previous}){
 assert.deepEqual(branches(candidate),[CANDIDATE_BRANCH],'ENV_WORKFLOW_BRANCH');
 const rows=[...push(candidate).matchAll(/^      - '([^']+)'/gm)].map(m=>m[1]);validatePublicationInputs(rows);
 for(const old of [historical,previous])for(const branch of branches(old)){assert.doesNotMatch(branch,/[*?!\[\]{}]/,'ENV_HISTORICAL_BRANCH');assert.notEqual(branch,CANDIDATE_BRANCH,'ENV_WORKFLOW_COLLISION');}
}
