@echo off
REM Luminary Backend Startup Script (Windows)
REM This script sets up the Python environment and runs the Flask app

setlocal enabledelayedexpansion

echo.
echo ╔═════════════════════════════════════════╗
echo ║  Luminary Auth Backend Startup          ║
echo ║  Flask + OpenCV + Face Recognition      ║
echo ╚═════════════════════════════════════════╝
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python is not installed or not in PATH
    echo Please install Python from https://www.python.org/
    pause
    exit /b 1
)

echo ✓ Python found
python --version

REM Check if we're in the correct directory
if not exist "backend\app.py" (
    echo.
    echo ❌ app.py not found in backend folder
    echo Make sure you run this from the Hackathon folder
    pause
    exit /b 1
)

REM Install/upgrade dependencies
echo.
echo 📦 Installing dependencies...
cd backend
pip install -q -r requirements.txt

if errorlevel 1 (
    echo ❌ Failed to install dependencies
    echo You may need to install dlib separately:
    echo   pip install dlib
    pause
    exit /b 1
)

echo ✓ Dependencies installed
echo.
echo 🚀 Starting Flask backend...
echo 📡 Backend will run on http://localhost:5000
echo 🌐 Frontend will connect from http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.

REM Run the Flask app
python app.py

pause
