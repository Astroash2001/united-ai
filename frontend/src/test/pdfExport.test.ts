import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildTranscriptPdf, splitScriptRuns } from "@/utils/pdfExport";

const fontsDir = resolve(__dirname, "../../public/fonts");

function mockFontFetch() {
  const fetchMock = vi.fn(async (url: string) => {
    const bytes = readFileSync(resolve(fontsDir, url.split("/").pop()!));
    return new Response(bytes);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("splitScriptRuns", () => {
  it("separates Hindi and non-Hindi runs", () => {
    expect(splitScriptRuns("[00:05] ठीक है, Monday")).toEqual([
      { text: "[00:05] ", hindi: false },
      { text: "ठीक", hindi: true },
      { text: " ", hindi: false },
      { text: "है", hindi: true },
      { text: ", Monday", hindi: false },
    ]);
  });
});

describe("buildTranscriptPdf", () => {
  it("embeds the Hindi font only when the text has Devanagari", async () => {
    const fetchMock = mockFontFetch();
    const bytes = await buildTranscriptPdf({ transcript: "[00:00] English only 🚩", summary: "## 📌 Summary\n**Done**" });
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("builds a multi-page PDF with Hindi text", async () => {
    const fetchMock = mockFontFetch();
    const line = "[00:05] ठीक है, Monday final है। मुझे लगता है कि budget थोड़ा कम है। क्षत्रिय श्रृंखला द्वितीय";
    const transcript = Array.from({ length: 80 }, () => line).join("\n");
    const bytes = await buildTranscriptPdf({
      title: "Hindi test",
      transcript,
      summary: "## 🚩 Chapters\n- [00:00] **शुरुआत** Intro\n\nकुल बजट 40 लाख है।",
      timestamp: "22/09/2026",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bytes.length).toBeGreaterThan(10_000);
    // Written for manual visual inspection when PDF_TEST_OUT is set.
    if (process.env.PDF_TEST_OUT) writeFileSync(process.env.PDF_TEST_OUT, bytes);
  });
});
