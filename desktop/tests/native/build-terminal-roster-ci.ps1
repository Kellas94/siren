$ErrorActionPreference='Stop'
if($env:GITHUB_ACTIONS -ne 'true' -or $env:GITHUB_REPOSITORY -ne 'Kellas94/siren' -or $env:GITHUB_REF -ne 'refs/heads/probe/terminal-roster-20261010'){throw 'EXACT_HOSTED_PROBE_CONTEXT_REQUIRED'}
if($env:GITHUB_RUN_ID -notmatch '^\d+$' -or $env:GITHUB_RUN_ATTEMPT -notmatch '^\d+$' -or $env:GITHUB_SHA -notmatch '^[a-f0-9]{40}$'){throw 'EXACT_RUN_IDENTITY_REQUIRED'}
$taskRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../../..')).Path
$taskNode=(Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
if((& $taskNode --version) -ne 'v24.16.0' -or $LASTEXITCODE -ne 0){throw 'EXACT_NODE_REQUIRED'}
$taskEvidence=Join-Path $taskRoot ('desktop/evidence/terminal-roster-ci/'+$env:GITHUB_RUN_ID+'-'+$env:GITHUB_RUN_ATTEMPT)
New-Item -ItemType Directory -Path $taskEvidence -ErrorAction Stop | Out-Null
function Task-Pin([string]$TaskPath){$taskFile=Get-Item -LiteralPath $TaskPath -ErrorAction Stop;return [ordered]@{path=$taskFile.FullName;bytes=$taskFile.Length;sha256=(Get-FileHash -LiteralPath $TaskPath -Algorithm SHA256).Hash.ToLowerInvariant()}}
$taskReceipt=[ordered]@{scope='HOSTED_WINDOWS_NODE_BUILD_ONLY';status='BUILD_STARTED_NOT_QUALIFIED';nativeExecutionAdmitted=$false;commit=$env:GITHUB_SHA;runId=$env:GITHUB_RUN_ID;attempt=$env:GITHUB_RUN_ATTEMPT;image=$env:ImageVersion;inputs=@();reportedHeaders=@();startedUtc=[DateTime]::UtcNow.ToString('o')}
try {
 $taskSource=Join-Path $taskRoot 'desktop/native/terminal-host-roster-candidate/ownership.cc'
 $taskInclude=Join-Path $taskRoot 'desktop/native/terminal-host-roster-candidate/peer-endpoints.inc'
 foreach($taskPair in @(@($taskSource,'6029d0f9d507db518198534c0946e4149d8ed15a1c244d97ce0427429cf70781'),@($taskInclude,'aa4ccd3428a1c547a5e8dccc1116ebab45a3be6972c1229903db36c5081be476'))){
  $taskPin=Task-Pin $taskPair[0];if($taskPin.sha256 -ne $taskPair[1]){throw 'CANDIDATE_SOURCE_DRIFT'};$taskReceipt.inputs+=,$taskPin
 }
 $taskDownloads=Join-Path $taskEvidence 'downloads';New-Item -ItemType Directory -Path $taskDownloads | Out-Null
 $taskSums=Join-Path $taskDownloads 'SHASUMS256.txt';Invoke-WebRequest -Uri 'https://nodejs.org/dist/v24.16.0/SHASUMS256.txt' -OutFile $taskSums
 foreach($taskDownload in @(@('node-v24.16.0-headers.tar.gz','ee3466c7ed5101cdc82978a5164148204bfffae0ddacda24ef6d9805bdf4fc07'),@('win-x64/node.lib','4ab42af597bc4f0957e9e2dcd5db18bdf223406a0c8e0b6be0f28e57977b808b'))){
  $taskName=[IO.Path]::GetFileName($taskDownload[0]);$taskTarget=Join-Path $taskDownloads $taskName
  if(-not ((Get-Content -LiteralPath $taskSums) -contains ($taskDownload[1]+'  '+$taskDownload[0]))){throw 'OFFICIAL_MANIFEST_MISMATCH'}
  Invoke-WebRequest -Uri ('https://nodejs.org/dist/v24.16.0/'+$taskDownload[0]) -OutFile $taskTarget
  $taskPin=Task-Pin $taskTarget;if($taskPin.sha256 -ne $taskDownload[1]){throw 'OFFICIAL_DOWNLOAD_DIGEST_MISMATCH'};$taskReceipt.inputs+=,$taskPin
 }
 $taskTar='C:/Windows/System32/tar.exe';$taskHeaders=Join-Path $taskEvidence 'verified-headers';New-Item -ItemType Directory -Path $taskHeaders | Out-Null
 & $taskTar -xzf (Join-Path $taskDownloads 'node-v24.16.0-headers.tar.gz') -C $taskHeaders
 if($LASTEXITCODE -ne 0){throw 'VERIFIED_HEADER_EXTRACTION_FAILED'}
 $taskLocator=Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
 $taskVs=@(& $taskLocator -products '*' -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath)
 if($LASTEXITCODE -ne 0 -or $taskVs.Count -ne 1){throw 'COMPILER_DISCOVERY_FAILED'}
 $taskMsvc=(Get-ChildItem -LiteralPath (Join-Path $taskVs[0] 'VC/Tools/MSVC') -Directory | Where-Object {$_.Name -match '^\d+\.\d+\.\d+$'} | Sort-Object {[version]$_.Name} -Descending | Select-Object -First 1).FullName
 $taskCl=Join-Path $taskMsvc 'bin/Hostx64/x64/cl.exe';$taskLink=Join-Path $taskMsvc 'bin/Hostx64/x64/link.exe'
 $taskSdk=(Get-ItemProperty -LiteralPath 'HKLM:/SOFTWARE/Microsoft/Windows Kits/Installed Roots').KitsRoot10
 $taskSdkVersion=(Get-ChildItem -LiteralPath (Join-Path $taskSdk 'Include') -Directory | Where-Object {$_.Name -match '^10\.0\.\d+\.0$'} | Sort-Object {[version]$_.Name} -Descending | Select-Object -First 1).Name
 if(-not $taskMsvc -or -not $taskSdkVersion){throw 'TOOLCHAIN_INCOMPLETE'}
 foreach($taskPath in @($taskCl,$taskLink,$taskTar,$taskNode,$PSCommandPath,$taskLocator,(Join-Path $taskRoot 'desktop/native/terminal-host-roster-candidate/binding.gyp'))){$taskReceipt.inputs+=,(Task-Pin $taskPath)}
 $taskBuild=Join-Path $taskEvidence 'observation/build';New-Item -ItemType Directory -Path $taskBuild | Out-Null
 $taskAddon=Join-Path $taskBuild 'siren_terminal_host_roster_candidate.node'
 $taskArgs=@('/nologo','/LD','/MD','/EHsc','/std:c++20','/showIncludes','/DNAPI_VERSION=10','/D_WIN32_WINNT=0x0A00','/DWIN32_LEAN_AND_MEAN','/DNOMINMAX',('/I'+(Join-Path $taskHeaders 'node-v24.16.0/include/node')),('/I'+(Split-Path -Parent $taskSource)),('/Fo'+(Join-Path $taskBuild 'ownership.obj')),$taskSource,'/link',('/OUT:'+$taskAddon),(Join-Path $taskDownloads 'node.lib'),'kernel32.lib','advapi32.lib')
 $taskReceipt.compiler=$taskCl;$taskReceipt.args=$taskArgs;$taskReceipt.sdk=$taskSdkVersion;$taskReceipt.msvc=$taskMsvc
 foreach($taskOption in @('CL','_CL_','LINK','_LINK_')){if([Environment]::GetEnvironmentVariable($taskOption)){throw 'UNEXPECTED_COMPILER_ENVIRONMENT'}}
 $taskOldInclude=$env:INCLUDE;$taskOldLib=$env:LIB;$taskOldLang=$env:VSLANG;$taskOldPath=$env:PATH
 try {
  $env:INCLUDE=@((Join-Path $taskMsvc 'include'),(Join-Path $taskSdk "Include/$taskSdkVersion/ucrt"),(Join-Path $taskSdk "Include/$taskSdkVersion/shared"),(Join-Path $taskSdk "Include/$taskSdkVersion/um")) -join ';'
  $env:LIB=@((Join-Path $taskMsvc 'lib/x64'),(Join-Path $taskSdk "Lib/$taskSdkVersion/ucrt/x64"),(Join-Path $taskSdk "Lib/$taskSdkVersion/um/x64")) -join ';';$env:VSLANG='1033'
  $taskReceipt.compilerBinEnvironment=Split-Path -Parent $taskCl;$env:PATH=$taskReceipt.compilerBinEnvironment+';'+$taskOldPath
  $taskEmitter=Join-Path $taskRoot 'desktop/tests/native/emit-terminal-host-exit-unit.mjs'
  $taskTemplate=Join-Path $taskRoot 'desktop/tests/fixtures/terminal-host-exit-unit.cpp'
  $taskOldSource=Join-Path $taskRoot 'desktop/tests/fixtures/terminal-host-roster-pre-exit-fix.cc'
  if((Task-Pin $taskOldSource).sha256 -ne '18259d597bceed360ed7408e6f65fc6870d6edf80f447bb30803c0ad2928637f'){throw 'BASELINE_UNIT_SOURCE_DRIFT'}
  foreach($taskPath in @($taskEmitter,$taskTemplate,$taskOldSource)){$taskReceipt.inputs+=,(Task-Pin $taskPath)}
  $taskReceipt.controlledApiUnits=@()
  foreach($taskUnit in @(@('baseline',$taskOldSource,1),@('fixed',$taskSource,0))){
   $taskUnitSource=Join-Path $taskBuild ($taskUnit[0]+'-exit-unit.cpp');$taskUnitExe=Join-Path $taskBuild ($taskUnit[0]+'-exit-unit.exe')
   & $taskNode $taskEmitter $taskUnit[1] $taskUnitSource
   if($LASTEXITCODE -ne 0){throw 'UNIT_EMISSION_FAILED'}
   $taskReceipt.inputs+=,(Task-Pin $taskUnitSource)
   & $taskCl /nologo /MD /EHsc /std:c++20 /DNOMINMAX ('/Fo'+(Join-Path $taskBuild ($taskUnit[0]+'-exit-unit.obj'))) ('/Fe'+$taskUnitExe) $taskUnitSource 2>&1 | Tee-Object -FilePath (Join-Path $taskBuild ($taskUnit[0]+'-exit-unit-compile.txt'))
   if($LASTEXITCODE -ne 0){throw 'UNIT_COMPILE_FAILED'}
   & $taskUnitExe 2>&1 | Tee-Object -FilePath (Join-Path $taskBuild ($taskUnit[0]+'-exit-unit-result.txt'));$taskUnitExit=$LASTEXITCODE
   $taskUnitText=Get-Content -LiteralPath (Join-Path $taskBuild ($taskUnit[0]+'-exit-unit-result.txt')) -Raw
   if($taskUnitExit -ne $taskUnit[2] -or $taskUnitText -notmatch 'DATA_CASES=15 FAILED=\d+' -or ($taskUnit[0] -eq 'fixed' -and $taskUnitText -notmatch 'DATA_CASES=15 FAILED=0')){throw 'UNIT_EXPECTATION_FAILED'}
   $taskReceipt.controlledApiUnits+=,[ordered]@{scope='CONTROLLED_API_DATA_NOT_KERNEL';name=$taskUnit[0];exit=$taskUnitExit;binary=(Task-Pin $taskUnitExe);result=(Task-Pin (Join-Path $taskBuild ($taskUnit[0]+'-exit-unit-result.txt')))}
  }
  Push-Location -LiteralPath $taskBuild
  try { & $taskCl @taskArgs 2>&1 | Tee-Object -FilePath (Join-Path $taskEvidence 'compile.txt');$taskCompileExit=$LASTEXITCODE } finally { Pop-Location }
  if($taskCompileExit -ne 0){throw "COMPILER_FAILED:$taskCompileExit"}
 } finally {$env:INCLUDE=$taskOldInclude;$env:LIB=$taskOldLib;$env:VSLANG=$taskOldLang;$env:PATH=$taskOldPath}
 $taskIncluded=@(Get-Content -LiteralPath (Join-Path $taskEvidence 'compile.txt') | ForEach-Object {if($_ -match '^Note: including file:\s*(.+)$'){$Matches[1].Trim()}} | Sort-Object -Unique)
 if($taskIncluded.Count -le 10){throw 'COMPILER_INCLUDE_TRACE_REQUIRED'}
 foreach($taskPath in $taskIncluded){$taskReceipt.reportedHeaders+=,(Task-Pin $taskPath)}
 $taskReceipt.binary=Task-Pin $taskAddon
 foreach($taskPin in $taskReceipt.inputs){if((Task-Pin $taskPin.path).sha256 -ne $taskPin.sha256){throw 'BUILD_INPUT_DRIFT'}}
 $taskReceipt.status='COMPILED_NOT_RUNTIME_QUALIFIED'
} catch {$taskReceipt.status='BUILD_FAILED';$taskReceipt.error=$_.Exception.Message;throw}
finally {$taskReceipt.finishedUtc=[DateTime]::UtcNow.ToString('o');$taskReceipt | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskEvidence 'build-result.json') -Encoding utf8}
