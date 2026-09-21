import { describe, expect, it } from "vitest";
import { hasTimestamps, parseTimedLines, toMarkdown, toSrt, toVtt } from "@/utils/transcriptExport";

const transcript = "[00:00] Hello team.\n[00:05] [Speaker 2] ठीक है,\ncontinued line\n[01:02:03] Wrap up.";

describe("transcriptExport", () => {
  it("parses timed lines and joins untimed continuations", () => {
    expect(parseTimedLines(transcript)).toEqual([
      { start: 0, end: 5, text: "Hello team." },
      { start: 5, end: 3723, text: "[Speaker 2] ठीक है, continued line" },
      { start: 3723, end: 3727, text: "Wrap up." },
    ]);
  });

  it("detects whether subtitles are possible", () => {
    expect(hasTimestamps(transcript)).toBe(true);
    expect(hasTimestamps("no times here")).toBe(false);
  });

  it("writes SRT cues", () => {
    expect(toSrt("[00:00] Hi\n[00:02] Bye")).toBe(
      "1\n00:00:00,000 --> 00:00:02,000\nHi\n\n2\n00:00:02,000 --> 00:00:06,000\nBye\n",
    );
  });

  it("writes VTT cues with a header", () => {
    expect(toVtt("[00:01] Hi")).toBe("WEBVTT\n\n00:00:01.000 --> 00:00:05.000\nHi\n");
  });

  it("writes Markdown with summary and transcript sections", () => {
    const markdown = toMarkdown({ title: "Meeting", transcript: "[00:00] Hi", summary: "Short." });
    expect(markdown).toContain("# Meeting");
    expect(markdown).toContain("## Summary\n\nShort.");
    expect(markdown).toContain("## Transcript\n\n[00:00] Hi");
  });
});
