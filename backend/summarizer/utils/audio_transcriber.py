"""
Audio and Video transcription utility using Deepgram & LLM gateway Meeting Intelligence.
Includes YouTube-style Timestamp Chapters & Segment Flags.

Deepgram nova-3 with language=multi transcribes code-switched Hindi + English,
writing each word in its own script, and labels speakers. Video and large
audio files are first converted to compact mono audio with ffmpeg so the
upload to Deepgram stays small.
"""
import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

import imageio_ffmpeg
from django.conf import settings

from .llm_client import get_llm_client

logger = logging.getLogger(__name__)

DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen"
# Audio formats sent to Deepgram as-is when small; everything else is converted first.
DIRECT_AUDIO_EXTENSIONS = {'flac', 'm4a', 'mp3', 'oga', 'ogg', 'wav', 'webm', 'aac', 'opus'}
# Larger audio files are compressed before upload to keep the transfer fast.
DIRECT_UPLOAD_MAX_BYTES = 24 * 1024 * 1024
# Deepgram processes long files in one request; allow up to 10 minutes.
DEEPGRAM_TIMEOUT_SECONDS = 600

# Grouping of Deepgram utterances into sentence-sized, timestamped transcript lines.
PAUSE_GAP_SECONDS = 2
LONG_LINE_CHARS = 120

TranscriptionResult = Tuple[str, str, List[Dict[str, Any]], Optional[str]]

_CHAPTER_LINE_RE = re.compile(r"^\s*[-*]?\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*[-:–]?\s*(.+?)\s*$")


class TranscriptionError(Exception):
    """A transcription failure with a message that is safe to show to users."""


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


def utterances_to_lines(utterances: List[Dict[str, Any]]) -> List[str]:
    """
    Group Deepgram utterances into "[mm:ss] [Speaker N] text" lines.
    Consecutive utterances from the same speaker are joined unless separated
    by a pause or the line is already long. Speaker labels appear only when
    more than one speaker was heard.
    """
    lines: List[Dict[str, Any]] = []
    last_end = None
    for utterance in utterances:
        text = (utterance.get("transcript") or "").strip()
        if not text:
            continue
        speaker = utterance.get("speaker")
        current = lines[-1] if lines else None
        start_new = (
            current is None
            or speaker != current["speaker"]
            or (last_end is not None and utterance.get("start", 0) - last_end > PAUSE_GAP_SECONDS)
            or len(current["text"]) >= LONG_LINE_CHARS
        )
        if start_new:
            lines.append({"start": utterance.get("start", 0), "speaker": speaker, "text": text})
        else:
            current["text"] = f"{current['text']} {text}"
        last_end = utterance.get("end", last_end)

    show_speakers = len({line["speaker"] for line in lines if line["speaker"] is not None}) > 1
    rendered = []
    for line in lines:
        label = f"[Speaker {line['speaker'] + 1}] " if show_speakers and line["speaker"] is not None else ""
        rendered.append(f"[{format_timestamp(line['start'])}] {label}{line['text']}")
    return rendered


def _run_ffmpeg(args: List[str]) -> None:
    command = [imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y', *args]
    result = subprocess.run(command, capture_output=True, text=True, timeout=900)
    if result.returncode != 0:
        raise TranscriptionError("Could not read audio from this file. It may be corrupted or in an unsupported format.")


def prepare_audio(source_path: str, work_dir: str) -> str:
    """
    Return the path of the audio file to upload. Small audio files are used
    as-is; video or large files are converted to 16kHz mono 32kbps MP3.
    """
    extension = source_path.rsplit('.', 1)[-1].lower()
    if extension in DIRECT_AUDIO_EXTENSIONS and os.path.getsize(source_path) <= DIRECT_UPLOAD_MAX_BYTES:
        return source_path

    compact_path = os.path.join(work_dir, 'compact.mp3')
    _run_ffmpeg(['-i', source_path, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '32k', compact_path])
    return compact_path


def deepgram_transcribe(path: str, language: str = "multi") -> Dict[str, Any]:
    """Send an audio file to Deepgram's pre-recorded API and return the JSON result."""
    api_key = getattr(settings, 'DEEPGRAM_API_KEY', '')
    if not api_key:
        raise TranscriptionError("Deepgram API key is not configured. Please add DEEPGRAM_API_KEY to environment.")

    params = urllib.parse.urlencode({
        "model": "nova-3",
        "language": language,
        "smart_format": "true",
        "punctuate": "true",
        "diarize": "true",
        "utterances": "true",
    })
    with open(path, "rb") as audio_file:
        request = urllib.request.Request(
            f"{DEEPGRAM_LISTEN_URL}?{params}",
            data=audio_file,
            headers={
                "Authorization": f"Token {api_key}",
                "Content-Type": "audio/*",
                "Content-Length": str(os.path.getsize(path)),
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=DEEPGRAM_TIMEOUT_SECONDS) as response:
                return json.load(response)
        except urllib.error.HTTPError as e:
            logger.error(f"Deepgram transcription failed: HTTP {e.code} {e.read()[:300]!r}")
            if e.code in (401, 403):
                raise TranscriptionError("Invalid or missing Deepgram API key.")
            if e.code == 429:
                raise TranscriptionError("Transcription rate limit exceeded. Please try again later.")
            if e.code == 400:
                raise TranscriptionError("Deepgram could not process this audio. It may be corrupted or silent.")
            raise TranscriptionError(f"Transcription failed (Deepgram HTTP {e.code}).")
        except (urllib.error.URLError, TimeoutError) as e:
            logger.error(f"Deepgram connection error: {e}")
            raise TranscriptionError("Could not reach the transcription service. Please try again.")


class AudioTranscriber:
    """
    Wrapper for AI audio/video transcription using Deepgram & LLM gateway Meeting Intelligence.
    Generates YouTube-style interactive chapter flags and timestamps.
    """

    def __init__(self):
        self.llm_client = get_llm_client()

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
        work_dir = tempfile.mkdtemp(prefix="transcribe_")
        try:
            audio_path = prepare_audio(source_path, work_dir)
            logger.info(f"Transcribing {source_path} via Deepgram ({os.path.getsize(audio_path)} bytes)")
            result = deepgram_transcribe(audio_path).get("results", {})

            lines = utterances_to_lines(result.get("utterances") or [])
            plain = (
                result.get("channels", [{}])[0].get("alternatives", [{}])[0].get("transcript", "")
                if result.get("channels") else ""
            ).strip()
            timestamped_text = "\n".join(lines) if lines else plain
            if not timestamped_text:
                return "", "", [], "No speech was found in this file. Please ensure the audio contains clear speech."

            if not summarize:
                return timestamped_text, "", [], None

            summary = self._summarize(timestamped_text, mode)
            return timestamped_text, summary, parse_chapters(summary), None

        except TranscriptionError as e:
            return "", "", [], str(e)
        except Exception as e:
            logger.error(f"Transcription error: {e}")
            return "", "", [], f"Transcription failed: {e}"
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
        # Keep the real extension so ffmpeg detects the format correctly.
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
