# Exercise only the actual workflow Python-discovery statements as data.
# Fake Get-Command prevents interpreter, compiler, or Terminal execution.
$ErrorActionPreference = 'Stop'
$taskWorkflow = Join-Path $PSScriptRoot '../../../.github/workflows/terminal-fresh-runtime-pair.yml'
$taskLines = @(Get-Content -LiteralPath $taskWorkflow | Where-Object { $_ -match '^\s*\$pythonCommand = Get-Command python.exe' -or $_ -match '^\s*if \(@\(\$pythonCommand\).Count' })
if ($taskLines.Count -ne 2) { throw 'EXACT_DISCOVERY_STATEMENTS_REQUIRED' }
function Get-Command {
  param($Name, $CommandType, $ErrorAction)
  if ($Name -cne 'python.exe' -or $CommandType -cne 'Application') { throw 'UNEXPECTED_DISCOVERY' }
  if (!$script:taskCandidates.Count) { throw 'NO_PYTHON_APPLICATION' }
  foreach ($taskCandidate in $script:taskCandidates) { [pscustomobject]@{ Source = $taskCandidate } }
}
$taskCases = @(
  @{ name = 'one interpreter'; candidates = @('C:\Python312\python.exe'); expected = 'C:\Python312\python.exe' },
  @{ name = 'PATH precedence with WindowsApps alias'; candidates = @('C:\Python312\python.exe', 'C:\WindowsApps\python.exe'); expected = 'C:\Python312\python.exe' },
  @{ name = 'ordered multiple installations'; candidates = @('D:\Python313\python.exe', 'C:\Python312\python.exe', 'C:\WindowsApps\python.exe'); expected = 'D:\Python313\python.exe' },
  @{ name = 'missing interpreter'; candidates = @(); expected = $null }
)
$taskPassed = 0
foreach ($taskCase in $taskCases) {
  $script:taskCandidates = $taskCase.candidates
  $pythonCommand = $null
  $taskError = $null
  try { foreach ($taskLine in $taskLines) { Invoke-Expression $taskLine } } catch { $taskError = $_ }
  if ($null -eq $taskCase.expected) {
    if ($null -eq $taskError -or $taskError.Exception.Message -cne 'NO_PYTHON_APPLICATION') { throw 'MISSING_INTERPRETER_MUST_REFUSE' }
  } else {
    if ($taskError) { throw $taskError }
    if (@($pythonCommand).Count -ne 1 -or $pythonCommand.Source -cne $taskCase.expected) { throw ('WRONG_PATH_PRECEDENCE: ' + $taskCase.name) }
  }
  $taskPassed++
}
Write-Output "PURE_WORKFLOW_PYTHON_DISCOVERY_CASES=$taskPassed PASSED; no executable started"
