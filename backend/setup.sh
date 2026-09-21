#!/bin/bash

echo "========================================"
echo "AI Document Summarizer - Backend Setup"
echo "========================================"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.10 or higher"
    exit 1
fi

echo "[1/5] Creating virtual environment..."
python3 -m venv venv
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to create virtual environment"
    exit 1
fi

echo "[2/5] Activating virtual environment..."
source venv/bin/activate

echo "[3/5] Installing dependencies..."
pip install -r requirements.txt
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    exit 1
fi

echo "[4/5] Setting up environment file..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo ".env file created. Please edit it and add your LLM_API_KEY and DEEPGRAM_API_KEY"
else
    echo ".env file already exists"
fi

echo "[5/5] Running Django migrations..."
python manage.py migrate
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to run migrations"
    exit 1
fi

echo ""
echo "========================================"
echo "Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Edit .env file and add your LLM_API_KEY and DEEPGRAM_API_KEY"
echo "2. Run: python manage.py runserver"
echo "3. API will be available at http://localhost:8000"
echo ""
