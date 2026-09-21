# AI Document Summarizer - Django Backend

A production-ready Django REST API backend for AI-powered document summarization. Supports PDF and TXT files with OpenAI integration.

## Features

- 📄 **PDF & TXT Support** - Extract and summarize text from PDF and plain text files
- 🤖 **AI-Powered** - Uses OpenAI GPT models for intelligent summarization
- 🔒 **Secure** - File validation, size limits, and type checking
- 🚀 **Production-Ready** - Structured, modular code with comprehensive error handling
- 📊 **RESTful API** - Clean JSON responses with proper HTTP status codes
- 🔧 **Environment-Based Config** - Easy configuration via environment variables

## Project Structure

```
backend/
├── config/                  # Django project settings
│   ├── settings.py         # Main settings (CORS, REST framework, etc.)
│   ├── urls.py             # Root URL configuration
│   ├── wsgi.py             # WSGI entry point
│   └── asgi.py             # ASGI entry point
├── summarizer/             # Main application
│   ├── views.py            # API endpoint logic
│   ├── serializers.py      # Request/response validation
│   ├── urls.py             # App URL patterns
│   ├── models.py           # Database models (currently empty)
│   └── utils/              # Utility modules
│       ├── text_extractor.py   # PDF and TXT text extraction
│       └── ai_summarizer.py    # OpenAI integration
├── requirements.txt        # Python dependencies
├── .env.example           # Environment variables template
└── manage.py              # Django management script
```

## Installation

### 1. Prerequisites

- Python 3.10 or higher
- pip (Python package manager)
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

### 2. Setup Virtual Environment

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
# Copy the example environment file
copy .env.example .env  # Windows
cp .env.example .env    # Mac/Linux

# Edit .env and add your keys
# LLM_API_KEY=...        (OpenAI-compatible LLM gateway)
# DEEPGRAM_API_KEY=...   (speech transcription)
```

### 5. Run Migrations

```bash
python manage.py migrate
```

### 6. Start Development Server

```bash
python manage.py runserver
```

The API will be available at: `http://localhost:8000`

## API Documentation

### Endpoint: `/api/summarize/`

#### POST - Summarize a Document

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body: Form data with `file` field

**Supported File Types:**
- PDF (`.pdf`)
- Text (`.txt`)

**File Limits:**
- Maximum size: 10 MB

**Example using cURL:**
```bash
curl -X POST http://localhost:8000/api/summarize/ \
  -F "file=@document.pdf"
```

**Success Response (200 OK):**
```json
{
  "summary": "This document discusses the importance of...",
  "status": "success"
}
```

**Error Responses:**

- **400 Bad Request** - Invalid file or validation error
```json
{
  "error": "Invalid file type. Only pdf, txt files are allowed.",
  "status": "failed"
}
```

- **422 Unprocessable Entity** - Text extraction failed
```json
{
  "error": "Could not extract text from PDF. The file might be image-based or encrypted.",
  "status": "failed"
}
```

- **503 Service Unavailable** - AI service error
```json
{
  "error": "API rate limit exceeded. Please try again later.",
  "status": "failed"
}
```

#### GET - API Information

**Request:**
- Method: `GET`

**Response (200 OK):**
```json
{
  "message": "AI Document Summarizer API",
  "endpoint": "/api/summarize/",
  "method": "POST",
  "accepted_formats": ["PDF", "TXT"],
  "max_file_size": "10 MB",
  "usage": "Send a POST request with a 'file' field containing your document."
}
```

## Configuration

### Environment Variables

Edit `.env` file to configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `DJANGO_SECRET_KEY` | Django secret key | (auto-generated) |
| `DEBUG` | Debug mode | `True` |
| `ALLOWED_HOSTS` | Allowed host names | `localhost,127.0.0.1` |
| `CORS_ALLOWED_ORIGINS` | Frontend URLs for CORS | `http://localhost:5173,...` |
| `LLM_API_KEY` | LLM gateway API key | (required) |
| `LLM_API_BASE` | LLM gateway URL | `https://api.experientiallabs.ai/v1` |
| `LLM_MODEL` | Text model | `deepseek-v4-flash` |
| `LLM_VISION_MODEL` | OCR model | `gpt-5.6-luna` |
| `DEEPGRAM_API_KEY` | Deepgram key (Member role) | (required for transcription) |

### File Upload Settings

Modify in `config/settings.py`:

```python
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_FILE_TYPES = ['pdf', 'txt']
```

## Architecture

### Modular Design

1. **Views** (`views.py`) - Handle HTTP requests and orchestrate the workflow
2. **Serializers** (`serializers.py`) - Validate input and format output
3. **Text Extractor** (`utils/text_extractor.py`) - Extract text from different file formats
4. **AI Summarizer** (`utils/ai_summarizer.py`) - Communicate with OpenAI API

### Error Handling

The backend uses a comprehensive error handling strategy:
- **Validation errors** - Caught by serializers
- **Extraction errors** - Graceful handling of corrupt or unreadable files
- **AI errors** - User-friendly messages for API failures
- **Logging** - All errors logged for debugging

## Testing

### Manual Testing with cURL

```bash
# Test with PDF file
curl -X POST http://localhost:8000/api/summarize/ \
  -F "file=@sample.pdf"

# Test with TXT file
curl -X POST http://localhost:8000/api/summarize/ \
  -F "file=@sample.txt"

# Test error handling (wrong file type)
curl -X POST http://localhost:8000/api/summarize/ \
  -F "file=@image.jpg"
```

### Testing with Python

```python
import requests

url = "http://localhost:8000/api/summarize/"
files = {'file': open('document.pdf', 'rb')}
response = requests.post(url, files=files)
print(response.json())
```

## Production Deployment

### Security Checklist

1. Set `DEBUG=False` in production
2. Change `DJANGO_SECRET_KEY` to a strong random value
3. Update `ALLOWED_HOSTS` with your domain
4. Enable HTTPS (set security middleware options)
5. Use environment variables for all secrets
6. Set up proper logging

### Using Gunicorn

```bash
# Install gunicorn (included in requirements.txt)
pip install gunicorn

# Run with gunicorn
gunicorn config.wsgi:application --bind 0.0.0.0:8000
```

### Database (Optional)

Default uses SQLite. For production, consider PostgreSQL:

```python
# In settings.py, add:
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME'),
        'USER': os.environ.get('DB_USER'),
        'PASSWORD': os.environ.get('DB_PASSWORD'),
        'HOST': os.environ.get('DB_HOST'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}
```

## Troubleshooting

### Common Issues

1. **"AI summarization is not configured"**
   - Make sure `.env` file exists with `LLM_API_KEY`
   - Restart the server after adding the key

2. **"Could not extract text from PDF"**
   - PDF might be image-based (scanned document) - needs OCR
   - PDF might be encrypted or password-protected

3. **"CORS error" from frontend**
   - Add your frontend URL to `CORS_ALLOWED_ORIGINS` in `.env`
   - Restart the Django server

4. **"API rate limit exceeded"**
   - OpenAI API has usage limits based on your plan
   - Wait or upgrade your OpenAI account

## Future Enhancements

- [ ] Add support for DOCX files
- [ ] Implement OCR for scanned PDFs
- [ ] Add authentication and user accounts
- [ ] Store summaries in database
- [ ] Add summary history and management
- [ ] Support multiple AI providers
- [ ] Add batch processing
- [ ] Implement caching for repeated documents

## License

MIT License - feel free to use in your projects!

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review Django logs: Look for error messages in the console
3. Verify your OpenAI API key is active and has credits

---

**Built with Django REST Framework and OpenAI GPT** 🚀
