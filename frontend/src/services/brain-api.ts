/**
 * AI Brain API Service for AI Summarizer Pro.
 * Provides autonomous Q&A and navigation intelligence via the backend LLM gateway.
 */

import { apiFetch } from "./config";

export interface AIBrainResponse {
  answer: string;
  target_route?: string | null;
  action_description?: string | null;
  status: "success" | "failed";
  error?: string;
  tokens_used?: number;
  model_used?: string;
}

/**
 * Sends a query to the AI Brain with current page context.
 */
export async function queryAIBrain(
  question: string,
  currentRoute: string = "/"
): Promise<AIBrainResponse> {
  try {
    const response = await apiFetch(`/brain/`, {
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
      model_used: data.model_used,
    };
  } catch {
    return {
      answer: "",
      status: "failed",
      error: "Failed to reach AI Brain.",
    };
  }
}
