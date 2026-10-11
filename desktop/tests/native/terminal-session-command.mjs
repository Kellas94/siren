// Fixed finite hosted fixture; never accepts script content or user commands.
import {win32 as path} from 'node:path';
const quote=s=>"'"+s.replaceAll("'","''")+"'";
export function createLockContinuationFixture({projectDirectory,token}={}){
 if(typeof projectDirectory!=='string'||!projectDirectory.isWellFormed()||projectDirectory.length>2048||
  !/^[A-Za-z]:\\/.test(projectDirectory)||/[\x00-\x1f\x7f<>"|?*]/.test(projectDirectory)||projectDirectory.slice(2).includes(':')||
  projectDirectory.slice(3).split('\\').some(p=>!p||p==='.'||p==='..'||/[ .]$/.test(p)||/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p))||
  typeof token!=='string'||!/^[a-f0-9]{32}$/.test(token))throw TypeError('Literal local fixture path and token required');
 const scriptPath=path.join(projectDirectory,'lock-continuation.ps1'),startedPath=path.join(projectDirectory,'started.txt'),releasePath=path.join(projectDirectory,'release.txt'),completedPath=path.join(projectDirectory,'completed.txt'),forbiddenPath=path.join(projectDirectory,'forbidden.txt');
 const script=`$ErrorActionPreference = 'Stop'\r\n$started = ${quote(startedPath)}\r\n$release = ${quote(releasePath)}\r\n$completed = ${quote(completedPath)}\r\n[IO.File]::WriteAllText($started, ${quote(token)})\r\nfor ($i=0; $i -lt 300; $i++) {\r\n  if ([IO.File]::Exists($release)) {\r\n    if ([IO.File]::ReadAllText($release) -ne ${quote(token)}) { throw 'SIREN_TEST_RELEASE_MISMATCH' }\r\n    [IO.File]::WriteAllText($completed, ${quote(token)})\r\n    Write-Output 'SIREN_LOCK_CONTINUATION_COMPLETE'\r\n    return\r\n  }\r\n  Start-Sleep -Milliseconds 100\r\n}\r\nthrow 'SIREN_TEST_RELEASE_TIMEOUT'\r\n`;
 return Object.freeze({scriptPath,script,startedPath,releasePath,completedPath,forbiddenPath,expected:token,input:`& ${quote(scriptPath)}\r`,forbiddenInput:`[IO.File]::WriteAllText(${quote(forbiddenPath)}, ${quote(token)})\r`});
}
