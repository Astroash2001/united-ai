"""
Serializers for file upload validation.
"""
from rest_framework import serializers
from django.conf import settings


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
