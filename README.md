# 🤖 UNITED_AI.TXT (AI Summarizer Pro)

> **All-in-one Knowledge Operating System & Autonomous Intelligence Suite** built with React, Django REST Framework, an OpenAI-compatible LLM gateway, and Deepgram speech recognition.

---

## ✨ Core Features & Capabilities

- 📄 **Document Summarization & OCR** — Upload **PDF**, **TXT**, or **Images (PNG, JPG, WEBP)** up to 10MB. Automatic OCR, streaming summary, and two-pass summaries for long documents.
- 🎙️ **Live Hindi + English Transcription** — Record in the browser and see words appear as you speak. Deepgram handles code-switched Hindi and English, labels speakers, and adds clickable timestamps that seek the recording.
- 🎧 **Audio & Video Transcription** — Upload **MP3, WAV, M4A, OGG** or **MP4, MOV, AVI, MKV** files up to 200MB, or paste a **YouTube link**. Transcribed by Deepgram with Hindi + English support and speaker labels; video and large files are compressed first. Produces timestamped transcripts, summaries, and chapter jump markers.
- 🔤 **Transcript Tools** — Show Hindi in Latin letters (Hinglish) or translated to English, and export as PDF, Word, Markdown, TXT, SRT, or VTT.
- 💬 **Document Chat** — Chat with a file or a web page link. Each question searches the whole document for relevant passages, remembers follow-ups, and can add cited web search results. Answers stream in.
- 🗂️ **History** — Summaries, transcripts, and chats are saved per browser; reopen them or continue a chat from the History page.
- 🧠 **Autonomous AI Brain Widget** — Retro terminal assistant (`UNITED_AI.BRAIN`) that answers questions about the app and navigates between pages.
- 🎨 **Neo-Brutalist Retro Aesthetics** — Hard parchment frames, monospace typography (`Space Mono`, `VT323`, `Silkscreen`), interactive spring-physics wave canvas, custom scrollbars, and floating `[ ⬆ TOP ]` scroll controls.

---

## 🛠️ Tech Stack

### Frontend
- **React 18** + **TypeScript** — UI architecture
- **Vite 5** — Lightning-fast bundler
- **Tailwind CSS** + **Lucide React** — Custom neo-brutalist styling system
- **React Router 6** — Dynamic SPA routing
- **Canvas Waves** — Interactive spring physics visualizer

### Backend
- **Django 5.0** + **Django REST Framework** — API engine
- **LLM gateway** (OpenAI-compatible, e.g. Experiential Labs) — summaries, chat, AI Brain, OCR, transliteration
- **Deepgram nova-3** — live and uploaded Hindi + English transcription with speaker labels
- **ffmpeg** (bundled via `imageio-ffmpeg`) + **yt-dlp** — audio extraction, compression, YouTube downloads
- **PyPDF** + vision-model OCR — Multi-format text extraction
- **Jina Reader** / **Tavily** (optional) — web page reading and web search for document chat
- **PostgreSQL** — Production database (SQLite for local dev)
- **Gunicorn** + **WhiteNoise** — Production WSGI server and static assets

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- API keys in `backend/.env` (see [`backend/.env.example`](backend/.env.example)):
  - `LLM_API_KEY` + `LLM_API_BASE` — OpenAI-compatible LLM gateway (required)
  - `DEEPGRAM_API_KEY` — live and uploaded transcription; the key needs the **Member** role so it can issue short-lived browser tokens
  - `TAVILY_API_KEY`, `JINA_API_KEY` — optional web search and higher web-page reading limits

---

### Local Development Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/Astroash2001/united-ai.git
cd united-ai
```

#### 2. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

Frontend will be running at **http://localhost:8080** (or **http://localhost:5173**).

#### 3. Backend Setup

```bash
# Navigate to backend directory
cd ../backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Windows CMD:
.\venv\Scripts\activate.bat
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create your .env from the template and fill in your keys
cp .env.example .env

# Run database migrations
python manage.py migrate

# Start Django development server
python manage.py runserver
```

Backend API will be running at **http://localhost:8000/api/**.

---

## 📖 API Documentation

| Endpoint | Method | Description | Request Format |
|---|---|---|---|
| `/api/summarize/` | `POST` | Summarize document / image (OCR); `stream=true` streams NDJSON | `multipart/form-data` (`file`, `stream`) |
| `/api/extract-text/` | `POST` | Extract raw text from file | `multipart/form-data` (`file`) |
| `/api/extract-url/` | `POST` | Read a web page as text | `json` (`url`) |
| `/api/chat-document/` | `POST` | Document Q&A; optional web search, follow-up history, streaming | `json` (`question`, `context`, `history`, `web_search`, `stream`) |
| `/api/transcribe-audio/` | `POST` | Transcribe audio (up to 200MB) | `multipart/form-data` (`file`, `mode`, `summarize`) |
| `/api/transcribe-video/` | `POST` | Transcribe video (up to 200MB) | `multipart/form-data` (`file`, `mode`, `summarize`) |
| `/api/transcribe-youtube/` | `POST` | Transcribe a YouTube video | `json` (`url`, `mode`) |
| `/api/summarize-transcript/` | `POST` | Summary & speaker correction for a transcript | `json` (`transcript`) |
| `/api/transform-transcript/` | `POST` | Hindi in Latin letters, or English translation | `json` (`text`, `target`: `latin`/`english`) |
| `/api/deepgram-token/` | `POST` | Short-lived Deepgram token for live transcription | — |
| `/api/history/` | `GET`/`POST` | List / save history entries (needs `X-Client-Id` header) | `json` |
| `/api/history/<id>/` | `GET`/`PATCH`/`DELETE` | Read / update / delete one entry | `json` |
| `/api/brain/` | `POST` | Autonomous AI Brain Q&A & Navigation | `json` (`question`, `current_route`) |

All AI endpoints are rate-limited per IP (defaults: 60/hour text, 20/hour heavy uploads; configurable with `THROTTLE_*` env vars). Streaming responses are newline-delimited JSON: `{"delta": "..."}` pieces, then `{"done": true}` or `{"error": "..."}`.

---

## 🌐 Deployment on Render

This project is pre-configured for instant deployment on [Render](https://render.com).

### Deployment Summary
1. **Root Wrapper**: Includes a root [`package.json`](package.json) for smooth build execution across subdirectories.
2. **Frontend Static Site**:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
3. **Backend Web Service**:
   - **Root Directory**: `backend`
   - **Build Command**: `./build.sh`
   - **Start Command**: `gunicorn config.wsgi:application` (reads `backend/gunicorn.conf.py`, which raises the timeout to 600s for long transcriptions)
   - **Required env vars**: `DJANGO_SECRET_KEY`, `DEBUG=False`, `CORS_ALLOWED_ORIGINS` (your frontend URL), `LLM_API_KEY`, `LLM_API_BASE`, `DEEPGRAM_API_KEY`. `ALLOWED_HOSTS` is optional on Render (the service hostname is added automatically).

For full details, see the step-by-step [DEPLOYMENT.md](DEPLOYMENT.md) guide.

---

## 📁 Repository Structure

```
united-ai/
├── package.json                # Root package wrapper for deployment
├── DEPLOYMENT.md               # Detailed deployment guide
├── README.md                   # Project documentation
├── backend/                    # Django REST API Backend
│   ├── config/                 # Settings, URLs, WSGI configuration
│   ├── summarizer/             # API views, history model, tests
│   │   └── utils/              # LLM client, retrieval, transcription, streaming, web sources
│   ├── requirements.txt        # Python dependencies
│   └── build.sh                # Production build script
└── frontend/                   # React 18 + Vite Frontend
    ├── src/
    │   ├── components/         # AIBrainWidget, TranscriptPanel, ChapterFlags, HeroSection, Header, Footer
    │   ├── hooks/              # useLiveTranscription (Deepgram + browser fallback)
    │   ├── pages/              # Index, AudioTranscribe, VideoTranscribe, ChatWithDocument, History
    │   ├── services/           # config.ts (shared fetch), api, chat, transcription, history, brain
    │   ├── utils/              # liveTranscript, transcriptExport, multilingual, pdfExport
    │   ├── test/               # Vitest unit tests
    │   └── index.css           # Neo-brutalist theme & custom scrollbar styles
    ├── package.json            # Node dependencies
    └── vite.config.ts          # Vite build configuration
```

---

## 🎯 Completed Roadmap

- [x] Document Summarization with OCR (PDF, TXT, PNG, JPG, WEBP)
- [x] Interactive RAG Document Q&A Chat
- [x] Audio Speech Engine (Deepgram / Live Recording / Chapter Flags)
- [x] Video Media Parser & YouTube Summarizer
- [x] Autonomous AI Brain Navigation Agent (`UNITED_AI.BRAIN`)
- [x] Direct Page Rerouting without Toast Pop-ups
- [x] Floating Retro Scroll-To-Top Controls
- [x] Single-command Render Deployment Setup
- [x] Live Hindi + English transcription with speaker labels and clickable timestamps
- [x] Large audio/video uploads (compress + split) and YouTube links
- [x] Saved history, streaming answers, web page chat, web search
- [x] Transcript exports (PDF, DOCX, Markdown, SRT, VTT) and Hinglish/English views

---

## 🧪 Tests

```bash
cd backend && python manage.py test summarizer   # Django API and helpers
cd frontend && npm test                          # Vitest unit tests
```

---

## 📝 License

Distributed under the [MIT License](LICENSE).
