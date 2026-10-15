// Pure fixture/sidecar DATA checks. No PowerShell, Electron or native execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createComparedCmdletFixture} from './terminal-discovery-fixture.mjs';
import {createResolutionObservationFixture,parseResolutionObservation,resolutionObservationCases,resolutionObservationFields} from './terminal-resolution-observation.mjs';
import * as observation from './terminal-resolution-observation.mjs';
const token='a'.repeat(32),pid=1234,projectDirectory="C:\\state țară 日本語\\owner's project";
function values(){return {token,effectiveModulePath:'C:\\Windows\\Modules',PSHOME:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0',version:'5.1.26100.1',PID:String(pid),languageMode:'FullLanguage',autoloadPreference:'unset',PATH:'C:\\Windows\\System32',PATHEXT:'absent',
 'assembly.System.Management.Automation':'3.0.0.0','assembly.Microsoft.PowerShell.Commands.Utility':'absent',
 'assembly.Microsoft.PowerShell.Commands.Management':'absent','assembly.Microsoft.PowerShell.ConsoleHost':'3.0.0.0',
 captureStartedUtcTicks:'638900000000000000',captureEndedUtcTicks:'638900000000001000'};}
function bytes(v=values(),keys=Object.keys(resolutionObservationFields)){return Buffer.from('SIREN_RESOLUTION_STATE_V1\r\n'+keys.map(k=>k+'\t'+Buffer.from(v[k]).toString('base64')+'\r\n').join(''));}
const parse=b=>parseResolutionObservation(b,{token,pid});
test('observation order is fixed, reverse to the earlier qualified/original comparison',()=>{
 assert.deepEqual(resolutionObservationCases.map(c=>[c.armId,c.mode,c.control]),[['qualified-write-output-state','module-qualified','write-output'],['original-write-output-state','original','write-output']]);
 assert.ok(Object.isFrozen(resolutionObservationCases)&&resolutionObservationCases.every(Object.isFrozen));
});
test('both fixed targets and original tail remain unchanged; state is before entry and target',()=>{
 for(const {mode} of resolutionObservationCases){
  const f=createResolutionObservationFixture({projectDirectory,token,control:'write-output',mode});
  const old=createComparedCmdletFixture({projectDirectory,token,control:'write-output',mode});
  const anchor="[IO.File]::WriteAllText($stage, 'entered')\r\n";
  const before=old.script.slice(0,old.script.indexOf(anchor)+anchor.length),after=old.script.slice(old.script.indexOf(anchor)+anchor.length);
  assert.ok(f.script.startsWith(before)&&f.script.endsWith(after));
  assert.equal(f.input,old.input);assert.equal(f.scriptPath,old.scriptPath);
  assert.equal(f.variant,old.variant+'_PRETARGET_RESOLUTION_STATE_V1');
  assert.equal(f.observationPath,f.scriptPath.replace('single-cmdlet.ps1','resolution-state.tsv'));
  assert.ok(f.script.indexOf('observation-written')<f.script.indexOf('[Console]::WriteLine'));
  assert.match(f.script,/\[IO\.File\]::Move\(/);assert.match(f.script,/observation-invalid/);
  assert.ok(!/Get-Command|Get-Module|Get-Variable|Import-Module|ConvertTo-Json|Assembly\.Load|Start-Process|Get-ChildItem/.test(f.script));
  assert.ok(!f.script.includes('ReadAllText')&&!f.script.includes('GetEnvironmentVariables'));
  for(const line of f.script.split('\r\n').filter(s=>s.includes('$sirenBuilder.Append(')))assert.match(line,/\[void\]/);
 }
});
test('fixture refuses modes/targets outside the fixed diagnostic and preserves original path validation',()=>{
 for(const control of [undefined,'start-sleep','arbitrary'])assert.throws(()=>createResolutionObservationFixture({projectDirectory,token,control,mode:'original'}));
 for(const mode of [undefined,'arbitrary'])assert.throws(()=>createResolutionObservationFixture({projectDirectory,token,control:'write-output',mode}));
 for(const p of ['relative','C:\\x\u0000y'])assert.throws(()=>createResolutionObservationFixture({projectDirectory:p,token,control:'write-output',mode:'original'}));
});
test('worker fixture adapters fix their mode despite a caller supplied opposite mode',()=>{
 for(const [name,mode] of [['createOriginalResolutionFixture','original'],['createQualifiedResolutionFixture','module-qualified']]){
  assert.equal(typeof observation[name],'function');
  const f=observation[name]({projectDirectory,token,control:'write-output',mode:mode==='original'?'module-qualified':'original'});
  assert.deepEqual(f,createResolutionObservationFixture({projectDirectory,token,control:'write-output',mode}));
  assert.throws(()=>observation[name]({projectDirectory,token,control:'start-sleep'}));
 }
 const original=createResolutionObservationFixture({projectDirectory,token,control:'write-output',mode:'original'});
 const qualified=createResolutionObservationFixture({projectDirectory,token,control:'write-output',mode:'module-qualified'});
 assert.equal(qualified.script,original.script.replace("\r\nWrite-Output ","\r\nMicrosoft.PowerShell.Utility\\Write-Output "));
});
test('strict state decoder accepts original bytes and optional UTF8 BOM without exposing path fields to effects',()=>{
 for(const b of [bytes(),Buffer.concat([Buffer.from([239,187,191]),bytes()])]){
  const s=parse(b);assert.deepEqual({...s.fields},values());assert.equal(s.pid,pid);assert.equal(s.collectionClockMovedBackwards,false);
  assert.ok(Object.isFrozen(s)&&Object.isFrozen(s.fields));
 }
 const v=values();v.PATH='C:\\țară\t日本語\r\nvalue';assert.equal(parse(bytes(v)).fields.PATH,v.PATH);
});
test('missing, extra, duplicate, reordered and malformed rows cannot become valid observations',()=>{
 const keys=Object.keys(resolutionObservationFields);
 for(const b of [bytes(values(),keys.slice(1)),Buffer.concat([bytes(),Buffer.from('extra\tYQ==\r\n')]),bytes(values(),[...keys,keys[0]]),bytes(values(),[...keys].reverse()),Buffer.from(bytes().toString().replace('\r\n','\n')),Buffer.from(bytes().toString().replace('token\t','token\t\t'))])assert.throws(()=>parse(b),/RESOLUTION_OBSERVATION_INVALID/);
});
test('noncanonical base64 and invalid UTF8 are refused rather than silently normalized',()=>{
 for(const value of ['YQ','YR==','!!!!','/w==']){
  const b=Buffer.from(bytes().toString().replace(/(token\t)[^\r]+/,'$1'+value));assert.throws(()=>parse(b),/RESOLUTION_OBSERVATION_INVALID/);
 }
 assert.throws(()=>parse(Buffer.from([0xff])),/RESOLUTION_OBSERVATION_INVALID/);
});
test('state is bound to the exact nonce and held shell PID, with finite scalar enums',()=>{
 for(const [key,value] of [['token','b'.repeat(32)],['PID','999'],['PID','01234'],['languageMode','unknown'],['autoloadPreference','present:Surprise'],['PATHEXT','bad'],['version','arbitrary'],['assembly.Microsoft.PowerShell.Commands.Utility','duplicate:3.0.0.0']]){
  const v=values();v[key]=value;assert.throws(()=>parse(bytes(v)),/RESOLUTION_OBSERVATION_INVALID/);
 }
 for(const pref of ['unset','null','present:All','present:ModuleQualified','present:None']){const v=values();v.autoloadPreference=pref;assert.equal(parse(bytes(v)).fields.autoloadPreference,pref);}
 for(const bad of [{token:'bad',pid},{token,pid:0},{token,pid:2**32}])assert.throws(()=>parseResolutionObservation(bytes(),bad),/RESOLUTION_OBSERVATION_INVALID/);
});
test('field/total size bounds fail explicitly, and clock reversal is retained without a timing assertion',()=>{
 const v=values();v.PATH='x'.repeat(4097);assert.throws(()=>parse(bytes(v)),/RESOLUTION_OBSERVATION_INVALID/);
 assert.throws(()=>parse(Buffer.alloc(32769)),/RESOLUTION_OBSERVATION_INVALID/);
 v.PATH='x'.repeat(4096);v.captureEndedUtcTicks='638899999999999999';const s=parse(bytes(v));assert.equal(s.collectionClockMovedBackwards,true);
 assert.throws(()=>parseResolutionObservation(bytes().toString(),{token,pid}),/RESOLUTION_OBSERVATION_INVALID/);
});
for(const key of ['version',...Object.keys(resolutionObservationFields).filter(k=>k.startsWith('assembly.'))]){
 test('RO-1 rejects impossible .NET version component in '+key,()=>{
  for(const bad of ['2147483648.0','0.2147483648','0.0.2147483648','0.0.0.2147483648','9999999999.0']){
   const v=values();v[key]=bad;assert.throws(()=>parse(bytes(v)),/RESOLUTION_OBSERVATION_INVALID/);
  }
  const v=values();v[key]='2147483647.0.2147483647.0';assert.equal(parse(bytes(v)).fields[key],v[key]);
 });
}
