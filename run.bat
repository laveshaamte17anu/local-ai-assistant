@echo off
title Local AI Voice Assistant Launcher

echo ========================================================
echo        Starting Local AI Voice Assistant
echo ========================================================
echo.

cd /d "%~dp0"

:: Detect Python executable (prefer backend\venv if present)
set "PYTHON_CMD=python"
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON_CMD=%~dp0backend\venv\Scripts\python.exe"
    echo [INFO] Using virtual environment Python: %PYTHON_CMD%
)

echo [1/3] Launching Python FastAPI Backend on port 8002...
start "FastAPI Backend" cmd /k "cd /d "%~dp0" && "%PYTHON_CMD%" -m uvicorn backend.main:app --host 127.0.0.1 --port 8002 --reload"

timeout /t 3 /nobreak >nul

echo [2/3] Launching React Vite Frontend on port 5174...
start "React Frontend" cmd /k "cd /d "%~dp0frontend" && npm.cmd run dev"

timeout /t 3 /nobreak >nul

echo [3/3] Opening Local AI Assistant in Browser...
start http://localhost:5174

echo.
echo ========================================================
echo Local AI Voice Assistant is running!
echo Backend:  http://127.0.0.1:8002
echo Frontend: http://localhost:5174
echo ========================================================
echo.
