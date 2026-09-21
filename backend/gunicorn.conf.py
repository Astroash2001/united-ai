"""Gunicorn settings (auto-loaded from the working directory)."""
import os

# Transcribing long audio/video can take minutes; the default 30s timeout would kill it.
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "600"))
