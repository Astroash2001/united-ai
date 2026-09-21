"""
API Views for Audio and Video Transcription with Chapter Flags.
"""
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from django.conf import settings
from .utils.audio_transcriber import transcribe_audio_video, WHISPER_ALLOWED_EXTENSIONS
from .utils.llm_client import get_llm_client

logger = logging.getLogger(__name__)


class TranscribeAudioView(APIView):

    """
    API endpoint for Audio and Live Meeting transcription with Timestamp Chapters.
    
    POST /api/transcribe-audio/
    """
    throttle_scope = 'ai_heavy'
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        mode = request.data.get('mode', 'meeting')

        if not uploaded_file:
            return Response(
                {"error": "No audio file provided. Field 'file' is required.", "status": "failed"},
                status=status.HTTP_400_BAD_REQUEST
            )

        transcript, summary, chapters, error = transcribe_audio_video(uploaded_file, mode=mode)
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


class TranscribeVideoView(APIView):
    """
    API endpoint for Video transcription with Timestamp Chapters.
    
    POST /api/transcribe-video/
    """
    throttle_scope = 'ai_heavy'
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        mode = request.data.get('mode', 'meeting')

        if not uploaded_file:
            return Response(
                {"error": "No video file provided. Field 'file' is required.", "status": "failed"},
                status=status.HTTP_400_BAD_REQUEST
            )

        transcript, summary, chapters, error = transcribe_audio_video(uploaded_file, mode=mode)
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

