@echo off
title Focus HUB - Dev
cd /d "%~dp0"
set "PATH=%PATH%;C:\Program Files\nodejs"
echo Iniciando Focus HUB em modo desenvolvimento (hot reload)...
call npm run dev
echo.
echo O app foi encerrado. Pressione uma tecla para fechar.
pause >nul
