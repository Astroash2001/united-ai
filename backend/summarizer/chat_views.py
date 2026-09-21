"""
Additional views for chat with document functionality.
"""
import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .serializers import FileUploadSerializer
from .utils.text_extractor import extract_text_from_file
from .utils.ai_summarizer import ai_summarizer
from .utils.retrieval import select_relevant_context
from .utils.streaming import ndjson_response
from .utils.web_sources import fetch_url_text, web_search

# Longest answer the model may write, and how many earlier chat messages it sees.
ANSWER_MAX_TOKENS = 800
MAX_HISTORY_TURNS = 6

logger = logging.getLogger(__name__)


class ExtractTextView(APIView):
    """
    API endpoint to extract text from a document without summarizing.
    
    POST /api/extract-text/
    
    Returns the extracted text for chat functionality.
    """
    throttle_scope = 'ai_heavy'
    parser_classes = [MultiPartParser, FormParser]
    
    def post(self, request):
        """Extract text from uploaded file."""
        # Validate file upload
        serializer = FileUploadSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(
                {
                    "error": self._format_validation_errors(serializer.errors),
                    "status": "failed"
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uploaded_file = serializer.validated_data['file']
        
        # Extract text from file
        try:
            extracted_text, extraction_error = extract_text_from_file(uploaded_file)
            
            if extraction_error:
                return Response(
                    {
                        "error": extraction_error,
                        "status": "failed"
                    },
                    status=status.HTTP_422_UNPROCESSABLE_ENTITY
                )
            
            return Response(
                {
                    "text": extracted_text,
                    "filename": uploaded_file.name,
                    "status": "success"
                },
                status=status.HTTP_200_OK
            )
            
        except Exception as e:
            logger.error(f"Text extraction error: {str(e)}")
            return Response(
                {
                    "error": f"Failed to extract text: {str(e)}",
                    "status": "failed"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @staticmethod
    def _format_validation_errors(errors):
        """Format validation errors into user-friendly message."""
        if 'file' in errors:
            file_errors = errors['file']
            if isinstance(file_errors, list) and len(file_errors) > 0:
                return str(file_errors[0])
            return str(file_errors)
        return "Invalid request. Please upload a valid PDF or TXT file."


class ChatWithDocumentView(APIView):
    """
    API endpoint for chatting with a document.
    
    POST /api/chat-document/
    
    Accepts a question and document context, returns AI-generated answer.
    """
    throttle_scope = 'ai_text'
    parser_classes = [JSONParser]
    
    def post(self, request):
        """Answer questions about document context."""
        try:
            # Get question and context from request
            question = request.data.get('question', '').strip()
            context = request.data.get('context', '').strip()
            
            # Validate inputs
            if not question:
                return Response(
                    {
                        "error": "Question is required",
                        "status": "failed"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not context:
                return Response(
                    {
                        "error": "Document context is required",
                        "status": "failed"
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Long documents: send only the passages most relevant to the question
            relevant_context = select_relevant_context(context, question, max_chars=8000)

            # Optional live web results (Tavily)
            web_results = []
            if request.data.get('web_search') is True:
                web_results, search_error = web_search(question)
                if search_error:
                    return Response(
                        {"error": search_error, "status": "failed"},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE
                    )

            if web_results:
                web_block = "\n\n".join(
                    f"[{i + 1}] {r['title']} ({r['url']})\n{r['content']}" for i, r in enumerate(web_results)
                )
                prompt = f"""Answer the user's question using the document content and the web search results below.

Document Content:
{relevant_context}

Web Search Results:
{web_block}

User Question: {question}

Prefer the document. When you use a web result, cite it as [1], [2], or [3]. If neither source answers the question, say so."""
            else:
                prompt = f"""Based on the following document content, answer the user's question.

Document Content:
{relevant_context}

User Question: {question}

Answer the question based only on the information provided in the document. If the answer is not in the document, say so."""

            # Get AI response
            if not ai_summarizer.client:
                return Response(
                    {
                        "error": "AI service not configured",
                        "status": "failed"
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )

            messages = [
                {
                    "role": "system",
                    "content": "You are a helpful assistant that answers questions about documents accurately and concisely."
                },
                *self._previous_turns(request.data.get('history')),
                {
                    "role": "user",
                    "content": prompt
                }
            ]
            sources_footer = (
                "\n\nSources:\n" + "\n".join(f"[{i + 1}] {r['title']} - {r['url']}" for i, r in enumerate(web_results))
                if web_results else ""
            )

            if request.data.get('stream') is True:
                return ndjson_response(self._stream_answer(messages, sources_footer))

            try:
                response = ai_summarizer.client.chat.completions.create(
                    model=ai_summarizer.model,
                    messages=messages,
                    max_tokens=ANSWER_MAX_TOKENS,
                    temperature=0.7,
                )

                answer = response.choices[0].message.content.strip() + sources_footer
                
                return Response(
                    {
                        "answer": answer,
                        "status": "success"
                    },
                    status=status.HTTP_200_OK
                )
                
            except Exception as ai_error:
                logger.error(f"AI chat error: {str(ai_error)}")
                return Response(
                    {
                        "error": "Failed to get AI response",
                        "status": "failed"
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE
                )
        
        except Exception as e:
            logger.error(f"Chat error: {str(e)}")
            return Response(
                {
                    "error": f"Server error: {str(e)}",
                    "status": "failed"
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @staticmethod
    def _previous_turns(history):
        """Last few chat messages, so follow-up questions keep their context."""
        if not isinstance(history, list):
            return []
        turns = [
            {"role": item["role"], "content": item["content"][:2000]}
            for item in history[-MAX_HISTORY_TURNS:]
            if isinstance(item, dict) and item.get("role") in ("user", "assistant") and isinstance(item.get("content"), str)
        ]
        return turns

    @staticmethod
    def _stream_answer(messages, sources_footer=""):
        """Yield (text_delta, error) pieces of the answer as the model generates it."""
        try:
            stream = ai_summarizer.client.chat.completions.create(
                model=ai_summarizer.model,
                messages=messages,
                max_tokens=ANSWER_MAX_TOKENS,
                temperature=0.7,
                stream=True,
            )
            for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content, None
            if sources_footer:
                yield sources_footer, None
        except Exception as e:
            logger.error(f"AI chat stream error: {str(e)}")
            yield "", "Failed to get AI response"


class ExtractUrlView(APIView):
    """
    Read a web page as text for document chat.

    POST /api/extract-url/
    Body: {"url": "https://..."}
    """
    throttle_scope = 'ai_heavy'
    parser_classes = [JSONParser]

    def post(self, request):
        url = str(request.data.get('url', '')).strip()
        text, title, error = fetch_url_text(url)
        if error:
            return Response({"error": error, "status": "failed"}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        return Response({"text": text, "filename": title, "status": "success"}, status=status.HTTP_200_OK)
