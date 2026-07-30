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

logger = logging.getLogger(__name__)


class TranscribeAudioView(APIView):

    """
    API endpoint for Audio and Live Meeting transcription with Timestamp Chapters.
    
    POST /api/transcribe-audio/
    """
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


class SummarizeTranscriptView(APIView):
    """
    Generate meeting summary and perform Semantic Speaker Correction using GPT-4o.
    POST /api/summarize-transcript/
    Body: {"transcript": "...", "mode": "meeting"|"brainstorming", "participants": ["Name1", "Name2"]}
    """

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
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
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
                model=settings.OPENAI_MODEL,
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

