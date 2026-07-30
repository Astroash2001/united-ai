import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Play, Pause, Volume2, VolumeX, Download } from "lucide-react";

interface RetroAudioPlayerProps {
  src: string;
  downloadFileName?: string;
  className?: string;
}

const RetroAudioPlayer = forwardRef<HTMLAudioElement, RetroAudioPlayerProps>(({ src, downloadFileName, className = "" }, ref) => {
  const localAudioRef = useRef<HTMLAudioElement | null>(null);

  useImperativeHandle(ref, () => localAudioRef.current as HTMLAudioElement);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const audio = localAudioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("durationchange", updateDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("durationchange", updateDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = localAudioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(console.error);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    if (localAudioRef.current) {
      localAudioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const toggleMute = () => {
    if (!localAudioRef.current) return;
    const nextMute = !isMuted;
    localAudioRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (localAudioRef.current) {
      localAudioRef.current.volume = val;
      localAudioRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return "00:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`p-2.5 border border-[#1C1C1C] bg-[#1C1C1C] text-[#E3DFCE] font-mono text-xs ${className}`}>
      <audio ref={localAudioRef} src={src} preload="metadata" />
      
      <div className="flex items-center justify-between gap-2.5 flex-nowrap w-full">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="btn-retro-secondary px-2.5 py-1 flex items-center gap-1 text-xs font-bold bg-[#E3DFCE] text-[#1C1C1C] hover:bg-[#0000FF] hover:text-[#FFFFFF] transition-colors shrink-0"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>[ PAUSE ]</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>[ PLAY ]</span>
            </>
          )}
        </button>

        {/* Time Counter */}
        <div className="text-[11px] font-mono font-bold tracking-wider text-[#E3DFCE] shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Custom Brutalist Seek Bar */}
        <div className="flex-1 min-w-[80px] flex items-center">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 accent-[#0000FF] bg-[#333333] rounded-none border border-[#E3DFCE] cursor-pointer"
          />
        </div>

        {/* Mute & Volume */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={toggleMute}
            className="p-1 text-[#E3DFCE] hover:text-[#0000FF] transition-colors"
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-12 sm:w-16 h-1.5 accent-[#0000FF] bg-[#333333] rounded-none cursor-pointer"
          />
        </div>

        {/* Clean Retro Download Icon Button */}
        <a
          href={src}
          download={downloadFileName || `voice_recording_${Date.now()}.webm`}
          className="p-1.5 border border-[#E3DFCE] bg-[#E3DFCE] text-[#1C1C1C] hover:bg-[#0000FF] hover:text-[#FFFFFF] transition-colors flex items-center justify-center shrink-0"
          title="Download Recording Audio File"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
});

RetroAudioPlayer.displayName = "RetroAudioPlayer";

export default RetroAudioPlayer;
