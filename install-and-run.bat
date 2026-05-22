@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Garage Reservation System - Install and Run

echo ========================================================
echo  GARAGE RESERVATION SYSTEM - FULL RESET
echo ========================================================

echo [1/6] Checking Python and Node...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python not found. Make sure it is added to PATH environment variables.
    pause
    exit /b 1
)
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Make sure it is installed.
    pause
    exit /b 1
)
echo Environment OK.

echo.
echo [2/6] Configuring virtual environment...
if not exist venv (
    python -m venv venv
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)
call venv\Scripts\activate
echo Installing dependencies...
pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] pip install failed. Check the output above.
    pause
    exit /b 1
)
echo Dependencies OK.

echo.
echo [3/6] Creating database...
python create_db.py
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] create_db.py script failed. Check password in the file.
    pause
    exit /b 1
)

echo.
echo [4/6] Resetting and applying migrations...
for /d %%d in (accounts garages analytics) do (
    if exist "%%d\migrations\0*.py" (
        del /q "%%d\migrations\0*.py" >nul 2>&1
    )
    if exist "%%d\migrations\__pycache__" (
        rmdir /s /q "%%d\migrations\__pycache__" >nul 2>&1
    )
)

python manage.py makemigrations
if %ERRORLEVEL% NEQ 0 (
    echo [CRITICAL ERROR] makemigrations failed.
    pause
    exit /b 1
)

python manage.py migrate
if %ERRORLEVEL% NEQ 0 (
    echo [CRITICAL ERROR] Database migration failed.
    pause
    exit /b 1
)

echo.
echo [5/6] Running Seeder (Generating data and downloading images)...
python seed.py
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] Seeder exited with an error. Continuing anyway.
)

echo.
echo [6/6] Frontend setup...
cd frontend
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] npm install failed.
    cd ..
    pause
    exit /b 1
)
start "Garage Frontend (Vite)" cmd /k "npm run dev"
cd ..

echo.
echo ========================================================
echo  STARTING BACKEND SERVER (Django)
echo  Frontend will be available at http://localhost:5173
echo  Backend API at http://127.0.0.1:8000
echo ========================================================
start "Garage Backend (Django)" cmd /k "call venv\Scripts\activate && python manage.py runserver"

:: Give the backend a moment to bind, then open the browser
timeout /t 5 /nobreak >nul
start "" http://localhost:5173

echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the application.
echo.
pause
