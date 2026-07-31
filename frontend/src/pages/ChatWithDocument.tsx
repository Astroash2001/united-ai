import { useState, useRef, ChangeEvent } from "react";
import { MessageSquare, Upload, Send, Loader2, FileText, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { extractText, chatWithDocument } from "@/services/chat-api";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const ChatWithDocument = () => {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleFileUpload = async (selectedFile: File) => {
    setError("");
    setIsUploading(true);

    const ext = selectedFile.name.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'txt', 'png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
      setError("Please upload a valid PDF, TXT, or Image file (PNG/JPG/WEBP)");
      setIsUploading(false);
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("SYSTEM REJECTED: Document file exceeds the maximum allowed size of 10MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsUploading(false);
      return;
    }

    try {
      const data = await extractText(selectedFile);
      setFile(selectedFile);
      setExtractedText(data.text);
      setMessages([
        {
          role: "assistant",
          content: `*UNITE.TXT // INDEXED "${selectedFile.name}". Ask any question, extract key figures, or request section summaries.`,
        },
      ]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to process document",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleFileUpload(selectedFile);
    }
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
      handleFileUpload(file);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !extractedText || isSending) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setIsSending(true);
    
    // Scroll chat window to user's query when Enter is pressed
    setTimeout(scrollToBottom, 50);

    try {
      const data = await chatWithDocument(userMessage, extractedText);
      setMessages([
        ...newMessages,
        { role: "assistant", content: data.answer },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI answer. Check connection.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRemoveDocument = () => {
    setFile(null);
    setExtractedText("");
    setMessages([]);
    setError("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="retro-frame p-3 sm:p-4 min-h-[90vh]">
      <Header />

      <main className="py-4">
        <div className="max-w-5xl mx-auto">
          {/* Header Bar */}
          <div className="retro-panel p-3 mb-4 text-center border-b-[3px] border-[#1C1C1C]">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#1C1C1C]">
              [ INTERACTIVE RAG CHAT WORKSPACE // UNITED AI ]
            </div>
            <p className="text-xs font-vt323 mt-1 text-[#555555]">
              *Upload PDF or TXT to query specific details in natural conversational dialogue.
            </p>
            <div className="mt-2 inline-block border border-[#1C1C1C] bg-[#FF9933] text-[#1C1C1C] px-3 py-1 text-[10px] font-mono font-bold shadow-[2px_2px_0px_#1C1C1C]">
              [ ⚠️ SYSTEM LIMIT: CURRENT CONTEXT WINDOW CAPPED AT ~3-6 PAGES (8,000 CHARACTERS) ]
            </div>
          </div>

          {!file ? (
            /* Retro Upload Box */
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`retro-panel p-8 md:p-12 text-center transition-all ${
                isDragging ? "bg-[#0000FF] text-white border-white scale-[1.01]" : ""
              }`}
            >
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className={`border p-3 font-mono text-xs ${isDragging ? "border-white bg-[#0000FF]" : "border-[#1C1C1C] bg-[#D4D0BD]"}`}>
                  <pre className="text-[10px] leading-tight font-bold">
{`+----------------------------------+
| ${isDragging ? "  [ DROP FILE HERE TO CHAT ]      " : "  [ UPLOAD DOCUMENT OR IMAGE ]    "} |
|   SUPPORTS PDF, TXT & IMAGES (OCR) |
+----------------------------------+`}
                  </pre>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isUploading}
                />

                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="btn-retro-primary px-8 py-3 text-xs"
                >
                  {isUploading ? "[ RUNNING OCR & EXTRACTING TEXT... ]" : "[ SELECT PDF, TXT, OR IMAGE FILE ]"}
                </button>
              </div>
            </div>
          ) : (
            /* Retro Terminal Chat Interface */
            <div className="retro-panel overflow-hidden border border-[#1C1C1C] flex flex-col h-[580px]">
              {/* Document Header Bar */}
              <div className="bg-[#1C1C1C] text-[#E3DFCE] px-4 py-2 text-xs font-mono flex justify-between items-center border-b border-[#1C1C1C]">
                <div>
                  FILE: {file.name} | {(extractedText.length / 1000).toFixed(1)}k CHARS
                </div>
                <button
                  onClick={handleRemoveDocument}
                  className="btn-retro-secondary px-2 py-0.5 text-[10px]"
                >
                  [CHANGE DOCUMENT]
                </button>
              </div>

              {/* Messages Container */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#E3DFCE] font-mono text-xs">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`border p-3 ${
                      message.role === "user"
                        ? "bg-[#1C1C1C] text-[#E3DFCE] border-[#1C1C1C] ml-10"
                        : "bg-[#DFDBCB] text-[#1C1C1C] border-[#1C1C1C] mr-10"
                    }`}
                  >
                    <div className="text-[10px] font-bold uppercase mb-1 border-b border-current pb-0.5">
                      {message.role === "user" ? "&gt; USER QUERY:" : "&gt; UNITED AI RESPONSE:"}
                    </div>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                ))}

                {isSending && (
                  <div className="border border-[#1C1C1C] bg-[#0000FF] text-white p-3 text-xs font-mono">
                    &gt; UNITED AI IS PARSING CONTEXT AND CRAFTING ANSWER...
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-[#D4D0BD] border-t border-[#1C1C1C]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="ENTER QUERY HERE..."
                    disabled={isSending || !extractedText}
                    className="flex-1 retro-input p-2.5 text-xs font-mono"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending || !inputMessage.trim() || !extractedText}
                    className="btn-retro-primary px-4 py-2.5 text-xs"
                  >
                    [SEND]
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <div className="mt-4 border border-[#1C1C1C] bg-[#FF2200] text-white p-3 text-xs font-mono">
              *ERROR: {error}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ChatWithDocument;
