/**
 * AI Brain API Service for AI Summarizer Pro.
 * Provides autonomous Q&A and navigation intelligence using gpt-4o-mini (least token consumption).
 */

const LOCAL_STORAGE_KEY = "OPENAI_API_KEY";

const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = isLocalhost 
  ? (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api')
  : (import.meta.env.VITE_API_URL || 'https://ai-summarizer-pro-omy1.onrender.com/api');

export interface AIBrainResponse {
  answer: string;
  target_route?: string | null;
  action_description?: string | null;
  status: "success" | "failed";
  error?: string;
  tokens_used?: number;
}

export function getStoredApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LOCAL_STORAGE_KEY) || import.meta.env.VITE_OPENAI_API_KEY || "";
}

export function buildSystemPrompt(currentRoute: string = "/"): string {
  return `You are the autonomous AI Brain & Navigation Intelligence for "AI Summarizer Pro" (also known as UNITED_AI.TXT).
Your job is to answer questions strictly related to AI Summarizer Pro, its features, capabilities, documentation, and architecture.

CURRENT USER LOCATION / PAGE: "${currentRoute}"

PROJECT PAGES & CAPABILITIES:
1. Document Chat & Summarization: Route "/chat-with-document" or "/". Supports PDF, TXT, and Image (PNG, JPG, WEBP) files with OCR. Interactive Q&A and text extraction.
2. Audio Transcription: Route "/audio". Upload MP3, WAV, M4A, OGG up to 25MB. Full transcription, summaries, timestamped chapters, retro audio player.
3. Video Summarization: Route "/video". YouTube links or MP4/WEBM uploads up to 50MB. Chapter markers, timestamped segments, transcript summaries.
4. About / Home Page: Route "/". Main landing page, feature breakdown, system specs.

NAVIGATION RULES:
1. DO NOT REROUTE IF USER IS ASKING A QUESTION: If the user asks "what is this page about?", "explain this tool", or asks questions about the current page ("${currentRoute}"), explain the current page clearly and set "target_route" to null.
2. ONLY REROUTE ON EXPLICIT SWITCH / USE REQUESTS: Only set "target_route" to a route if the user explicitly requests to go to, open, switch to, or use a capability on a DIFFERENT page than "${currentRoute}". If the target route is the same as "${currentRoute}", set "target_route" to null.

STRICT RULES:
1. SCOPE: ONLY answer questions related to AI Summarizer Pro. If a question is NOT related to AI Summarizer Pro, respond with: "I am the AI Summarizer Pro Autonomous Brain. I can only assist with questions, features, and navigation specifically related to AI Summarizer Pro."
2. TOKEN EFFICIENCY: Keep answers concise, direct, and under 90 words to use the absolute minimum tokens possible.

OUTPUT FORMAT:
Return JSON only:
{
  "answer": "string response",
  "target_route": "string or null",
  "action_description": "string or null"
}`;
}

/**
 * Sends a query to the AI Brain with current page context.
 */
export async function queryAIBrain(
  question: string,
  currentRoute: string = "/"
): Promise<AIBrainResponse> {
  const apiKey = getStoredApiKey().trim();

  if (!apiKey) {
    // If no key locally, attempt backend request with current_route
    try {
      const response = await fetch(`${API_BASE_URL}/brain/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, current_route: currentRoute }),
      });
      const data = await response.json();
      if (!response.ok || data.status === "failed") {
        return {
          answer: "",
          status: "failed",
          error: data.error || "Failed to reach AI Brain.",
        };
      }
      return {
        answer: data.answer,
        target_route: data.target_route,
        action_description: data.action_description,
        status: "success",
        tokens_used: data.tokens_used,
      };
    } catch {
      return {
        answer: "",
        status: "failed",
        error: "NO_API_KEY",
      };
    }
  }

  // Direct OpenAI API request with gpt-4o-mini for minimum latency & tokens
  try {
    const systemPrompt = buildSystemPrompt(currentRoute);
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Cheapest & lightest OpenAI model
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        max_tokens: 220,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData?.error?.message || `OpenAI API Error (${response.status})`;
      return {
        answer: "",
        status: "failed",
        error: msg,
      };
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(rawText);

    let targetRoute = parsed.target_route || null;
    // Guard against rerouting to the page user is already on
    if (targetRoute && targetRoute.replace(/\/$/, '') === currentRoute.replace(/\/$/, '')) {
      targetRoute = null;
    }

    return {
      answer: parsed.answer || "No response provided.",
      target_route: targetRoute,
      action_description: targetRoute ? (parsed.action_description || null) : null,
      status: "success",
      tokens_used: data.usage?.total_tokens,
    };
  } catch (err) {
    return {
      answer: "",
      status: "failed",
      error: err instanceof Error ? err.message : "Failed to reach OpenAI API",
    };
  }
}
