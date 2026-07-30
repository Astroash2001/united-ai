import { useState, useRef, ChangeEvent } from "react";
import { Video, Upload, Loader2, RefreshCw } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChapterFlags from "@/components/ChapterFlags";
import { transcribeVideo } from "@/services/transcription-api";
import { MultilingualTranscriptRenderer } from "@/utils/multilingual";

const VideoTranscribe = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const processVideo = async (file: File) => {
    setError("");
    setTranscript("");
    setSummary("");
    setSelectedFile(file);
    setIsLoading(true);

    const objectUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(objectUrl);

    try {
      const data = await transcribeVideo(file);
      setTranscript(data.transcript);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to transcribe video file.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.blur();
    if (file) processVideo(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processVideo(file);
    }
  };

  const handleReset = () => {
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
    setSelectedFile(null);
    setVideoPreviewUrl(null);
    setTranscript("");
    setSummary("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSeekToTimestamp = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
      videoRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="retro-frame p-3 sm:p-4 min-h-[90vh]">
      <Header />

      <main className="py-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="retro-panel p-3 text-center">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#555555]">
              [ VIDEO MEDIA ENGINE // TRANSCRIPTION & CHAPTER FLAGS ]
            </div>
            <p className="text-xs font-vt323 mt-1">
              *Upload MP4, AVI, MOV, or MKV files to convert speech into structured text and timestamped chapters.
            </p>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`retro-panel p-6 text-center transition-all ${
              isDragging ? "bg-[#0000FF] text-white border-white scale-[1.01]" : ""
            }`}
          >
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className={`border p-3 font-mono text-xs ${isDragging ? "border-white bg-[#0000FF]" : "border-[#1C1C1C] bg-[#D4D0BD]"}`}>
                <pre className="text-[10px] leading-tight font-bold">
{`+------------------------------+
| ${isDragging ? " [ DROP VIDEO HERE TO PROCESS ] " : " [ UPLOAD VIDEO FILE ]          "} |
|   MP4, MOV, AVI, MKV (50MB)  |
+------------------------------+`}
                </pre>
              </div>

              {selectedFile && (
                <div className="border border-[#1C1C1C] bg-[#1C1C1C] text-[#E3DFCE] p-2 text-xs font-mono">
                  FILE: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </div>
              )}

              {videoPreviewUrl && (
                <div className="w-full max-w-lg bg-[#DFDBCB] p-2 border border-[#1C1C1C]">
                  <video ref={videoRef} controls src={videoPreviewUrl} className="w-full h-auto max-h-60 border border-[#1C1C1C]" />
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,.mp4,.avi,.mov,.mkv,.webm"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isLoading}
              />

              {transcript ? (
                <button onClick={handleReset} className="btn-retro-secondary px-6 py-2.5 text-xs">
                  [ PROCESS ANOTHER VIDEO FILE ]
                </button>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="btn-retro-primary px-8 py-3 text-xs"
                >
                  {isLoading ? "[ PARSING VIDEO MEDIA... ]" : "[ SELECT VIDEO FILE ]"}
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="border border-[#1C1C1C] bg-[#FF2200] text-white p-3 text-xs font-mono">
              *ERROR: {error}
            </div>
          )}

          {transcript && (
            <div className="space-y-4">
              {summary && (
                <div className="retro-panel p-4">
                  <div className="flex justify-between items-center mb-2 pb-1 border-b border-[#1C1C1C]">
                    <span className="text-xs font-mono font-bold">SUMMARY.TXT:</span>
                    <button onClick={() => copyToClipboard(summary, "summary")} className="btn-retro-secondary px-2 py-0.5 text-[10px]">
                      {copiedType === "summary" ? "[COPIED]" : "[COPY]"}
                    </button>
                  </div>
                  <div className="border border-[#1C1C1C] bg-[#FFFFFF] p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap">
                    {summary}
                  </div>
                </div>
              )}

              <ChapterFlags summaryText={summary} onSeek={handleSeekToTimestamp} />

              <div className="retro-panel p-4">
                <div className="flex justify-between items-center mb-2 pb-1 border-b border-[#1C1C1C]">
                  <span className="text-xs font-mono font-bold">VIDEO_TRANSCRIPT.TXT:</span>
                  <button onClick={() => copyToClipboard(transcript, "transcript")} className="btn-retro-secondary px-2 py-0.5 text-[10px]">
                    {copiedType === "transcript" ? "[COPIED]" : "[COPY]"}
                  </button>
                </div>
                <div className="border border-[#1C1C1C] bg-[#000000] text-[#00FF00] p-3 text-xs font-mono leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap">
                  <MultilingualTranscriptRenderer text={transcript} />
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default VideoTranscribe;
