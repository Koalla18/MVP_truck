@echo off
REM RoutoX Local Development Launcher for Windows
REM Usage: run_local.bat [--seed]

cd /d "%~dp0"

echo ================================================
echo RoutoX Local Development Server (Windows)
echo ================================================

REM Check for virtual environment
if exist ".venv\Scripts\python.exe" (
    echo Using local .venv
    set PYTHON=.venv\Scripts\python.exe
) else if exist "..\\.venv\\Scripts\\python.exe" (
    echo Using project root .venv
    set PYTHON=..\.venv\Scripts\python.exe
) else (
    echo Using system python
    set PYTHON=python
)

REM Set environment variables
set DATABASE_URL=sqlite:///./routa_dev.db
set DEBUG=true
set CORS_ORIGINS=http://localhost:3000,http://localhost:8080,http://127.0.0.1:3000

REM Run the local server
%PYTHON% run_local.py %*

pause
