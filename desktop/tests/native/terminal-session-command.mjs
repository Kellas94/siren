// Fixed finite hosted fixture; never accepts script content or user commands.
import {win32 as path} from 'node:path';
const quote=s=>"'"+s.replaceAll("'","''")+"'";
export function createLockContinuationFixture({projectDirectory,token}={}){
 if(typeof projectDirectory!=='string'||!projectDirectory.isWellFormed()||projectDirectory.length>2048||
  !/^[A-Za-z]:\\/.test(projectDirectory)||/[\x00-\x1f\x7f<>"|?*]/.test(projectDirectory)||projectDirectory.slice(2).includes(':')||
  projectDirectory.slice(3).split('\\').some(p=>!p||p==='.'||p==='..'||/[ .]$/.test(p)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))||
  typeof token!=='string'||!/^[a-f0-9]{32}$/.test(token))throw TypeError('Literal local fixture path and token required');
 const scriptPath=path.join(projectDirectory,'lock-continuation.ps1'),startedPath=path.join(projectDirectory,'started.txt'),releasePath=path.join(projectDirectory,'release.txt'),completedPath=path.join(projectDirectory,'completed.txt'),forbiddenPath=path.join(projectDirectory,'forbidden.txt'),stagePath=path.join(projectDirectory,'fixture-stage.txt');
 const script=`$ErrorActionPreference = 'Stop'\r\n$started = ${quote(startedPath)}\r\n$release = ${quote(releasePath)}\r\n$completed = ${quote(completedPath)}\r\n$stage = ${quote(stagePath)}\r\n[IO.File]::WriteAllText($started, ${quote(token)})\r\nfor ($i=0; $i -lt 300; $i++) {\r\n  [IO.File]::WriteAllText($stage, ('checking:' + $i))\r\n  if ([IO.File]::Exists($release)) {\r\n    [IO.File]::WriteAllText($stage, 'release-observed')\r\n    if ([IO.File]::ReadAllText($release) -ne ${quote(token)}) { throw 'SIREN_TEST_RELEASE_MISMATCH' }\r\n    [IO.File]::WriteAllText($stage, 'release-validated')\r\n    [IO.File]::WriteAllText($completed, ${quote(token)})\r\n    Write-Output 'SIREN_LOCK_CONTINUATION_COMPLETE'\r\n    return\r\n  }\r\n  [IO.File]::WriteAllText($stage, ('sleeping:' + $i))\r\n  Start-Sleep -Milliseconds 100\r\n}\r\nthrow 'SIREN_TEST_RELEASE_TIMEOUT'\r\n`;
 return Object.freeze({scriptPath,script,startedPath,releasePath,completedPath,forbiddenPath,stagePath,expected:token,input:`& ${quote(scriptPath)}\r`,forbiddenInput:`[IO.File]::WriteAllText(${quote(forbiddenPath)}, ${quote(token)})\r`});
}

// Distinct finite fixture, not a correction/qualification of Start-Sleep.
// It keeps the original command and all proof files; only the wait primitive
// changes to an in-process .NET call without cmdlet/module resolution.
export function createInProcessLockContinuationFixture(options){
 const original=createLockContinuationFixture(options);
 return Object.freeze({...original,variant:'IN_PROCESS_THREAD_SLEEP',script:original.script.replace('  Start-Sleep -Milliseconds 100\r\n','  [Threading.Thread]::Sleep(100)\r\n')});
}

// A separate diagnostic fixture preserves the mandatory pipeline marker.
// Its distinct direct-console marker and stages locate output stalls; they
// cannot satisfy the original completion/history assertion by themselves.
export function createOutputDiagnosticContinuationFixture(options){
 const original=createInProcessLockContinuationFixture(options);
 const output="    Write-Output 'SIREN_LOCK_CONTINUATION_COMPLETE'\r\n";
 const instrumented="    [IO.File]::WriteAllText($stage, 'before-direct-output')\r\n    [Console]::WriteLine('SIREN_DIRECT_CONSOLE_CONTROL')\r\n    [IO.File]::WriteAllText($stage, 'before-pipeline-output')\r\n"+output+"    [IO.File]::WriteAllText($stage, 'after-pipeline-output')\r\n";
 return Object.freeze({...original,variant:'IN_PROCESS_WAIT_OUTPUT_DIAGNOSTIC',script:original.script.replace(output,instrumented)});
}

// Distinct .NET-only wait/output path. It does not qualify PowerShell cmdlets
// or replace the original/diagnostic fixtures and their adverse observations.
export function createDirectConsoleContinuationFixture(options){
 const original=createInProcessLockContinuationFixture(options);
 return Object.freeze({...original,variant:'IN_PROCESS_WAIT_DIRECT_CONSOLE',script:original.script.replace("    Write-Output 'SIREN_LOCK_CONTINUATION_COMPLETE'\r\n","    [Console]::WriteLine('SIREN_LOCK_CONTINUATION_COMPLETE')\r\n")});
}
