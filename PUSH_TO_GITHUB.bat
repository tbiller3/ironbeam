@echo off
title IRONBEAM - Auto Push to GitHub
color 0A
cd /d "%~dp0"
echo.
echo  ==========================================
echo    IRONBEAM - Auto GitHub Setup
echo  ==========================================
echo.

where git >nul 2>&1
if %errorlevel% neq 0 (
  color 0C
  echo  ERROR: Git not found. Install from https://git-scm.com then re-run.
  pause & exit /b 1
)

echo  STEP 1: Create a GitHub Personal Access Token
echo  -----------------------------------------------
echo  Opening GitHub now...
echo.
echo  On the page that opens:
echo    1. Set Token name = IRONBEAM
echo    2. Set Expiration = 90 days
echo    3. Check BOTH boxes:
echo         [x] repo
echo         [x] workflow
echo    4. Click "Generate token" at the bottom
echo    5. COPY the token (ghp_...)
echo    6. Come back here and paste it
echo.
start https://github.com/settings/tokens/new?description=IRONBEAM^&scopes=repo,workflow
echo.

set /p GITHUB_TOKEN=Paste token here and press Enter: 
set /p GITHUB_USER=Enter your GitHub username (e.g. tbill3): 

if "%GITHUB_TOKEN%"=="" ( echo Token cannot be empty. & pause & exit /b 1 )
if "%GITHUB_USER%"=="" ( echo Username cannot be empty. & pause & exit /b 1 )

echo.
echo  Creating GitHub repository "ironbeam"...

curl -s -X POST ^
  -H "Authorization: token %GITHUB_TOKEN%" ^
  -H "Accept: application/vnd.github.v3+json" ^
  -d "{\"name\":\"ironbeam\",\"description\":\"IRONBEAM Technologies - Unrestricted file transfer\",\"private\":false}" ^
  https://api.github.com/user/repos > "%TEMP%\ib_repo.json" 2>&1

type "%TEMP%\ib_repo.json" | findstr /c:"already exists" >nul
if %errorlevel% equ 0 (
  echo  Repo already exists - will push to it.
) else (
  type "%TEMP%\ib_repo.json" | findstr /c:"\"full_name\"" >nul
  if %errorlevel% equ 0 (
    echo  Repository created successfully.
  ) else (
    echo  Could not create repo. Check your token has "repo" scope.
    type "%TEMP%\ib_repo.json"
    pause & exit /b 1
  )
)

echo.
echo  Pushing code to github.com/%GITHUB_USER%/ironbeam ...

if not exist ".git" (
  git init
  git branch -M main
)

git config user.email "build@ironbeam.ca"
git config user.name "IRONBEAM Technologies"

git remote remove origin 2>nul
git remote add origin https://%GITHUB_TOKEN%@github.com/%GITHUB_USER%/ironbeam.git

git add -A
git status

git diff --cached --quiet
if %errorlevel% equ 0 (
  echo  Nothing new to commit - forcing push of existing commits...
) else (
  git commit -m "IRONBEAM v1.0 - Electron desktop app with auto-installer"
)

git push -u origin main --force

if %errorlevel% neq 0 (
  color 0C
  echo.
  echo  Push failed.
  echo  Make sure your token has BOTH "repo" AND "workflow" scopes checked.
  pause & exit /b 1
)

echo.
color 0A
echo  ==========================================
echo    SUCCESS! Building your installer now.
echo  ==========================================
echo.
echo  GitHub Actions is building your .exe - takes ~10 minutes.
echo  Opening the Actions page...
timeout /t 3 >nul
start https://github.com/%GITHUB_USER%/ironbeam/actions
echo.
echo  When the workflow shows a green checkmark:
echo    1. Click the workflow run
echo    2. Scroll to "Artifacts" at the bottom
echo    3. Download "IRONBEAM-Windows-Installer"
echo    4. That ZIP contains your .exe installer!
echo.
pause
