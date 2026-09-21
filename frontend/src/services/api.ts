/**
 * API Service for interacting with the Django backend
 * Handles file uploads and summarization requests
 */

import { apiFetch, readTextStream } from './config';

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

const DOCUMENT_EXTENSIONS = ['pdf', 'txt', 'md', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff'];

/**
 * Upload a file to the backend for AI summarization.
 * The summary streams in as it is generated; onDelta receives the text so far.
 *
 * @param file - The PDF, text, or image file to summarize
 * @returns Promise with the final summary text, or throws an error
 */
export async function summarizeFile(file: File, onDelta: (textSoFar: string) => void = () => {}): Promise<string> {
  if (!file) {
    throw new Error('No file selected');
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!DOCUMENT_EXTENSIONS.includes(extension)) {
    throw new Error('Invalid file type. Only PDF, TXT, and image (PNG/JPG/WEBP) files are supported.');
  }

  // Check file size (10MB limit)
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('File size exceeds 10MB limit');
  }

  if (file.size === 0) {
    throw new Error('File is empty');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('stream', 'true');

  let response: Response;
  try {
    // Do NOT set Content-Type: the browser adds the multipart boundary itself.
    response = await apiFetch('/summarize/', { method: 'POST', body: formData });
  } catch {
    throw new Error('Network error. Please check if the backend server is running.');
  }

  const summary = await readTextStream(response, onDelta, 'Failed to summarize document');
  if (!summary.trim()) {
    throw new Error('AI returned an empty summary');
  }
  return summary;
}

/**
 * Check if the backend API is reachable
 * 
 * @returns Promise<boolean> - true if API is accessible
 */
export async function checkAPIHealth(): Promise<boolean> {
  try {
    const response = await apiFetch('/summarize/', { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}
