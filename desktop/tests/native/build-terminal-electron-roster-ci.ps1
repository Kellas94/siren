$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true' -or $env:GITHUB_REPOSITORY -ne 'Kellas94/siren' -or $env:GITHUB_REF -ne 'refs/heads/probe/terminal-roster-20261010'){throw 'EXACT_HOSTED_CONTEXT_REQUIRED'}
if($env:GITHUB_RUN_ID -notmatch '^\d+$' -or $env:GITHUB_RUN_ATTEMPT -notmatch '^\d+$' -or $env:GITHUB_SHA -notmatch '^[a-f0-9]{40}$'){throw 'RUN_IDENTITY_REQUIRED'}
$taskRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../..')).Path
$taskNode=(Get-Command node.exe -CommandType Application).Source
if((& $taskNode --version) -ne 'v24.16.0' -or $LASTEXITCODE -ne 0){throw 'EXACT_NODE_REQUIRED'}
$taskOut=Join-Path $taskRoot ('desktop/evidence/terminal-electron-roster/'+$env:GITHUB_RUN_ID+'-'+$env:GITHUB_RUN_ATTEMPT)
New-Item -ItemType Directory -Path $taskOut -ErrorAction Stop | Out-Null
function Task-Pin([string]$TaskPath){$taskFile=Get-Item -LiteralPath $TaskPath;return [ordered]@{path=$taskFile.FullName;bytes=$taskFile.Length;sha256=(Get-FileHash -LiteralPath $TaskPath -Algorithm SHA256).Hash.ToLowerInvariant()}}
$taskReceipt=[ordered]@{scope='ELECTRON_TARGET_BUILD_ONLY';status='STARTED_NOT_QUALIFIED';nativeExecutionAdmitted=$false;commit=$env:GITHUB_SHA;run=$env:GITHUB_RUN_ID;attempt=$env:GITHUB_RUN_ATTEMPT;image=$env:ImageVersion;target='44.5.1';arch='x64';napi=10;delayLoadHook=$false;inputs=@();trackedInputs=@();startedUtc=[DateTime]::UtcNow.ToString('o')}
try{
 $taskCandidate=Join-Path $taskOut 'candidate';$taskDeps=Join-Path $taskOut 'deps'
 New-Item -ItemType Directory -Path $taskCandidate,$taskDeps | Out-Null
 foreach($taskName in @('ownership.cc','peer-endpoints.inc','binding.gyp')){ $taskSource=Join-Path $taskRoot ('desktop/native/terminal-host-roster-candidate/'+$taskName);$taskReceipt.inputs+=,(Task-Pin $taskSource);Copy-Item -LiteralPath $taskSource -Destination (Join-Path $taskCandidate $taskName) }
 $taskReceipt.sourceSha256=(Task-Pin (Join-Path $taskCandidate 'ownership.cc')).sha256;$taskReceipt.includeSha256=(Task-Pin (Join-Path $taskCandidate 'peer-endpoints.inc')).sha256
 if($taskReceipt.sourceSha256 -ne 'd7014c6401e4e1186f3180a7377594cd044b16a84006a0ef38d6b6903c366fdd' -or $taskReceipt.includeSha256 -ne 'aa4ccd3428a1c547a5e8dccc1116ebab45a3be6972c1229903db36c5081be476'){throw 'CORRECTED_SOURCE_REQUIRED'}
 foreach($taskName in @('package.json','package-lock.json')){ $taskSource=Join-Path $taskRoot ('desktop/'+$taskName);$taskReceipt.inputs+=,(Task-Pin $taskSource);Copy-Item -LiteralPath $taskSource -Destination (Join-Path $taskDeps $taskName) }
 $taskNpm=Join-Path (Split-Path -Parent $taskNode) 'node_modules/npm/bin/npm-cli.js'
 & $taskNode $taskNpm --prefix $taskDeps ci --ignore-scripts --no-audit --no-fund 2>&1 | Tee-Object -FilePath (Join-Path $taskOut 'npm-ci.txt');if($LASTEXITCODE -ne 0){throw 'LOCKED_DEPENDENCY_INSTALL_FAILED'}
 $taskElectronPackage=Join-Path $taskDeps 'node_modules/electron/package.json'
 if((Get-Content -LiteralPath $taskElectronPackage -Raw | ConvertFrom-Json).version -ne '44.5.1'){throw 'EXACT_ELECTRON_REQUIRED'}
 $taskInstall=Join-Path $taskDeps 'node_modules/electron/install.js'
 & $taskNode $taskInstall 2>&1 | Tee-Object -FilePath (Join-Path $taskOut 'electron-install.txt');if($LASTEXITCODE -ne 0){throw 'ELECTRON_DISTRIBUTION_INSTALL_FAILED'}
 $taskReceipt.executable=Task-Pin (Join-Path $taskDeps 'node_modules/electron/dist/electron.exe')
 $taskGyp=Join-Path (Split-Path -Parent $taskNode) 'node_modules/npm/node_modules/node-gyp'
 if((Get-Content -LiteralPath (Join-Path $taskGyp 'package.json') -Raw | ConvertFrom-Json).version -ne '12.3.0'){throw 'EXACT_BUILD_TOOL_REQUIRED'}
 $taskHook=Join-Path $taskGyp 'src/win_delay_load_hook.cc';$taskReceipt.hook=Task-Pin $taskHook
 $taskLocator=Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
 $taskVs=@(& $taskLocator -products '*' -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath)
 if($LASTEXITCODE -ne 0 -or $taskVs.Count -ne 1){throw 'EXACT_COMPILER_DISCOVERY_REQUIRED'}
 $taskMsvc=(Get-ChildItem -LiteralPath (Join-Path $taskVs[0] 'VC/Tools/MSVC') -Directory | Where-Object {$_.Name -match '^\d+\.\d+\.\d+$'} | Sort-Object {[version]$_.Name} -Descending | Select-Object -First 1).Name
 $taskMsbuild=Join-Path $taskVs[0] 'MSBuild/Current/Bin/amd64/MSBuild.exe'
 $taskPython=(Get-Command python.exe -CommandType Application).Source
 foreach($taskPath in @($taskNode,$taskNpm,$taskInstall,$taskElectronPackage,$taskHook,$taskLocator,$taskMsbuild,$taskPython,$PSCommandPath)){$taskReceipt.inputs+=,(Task-Pin $taskPath)}
 Push-Location -LiteralPath $taskCandidate
 try{
  & $taskNode (Join-Path $taskGyp 'bin/node-gyp.js') configure --target=44.5.1 --arch=x64 --dist-url=https://electronjs.org/headers ('--devdir='+(Join-Path $taskOut 'headers')) --msvs_version=2026 ('--python='+$taskPython) --verbose 2>&1 | Tee-Object -FilePath (Join-Path $taskOut 'configure.txt');if($LASTEXITCODE -ne 0){throw 'ELECTRON_CONFIGURATION_FAILED'}
  & $taskMsbuild 'build/siren_terminal_host_roster_candidate.vcxproj' ('/p:SolutionDir='+(Join-Path $taskCandidate 'build')+'/') /p:Configuration=Release /p:Platform=x64 ('/p:VCToolsVersion='+$taskMsvc) /p:WindowsTargetPlatformVersion=10.0.26100.0 /p:TrackFileAccess=true /verbosity:diagnostic 2>&1 | Tee-Object -FilePath (Join-Path $taskOut 'compile.txt');if($LASTEXITCODE -ne 0){throw 'ELECTRON_TARGET_COMPILE_FAILED'}
 }finally{Pop-Location}
 $taskProject=Get-Content -LiteralPath (Join-Path $taskCandidate 'build/siren_terminal_host_roster_candidate.vcxproj') -Raw
 if($taskProject -notmatch 'win_delay_load_hook.cc' -or $taskProject -notmatch '<DelayLoadDLLs>node.exe(?:;|<)'){throw 'ELECTRON_DELAY_LOAD_CONFIGURATION_REQUIRED'}
 $taskReadLogs=@(Get-ChildItem -LiteralPath (Join-Path $taskCandidate 'build') -Recurse -File -Filter '*.read.*.tlog')
 if($taskReadLogs.Count -eq 0){throw 'COMPILER_TRACKING_REQUIRED'}
 $taskTracked=@($taskReadLogs | ForEach-Object {Get-Content -LiteralPath $_.FullName -Encoding Unicode} | ForEach-Object {$_.Trim()} | Where-Object {$_ -and -not $_.StartsWith('^') -and [IO.Path]::IsPathRooted($_)} | Sort-Object -Unique)
 foreach($taskPath in $taskTracked){$taskReceipt.trackedInputs+=,(Task-Pin $taskPath)}
 if(-not ($taskTracked | Where-Object {$_ -match '[\\/]win_delay_load_hook.cc$'}) -or -not ($taskTracked | Where-Object {$_ -match '[\\/]node_api.h$'}) -or -not ($taskTracked | Where-Object {$_ -match '[\\/]windows.h$'})){throw 'ACTUAL_TARGET_COMPILER_INPUTS_REQUIRED'}
 $taskReceipt.delayLoadHook=$true;$taskReceipt.binary=Task-Pin (Join-Path $taskCandidate 'build/Release/siren_terminal_host_roster_candidate.node')
 $taskReceipt.runtimeDistribution=@(Get-ChildItem -LiteralPath (Join-Path $taskDeps 'node_modules/electron/dist') -Recurse -File | ForEach-Object {Task-Pin $_.FullName})
 $taskReceipt.buildToolInputs=@(Get-ChildItem -LiteralPath $taskGyp -Recurse -File | ForEach-Object {Task-Pin $_.FullName})
 foreach($taskPin in $taskReceipt.inputs){if((Task-Pin $taskPin.path).sha256 -ne $taskPin.sha256){throw 'INPUT_DRIFT'}}
 $taskReceipt.status='COMPILED_ELECTRON_TARGET_NOT_RUNTIME_QUALIFIED'
}catch{$taskReceipt.status='BUILD_FAILED';$taskReceipt.error=$_.Exception.Message;throw}
finally{$taskReceipt.finishedUtc=[DateTime]::UtcNow.ToString('o');$taskReceipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $taskOut 'build-result.json') -Encoding utf8}
