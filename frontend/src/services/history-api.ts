/**
 * API Service for saved history (transcripts, summaries, document chats).
 * Entries belong to this browser's anonymous client ID (see config.ts).
 */
import { apiFetch, parseJsonResponse } from "./config";
import type { ChapterFlag } from "./transcription-api";

export type HistoryKind = "document" | "chat" | "audio" | "video" | "youtube" | "live";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface HistoryEntry {
  id: number;
  kind: HistoryKind;
  title: string;
  transcript: string;
  summary: string;
  chapters: ChapterFlag[];
  messages: ChatMessage[];
  source_url: string;
  created_at: string;
  updated_at: string;
}

export interface HistoryListItem {
  id: number;
  kind: HistoryKind;
  title: string;
  preview: string;
  source_url: string;
  created_at: string;
  updated_at: string;
}

export type NewHistoryEntry = Pick<HistoryEntry, "kind" | "title"> &
  Partial<Pick<HistoryEntry, "transcript" | "summary" | "chapters" | "messages" | "source_url">>;

export const HISTORY_KIND_LABELS: Record<HistoryKind, string> = {
  document: "DOCUMENT SUMMARY",
  chat: "DOCUMENT CHAT",
  audio: "AUDIO FILE",
  video: "VIDEO FILE",
  youtube: "YOUTUBE",
  live: "LIVE RECORDING",
};

export async function listHistory(): Promise<HistoryListItem[]> {
  const response = await apiFetch("/history/");
  const data = await parseJsonResponse<{ entries: HistoryListItem[] }>(response, "Failed to load history");
  return data.entries;
}

export async function getHistory(id: number): Promise<HistoryEntry> {
  const response = await apiFetch(`/history/${id}/`);
  const data = await parseJsonResponse<{ entry: HistoryEntry }>(response, "Failed to load history entry");
  return data.entry;
}

export async function updateHistory(id: number, changes: Partial<NewHistoryEntry>): Promise<HistoryEntry> {
  const response = await apiFetch(`/history/${id}/`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  const data = await parseJsonResponse<{ entry: HistoryEntry }>(response, "Failed to update history entry");
  return data.entry;
}

export async function deleteHistory(id: number): Promise<void> {
  const response = await apiFetch(`/history/${id}/`, { method: "DELETE" });
  if (!response.ok) {
    await parseJsonResponse(response, "Failed to delete history entry");
  }
}

/**
 * Save a result to history. Never throws: saving is a background convenience,
 * so a failure is logged and the caller's flow continues. Returns the new ID or null.
 */
export async function saveHistory(entry: NewHistoryEntry): Promise<number | null> {
  try {
    const response = await apiFetch("/history/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, title: entry.title.slice(0, 255) }),
    });
    const data = await parseJsonResponse<{ entry: HistoryEntry }>(response, "Failed to save history");
    return data.entry.id;
  } catch (err) {
    console.warn("History save skipped:", err);
    return null;
  }
}
