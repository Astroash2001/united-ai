import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { MultilingualTranscriptRenderer } from "@/utils/multilingual";
import { exportTranscriptToPDF } from "@/utils/pdfExport";
import {
  downloadFile,
  hasTimestamps,
  toDocx,
  toMarkdown,
  toSrt,
  toVtt,
} from "@/utils/transcriptExport";
import { transformTranscript, TranscriptView } from "@/services/transcription-api";

type ViewMode = "original" | TranscriptView;

const VIEW_LABELS: Record<ViewMode, string> = {
  original: "ORIGINAL",
  latin: "HINGLISH (A-Z)",
  english: "ENGLISH",
};

const HAS_DEVANAGARI = /[ऀ-ॿ]/;

interface TranscriptPanelProps {
  /** Panel heading, e.g. "VIDEO_TRANSCRIPT.TXT:" */
  label: string;
  /** Title used inside exported files. */
  exportTitle: string;
  /** Base file name for downloads (no extension). */
  fileBaseName: string;
  transcript: string;
  summary?: string;
  onSeek?: (seconds: number) => void;
}

/**
 * Transcript viewer with language view toggle (original / Hinglish / English),
 * copy, and exports (PDF, DOCX, Markdown, TXT, SRT, VTT).
 */
const TranscriptPanel = ({ label, exportTitle, fileBaseName, transcript, summary, onSeek }: TranscriptPanelProps) => {
  const [view, setView] = useState<ViewMode>("original");
  const [converted, setConverted] = useState<Partial<Record<TranscriptView, string>>>({});
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [showExports, setShowExports] = useState(false);

  // A new transcript invalidates cached conversions.
  useEffect(() => {
    setView("original");
    setConverted({});
    setError("");
  }, [transcript]);

  const shownText = view === "original" ? transcript : converted[view] ?? transcript;
  const canSubtitle = hasTimestamps(shownText);
  const hasHindi = HAS_DEVANAGARI.test(transcript);

  const selectView = async (next: ViewMode) => {
    setError("");
    if (next === "original" || converted[next]) {
      setView(next);
      return;
    }
    setIsConverting(true);
    try {
      const text = await transformTranscript(transcript, next);
      setConverted((prev) => ({ ...prev, [next]: text }));
      setView(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to convert transcript");
    } finally {
      setIsConverting(false);
    }
  };

  const copyText = () => {
    navigator.clipboard.writeText(shownText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportAs = async (format: "pdf" | "docx" | "md" | "txt" | "srt" | "vtt") => {
    setShowExports(false);
    const data = { title: exportTitle, transcript: shownText, summary: summary || undefined };
    const suffix = view === "original" ? "" : `_${view}`;
    const name = `${fileBaseName}${suffix}`;
    switch (format) {
      case "pdf":
        exportTranscriptToPDF({ ...data, timestamp: new Date().toLocaleString() });
        break;
      case "docx":
        downloadFile(await toDocx(data), `${name}.docx`);
        break;
      case "md":
        downloadFile(toMarkdown(data), `${name}.md`, "text/markdown;charset=utf-8");
        break;
      case "txt":
        downloadFile(shownText, `${name}.txt`);
        break;
      case "srt":
        downloadFile(toSrt(shownText), `${name}.srt`);
        break;
      case "vtt":
        downloadFile(toVtt(shownText), `${name}.vtt`, "text/vtt;charset=utf-8");
        break;
    }
  };

  const exportOptions: { format: Parameters<typeof exportAs>[0]; label: string; enabled: boolean }[] = [
    // jsPDF's built-in fonts cannot draw Devanagari, so PDF is offered only for Latin text.
    { format: "pdf", label: "PDF", enabled: !HAS_DEVANAGARI.test(shownText) },
    { format: "docx", label: "WORD (.DOCX)", enabled: true },
    { format: "md", label: "MARKDOWN", enabled: true },
    { format: "txt", label: "PLAIN TEXT", enabled: true },
    { format: "srt", label: "SUBTITLES (.SRT)", enabled: canSubtitle },
    { format: "vtt", label: "SUBTITLES (.VTT)", enabled: canSubtitle },
  ];

  return (
    <div className="retro-panel p-4">
      <div className="flex flex-wrap justify-between items-center gap-2 mb-2 pb-2 border-b border-[#1C1C1C]">
        <span className="text-xs font-mono font-bold">{label}</span>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
          {hasHindi && (
            <div className="flex border border-[#1C1C1C]">
              {(Object.keys(VIEW_LABELS) as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => selectView(mode)}
                  disabled={isConverting}
                  className={`px-2 py-0.5 font-bold ${view === mode ? "bg-[#1C1C1C] text-[#E3DFCE]" : "bg-[#E3DFCE] text-[#1C1C1C] hover:bg-[#1C1C1C]/10"}`}
                >
                  {VIEW_LABELS[mode]}
                </button>
              ))}
            </div>
          )}
          <button onClick={copyText} className="btn-retro-secondary px-2 py-0.5 text-[10px]">
            {copied ? "[COPIED]" : "[COPY]"}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowExports((open) => !open)}
              className="btn-retro-primary px-2 py-0.5 text-[10px] flex items-center gap-1"
              aria-expanded={showExports}
            >
              <Download className="w-3 h-3" />
              <span>[ EXPORT ▾ ]</span>
            </button>
            {showExports && (
              <div className="absolute right-0 z-20 mt-1 w-44 border border-[#1C1C1C] bg-[#E3DFCE] shadow-[3px_3px_0px_#1C1C1C]">
                {exportOptions.map((option) => (
                  <button
                    key={option.format}
                    onClick={() => exportAs(option.format)}
                    disabled={!option.enabled}
                    className="block w-full text-left px-3 py-1.5 font-bold hover:bg-[#1C1C1C] hover:text-[#E3DFCE] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#1C1C1C]"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-[#1C1C1C] bg-[#FF2200] text-white p-2 mb-2 text-xs font-mono">*ERROR: {error}</div>
      )}

      <div className="border border-[#1C1C1C] bg-[#000000] text-[#00FF00] p-3 text-xs sm:text-sm font-mono leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
        {isConverting ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>▶ Converting transcript...</span>
          </div>
        ) : (
          <MultilingualTranscriptRenderer text={shownText} onSeek={onSeek} />
        )}
      </div>
    </div>
  );
};

export default TranscriptPanel;
