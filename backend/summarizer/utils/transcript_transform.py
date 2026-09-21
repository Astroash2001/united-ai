"""
Convert a transcript's display language with the LLM gateway:
  - "latin":   write Hindi (Devanagari) words in Latin letters (Hinglish), no translation
  - "english": translate everything into English

Timestamps ([mm:ss]), speaker labels, and line breaks are preserved so the
result can be shown and exported like the original.
"""
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import List, Optional, Tuple

from django.conf import settings

from .llm_client import get_llm_client

logger = logging.getLogger(__name__)

MAX_TRANSFORM_CHARS = 60000
_BATCH_CHARS = 5000

_INSTRUCTIONS = {
    "latin": (
        "You are a transliteration tool, not a translator or editor. Rewrite the text with every "
        "Hindi (Devanagari) word spelled in Latin letters, the way Hindi is commonly typed in India "
        "(for example: आज हम -> aaj hum, करेंगे -> karenge, ठीक है -> theek hai). "
        "Every word must stay the same word, in the same order: never rephrase, translate, add, "
        "or drop words. Keep English words, numbers, punctuation, line breaks, [mm:ss] timestamps, "
        "and [Speaker N] labels exactly as they are. Output only the converted text."
    ),
    "english": (
        "Translate the text into natural, accurate English. Keep line breaks, [mm:ss] "
        "timestamps, and [Speaker N] labels exactly as they are at the start of lines. "
        "Output only the translated text."
    ),
}


def _batches(text: str) -> List[str]:
    """Group whole lines into batches of at most ~_BATCH_CHARS characters."""
    batches, current, size = [], [], 0
    for line in text.split("\n"):
        if current and size + len(line) > _BATCH_CHARS:
            batches.append("\n".join(current))
            current, size = [], 0
        current.append(line)
        size += len(line) + 1
    if current:
        batches.append("\n".join(current))
    return batches


def transform_transcript(text: str, target: str) -> Tuple[str, Optional[str]]:
    """Return (converted_text, error_message)."""
    if target not in _INSTRUCTIONS:
        return "", "Unknown target. Use 'latin' or 'english'."
    if not text.strip():
        return "", "No transcript provided"
    if len(text) > MAX_TRANSFORM_CHARS:
        return "", f"Transcript is too long to convert (limit {MAX_TRANSFORM_CHARS:,} characters)."

    client = get_llm_client()
    if not client:
        return "", "AI service not configured. Please add LLM_API_KEY to environment."

    def convert(batch: str) -> str:
        response = client.chat.completions.create(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": _INSTRUCTIONS[target]},
                {"role": "user", "content": batch},
            ],
            max_tokens=4000,
            temperature=0.1,
        )
        return response.choices[0].message.content.strip()

    try:
        with ThreadPoolExecutor(max_workers=4) as pool:
            return "\n".join(pool.map(convert, _batches(text))), None
    except Exception as e:
        logger.error(f"Transcript transform error: {e}")
        return "", "Failed to convert transcript. Please try again."
