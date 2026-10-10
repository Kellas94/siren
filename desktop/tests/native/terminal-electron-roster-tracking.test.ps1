param([string]$TaskActualBuildRoot='')
# Pure DATA regression: evaluate only the tracking assignment, never the builder.
$ErrorActionPreference='Stop'
$taskSource=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'build-terminal-electron-roster-ci.ps1')
$taskAssignments=@($taskSource | Where-Object {$_ -match '^\s*\$taskTracked=@\('})
if($taskAssignments.Count -ne 1){throw 'EXACT_TRACKING_ASSIGNMENT_REQUIRED'}
$taskActualLines=@()
if($TaskActualBuildRoot){
 $taskActualLines=@(Get-ChildItem -LiteralPath $TaskActualBuildRoot -Recurse -File -Filter '*.read.*.tlog' | ForEach-Object {Get-Content -LiteralPath $_.FullName -Encoding Unicode})
 if($taskActualLines.Count -eq 0){throw 'ACTUAL_TRACKING_DATA_REQUIRED'}
}
function Test-TaskTracking([string[]]$TaskLines,[string[]]$TaskExpected){
 $taskReadLogs=@([pscustomobject]@{FullName='DATA_ONLY_NOT_A_FILE'})
 function Get-Content {param($LiteralPath,$Encoding) if($LiteralPath -cne 'DATA_ONLY_NOT_A_FILE' -or $Encoding -cne 'Unicode'){throw 'DATA_ONLY_READ_REQUIRED'};$TaskLines}
 Invoke-Expression $taskAssignments[0]
 $taskExpectedSorted=@($TaskExpected | Sort-Object -Unique)
 if(@($taskTracked).Count -ne $taskExpectedSorted.Count -or (Compare-Object @($taskTracked) $taskExpectedSorted)){throw 'TRACKING_SOURCE_ROOTS_MUST_NOT_BE_DROPPED'}
}
$taskCases=@(
 @{lines=@('^C:\TOOLS\WIN_DELAY_LOAD_HOOK.CC','D:\HEADERS\NODE_API.H','C:\SDK\WINDOWS.H');expected=@('C:\TOOLS\WIN_DELAY_LOAD_HOOK.CC','D:\HEADERS\NODE_API.H','C:\SDK\WINDOWS.H')},
 @{lines=@('^D:\BUILD\OWNERSHIP.OBJ|D:\BUILD\WIN_DELAY_LOAD_HOOK.OBJ','D:\HEADERS\NODE.LIB');expected=@('D:\BUILD\OWNERSHIP.OBJ','D:\BUILD\WIN_DELAY_LOAD_HOOK.OBJ','D:\HEADERS\NODE.LIB')},
 @{lines=@('','  ','^C:\TOOLS\HOOK.CC','C:\SDK\WINDOWS.H','C:\SDK\WINDOWS.H');expected=@('C:\TOOLS\HOOK.CC','C:\SDK\WINDOWS.H')},
 @{lines=@('C:\SDK\WINDOWS.H','D:\HEADERS\NODE_API.H');expected=@('C:\SDK\WINDOWS.H','D:\HEADERS\NODE_API.H')}
)
foreach($taskCase in $taskCases){Test-TaskTracking $taskCase.lines $taskCase.expected}
$taskActualCount=0
if($taskActualLines.Count){
 $taskExpected=@($taskActualLines | ForEach-Object {if($_.StartsWith('^')){$_.Substring(1).Split('|')}else{$_}} | Where-Object {$_ -and [IO.Path]::IsPathRooted($_)} | Sort-Object -Unique)
 Test-TaskTracking $taskActualLines $taskExpected
 foreach($taskName in @('WIN_DELAY_LOAD_HOOK.CC','OWNERSHIP.CC','NODE_API.H','WINDOWS.H','NODE.LIB')){if(-not ($taskExpected | Where-Object {[IO.Path]::GetFileName($_) -ceq $taskName})){throw "ACTUAL_INPUT_REQUIRED:$taskName"}}
 $taskActualCount=$taskExpected.Count
}
Write-Output "PURE_TRACKING_CASES=$($taskCases.Count) PASSED ACTUAL_TRACKED_INPUTS=$taskActualCount; no compiler or artifact executable started"
