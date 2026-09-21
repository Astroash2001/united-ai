import { apiFetch, parseJsonResponse, readTextStream } from "./config";

export interface ExtractTextResponse {
  text: string;
  filename: string;
  status: string;
}

export interface ChatRequest {
  question: string;
  context: string;
}

export interface ChatResponse {
  answer: string;
  status: string;
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

/**
 * Ask a question about a document. The answer streams in as it is generated;
 * onDelta receives the text so far. Resolves with the full answer.
 */
export async function chatWithDocument(
  question: string,
  context: string,
  onDelta: (textSoFar: string) => void = () => {},
): Promise<ChatResponse> {
  const response = await apiFetch("/chat-document/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, context, stream: true }),
  });

  const answer = await readTextStream(response, onDelta, "Failed to get response");
  return { answer, status: "success" };
}
