"""
Django settings for AI Summarizer project.

Production-ready configuration with environment variables support.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
load_dotenv(BASE_DIR / '.env')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.environ.get('DEBUG', 'False') == 'True'

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', '')
if not SECRET_KEY:
    if not DEBUG:
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DEBUG is False.")
    SECRET_KEY = 'django-insecure-local-development-only'


def _env_list(name, default=''):
    return [item.strip() for item in os.environ.get(name, default).split(',') if item.strip()]


ALLOWED_HOSTS = _env_list('ALLOWED_HOSTS', 'localhost,127.0.0.1')
# Render sets this automatically for web services.
if os.environ.get('RENDER_EXTERNAL_HOSTNAME'):
    ALLOWED_HOSTS.append(os.environ['RENDER_EXTERNAL_HOSTNAME'])

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third-party apps
    'rest_framework',
    #cors
    'corsheaders',
    
    # Local apps
    'summarizer',
]
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # MUST BE FIRST
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database
# Using SQLite for local development, PostgreSQL for production (Render)
if 'DATABASE_URL' in os.environ:
    # Production: Use PostgreSQL from Render
    DATABASES = {
        'default': dj_database_url.config(
            default=os.environ.get('DATABASE_URL'),
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    # Local development: Use SQLite
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# Whitenoise configuration for serving static files in production
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

# Media files (User uploads)
MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS Configuration - only listed frontend origins may call the API
CORS_ALLOWED_ORIGINS = _env_list(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://localhost:8080,http://localhost:8081,http://localhost:3000'
)

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_PARSER_CLASSES': [
        'rest_framework.parsers.JSONParser',
        'rest_framework.parsers.MultiPartParser',
        'rest_framework.parsers.FormParser',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.AllowAny',
    ],
    # Per-IP limits so anonymous callers cannot drain paid AI API credits.
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.ScopedRateThrottle',
    ],
    # Proxies in front of Django (Render adds one); used to find the real client IP.
    'NUM_PROXIES': int(os.environ.get('NUM_PROXIES', '0' if DEBUG else '1')),
    'DEFAULT_THROTTLE_RATES': {
        'ai_text': os.environ.get('THROTTLE_AI_TEXT', '60/hour'),
        'ai_heavy': os.environ.get('THROTTLE_AI_HEAVY', '20/hour'),
        'live_token': os.environ.get('THROTTLE_LIVE_TOKEN', '30/hour'),
    },
}

# File Upload Settings
# Uploads above 5MB are streamed to a temp file instead of held in memory.
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024  # 5 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 50 * 1024 * 1024  # 50 MB (non-file request body, e.g. document chat context)

# Allowed file types for document upload (summarize / extract-text)
ALLOWED_DOCUMENT_TYPES = ['pdf', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff']
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB (documents)
# Video and large audio are compressed with ffmpeg before upload to Deepgram.
MAX_MEDIA_FILE_SIZE = int(os.environ.get('MAX_MEDIA_FILE_SIZE_MB', '200')) * 1024 * 1024

# LLM Gateway Configuration (OpenAI-compatible; used for all text and vision features)
LLM_API_KEY = os.environ.get('LLM_API_KEY', '').strip('"')
LLM_API_BASE = os.environ.get('LLM_API_BASE', 'https://api.experientiallabs.ai/v1')
LLM_MODEL = os.environ.get('LLM_MODEL', 'deepseek-v4-flash')
LLM_VISION_MODEL = os.environ.get('LLM_VISION_MODEL', 'gpt-5.6-luna')
LLM_MAX_TOKENS = int(os.environ.get('LLM_MAX_TOKENS', '1000'))
LLM_TEMPERATURE = float(os.environ.get('LLM_TEMPERATURE', '0.7'))

# Deepgram Configuration (live and uploaded audio/video transcription)
DEEPGRAM_API_KEY = os.environ.get('DEEPGRAM_API_KEY', '')

# Optional web sources for document chat
JINA_API_KEY = os.environ.get('JINA_API_KEY', '')  # Jina Reader works without a key, at a lower rate limit
TAVILY_API_KEY = os.environ.get('TAVILY_API_KEY', '')  # Tavily web search

# Security Settings (production)
if not DEBUG:
    # Render terminates TLS at its proxy and forwards the original scheme.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = 'DENY'
