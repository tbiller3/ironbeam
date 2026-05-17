@echo off
title IRONBEAM Technologies
color 0A
cd /d "%~dp0"

echo.
echo  ==========================================
echo    IRONBEAM Technologies  v1.0
echo    Unrestricted Transfer Protocol
echo  ==========================================
echo.

where node.exe >nul 2>&1
if %errorlevel% neq 0 (
  color 0C
  echo  ERROR: Node.js not found. Install from https://nodejs.org
  pause & exit /b 1
)

:: Add firewall rules silently
netsh advfirewall firewall add rule name="IRONBEAM-7443" dir=in action=allow protocol=TCP localport=7443 >nul 2>&1
netsh advfirewall firewall add rule name="IRONBEAM-7878" dir=in action=allow protocol=TCP localport=7878 >nul 2>&1

:: Install deps if needed (first run)
if not exist "%~dp0node_modules\express\" (
  echo  Installing dependencies ^(first run only^)...
  call npm install --ignore-scripts --prefix "%~dp0"
  echo  Done.
  echo.
)

:: Launch Electron if available, otherwise run headless server
if exist "%~dp0node_modules\.bin\electron.cmd" (
  echo  Launching IRONBEAM desktop app...
  "%~dp0node_modules\.bin\electron.cmd" "%~dp0"
) else (
  echo  Starting IRONBEAM server...
  echo  ^(For the full desktop app, run: npm install ^& npm start^)
  echo.
  node.exe "%~dp0server-core-standalone.js"
)

pause
