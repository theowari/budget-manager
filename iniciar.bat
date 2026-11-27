@echo off
setlocal
title Financeiro

rem Sempre roda a partir da pasta onde este .bat esta, nao importa de onde foi aberto.
cd /d "%~dp0"

echo === Gerando build... ===
call npm run build
if errorlevel 1 (
  echo.
  echo O build falhou. Corrija os erros acima e tente de novo.
  pause
  exit /b 1
)

echo.
echo === Iniciando o servidor em http://localhost:3001 ===
echo (feche esta janela ou aperte Ctrl+C para parar)
echo.
call npm start
start http://localhost:3001

echo.
echo O servidor parou.
pause
