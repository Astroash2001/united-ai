/**
 * API Service for Audio, Video, and Live Meeting Transcription
 */

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocalhost 
  ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api')
  : (import.meta.env.VITE_API_URL || 'https://ai-summarizer-pro-omy1.onrender.com/api');

export interface ChapterFlag {
  timestamp: string;
  title: string;
  seconds: number;
}

export interface TranscriptionResponse {
  transcript: string;
  summary?: string;
  chapters?: ChapterFlag[];
  filename: string;
  status: string;
  error?: string;
}

/**
 * Upload an audio file or live recorded blob for transcription & AI summary
 */
export async function transcribeAudio(file: File | Blob, mode: string = "meeting"): Promise<TranscriptionResponse> {
  const formData = new FormData();
  
  if (file instanceof File) {
    formData.append("file", file);
  } else {
    // Ensure live recording blob is named recording.webm for OpenAI Whisper API
    formData.append("file", file, "recording.webm");
  }

  formData.append("mode", mode);

  const response = await fetch(`${API_BASE_URL}/transcribe-audio/`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok || data.status === 'failed') {
    throw new Error(data.error || "Failed to transcribe audio file");
  }

  return data;
}

/**
 * Upload a video file for transcription & AI summary
 */
export async function transcribeVideo(file: File, mode: string = "meeting"): Promise<TranscriptionResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("mode", mode);

  const response = await fetch(`${API_BASE_URL}/transcribe-video/`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok || data.status === 'failed') {
    throw new Error(data.error || "Failed to transcribe video file");
  }

  return data;
}

/**
 * Summarize raw transcript text directly (useful for live speech where text already exists)
 */
export async function summarizeTranscript(transcript: string, mode: string = "meeting"): Promise<{ corrected_transcript?: string; summary: string }> {
  const response = await fetch(`${API_BASE_URL}/summarize-transcript/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript, mode }),
  });

  const data = await response.json();

  if (!response.ok || data.status === 'failed') {
    throw new Error(data.error || "Failed to summarize transcript text");
  }

  return data;
}
