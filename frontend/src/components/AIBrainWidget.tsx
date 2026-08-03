import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  Loader2, 
  HelpCircle,
  Mic,
  Video,
  FileText
} from "lucide-react";
import { queryAIBrain } from "@/services/brain-api";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  targetRoute?: string | null;
  actionDescription?: string | null;
  redirected?: boolean;
  tokensUsed?: number;
  timestamp: string;
}

export const AIBrainWidget: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [inputQuery, setInputQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial greeting from the AI Brain
    setMessages([
      {
        id: "init",
        role: "assistant",
        content: "*UNITED_AI.BRAIN V1.0 INITIALIZED*\nI am the autonomous AI Brain for AI Summarizer Pro. Ask me anything about this project, or tell me what capability you want to use and I will reroute you automatically!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, []);

  useEffect(() => {
    // Automatically mark targetRoute messages as redirected when location matches targetRoute
    setMessages((prev) =>
      prev.map((msg) => {
        if (
          msg.targetRoute &&
          !msg.redirected &&
          location.pathname.replace(/\/$/, '') === msg.targetRoute.replace(/\/$/, '')
        ) {
          return { ...msg, redirected: true };
        }
        return msg;
      })
    );
  }, [location.pathname]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendQuery = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!queryText) setInputQuery("");
    setIsLoading(true);

    const response = await queryAIBrain(textToSend, location.pathname);

    setIsLoading(false);

    if (response.status === "failed") {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `*SYSTEM ERROR:* ${response.error || "Failed to process query."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      return;
    }

    // Add assistant response
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: response.answer,
      targetRoute: response.target_route,
      actionDescription: response.action_description,
      redirected: !!response.target_route,
      tokensUsed: response.tokens_used,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    // Handle Autonomous Rerouting / Navigation
    if (response.target_route) {
      navigate(response.target_route as string);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendQuery();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 font-mono">
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2 border-[2px] border-[#1C1C1C] bg-[#1C1C1C] text-[#E3DFCE] px-4 py-2.5 shadow-[4px_4px_0px_#0000FF] hover:shadow-[6px_6px_0px_#0000FF] hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all text-xs font-bold uppercase tracking-wider"
          title="Open AI Brain Assistant"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00FF00] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#00FF00]"></span>
          </span>
          <Bot className="w-4 h-4 text-[#00FF00]" />
          <span>[ 🧠 AI BRAIN ]</span>
        </button>
      )}

      {/* Retro Brain Terminal Window */}
      {isOpen && (
        <div className="w-[92vw] sm:w-[420px] h-[550px] max-h-[85vh] bg-[#E3DFCE] border-[3px] border-[#1C1C1C] shadow-[8px_8px_0px_#1C1C1C] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header Bar */}
          <div className="bg-[#1C1C1C] text-[#E3DFCE] px-3 py-2 flex items-center justify-between border-b-[2px] border-[#1C1C1C] text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#00FF00] animate-pulse"></span>
              <Bot className="w-4 h-4 text-[#00FF00]" />
              <span>UNITED_AI.BRAIN // AGENT</span>
            </div>
            
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 border border-[#E3DFCE] hover:bg-[#FF3333] hover:text-white transition-colors"
              title="Close AI Brain"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Model Status Bar */}
          <div className="bg-[#D4D0BD] px-3 py-1 border-b border-[#1C1C1C] flex items-center justify-between text-[10px] text-[#1C1C1C]">
            <span className="font-bold flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#0000FF]" />
              MODEL: gpt-4o-mini
            </span>
            <span className="px-1.5 py-0.2 border font-bold bg-[#00FF00]/20 text-[#006600] border-[#006600]">
              ● BRAIN ACTIVE
            </span>
          </div>

          {/* Chat Messages Container */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#E3DFCE]">
            {messages.map((msg) => {
              const isRedirected =
                msg.redirected ||
                (msg.targetRoute
                  ? location.pathname.replace(/\/$/, "") === msg.targetRoute.replace(/\/$/, "")
                  : false);

              return (
                <div
                  key={msg.id}
                  className={`border p-2.5 text-xs ${
                    msg.role === "user"
                      ? "bg-[#1C1C1C] text-[#E3DFCE] border-[#1C1C1C] ml-6 shadow-[2px_2px_0px_#0000FF]"
                      : msg.role === "system"
                      ? "bg-[#FFF0B2] text-[#1C1C1C] border-[#FF9900]"
                      : "bg-[#DFDBCB] text-[#1C1C1C] border-[#1C1C1C] mr-6 shadow-[2px_2px_0px_#1C1C1C]"
                  }`}
                >
                  <div className="flex justify-between items-center text-[9px] font-bold border-b border-current pb-1 mb-1.5 opacity-80">
                    <span>
                      {msg.role === "user"
                        ? "> USER QUERY"
                        : msg.role === "system"
                        ? "> SYSTEM NOTICE"
                        : "> UNITED_AI.BRAIN"}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  <div className="whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </div>

                  {/* Autonomous Navigation Badge */}
                  {msg.targetRoute && (
                    <div
                      className={`mt-2 p-1.5 border border-[#1C1C1C] text-[10px] font-bold flex items-center justify-between transition-colors ${
                        isRedirected
                          ? "bg-[#006600] text-white"
                          : "bg-[#0000FF] text-white"
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        {isRedirected
                          ? `✓ Already redirected to ${msg.targetRoute}`
                          : `⚡ ${msg.actionDescription || `Rerouting to ${msg.targetRoute}...`}`}
                      </span>
                      <button
                        onClick={() => navigate(msg.targetRoute as string)}
                        disabled={isRedirected}
                        className={`px-1.5 py-0.5 text-[9px] font-bold transition-colors ${
                          isRedirected
                            ? "bg-[#E3DFCE] text-[#006600] cursor-default opacity-90 border border-[#006600]"
                            : "bg-white text-[#0000FF] hover:bg-[#E3DFCE]"
                        }`}
                      >
                        {isRedirected ? "REDIRECTED ✓" : "GO NOW \u2192"}
                      </button>
                    </div>
                  )}

                  {msg.tokensUsed && (
                    <div className="mt-1 text-[8px] text-right opacity-60">
                      Tokens: {msg.tokensUsed} (gpt-4o-mini)
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="bg-[#0000FF] text-white p-2.5 border border-[#1C1C1C] text-xs flex items-center gap-2 mr-6 animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>BRAIN IS PROCESSING &amp; EVALUATING INTENT...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="bg-[#D4D0BD] px-2 py-1.5 border-t border-[#1C1C1C] overflow-x-auto flex gap-1.5 shrink-0 text-[10px]">
            <button
              onClick={() => handleSendQuery("Take me to audio transcription")}
              className="px-2 py-0.5 bg-[#E3DFCE] text-[#1C1C1C] border border-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-[#E3DFCE] flex items-center gap-1 shrink-0 font-bold"
            >
              <Mic className="w-2.5 h-2.5" /> 🎙️ Audio
            </button>
            <button
              onClick={() => handleSendQuery("Summarize YouTube video")}
              className="px-2 py-0.5 bg-[#E3DFCE] text-[#1C1C1C] border border-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-[#E3DFCE] flex items-center gap-1 shrink-0 font-bold"
            >
              <Video className="w-2.5 h-2.5" /> 🎥 Video
            </button>
            <button
              onClick={() => handleSendQuery("Chat with my PDF document")}
              className="px-2 py-0.5 bg-[#E3DFCE] text-[#1C1C1C] border border-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-[#E3DFCE] flex items-center gap-1 shrink-0 font-bold"
            >
              <FileText className="w-2.5 h-2.5" /> 📄 Chat PDF
            </button>
            <button
              onClick={() => handleSendQuery("What can this app do?")}
              className="px-2 py-0.5 bg-[#E3DFCE] text-[#1C1C1C] border border-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-[#E3DFCE] flex items-center gap-1 shrink-0 font-bold"
            >
              <HelpCircle className="w-2.5 h-2.5" /> ❓ About App
            </button>
          </div>

          {/* Input Box */}
          <div className="p-2.5 bg-[#1C1C1C] border-t border-[#1C1C1C]">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask AI Brain or request action..."
                disabled={isLoading}
                className="flex-1 bg-[#E3DFCE] text-[#1C1C1C] px-2.5 py-1.5 text-xs font-mono border border-white focus:outline-none"
              />
              <button
                onClick={() => handleSendQuery()}
                disabled={isLoading || !inputQuery.trim()}
                className="bg-[#0000FF] text-white px-3 py-1.5 text-xs font-bold border border-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>SEND</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
