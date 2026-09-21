"""
Download the audio track of a YouTube video for transcription (yt-dlp).

Note: YouTube often blocks downloads from cloud/datacenter IPs, so this can
fail on hosted servers even when it works locally.
"""
import logging
import os
import re
from typing import Optional, Tuple

import yt_dlp

logger = logging.getLogger(__name__)

MAX_DURATION_SECONDS = 2 * 60 * 60
_YOUTUBE_URL_RE = re.compile(r"^https?://(www\.|m\.|music\.)?(youtube\.com/(watch|shorts|live)|youtu\.be/)", re.IGNORECASE)


def is_youtube_url(url: str) -> bool:
    return bool(_YOUTUBE_URL_RE.match(url.strip()))


def download_youtube_audio(url: str, work_dir: str) -> Tuple[Optional[str], str, Optional[str]]:
    """
    Download the smallest audio stream of a YouTube video into work_dir.

    Returns:
        Tuple of (file_path, video_title, error_message)
    """
    options = {
        "format": "worstaudio[ext=m4a]/worstaudio/bestaudio",
        "outtmpl": os.path.join(work_dir, "youtube.%(ext)s"),
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
    }
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=False)
            if info.get("is_live"):
                return None, "", "Live streams cannot be transcribed."
            duration = info.get("duration") or 0
            if duration > MAX_DURATION_SECONDS:
                return None, "", "Video is longer than 2 hours."
            info = ydl.extract_info(url, download=True)
            return ydl.prepare_filename(info), info.get("title", "YouTube video"), None
    except Exception as e:
        logger.error(f"YouTube download failed: {e}")
        message = str(e)
        if "Sign in to confirm" in message or "bot" in message.lower():
            return None, "", "YouTube blocked the download from this server. Try uploading the video file instead."
        return None, "", "Could not download this YouTube video. Check the link, or upload the video file instead."
