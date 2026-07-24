@echo off
:: Focus HUB — launcher that runs the app as Administrator (needed for site
:: blocking via the hosts file). Self-elevates with a single UAC prompt.
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

title Focus HUB
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"

if not exist "out\main\index.js" (
  echo Compilando pela primeira vez...
  call npm run build
)

echo Abrindo Focus HUB (Administrador)...
start "" "node_modules\electron\dist\electron.exe" .
