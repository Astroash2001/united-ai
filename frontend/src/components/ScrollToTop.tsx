import React, { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";

export const ScrollToTop: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className="fixed bottom-4 left-4 z-40 flex items-center gap-1.5 border-[2px] border-[#1C1C1C] bg-[#1C1C1C] text-[#E3DFCE] px-3 py-2 shadow-[4px_4px_0px_#1C1C1C] hover:bg-[#0000FF] hover:text-white hover:-translate-y-0.5 hover:-translate-x-0.5 transition-all text-xs font-mono font-bold uppercase"
      title="Scroll to top"
    >
      <ArrowUp className="w-3.5 h-3.5" />
      <span>[ TOP ]</span>
    </button>
  );
};
