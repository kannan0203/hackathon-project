@echo off
REM Luminary Smart Startup — Double-click this to run everything!
REM This script automatically starts backend + frontend together

echo.
echo ╔════════════════════════════════════════════════╗
echo ║  Luminary Smart Startup                        ║
echo ║  Auto-starting Backend + Frontend              ║
echo ╚════════════════════════════════════════════════╝
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/
    echo.
    pause
    exit /b 1
)

REM Run the Python startup script
python "%~dp0start.py"
pause
