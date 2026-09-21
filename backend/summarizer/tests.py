"""
Unit tests for the summarizer app.

Run tests with: python manage.py test
"""
from django.test import TestCase, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APITestCase
from rest_framework import status
from unittest.mock import patch, MagicMock
from io import BytesIO

from .utils.text_extractor import extract_text_from_txt, extract_text_from_pdf
from .utils.ai_summarizer import AISummarizer


class TextExtractorTests(TestCase):
    """Test text extraction utilities."""
    
    def test_extract_text_from_txt_success(self):
        """Test successful text extraction from TXT file."""
        content = b"This is a test document."
        fake_file = SimpleUploadedFile("test.txt", content, content_type="text/plain")
        
        text, error = extract_text_from_txt(fake_file)
        
        self.assertIsNone(error)
        self.assertEqual(text, "This is a test document.")
    
    def test_extract_text_from_empty_txt(self):
        """Test extraction from empty TXT file."""
        content = b""
        fake_file = SimpleUploadedFile("empty.txt", content, content_type="text/plain")
        
        text, error = extract_text_from_txt(fake_file)
        
        self.assertIsNotNone(error)
        self.assertEqual(text, "")
        self.assertIn("empty", error.lower())


class AISummarizerTests(TestCase):
    """Test AI summarization utilities."""
    
    @override_settings(LLM_API_KEY='test-key')
    @patch('summarizer.utils.llm_client.OpenAI')
    def test_summarize_success(self, mock_openai):
        """Test successful summarization."""
        # Mock LLM gateway response
        mock_client = MagicMock()
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Test summary"
        mock_client.chat.completions.create.return_value = mock_response
        mock_openai.return_value = mock_client
        
        summarizer = AISummarizer()
        summary, error = summarizer.summarize("Long text to summarize")
        
        self.assertIsNone(error)
        self.assertEqual(summary, "Test summary")
    
    @override_settings(LLM_API_KEY='')
    def test_summarize_no_api_key(self):
        """Test summarization without API key."""
        summarizer = AISummarizer()
        summary, error = summarizer.summarize("Test text")
        
        self.assertIsNotNone(error)
        self.assertIn("not configured", error)
    
    def test_summarize_empty_text(self):
        """Test summarization with empty text."""
        summarizer = AISummarizer()
        summary, error = summarizer.summarize("")
        
        self.assertIsNotNone(error)
        self.assertIn("No text", error)


class SummarizeAPITests(APITestCase):
    """Test the /api/summarize/ endpoint."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.url = '/api/summarize/'
    
    def test_get_api_info(self):
        """Test GET request returns API information."""
        response = self.client.get(self.url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('message', response.data)
        self.assertIn('AI Document Summarizer', response.data['message'])
    
    def test_post_without_file(self):
        """Test POST request without file."""
        response = self.client.post(self.url, {})
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'failed')
    
    def test_post_with_invalid_file_type(self):
        """Test POST request with invalid file type."""
        fake_file = SimpleUploadedFile(
            "test.mp3",
            b"fake audio content",
            content_type="audio/mpeg"
        )
        
        response = self.client.post(self.url, {'file': fake_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'failed')
        self.assertIn('Invalid file type', response.data['error'])
    
    def test_post_with_empty_file(self):
        """Test POST request with empty file."""
        fake_file = SimpleUploadedFile("empty.txt", b"", content_type="text/plain")
        
        response = self.client.post(self.url, {'file': fake_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'failed')
    
    @override_settings(LLM_API_KEY='test-key')
    @patch('summarizer.views.summarize_text')
    def test_post_with_valid_txt_file(self, mock_summarize):
        """Test POST request with valid TXT file."""
        # Mock the summarization to return success
        mock_summarize.return_value = ("This is a summary", None)
        
        fake_file = SimpleUploadedFile(
            "test.txt",
            b"This is test content for summarization.",
            content_type="text/plain"
        )
        
        response = self.client.post(self.url, {'file': fake_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertIn('summary', response.data)
    
    @override_settings(MAX_FILE_SIZE=100)  # Set very small limit
    def test_post_with_oversized_file(self):
        """Test POST request with file exceeding size limit."""
        # Create file larger than limit
        large_content = b"x" * 200
        fake_file = SimpleUploadedFile("large.txt", large_content, content_type="text/plain")
        
        response = self.client.post(self.url, {'file': fake_file}, format='multipart')
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'failed')
        self.assertIn('size', response.data['error'].lower())


class SerializerTests(TestCase):
    """Test serializers."""
    
    def test_file_upload_serializer_validation(self):
        """Test FileUploadSerializer validates correctly."""
        from .serializers import FileUploadSerializer
        
        # Test with missing file
        serializer = FileUploadSerializer(data={})
        self.assertFalse(serializer.is_valid())
        
        # Test with valid file
        fake_file = SimpleUploadedFile("test.txt", b"content", content_type="text/plain")
        serializer = FileUploadSerializer(data={'file': fake_file})
        self.assertTrue(serializer.is_valid())
