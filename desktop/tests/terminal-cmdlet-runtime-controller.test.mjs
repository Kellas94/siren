// Pure controller/verdict tests, no native worker import/evaluation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SourceTextModule} from 'node:vm';
import {createSingleCmdletFixture} from './native/terminal-cmdlet-fixture.mjs';
import {validateSingleCmdletResult,validateDiagnosticLaunch,createCmdletRuntimeEntry} from './native/terminal-cmdlet-runtime.mjs';
const context={run:'123',commit:'a'.repeat(40)};
const fixture=control=>createSingleCmdletFixture({control,projectDirectory:'C:\\fixed diagnostic',token:'b'.repeat(32)});
function result(control){const f=fixture(control);return {
 scope:'HOSTED_SINGLE_CMDLET_DIAGNOSTIC',status:'SINGLE_CMDLET_DIAGNOSTIC_COMPLETE',...context,control,fixtureVariant:f.variant,
 nativeExecutionAdmitted:false,productActivation:false,fullMatrixQualified:false,rendererInputQualified:false,packagedQualified:false,
 realSessions:1,commandCompleted:true,mandatoryMarkersObserved:true,externalProcessJoin:true,cleanupVerified:true,unavailable:[],
 milestones:[{name:'actual-native-host'},{name:'actual-session-create',created:{ok:true}},{name:'actual-terminal-attach'},
  {name:'before-command',commandInputSequence:0},{name:'command-completed',stage:'after-'+control,completion:f.expected},
  {name:'backend-history',markers:control==='start-sleep'?[f.expectedConsole]:[f.expectedPipeline,f.expectedConsole],chunks:1},
  {name:'session-stop-native-receipt',receipt:{closed:true,snapshot:{active:0}}},
  {name:'shutdown-separate-native-and-external-joins',graph:{actualSettled:true,unknown:false},checked:{ok:true},external:{status:'EXACT_HELD_PROCESSES_EXITED'},externalExit:{code:0},utilityExit:77}]
};}
test('each cold cmdlet result has a distinct bounded verdict without product approval',()=>{
 for(const control of ['start-sleep','write-output'])validateSingleCmdletResult(result(control),{...context,control,fixture:fixture(control)});
});
test('missing, adverse and inflated verdicts cannot pass',()=>{
 for(const control of ['start-sleep','write-output'])for(const key of Object.keys(result(control))){
  const missing=result(control);delete missing[key];assert.throws(()=>validateSingleCmdletResult(missing,{...context,control,fixture:fixture(control)}),key+' missing');
  const bad=result(control);bad[key]=typeof bad[key]==='boolean'?!bad[key]:'wrong';assert.throws(()=>validateSingleCmdletResult(bad,{...context,control,fixture:fixture(control)}),key+' changed');
 }
 for(const key of ['error','failureShutdownError','failureDiagnosticError']){
  const value=result('start-sleep');value[key]='adverse';assert.throws(()=>validateSingleCmdletResult(value,{...context,control:'start-sleep',fixture:fixture('start-sleep')}));
 }
});
test('one control cannot satisfy the other or omit the pipeline marker',()=>{
 const value=result('write-output');value.milestones[5].markers.pop();assert.throws(()=>validateSingleCmdletResult(value,{...context,control:'write-output',fixture:fixture('write-output')}));
 assert.throws(()=>validateSingleCmdletResult(result('start-sleep'),{...context,control:'write-output',fixture:fixture('write-output')}));
 const tampered={...fixture('write-output'),script:'exit 0'};assert.throws(()=>validateSingleCmdletResult(result('write-output'),{...context,control:'write-output',fixture:tampered}));
});
test('verdict requires all causal stages in order, native Stop and exact external join',()=>{
 for(let i=0;i<8;i++){const value=result('start-sleep');value.milestones.splice(i,1);assert.throws(()=>validateSingleCmdletResult(value,{...context,control:'start-sleep',fixture:fixture('start-sleep')}));}
 for(const [index,key,bad] of [[1,'created',{ok:false}],[3,'commandInputSequence',1],[4,'stage','before-start-sleep'],[4,'completion','wrong'],[5,'chunks',0],[6,'receipt',{closed:true,snapshot:{active:1}}],[7,'graph',{actualSettled:false,unknown:false}],[7,'checked',{ok:false}],[7,'external',{status:'UNKNOWN'}],[7,'externalExit',{code:1}],[7,'utilityExit',0]]){
  const value=result('start-sleep');value.milestones[index][key]=bad;assert.throws(()=>validateSingleCmdletResult(value,{...context,control:'start-sleep',fixture:fixture('start-sleep')}),key);
 }
 const value=result('start-sleep');value.unavailable=['OWNERSHIP_UNAVAILABLE'];assert.throws(()=>validateSingleCmdletResult(value,{...context,control:'start-sleep',fixture:fixture('start-sleep')}));
});
const launch=()=>({spawnError:null,closeObserved:true,watchdog:false,overflow:false,exit:0,signal:null});
test('timeout, killed or unobserved launcher never implies diagnostic completion',()=>{
 validateDiagnosticLaunch(launch());for(const key of Object.keys(launch())){const value=launch();delete value[key];assert.throws(()=>validateDiagnosticLaunch(value));}
 for(const [key,bad] of [['spawnError',{}],['closeObserved',false],['watchdog',true],['overflow',true],['exit',1],['signal','SIGTERM']])assert.throws(()=>validateDiagnosticLaunch({...launch(),[key]:bad}));
});
test('generated entry fixes worker/control and protocol ordering without evaluating Electron',()=>{
 const entry=createCmdletRuntimeEntry('C:/fixed/terminal-cmdlet-runtime-worker.mjs',{out:'C:/fixed/result',control:'write-output'});
 new SourceTextModule(entry);assert.ok(entry.indexOf('registerSchemesAsPrivileged')<entry.indexOf('whenReady'));assert.ok(entry.includes('"control":"write-output"'));assert.ok(!entry.includes('no-sandbox'));
 for(const control of ['arbitrary',null,undefined])assert.throws(()=>createCmdletRuntimeEntry('C:/fixed/worker.mjs',{control}));
});
test('new workflow is fixed-branch, read-only and preserves adverse original runs',async()=>{
 const text=await readFile(new URL('../../.github/workflows/terminal-cmdlet-runtime.yml',import.meta.url),'utf8');
 assert.match(text,/branches: \['probe\/terminal-session-20261010'\]/);assert.match(text,/contents: read/);assert.match(text,/persist-credentials: false/);assert.match(text,/ref: \$\{\{ github.sha \}\}/);assert.match(text,/timeout-minutes: 15/);
 assert.equal((text.match(/uses: [^\n]+@[a-f0-9]{40}\n/g)??[]).length,3);assert.match(text,/if: always\(\)/);assert.match(text,/include-hidden-files: true/);assert.match(text,/retention-days: 3/);
 assert.ok(text.indexOf('filesystem-probe.mjs')<text.indexOf('terminal-session-provision.mjs'));assert.ok(text.indexOf('terminal-session-provision.mjs')<text.indexOf('node --experimental-vm-modules desktop/tests/native/terminal-cmdlet-runtime.mjs'));
 assert.ok(!text.includes('workflow_dispatch'));assert.ok(!text.includes('pull_request'));assert.ok(!text.includes('secrets.'));
});
