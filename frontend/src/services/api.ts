/**
 * API Service for interacting with the Django backend
 * Handles file uploads and summarization requests
 */

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocalhost 
  ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api')
  : (import.meta.env.VITE_API_URL || 'https://ai-summarizer-pro-omy1.onrender.com/api');


/**
 * Response interface for successful summarization
 */
export interface SummaryResponse {
  summary: string;
  status: 'success';
}

/**
 * Response interface for errors
 */
export interface ErrorResponse {
  error: string;
  status: 'failed';
}

/**
 * Upload a file to the backend for AI summarization
 * 
 * @param file - The PDF or TXT file to summarize
 * @returns Promise with summary text or throws error
 * 
 * @example
 * try {
 *   const summary = await summarizeFile(file);
 *   console.log(summary);
 * } catch (error) {
 *   console.error(error.message);
 * }
 */
export async function summarizeFile(file: File): Promise<string> {
  // Validate file before sending
  if (!file) {
    throw new Error('No file selected');
  }

  // Check file type (MIME type or file extension)
  const isPdf = file.type === 'application/pdf' || file.type === 'application/x-pdf' || file.name.toLowerCase().endsWith('.pdf');
  const isTxt = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');

  if (!isPdf && !isTxt) {
    throw new Error('Invalid file type. Only PDF (.pdf) and TXT (.txt) files are supported.');
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    throw new Error('File size exceeds 10MB limit');
  }

  if (file.size === 0) {
    throw new Error('File is empty');
  }

  // Create FormData and append file
  const formData = new FormData();
  formData.append('file', file);

  try {
    // Send POST request to Django backend
    const response = await fetch(`${API_BASE_URL}/summarize/`, {
      method: 'POST',
      body: formData,
      // Note: Do NOT set Content-Type header
      // Browser automatically sets it with boundary for multipart/form-data
    });

    // Parse JSON response
    const data = await response.json() as SummaryResponse | ErrorResponse;

    // Handle error responses from API
    if (!response.ok || data.status === 'failed') {
      const errorData = data as ErrorResponse;
      throw new Error(errorData.error || 'Failed to summarize document');
    }

    // Return summary text on success
    const successData = data as SummaryResponse;
    return successData.summary;

  } catch (error) {
    // Handle network errors or JSON parsing errors
    if (error instanceof Error) {
      // Re-throw known errors
      throw error;
    }
    
    // Handle unknown errors
    throw new Error('Network error. Please check if the backend server is running.');
  }
}

/**
 * Check if the backend API is reachable
 * 
 * @returns Promise<boolean> - true if API is accessible
 */
export async function checkAPIHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/summarize/`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}
