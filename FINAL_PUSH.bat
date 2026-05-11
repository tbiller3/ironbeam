@echo off
title IRONBEAM - Final Push
color 0A
cd /d "%~dp0"

set /p TOKEN=Paste your GitHub token (repo + workflow scopes): 

git config user.email "build@ironbeam.ca"
git config user.name "IRONBEAM Technologies"
git remote remove origin 2>nul
git remote add origin https://%TOKEN%@github.com/tbiller3/ironbeam.git
git add -A
git commit -m "Fix: remove external fonts, full UI working" 2>nul
git push origin main --force

echo.
echo Done! Build starting at:
echo https://github.com/tbiller3/ironbeam/actions
echo.
echo Wait 5 minutes, then click the green checkmark and download Artifacts.
start https://github.com/tbiller3/ironbeam/actions
pause
