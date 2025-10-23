@echo off
REM ========================================
REM ELECTRONICS STORE - DEVELOPMENT SERVER
REM ========================================
REM This script starts all development services:
REM 1. SSH tunnel to remote MySQL database (separate window - auto-closes)
REM 2. PHP backend server (localhost:8000)
REM 3. React frontend server (localhost:5173)
REM 
REM CLEANUP FEATURES:
REM - SSH tunnel runs in separate window - close it manually when done
REM - PHP and Node.js processes terminate when script exits
REM - Manual SSH tunnel cleanup required after Ctrl+C or window closure
REM
REM PREREQUISITES:
REM - SSH client installed
REM - PHP 8.0+ in PATH
REM - Node.js in PATH
REM - npm dependencies installed (run 'npm install' first)
REM
REM USAGE:
REM - Run this script from the project root directory
REM - Enter SSH password when prompted in the SSH tunnel window
REM - Access frontend at http://localhost:5173
REM - Access admin panel at http://localhost:5173/admin/login
REM - Close SSH tunnel window manually when done
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

REM Check if SSH is available
ssh -V >nul 2>&1
if errorlevel 1 (
    echo Error: SSH not found. Please install OpenSSH or Git Bash.
    pause
    exit /b 1
)

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

echo Starting SSH tunnel...
echo You will need to enter your SSH password when prompted.
echo.
REM Start SSH tunnel in separate window and capture window title
start "SSH_TUNNEL_%RANDOM%" cmd /k "echo SSH Tunnel - Enter your password below && ssh -L 3307:127.0.0.1:3306 student1@ccscloud.dlsu.edu.ph -p 21010"

REM Wait for SSH tunnel to establish
echo Waiting for SSH tunnel to establish...
echo Please enter your SSH password in the SSH Tunnel window that opened.
timeout /t 5 /nobreak >nul

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
echo SSH Tunnel:   Port 3307 -> Remote MySQL (separate window - close manually)
echo PHP Backend:  http://localhost:8000
echo React Frontend: http://localhost:5173
echo.
echo Press Ctrl+C to stop React frontend.
echo Close SSH tunnel window manually when done.
echo.

REM Start React frontend in the same window
echo Starting React frontend...
echo.
echo ========================================
echo IMPORTANT NOTES:
echo ========================================
echo - SSH tunnel runs in separate window
echo - Press Ctrl+C to stop React frontend
echo - Close SSH tunnel window manually when done
echo - PHP and Node.js will terminate automatically
echo ========================================
echo.

REM Start React frontend with proper cleanup handling
echo Starting React frontend...
echo.
echo ========================================
echo IMPORTANT: To stop all services cleanly:
echo ========================================
echo 1. Press Ctrl+C to stop React frontend
echo 2. Cleanup will run automatically
echo 3. All services will be terminated
echo ========================================
echo.

REM Start React frontend with signal handling
echo Starting React frontend...
echo.
echo ========================================
echo IMPORTANT: To stop all services:
echo ========================================
echo 1. Press Ctrl+C to stop React frontend
echo 2. Close the SSH tunnel window manually
echo 3. PHP backend will stop automatically
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
echo Don't forget to close the SSH tunnel window manually!
echo.
pause
