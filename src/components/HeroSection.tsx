import { useState, useRef, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Copy } from "lucide-react";
import Waves from "@/components/Waves";
import { summarizeFile } from "@/services/api";

const HeroSection = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.blur();
    if (file) processFile(file);
  };

  const processFile = async (file: File) => {
    setError("");
    setSummary("");
    setSelectedFile(file);
    setIsLoading(true);
    setShowWorkspace(true);

    try {
      const summaryText = await summarizeFile(file);
      setSummary(summaryText);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      setSelectedFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setSummary("");
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      processFile(file);
    }
  };

  const copySummary = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const features = [
    {
      id: "summarizer",
      title: "01. DOCUMENT SUMMARIZER",
      tag: "PDF / TXT ENGINE",
      desc: "Extract key takeaways, bullet abstracts, and figures from multi-page documents instantly.",
      action: () => {
        setShowWorkspace(true);
        setTimeout(() => {
          document.getElementById("workspace-area")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      },
      btnText: "[ LAUNCH SUMMARIZER ]",
      badge: "CORE ENGINE",
    },
    {
      id: "audio",
      title: "02. AUDIO SPEECH ENGINE",
      tag: "WHISPER & DEEPGRAM",
      desc: "Convert MP3, WAV, M4A, and FLAC recordings into verbatim transcripts with chapter flags.",
      action: () => navigate("/audio"),
      btnText: "[ OPEN AUDIO WORKSPACE ]",
      badge: "SPEECH AI",
    },
    {
      id: "video",
      title: "03. VIDEO MEDIA PARSER",
      tag: "MP4 / MOV ENGINE",
      desc: "Process MP4, MOV, and MKV video tracks into executive meeting minutes and timestamps.",
      action: () => navigate("/video"),
      btnText: "[ OPEN VIDEO WORKSPACE ]",
      badge: "VIDEO AI",
    },
    {
      id: "chat",
      title: "04. INTERACTIVE RAG CHAT",
      tag: "DOCUMENT CONVERSATION",
      desc: "Ask specific questions, extract figures, and chat directly with your document context.",
      action: () => navigate("/chat-with-document"),
      btnText: "[ LAUNCH CHAT WORKSPACE ]",
      badge: "RAG CHAT",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Hero Grid: 2 Columns */}
      <div className="retro-frame p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Left Column: Description & Mission */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-block border border-[#1C1C1C] bg-[#1C1C1C] text-[#E3DFCE] px-3 py-1 text-xs font-mono uppercase tracking-widest font-bold">
              UNITED AI // KNOWLEDGE OPERATING SYSTEM
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#1C1C1C] leading-snug uppercase">
              Synthesize Knowledge <br />
              <span className="inline-block bg-[#1C1C1C] text-[#E3DFCE] px-3 py-1 mt-2">
                At Scale.
              </span>
            </h1>

            <p className="text-lg sm:text-xl font-vt323 leading-relaxed text-[#222222] max-w-2xl font-medium">
              *UNITED AI is an all-in-one intelligence suite featuring zero-latency live speech transcription, multi-format video parsing, instant PDF/TXT summarization, and interactive RAG document dialogue—delivering maximum precision with zero permanent data retention.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-3 text-xs sm:text-sm font-mono">
              <button
                onClick={() => {
                  setShowWorkspace(true);
                  setTimeout(() => {
                    document.getElementById("workspace-area")?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                className="btn-retro-primary px-6 py-3 flex items-center gap-2 text-sm"
              >
                <span>[ START DOCUMENT SUMMARIZER ]</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate("/chat-with-document")}
                className="btn-retro-primary px-6 py-3 flex items-center gap-2 text-sm"
              >
                <span>[ CHAT WITH PDF ]</span>
              </button>
            </div>
          </div>

          {/* Right Column: Interactive Waves Physics Canvas */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="retro-panel p-2 border border-[#1C1C1C] text-center w-full flex flex-col items-center justify-center bg-[#0B0B0C] h-[320px] overflow-hidden relative">
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#A5A7AD] mb-1 border-b border-[#2A2B30] w-full pb-1 z-10 bg-[#0B0B0C]/80 backdrop-blur-sm">
                INTERACTIVE WAVE CANVAS (MOVE CURSOR):
              </div>
              
              <Waves
                lineColor="#FFFFFF"
                backgroundColor="#0B0B0C"
                waveSpeedX={0.0125}
                waveSpeedY={0.005}
                waveAmpX={35}
                waveAmpY={20}
                friction={0.925}
                tension={0.005}
                maxCursorMove={100}
                xGap={10}
                yGap={20}
              />

              <div className="text-[10px] font-mono text-[#A5A7AD] border-t border-[#2A2B30] w-full pt-1 z-10 bg-[#0B0B0C]/80 backdrop-blur-sm">
                *SPRING PHYSICS SIMULATION
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Functionality Cards Section */}
      <div className="retro-frame p-4 md:p-6">
        <div className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-[#555555] border-b border-[#1C1C1C] pb-2 mb-4 flex justify-between items-center">
          <span>[ SELECT FUNCTIONALITY WORKSPACE ]</span>
          <span>4 SYSTEM MODULES</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature) => (
            <div
              key={feature.id}
              onClick={feature.action}
              className="retro-panel p-4 border border-[#1C1C1C] flex flex-col justify-between cursor-pointer hover:bg-[#1C1C1C] hover:text-[#E3DFCE] group transition-all"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="px-2 py-0.5 border border-current font-bold">{feature.badge}</span>
                  <span className="text-[#555555] group-hover:text-[#E3DFCE]">{feature.tag}</span>
                </div>

                <h3 className="text-sm font-bold font-mono tracking-tight leading-tight border-b border-current pb-1 mt-2">
                  {feature.title}
                </h3>

                <p className="text-sm sm:text-base font-vt323 leading-relaxed text-[#333333] group-hover:text-[#E3DFCE]">
                  *{feature.desc}
                </p>
              </div>

              <div className="mt-4 pt-2 border-t border-current text-xs font-mono font-bold flex items-center justify-between">
                <span>{feature.btnText}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Document Summarizer Active Workspace Area */}
      {showWorkspace && (
        <div id="workspace-area" className="retro-frame p-4 md:p-6 animate-fade-in space-y-4">
          <div className="text-xs sm:text-sm font-mono font-bold uppercase tracking-wider text-[#555555] border-b border-[#1C1C1C] pb-2 flex justify-between items-center">
            <span>[ DOCUMENT SUMMARIZER WORKSPACE ]</span>
            <button onClick={() => setShowWorkspace(false)} className="underline hover:text-[#1C1C1C]">
              [ CLOSE WORKSPACE ]
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Input Dropzone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`retro-panel p-6 text-center flex flex-col justify-between transition-all ${
                isDragging ? "bg-[#0000FF] text-white border-white scale-[1.01]" : ""
              }`}
            >
              <div className="space-y-4">
                <div className={`border p-4 font-mono text-xs sm:text-sm ${isDragging ? "border-white bg-[#0000FF]" : "border-[#1C1C1C] bg-[#D4D0BD]"}`}>
                  <pre className="text-xs sm:text-sm leading-tight font-bold">
{`+------------------------------------+
| ${isDragging ? "  [ DROP FILE HERE TO UPLOAD ]    " : "  [ UPLOAD PDF, TXT OR IMAGE ]    "} |
|   MAX FILE SIZE: 10 MB (OCR READY) |
+------------------------------------+`}
                  </pre>
                </div>

                {selectedFile && !error && (
                  <div className="border border-[#1C1C1C] bg-[#1C1C1C] text-[#E3DFCE] p-3 text-xs sm:text-sm font-mono text-left">
                    ▶ FILE: {selectedFile.name} <br />
                    ▶ SIZE: {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isLoading}
                />

                {summary ? (
                  <button onClick={handleReset} className="btn-retro-secondary px-7 py-3 text-sm w-full">
                    [ SUMMARIZE ANOTHER FILE ]
                  </button>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="btn-retro-primary px-9 py-3.5 text-sm w-full"
                  >
                    {isLoading ? "[ ANALYZING & RUNNING OCR... ]" : "[ SELECT PDF, TXT, OR IMAGE FILE ]"}
                  </button>
                )}
              </div>

              <div className="text-xs font-mono text-[#555555] pt-4">
                *SYSTEM STATUS: READY FOR SYNTHESIS
              </div>
            </div>

            {/* Output Stream */}
            <div className="lg:col-span-6 retro-panel p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3 pb-1 border-b border-[#1C1C1C]">
                  <span className="text-xs sm:text-sm font-mono font-bold">EXECUTIVE_SUMMARY.TXT:</span>
                  {summary && (
                    <button onClick={copySummary} className="btn-retro-secondary px-3 py-1 text-xs">
                      {copied ? "[COPIED]" : "[COPY SUMMARY]"}
                    </button>
                  )}
                </div>

                {error && (
                  <div className="border border-[#1C1C1C] bg-[#FF2200] text-white p-3 text-xs sm:text-sm font-mono">
                    *ERROR: {error}
                  </div>
                )}

                {summary ? (
                  <div className="border border-[#1C1C1C] bg-[#FFFFFF] p-4 text-sm sm:text-base font-mono leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap">
                    {summary}
                  </div>
                ) : (
                  <div className="border border-[#1C1C1C] bg-[#D4D0BD] p-6 text-center text-sm font-vt323 text-[#555555]">
                    *Upload a document or click [SELECT PDF OR TXT FILE] to generate executive AI summary output.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroSection;
