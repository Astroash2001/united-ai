"""
Text extraction utilities for different file formats.
Handles extracting text from PDF (with OpenAI Vision OCR fallback for scanned images & embedded diagrams), TXT, and Image files.
"""
import base64
import logging
from typing import Tuple
from io import BytesIO
from pypdf import PdfReader
from django.conf import settings
from openai import OpenAI

logger = logging.getLogger(__name__)


def ocr_image_bytes(image_bytes: bytes, mime_type: str = "image/png") -> str:
    """
    Perform high-accuracy OCR on raw image bytes using OpenAI GPT-4o Vision API.
    """
    try:
        if not settings.OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY is missing for Vision OCR.")
            return ""

        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        base64_img = base64.b64encode(image_bytes).decode('utf-8')
        data_url = f"data:{mime_type};base64,{base64_img}"

        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Identify, describe, and transcribe this image thoroughly. Transcribe ALL visible text, tables, headers, numbers, and labels accurately. If the image contains a chart, diagram, flowchart, graphic, or photo, clearly describe what the image depicts so it can be queried during Q&A."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": data_url
                            }
                        }
                    ]
                }
            ],
            max_tokens=2000
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"OCR Vision extraction failed: {e}")
        return ""


def extract_text_from_pdf(file) -> Tuple[str, str]:
    """
    Extract text from a PDF file safely using pypdf.
    Identifies embedded images/diagrams/figures on any page and applies OpenAI Vision OCR.
    """
    try:
        file.seek(0)
        file_bytes = file.read()

        if not file_bytes:
            return "", "PDF file is empty (0 bytes)."

        pdf_content = BytesIO(file_bytes)

        try:
            reader = PdfReader(pdf_content, strict=False)
        except Exception as reader_err:
            logger.warning(f"pypdf reader init error: {reader_err}")
            pdf_content.seek(0)
            reader = PdfReader(pdf_content)

        num_pages = len(reader.pages)
        if num_pages == 0:
            return "", "PDF file contains no pages."

        text_content = []

        for page_num in range(num_pages):
            try:
                page = reader.pages[page_num]
                page_text = (page.extract_text() or "").strip()
                
                # Check for embedded images on this page regardless of text length
                ocr_page_texts = []
                if hasattr(page, "images"):
                    for img in page.images:
                        try:
                            img_bytes = img.data
                            # Skip tiny decorative icons/bullets (under 2KB)
                            if len(img_bytes) < 2048:
                                continue
                                
                            ext = (img.name.split('.')[-1] if hasattr(img, 'name') and '.' in img.name else 'png').lower()
                            mime_map = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}
                            mime = mime_map.get(ext, 'image/png')
                            
                            extracted_ocr = ocr_image_bytes(img_bytes, mime_type=mime)
                            if extracted_ocr:
                                ocr_page_texts.append(extracted_ocr)
                        except Exception as img_err:
                            logger.warning(f"Failed page image OCR: {img_err}")

                page_parts = []
                if page_text:
                    page_parts.append(page_text)
                if ocr_page_texts:
                    page_parts.append("[Embedded Images / Diagrams Transcribed via OCR]:\n" + "\n".join(ocr_page_texts))

                if page_parts:
                    text_content.append(f"--- Page {page_num + 1} ---\n" + "\n\n".join(page_parts))

            except Exception as page_error:
                logger.warning(f"Failed to extract text from page {page_num + 1}: {str(page_error)}")
                continue

        full_text = "\n\n".join(text_content)

        if not full_text.strip():
            return "", "Could not extract readable text or image OCR from PDF. The document might be password-protected or empty."

        return full_text, None

    except Exception as e:
        logger.error(f"PDF extraction error: {str(e)}")
        return "", f"Failed to process PDF file: {str(e)}"


def extract_text_from_image(file) -> Tuple[str, str]:
    """
    Extract text directly from an uploaded image file (.png, .jpg, .jpeg, .webp, .bmp) using Vision OCR.
    """
    try:
        file.seek(0)
        content_bytes = file.read()
        if not content_bytes:
            return "", "Image file is empty (0 bytes)."
        
        ext = file.name.split('.')[-1].lower()
        mime_map = {'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp', 'bmp': 'image/bmp'}
        mime = mime_map.get(ext, 'image/png')

        extracted = ocr_image_bytes(content_bytes, mime_type=mime)
        if not extracted.strip():
            return "", "Could not extract readable text from uploaded image via OCR."
        
        return extracted, None
    except Exception as e:
        logger.error(f"Image OCR extraction error: {e}")
        return "", f"Failed to perform OCR on image: {str(e)}"


def extract_text_from_txt(file) -> Tuple[str, str]:
    """
    Extract text from a TXT file.
    """
    try:
        file.seek(0)
        content_bytes = file.read()

        if not content_bytes:
            return "", "Text file is empty"

        # Try UTF-8 first, fall back to latin-1
        try:
            text = content_bytes.decode('utf-8')
        except UnicodeDecodeError:
            text = content_bytes.decode('latin-1')

        if not text.strip():
            return "", "Text file contains no text"

        return text.strip(), None

    except Exception as e:
        logger.error(f"TXT extraction error: {str(e)}")
        return "", f"Failed to process text file: {str(e)}"


def extract_text_from_file(file) -> Tuple[str, str]:
    """
    Main extraction function that routes to appropriate handler based on file type.
    """
    if not file or not hasattr(file, 'name'):
        return "", "Invalid file object"

    file_extension = file.name.split('.')[-1].lower()

    if file_extension == 'pdf':
        return extract_text_from_pdf(file)
    elif file_extension in ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff']:
        return extract_text_from_image(file)
    elif file_extension in ['txt', 'md', 'csv', 'log', 'json']:
        return extract_text_from_txt(file)
    else:
        return "", f"Unsupported file type: .{file_extension}. Only PDF, Image (PNG/JPG/WEBP), and TXT files are allowed."
