import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Terminal, FileText, Mic, Video, MessageSquare } from "lucide-react";

const Header = () => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: "ABOUT", path: "/", icon: FileText },
    { label: "AUDIO", path: "/audio", icon: Mic },
    { label: "VIDEO", path: "/video", icon: Video },
    { label: "CHAT", path: "/chat-with-document", icon: MessageSquare },
  ];

  return (
    <header className="retro-panel border-b-2 border-[#1C1C1C] text-[#1C1C1C] sticky top-0 z-50 mb-4">
      <div className="flex items-center justify-between px-3 py-2 text-xs font-mono">
        {/* Left Side: Pixel Logo Icon & Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Retro Pixel Icon Box */}
          <Link to="/" className="border border-[#1C1C1C] bg-[#E3DFCE] px-2 py-1 flex items-center gap-1 hover:bg-[#1C1C1C] hover:text-[#E3DFCE] transition-colors shrink-0">
            <span className="font-pixel text-[10px] tracking-tighter">×+×<br />+×+</span>
          </Link>

          {/* Nav Tabs */}
          <nav className="flex items-center gap-1 shrink-0">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1 text-[11px] font-bold tracking-wider border transition-colors ${
                    isActive
                      ? "bg-[#1C1C1C] text-[#E3DFCE] border-[#1C1C1C]"
                      : "bg-[#DFDBCB] text-[#1C1C1C] border-[#1C1C1C] hover:bg-[#1C1C1C] hover:text-[#E3DFCE]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden sm:flex items-center gap-3 font-mono text-xs uppercase tracking-wider shrink-0">
          <span className="text-[#555555] font-bold">UNITED_AI.TXT</span>
          <a
            href="https://github.com/Astroash2001/ai-summarizer-pro"
            target="_blank"
            rel="noreferrer"
            className="w-6 h-6 border border-[#1C1C1C] bg-[#E3DFCE] hover:bg-[#1C1C1C] hover:text-[#E3DFCE] flex items-center justify-center text-xs transition-colors"
            title="GitHub Repository"
          >
            ⚙
          </a>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="sm:hidden border border-[#1C1C1C] bg-[#E3DFCE] px-2 py-1 text-xs"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="sm:hidden border-t border-[#1C1C1C] bg-[#E3DFCE] p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`block px-3 py-1.5 text-xs font-bold border ${
                location.pathname === item.path
                  ? "bg-[#1C1C1C] text-[#E3DFCE]"
                  : "bg-[#DFDBCB] text-[#1C1C1C]"
              }`}
            >
              * {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
};

export default Header;
