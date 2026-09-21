/**
 * Shared backend connection settings and fetch helpers for all API services.
 */

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
export const API_BASE_URL = isLocalhost
  ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api')
  : (import.meta.env.VITE_API_URL || 'https://ai-summarizer-pro-omy1.onrender.com/api');

/** fetch() against the backend API. */
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, init);
}

/** Parse a JSON response and throw its `error` message when the request failed. */
export async function parseJsonResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.status === 'failed') {
    if (response.status === 429) {
      throw new Error("Too many requests. Please wait a while and try again.");
    }
    throw new Error(data.error || fallbackError);
  }
  return data as T;
}

/**
 * Read a newline-delimited JSON stream from the backend.
 * Calls onDelta with the full text so far after each piece; returns the final text.
 */
export async function readTextStream(
  response: Response,
  onDelta: (fullText: string) => void,
  fallbackError: string,
): Promise<string> {
  if (!response.ok || !response.body) {
    await parseJsonResponse(response, fallbackError);
    throw new Error(fallbackError);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;

      const message = JSON.parse(line);
      if (message.error) throw new Error(message.error);
      if (message.delta) {
        fullText += message.delta;
        onDelta(fullText);
      }
    }
  }

  return fullText;
}
