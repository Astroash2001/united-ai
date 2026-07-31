import { Link } from "react-router-dom";
import { Github } from "lucide-react";

const footerLinks = {
  capabilities: [
    { label: "Document Summarizer", path: "/" },
    { label: "Audio Speech Engine", path: "/audio" },
    { label: "Video Transcribe", path: "/video" },
    { label: "Interactive RAG Chat", path: "/chat-with-document" },
  ],
  authenticStack: [
    { label: "OpenAI GPT Models", path: "https://platform.openai.com/docs", external: true },
    { label: "OpenAI Whisper AI", path: "https://openai.com/research/whisper", external: true },
    { label: "Deepgram API Engine", path: "https://deepgram.com", external: true },
    { label: "PyPDF Document Parser", path: "https://pypdf.readthedocs.io", external: true },
  ],
  protocols: [
    { label: "Zero Data Retention", path: "#" },
    { label: "In-Memory Volatile Stream", path: "#" },
    { label: "TLS Encrypted Pipeline", path: "#" },
    { label: "GitHub Source Code", path: "https://github.com/Astroash2001/ai-summarizer-pro", external: true },
  ]
};

const Footer = () => {
  return (
    <footer className="retro-panel mt-6 p-4 border border-[#1C1C1C] text-[#1C1C1C] font-mono text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 pb-6 border-b border-[#1C1C1C]">
        {/* Brand Info (2 Columns) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <span className="border border-[#1C1C1C] bg-[#E3DFCE] px-2.5 py-1 font-pixel text-xs font-bold">
              UNITED_AI.TXT
            </span>
            <span className="font-bold uppercase tracking-wider text-xs">
              UNITED AI KNOWLEDGE SYSTEM
            </span>
          </div>
          <p className="text-sm font-vt323 leading-relaxed text-[#333333] max-w-sm">
            *Engineered for real-time document analysis, speech-to-text, and conversational context extraction using OpenAI & Deepgram with zero data retention.
          </p>
          <div className="pt-1">
            <a
              href="https://github.com/Astroash2001/ai-summarizer-pro"
              target="_blank"
              rel="noreferrer"
              className="btn-retro-secondary px-3 py-1.5 text-xs inline-flex items-center gap-1.5"
            >
              <Github className="w-3.5 h-3.5" />
              <span>GITHUB REPOSITORY</span>
            </a>
          </div>
        </div>

        {/* Capabilities Column */}
        <div>
          <div className="font-bold uppercase tracking-wider text-xs text-[#555555] mb-2 border-b border-[#1C1C1C] pb-1">
            CAPABILITIES:
          </div>
          <ul className="space-y-1.5 text-sm font-vt323">
            {footerLinks.capabilities.map((link, idx) => (
              <li key={idx}>
                <Link to={link.path} className="underline hover:bg-[#1C1C1C] hover:text-[#E3DFCE]">
                  /{link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Authentic Stack Column */}
        <div>
          <div className="font-bold uppercase tracking-wider text-xs text-[#555555] mb-2 border-b border-[#1C1C1C] pb-1">
            AUTHENTIC STACK:
          </div>
          <ul className="space-y-1.5 text-sm font-vt323">
            {footerLinks.authenticStack.map((link, idx) => (
              <li key={idx}>
                <a
                  href={link.path}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:bg-[#1C1C1C] hover:text-[#E3DFCE]"
                >
                  /{link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Protocols Column */}
        <div>
          <div className="font-bold uppercase tracking-wider text-xs text-[#555555] mb-2 border-b border-[#1C1C1C] pb-1">
            SECURITY & PROTOCOLS:
          </div>
          <ul className="space-y-1.5 text-sm font-vt323">
            {footerLinks.protocols.map((link, idx) => (
              <li key={idx}>
                {link.external ? (
                  <a
                    href={link.path}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:bg-[#1C1C1C] hover:text-[#E3DFCE]"
                  >
                    /{link.label}
                  </a>
                ) : (
                  <span className="text-[#333333]">/{link.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="pt-3 flex flex-col sm:flex-row items-center justify-between text-xs text-[#555555] gap-2 font-mono">
        <div>*UNITED AI SYSTEM (C) {new Date().getFullYear()} ALL RIGHTS RESERVED.</div>
        <div>
          <a
            href="https://github.com/Astroash2001/ai-summarizer-pro"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-[#1C1C1C]"
          >
            GITHUB SOURCE REPOSITORY
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
