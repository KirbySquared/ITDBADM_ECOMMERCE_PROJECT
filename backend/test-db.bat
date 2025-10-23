@echo off
echo ========================================
echo Database Connection Test
echo ========================================
echo.

REM Check if we're in the backend directory
if not exist "config\database.php" (
    echo Error: Please run this script from the backend directory.
    echo Usage: cd backend && test-db.bat
    pause
    exit /b 1
)

echo Testing database connection...
echo.

REM Run the PHP test script
php test_connection.php

echo.
echo ========================================
echo Test completed. Check the results above.
echo ========================================
echo.
pause
