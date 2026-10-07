param([Parameter(Mandatory=$true)][string]$DescriptorPath)
$ErrorActionPreference = 'Stop'
$probeInput = [IO.File]::ReadAllText($DescriptorPath) | ConvertFrom-Json
$probeRoot = [IO.Path]::GetFullPath([string]$probeInput.root)
$probeApp = [IO.Path]::GetFullPath([string]$probeInput.appPath)
$probeLauncherPath = Join-Path $probeRoot 'SIREN.exe'
$probeJournalPath = Join-Path $probeRoot 'Data\Recovery\sessions.json'
$probeCurrentOwner = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$probeLauncher = $null; $probeChild = $null; $probeReady = $null; $probeClosed = $null
$probeResult = [ordered]@{ completed = $false; scope = 'Actual released root launcher --verify, own Unicode preview, native Electron ready acknowledgment, exact owned child graceful WM_CLOSE, launcher exit and clean-close journal. No screenshot, clean-PC, signed update or hostile directory-race qualification.'; checks = @(); root = $probeRoot; error = $null }

function Read-ProbeJournal {
  if (!(Test-Path -LiteralPath $probeJournalPath)) { return $null }
  if ((Get-Item -LiteralPath $probeJournalPath).Length -gt 4194304) { throw 'Owned probe journal exceeds 4 MiB' }
  return ([IO.File]::ReadAllText($probeJournalPath) | ConvertFrom-Json)
}
function Get-OwnedChild([int]$ParentId) {
  foreach ($candidate in @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$ParentId")) {
    if (!$candidate.ExecutablePath -or ![string]::Equals([IO.Path]::GetFullPath($candidate.ExecutablePath), $probeApp, [StringComparison]::OrdinalIgnoreCase)) { continue }
    $candidateOwner = Invoke-CimMethod -InputObject $candidate -MethodName GetOwner
    if ($candidateOwner.ReturnValue -ne 0 -or ![string]::Equals(($candidateOwner.Domain + '\' + $candidateOwner.User), $probeCurrentOwner, [StringComparison]::OrdinalIgnoreCase)) { throw 'Native child owner cannot be verified' }
    return $candidate
  }
  return $null
}
function Close-OwnedChild($Identity) {
  if ($null -eq $Identity) { return $false }
  $current = Get-CimInstance Win32_Process -Filter ("ProcessId=" + [int]$Identity.ProcessId) | Select-Object -First 1
  if ($null -eq $current) { return $false }
  if ($current.ParentProcessId -ne $Identity.ParentProcessId -or $current.CreationDate -ne $Identity.CreationDate -or ![string]::Equals($current.ExecutablePath, $Identity.ExecutablePath, [StringComparison]::OrdinalIgnoreCase)) { throw 'Native child identity changed; refuse close' }
  $currentOwner = Invoke-CimMethod -InputObject $current -MethodName GetOwner
  if ($currentOwner.ReturnValue -ne 0 -or ![string]::Equals(($currentOwner.Domain + '\' + $currentOwner.User), $probeCurrentOwner, [StringComparison]::OrdinalIgnoreCase)) { throw 'Native child owner changed; refuse close' }
  $nativeProcess = Get-Process -Id ([int]$current.ProcessId)
  if (![string]::Equals($nativeProcess.Path, $probeApp, [StringComparison]::OrdinalIgnoreCase)) { throw 'Native child executable differs; refuse close' }
  return $nativeProcess.CloseMainWindow()
}

try {
  if (!$probeApp.StartsWith((Join-Path $probeRoot 'App\versions\'), [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath (Join-Path $probeRoot 'Data'))) { throw 'Probe must use a fresh owned preview with Data outside App' }
  $verified = Start-Process -FilePath $probeLauncherPath -ArgumentList '--verify' -WorkingDirectory $probeRoot -WindowStyle Hidden -Wait -PassThru
  if ($verified.ExitCode -ne 0) { throw 'Actual released launcher --verify refused' }
  $probeResult.checks += 'released-root-verify-exit-zero'
  $probeLauncher = Start-Process -FilePath $probeLauncherPath -WorkingDirectory $probeRoot -WindowStyle Hidden -PassThru
  $probeLauncherIdentity = @{ pid = $probeLauncher.Id; path = $probeLauncher.Path; startedAt = $probeLauncher.StartTime.ToUniversalTime().ToString('o') }
  $readyDeadline = [DateTime]::UtcNow.AddSeconds(30)
  while ([DateTime]::UtcNow -lt $readyDeadline) {
    if ($null -eq $probeChild) { $probeChild = Get-OwnedChild $probeLauncher.Id }
    if ($null -ne $probeChild) {
      $journal = Read-ProbeJournal
      $probeReady = @($journal.events | Where-Object { $_.event -eq 'ready' -and $_.processIdentity.pid -eq $probeChild.ProcessId -and [string]::Equals($_.processIdentity.path, $probeApp, [StringComparison]::OrdinalIgnoreCase) }) | Select-Object -Last 1
      if ($null -ne $probeReady) { break }
    }
    $probeLauncher.Refresh(); if ($probeLauncher.HasExited) { throw 'Launcher exited before a matching native readiness acknowledgment' }
    Start-Sleep -Milliseconds 250
  }
  if ($null -eq $probeChild -or $null -eq $probeReady) { throw 'Owned native Electron readiness exceeded 30 seconds; no rollback or data deletion attempted' }
  $probeResult.checks += 'actual-native-electron-ready-matching-owned-process'
  $probeResult.launcherIdentity = $probeLauncherIdentity
  $probeResult.childIdentity = @{ pid = $probeChild.ProcessId; path = $probeChild.ExecutablePath; createdAt = $probeChild.CreationDate.ToUniversalTime().ToString('o') }
  $probeResult.ready = $probeReady
  if (!(Close-OwnedChild $probeChild)) { throw 'Owned native CloseMainWindow did not send WM_CLOSE; no process killed' }
  if (!$probeLauncher.WaitForExit(30000)) { throw 'Owned launcher did not exit after graceful child close; no process killed' }
  if ($probeLauncher.ExitCode -ne 0) { throw 'Native root launcher exited unsuccessfully' }
  $journal = Read-ProbeJournal
  $probeClosed = @($journal.events | Where-Object { $_.event -eq 'clean-close' -and $_.sessionId -eq $probeReady.sessionId -and $_.processIdentity.pid -eq $probeChild.ProcessId }) | Select-Object -Last 1
  if ($null -eq $probeClosed -or $journal.events[-1].event -ne 'clean-close') { throw 'No matching final clean-close acknowledgment in the native journal' }
  $probeResult.checks += 'exact-owned-child-native-WM_CLOSE'
  $probeResult.checks += 'root-launcher-exit-zero-and-matching-clean-close'
  $probeResult.closed = $probeClosed
  if (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $probeApp) 'Data')) { throw 'Native data unexpectedly created inside application version' }
  $probeResult.checks += 'native-Data-outside-App'
  $probeResult.completed = $true
} catch {
  $probeResult.error = $_.Exception.Message.Substring(0, [Math]::Min(4096, $_.Exception.Message.Length))
  if ($null -ne $probeChild) { try { $null = Close-OwnedChild $probeChild } catch { $probeResult.closeCleanupError = $_.Exception.Message } }
} finally {
  [IO.File]::WriteAllText([string]$probeInput.resultPath, ($probeResult | ConvertTo-Json -Depth 12), (New-Object Text.UTF8Encoding($false)))
}
$probeResult | ConvertTo-Json -Depth 12 -Compress
if (!$probeResult.completed) { exit 1 }
