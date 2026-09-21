"""
Serializers for file upload validation and saved history.
"""
from rest_framework import serializers
from django.conf import settings

from .models import HistoryEntry

# Largest transcript/document text stored in one history entry.
MAX_HISTORY_TEXT_CHARS = 2_000_000


class FileUploadSerializer(serializers.Serializer):
    """
    Serializer for validating uploaded files.
    Only accepts document files (PDF, text, images) within size limits.
    """
    file = serializers.FileField(required=True)

    def validate_file(self, file):
        """
        Validate uploaded file:
        - Check file type (documents only)
        - Check file size
        - Ensure file is not empty
        """
        # Check if file is empty
        if not file:
            raise serializers.ValidationError("No file was uploaded.")
        
        # Check file size
        if file.size == 0:
            raise serializers.ValidationError("The uploaded file is empty.")
        
        if file.size > settings.MAX_FILE_SIZE:
            max_size_mb = settings.MAX_FILE_SIZE / (1024 * 1024)
            raise serializers.ValidationError(
                f"File size exceeds maximum limit of {max_size_mb}MB."
            )
        
        # Check file extension
        file_extension = file.name.split('.')[-1].lower()
        if file_extension not in settings.ALLOWED_DOCUMENT_TYPES:
            raise serializers.ValidationError(
                f"Invalid file type. Only {', '.join(settings.ALLOWED_DOCUMENT_TYPES)} files are allowed."
            )
        
        return file


class SummaryResponseSerializer(serializers.Serializer):
    """
    Serializer for summary response.
    """
    summary = serializers.CharField()
    status = serializers.CharField()
    
    
class ErrorResponseSerializer(serializers.Serializer):
    """
    Serializer for error response.
    """
    error = serializers.CharField()
    status = serializers.CharField()


class HistoryEntrySerializer(serializers.ModelSerializer):
    """Full history entry, used for create, update, and detail views."""

    class Meta:
        model = HistoryEntry
        fields = [
            "id", "kind", "title", "transcript", "summary", "chapters",
            "messages", "source_url", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_transcript(self, value):
        if len(value) > MAX_HISTORY_TEXT_CHARS:
            raise serializers.ValidationError("Text is too long to save.")
        return value

    def validate_messages(self, value):
        if not isinstance(value, list) or len(value) > 500:
            raise serializers.ValidationError("Messages must be a list of at most 500 items.")
        for message in value:
            if not isinstance(message, dict) or message.get("role") not in ("user", "assistant") \
                    or not isinstance(message.get("content"), str):
                raise serializers.ValidationError("Each message needs a role (user/assistant) and text content.")
        return value


class HistoryListSerializer(serializers.ModelSerializer):
    """Compact entry for the history list (no large text fields)."""
    preview = serializers.SerializerMethodField()

    class Meta:
        model = HistoryEntry
        fields = ["id", "kind", "title", "preview", "source_url", "created_at", "updated_at"]

    def get_preview(self, entry):
        text = entry.summary or entry.transcript
        return text[:160]
