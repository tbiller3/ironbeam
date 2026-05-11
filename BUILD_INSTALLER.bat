@echo off
title IRONBEAM - Building Windows Installer
color 0A
cd /d "%~dp0"
echo.
echo  ==========================================
echo    IRONBEAM Technologies
echo    Building Windows Installer (.exe)
echo  ==========================================
echo.

:: Check Node.js
where node.exe >nul 2>&1
if %errorlevel% neq 0 (
  color 0C
  echo  ERROR: Node.js not found.
  echo  Install from https://nodejs.org then re-run this file.
  pause & exit /b 1
)
echo  [1/4] Node.js OK:
node --version
echo.

:: Install dependencies
echo  [2/4] Installing dependencies (npm install)...
call npm install --ignore-scripts 2>&1
if %errorlevel% neq 0 (
  color 0C
  echo  ERROR: npm install failed. See output above.
  pause & exit /b 1
)
echo  Dependencies OK.
echo.

:: Download / verify Electron binary
echo  [3/4] Setting up Electron binary...
call npx --yes electron --version 2>&1
if %errorlevel% neq 0 (
  echo  Electron not cached, downloading now (~120MB)...
  call npm install electron --save-dev 2>&1
)
echo  Electron OK.
echo.

:: Build
echo  [4/4] Building installer (2-5 min first time)...
echo.
call npx --yes electron-builder --win --x64 2>&1
if %errorlevel% neq 0 (
  color 0C
  echo.
  echo  ==========================================
  echo    BUILD FAILED - see errors above
  echo  ==========================================
  echo.
  echo  Common fixes:
  echo    - Make sure you ran "Extract All" on the zip
  echo    - Check internet connection (downloads Electron)
  echo    - Run as Administrator if firewall errors appear
  pause & exit /b 1
)

echo.
if exist "dist\IRONBEAM-Setup*.exe" (
  color 0A
  echo  ==========================================
  echo    BUILD SUCCESSFUL!
  echo  ==========================================
  echo.
  echo  Your installer is in the dist\ folder:
  dir /b dist\*.exe
  echo.
  echo  Opening dist folder...
  start "" "dist"
) else (
  color 0E
  echo  Build finished but no .exe found in dist\
  echo  Check the output above for errors.
)

pause
