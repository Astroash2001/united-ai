import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, Trash2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChapterFlags from "@/components/ChapterFlags";
import TranscriptPanel from "@/components/TranscriptPanel";
import {
  deleteHistory,
  getHistory,
  HISTORY_KIND_LABELS,
  HistoryEntry,
  HistoryListItem,
  listHistory,
} from "@/services/history-api";
import { getYouTubeVideoId } from "@/services/transcription-api";

const formatDate = (iso: string) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

const History = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState<HistoryListItem[]>([]);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingEntry, setIsLoadingEntry] = useState(false);
  const [error, setError] = useState("");
  const [youtubeStart, setYoutubeStart] = useState(0);

  const selectedId = Number(searchParams.get("id")) || null;

  useEffect(() => {
    listHistory()
      .then(setEntries)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load history"))
      .finally(() => setIsLoadingList(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    setIsLoadingEntry(true);
    setYoutubeStart(0);
    getHistory(selectedId)
      .then(setSelected)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load entry"))
      .finally(() => setIsLoadingEntry(false));
  }, [selectedId]);

  const handleDelete = async (id: number) => {
    setError("");
    try {
      await deleteHistory(id);
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
      if (selectedId === id) setSearchParams({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry");
    }
  };

  const youtubeId = selected?.kind === "youtube" ? getYouTubeVideoId(selected.source_url) : null;

  return (
    <div className="retro-frame p-3 sm:p-4 min-h-[90vh]">
      <Header />

      <main className="py-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="retro-panel p-3 text-center border-b-[3px] border-[#1C1C1C]">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#1C1C1C]">
              [ SAVED HISTORY // TRANSCRIPTS, SUMMARIES & CHATS ]
            </div>
            <p className="text-xs font-vt323 mt-1 text-[#555555]">
              *Saved on this server for this browser only. Clearing browser data loses access to this list.
            </p>
          </div>

          {error && (
            <div className="border border-[#1C1C1C] bg-[#FF2200] text-white p-3 text-xs font-mono">*ERROR: {error}</div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Entry list */}
            <div className="lg:col-span-4 retro-panel p-3 space-y-2 max-h-[75vh] overflow-y-auto">
              {isLoadingList ? (
                <div className="flex items-center gap-2 font-mono text-xs p-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading history...
                </div>
              ) : entries.length === 0 ? (
                <div className="font-vt323 text-sm text-[#555555] p-2">
                  *Nothing saved yet. Summaries, transcripts, and chats are saved here automatically.
                </div>
              ) : (
                entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`border border-[#1C1C1C] p-2 font-mono text-xs ${
                      entry.id === selectedId ? "bg-[#1C1C1C] text-[#E3DFCE]" : "bg-[#E3DFCE] hover:bg-[#D4D0BD]"
                    }`}
                  >
                    <button onClick={() => setSearchParams({ id: String(entry.id) })} className="block w-full text-left">
                      <div className="text-[10px] font-bold opacity-70">
                        [{HISTORY_KIND_LABELS[entry.kind]}] {formatDate(entry.updated_at)}
                      </div>
                      <div className="font-bold truncate">{entry.title}</div>
                      <div className="opacity-70 line-clamp-2">{entry.preview}</div>
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="mt-1 flex items-center gap-1 text-[10px] font-bold hover:text-red-500"
                      aria-label={`Delete ${entry.title}`}
                    >
                      <Trash2 className="w-3 h-3" /> DELETE
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Entry detail */}
            <div className="lg:col-span-8 space-y-4">
              {isLoadingEntry ? (
                <div className="retro-panel p-4 flex items-center gap-2 font-mono text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading entry...
                </div>
              ) : !selected ? (
                <div className="retro-panel p-6 text-center font-vt323 text-sm text-[#555555]">
                  *Select an entry to view it.
                </div>
              ) : (
                <>
                  <div className="retro-panel p-4 font-mono text-xs space-y-1">
                    <div className="font-bold text-sm">{selected.title}</div>
                    <div className="text-[#555555]">
                      [{HISTORY_KIND_LABELS[selected.kind]}] SAVED {formatDate(selected.created_at)}
                    </div>
                    {selected.source_url && (
                      <a href={selected.source_url} target="_blank" rel="noreferrer" className="underline break-all">
                        {selected.source_url}
                      </a>
                    )}
                    {selected.kind === "chat" && (
                      <div className="pt-2">
                        <Link to={`/chat-with-document?history=${selected.id}`} className="btn-retro-primary px-3 py-1 text-xs inline-block">
                          [ CONTINUE THIS CHAT ]
                        </Link>
                      </div>
                    )}
                  </div>

                  {youtubeId && (
                    <div className="retro-panel p-2">
                      <iframe
                        key={youtubeStart}
                        className="w-full aspect-video border border-[#1C1C1C]"
                        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?start=${youtubeStart}${youtubeStart ? "&autoplay=1" : ""}`}
                        title={selected.title}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {selected.summary && (
                    <div className="retro-panel p-4">
                      <div className="text-xs font-mono font-bold mb-2 pb-1 border-b border-[#1C1C1C]">SUMMARY.TXT:</div>
                      <div className="border border-[#1C1C1C] bg-[#FFFFFF] p-3 text-xs sm:text-sm font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                        {selected.summary}
                      </div>
                    </div>
                  )}

                  {selected.summary && (
                    <ChapterFlags
                      summaryText={selected.summary}
                      chapters={selected.chapters}
                      onSeek={youtubeId ? setYoutubeStart : undefined}
                    />
                  )}

                  {selected.messages.length > 0 && (
                    <div className="retro-panel p-4 space-y-2">
                      <div className="text-xs font-mono font-bold pb-1 border-b border-[#1C1C1C]">CHAT_LOG.TXT:</div>
                      {selected.messages.map((message, index) => (
                        <div
                          key={index}
                          className={`border border-[#1C1C1C] p-2 text-xs font-mono whitespace-pre-wrap ${
                            message.role === "user" ? "bg-[#1C1C1C] text-[#E3DFCE] ml-8" : "bg-[#FFFFFF] mr-8"
                          }`}
                        >
                          {message.content}
                        </div>
                      ))}
                    </div>
                  )}

                  {selected.transcript && selected.kind !== "chat" && selected.kind !== "document" && (
                    <TranscriptPanel
                      label="TRANSCRIPT.TXT:"
                      exportTitle={selected.title}
                      fileBaseName={`united_ai_${selected.kind}_${selected.id}`}
                      transcript={selected.transcript}
                      summary={selected.summary}
                      onSeek={youtubeId ? setYoutubeStart : undefined}
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default History;
