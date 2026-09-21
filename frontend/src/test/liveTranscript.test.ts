import { describe, expect, it } from "vitest";
import {
  appendPlainText,
  appendTimedWords,
  DeepgramWord,
  formatClock,
  renderTranscript,
} from "@/utils/liveTranscript";

const word = (text: string, start: number, speaker?: number): DeepgramWord => ({
  word: text.toLowerCase(),
  punctuated_word: text,
  start,
  end: start + 0.4,
  speaker,
});

describe("liveTranscript", () => {
  it("formats clock times", () => {
    expect(formatClock(75.9)).toBe("01:15");
    expect(formatClock(3723)).toBe("01:02:03");
  });

  it("groups words into one timestamped line until a pause", () => {
    let { lines, lastEnd } = appendTimedWords([], [word("Hello", 0), word("team.", 0.5)], null);
    ({ lines, lastEnd } = appendTimedWords(lines, [word("Aaj", 1.0)], lastEnd));
    expect(renderTranscript(lines)).toBe("[00:00] Hello team. Aaj");

    // A gap longer than 2 seconds starts a new line.
    ({ lines } = appendTimedWords(lines, [word("Next", 5.0)], lastEnd));
    expect(renderTranscript(lines)).toBe("[00:00] Hello team. Aaj\n[00:05] Next");
  });

  it("keeps earlier lines unchanged when a new language starts", () => {
    const english = appendTimedWords([], [word("Budget", 0), word("is", 0.4), word("final.", 0.8)], null);
    const hindi = appendTimedWords(english.lines, [word("ठीक", 1.2), word("है", 1.5)], english.lastEnd);
    expect(renderTranscript(hindi.lines)).toBe("[00:00] Budget is final. ठीक है");
    expect(renderTranscript(english.lines)).toBe("[00:00] Budget is final.");
  });

  it("labels speakers only once a second speaker is heard", () => {
    const one = appendTimedWords([], [word("Hi", 0, 0)], null);
    expect(renderTranscript(one.lines)).toBe("[00:00] Hi");

    const two = appendTimedWords(one.lines, [word("Hello", 1, 1)], one.lastEnd);
    expect(renderTranscript(two.lines)).toBe("[00:00] [Speaker 1] Hi\n[00:01] [Speaker 2] Hello");
  });

  it("appends interim words to the last line", () => {
    const { lines } = appendTimedWords([], [word("Hello", 0)], null);
    expect(renderTranscript(lines, "wor")).toBe("[00:00] Hello wor");
    expect(renderTranscript([], "wor")).toBe("wor");
  });

  it("adds untimed browser phrases as plain lines", () => {
    let lines = appendPlainText([], "hello there");
    lines = appendPlainText(lines, "general");
    expect(renderTranscript(lines)).toBe("hello there general");
  });
});
