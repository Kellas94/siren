// Inert script construction only: never submits or executes PowerShell.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createSingleCmdletFixture} from './terminal-cmdlet-fixture.mjs';
const options={projectDirectory:"C:\\probe țară 日本語\\O'Brien",token:'a'.repeat(32)};

test('Start-Sleep control targets the exact original cmdlet without warming cmdlet state',()=>{
 const f=createSingleCmdletFixture({...options,control:'start-sleep'});
 assert.equal(f.variant,'SINGLE_CMDLET_START_SLEEP');assert.equal(f.control,'start-sleep');
 assert.equal(f.script.split('Start-Sleep -Milliseconds 100').length,2);
 assert.doesNotMatch(f.script,/Write-Output|Get-Command|Out-File|Out-String|Import-Module|Threading|Start-Process/);
 assert.ok(f.script.indexOf("'before-start-sleep'")<f.script.indexOf('Start-Sleep'));
 assert.ok(f.script.indexOf('Start-Sleep')<f.script.indexOf("'after-start-sleep'"));
 assert.equal(f.expectedPipeline,null);assert.equal(f.expectedConsole,'SIREN_CMDLET_COMPLETE_'+options.token);
});
test('Write-Output control retains a mandatory distinct pipeline marker and after-stage',()=>{
 const f=createSingleCmdletFixture({...options,control:'write-output'});
 assert.equal(f.variant,'SINGLE_CMDLET_WRITE_OUTPUT');assert.equal(f.control,'write-output');
 assert.equal(f.expectedPipeline,'SIREN_PIPELINE_CONTROL');
 assert.equal(f.script.split("Write-Output 'SIREN_PIPELINE_CONTROL'").length,2);
 assert.doesNotMatch(f.script,/Start-Sleep|Get-Command|Out-File|Out-String|Import-Module|Threading/);
 assert.ok(f.script.indexOf("'before-write-output'")<f.script.indexOf('Write-Output'));
 assert.ok(f.script.indexOf('Write-Output')<f.script.indexOf("'after-write-output'"));
 assert.ok(f.script.indexOf("'after-write-output'")<f.script.indexOf('WriteAllText($completed'));
 assert.ok(f.script.indexOf('WriteAllText($completed')<f.script.lastIndexOf('[Console]::WriteLine'));
});
test('output control records a direct Console entry marker before its first cmdlet',()=>{
 const f=createSingleCmdletFixture({...options,control:'write-output'});
 assert.equal(f.expectedEntry,'SIREN_CMDLET_ENTERED_'+options.token);
 assert.ok(f.script.indexOf("[Console]::WriteLine('"+f.expectedEntry+"')")<f.script.indexOf("'before-write-output'"));
 assert.equal(f.script.split(f.expectedEntry).length,2);
 assert.equal(createSingleCmdletFixture({...options,control:'start-sleep'}).expectedEntry,null);
});
test('both controls preserve literal one-line invocation, CRLF body and separate proof files',()=>{
 for(const control of ['start-sleep','write-output']){
  const f=createSingleCmdletFixture({...options,control});assert.equal(Object.isFrozen(f),true);
  assert.equal(f.input,`& 'C:\\probe țară 日本語\\O''Brien\\single-cmdlet.ps1'\r`);
  assert.doesNotMatch(f.script,/(?<!\r)\n/);assert.equal(f.script.startsWith('\uFEFF'),false);
  assert.match(f.script,/\[IO.File\]::WriteAllText\(\$stage, 'entered'\)/);
  assert.equal(new Set([f.scriptPath,f.startedPath,f.completedPath,f.stagePath]).size,4);
  assert.equal(f.expected,options.token);assert.equal(f.script.split(f.expectedConsole).length,2);
 }
});
test('control selection and caller-provided code cannot become an arbitrary command',()=>{
 for(const control of [undefined,null,'Start-Sleep','start-sleep\rWrite-Host bad','write-output;exit',{},1])assert.throws(()=>createSingleCmdletFixture({...options,control}),TypeError);
 const f=createSingleCmdletFixture({...options,control:'start-sleep',script:'exit 9',input:'exit 9',milliseconds:999999});
 assert.doesNotMatch(f.script,/exit 9|999999/);assert.match(f.script,/Milliseconds 100/);
});
test('local-path, token and escaped injection boundaries match the retained original fixture',()=>{
 for(const projectDirectory of ['relative','\\\\server\\x','C:\\a\\..\\b','C:\\CON','C:\\a:stream','C:\\x\nexit'])assert.throws(()=>createSingleCmdletFixture({...options,projectDirectory,control:'start-sleep'}),TypeError);
 for(const token of ['', 'A'.repeat(32),'a'.repeat(31)+'\n',null,{}])assert.throws(()=>createSingleCmdletFixture({...options,token,control:'write-output'}),TypeError);
 const f=createSingleCmdletFixture({projectDirectory:"D:\\x';$(exit 9);#",token:'b'.repeat(32),control:'write-output'});
 assert.equal(f.input,"& 'D:\\x'';$(exit 9);#\\single-cmdlet.ps1'\r");
});
test('the original V20 command generator remains byte-exact',async()=>{
 const b=await readFile(new URL('./terminal-session-command.mjs',import.meta.url));
 assert.equal(createHash('sha256').update(b).digest('hex'),'a1e5d3df5358cf9f240e6f325e0b35434c09515369ae63dba2bcbcdb27259954');
});
