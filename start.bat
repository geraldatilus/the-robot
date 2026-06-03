@echo off
title THE ROBOT
color 0B & cls

echo.
echo   ##############################################
echo   ##                                          ##
echo   ##          T H E   R O B O T              ##
echo   ##      Algorithmic Trading Station         ##
echo   ##                                          ##
echo   ##############################################
echo.

:: Use absolute path — works whether launched from shortcut or double-click
set ROOT=C:\The Robot
set BACK=%ROOT%\backend
set VENV=%BACK%\venv\Scripts
set FRONT=%ROOT%\frontend

:: Clear port 8080
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8080 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo   Port 8080 cleared.

:: First-run Python setup
if not exist "%VENV%\uvicorn.exe" (
    echo   First launch - setting up Python environment...
    python -m venv "%BACK%\venv"
    if errorlevel 1 ( echo   ERROR: Python not found. Install Python 3.11+ and retry. & pause & exit /b 1 )
    "%VENV%\pip" install fastapi "uvicorn[standard]" alpaca-py pyyaml numpy pandas websockets httpx -q
)

:: First-run frontend build
if not exist "%FRONT%\dist\index.html" (
    echo   First launch - building frontend...
    cd /d "%FRONT%"
    call npm install --silent
    call npm run build --silent
)

echo   Environment ready.
echo.
echo   http://localhost:8080
echo   ##############################################
echo.

:: Open browser after 2s
start "" /min cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:8080"

:: Launch server  (--app-dir guarantees uvicorn finds main.py regardless of cwd)
"%VENV%\uvicorn.exe" main:app --app-dir "%BACK%" --host 0.0.0.0 --port 8080

echo.
echo   === SERVER STOPPED ===
pause
