@echo off
setlocal
rem Local development entry; not the portable distribution or an activation grant.
if not exist "%~dp0desktop\node_modules\electron\dist\electron.exe" (
  echo SIREN development runtime is missing. Follow desktop\README.md.
  pause
  exit /b 1
)
if not exist "%~dp0desktop\generated\app.html" (
  echo SIREN development renderer is missing. Follow desktop\README.md.
  pause
  exit /b 1
)
start "SIREN development" /D "%~dp0desktop" "%~dp0desktop\node_modules\electron\dist\electron.exe" "%~dp0desktop"
exit /b 0
