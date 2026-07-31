import React, { useRef, useEffect } from "react";

interface VoiceVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
  isPaused: boolean;
  className?: string;
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  stream,
  isRecording,
  isPaused,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!stream || !isRecording || isPaused) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const render = () => {
        analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background surface
        ctx.fillStyle = "#0B0B0C";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * (canvas.height * 0.8) + 4;

          // Retro High-contrast styling
          const isHighVolume = dataArray[i] > 120;
          ctx.fillStyle = isHighVolume ? "#FF2200" : "#E3DFCE";

          const y = (canvas.height - barHeight) / 2;

          ctx.fillRect(x, y, barWidth - 2, barHeight);
          x += barWidth;
        }

        animationFrameRef.current = requestAnimationFrame(render);
      };

      render();
    } catch (e) {
      console.warn("Web Audio Visualizer notice:", e);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (sourceRef.current) {
        try { sourceRef.current.disconnect(); } catch (e) {}
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        try { audioCtxRef.current.close(); } catch (e) {}
      }
    };
  }, [stream, isRecording, isPaused]);

  return (
    <div className={`w-full border border-[#1C1C1C] bg-[#0B0B0C] p-2 relative overflow-hidden ${className}`}>
      <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A5A7AD] mb-1 flex justify-between">
        <span>[ LIVE VOICE AUDIO FREQUENCY VISUALIZER ]</span>
        <span>{isRecording && !isPaused ? "MIC: ACTIVE" : "MIC: IDLE"}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={60}
        className="w-full h-16 block bg-[#0B0B0C]"
      />
    </div>
  );
};

export default VoiceVisualizer;
