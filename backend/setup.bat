@echo off
echo ========================================
echo AI Document Summarizer - Backend Setup
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.10 or higher
    pause
    exit /b 1
)

echo [1/5] Creating virtual environment...
python -m venv venv
if errorlevel 1 (
    echo ERROR: Failed to create virtual environment
    pause
    exit /b 1
)

echo [2/5] Activating virtual environment...
call venv\Scripts\activate.bat

echo [3/5] Installing dependencies...
pip install -r requirements.txt
if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo [4/5] Setting up environment file...
if not exist .env (
    copy .env.example .env
    echo .env file created. Please edit it and add your LLM_API_KEY and DEEPGRAM_API_KEY
) else (
    echo .env file already exists
)

echo [5/5] Running Django migrations...
python manage.py migrate
if errorlevel 1 (
    echo ERROR: Failed to run migrations
    pause
    exit /b 1
)

echo.
echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Edit .env file and add your LLM_API_KEY and DEEPGRAM_API_KEY
echo 2. Run: python manage.py runserver
echo 3. API will be available at http://localhost:8000
echo.
echo Press any key to start the server now...
pause >nul

echo.
echo Starting Django development server...
python manage.py runserver
