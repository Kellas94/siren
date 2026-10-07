$ErrorActionPreference = 'Stop'
$taskToolRoot = Join-Path $PSScriptRoot '.toolchains'
New-Item -ItemType Directory -Path $taskToolRoot -Force | Out-Null
$installerPath = Join-Path $taskToolRoot 'rustup-init-1.29.1.exe'
$installerUrl = 'https://static.rust-lang.org/rustup/archive/1.29.1/x86_64-pc-windows-gnu/rustup-init.exe'
Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath
$checksumContent = (Invoke-WebRequest -Uri ($installerUrl + '.sha256')).Content
$checksumText = if ($checksumContent -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($checksumContent) } else { [string]$checksumContent }
$expectedInstallerSha = ($checksumText.Trim() -split '\s+')[0].ToUpperInvariant()
$actualInstallerSha = (Get-FileHash -LiteralPath $installerPath -Algorithm SHA256).Hash
if ($expectedInstallerSha -notmatch '^[A-F0-9]{64}$' -or $expectedInstallerSha -ne $actualInstallerSha) { throw 'Official rustup installer checksum mismatch' }
$env:CARGO_HOME = Join-Path $taskToolRoot 'cargo'
$env:RUSTUP_HOME = Join-Path $taskToolRoot 'rustup'
# Scope installation to this workspace; do not change system/user PATH, registry or install Visual Studio.
$installerProcess = Start-Process -FilePath $installerPath -ArgumentList @('-y', '--no-modify-path', '--profile', 'minimal', '--default-host', 'x86_64-pc-windows-gnu', '--default-toolchain', '1.99.0') -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $taskToolRoot 'install-output.txt') -RedirectStandardError (Join-Path $taskToolRoot 'install-error.txt')
Get-Content -LiteralPath (Join-Path $taskToolRoot 'install-output.txt')
Get-Content -LiteralPath (Join-Path $taskToolRoot 'install-error.txt')
if ($installerProcess.ExitCode -ne 0) { throw 'Workspace-scoped Rust installation failed' }
& (Join-Path $env:CARGO_HOME 'bin/rustc.exe') --version --verbose
if ($LASTEXITCODE -ne 0) { throw 'Installed compiler verification failed' }
Write-Output ('rustupInstallerSHA256=' + $actualInstallerSha)
