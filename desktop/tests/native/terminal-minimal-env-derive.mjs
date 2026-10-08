// Pure generation from exact preserved build/harness/workflow inputs.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {PUBLICATION_INPUTS,CANDIDATE_BRANCH} from './terminal-minimal-env-contract.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
function once(s,b,a){assert.equal(s.split(b).length,2,'MINIMAL_ENV_ANCHOR_DRIFT');return s.replace(b,()=>a);}
export function deriveMinimalEnvironmentCi({builder,runner,workflow}){
 for(const [text,sha] of [[builder,'3c76ec476de5e4214821b4039146466904e5a8dd835e0dd80a4df69bcee5c5d2'],[runner,'92210151a252b3c0f10559129abe67e88b0d81e3e586cef42c801c07161b14d2'],[workflow,'3a5d0fa1512d21b7929131f6286e44831fbf0704f48f7cf50b7e73766dcca361']])assert.equal(hash(text),sha,'MINIMAL_ENV_INPUT_DRIFT');
 builder=builder.replaceAll('terminal-ownership-candidate','terminal-minimal-env').replaceAll('native/terminal-ownership/','native/terminal-ownership-minimal-env/').replaceAll('siren_terminal_ownership','siren_terminal_ownership_minimal_env');
 builder=once(builder,"const runner=join(desktop,'tests/native/terminal-session-composition.mjs');","const runner=join(desktop,'tests/native/terminal-minimal-env.mjs');");
 builder=once(builder,"historical:await readFile(join(root,'.github/workflows/terminal-prerequisite.yml'),'utf8')","historical:await readFile(join(root,'.github/workflows/terminal-prerequisite.yml'),'utf8'),previous:await readFile(join(root,'.github/workflows/terminal-ownership-candidate.yml'),'utf8')");
 builder=once(builder,'receipt.loadedRuntime=loadedRuntime;','receipt.loadedRuntime=loadedRuntime;receipt.creatorEnvironmentObservation=validateCandidateObservation({result,addon:binary,electron}).creatorEnvironments;');
 runner=once(runner,"const desktop=fileURLToPath", "import {requireCandidateCi} from './terminal-minimal-env-contract.mjs';\nrequireCandidateCi({platform:process.platform,arch:process.arch,node:process.version,env:process.env});\nconst desktop=fileURLToPath");
 runner=once(runner,"'evidence/terminal-session-composition'","'evidence/terminal-minimal-env-observation'");
 runner=once(runner,"new Date().toISOString().replaceAll(':','-')+'-'+randomUUID()","'SIREN env Ω space-'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID()");
 runner=once(runner,'runAsNode:process.env.ELECTRON_RUN_AS_NODE','runAsNode:process.env.ELECTRON_RUN_AS_NODE,environment:{pid:process.pid,cwd:process.cwd(),keys:Object.keys(process.env),values:Object.fromEntries(Object.entries(process.env).filter(([k])=>[\'COMSPEC\',\'ELECTRON_RUN_AS_NODE\',\'PATH\',\'SYSTEMROOT\',\'TEMP\',\'TMP\',\'WINDIR\'].includes(k.toUpperCase())))}');
 runner=once(runner,'const native=createRequire(import.meta.url)(config.addon),states=[]',"const seedKeys=['SIREN_PRIVATE_ENV_CANARY','OPENAI_API_KEY','PRIVATE_APPLICATION_SECRET'];for(const key of seedKeys)process.env[key]='test-only-not-a-real-secret';result.parentEnvironmentSeeded=seedKeys;\n const native=createRequire(import.meta.url)(config.addon),states=[]");
 runner=once(runner,'result.groups.push({label,before,ready,fixturePids});return state;',"const creatorEnvironment=JSON.parse(await readFile(join(directory,'creator-bootstrap.json'),'utf8')).environment;\n  result.groups.push({label,directory,before,ready,fixturePids,creatorEnvironment});return state;");
 runner=once(runner,"const paths=['tests/native/terminal-session-composition.mjs'","const paths=['tests/native/terminal-minimal-env.mjs','tests/native/terminal-minimal-env-contract.mjs','tests/native/terminal-ownership-candidate-contract.mjs'");
 workflow=workflow.replaceAll('terminal-ownership-candidate','terminal-minimal-env').replaceAll('siren_terminal_ownership','siren_terminal_ownership_minimal_env');
 const branchLines="    branches: ['"+CANDIDATE_BRANCH+"']\n    paths:\n"+PUBLICATION_INPUTS.map(p=>"      - '"+p+"'\n").join('');
 const paths=/    branches: \[[^\]]+\]\r?\n    paths:\r?\n(?:      - '[^']+'\r?\n)+/g;assert.equal([...workflow.matchAll(paths)].length,1,'MINIMAL_ENV_WORKFLOW_ANCHOR');workflow=workflow.replace(paths,()=>branchLines);
 workflow=workflow.replaceAll('desktop/evidence/terminal-session-composition/','desktop/evidence/terminal-minimal-env-observation/');
 return {builder,runner,workflow,admitted:false,nativeExecuted:false};
}
