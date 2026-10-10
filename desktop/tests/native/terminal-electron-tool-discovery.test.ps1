# Pure PowerShell discovery DATA fixture. Never starts an executable/compiler.
$ErrorActionPreference='Stop'
$taskSource=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'build-terminal-electron-roster-ci.ps1')
$taskLines=@($taskSource | Where-Object {$_ -match '^\s*\$task(Node|Python)=\(Get-Command '})
if($taskLines.Count -ne 2){throw 'EXACT_DISCOVERY_ASSIGNMENTS_REQUIRED'}
$script:taskCandidates=@()
function Get-Command {param($Name,$CommandType) foreach($taskCandidate in $script:taskCandidates){[pscustomobject]@{Source=$taskCandidate}}}
$taskChecks=0
foreach($taskLine in $taskLines){
 foreach($taskCount in @(1,2)){
  $script:taskCandidates=@('C:\hostedtoolcache\windows\node\24.16.0\x64\node.exe')
  if($taskCount -eq 2){$script:taskCandidates+=,'C:\Program Files\nodejs\node.exe'}
  Invoke-Expression $taskLine
  $taskActual=if($taskLine -match '^\s*\$taskNode='){$taskNode}else{$taskPython}
  if($taskActual -isnot [string] -or $taskActual -cne $script:taskCandidates[0]){throw "DISCOVERY_MUST_SELECT_FIRST_PATH:count=$taskCount"}
  $taskChecks++
 }
}
Write-Output "PURE_DISCOVERY_CASES=$taskChecks PASSED; no executable started"
