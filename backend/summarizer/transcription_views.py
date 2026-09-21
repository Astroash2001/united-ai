"""
API Views for Audio and Video Transcription with Chapter Flags.
"""
import logging
import shutil
import tempfile
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from django.conf import settings
from .utils.audio_transcriber import transcribe_audio_video, audio_transcriber
from .utils.youtube import is_youtube_url, download_youtube_audio
from .utils.llm_client import get_llm_client
from .utils.transcript_transform import transform_transcript

logger = logging.getLogger(__name__)


class _TranscribeUploadView(APIView):
    """
    Shared upload handling for audio and video transcription.
    Form fields: file (required), mode ('meeting' | 'brainstorming'),
    summarize ('false' skips the AI summary and chapters).
    """
    throttle_scope = 'ai_heavy'
    parser_classes = [MultiPartParser, FormParser]
    missing_file_error = "No file provided. Field 'file' is required."

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        mode = request.data.get('mode', 'meeting')
        summarize = str(request.data.get('summarize', 'true')).lower() != 'false'

        if not uploaded_file:
            return Response(
                {"error": self.missing_file_error, "status": "failed"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if uploaded_file.size > settings.MAX_MEDIA_FILE_SIZE:
            max_mb = settings.MAX_MEDIA_FILE_SIZE // (1024 * 1024)
            return Response(
                {"error": f"File exceeds the maximum allowed size of {max_mb}MB.", "status": "failed"},
                status=status.HTTP_400_BAD_REQUEST
            )

        transcript, summary, chapters, error = transcribe_audio_video(uploaded_file, mode=mode, summarize=summarize)
        if error:
            return Response(
                {"error": error, "status": "failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(
            {
                "transcript": transcript,
                "summary": summary,
                "chapters": chapters,
                "filename": uploaded_file.name,
                "status": "success"
            },
            status=status.HTTP_200_OK
        )


class TranscribeAudioView(_TranscribeUploadView):
    """
    API endpoint for Audio and Live Meeting transcription with Timestamp Chapters.

    POST /api/transcribe-audio/
    """
    missing_file_error = "No audio file provided. Field 'file' is required."


class TranscribeVideoView(_TranscribeUploadView):
    """
    API endpoint for Video transcription with Timestamp Chapters.

    POST /api/transcribe-video/
    """
    missing_file_error = "No video file provided. Field 'file' is required."


class TranscribeYouTubeView(APIView):
    """
    API endpoint for YouTube video transcription with Timestamp Chapters.

    POST /api/transcribe-youtube/
    Body: {"url": "https://www.youtube.com/watch?v=...", "mode": "meeting"}
    """
    throttle_scope = 'ai_heavy'

    def post(self, request):
        url = str(request.data.get('url', '')).strip()
        mode = request.data.get('mode', 'meeting')

        if not is_youtube_url(url):
            return Response(
                {"error": "Please provide a valid YouTube video link.", "status": "failed"},
                status=status.HTTP_400_BAD_REQUEST
            )

        work_dir = tempfile.mkdtemp(prefix="youtube_")
        try:
            audio_path, title, error = download_youtube_audio(url, work_dir)
            if error:
                return Response({"error": error, "status": "failed"}, status=status.HTTP_502_BAD_GATEWAY)

            transcript, summary, chapters, error = audio_transcriber.transcribe_path(audio_path, mode=mode)
            if error:
                return Response({"error": error, "status": "failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            return Response(
                {
                    "transcript": transcript,
                    "summary": summary,
                    "chapters": chapters,
                    "filename": title,
                    "status": "success"
                },
                status=status.HTTP_200_OK
            )
        finally:
            shutil.rmtree(work_dir, ignore_errors=True)


class DeepgramTokenView(APIView):
    """
    Issue a short-lived Deepgram access token for browser-side live streaming.
    The permanent API key never leaves the server.

    POST /api/deepgram-token/
    Requires a DEEPGRAM_API_KEY with Member role or higher (Default-role keys cannot grant tokens).
    """
    throttle_scope = 'live_token'

    def post(self, request):
        import json
        import urllib.request
        import urllib.error

        api_key = getattr(settings, 'DEEPGRAM_API_KEY', '')
        if not api_key:
            return Response(
                {"error": "Deepgram API key is not configured.", "status": "failed"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        grant_request = urllib.request.Request(
            'https://api.deepgram.com/v1/auth/grant',
            data=json.dumps({"ttl_seconds": 60}).encode(),
            headers={'Authorization': f'Token {api_key}', 'Content-Type': 'application/json'},
            method='POST'
        )

        try:
            with urllib.request.urlopen(grant_request, timeout=10) as grant_response:
                data = json.load(grant_response)
        except urllib.error.HTTPError as e:
            logger.error(f"Deepgram token grant failed: HTTP {e.code} {e.read()[:200]!r}")
            return Response(
                {"error": f"Deepgram token grant failed (HTTP {e.code}).", "status": "failed"},
                status=status.HTTP_502_BAD_GATEWAY
            )
        except Exception as e:
            logger.error(f"Deepgram token grant error: {e}")
            return Response(
                {"error": "Could not reach Deepgram.", "status": "failed"},
                status=status.HTTP_502_BAD_GATEWAY
            )

        return Response(
            {
                "access_token": data.get("access_token"),
                "expires_in": data.get("expires_in"),
                "status": "success"
            },
            status=status.HTTP_200_OK
        )


class SummarizeTranscriptView(APIView):
    """
    Generate meeting summary and perform Semantic Speaker Correction via the LLM gateway.
    POST /api/summarize-transcript/
    Body: {"transcript": "...", "mode": "meeting"|"brainstorming", "participants": ["Name1", "Name2"]}
    """
    throttle_scope = 'ai_text'

    def post(self, request):
        transcript = request.data.get('transcript', '')
        mode = request.data.get('mode', 'meeting')
        participants = request.data.get('participants', [])

        if not transcript.strip():
            return Response(
                {"error": "No transcript provided", "status": "failed"},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            import json
            client = get_llm_client()
            if not client:
                return Response(
                    {"error": "AI service not configured. Please add LLM_API_KEY to environment.", "status": "failed"},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            participants_str = ", ".join(participants) if participants else "Unknown participants"

            if mode == "brainstorming":
                system_prompt = (
                    f"You are a Multilingual AI Product Strategist & Brainstorming Analyst. "
                    f"The session participants are: {participants_str}.\n\n"
                    "Perform two tasks:\n"
                    "1. SEMANTIC SPEAKER CORRECTION: Review raw transcript (which may contain English, Hindi, or Code-Mixed Hinglish). "
                    "Use dialogue context, self-identifications, and conversational flow to correct speaker names.\n"
                    "Keep every line break and every [mm:ss] timestamp at the start of its line; you may replace a [Speaker N] label with the person's name.\n"
                    "2. BRAINSTORMING SUMMARY: Generate structured markdown notes (Core Ideas, Key Insights, Next Steps). "
                    "Preserve all key concepts, action items, and language meaning accurately.\n\n"
                    "Format output strictly as JSON:\n"
                    "{\n"
                    '  "corrected_transcript": "Corrected transcript lines here...",\n'
                    '  "summary": "## 🚀 Core Ideas & Concepts\\n...\\n\\n## 💡 Key Insights\\n..."\n'
                    "}"
                )
            else:
                system_prompt = (
                    f"You are a Multilingual Executive Meeting Analyst and Dialogue Editor. "
                    f"The meeting participants are: {participants_str}.\n\n"
                    "Perform two tasks:\n"
                    "1. SEMANTIC SPEAKER CORRECTION: Review raw transcript (which may contain English, Hindi, or Code-Mixed Hinglish). "
                    "Use dialogue context, self-identifications (e.g. 'I am Avinash', 'Sahil speaking'), and turn-taking to correct speaker labels.\n"
                    "Keep every line break and every [mm:ss] timestamp at the start of its line; you may replace a [Speaker N] label with the person's name.\n"
                    "2. EXECUTIVE SUMMARY: Generate structured markdown notes (Executive Summary, Key Decisions, Action Items assigned to @person). "
                    "Preserve all technical terms, key decisions, and core meanings accurately.\n\n"
                    "Format output strictly as JSON:\n"
                    "{\n"
                    '  "corrected_transcript": "Corrected transcript lines here...",\n'
                    '  "summary": "## 📌 Executive Summary\\n...\\n\\n## 🎯 Key Decisions Made\\n...\\n\\n## ✅ Action Items\\n..."\n'
                    "}"
                )

            response = client.chat.completions.create(
                model=settings.LLM_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Raw Transcript:\n\n{transcript[:14000]}"}
                ],
                max_tokens=1500,
                temperature=0.3,
                response_format={"type": "json_object"}
            )

            raw_content = response.choices[0].message.content.strip()
            res_data = json.loads(raw_content)

            corrected_transcript = res_data.get("corrected_transcript", transcript)
            summary = res_data.get("summary", "")

            return Response(
                {
                    "summary": summary,
                    "corrected_transcript": corrected_transcript,
                    "status": "success"
                },
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"Transcript summarization error: {e}")
            return Response(
                {"error": f"Failed to generate summary: {str(e)}", "status": "failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TransformTranscriptView(APIView):
    """
    Show a transcript in Latin letters (Hinglish) or translated to English.

    POST /api/transform-transcript/
    Body: {"text": "...", "target": "latin" | "english"}
    """
    throttle_scope = 'ai_text'

    def post(self, request):
        text = str(request.data.get('text', ''))
        target = str(request.data.get('target', ''))

        result, error = transform_transcript(text, target)
        if error:
            return Response({"error": error, "status": "failed"}, status=status.HTTP_400_BAD_REQUEST)

        return Response({"text": result, "target": target, "status": "success"}, status=status.HTTP_200_OK)
