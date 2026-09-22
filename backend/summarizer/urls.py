"""
URL patterns for the summarizer app.
"""
from django.urls import path
from .views import SummarizeDocumentView
from .chat_views import ExtractTextView, ExtractUrlView, ChatWithDocumentView
from .transcription_views import (
    TranscribeAudioView, TranscribeVideoView, SummarizeTranscriptView, DeepgramTokenView,
    TransformTranscriptView,
)
from .brain_views import AIBrainView

app_name = 'summarizer'

urlpatterns = [
    path('summarize/', SummarizeDocumentView.as_view(), name='summarize'),
    path('extract-text/', ExtractTextView.as_view(), name='extract_text'),
    path('extract-url/', ExtractUrlView.as_view(), name='extract_url'),
    path('chat-document/', ChatWithDocumentView.as_view(), name='chat_document'),
    path('transcribe-audio/', TranscribeAudioView.as_view(), name='transcribe_audio'),
    path('transcribe-video/', TranscribeVideoView.as_view(), name='transcribe_video'),
    path('summarize-transcript/', SummarizeTranscriptView.as_view(), name='summarize_transcript'),
    path('transform-transcript/', TransformTranscriptView.as_view(), name='transform_transcript'),
    path('deepgram-token/', DeepgramTokenView.as_view(), name='deepgram_token'),
    path('brain/', AIBrainView.as_view(), name='brain'),
]

