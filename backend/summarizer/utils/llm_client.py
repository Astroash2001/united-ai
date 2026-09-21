"""
Shared chat-completion client for all text and vision features.

Points the OpenAI SDK at the OpenAI-compatible LLM gateway configured by
LLM_API_KEY / LLM_API_BASE. Speech transcription uses Deepgram instead
(see audio_transcriber.py).
"""
import logging
from typing import Optional
from openai import OpenAI
from django.conf import settings

logger = logging.getLogger(__name__)


def get_llm_client() -> Optional[OpenAI]:
    """Return a gateway client, or None when LLM_API_KEY is not configured."""
    api_key = getattr(settings, 'LLM_API_KEY', '')
    if not api_key:
        logger.warning("LLM_API_KEY not configured")
        return None
    return OpenAI(api_key=api_key, base_url=settings.LLM_API_BASE)
