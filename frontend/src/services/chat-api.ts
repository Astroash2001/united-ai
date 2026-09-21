import { apiFetch, parseJsonResponse, readTextStream } from "./config";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ExtractTextResponse {
  text: string;
  filename: string;
  status: string;
}

export interface ChatResponse {
  answer: string;
  status: string;
}

export interface ChatOptions {
  /** Earlier messages, so follow-up questions keep their context. */
  history?: ChatMessage[];
  /** Add live web search results (Tavily) to the answer. */
  webSearch?: boolean;
  /** Receives the answer text so far while it streams in. */
  onDelta?: (textSoFar: string) => void;
}

export async function extractText(file: File): Promise<ExtractTextResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await apiFetch("/extract-text/", {
    method: "POST",
    body: formData,
  });

  return parseJsonResponse<ExtractTextResponse>(response, "Failed to extract text from document");
}

/** Read a web page as text (server-side, via Jina Reader). */
export async function extractUrl(url: string): Promise<ExtractTextResponse> {
  const response = await apiFetch("/extract-url/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  return parseJsonResponse<ExtractTextResponse>(response, "Failed to read web page");
}

/**
 * Ask a question about a document. The answer streams in as it is generated.
 * Resolves with the full answer.
 */
export async function chatWithDocument(
  question: string,
  context: string,
  { history = [], webSearch = false, onDelta = () => {} }: ChatOptions = {},
): Promise<ChatResponse> {
  const response = await apiFetch("/chat-document/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, context, history, web_search: webSearch, stream: true }),
  });

  const answer = await readTextStream(response, onDelta, "Failed to get response");
  return { answer, status: "success" };
}
