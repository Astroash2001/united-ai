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

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocalhost 
  ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api')
  : (import.meta.env.VITE_API_URL || 'https://ai-summarizer-pro-omy1.onrender.com/api');

export async function extractText(file: File): Promise<ExtractTextResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/extract-text/`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to extract text from document");
  }

  return data;
}

export async function chatWithDocument(
  question: string,
  context: string,
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat-document/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question, context }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to get response");
  }

  return data;
}
