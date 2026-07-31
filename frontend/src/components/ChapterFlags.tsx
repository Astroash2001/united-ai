import { Flag, PlayCircle, Clock } from "lucide-react";

export interface ChapterItem {
  timestamp: string; // e.g. "01:15"
  title: string;
  seconds: number;
}

interface ChapterFlagsProps {
  summaryText: string;
  onSeek?: (seconds: number) => void;
}

export function parseTimestampToSeconds(timestamp: string): number {
  const cleanTs = timestamp.replace(/[[\]]/g, '').trim();
  const parts = cleanTs.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

export function extractChaptersFromMarkdown(markdownText: string): ChapterItem[] {
  const chapters: ChapterItem[] = [];
  const regex = /(?:-\s*)?\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*[-:]?\s*([^\n\r]+)/g;
  let match;

  while ((match = regex.exec(markdownText)) !== null) {
    const tsStr = match[1];
    const title = match[2].trim();
    if (tsStr && title) {
      const secs = parseTimestampToSeconds(tsStr);
      if (!chapters.some((c) => c.timestamp === tsStr && c.title === title)) {
        chapters.push({ timestamp: tsStr, title, seconds: secs });
      }
    }
  }

  return chapters;
}

const ChapterFlags = ({ summaryText, onSeek }: ChapterFlagsProps) => {
  const chapters = extractChaptersFromMarkdown(summaryText || "");

  if (chapters.length === 0) return null;

  return (
    <div className="retro-panel p-4">
      <div className="flex justify-between items-center mb-3 pb-1 border-b border-[#1C1C1C]">
        <span className="text-xs font-mono font-bold uppercase tracking-wider">[ CHAPTER JUMP MARKERS ]</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {chapters.map((chapter, idx) => (
          <button
            key={idx}
            onClick={() => onSeek && onSeek(chapter.seconds)}
            className="flex items-center gap-2 p-2 border border-[#1C1C1C] bg-[#E3DFCE] hover:bg-[#1C1C1C] hover:text-[#E3DFCE] text-left transition-colors font-mono text-xs"
          >
            <span className="px-1.5 py-0.5 border border-[#1C1C1C] bg-[#1C1C1C] text-[#E3DFCE] font-bold text-[10px]">
              [{chapter.timestamp}]
            </span>
            <span className="truncate flex-1 font-vt323 text-xs">
              {chapter.title}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChapterFlags;
