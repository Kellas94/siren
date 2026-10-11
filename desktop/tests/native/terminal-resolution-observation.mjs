// Hosted diagnostic DATA only. This module never executes its PowerShell text.
import {win32 as path} from 'node:path';
import {TextDecoder} from 'node:util';
import {createComparedCmdletFixture} from './terminal-discovery-fixture.mjs';

export const resolutionObservationCases=Object.freeze([
 Object.freeze({armId:'qualified-write-output-state',mode:'module-qualified',control:'write-output'}),
 Object.freeze({armId:'original-write-output-state',mode:'original',control:'write-output'}),
]);
export const resolutionObservationFields=Object.freeze({
 token:32,effectiveModulePath:4096,PSHOME:1024,version:128,PID:16,languageMode:32,
 autoloadPreference:64,PATH:4096,PATHEXT:1024,
 'assembly.System.Management.Automation':128,
 'assembly.Microsoft.PowerShell.Commands.Utility':128,
 'assembly.Microsoft.PowerShell.Commands.Management':128,
 'assembly.Microsoft.PowerShell.ConsoleHost':128,
 captureStartedUtcTicks:32,captureEndedUtcTicks:32,
});
const header='SIREN_RESOLUTION_STATE_V1',keys=Object.keys(resolutionObservationFields);
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const invalid=()=>{throw Error('RESOLUTION_OBSERVATION_INVALID');};
const version=/^(?:0|[1-9][0-9]{0,9})(?:\.(?:0|[1-9][0-9]{0,9})){1,3}$/;
const validVersion=value=>version.test(value)&&value.split('.').every(component=>Number(component)<=0x7fffffff);
const ticks=value=>/^(?:0|[1-9][0-9]{0,18})$/.test(value)&&BigInt(value)<=3155378975999999999n;

export function parseResolutionObservation(buffer,{token,pid}={}){
 try{
  if(!Buffer.isBuffer(buffer)||buffer.length>32768||!(/^[a-f0-9]{32}$/).test(token)||!Number.isInteger(pid)||pid<=0||pid>0xffffffff)invalid();
  const data=buffer.subarray(buffer.subarray(0,3).equals(Buffer.from([239,187,191]))?3:0);
  const decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true});
  const rows=decoder.decode(data).split('\r\n');
  if(rows.length!==keys.length+2||rows[0]!==header||rows.at(-1)!=='')invalid();
  const fields={};
  for(let i=0;i<keys.length;i++){
   const key=keys[i],parts=rows[i+1].split('\t');
   if(parts.length!==2||parts[0]!==key||!(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).test(parts[1]))invalid();
   const raw=Buffer.from(parts[1],'base64');
   if(raw.length>resolutionObservationFields[key]||raw.toString('base64')!==parts[1])invalid();
   fields[key]=decoder.decode(raw);
  }
  if(fields.token!==token||fields.PID!==String(pid)||!validVersion(fields.version)||
   !['FullLanguage','RestrictedLanguage','ConstrainedLanguage','NoLanguage'].includes(fields.languageMode)||
   !['unset','null','present:All','present:ModuleQualified','present:None'].includes(fields.autoloadPreference)||
   !(fields.PATHEXT==='absent'||fields.PATHEXT.startsWith('present:'))||
   !ticks(fields.captureStartedUtcTicks)||!ticks(fields.captureEndedUtcTicks))invalid();
  for(const key of keys.filter(k=>k.startsWith('assembly.')))if(fields[key]!=='absent'&&!validVersion(fields[key]))invalid();
  return Object.freeze({fields:Object.freeze(fields),pid,
   collectionClockMovedBackwards:BigInt(fields.captureEndedUtcTicks)<BigInt(fields.captureStartedUtcTicks)});
 }catch{invalid();}
}

export function createResolutionObservationFixture({projectDirectory,token,control,mode}={}){
 if(control!=='write-output')throw TypeError('Fixed observation target required');
 const original=createComparedCmdletFixture({projectDirectory,token,control,mode});
 const observationPath=path.join(projectDirectory,'resolution-state.tsv');
 const assemblyNames=keys.filter(k=>k.startsWith('assembly.')).map(k=>k.slice(9));
 const lines=[
  "[IO.File]::WriteAllText($stage, 'observation-started')",
  'try {',
  ' $sirenStarted = [DateTime]::UtcNow.Ticks.ToString([Globalization.CultureInfo]::InvariantCulture)',
  ' $sirenEncoding = [Text.UTF8Encoding]::new($true, $true)',
  ` $sirenFinal = ${quote(observationPath)}`,
  ` $sirenPending = ${quote(observationPath+'.pending')}`,
  ' $sirenPreference = $ExecutionContext.SessionState.PSVariable.Get(\'PSModuleAutoLoadingPreference\')',
  " $sirenAutoload = 'unset'",
  ' if ($null -ne $sirenPreference) {',
  "  if ($null -eq $sirenPreference.Value) { $sirenAutoload = 'null' } else {",
  '   $sirenValue = $sirenPreference.Value',
  "   if ($sirenValue.GetType().FullName -ne 'System.String' -and $sirenValue.GetType().FullName -ne 'System.Management.Automation.PSModuleAutoLoadingPreference') { throw 'RESOLUTION_OBSERVATION_INVALID' }",
  '   $sirenPreferenceText = $sirenValue.ToString()',
  "   if ($sirenPreferenceText -cnotin @('All','ModuleQualified','None')) { throw 'RESOLUTION_OBSERVATION_INVALID' }",
  "   $sirenAutoload = 'present:' + $sirenPreferenceText",
  '  }',
  ' }',
  " $sirenExtension = [Environment]::GetEnvironmentVariable('PATHEXT', [EnvironmentVariableTarget]::Process)",
  " $sirenExtensionState = 'absent'",
  " if ($null -ne $sirenExtension) { $sirenExtensionState = 'present:' + $sirenExtension }",
  ' $sirenValues = @{',
  `  token = ${quote(token)}`,
  '  effectiveModulePath = [string]$env:PSModulePath',
  '  PSHOME = [string]$PSHOME',
  '  version = $PSVersionTable.PSVersion.ToString()',
  '  PID = $PID.ToString([Globalization.CultureInfo]::InvariantCulture)',
  '  languageMode = $ExecutionContext.SessionState.LanguageMode.ToString()',
  '  autoloadPreference = $sirenAutoload',
  '  PATH = [string]$env:PATH',
  '  PATHEXT = $sirenExtensionState',
  ...assemblyNames.map(n=>`  ${quote('assembly.'+n)} = 'absent'`),
  '  captureStartedUtcTicks = $sirenStarted',
  ' }',
  ` $sirenAssemblyNames = @(${assemblyNames.map(quote).join(',')})`,
  ' $sirenSeen = @{}',
  ' $sirenAssemblies = [AppDomain]::CurrentDomain.GetAssemblies()',
  " if ($sirenAssemblies.Length -gt 256) { throw 'RESOLUTION_OBSERVATION_INVALID' }",
  ' foreach ($sirenAssembly in $sirenAssemblies) {',
  '  $sirenAssemblyName = $sirenAssembly.GetName()',
  '  if ($sirenAssemblyNames -ccontains $sirenAssemblyName.Name) {',
  "   if ($sirenSeen.ContainsKey($sirenAssemblyName.Name)) { throw 'RESOLUTION_OBSERVATION_INVALID' }",
  '   $sirenSeen[$sirenAssemblyName.Name] = $true',
  "   $sirenValues['assembly.' + $sirenAssemblyName.Name] = $sirenAssemblyName.Version.ToString()",
  '  }',
  ' }',
  " $sirenValues['captureEndedUtcTicks'] = [DateTime]::UtcNow.Ticks.ToString([Globalization.CultureInfo]::InvariantCulture)",
  ` $sirenKeys = @(${keys.map(quote).join(',')})`,
  ` $sirenCaps = @{${keys.map(k=>quote(k)+' = '+resolutionObservationFields[k]).join('; ')}}`,
  ' $sirenBuilder = [Text.StringBuilder]::new()',
  ` [void]$sirenBuilder.Append(${quote(header)}).Append("\x60r\x60n")`,
  ' foreach ($sirenKey in $sirenKeys) {',
  '  $sirenBytes = $sirenEncoding.GetBytes([string]$sirenValues[$sirenKey])',
  "  if ($sirenBytes.Length -gt $sirenCaps[$sirenKey]) { throw 'RESOLUTION_OBSERVATION_INVALID' }",
  '  [void]$sirenBuilder.Append($sirenKey).Append("\x60t").Append([Convert]::ToBase64String($sirenBytes)).Append("\x60r\x60n")',
  ' }',
  ' $sirenText = $sirenBuilder.ToString()',
  " if ($sirenEncoding.GetByteCount($sirenText) + $sirenEncoding.GetPreamble().Length -gt 32768) { throw 'RESOLUTION_OBSERVATION_INVALID' }",
  ' [IO.File]::WriteAllText($sirenPending, $sirenText, $sirenEncoding)',
  ' [IO.File]::Move($sirenPending, $sirenFinal)',
  " [IO.File]::WriteAllText($stage, 'observation-written')",
  "} catch { [IO.File]::WriteAllText($stage, 'observation-invalid'); throw }",
 ];
 const anchor="[IO.File]::WriteAllText($stage, 'entered')\r\n";
 if(original.script.split(anchor).length!==2)throw Error('Original fixed observation anchor changed');
 return Object.freeze({...original,variant:original.variant+'_PRETARGET_RESOLUTION_STATE_V1',observationPath,
  script:original.script.replace(anchor,anchor+lines.join('\r\n')+'\r\n')});
}

// Fixed entry points keep worker selection outside caller-provided options.
export function createOriginalResolutionFixture({projectDirectory,token,control}={}){
 return createResolutionObservationFixture({projectDirectory,token,control,mode:'original'});
}
export function createQualifiedResolutionFixture({projectDirectory,token,control}={}){
 return createResolutionObservationFixture({projectDirectory,token,control,mode:'module-qualified'});
}
