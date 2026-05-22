@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Garage App - Unit Tests

echo ========================================================
echo   RUNNING TESTS (ACCOUNTS + GARAGES)
echo ========================================================
echo.

:: 1. CHECK AND ACTIVATE VIRTUAL ENVIRONMENT
if not exist "venv" (
    echo [ERROR] 'venv' folder not found. Run install-and-run.bat first.
    pause
    exit /b 1
)

call venv\Scripts\activate

:: 2. ACCOUNTS TESTS
echo.
echo --------------------------------------------------------
echo  [1/2] Testing module: ACCOUNTS (Users)
echo --------------------------------------------------------
python manage.py test accounts
if %errorlevel% neq 0 (
    set ACCOUNTS_STATUS=FAIL
    color 47
) else (
    set ACCOUNTS_STATUS=OK
)

:: 3. GARAGES TESTS
echo.
echo --------------------------------------------------------
echo  [2/2] Testing module: GARAGES (Reservations and ML)
echo --------------------------------------------------------
python manage.py test garages
if %errorlevel% neq 0 (
    set GARAGES_STATUS=FAIL
    color 47
) else (
    set GARAGES_STATUS=OK
)

:: 4. SUMMARY
echo.
echo ========================================================
echo   FINAL REPORT
echo ========================================================
echo.
echo  ACCOUNTS: %ACCOUNTS_STATUS%
echo  GARAGES:  %GARAGES_STATUS%
echo.

if "%ACCOUNTS_STATUS%"=="OK" if "%GARAGES_STATUS%"=="OK" (
    echo  [SUCCESS] All tests passed!
    color 20
) else (
    echo  [WARNING] Some tests failed. Check the logs above.
    color 40
)

echo.
pause
