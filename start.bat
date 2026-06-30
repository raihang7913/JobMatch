@echo off
echo Starting Job Search App...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
echo.

REM Start backend
cd /d "%~dp0backend"
start "Backend" cmd /k "python -m uvicorn main:app --reload --port 8000"

REM Start frontend
cd /d "%~dp0frontend"
start "Frontend" cmd /k "npm run dev"

cd /d "%~dp0"
echo.
echo Both servers started! Close this window or press Ctrl+C to stop.
pause
