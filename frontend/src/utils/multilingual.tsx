import React from "react";

export interface TextSegment {
  language: "hindi" | "english" | "neutral";
  timestamp?: string;
  text: string;
}

/**
 * Parse transcript text into structured language segments based on Unicode character detection.
 * Hindi uses Devanagari script (\u0900-\u097F).
 * English uses Latin script (a-zA-Z).
 */
export function parseLanguageSegments(fullText: string): TextSegment[] {
  if (!fullText || !fullText.trim()) return [];

  // Split by newlines, Devanagari full stop (।), or standard sentence endings (.!?)
  // Using a regex that captures the punctuation so we can keep it with the sentence.
  // We split by positive lookbehind for punctuation followed by space, or just newlines.
  const rawChunks = fullText.split(/(?<=[।.!?:;])\s+|\n+/);
  const segments: TextSegment[] = [];

  for (const rawChunk of rawChunks) {
    const chunk = rawChunk.trim();
    if (!chunk) continue;

    // Check for timestamp pattern like [00:15] or [01:23:45]
    let timestamp: string | undefined = undefined;
    let contentText = chunk;

    const tsMatch = chunk.match(/^(\[\d{2}:\d{2}(?::\d{2})?\])\s*(.*)/);
    if (tsMatch) {
      timestamp = tsMatch[1];
      contentText = tsMatch[2];
    }

    if (!contentText.trim()) {
      if (timestamp) {
        segments.push({ language: "neutral", timestamp, text: "" });
      }
      continue;
    }

    const devanagariCount = (contentText.match(/[\u0900-\u097F]/g) || []).length;
    const latinCount = (contentText.match(/[a-zA-Z]/g) || []).length;

    let language: "hindi" | "english" | "neutral" = "english";

    // Dynamic detection based strictly on script presence
    if (devanagariCount > 0 && devanagariCount >= latinCount) {
      language = "hindi";
    } else if (latinCount > 0) {
      language = "english";
    } else {
      language = "neutral";
    }

    segments.push({
      language,
      timestamp,
      text: contentText,
    });
  }

  return segments;
}

interface RenderMultilingualTranscriptProps {
  text: string;
  isRecording?: boolean;
}

export const MultilingualTranscriptRenderer: React.FC<RenderMultilingualTranscriptProps> = ({
  text,
  isRecording = false,
}) => {
  if (!text && !isRecording) return null;

  const segments = parseLanguageSegments(text);

  if (segments.length === 0 && text) {
    return <span>{text}</span>;
  }

  return (
    <div className="space-y-3 font-mono">
      {segments.map((seg, index) => (
        <div
          key={index}
          className={`flex flex-wrap sm:flex-nowrap items-start gap-3 p-3 rounded border transition-colors ${
            seg.language === "hindi"
              ? "bg-[#1A1408] border-[#FF9933]/40 hover:border-[#FF9933]"
              : seg.language === "english"
              ? "bg-[#081820] border-[#00BFFF]/40 hover:border-[#00BFFF]"
              : "bg-black/40 border-white/10"
          }`}
        >
          {/* Timestamp Badge if present */}
          {seg.timestamp && (
            <span className="bg-[#1C1C1C] text-emerald-400 text-xs px-2 py-0.5 rounded font-mono shrink-0 border border-emerald-500/30">
              {seg.timestamp}
            </span>
          )}

          {/* Language Indicator Badge */}
          {seg.language === "hindi" ? (
            <span className="bg-[#FF9933] text-black font-extrabold text-xs px-2.5 py-1 rounded border border-[#1C1C1C] shrink-0 font-mono tracking-wider shadow-sm flex items-center gap-1">
              <span>🇮🇳</span> [ HINDI ]
            </span>
          ) : seg.language === "english" ? (
            <span className="bg-[#00BFFF] text-black font-extrabold text-xs px-2.5 py-1 rounded border border-[#1C1C1C] shrink-0 font-mono tracking-wider shadow-sm flex items-center gap-1">
              <span>🇬🇧</span> [ ENGLISH ]
            </span>
          ) : (
            <span className="bg-[#A0A0A0] text-black font-extrabold text-xs px-2.5 py-1 rounded border border-[#1C1C1C] shrink-0 font-mono shrink-0">
              [ TRANSCRIPT ]
            </span>
          )}

          {/* Text Content */}
          <span
            className={`flex-1 leading-relaxed text-sm sm:text-base ${
              seg.language === "hindi"
                ? "text-amber-300 font-semibold tracking-wide"
                : "text-[#00FF00] font-medium tracking-wide"
            }`}
          >
            {seg.text}
          </span>
        </div>
      ))}
      {isRecording && <span className="animate-pulse text-[#00FF00] font-bold"> █</span>}
    </div>
  );
};
