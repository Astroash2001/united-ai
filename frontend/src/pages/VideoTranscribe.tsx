import { useState, useRef, ChangeEvent, FormEvent } from "react";
import { Link2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChapterFlags from "@/components/ChapterFlags";
import TranscriptPanel from "@/components/TranscriptPanel";
import {
  ChapterFlag,
  getYouTubeVideoId,
  MAX_MEDIA_UPLOAD_MB,
  TranscriptionResponse,
  transcribeVideo,
  transcribeYouTube,
} from "@/services/transcription-api";
import { saveHistory } from "@/services/history-api";

type Source = "file" | "youtube";

const VideoTranscribe = () => {
  const [source, setSource] = useState<Source>("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [youtubeStart, setYoutubeStart] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [chapters, setChapters] = useState<ChapterFlag[]>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string>("");
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const showResult = (data: TranscriptionResponse, resultTitle: string) => {
    setTranscript(data.transcript);
    setSummary(data.summary || "");
    setChapters(data.chapters || []);
    setTitle(resultTitle);
  };

  const clearResult = () => {
    setError("");
    setTranscript("");
    setSummary("");
    setChapters([]);
  };

  const processVideo = async (file: File) => {
    clearResult();

    if (file.size > MAX_MEDIA_UPLOAD_MB * 1024 * 1024) {
      setError(`SYSTEM REJECTED: Video file exceeds the maximum allowed size of ${MAX_MEDIA_UPLOAD_MB}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setIsLoading(true);

    const objectUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(objectUrl);

    try {
      const data = await transcribeVideo(file);
      showResult(data, file.name);
      saveHistory({
        kind: "video",
        title: file.name,
        transcript: data.transcript,
        summary: data.summary || "",
        chapters: data.chapters || [],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to transcribe video file.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const processYouTube = async (event: FormEvent) => {
    event.preventDefault();
    clearResult();

    const videoId = getYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      setError("Please paste a valid YouTube video link.");
      return;
    }

    setYoutubeId(videoId);
    setYoutubeStart(0);
    setIsLoading(true);
    try {
      const data = await transcribeYouTube(youtubeUrl.trim());
      showResult(data, data.filename || "YouTube video");
      saveHistory({
        kind: "youtube",
        title: data.filename || "YouTube video",
        transcript: data.transcript,
        summary: data.summary || "",
        chapters: data.chapters || [],
        source_url: youtubeUrl.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transcribe YouTube video.");
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
    setYoutubeUrl("");
    setYoutubeId(null);
    clearResult();
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSeekToTimestamp = (seconds: number) => {
    if (source === "youtube") {
      setYoutubeStart(seconds);
      return;
    }
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      videoRef.current.play().catch(() => {});
      videoRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const switchSource = (next: Source) => {
    if (isLoading || next === source) return;
    handleReset();
    setSource(next);
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
          <div className="retro-panel p-3 text-center border-b-[3px] border-[#1C1C1C]">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#1C1C1C]">
              [ VIDEO MEDIA ENGINE // TRANSCRIPTION & CHAPTER FLAGS ]
            </div>
            <p className="text-xs font-vt323 mt-1 text-[#555555]">
              *Upload MP4, AVI, MOV, or MKV files, or paste a YouTube link, to convert speech into structured text and timestamped chapters.
            </p>
            <div className="mt-2 inline-block border border-[#1C1C1C] bg-[#FF9933] text-[#1C1C1C] px-3 py-1 text-[10px] font-mono font-bold shadow-[2px_2px_0px_#1C1C1C]">
              [ ⚠️ SYSTEM LIMIT: VIDEO UPLOAD {MAX_MEDIA_UPLOAD_MB}MB // YOUTUBE UP TO 2 HOURS ]
            </div>
          </div>

          {/* Source Switcher */}
          <div className="flex border border-[#1C1C1C] bg-[#DFDBCB] p-1 font-mono text-xs max-w-md mx-auto">
            {(["file", "youtube"] as Source[]).map((option) => (
              <button
                key={option}
                onClick={() => switchSource(option)}
                className={`flex-1 py-2 font-bold uppercase transition-colors ${
                  source === option ? "bg-[#1C1C1C] text-[#E3DFCE]" : "bg-transparent text-[#1C1C1C] hover:bg-[#1C1C1C]/10"
                }`}
              >
                {option === "file" ? "[ 📁 VIDEO FILE ]" : "[ ▶ YOUTUBE LINK ]"}
              </button>
            ))}
          </div>

          {source === "file" ? (
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
|   MP4, MOV, AVI, MKV (${MAX_MEDIA_UPLOAD_MB}MB) |
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
          ) : (
            <div className="retro-panel p-6 space-y-4">
              <form onSubmit={processYouTube} className="flex flex-col sm:flex-row gap-2 font-mono text-xs">
                <label className="flex-1 flex items-center gap-2 border border-[#1C1C1C] bg-[#E3DFCE] px-3">
                  <Link2 className="w-4 h-4 shrink-0" />
                  <span className="sr-only">YouTube link</span>
                  <input
                    type="url"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="flex-1 bg-transparent py-2.5 outline-none min-w-0"
                    disabled={isLoading}
                  />
                </label>
                <button type="submit" disabled={isLoading || !youtubeUrl.trim()} className="btn-retro-primary px-6 py-2.5 text-xs">
                  {isLoading ? "[ DOWNLOADING & TRANSCRIBING... ]" : "[ TRANSCRIBE VIDEO ]"}
                </button>
              </form>
              <p className="text-xs font-vt323 text-[#555555]">
                *The server downloads the audio track. YouTube sometimes blocks downloads from hosted servers; if that happens, upload the video file instead.
              </p>

              {youtubeId && (
                <div className="w-full max-w-lg mx-auto bg-[#DFDBCB] p-2 border border-[#1C1C1C]">
                  <iframe
                    key={youtubeStart}
                    className="w-full aspect-video border border-[#1C1C1C]"
                    src={`https://www.youtube-nocookie.com/embed/${youtubeId}?start=${youtubeStart}${youtubeStart ? "&autoplay=1" : ""}`}
                    title="YouTube video player"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          )}

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

              <ChapterFlags summaryText={summary} chapters={chapters} onSeek={handleSeekToTimestamp} />

              <TranscriptPanel
                label="VIDEO_TRANSCRIPT.TXT:"
                exportTitle={title || "UNITED AI — VIDEO TRANSCRIPT"}
                fileBaseName="united_ai_video_transcript"
                transcript={transcript}
                summary={summary}
                onSeek={handleSeekToTimestamp}
              />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default VideoTranscribe;
