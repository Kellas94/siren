// Pure DATA / actual controller excerpt checks. No Electron or shell execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SourceTextModule,runInNewContext} from 'node:vm';
import {win32 as path} from 'node:path';
import {createComparedCmdletFixture,coldCmdletComparisonCases} from './native/terminal-discovery-fixture.mjs';
import * as api from './native/terminal-discovery-runtime.mjs';
const source=await readFile(new URL('./native/terminal-discovery-runtime.mjs',import.meta.url),'utf8');
const context={run:'123',commit:'a'.repeat(40)};
const fixture=(control,mode)=>createComparedCmdletFixture({control,mode,projectDirectory:'C:\\fixed diagnostic',token:'b'.repeat(32)});
function result(control,mode){const f=fixture(control,mode);return {
 scope:'HOSTED_SINGLE_CMDLET_DIAGNOSTIC',status:'SINGLE_CMDLET_DIAGNOSTIC_COMPLETE',...context,control,fixtureVariant:f.variant,
 nativeExecutionAdmitted:false,productActivation:false,fullMatrixQualified:false,rendererInputQualified:false,packagedQualified:false,
 realSessions:1,commandCompleted:true,mandatoryMarkersObserved:true,externalProcessJoin:true,cleanupVerified:true,unavailable:[],
 milestones:[{name:'actual-native-host'},{name:'actual-session-create',created:{ok:true}},{name:'actual-terminal-attach'},
  {name:'before-command',commandInputSequence:0},{name:'command-completed',stage:'after-'+control,completion:f.expected},
  {name:'backend-history',markers:control==='start-sleep'?[f.expectedConsole]:[f.expectedPipeline,f.expectedConsole],chunks:1},
  {name:'session-stop-native-receipt',receipt:{closed:true,snapshot:{active:0}}},
  {name:'shutdown-separate-native-and-external-joins',graph:{actualSettled:true,unknown:false},checked:{ok:true},external:{status:'EXACT_HELD_PROCESSES_EXITED'},externalExit:{code:0},utilityExit:77}]
};}

test('each result is bound to original or module-qualified fixture identity',()=>{
 for(const {control,mode} of coldCmdletComparisonCases){
  api.validateSingleCmdletResult(result(control,mode),{...context,control,mode,fixture:fixture(control,mode)});
  const other=mode==='original'?'module-qualified':'original';
  assert.throws(()=>api.validateSingleCmdletResult(result(control,mode),{...context,control,mode:other,fixture:fixture(control,other)}));
  for(const bad of [undefined,null,'arbitrary'])assert.throws(()=>api.validateSingleCmdletResult(result(control,mode),{...context,control,mode:bad,fixture:fixture(control,mode)}));
  const failed={...result(control,mode),status:'FAILED',cleanupVerified:true};assert.throws(()=>api.validateSingleCmdletResult(failed,{...context,control,mode,fixture:fixture(control,mode)}));
 }
});

test('qualified worker changes only its fixed fixture import from immutable V1 worker',async()=>{
 const original=await readFile(new URL('./native/terminal-cmdlet-runtime-worker.mjs',import.meta.url),'utf8');
 const qualified=await readFile(new URL('./native/terminal-discovery-worker.mjs',import.meta.url),'utf8');
 assert.equal(original.split("'44.9.3'").length-1,2,'Exactly creator and utility runtime literals migrate');
 const historical=original.replaceAll("'44.9.3'","'44.5.1'");
 assert.equal(createHash('sha256').update(historical).digest('hex'),'26da5371f6af6e53aade79ebc340d7687596a1b5bbd427dc13cc35caa7f2ab33','Runtime inverse must restore immutable V1 exactly');
 assert.equal(qualified,original.replace("import {createSingleCmdletFixture} from './terminal-cmdlet-fixture.mjs';","import {createQualifiedSingleCmdletFixture as createSingleCmdletFixture} from './terminal-discovery-fixture.mjs';"));
 new SourceTextModule(qualified);new SourceTextModule(source);
});

async function loop(overrides={}){
 const begin=source.indexOf('  for(const {armId,control,mode} of coldCmdletComparisonCases){');
 const end=source.indexOf("  await recheckTerminalSessionExecutionResources(inventory);await save('execution-inventory-after.json'",begin);
 assert.ok(begin>0&&end>begin);const calls=[],receipt={arms:[]};
 const scope={assert,...api,createComparedCmdletFixture,coldCmdletComparisonCases,out:'C:\\owned',root:'C:\\repo',execution:'C:\\execution',electronExecutable:'C:\\electron.exe',filesystemExecutable:'C:\\filesystem.exe',observerExecutable:'C:\\observer.exe',context,receipt,env:{},join:path.join,
  mkdir:async()=>{},writeFile:async()=>{},pin:async p=>({path:p,bytes:0,sha256:'inert'}),
  launchFixedControl:async(_exe,entry)=>{calls.push(entry);return{spawnError:null,closeObserved:true,watchdog:false,overflow:false,exit:0,signal:null};},
  readFile:async()=>JSON.stringify({scope:'HOSTED_SINGLE_CMDLET_DIAGNOSTIC',status:'FAILED',...context,control:'start-sleep',fixtureVariant:'SINGLE_CMDLET_START_SLEEP',cleanupVerified:true,failureCleanup:{code:98}}),...overrides};
 await runInNewContext('(async()=>{'+source.slice(begin,end)+'})()',scope);return{calls,receipt};
}

test('a failed original with an unvalidated cleanup flag cannot advance comparison',async()=>{
 const r=await loop();assert.equal(r.calls.length,1);assert.equal(r.receipt.arms[0].nextArmRefused,'PREVIOUS_NATIVE_CLEANUP_UNVERIFIED');
});
test('failure cleanup is bound to actual original versus qualified variant before next arm',async()=>{
 for(const variant of [undefined,'SINGLE_CMDLET_START_SLEEP_MODULE_QUALIFIED','foreign']){
  const r=await loop({validateDiagnosticCleanup(){},readFile:async()=>JSON.stringify({scope:'HOSTED_SINGLE_CMDLET_DIAGNOSTIC',status:'FAILED',...context,control:'start-sleep',fixtureVariant:variant,cleanupVerified:true,failureCleanup:{code:98}})});
  assert.equal(r.calls.length,1);
 }
});

test('all four observed failures remain adverse with separate fresh process directories',async()=>{
 const r=await loop({validateDiagnosticCleanup(){},readFile:async p=>{
  const row=coldCmdletComparisonCases.find(c=>p.includes('\\'+c.armId+'\\'));assert.ok(row);
  return JSON.stringify({scope:'HOSTED_SINGLE_CMDLET_DIAGNOSTIC',status:'FAILED',...context,control:row.control,fixtureVariant:fixture(row.control,row.mode).variant,cleanupVerified:true,failureCleanup:{code:98}});
 }});
 assert.equal(r.calls.length,4);assert.equal(new Set(r.calls).size,4);assert.ok(r.receipt.arms.every(a=>a.status==='FAILED'));
 assert.deepEqual(JSON.parse(JSON.stringify(r.receipt.arms.map(a=>a.armId))),coldCmdletComparisonCases.map(c=>c.armId));
 const start=source.indexOf('  assert.deepEqual(receipt.arms.map(a=>a.armId)');const end=source.indexOf('\n }catch',start);
 assert.ok(start>0&&end>start);assert.throws(()=>runInNewContext(source.slice(start,end),{assert,receipt:r.receipt,coldCmdletComparisonCases}));
});

test('comparison workflow remains fixed-branch and preserves all adverse and baseline source files',async()=>{
 const w=await readFile(new URL('../../.github/workflows/terminal-discovery-runtime.yml',import.meta.url),'utf8');
 assert.match(w,/branches: \['probe\/terminal-session-20261010'\]/);assert.match(w,/contents: read/);assert.match(w,/persist-credentials: false/);
 assert.match(w,/if: always\(\)/);assert.match(w,/include-hidden-files: true/);assert.match(w,/retention-days: 3/);
 assert.equal((w.match(/uses: [^\n]+@[a-f0-9]{40}\n/g)??[]).length,3);
 for(const line of ['desktop/tests/native/terminal-discovery-*','desktop/evidence/terminal-discovery-runtime/**','desktop/tests/fixtures/terminal-host-receipt-contract.mjs','desktop/tests/terminal-session-runtime-controller.test.mjs','desktop/tests/terminal-session-runtime-integration.test.mjs','desktop/tests/terminal-production-entry-options.test.mjs'])assert.ok(w.includes(line));
 assert.ok(!w.includes('secrets.')&&!w.includes('pull_request')&&!w.includes('workflow_dispatch'));
});

test('artifact paths cover runtime source closure and explicitly named local derivation copies',async()=>{
 const workflow=await readFile(new URL('../../.github/workflows/terminal-discovery-runtime.yml',import.meta.url),'utf8');
 const original=JSON.parse(await readFile(new URL('./native/terminal-session-runtime-inputs.json',import.meta.url),'utf8'));
 const required=runInNewContext(source.match(/for\(const required of (\[[^\r\n]+\])\)assert\.ok/)[1]);
 const paths=new Set([...original.inputs.map(r=>r.path),...required,
  'desktop/tests/native/terminal-session-runtime-inputs.json','desktop/tests/native/terminal-discovery-runtime-inputs.json',
  'terminal-discovery-diagnostic-20261011/prepare-source.py','terminal-discovery-diagnostic-20261011/source-derivation.json',
  'terminal-discovery-diagnostic-20261011/derivation-inputs/terminal-cmdlet-runtime.yml',
  'terminal-discovery-diagnostic-20261011/derivation-inputs/origin.json']);
 const block=workflow.slice(workflow.lastIndexOf('          path: |')+'          path: |'.length);
 const globs=block.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>new RegExp('^'+s.replaceAll('.','\\.').replaceAll('**','\0').replaceAll('*','[^/]*').replaceAll('\0','.*')+'$'));
 assert.deepEqual([...paths].filter(p=>!globs.some(g=>g.test(p))),[]);
});
