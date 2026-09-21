import { describe, expect, it, vi } from "vitest";
import { getClientId, parseJsonResponse, readTextStream } from "@/services/config";

function streamResponse(lines: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      // Split mid-line to check that partial lines are buffered.
      const text = lines.join("");
      controller.enqueue(encoder.encode(text.slice(0, 7)));
      controller.enqueue(encoder.encode(text.slice(7)));
      controller.close();
    },
  });
  return new Response(body, { status });
}

describe("readTextStream", () => {
  it("joins deltas and reports progress", async () => {
    const onDelta = vi.fn();
    const text = await readTextStream(
      streamResponse(['{"delta": "Hello "}\n', '{"delta": "world"}\n', '{"done": true}\n']),
      onDelta,
      "failed",
    );
    expect(text).toBe("Hello world");
    expect(onDelta).toHaveBeenLastCalledWith("Hello world");
  });

  it("throws the streamed error", async () => {
    await expect(
      readTextStream(streamResponse(['{"delta": "Hi"}\n', '{"error": "Model failed"}\n']), () => {}, "failed"),
    ).rejects.toThrow("Model failed");
  });

  it("throws the JSON error of a failed request", async () => {
    const response = new Response(JSON.stringify({ error: "Bad file", status: "failed" }), { status: 400 });
    await expect(readTextStream(response, () => {}, "failed")).rejects.toThrow("Bad file");
  });
});

describe("parseJsonResponse", () => {
  it("explains rate limiting", async () => {
    const response = new Response(JSON.stringify({ detail: "Request was throttled." }), { status: 429 });
    await expect(parseJsonResponse(response, "failed")).rejects.toThrow("Too many requests");
  });
});

describe("getClientId", () => {
  it("returns the same UUID on every call", () => {
    const id = getClientId();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getClientId()).toBe(id);
  });
});
