@echo off
:: Builds the Windows installer. Runs elevated because electron-builder needs
:: admin to extract winCodeSign symlinks. After it finishes, publish with:
::   gh release create vX.Y.Z "release\X.Y.Z\Focus-HUB-X.Y.Z-setup.exe" "release\X.Y.Z\Focus-HUB-X.Y.Z-setup.exe.blockmap" "release\X.Y.Z\latest.yml"
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"
set "CSC_IDENTITY_AUTO_DISCOVERY=false"
echo Gerando instalador (isso pode levar alguns minutos)...
call npm run dist:win
echo.
echo Pronto! Instalador em release\ . Para publicar a atualizacao, rode o gh release create (ver topo deste arquivo).
pause
