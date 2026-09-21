"""
API Views for document summarization.

This module contains the main API endpoint for file upload and summarization.
"""
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from .serializers import FileUploadSerializer
from .utils.text_extractor import extract_text_from_file
from .utils.ai_summarizer import summarize_text, ai_summarizer
from .utils.streaming import ndjson_response

logger = logging.getLogger(__name__)


class SummarizeDocumentView(APIView):
    """
    API endpoint for document summarization.
    
    POST /api/summarize/
    
    Accepts file uploads (PDF or TXT), extracts text, and returns an AI-generated summary.
    
    Request:
        - file: The document file to summarize (PDF or TXT)
        - stream (optional): "true" to stream the summary as NDJSON lines
        
    Response (Success):
        {
            "summary": "Generated summary text...",
            "status": "success"
        }
        
    Response (Error):
        {
            "error": "Error message",
            "status": "failed"
        }
    """
    throttle_scope = 'ai_heavy'
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """
        Handle file upload and summarization request.
        
        Process flow:
        1. Validate uploaded file
        2. Extract text from file
        3. Send text to AI for summarization
        4. Return summary or error
        """
        # Step 1: Validate file upload
        serializer = FileUploadSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.warning(f"File validation failed: {serializer.errors}")
            return Response(
                {
                    "error": self._format_validation_errors(serializer.errors),
                    "status": "failed"
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = serializer.validated_data['file']
        logger.info(f"Processing file: {uploaded_file.name} ({uploaded_file.size} bytes)")
        
        # Step 2: Extract text from file
        try:
            extracted_text, extraction_error = extract_text_from_file(uploaded_file)
            
            if extraction_error:
                logger.error(f"Text extraction failed: {extraction_error}")
                return Response(
                    {
                        "error": extraction_error,
                        "status": "failed"
                    },
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY
                )
            
            logger.info(f"Extracted {len(extracted_text)} characters from {uploaded_file.name}")
            
        except Exception as e:
            logger.error(f"Unexpected extraction error: {str(e)}")
            return Response(
                {
                    "error": f"Failed to process file: {str(e)}",
                    "status": "failed"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Step 3: Generate AI summary (streamed when requested)
        if str(request.data.get('stream', '')).lower() == 'true':
            return ndjson_response(ai_summarizer.summarize_stream(extracted_text))

        try:
            summary, summarization_error = summarize_text(extracted_text)
            
            if summarization_error:
                logger.error(f"Summarization failed: {summarization_error}")
                return Response(
                    {
                        "error": summarization_error,
                        "status": "failed"
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
            
            logger.info(f"Successfully generated summary for {uploaded_file.name}")
            
        except Exception as e:
            logger.error(f"Unexpected summarization error: {str(e)}")
            return Response(
                {
                    "error": f"AI summarization failed: {str(e)}",
                    "status": "failed"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        # Step 4: Return successful response
        return Response(
            {
                "summary": summary,
                "status": "success"
            },
            status=status.HTTP_200_OK
        )
    
    @staticmethod
    def _format_validation_errors(errors):
        """
        Format DRF validation errors into a user-friendly message.
        
        Args:
            errors: DRF serializer errors dictionary
            
        Returns:
            Formatted error message string
        """
        if 'file' in errors:
            # Return the first file error message
            file_errors = errors['file']
            if isinstance(file_errors, list) and len(file_errors) > 0:
                return str(file_errors[0])
            return str(file_errors)
        
        # Generic error message
        return "Invalid request. Please upload a valid PDF or TXT file."
    
    def get(self, request):
        """
        Handle GET requests with API information.
        """
        return Response(
            {
                "message": "AI Document Summarizer API",
                "endpoint": "/api/summarize/",
                "method": "POST",
                "accepted_formats": ["PDF", "TXT"],
                "max_file_size": "10 MB",
                "usage": "Send a POST request with a 'file' field containing your document."
            },
            status=status.HTTP_200_OK
        )
