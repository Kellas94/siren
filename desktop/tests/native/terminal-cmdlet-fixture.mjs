// Hosted diagnostic DATA builder. No shell/PTY/native import or execution.
// Distinct cold-session controls do not qualify the original Lock scenario.
import {win32 as path} from 'node:path';
import {createLockContinuationFixture} from './terminal-session-command.mjs';
const quote=value=>"'"+value.replaceAll("'","''")+"'";
export function createSingleCmdletFixture({projectDirectory,token,control}={}){
 if(control!=='start-sleep'&&control!=='write-output')throw TypeError('Fixed diagnostic control required');
 // Reuse the original literal local-path/token contract without changing it.
 createLockContinuationFixture({projectDirectory,token});
 const scriptPath=path.join(projectDirectory,'single-cmdlet.ps1');
 const startedPath=path.join(projectDirectory,'started.txt'),stagePath=path.join(projectDirectory,'stage.txt'),completedPath=path.join(projectDirectory,'completed.txt');
 const expectedConsole='SIREN_CMDLET_COMPLETE_'+token,expectedPipeline=control==='write-output'?'SIREN_PIPELINE_CONTROL':null,expectedEntry=control==='write-output'?'SIREN_CMDLET_ENTERED_'+token:null;
 const target=control==='start-sleep'?'Start-Sleep -Milliseconds 100':"Write-Output 'SIREN_PIPELINE_CONTROL'";
 const script=["$ErrorActionPreference = 'Stop'",`$started = ${quote(startedPath)}`,`$stage = ${quote(stagePath)}`,`$completed = ${quote(completedPath)}`,
  `[IO.File]::WriteAllText($started, ${quote(token)})`,"[IO.File]::WriteAllText($stage, 'entered')",...(expectedEntry?[`[Console]::WriteLine(${quote(expectedEntry)})`]:[]),
  `[IO.File]::WriteAllText($stage, 'before-${control}')`,target,`[IO.File]::WriteAllText($stage, 'after-${control}')`,
  `[IO.File]::WriteAllText($completed, ${quote(token)})`,`[Console]::WriteLine(${quote(expectedConsole)})`,''
 ].join('\r\n');
 return Object.freeze({variant:control==='start-sleep'?'SINGLE_CMDLET_START_SLEEP':'SINGLE_CMDLET_WRITE_OUTPUT',control,scriptPath,script,startedPath,stagePath,completedPath,expected:token,input:`& ${quote(scriptPath)}\r`,expectedConsole,expectedPipeline,expectedEntry});
}
