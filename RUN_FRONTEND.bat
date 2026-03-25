@echo off
REM Luminary Frontend Startup Script (Windows)
REM This script opens the frontend in your default browser

echo.
echo ╔═════════════════════════════════════════╗
echo ║  Luminary Frontend                      ║
echo ║  Opening in default browser...          ║
echo ╚═════════════════════════════════════════╝
echo.
echo 🌐 Frontend URL: http://localhost:8000/frontend/
echo 📡 Make sure backend.bat is also running!
echo.

REM Get the directory where this script is located
set "SCRIPT_DIR=%~dp0"

REM Change to frontend directory
cd /d "%SCRIPT_DIR%frontend"

REM Start a simple HTTP server using Python
echo Starting local web server on port 8000...
python -m http.server 8000 --directory "%SCRIPT_DIR%"

pause
