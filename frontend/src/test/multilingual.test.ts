import { describe, expect, it } from "vitest";
import { parseLanguageSegments } from "@/utils/multilingual";

describe("parseLanguageSegments", () => {
  it("tags Hindi and English sentences by script", () => {
    const segments = parseLanguageSegments("Budget is final. ठीक है।");
    expect(segments.map((s) => s.language)).toEqual(["english", "hindi"]);
  });

  it("reads timestamp and speaker labels", () => {
    const [segment] = parseLanguageSegments("[00:05] [Speaker 2] Hello");
    expect(segment).toEqual({ language: "english", timestamp: "[00:05]", speaker: "Speaker 2", text: "Hello" });
  });
});
