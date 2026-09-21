# Quick Start Guide - Django Backend

Get your AI Document Summarizer backend running in **5 minutes**! ⚡

## Prerequisites ✅

- Python 3.10+ installed
- LLM gateway API key (`LLM_API_KEY`) and Deepgram API key (`DEEPGRAM_API_KEY`)

## Setup (Windows)

### 1️⃣ Run Setup Script

```bash
cd backend
setup.bat
```

This will:
- Create virtual environment
- Install all dependencies
- Set up database
- Create `.env` file

### 2️⃣ Add Your API Key

Edit `.env` file and add your keys:

```env
LLM_API_KEY=your-llm-gateway-key
DEEPGRAM_API_KEY=your-deepgram-key
```

### 3️⃣ Start Server

```bash
python manage.py runserver
```

Server running at: **http://localhost:8000** 🚀

## Setup (Mac/Linux)

### 1️⃣ Run Setup Script

```bash
cd backend
chmod +x setup.sh
./setup.sh
```

### 2️⃣ Add Your API Key

Edit `.env` file:

```bash
nano .env
# Add: LLM_API_KEY=... and DEEPGRAM_API_KEY=...
```

### 3️⃣ Start Server

```bash
source venv/bin/activate
python manage.py runserver
```

## Test the API 🧪

### Option 1: Use Test Script

```bash
# Make sure server is running first!
python test_api.py
```

### Option 2: Use cURL

```bash
curl -X POST http://localhost:8000/api/summarize/ \
  -F "file=@test_document.txt"
```

### Option 3: Use Browser Extension (e.g., Postman)

- **Method**: POST
- **URL**: `http://localhost:8000/api/summarize/`
- **Body**: form-data with key `file` and select a PDF/TXT file

## Expected Response ✨

```json
{
  "summary": "Artificial Intelligence has revolutionized document processing...",
  "status": "success"
}
```

## Troubleshooting 🔧

### "Module not found" error
```bash
pip install -r requirements.txt
```

### "AI summarization is not configured"
- Check `.env` file exists in backend directory
- Verify `LLM_API_KEY` is set correctly
- Restart the server after changes

### "Port already in use"
```bash
# Use different port
python manage.py runserver 8001
```

### CORS errors from frontend
Add your frontend URL to `.env`:
```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8081
```

## Next Steps 🎯

1. ✅ Backend working? Great!
2. 🔗 Connect your frontend to `http://localhost:8000/api/summarize/`
3. 📤 Send POST requests with file uploads
4. 📥 Receive AI-generated summaries

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/summarize/` | POST | Upload file and get summary |
| `/api/summarize/` | GET | Get API information |
| `/admin/` | - | Django admin panel |

## File Limits

- **Accepted types**: PDF, TXT
- **Max size**: 10 MB
- **Text extraction**: Automatic

## Development Commands

```bash
# Run server
python manage.py runserver

# Create admin user
python manage.py createsuperuser

# Run migrations
python manage.py migrate

# Collect static files
python manage.py collectstatic
```

---

**Need help?** Check the full [README.md](README.md) for detailed documentation!
