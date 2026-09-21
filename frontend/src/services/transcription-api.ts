/**
 * API Service for Audio, Video, and Live Meeting Transcription
 */

import { apiFetch, parseJsonResponse } from "./config";

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

export interface TranscribeOptions {
  mode?: string;
  /** false skips the AI summary and chapters (faster, cheaper). */
  summarize?: boolean;
}

/** Largest audio/video upload the backend accepts (video and large audio are compressed before transcription). */
export const MAX_MEDIA_UPLOAD_MB = 200;

async function transcribeUpload(path: string, file: File | Blob, options: TranscribeOptions, fallbackError: string) {
  const formData = new FormData();
  if (file instanceof File) {
    formData.append("file", file);
  } else {
    // Name the live recording blob so the server keeps its .webm extension
    formData.append("file", file, "recording.webm");
  }
  formData.append("mode", options.mode ?? "meeting");
  formData.append("summarize", String(options.summarize ?? true));

  const response = await apiFetch(path, { method: "POST", body: formData });
  return parseJsonResponse<TranscriptionResponse>(response, fallbackError);
}

/**
 * Upload an audio file or live recorded blob for transcription & AI summary
 */
export function transcribeAudio(file: File | Blob, options: TranscribeOptions = {}): Promise<TranscriptionResponse> {
  return transcribeUpload("/transcribe-audio/", file, options, "Failed to transcribe audio file");
}

/**
 * Upload a video file for transcription & AI summary
 */
export function transcribeVideo(file: File, options: TranscribeOptions = {}): Promise<TranscriptionResponse> {
  return transcribeUpload("/transcribe-video/", file, options, "Failed to transcribe video file");
}

/**
 * Transcribe a YouTube video by link (the server downloads its audio)
 */
export async function transcribeYouTube(url: string, mode: string = "meeting"): Promise<TranscriptionResponse> {
  const response = await apiFetch("/transcribe-youtube/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, mode }),
  });
  return parseJsonResponse<TranscriptionResponse>(response, "Failed to transcribe YouTube video");
}

/** Extract the video ID from a YouTube link, or null when it is not one. */
export function getYouTubeVideoId(url: string): string | null {
  const match = url.trim().match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
}

/**
 * Fetch a short-lived Deepgram access token for live browser streaming
 */
export async function getDeepgramToken(): Promise<string> {
  const response = await apiFetch("/deepgram-token/", { method: "POST" });
  const data = await parseJsonResponse<{ access_token?: string }>(response, "Failed to get Deepgram token");
  if (!data.access_token) {
    throw new Error("Failed to get Deepgram token");
  }
  return data.access_token;
}

/**
 * Summarize raw transcript text directly (useful for live speech where text already exists)
 */
export async function summarizeTranscript(transcript: string, mode: string = "meeting"): Promise<{ corrected_transcript?: string; summary: string }> {
  const response = await apiFetch("/summarize-transcript/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript, mode }),
  });

  return parseJsonResponse<{ corrected_transcript?: string; summary: string }>(response, "Failed to summarize transcript text");
}

export type TranscriptView = "latin" | "english";

/**
 * Convert a transcript for display: Hindi in Latin letters ("latin") or translated ("english").
 * Timestamps, speaker labels, and line breaks are kept.
 */
export async function transformTranscript(text: string, target: TranscriptView): Promise<string> {
  const response = await apiFetch("/transform-transcript/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, target }),
  });
  const data = await parseJsonResponse<{ text: string }>(response, "Failed to convert transcript");
  return data.text;
}
