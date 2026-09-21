import { useState, useRef, ChangeEvent, FormEvent } from "react";
import { Globe, Link2, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ChatMessage, extractText, extractUrl, chatWithDocument } from "@/services/chat-api";

const DOCUMENT_EXTENSIONS = ["pdf", "txt", "md", "csv", "png", "jpg", "jpeg", "webp"];

interface LoadedDocument {
  name: string;
  text: string;
  sourceUrl?: string;
}

const ChatWithDocument = () => {
  const [activeDoc, setActiveDoc] = useState<LoadedDocument | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [webSearch, setWebSearch] = useState(false);
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

  const openDocument = (loaded: LoadedDocument) => {
    setActiveDoc(loaded);
    setMessages([]);
  };

  const handleFileUpload = async (selectedFile: File) => {
    setError("");

    const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "";
    if (!DOCUMENT_EXTENSIONS.includes(ext)) {
      setError("Please upload a valid PDF, TXT, or Image file (PNG/JPG/WEBP)");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("SYSTEM REJECTED: Document file exceeds the maximum allowed size of 10MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);
    try {
      const data = await extractText(selectedFile);
      openDocument({ name: selectedFile.name, text: data.text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!pageUrl.trim()) return;
    setError("");
    setIsUploading(true);
    try {
      const data = await extractUrl(pageUrl.trim());
      openDocument({ name: data.filename, text: data.text, sourceUrl: pageUrl.trim() });
      setPageUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read web page");
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
    if (!inputMessage.trim() || !activeDoc || isSending) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setError("");

    const previousMessages = messages;
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setIsSending(true);

    // Scroll chat window to user's query when Enter is pressed
    setTimeout(scrollToBottom, 50);

    try {
      const data = await chatWithDocument(userMessage, activeDoc.text, {
        history: previousMessages,
        webSearch,
        // Answer streams into the last message as it is generated.
        onDelta: (answerSoFar) => setMessages([...newMessages, { role: "assistant", content: answerSoFar }]),
      });
      setMessages([...newMessages, { role: "assistant", content: data.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get AI answer. Check connection.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleRemoveDocument = () => {
    setActiveDoc(null);
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
              *Upload a PDF, TXT, or image, or paste a web page link, to query specific details in natural conversational dialogue.
            </p>
            <div className="mt-2 inline-block border border-[#1C1C1C] bg-[#FF9933] text-[#1C1C1C] px-3 py-1 text-[10px] font-mono font-bold shadow-[2px_2px_0px_#1C1C1C]">
              [ LONG DOCUMENTS: EACH QUESTION SEARCHES THE WHOLE TEXT FOR THE MOST RELEVANT PASSAGES ]
            </div>
          </div>

          {!activeDoc ? (
            <div className="space-y-4">
              {/* Retro Upload Box */}
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
                    accept=".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
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

              {/* Web page link */}
              <form onSubmit={handleUrlSubmit} className="retro-panel p-4 flex flex-col sm:flex-row gap-2 font-mono text-xs">
                <label className="flex-1 flex items-center gap-2 border border-[#1C1C1C] bg-[#E3DFCE] px-3">
                  <Link2 className="w-4 h-4 shrink-0" />
                  <span className="sr-only">Web page link</span>
                  <input
                    type="url"
                    value={pageUrl}
                    onChange={(e) => setPageUrl(e.target.value)}
                    placeholder="...or paste a web page link: https://example.com/article"
                    className="flex-1 bg-transparent py-2.5 outline-none min-w-0"
                    disabled={isUploading}
                  />
                </label>
                <button type="submit" disabled={isUploading || !pageUrl.trim()} className="btn-retro-secondary px-5 py-2.5 text-xs">
                  {isUploading ? "[ READING... ]" : "[ CHAT WITH PAGE ]"}
                </button>
              </form>
            </div>
          ) : (
            /* Retro Terminal Chat Interface */
            <div className="retro-panel overflow-hidden border border-[#1C1C1C] flex flex-col h-[580px]">
              {/* Document Header Bar */}
              <div className="bg-[#1C1C1C] text-[#E3DFCE] px-4 py-2 text-xs font-mono flex justify-between items-center gap-2 border-b border-[#1C1C1C]">
                <div className="truncate">
                  {activeDoc.sourceUrl ? "PAGE" : "FILE"}: {activeDoc.name} | {(activeDoc.text.length / 1000).toFixed(1)}k CHARS
                </div>
                <button
                  onClick={handleRemoveDocument}
                  className="btn-retro-secondary px-2 py-0.5 text-[10px] shrink-0"
                >
                  [CHANGE DOCUMENT]
                </button>
              </div>

              {/* Messages Container */}
              <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#E3DFCE] font-mono text-xs">
                <div className="border p-3 bg-[#DFDBCB] text-[#1C1C1C] border-[#1C1C1C] mr-10">
                  *UNITE.TXT // INDEXED "{activeDoc.name}". Ask any question, extract key figures, or request section summaries.
                </div>

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
                      {message.role === "user" ? "> USER QUERY:" : "> UNITED AI RESPONSE:"}
                    </div>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                ))}

                {isSending && messages[messages.length - 1]?.role === "user" && (
                  <div className="border border-[#1C1C1C] bg-[#0000FF] text-white p-3 text-xs font-mono flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {webSearch ? "> SEARCHING THE WEB AND CRAFTING ANSWER..." : "> UNITED AI IS PARSING CONTEXT AND CRAFTING ANSWER..."}
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 bg-[#D4D0BD] border-t border-[#1C1C1C] space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="ENTER QUERY HERE..."
                    disabled={isSending}
                    className="flex-1 retro-input p-2.5 text-xs font-mono"
                    aria-label="Question about the document"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={isSending || !inputMessage.trim()}
                    className="btn-retro-primary px-4 py-2.5 text-xs"
                  >
                    [SEND]
                  </button>
                </div>
                <label className="flex items-center gap-2 text-[10px] font-mono font-bold cursor-pointer select-none w-fit">
                  <input
                    type="checkbox"
                    checked={webSearch}
                    onChange={(e) => setWebSearch(e.target.checked)}
                    className="accent-[#0000FF]"
                  />
                  <Globe className="w-3 h-3" />
                  ALSO SEARCH THE WEB (ANSWERS CITE SOURCES)
                </label>
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
