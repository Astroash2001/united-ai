# 🤖 UNITED_AI.TXT (AI Summarizer Pro)

> **All-in-one Knowledge Operating System & Autonomous Intelligence Suite** built with React, Django REST Framework, OpenAI GPT-4o-mini, and Deepgram/Whisper speech models.

---

## ✨ Core Features & Capabilities

- 📄 **Document Summarization & OCR** — Upload **PDF**, **TXT**, or **Images (PNG, JPG, WEBP)** up to 10MB. Features automatic OCR image text extraction and executive bullet abstract generation.
- 🎙️ **Audio Speech Engine** — Upload **MP3, WAV, M4A, OGG** recordings or record live audio directly in-browser. Produces verbatim transcripts, interactive retro audio player playback, and timestamped chapter flags.
- 🎥 **Video Media Parser** — Process YouTube video links or local **MP4/WEBM** video uploads up to 50MB into structured meeting notes and timestamped video chapters.
- 💬 **Interactive RAG Document Chat** — Conversational Q&A system over uploaded document context with real-time response generation.
- 🧠 **Autonomous AI Brain Widget** — Retro terminal assistant (`UNITED_AI.BRAIN`) using `gpt-4o-mini` intelligence to answer system questions and execute direct, seamless page navigation across capabilities without annoying pop-ups.
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
- **OpenAI API** — `gpt-4o-mini` for fast summarization, RAG chat, and AI Brain rerouting
- **PyPDF** + **Pillow / Tesseract OCR** — Multi-format text extraction
- **PostgreSQL** — Production database (SQLite for local dev)
- **Gunicorn** + **WhiteNoise** — Production WSGI server and static assets

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.11+
- OpenAI API key ([Get one here](https://platform.openai.com/api-keys))

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
| `/api/summarize/` | `POST` | Summarize document / image (OCR) | `multipart/form-data` (`file`) |
| `/api/extract-text/` | `POST` | Extract raw text from file | `multipart/form-data` (`file`) |
| `/api/chat-document/` | `POST` | RAG Chat Q&A over document context | `json` (`question`, `context`) |
| `/api/transcribe-audio/` | `POST` | Transcribe audio files | `multipart/form-data` (`file`) |
| `/api/summarize-transcript/` | `POST` | Generate summary & chapters from transcript | `json` (`transcript`) |
| `/api/brain/` | `POST` | Autonomous AI Brain Q&A & Navigation | `json` (`question`, `current_route`) |

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
   - **Start Command**: `gunicorn config.wsgi:application`

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
│   ├── summarizer/             # Core views, brain views, text extractors
│   ├── requirements.txt        # Python dependencies
│   └── build.sh                # Production build script
└── frontend/                   # React 18 + Vite Frontend
    ├── src/
    │   ├── components/         # AIBrainWidget, ScrollToTop, HeroSection, Header, Footer
    │   ├── pages/              # Index, AudioTranscribe, VideoTranscribe, ChatWithDocument
    │   ├── services/           # api.ts, brain-api.ts, transcription-api.ts
    │   └── index.css           # Neo-brutalist theme & custom scrollbar styles
    ├── package.json            # Node dependencies
    └── vite.config.ts          # Vite build configuration
```

---

## 🎯 Completed Roadmap

- [x] Document Summarization with OCR (PDF, TXT, PNG, JPG, WEBP)
- [x] Interactive RAG Document Q&A Chat
- [x] Audio Speech Engine (Whisper / Live Recording / Chapter Flags)
- [x] Video Media Parser & YouTube Summarizer
- [x] Autonomous AI Brain Navigation Agent (`UNITED_AI.BRAIN`)
- [x] Direct Page Rerouting without Toast Pop-ups
- [x] Floating Retro Scroll-To-Top Controls
- [x] Single-command Render Deployment Setup

---

## 📝 License

Distributed under the [MIT License](LICENSE).
