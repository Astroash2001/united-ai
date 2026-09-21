"""
Audio and Video transcription utility using OpenAI Whisper API & LLM gateway Meeting Intelligence.
Includes YouTube-style Timestamp Chapters & Segment Flags.

Large or video files are first converted to compact mono audio with ffmpeg, and
split into parts when still above Whisper's 25MB upload limit.
"""
import logging
import os
import re
import shutil
import subprocess
import tempfile
from typing import Any, Dict, List, Optional, Tuple

import imageio_ffmpeg
from openai import OpenAI
from django.conf import settings

from .llm_client import get_llm_client

logger = logging.getLogger(__name__)

# Extensions strictly allowed by OpenAI Whisper API
WHISPER_ALLOWED_EXTENSIONS = {'flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm'}
# Stay safely under Whisper's 25MB request limit.
WHISPER_MAX_BYTES = 24 * 1024 * 1024
# Container formats that carry video; their audio track is extracted before upload.
VIDEO_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'mpeg', 'm4v'}
# Part length when compact audio is still too large (20 min of 32 kbps mono ≈ 4.8MB).
SEGMENT_SECONDS = 1200

TranscriptionResult = Tuple[str, str, List[Dict[str, Any]], Optional[str]]

_CHAPTER_LINE_RE = re.compile(r"^\s*[-*]?\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*[-:–]?\s*(.+?)\s*$")


def format_timestamp(seconds: float) -> str:
    """Convert seconds into mm:ss or hh:mm:ss format."""
    secs = int(seconds)
    hrs, rem = divmod(secs, 3600)
    mins, rem_secs = divmod(rem, 60)
    if hrs > 0:
        return f"{hrs:02d}:{mins:02d}:{rem_secs:02d}"
    return f"{mins:02d}:{rem_secs:02d}"


def timestamp_to_seconds(timestamp: str) -> int:
    seconds = 0
    for part in timestamp.split(':'):
        seconds = seconds * 60 + int(part)
    return seconds


def parse_chapters(summary: str) -> List[Dict[str, Any]]:
    """
    Extract "[mm:ss] Title" chapter lines from the chapter section of a summary.
    Returns [{"timestamp": "01:15", "title": "...", "seconds": 75}, ...].
    """
    chapters = []
    in_chapter_section = False
    for line in summary.splitlines():
        if line.lstrip().startswith('#'):
            heading = line.lower()
            in_chapter_section = 'flag' in heading or 'chapter' in heading or 'timeline' in heading
            continue
        if not in_chapter_section:
            continue
        match = _CHAPTER_LINE_RE.match(line)
        if match:
            timestamp, title = match.groups()
            chapters.append({
                "timestamp": timestamp,
                "title": title.replace('**', '').strip(),
                "seconds": timestamp_to_seconds(timestamp),
            })
    return chapters


def _run_ffmpeg(args: List[str]) -> None:
    command = [imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y', *args]
    result = subprocess.run(command, capture_output=True, text=True, timeout=900)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.strip()[:300]}")


def prepare_audio_parts(source_path: str, work_dir: str) -> List[Tuple[str, float]]:
    """
    Return Whisper-ready audio files as (path, start_offset_seconds).
    Small audio files are used as-is; video or oversized files are converted
    to 16kHz mono 32kbps MP3 and split into parts if still too large.
    """
    extension = source_path.rsplit('.', 1)[-1].lower()
    size = os.path.getsize(source_path)
    if extension not in VIDEO_EXTENSIONS and extension in WHISPER_ALLOWED_EXTENSIONS and size <= WHISPER_MAX_BYTES:
        return [(source_path, 0.0)]

    compact_path = os.path.join(work_dir, 'compact.mp3')
    _run_ffmpeg(['-i', source_path, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k', compact_path])
    if os.path.getsize(compact_path) <= WHISPER_MAX_BYTES:
        return [(compact_path, 0.0)]

    pattern = os.path.join(work_dir, 'part_%03d.mp3')
    _run_ffmpeg(['-i', compact_path, '-f', 'segment', '-segment_time', str(SEGMENT_SECONDS), '-c', 'copy', pattern])
    parts = sorted(name for name in os.listdir(work_dir) if name.startswith('part_'))
    return [(os.path.join(work_dir, name), index * SEGMENT_SECONDS) for index, name in enumerate(parts)]


class AudioTranscriber:
    """
    Wrapper for AI audio/video transcription using OpenAI Whisper & LLM gateway Meeting Intelligence.
    Generates YouTube-style interactive chapter flags and timestamps.
    """

    def __init__(self):
        self.api_key = getattr(settings, 'OPENAI_API_KEY', '')
        if not self.api_key:
            logger.warning("OpenAI API key not configured")
        self.client = OpenAI(api_key=self.api_key) if self.api_key else None
        self.llm_client = get_llm_client()

    def _transcribe_part(self, path: str, offset: float) -> Tuple[str, List[str]]:
        """Transcribe one audio file; returns (plain_text, timestamped_lines)."""
        with open(path, "rb") as audio_file:
            response = self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                timestamp_granularities=["segment"]
            )

        text = getattr(response, 'text', str(response)).strip()
        lines = []
        for seg in getattr(response, 'segments', None) or []:
            content = getattr(seg, 'text', '').strip()
            if content:
                lines.append(f"[{format_timestamp(getattr(seg, 'start', 0.0) + offset)}] {content}")
        return text, lines

    def _summarize(self, timestamped_text: str, mode: str) -> str:
        """Generate chapter flags and meeting notes; falls back to a short notice on failure."""
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

        try:
            if not self.llm_client:
                raise RuntimeError("LLM_API_KEY not configured")
            response = self.llm_client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Here is the timestamped transcript:\n\n{timestamped_text[:14000]}"}
                ],
                max_tokens=900,
                temperature=0.4,
            )
            return response.choices[0].message.content.strip()
        except Exception as summary_err:
            logger.warning(f"Meeting intelligence generation failed: {summary_err}")
            return "Full verbatim transcription generated successfully."

    def transcribe_path(self, source_path: str, mode: str = "meeting", summarize: bool = True) -> TranscriptionResult:
        """
        Transcribe an audio/video file on disk.

        Returns:
            Tuple of (timestamped_transcript, summary_text, chapters_list, error_message)
        """
        if not self.client:
            return "", "", [], "OpenAI API key is not configured. Please add OPENAI_API_KEY to environment."

        work_dir = tempfile.mkdtemp(prefix="transcribe_")
        try:
            parts = prepare_audio_parts(source_path, work_dir)
            logger.info(f"Transcribing {source_path} via Whisper in {len(parts)} part(s)")

            texts, lines = [], []
            for path, offset in parts:
                text, part_lines = self._transcribe_part(path, offset)
                texts.append(text)
                lines.extend(part_lines)

            transcript = " ".join(t for t in texts if t).strip()
            if not transcript:
                return "", "", [], "Whisper API returned an empty transcription. Please ensure the audio contains clear speech."

            timestamped_text = "\n".join(lines) if lines else transcript
            if not summarize:
                return timestamped_text, "", [], None

            summary = self._summarize(timestamped_text, mode)
            return timestamped_text, summary, parse_chapters(summary), None

        except Exception as e:
            error_msg = str(e)
            logger.error(f"Whisper transcription error: {error_msg}")

            lowered = error_msg.lower()
            if "api_key" in lowered or "api key" in lowered or "401" in lowered:
                return "", "", [], "Invalid or missing OpenAI API key."
            elif "quota" in lowered or "rate_limit" in lowered:
                return "", "", [], "API rate limit exceeded. Please try again later."
            elif error_msg.startswith("ffmpeg failed"):
                return "", "", [], "Could not read audio from this file. It may be corrupted or in an unsupported format."
            else:
                return "", "", [], f"Transcription failed: {error_msg}"

        finally:
            shutil.rmtree(work_dir, ignore_errors=True)

    def transcribe_file(self, uploaded_file, mode: str = "meeting", summarize: bool = True) -> TranscriptionResult:
        """
        Transcribe an uploaded audio/video file (Django UploadedFile).

        Returns:
            Tuple of (timestamped_transcript, summary_text, chapters_list, error_message)
        """
        if not uploaded_file:
            return "", "", [], "No file provided"

        file_name = getattr(uploaded_file, 'name', 'recording.webm')
        raw_ext = file_name.split('.')[-1].lower() if '.' in file_name else 'webm'
        # Keep the real extension so ffmpeg and Whisper detect the format correctly.
        safe_ext = raw_ext if raw_ext.isalnum() and len(raw_ext) <= 5 else 'webm'

        temp_file_path = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=f".{safe_ext}") as temp_file:
                for chunk in uploaded_file.chunks():
                    temp_file.write(chunk)
                temp_file_path = temp_file.name
            return self.transcribe_path(temp_file_path, mode=mode, summarize=summarize)
        finally:
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.remove(temp_file_path)
                except Exception as cleanup_err:
                    logger.warning(f"Failed to remove temp file {temp_file_path}: {cleanup_err}")


audio_transcriber = AudioTranscriber()


def transcribe_audio_video(uploaded_file, mode: str = "meeting", summarize: bool = True) -> TranscriptionResult:
    """Convenience function for audio/video transcription with timestamp chapter flags."""
    return audio_transcriber.transcribe_file(uploaded_file, mode=mode, summarize=summarize)
