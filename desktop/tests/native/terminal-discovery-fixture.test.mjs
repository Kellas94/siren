// DATA construction only. No PowerShell, provider or subprocess execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSingleCmdletFixture} from './terminal-cmdlet-fixture.mjs';
import {createComparedCmdletFixture,coldCmdletComparisonCases} from './terminal-discovery-fixture.mjs';
const options={projectDirectory:"C:\\probe țară 日本語\\O'Brien",token:'b'.repeat(32)};

test('four fixed comparison arms use distinct cold-session namespaces in recorded order',()=>{
 assert.deepEqual(coldCmdletComparisonCases,[
  {armId:'original-start-sleep',mode:'original',control:'start-sleep'},
  {armId:'qualified-start-sleep',mode:'module-qualified',control:'start-sleep'},
  {armId:'original-write-output',mode:'original',control:'write-output'},
  {armId:'qualified-write-output',mode:'module-qualified',control:'write-output'},
 ]);
 assert.ok(Object.isFrozen(coldCmdletComparisonCases));
 assert.ok(coldCmdletComparisonCases.every(Object.isFrozen));
});
test('original comparison fixture remains byte-identical to the retained cold original',()=>{
 for(const control of ['start-sleep','write-output'])assert.deepEqual(createComparedCmdletFixture({...options,control,mode:'original'}),createSingleCmdletFixture({...options,control}));
});
test('qualified comparison changes exactly one target command name and its variant',()=>{
 for(const control of ['start-sleep','write-output']){
  const original=createSingleCmdletFixture({...options,control});
  const qualified=createComparedCmdletFixture({...options,control,mode:'module-qualified'});
  assert.ok(Object.isFrozen(qualified));
  const name=control==='start-sleep'?'Start-Sleep':'Write-Output';
  assert.equal(qualified.variant,original.variant+'_MODULE_QUALIFIED');
  assert.equal(qualified.script,original.script.replace('\r\n'+name+' ','\r\nMicrosoft.PowerShell.Utility\\'+name+' '));
  assert.deepEqual({...qualified,variant:original.variant,script:original.script},original);
  assert.equal(qualified.script.split('Microsoft.PowerShell.Utility\\').length,2);
  assert.doesNotMatch(qualified.script,/Get-Command|Get-Module|Import-Module|PSModulePath|Threading|AMSI|Start-Process/);
  assert.equal(qualified.input,original.input);assert.equal(qualified.expectedPipeline,original.expectedPipeline);
 }
});
test('unknown modes, controls and arbitrary targets cannot enter the fixed comparison',()=>{
 for(const mode of [undefined,null,'qualified','original;exit','module-qualified\nexit',{},1])assert.throws(()=>createComparedCmdletFixture({...options,control:'start-sleep',mode}),TypeError);
 for(const control of ['Get-Date','start-sleep;exit',null])assert.throws(()=>createComparedCmdletFixture({...options,control,mode:'module-qualified'}),TypeError);
 const f=createComparedCmdletFixture({...options,control:'start-sleep',mode:'module-qualified',command:'exit 9',module:'arbitrary',script:'exit 9'});
 assert.doesNotMatch(f.script,/exit 9|arbitrary/);
});
test('qualified construction retains original literal path/token validation',()=>{
 for(const projectDirectory of ['relative','\\\\host\\share','C:\\x\\..\\y','C:\\x:stream'])assert.throws(()=>createComparedCmdletFixture({...options,projectDirectory,control:'write-output',mode:'module-qualified'}),TypeError);
 for(const token of ['', 'A'.repeat(32),'x\nexit'])assert.throws(()=>createComparedCmdletFixture({...options,token,control:'write-output',mode:'module-qualified'}),TypeError);
 const f=createComparedCmdletFixture({...options,control:'write-output',mode:'module-qualified'});
 assert.equal(f.input,"& 'C:\\probe țară 日本語\\O''Brien\\single-cmdlet.ps1'\r");assert.doesNotMatch(f.script,/(?<!\r)\n/);
});
test('retained V1 original fixture source is unchanged by the comparison',async()=>{
 const bytes=await readFile(new URL('./terminal-cmdlet-fixture.mjs',import.meta.url));
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'79656c38d68eace83bdd2de2c3b9d14ac1442875bf1f67ee050d38aff4d3aa94');
});
