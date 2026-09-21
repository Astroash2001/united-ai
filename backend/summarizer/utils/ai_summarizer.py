"""
AI summarization utilities using the LLM gateway.

This module handles communication with the AI model for text summarization.
Long documents are summarized in two passes: each section is condensed
separately, then the section notes are combined into one final summary.
"""
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Iterator, List, Optional, Tuple
from django.conf import settings

from .llm_client import get_llm_client
from .retrieval import chunk_text

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a helpful assistant that creates clear, concise summaries of documents. "
    "Focus on extracting the most important information."
)

# Documents up to this size are summarized in a single request.
SINGLE_PASS_CHARS = 12000
# Section size and cap for the first pass on long documents.
SECTION_CHARS = 10000
MAX_SECTIONS = 20


class AISummarizer:
    """
    Wrapper class for AI-powered text summarization using the LLM gateway.
    """

    def __init__(self):
        """Initialize LLM gateway client from settings."""
        self.client = get_llm_client()
        self.model = settings.LLM_MODEL
        self.max_tokens = settings.LLM_MAX_TOKENS
        self.temperature = settings.LLM_TEMPERATURE

    def _summarize_section(self, section: str, index: int, total: int) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"This is section {index + 1} of {total} of a long document. "
                        "Write concise notes of its key points, facts, figures, and names:\n\n"
                        f"{section}"
                    ),
                },
            ],
            max_tokens=500,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()

    def _final_messages(self, text: str) -> List[dict]:
        """
        Build the messages for the final summary request.
        For long documents this first condenses every section (in parallel).
        """
        if len(text) <= SINGLE_PASS_CHARS:
            content = (
                "Summarize this document clearly and concisely. "
                f"Focus on the main ideas and key points:\n\n{text}"
            )
        else:
            sections = chunk_text(text, chunk_size=SECTION_CHARS, overlap=0)
            if len(sections) > MAX_SECTIONS:
                logger.warning(f"Document has {len(sections)} sections; summarizing the first {MAX_SECTIONS}")
                sections = sections[:MAX_SECTIONS]
            with ThreadPoolExecutor(max_workers=4) as pool:
                notes = list(pool.map(
                    lambda item: self._summarize_section(item[1], item[0], len(sections)),
                    enumerate(sections),
                ))
            joined = "\n\n".join(f"Section {i + 1} notes:\n{note}" for i, note in enumerate(notes))
            content = (
                "Below are notes from every section of a long document, in order. "
                "Write one clear, concise summary of the whole document. "
                f"Focus on the main ideas and key points:\n\n{joined}"
            )
        return [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ]

    def _validate(self, text: str) -> Optional[str]:
        if not self.client:
            return "AI summarization is not configured. Please add LLM_API_KEY to environment."
        if not text.strip():
            return "No text provided for summarization"
        return None

    @staticmethod
    def _friendly_error(error: Exception) -> str:
        error_message = str(error)
        logger.error(f"AI summarization error: {error_message}")
        lowered = error_message.lower()
        if "api_key" in lowered:
            return "Invalid or missing API key"
        if "quota" in lowered or "rate_limit" in lowered:
            return "API rate limit exceeded. Please try again later."
        if "timeout" in lowered:
            return "Request timed out. Please try again."
        return f"AI summarization failed: {error_message}"

    def summarize(self, text: str) -> Tuple[str, Optional[str]]:
        """
        Generate a summary of the provided text using AI.

        Returns:
            Tuple of (summary, error_message). On success error_message is None;
            on failure summary is an empty string.
        """
        error = self._validate(text)
        if error:
            return "", error

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=self._final_messages(text),
                max_tokens=self.max_tokens,
                temperature=self.temperature,
            )
            summary = response.choices[0].message.content.strip()
            if not summary:
                return "", "AI returned an empty summary"
            return summary, None
        except Exception as e:
            return "", self._friendly_error(e)

    def summarize_stream(self, text: str) -> Iterator[Tuple[str, Optional[str]]]:
        """
        Stream the summary as it is generated.
        Yields (text_delta, None) pieces, or a single ("", error_message) on failure.
        """
        error = self._validate(text)
        if error:
            yield "", error
            return

        try:
            stream = self.client.chat.completions.create(
                model=self.model,
                messages=self._final_messages(text),
                max_tokens=self.max_tokens,
                temperature=self.temperature,
                stream=True,
            )
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content, None
        except Exception as e:
            yield "", self._friendly_error(e)


# Create a singleton instance
ai_summarizer = AISummarizer()


def summarize_text(text: str) -> Tuple[str, Optional[str]]:
    """
    Convenience function to summarize text using the default AI summarizer.

    Returns:
        Tuple of (summary, error_message)
    """
    return ai_summarizer.summarize(text)
