"""
Audio and Video transcription utility using OpenAI Whisper API & Meeting Intelligence.
Includes YouTube-style Timestamp Chapters & Segment Flags.
"""
import logging
import tempfile
import os
from typing import Tuple, List, Dict, Any
from openai import OpenAI
from django.conf import settings

logger = logging.getLogger(__name__)

# Extensions strictly allowed by OpenAI Whisper API
WHISPER_ALLOWED_EXTENSIONS = {'flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'}


class AudioTranscriber:
    """
    Wrapper for AI audio/video transcription using OpenAI Whisper & GPT-4o-mini Meeting Intelligence.
    Generates YouTube-style interactive chapter flags and timestamps.
    """

    def __init__(self):
        self.api_key = getattr(settings, 'OPENAI_API_KEY', '')
        if not self.api_key:
            logger.warning("OpenAI API key not configured")
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None

    @staticmethod
    def _format_timestamp(seconds: float) -> str:
        """Convert seconds into mm:ss or hh:mm:ss format."""
        secs = int(seconds)
        mins = secs // 60
        hrs = mins // 60
        rem_mins = mins % 60
        rem_secs = secs % 60
        if hrs > 0:
            return f"{hrs:02d}:{rem_mins:02d}:{rem_secs:02d}"
        return f"{rem_mins:02d}:{rem_secs:02d}"

    def transcribe_file(self, uploaded_file, mode: str = "meeting") -> Tuple[str, str, List[Dict[str, Any]], str]:
        """
        Transcribe audio/video using OpenAI Whisper API with timestamped segments and YouTube-style chapter flags.

        Args:
            uploaded_file: Django UploadedFile object (Audio/Video/WebM Blob)
            mode: 'meeting', 'brainstorming', or 'summary'

        Returns:
            Tuple of (transcript_text, summary_text, chapters_list, error_message)
        """
        if not self.client:
            return "", "", [], "OpenAI API key is not configured. Please add OPENAI_API_KEY to environment."

        if not uploaded_file:
            return "", "", [], "No file provided"

        # Determine file extension safely for OpenAI Whisper API
        file_name = getattr(uploaded_file, 'name', 'recording.webm')
        raw_ext = file_name.split('.')[-1].lower() if '.' in file_name else 'webm'

        # Map non-standard or missing extensions to Whisper supported extensions
        if raw_ext in WHISPER_ALLOWED_EXTENSIONS:
            safe_ext = raw_ext
        elif raw_ext in ['mov', 'avi', 'mkv']:
            safe_ext = 'mp4'
        elif raw_ext in ['aac', 'wma']:
            safe_ext = 'm4a'
        else:
            safe_ext = 'webm'

        temp_file_path = None

        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{safe_ext}") as temp_file:
                for chunk in uploaded_file.chunks():
                    temp_file.write(chunk)
                temp_file_path = temp_file.name

            logger.info(f"Transcribing via Whisper: {file_name} -> safe extension .{safe_ext} (temp path: {temp_file_path})")

            # Call OpenAI Whisper API requesting verbose_json format for timestamps
            with open(temp_file_path, "rb") as audio_file:
                verbose_response = self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="verbose_json",
                    timestamp_granularities=["segment"]
                )

            # Extract full verbatim transcript
            transcript = getattr(verbose_response, 'text', str(verbose_response)).strip()

            if not transcript:
                return "", "", [], "Whisper API returned an empty transcription. Please ensure the audio contains clear speech."

            # Extract timestamped segments
            segments_raw = getattr(verbose_response, 'segments', [])
            timestamped_transcript_lines = []
            formatted_chapters = []

            for seg in segments_raw:
                start_sec = getattr(seg, 'start', 0.0)
                end_sec = getattr(seg, 'end', 0.0)
                text_content = getattr(seg, 'text', '').strip()
                if text_content:
                    time_str = self._format_timestamp(start_sec)
                    timestamped_transcript_lines.append(f"[{time_str}] {text_content}")

            timestamped_text = "\n".join(timestamped_transcript_lines) if timestamped_transcript_lines else transcript

            # Generate YouTube-style Chapters & Meeting Intelligence using GPT-4o-mini
            summary = ""
            try:
                system_prompt = (
                    "You are an expert Video & Audio Editor and Executive Analyst. "
                    "Given the timestamped transcript of a discussion, audio, or video, perform two tasks:\n\n"
                    "1. Generate **YouTube-style Interactive Chapter Flags** (timestamps in [mm:ss] format followed by a concise topic title).\n"
                    "2. Provide a structured Executive Summary, Key Decisions, and Action Items.\n\n"
                    "Format your output clearly into Markdown:\n\n"
                    "## 🚩 Video/Audio Chapter Flags & Timestamps\n"
                    "- [00:00] Chapter Title 1\n"
                    "- [01:15] Chapter Title 2\n\n"
                    "## 📌 Executive Summary\n"
                    "Overview of the discussion...\n\n"
                    "## 🎯 Key Decisions Made\n"
                    "- Agreed decision points...\n\n"
                    "## ✅ Action Items & Assigned Tasks\n"
                    "- Task details..."
                )

                if mode == "brainstorming":
                    system_prompt = (
                        "You are an AI Product Strategist & Brainstorming Analyst. "
                        "Create YouTube-style timestamp chapter flags and summarize the brainstorming session:\n\n"
                        "## 🚩 Brainstorming Timeline Flags\n"
                        "- [00:00] Initial Problem Statement\n\n"
                        "## 🚀 Core Ideas & Concepts\n"
                        "## ⚡ Next Experiments & Steps"
                    )

                summary_response = self.client.chat.completions.create(
                    model=settings.OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Here is the timestamped transcript:\n\n{timestamped_text[:14000]}"}
                    ],
                    max_tokens=900,
                    temperature=0.4,
                )
                summary = summary_response.choices[0].message.content.strip()
            except Exception as summary_err:
                logger.warning(f"Meeting intelligence generation failed: {summary_err}")
                summary = "Full verbatim transcription generated successfully."

            return timestamped_text, summary, formatted_chapters, None

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Whisper transcription error: {error_msg}")

            if "api_key" in error_msg.lower():
                return "", "", [], "Invalid or missing OpenAI API key."
            elif "quota" in error_msg.lower() or "rate_limit" in error_msg.lower():
                return "", "", [], "API rate limit exceeded. Please try again later."
            else:
                return "", "", [], f"Transcription failed: {error_msg}"

        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception as cleanup_err:
                    logger.warning(f"Failed to remove temp file {temp_file_path}: {cleanup_err}")


audio_transcriber = AudioTranscriber()


def transcribe_audio_video(uploaded_file, mode: str = "meeting") -> Tuple[str, str, List[Dict[str, Any]], str]:
    """Convenience function for audio/video transcription with timestamp chapter flags."""
    return audio_transcriber.transcribe_file(uploaded_file, mode=mode)
