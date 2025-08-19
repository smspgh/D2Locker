@echo off
REM D2Locker Service Wrapper Script - Updated for PATH issues
REM This script ensures the correct environment for running D2Locker as a Windows service

echo [%date% %time%] D2Locker Service Starting...

REM Set working directory
cd /d "C:\coding_projects\D2Locker"
echo [%date% %time%] Working directory: %CD%

REM Clean and rebuild PATH to avoid issues with spaces and special characters
echo [%date% %time%] Original PATH: %PATH%

REM Start with a clean system PATH
set "CLEAN_PATH=C:\Windows\system32;C:\Windows;C:\Windows\System32\Wbem;C:\Windows\System32\WindowsPowerShell\v1.0"

REM Add Node.js and NPM paths if they exist
if exist "C:\Program Files\nodejs" set "CLEAN_PATH=%CLEAN_PATH%;C:\Program Files\nodejs"
if exist "C:\Program Files (x86)\nodejs" set "CLEAN_PATH=%CLEAN_PATH%;C:\Program Files (x86)\nodejs"

REM Add user pnpm path
set "CLEAN_PATH=%CLEAN_PATH%;C:\Users\smspg\AppData\Local\pnpm"

REM Add user npm global modules
set "CLEAN_PATH=%CLEAN_PATH%;C:\Users\smspg\AppData\Roaming\npm"

REM Set the clean PATH
set "PATH=%CLEAN_PATH%"
echo [%date% %time%] Clean PATH set: %PATH%

REM Set NODE_PATH for global modules
set "NODE_PATH=C:\Users\smspg\AppData\Roaming\npm\node_modules"

REM Test PATH components
echo [%date% %time%] Testing PATH components...
where node 2>nul
if %errorlevel% equ 0 (
    echo [%date% %time%] ? Node.js found in PATH
) else (
    echo [%date% %time%] ? Node.js not found in PATH
)

where pnpm 2>nul
if %errorlevel% equ 0 (
    echo [%date% %time%] ? pnpm found in PATH
) else (
    echo [%date% %time%] ? pnpm not found in PATH
    echo [%date% %time%] Trying direct path...
    "C:\Users\smspg\AppData\Local\pnpm\pnpm.exe" --version 2>nul
    if %errorlevel% equ 0 (
        echo [%date% %time%] ? pnpm accessible via direct path
    ) else (
        echo [%date% %time%] ? pnpm not accessible via direct path
        exit /b 1
    )
)

REM Verify node_modules exists
if not exist "node_modules" (
    echo [%date% %time%] ERROR: node_modules directory not found
    echo [%date% %time%] Running pnpm install...
    pnpm install
    if %errorlevel% neq 0 (
        echo [%date% %time%] ERROR: pnpm install failed with code %errorlevel%
        exit /b 1
    )
    echo [%date% %time%] ? pnpm install completed
)

echo [%date% %time%] node_modules verified

REM Check if package.json has prod-nf script
echo [%date% %time%] Checking package.json for prod-nf script...
findstr /c:"prod-nf" package.json >nul 2>&1
if %errorlevel% neq 0 (
    echo [%date% %time%] WARNING: prod-nf script not found in package.json
    echo [%date% %time%] Available scripts:
    pnpm run 2>&1 | findstr /v "Lifecycle"
)

REM Run the application
echo [%date% %time%] Starting D2Locker with: pnpm prod-nf
pnpm prod-nf

REM If we get here, the application exited
echo [%date% %time%] D2Locker application exited with code: %errorlevel%
exit /b %errorlevel%
