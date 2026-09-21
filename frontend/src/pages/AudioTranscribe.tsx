import React, { useState, useRef, useEffect, ChangeEvent, memo } from "react";
import { Mic, Play, Pause, Square, Upload, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChapterFlags from "@/components/ChapterFlags";
import VoiceVisualizer from "@/components/VoiceVisualizer";
import RetroAudioPlayer from "@/components/RetroAudioPlayer";
import TranscriptPanel from "@/components/TranscriptPanel";
import { MultilingualTranscriptRenderer } from "@/utils/multilingual";
import { formatClock } from "@/utils/liveTranscript";
import { useLiveTranscription, MicLanguage } from "@/hooks/useLiveTranscription";
import {
  ChapterFlag,
  MAX_MEDIA_UPLOAD_MB,
  summarizeTranscript,
  transcribeAudio,
} from "@/services/transcription-api";

const LiveTextDisplay = memo(({ text, isRecording }: { text: string; isRecording: boolean }) => (
  <MultilingualTranscriptRenderer text={text} isRecording={isRecording} />
));
LiveTextDisplay.displayName = "LiveTextDisplay";

const ENGINE_LABELS = {
  deepgram: "[ ENGINE: DEEPGRAM // HINDI + ENGLISH, SPEAKERS, TIMESTAMPS ]",
  browser: "[ ENGINE: BROWSER SPEECH // ONE LANGUAGE ONLY ]",
};

const AudioTranscribe = () => {
  const [activeTab, setActiveTab] = useState<"record" | "upload">("record");

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadTranscript, setUploadTranscript] = useState<string>("");
  const [chapters, setChapters] = useState<ChapterFlag[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Shared result state
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string>("");

  // Live Recording State
  const [micLanguage, setMicLanguage] = useState<MicLanguage>("en-IN");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const live = useLiveTranscription(micLanguage);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Revoke the upload preview URL when it changes or the page unmounts.
  useEffect(() => {
    return () => {
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, [audioPreviewUrl]);

  const startRecording = () => {
    setError("");
    setSummary("");
    live.start();
  };

  const handleSummarizeLiveAudio = async () => {
    if (!live.transcript) return;

    setError("");
    setIsSummarizing(true);
    try {
      const data = await summarizeTranscript(live.transcript);
      const correctedTranscript = data.corrected_transcript || live.transcript;
      live.replaceTranscript(correctedTranscript);
      setSummary(data.summary || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate AI summary.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const processAudioFile = async (file: File) => {
    setError("");
    setUploadTranscript("");
    setSummary("");
    setChapters([]);

    if (file.size > MAX_MEDIA_UPLOAD_MB * 1024 * 1024) {
      setError(`SYSTEM REJECTED: Audio file exceeds the maximum allowed size of ${MAX_MEDIA_UPLOAD_MB}MB.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setIsLoading(true);
    setAudioPreviewUrl(URL.createObjectURL(file));

    try {
      const data = await transcribeAudio(file);
      setUploadTranscript(data.transcript);
      setSummary(data.summary || "");
      setChapters(data.chapters || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transcribe audio file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.blur();
    if (file) processAudioFile(file);
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
      processAudioFile(file);
    }
  };

  const handleResetUpload = () => {
    setSelectedFile(null);
    setAudioPreviewUrl(null);
    setUploadTranscript("");
    setSummary("");
    setChapters([]);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSeekToTimestamp = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play().catch(() => {
        // Autoplay can be blocked; the position is still set.
      });
      audioRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const shownError = error || live.error;
  const showLiveTerminal = live.isRecording || live.isFinalizing;

  return (
    <div className="retro-frame p-3 sm:p-4 min-h-[90vh]">
      <Header />

      <main className="py-4">
        <div className="max-w-5xl mx-auto space-y-5">

          {/* Header Panel */}
          <div className="retro-panel p-4 text-center border-b-[3px] border-[#1C1C1C]">
            <div className="text-sm font-mono font-bold uppercase tracking-wider text-[#1C1C1C]">
              [ AUDIO SPEECH ENGINE // LIVE VOICE RECORD & TRANSCRIPTION ]
            </div>
            <p className="text-sm font-vt323 mt-1 text-[#333333]">
              *Speak into your microphone to view live frequency wave animation and real-time word streaming.
            </p>
            <div className="mt-3 inline-block border border-[#1C1C1C] bg-[#FF9933] text-[#1C1C1C] px-3 py-1 text-[10px] font-mono font-bold shadow-[2px_2px_0px_#1C1C1C]">
              [ ⚠️ SYSTEM LIMIT: MAXIMUM AUDIO UPLOAD IS {MAX_MEDIA_UPLOAD_MB}MB ]
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex border border-[#1C1C1C] bg-[#DFDBCB] p-1 font-mono text-sm max-w-lg mx-auto">
            <button
              onClick={() => {
                if (!live.isRecording) setActiveTab("record");
              }}
              className={`flex-1 py-2 font-bold uppercase transition-colors flex items-center justify-center gap-2 ${
                activeTab === "record"
                  ? "bg-[#1C1C1C] text-[#E3DFCE]"
                  : "bg-transparent text-[#1C1C1C] hover:bg-[#1C1C1C]/10"
              }`}
            >
              <Mic className="w-4 h-4 text-red-400" />
              <span>[ 🎙️ LIVE RECORDING ]</span>
            </button>
            <button
              onClick={() => {
                if (!live.isRecording) setActiveTab("upload");
              }}
              className={`flex-1 py-2 font-bold uppercase transition-colors flex items-center justify-center gap-2 ${
                activeTab === "upload"
                  ? "bg-[#1C1C1C] text-[#E3DFCE]"
                  : "bg-transparent text-[#1C1C1C] hover:bg-[#1C1C1C]/10"
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>[ 📁 FILE UPLOAD ]</span>
            </button>
          </div>

          {/* TAB 1: LIVE VOICE RECORDING WORKSPACE */}
          {activeTab === "record" && (
            <div className="space-y-4">
              <div className="retro-panel p-6 text-center space-y-4">
                {/* Status Counter & Live Frequency Visualizer */}
                <div className="border border-[#1C1C1C] bg-[#D4D0BD] p-4 font-mono text-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-[#1C1C1C] pb-2">
                    <span className="font-bold">MICROPHONE STREAM STATUS:</span>
                    <span className="font-bold text-base bg-[#1C1C1C] text-[#E3DFCE] px-3 py-1">
                      {formatClock(live.recordingTime)}
                    </span>
                  </div>

                  {/* VOICE FREQUENCY AUDIO VISUALIZER */}
                  <VoiceVisualizer
                    stream={live.mediaStream}
                    isRecording={live.isRecording}
                    isPaused={live.isPaused}
                  />

                  {live.isRecording ? (
                    <div className="flex items-center justify-center gap-2 text-red-600 font-bold animate-pulse pt-1 text-sm sm:text-base">
                      <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
                      <span>{live.isPaused ? "[ RECORDING PAUSED ]" : "[ 🔴 RECORDING LIVE... SPEAK INTO MIC ]"}</span>
                    </div>
                  ) : live.recordedAudioUrl ? (
                    <div className="text-emerald-700 font-bold pt-1 text-sm sm:text-base">
                      [ ✓ VOICE RECORDING COMPLETED ]
                    </div>
                  ) : (
                    <div className="text-[#555555] font-vt323 pt-1 text-base">
                      *Click [START RECORDING] and speak into your microphone to view live frequency animation and real-time text streaming.
                    </div>
                  )}

                  {live.isRecording && live.engine && (
                    <div className="text-[10px] font-bold text-[#1C1C1C]">{ENGINE_LABELS[live.engine]}</div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 font-mono text-sm">
                  {!live.isRecording && !live.recordedAudioUrl && (
                    <select
                      value={micLanguage}
                      onChange={(e) => setMicLanguage(e.target.value as MicLanguage)}
                      className="border border-[#1C1C1C] bg-[#E3DFCE] text-[#1C1C1C] px-3 py-3 text-sm font-bold outline-none cursor-pointer"
                      aria-label="Speech language"
                    >
                      <option value="en-IN">🌐 HINGLISH (AUTO)</option>
                      <option value="hi-IN">🇮🇳 HINDI ONLY</option>
                      <option value="en-US">🇬🇧 ENGLISH ONLY</option>
                    </select>
                  )}
                  {!live.isRecording ? (
                    !live.recordedAudioUrl && (
                      <button
                        onClick={startRecording}
                        className="btn-retro-primary px-7 py-3.5 flex items-center gap-2 text-sm"
                      >
                        <Mic className="w-4.5 h-4.5 text-red-400" />
                        <span>[ ⏺️ START RECORDING ]</span>
                      </button>
                    )
                  ) : (
                    <>
                      {live.isPaused ? (
                        <button
                          onClick={live.resume}
                          className="btn-retro-primary px-6 py-3 flex items-center gap-2 text-sm"
                        >
                          <Play className="w-4 h-4" />
                          <span>[ ▶️ RESUME ]</span>
                        </button>
                      ) : (
                        <button
                          onClick={live.pause}
                          className="btn-retro-secondary px-6 py-3 flex items-center gap-2 text-sm"
                        >
                          <Pause className="w-4 h-4" />
                          <span>[ ⏸️ PAUSE ]</span>
                        </button>
                      )}

                      <button
                        onClick={live.stop}
                        className="btn-retro-primary bg-red-700 text-white hover:bg-red-800 px-7 py-3 flex items-center gap-2 text-sm"
                      >
                        <Square className="w-4 h-4" />
                        <span>[ ⏹️ STOP RECORDING ]</span>
                      </button>
                    </>
                  )}

                  {live.recordedAudioUrl && !live.isRecording && (
                    <button
                      onClick={() => {
                        live.reset();
                        setSummary("");
                        setError("");
                      }}
                      className="btn-retro-secondary px-5 py-3 flex items-center gap-2 text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>[ NEW RECORDING ]</span>
                    </button>
                  )}
                </div>

                {/* Audio Player */}
                {live.recordedAudioUrl && (
                  <div className="w-full max-w-lg mx-auto">
                    <RetroAudioPlayer ref={audioRef} src={live.recordedAudioUrl} />
                  </div>
                )}
              </div>

              {/* LIVE REAL-TIME TRANSCRIPT TERMINAL (while recording) */}
              {showLiveTerminal && (
                <div className="retro-panel p-5 space-y-3">
                  <div className="text-sm font-mono font-bold flex items-center gap-2 pb-3 border-b border-[#1C1C1C]">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                    <span>LIVE SPEECH TRANSCRIPT TERMINAL:</span>
                  </div>

                  <div className="border border-[#1C1C1C] bg-[#000000] text-[#00FF00] p-4 text-sm sm:text-base font-mono leading-relaxed min-h-44 max-h-96 overflow-y-auto whitespace-pre-wrap relative">
                    {live.isFinalizing ? (
                      <div className="flex items-center gap-2 text-[#00FF00] py-4">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="font-bold">▶ Processing AI voice transcription...</span>
                      </div>
                    ) : live.transcript ? (
                      <LiveTextDisplay text={live.transcript} isRecording={live.isRecording} />
                    ) : (
                      <div className="text-emerald-400/70 italic flex items-center gap-2 py-4">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                        <span>▶ Listening to microphone... Speak into your mic and words will appear here live as you speak.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FINISHED TRANSCRIPT (after recording) */}
              {!showLiveTerminal && live.transcript && (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <button
                      onClick={handleSummarizeLiveAudio}
                      disabled={isSummarizing}
                      className="btn-retro-secondary px-3.5 py-1.5 text-xs flex items-center gap-1.5 font-mono"
                    >
                      {isSummarizing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>[ PARSING AI... ]</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-[#0000FF]" />
                          <span>[ SUMMARIZE VOICE ]</span>
                        </>
                      )}
                    </button>
                  </div>
                  <TranscriptPanel
                    label="LIVE_VOICE_TRANSCRIPT.TXT:"
                    exportTitle="UNITED AI — VERBATIM LIVE VOICE TRANSCRIPT"
                    fileBaseName="united_ai_live_transcript"
                    transcript={live.transcript}
                    summary={summary}
                    onSeek={handleSeekToTimestamp}
                  />
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FILE UPLOAD WORKSPACE */}
          {activeTab === "upload" && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`retro-panel p-6 text-center space-y-4 transition-all ${
                isDragging ? "bg-[#0000FF] text-white border-white scale-[1.01]" : ""
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className={`border p-4 font-mono text-sm ${isDragging ? "border-white bg-[#0000FF]" : "border-[#1C1C1C] bg-[#D4D0BD]"}`}>
                  <pre className="text-xs sm:text-sm leading-tight font-bold">
{`+------------------------------------+
| ${isDragging ? "  [ DROP AUDIO HERE TO PROCESS ]   " : "  [ UPLOAD AUDIO FILE ]            "} |
|   FORMATS: MP3, WAV, M4A, OGG      |
+------------------------------------+`}
                  </pre>
                </div>

                {selectedFile && (
                  <div className="border border-[#1C1C1C] bg-[#1C1C1C] text-[#E3DFCE] p-2.5 text-sm font-mono">
                    FILE: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}

                {audioPreviewUrl && (
                  <div className="w-full max-w-lg mx-auto">
                    <RetroAudioPlayer ref={audioRef} src={audioPreviewUrl} />
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.webm"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isLoading}
                />

                {uploadTranscript ? (
                  <button onClick={handleResetUpload} className="btn-retro-secondary px-7 py-3 text-sm">
                    [ PROCESS ANOTHER AUDIO FILE ]
                  </button>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="btn-retro-primary px-9 py-3.5 text-sm"
                  >
                    {isLoading ? "[ TRANSCRIBING AUDIO STREAM... ]" : "[ SELECT AUDIO FILE ]"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error Alert */}
          {shownError && (
            <div className="border border-[#1C1C1C] bg-[#FF2200] text-white p-4 text-sm font-mono">
              *ERROR: {shownError}
            </div>
          )}

          {/* AI SUMMARY & CHAPTER MARKERS */}
          {summary && (
            <div className="space-y-4">
              <div className="retro-panel p-5">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-[#1C1C1C]">
                  <span className="text-sm font-mono font-bold flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#0000FF]" />
                    <span>EXECUTIVE AI SUMMARY.TXT:</span>
                  </span>
                  <button onClick={() => navigator.clipboard.writeText(summary)} className="btn-retro-secondary px-3 py-1 text-xs">
                    [COPY]
                  </button>
                </div>
                <div className="border border-[#1C1C1C] bg-[#FFFFFF] p-4 text-sm sm:text-base font-mono leading-relaxed whitespace-pre-wrap">
                  {summary}
                </div>
              </div>

              <ChapterFlags summaryText={summary} chapters={chapters} onSeek={handleSeekToTimestamp} />
            </div>
          )}

          {/* UPLOADED FILE TRANSCRIPT */}
          {activeTab === "upload" && uploadTranscript && (
            <TranscriptPanel
              label="AUDIO_TRANSCRIPT.TXT:"
              exportTitle={selectedFile?.name || "UNITED AI — AUDIO TRANSCRIPT"}
              fileBaseName="united_ai_audio_transcript"
              transcript={uploadTranscript}
              summary={summary}
              onSeek={handleSeekToTimestamp}
            />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AudioTranscribe;
