import React, { useState, useRef, useEffect, ChangeEvent, memo } from "react";
import { Mic, Play, Pause, Square, Upload, Loader2, RefreshCw, Download, Copy, Sparkles } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChapterFlags from "@/components/ChapterFlags";
import VoiceVisualizer from "@/components/VoiceVisualizer";
import RetroAudioPlayer from "@/components/RetroAudioPlayer";
import { transcribeAudio, summarizeTranscript } from "@/services/transcription-api";
import { exportTranscriptToPDF } from "@/utils/pdfExport";
import { MultilingualTranscriptRenderer } from "@/utils/multilingual";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const LiveTextDisplay = memo(({ text, isRecording }: { text: string; isRecording: boolean }) => {
  return (
    <div id="live-text-span">
      <MultilingualTranscriptRenderer text={text} isRecording={isRecording} />
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.text === nextProps.text && prevProps.isRecording === nextProps.isRecording;
});

const AudioTranscribe = () => {
  const [activeTab, setActiveTab] = useState<"record" | "upload">("record");

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transcript, setTranscript] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Live Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [micLanguage, setMicLanguage] = useState<string>("en-IN");
  const [liveTranscript, setLiveTranscript] = useState<string>("");
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const backupStreamIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const liveTranscriptRef = useRef<string>("");
  const hasWebSpeechResultsRef = useRef(false);
  const sequenceIdRef = useRef(0);
  const latestProcessedSequenceRef = useRef(0);

  useEffect(() => {
    isRecordingRef.current = isRecording;
    isPausedRef.current = isPaused;
  }, [isRecording, isPaused]);

  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (backupStreamIntervalRef.current) clearInterval(backupStreamIntervalRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startBackupStreamer = () => {
    if (backupStreamIntervalRef.current) clearInterval(backupStreamIntervalRef.current);
    backupStreamIntervalRef.current = setInterval(async () => {
      if (
        isRecordingRef.current &&
        !isPausedRef.current &&
        !hasWebSpeechResultsRef.current &&
        audioChunksRef.current.length > 0
      ) {
        sequenceIdRef.current += 1;
        const currentSeq = sequenceIdRef.current;
        try {
          const chunkBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const chunkFile = new File([chunkBlob], `live_slice.webm`, { type: "audio/webm" });
          const data = await transcribeAudio(chunkFile);
          
          if (currentSeq > latestProcessedSequenceRef.current) {
            latestProcessedSequenceRef.current = currentSeq;
            if (data.transcript && data.transcript.trim().length > 0) {
              const text = data.transcript.trim();
              liveTranscriptRef.current = text;
              setLiveTranscript(text);
            }
          }
        } catch (e) {
          // Silently ignore slice transcription errors
        }
      }
    }, 750);
  };

  // --- GUARANTEED REAL-TIME LIVE SPEECH-TO-TEXT ENGINE ---
  const startLiveRecording = async () => {
    setError("");
    setLiveTranscript("");
    setTranscript("");
    setSummary("");
    setRecordedAudioBlob(null);
    liveTranscriptRef.current = "";
    hasWebSpeechResultsRef.current = false;
    sequenceIdRef.current = 0;
    latestProcessedSequenceRef.current = 0;

    const span = document.getElementById("live-text-span");
    if (span) span.textContent = "";

    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    setRecordedAudioUrl(null);
    audioChunksRef.current = [];

    try {
      // 1. Microphone Access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);

      // 2. Setup MediaRecorder for high-fidelity audio capture
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setRecordedAudioUrl(url);

        // High accuracy Whisper pass on stop
        if (audioChunksRef.current.length > 0) {
          setIsProcessingAudio(true);
          try {
            const file = new File([audioBlob], `voice_rec_${Date.now()}.webm`, { type: "audio/webm" });
            const data = await transcribeAudio(file);
            if (data.transcript && data.transcript.trim().length > 0) {
              setTranscript(data.transcript);
              setLiveTranscript(data.transcript);
            }
          } catch (e) {
            console.warn("Whisper final pass notice:", e);
          } finally {
            setIsProcessingAudio(false);
          }
        }
      };

      mediaRecorder.start(100);

      // 3. Web Speech API Engine with 0ms DOM Streaming
      const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        const recognition = new SpeechRecognitionClass();
        recognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = micLanguage;
        
        let sessionPrefixText = "";

        recognition.onstart = () => {
          // When a new WebSpeech session starts (after pause or silent timeout), 
          // lock in everything we've transcribed so far.
          sessionPrefixText = liveTranscriptRef.current;
        };

        recognition.onresult = (event: any) => {
          hasWebSpeechResultsRef.current = true;
          let currentSessionText = "";

          for (let i = 0; i < event.results.length; i++) {
            currentSessionText += event.results[i][0].transcript + " ";
          }

          const fullText = (sessionPrefixText + " " + currentSessionText).replace(/\s+/g, " ").trim();
          if (fullText.length > 0) {
            liveTranscriptRef.current = fullText;
            setLiveTranscript(fullText);
          }
        };

        recognition.onerror = () => {
          if (isRecordingRef.current && !isPausedRef.current) {
            try { recognition.start(); } catch (e) {}
          }
        };

        recognition.onend = () => {
          if (isRecordingRef.current && !isPausedRef.current) {
            try { recognition.start(); } catch (e) {}
          }
        };

        try { recognition.start(); } catch (e) {}
      }

      // 4. Fallback Streamer: If WebSpeech API is unsupported/blocked, use the backend Whisper slices.
      // Strict sequence ordering prevents out-of-order HTTP responses from overwriting newer text (the "earlier versions" bug).
      startBackupStreamer();

      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone permission denied or device unavailable.");
    }
  };

  const pauseLiveRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (backupStreamIntervalRef.current) clearInterval(backupStreamIntervalRef.current);
      setIsPaused(true);
    }
  };

  const resumeLiveRecording = () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) {}
      }
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      startBackupStreamer();
      setIsPaused(false);
    }
  };

  const stopLiveRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (backupStreamIntervalRef.current) clearInterval(backupStreamIntervalRef.current);
      
      setLiveTranscript(liveTranscriptRef.current);
      setTranscript(liveTranscriptRef.current);
      
      setIsRecording(false);
      setIsPaused(false);

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const handleSummarizeLiveAudio = async () => {
    const activeText = transcript || liveTranscript || (document.getElementById("live-text-span")?.textContent ?? "");
    if (!activeText) return;
    
    setError("");
    setIsProcessingAudio(true);

    try {
      const data = await summarizeTranscript(activeText);
      if (data.corrected_transcript) {
        setTranscript(data.corrected_transcript);
        setLiveTranscript(data.corrected_transcript);
        const span = document.getElementById("live-text-span");
        if (span) span.textContent = data.corrected_transcript;
      }
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate AI summary.";
      setError(msg);
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const handleExportPDF = () => {
    const activeText = transcript || liveTranscript || (document.getElementById("live-text-span")?.textContent ?? "");
    if (!activeText) return;
    exportTranscriptToPDF({
      title: "UNITED AI — VERBATIM LIVE VOICE TRANSCRIPT",
      transcript: activeText,
      summary: summary || undefined,
      timestamp: new Date().toLocaleString(),
    });
  };

  const processAudioFile = async (file: File) => {
    setError("");
    setTranscript("");
    setSummary("");

    if (file.size > 25 * 1024 * 1024) {
      setError("SYSTEM REJECTED: Audio file exceeds the maximum allowed size of 25MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    setIsLoading(true);

    const objectUrl = URL.createObjectURL(file);
    setAudioPreviewUrl(objectUrl);

    try {
      const data = await transcribeAudio(file);
      setTranscript(data.transcript);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to transcribe audio file.";
      setError(message);
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

  const handleReset = () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
    setSelectedFile(null);
    setAudioPreviewUrl(null);
    setRecordedAudioUrl(null);
    setRecordedAudioBlob(null);
    setTranscript("");
    setLiveTranscript("");
    setSummary("");
    setError("");
    setRecordingTime(0);
    liveTranscriptRef.current = "";
    hasWebSpeechResultsRef.current = false;
    const span = document.getElementById("live-text-span");
    if (span) span.textContent = "";
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSeekToTimestamp = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play().catch(() => {});
      audioRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const currentActiveTranscript = transcript || liveTranscript;

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
              [ ⚠️ SYSTEM LIMIT: MAXIMUM AUDIO UPLOAD IS 25MB (~20 MINUTES) ]
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex border border-[#1C1C1C] bg-[#DFDBCB] p-1 font-mono text-sm max-w-lg mx-auto">
            <button
              onClick={() => {
                if (!isRecording) setActiveTab("record");
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
                if (!isRecording) setActiveTab("upload");
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
                      {formatTime(recordingTime)}
                    </span>
                  </div>

                  {/* VOICE FREQUENCY AUDIO VISUALIZER */}
                  <VoiceVisualizer
                    stream={mediaStream}
                    isRecording={isRecording}
                    isPaused={isPaused}
                  />

                  {isRecording ? (
                    <div className="flex items-center justify-center gap-2 text-red-600 font-bold animate-pulse pt-1 text-sm sm:text-base">
                      <span className="w-3 h-3 rounded-full bg-red-600 inline-block" />
                      <span>{isPaused ? "[ RECORDING PAUSED ]" : "[ 🔴 RECORDING LIVE... SPEAK INTO MIC ]"}</span>
                    </div>
                  ) : recordedAudioUrl ? (
                    <div className="text-emerald-700 font-bold pt-1 text-sm sm:text-base">
                      [ ✓ VOICE RECORDING COMPLETED ]
                    </div>
                  ) : (
                    <div className="text-[#555555] font-vt323 pt-1 text-base">
                      *Click [START RECORDING] and speak into your microphone to view live frequency animation and real-time text streaming.
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 font-mono text-sm">
                  {!isRecording && !recordedAudioUrl && (
                    <select
                      value={micLanguage}
                      onChange={(e) => setMicLanguage(e.target.value)}
                      className="border border-[#1C1C1C] bg-[#E3DFCE] text-[#1C1C1C] px-3 py-3 text-sm font-bold outline-none cursor-pointer"
                    >
                      <option value="en-IN">🌐 HINGLISH (AUTO)</option>
                      <option value="hi-IN">🇮🇳 HINDI ONLY</option>
                      <option value="en-US">🇬🇧 ENGLISH ONLY</option>
                    </select>
                  )}
                  {!isRecording ? (
                    <button
                      onClick={startLiveRecording}
                      className="btn-retro-primary px-7 py-3.5 flex items-center gap-2 text-sm"
                    >
                      <Mic className="w-4.5 h-4.5 text-red-400" />
                      <span>[ ⏺️ START RECORDING ]</span>
                    </button>
                  ) : (
                    <>
                      {isPaused ? (
                        <button
                          onClick={resumeLiveRecording}
                          className="btn-retro-primary px-6 py-3 flex items-center gap-2 text-sm"
                        >
                          <Play className="w-4 h-4" />
                          <span>[ ▶️ RESUME ]</span>
                        </button>
                      ) : (
                        <button
                          onClick={pauseLiveRecording}
                          className="btn-retro-secondary px-6 py-3 flex items-center gap-2 text-sm"
                        >
                          <Pause className="w-4 h-4" />
                          <span>[ ⏸️ PAUSE ]</span>
                        </button>
                      )}

                      <button
                        onClick={stopLiveRecording}
                        className="btn-retro-primary bg-red-700 text-white hover:bg-red-800 px-7 py-3 flex items-center gap-2 text-sm"
                      >
                        <Square className="w-4 h-4" />
                        <span>[ ⏹️ STOP RECORDING ]</span>
                      </button>
                    </>
                  )}

                  {recordedAudioUrl && !isRecording && (
                    <button
                      onClick={startLiveRecording}
                      className="btn-retro-secondary px-5 py-3 flex items-center gap-2 text-sm"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>[ NEW RECORDING ]</span>
                    </button>
                  )}
                </div>

                {/* Audio Player */}
                {recordedAudioUrl && (
                  <div className="w-full max-w-lg mx-auto">
                    <RetroAudioPlayer ref={audioRef} src={recordedAudioUrl} />
                  </div>
                )}
              </div>

              {/* LIVE REAL-TIME TRANSCRIPT TERMINAL */}
              {(isRecording || liveTranscript || recordedAudioUrl || isProcessingAudio) && (
                <div className="retro-panel p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1C1C1C]">
                    <div className="text-sm font-mono font-bold flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                      <span>LIVE SPEECH TRANSCRIPT TERMINAL:</span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs font-mono">
                      {currentActiveTranscript && (
                        <>
                          <button
                            onClick={handleExportPDF}
                            className="btn-retro-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
                          >
                            <Download className="w-4 h-4" />
                            <span>[ EXPORT PDF ]</span>
                          </button>

                          <button
                            onClick={handleSummarizeLiveAudio}
                            disabled={isProcessingAudio}
                            className="btn-retro-secondary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
                          >
                            {isProcessingAudio ? (
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

                          <button
                            onClick={() => copyToClipboard(currentActiveTranscript, "live")}
                            className="btn-retro-secondary px-3 py-1.5 text-xs"
                          >
                            {copiedType === "live" ? "[COPIED]" : "[COPY]"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Real-time Word Streaming Output Box with Instant Direct DOM Span */}
                  <div className="border border-[#1C1C1C] bg-[#000000] text-[#00FF00] p-4 text-sm sm:text-base font-mono leading-relaxed min-h-44 max-h-96 overflow-y-auto whitespace-pre-wrap relative">
                    {isProcessingAudio ? (
                      <div className="flex items-center gap-2 text-[#00FF00] py-4">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="font-bold">▶ Processing AI voice transcription...</span>
                      </div>
                    ) : (
                      <div>
                        <LiveTextDisplay text={liveTranscript} isRecording={isRecording} />
                        {isRecording && <span className="animate-pulse text-[#00FF00] font-bold"> █</span>}
                        {!isRecording && !liveTranscript && (
                          <div className="text-emerald-400/70 italic flex items-center gap-2 py-4">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                            <span>▶ Listening to microphone... Speak into your mic and words will appear here live as you speak.</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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

                {transcript ? (
                  <button onClick={handleReset} className="btn-retro-secondary px-7 py-3 text-sm">
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
          {error && (
            <div className="border border-[#1C1C1C] bg-[#FF2200] text-white p-4 text-sm font-mono">
              *ERROR: {error}
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
                  <div className="flex gap-2">
                    <button onClick={handleExportPDF} className="btn-retro-primary px-[#3px] py-1 text-xs">
                      [EXPORT PDF]
                    </button>
                    <button onClick={() => copyToClipboard(summary, "summary")} className="btn-retro-secondary px-3 py-1 text-xs">
                      {copiedType === "summary" ? "[COPIED]" : "[COPY]"}
                    </button>
                  </div>
                </div>
                <div className="border border-[#1C1C1C] bg-[#FFFFFF] p-4 text-sm sm:text-base font-mono leading-relaxed whitespace-pre-wrap">
                  {summary}
                </div>
              </div>

              <ChapterFlags summaryText={summary} onSeek={handleSeekToTimestamp} />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AudioTranscribe;
