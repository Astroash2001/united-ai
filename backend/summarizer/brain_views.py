"""
AI Brain Assistant view for autonomous routing and project Q&A.
Uses gpt-4o-mini (least token model) to answer questions specifically about AI Summarizer Pro
and autonomously navigate/reroute users to requested capabilities.
"""
import logging
import json
from openai import OpenAI
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import JSONParser
from django.conf import settings

logger = logging.getLogger(__name__)

def build_system_prompt(current_route="/"):
    return f"""You are the autonomous AI Brain & Navigation Intelligence for "AI Summarizer Pro" (also known as UNITED_AI.TXT).
Your job is to answer questions strictly related to AI Summarizer Pro, its features, capabilities, documentation, and architecture.

CURRENT USER LOCATION / PAGE: "{current_route}"

PROJECT PAGES & CAPABILITIES:
1. Document Chat & Summarization: Route "/chat-with-document" or "/". Supports PDF, TXT, and Image (PNG, JPG, WEBP) files with OCR. Interactive Q&A and text extraction.
2. Audio Transcription: Route "/audio". Upload MP3, WAV, M4A, OGG up to 25MB. Full transcription, summaries, timestamped chapters, retro audio player.
3. Video Summarization: Route "/video". YouTube links or MP4/WEBM uploads up to 50MB. Chapter markers, timestamped segments, transcript summaries.
4. About / Home Page: Route "/". Main landing page, feature breakdown, system specs.

NAVIGATION RULES:
1. DO NOT REROUTE IF USER IS ASKING A QUESTION: If the user asks "what is this page about?", "explain this tool", or asks questions about the current page ("{current_route}"), explain the current page clearly and set "target_route" to null.
2. ONLY REROUTE ON EXPLICIT SWITCH / USE REQUESTS: Only set "target_route" to a route if the user explicitly requests to go to, open, switch to, or use a capability on a DIFFERENT page than "{current_route}". If the target route is the same as "{current_route}", set "target_route" to null.

STRICT RULES:
1. SCOPE: ONLY answer questions related to AI Summarizer Pro. If a question is NOT related to AI Summarizer Pro, respond with: "I am the AI Summarizer Pro Autonomous Brain. I can only assist with questions, features, and navigation specifically related to AI Summarizer Pro."
2. TOKEN EFFICIENCY: Keep answers concise, direct, and under 90 words (minimum token consumption).

OUTPUT FORMAT:
You MUST respond with a JSON object matching this schema:
{{
  "answer": "string response",
  "target_route": "string or null",
  "action_description": "string or null"
}}
"""

class AIBrainView(APIView):
    """
    API Endpoint for the AI Brain Assistant.
    POST /api/brain/
    """
    parser_classes = [JSONParser]

    def post(self, request):
        question = request.data.get('question', '').strip()
        user_key = request.data.get('api_key', '').strip()
        current_route = request.data.get('current_route', '/').strip()

        if not question:
            return Response(
                {"error": "Question is required", "status": "failed"},
                status=status.HTTP_400_BAD_REQUEST
            )

        api_key = user_key or getattr(settings, 'OPENAI_API_KEY', None)
        if not api_key:
            return Response(
                {
                    "error": "OpenAI API key missing.",
                    "status": "failed"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        model_name = getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')

        try:
            client = OpenAI(api_key=api_key)
            system_prompt = build_system_prompt(current_route)

            response = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question}
                ],
                max_tokens=250,
                temperature=0.2,
                response_format={"type": "json_object"}
            )

            raw_content = response.choices[0].message.content
            parsed = json.loads(raw_content)

            target_route = parsed.get("target_route")
            # Safety check: if target route matches current route, do not re-route
            if target_route and target_route.rstrip('/') == current_route.rstrip('/'):
                target_route = None

            return Response(
                {
                    "answer": parsed.get("answer", ""),
                    "target_route": target_route,
                    "action_description": parsed.get("action_description") if target_route else None,
                    "model_used": model_name,
                    "tokens_used": response.usage.total_tokens if hasattr(response, 'usage') and response.usage else None,
                    "status": "success"
                },
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"AI Brain error: {str(e)}")
            return Response(
                {"error": f"AI Brain execution failed: {str(e)}", "status": "failed"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
