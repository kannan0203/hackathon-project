@echo off
REM Setup Visual Studio Build Tools environment
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64

REM Add Python cmake to PATH
for /f "tokens=*" %%i in ('python -c "import site; print(site.getsitepackages()[0])"') do set PYTHON_SITE=%%i
set PATH=%PYTHON_SITE%\..\..\Scripts;%PATH%

REM Install dlib
echo Installing dlib...
pip install dlib

REM Verify installation
echo Checking installation...
pip show dlib

pause
