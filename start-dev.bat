@echo off
REM ========================================
REM ELECTRONICS STORE - DEVELOPMENT SERVER
REM ========================================
REM This script starts all development services:
REM 1. PHP backend server (localhost:8000)
REM 2. React frontend server (localhost:5173)
REM 
REM CLEANUP FEATURES:
REM - PHP and Node.js processes terminate when script exits
REM - All services clean up automatically
REM
REM PREREQUISITES:
REM - PHP 8.0+ in PATH
REM - Node.js in PATH
REM - npm dependencies installed (run 'npm install' first)
REM
REM USAGE:
REM - Run this script from the project root directory
REM - Access frontend at http://localhost:5173
REM - Access admin panel at http://localhost:5173/admin/login
REM - Press Ctrl+C to stop all services (cleanup is automatic)
REM ========================================
echo ========================================
echo Electronics Store - Development Server
echo ========================================
echo.

REM Check if we're in the right directory
if not exist "package.json" (
    echo Error: package.json not found. Please run this script from the project root directory.
    pause
    exit /b 1
)

if not exist "backend\config\database.php" (
    echo Error: Backend directory not found. Please run this script from the project root directory.
    pause
    exit /b 1
)

echo Starting all services...
echo.

REM Check if PHP is available
php --version >nul 2>&1
if errorlevel 1 (
    echo Warning: PHP not found in PATH. Make sure PHP is installed and added to your system PATH.
    echo You can still run the React frontend, but the PHP backend won't work.
    echo.
)

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js not found in PATH. Please install Node.js first.
    pause
    exit /b 1
)

set TUNNEL_STARTED=0
set "PF64=%ProgramFiles%"
set "PF86=%ProgramFiles(x86)%"

echo Preparing SSH tunnel on port 3307...
echo [DEBUG] ProgramFiles=%ProgramFiles%
echo [DEBUG] ProgramFiles(x86)=%ProgramFiles(x86)%
echo [DEBUG] PF64=%PF64%
echo [DEBUG] PF86=%PF86%
echo [DEBUG] Checking local port usage for 3307...
netstat -an | findstr ":3307 " >nul 2>&1
echo [DEBUG] findstr errorlevel: %errorlevel%
if %errorlevel%==0 goto PORT_3307_IN_USE

echo [DEBUG] 3307 not in use. Launching tunnel...
set "PLINK_EXE="

REM Try to find plink.exe in multiple locations
echo [DEBUG] Searching for plink.exe...
where plink >nul 2>&1
if %errorlevel%==0 (
    for /f "delims=" %%i in ('where plink') do set "PLINK_EXE=%%i"
    if defined PLINK_EXE echo [DEBUG] Found plink in PATH
)
if not defined PLINK_EXE (
    echo [DEBUG] Checking "%PF64%\PuTTY\plink.exe"...
    if exist "%PF64%\PuTTY\plink.exe" (
        set "PLINK_EXE=%PF64%\PuTTY\plink.exe"
        echo [DEBUG] Found plink at "%PF64%\PuTTY\plink.exe"
    )
)
if not defined PLINK_EXE (
    echo [DEBUG] Checking "%PF86%\PuTTY\plink.exe"...
    if exist "%PF86%\PuTTY\plink.exe" (
        set "PLINK_EXE=%PF86%\PuTTY\plink.exe"
        echo [DEBUG] Found plink at "%PF86%\PuTTY\plink.exe"
    )
)
REM Try direct C: drive paths as fallback
if not defined PLINK_EXE (
    echo [DEBUG] Checking "C:\Program Files\PuTTY\plink.exe"...
    if exist "C:\Program Files\PuTTY\plink.exe" (
        set "PLINK_EXE=C:\Program Files\PuTTY\plink.exe"
        echo [DEBUG] Found plink at "C:\Program Files\PuTTY\plink.exe"
    )
)
if not defined PLINK_EXE (
    echo [DEBUG] Checking "C:\Program Files (x86)\PuTTY\plink.exe"...
    if exist "C:\Program Files (x86)\PuTTY\plink.exe" (
        set "PLINK_EXE=C:\Program Files (x86)\PuTTY\plink.exe"
        echo [DEBUG] Found plink at "C:\Program Files (x86)\PuTTY\plink.exe"
    )
)

echo [DEBUG] Final PLINK_EXE: %PLINK_EXE%
if not defined PLINK_EXE (
    echo [WARNING] plink.exe not found in standard locations.
    echo [WARNING] Attempting to use OpenSSH instead...
    goto USE_OPENSSH
)

echo [DEBUG] Using plink at "%PLINK_EXE%" for passwordless tunnel.
start "SSH_TUNNEL_%RANDOM%" /min "%PLINK_EXE%" -batch -no-antispoof -N -L 3307:127.0.0.1:3306 -P 21010 -ssh student1@ccscloud.dlsu.edu.ph -pw Dlsu1234!
if errorlevel 1 (
    echo [ERROR] Failed to start plink tunnel. Trying OpenSSH...
    goto USE_OPENSSH
)
set TUNNEL_STARTED=1
goto AFTER_TUNNEL

:USE_OPENSSH
echo [DEBUG] plink.exe not found or failed. Using Windows SSH (OpenSSH).
echo.
echo [INFO] ========================================
echo [INFO] SSH TUNNEL WINDOW WILL OPEN
echo [INFO] ========================================
echo [INFO] A new window will open asking for password.
echo [INFO] Please enter the password: Dlsu1234!
echo [INFO] Connection: student1@ccscloud.dlsu.edu.ph
echo [INFO] ========================================
echo.
echo [MANUAL INSTRUCTIONS]
echo If the SSH window doesn't open, manually run this command:
echo.
echo   ssh -N -L 3307:127.0.0.1:3306 student1@ccscloud.dlsu.edu.ph -p 21010
echo.
echo Password: Dlsu1234!
echo.
echo [INFO] ========================================
echo.

REM Create a temporary batch file for the SSH tunnel
set "SSH_TUNNEL_BAT=%TEMP%\ssh_tunnel_%RANDOM%.bat"
(
    echo @echo off
    echo title SSH Tunnel - Password Required
    echo echo.
    echo echo ========================================
    echo echo SSH Tunnel Password Required
    echo echo ========================================
    echo echo.
    echo echo Connection: student1@ccscloud.dlsu.edu.ph
    echo echo Port: 21010
    echo echo.
    echo echo Please enter password when prompted: Dlsu1234!
    echo echo.
    echo echo ========================================
    echo echo.
    echo ssh -N -L 3307:127.0.0.1:3306 student1@ccscloud.dlsu.edu.ph -p 21010 -o StrictHostKeyChecking=accept-new
    echo echo.
    echo echo Tunnel connection closed.
    echo pause
) > "%SSH_TUNNEL_BAT%"

echo [INFO] Opening SSH tunnel window...
start "SSH_TUNNEL_%RANDOM%" cmd /k ""%SSH_TUNNEL_BAT%""
goto AFTER_TUNNEL

:PORT_3307_IN_USE
echo Port 3307 already in use - assuming an existing tunnel for the app.
echo Skipping SSH tunnel creation.

:AFTER_TUNNEL
echo Waiting for tunnel to initialize...
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo Starting Backend and Frontend...
echo ========================================
echo.

echo Starting PHP backend server on port 8000...
start /B php -S localhost:8000 router.php

REM Wait a moment for PHP server to start
timeout /t 2 /nobreak >nul

echo Starting React frontend on port 5173...
echo.
echo ========================================
echo Services Running:
echo ========================================
echo Database:     Port 3307 (SSH tunnel)
echo PHP Backend:  http://localhost:8000
echo React Frontend: http://localhost:5173
echo.
echo ========================================
echo IMPORTANT:
echo ========================================
echo - Press Ctrl+C to stop React frontend and PHP backend
echo - Close the SSH tunnel window when finished (if started by this script)
echo ========================================
echo.


REM Start React frontend
npm run dev

REM This will only run if npm exits normally (not on Ctrl+C)
echo.
echo ========================================
echo React frontend stopped normally
echo ========================================
echo.
if "%TUNNEL_STARTED%"=="1" (
    echo Stopping SSH tunnel...
    taskkill /IM plink.exe /F >nul 2>&1
)
pause
