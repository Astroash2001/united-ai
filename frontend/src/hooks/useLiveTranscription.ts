import { useCallback, useEffect, useRef, useState } from "react";
import { getDeepgramToken, transcribeAudio } from "@/services/transcription-api";
import {
  appendPlainText,
  appendTimedWords,
  DeepgramWord,
  renderTranscript,
  TranscriptLine,
} from "@/utils/liveTranscript";

/** Dropdown value: "en-IN" = Hindi + English, "hi-IN" = Hindi only, "en-US" = English only. */
export type MicLanguage = "en-IN" | "hi-IN" | "en-US";
export type LiveEngine = "deepgram" | "browser" | null;

// Minimal Web Speech API types (not in TypeScript's DOM library).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface DeepgramResultMessage {
  type: string;
  is_final?: boolean;
  channel?: { alternatives?: { transcript: string; words?: DeepgramWord[] }[] };
}

// Deepgram model settings per dropdown option. "multi" transcribes code-switched
// Hindi + English, writing each word in its own script (Devanagari / Latin).
const DEEPGRAM_LANGUAGE: Record<MicLanguage, string> = {
  "en-IN": "multi",
  "hi-IN": "hi",
  "en-US": "en",
};

/** Stop a recognizer or socket that may already be stopped. */
function stopQuietly(stop: () => void) {
  try {
    stop();
  } catch {
    // Already stopped or never started.
  }
}

/**
 * Live microphone transcription.
 *
 * Primary engine: Deepgram nova-3 streaming (Hindi + English code-switching,
 * speaker labels, word timestamps). Fallback: the browser's Web Speech API
 * (one language, no timestamps). Finalized text is never rewritten.
 */
export function useLiveTranscription(language: MicLanguage) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [engine, setEngine] = useState<LiveEngine>(null);
  const [error, setError] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const socketReadyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordedUrlRef = useRef<string | null>(null);

  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  const linesRef = useRef<TranscriptLine[]>([]);
  const lastWordEndRef = useRef<number | null>(null);
  const transcriptRef = useRef("");

  const show = useCallback((interimText: string) => {
    const text = renderTranscript(linesRef.current, interimText);
    transcriptRef.current = text;
    setTranscript(text);
  }, []);

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
  };

  const startTimer = () => {
    timerRef.current = setInterval(() => setRecordingTime((prev) => prev + 1), 1000);
  };

  // Release everything if the page unmounts mid-recording.
  useEffect(() => {
    return () => {
      clearTimers();
      if (recognitionRef.current) stopQuietly(() => recognitionRef.current?.stop());
      if (socketRef.current) stopQuietly(() => socketRef.current?.close());
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    };
  }, []);

  const startWebSpeech = useCallback(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setEngine(null);
      return;
    }

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = language;

    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          linesRef.current = appendPlainText(linesRef.current, result[0].transcript);
        } else {
          interimText += `${result[0].transcript} `;
        }
      }
      show(interimText);
    };

    // The browser ends recognition after silence; restart while still recording.
    recognition.onend = () => {
      if (isRecordingRef.current && !isPausedRef.current) {
        stopQuietly(() => recognition.start());
      }
    };

    setEngine("browser");
    stopQuietly(() => recognition.start());
  }, [language, show]);

  const startDeepgram = useCallback(async (): Promise<boolean> => {
    let token: string;
    try {
      token = await getDeepgramToken();
    } catch (err) {
      console.warn("Deepgram unavailable, falling back to browser speech engine:", err);
      return false;
    }

    const params = new URLSearchParams({
      model: "nova-3",
      language: DEEPGRAM_LANGUAGE[language],
      interim_results: "true",
      smart_format: "true",
      punctuate: "true",
      endpointing: "100",
      diarize: "true",
    });

    return new Promise((resolve) => {
      const socket = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ["bearer", token]);
      socketRef.current = socket;
      let opened = false;

      socket.onopen = () => {
        opened = true;
        if (!isRecordingRef.current) {
          // Recording was stopped while the socket was still connecting.
          socket.close();
          resolve(true);
          return;
        }
        socketReadyRef.current = true;
        // Send audio captured while connecting (includes the WebM header).
        audioChunksRef.current.forEach((chunk) => socket.send(chunk));
        setEngine("deepgram");
        resolve(true);
      };

      socket.onmessage = (message) => {
        const data: DeepgramResultMessage = JSON.parse(message.data);
        if (data.type !== "Results") return;
        const alternative = data.channel?.alternatives?.[0];
        if (!alternative) return;
        if (data.is_final) {
          const appended = appendTimedWords(linesRef.current, alternative.words ?? [], lastWordEndRef.current);
          linesRef.current = appended.lines;
          lastWordEndRef.current = appended.lastEnd;
          show("");
        } else {
          show(alternative.transcript);
        }
      };

      socket.onerror = () => {
        if (!opened) resolve(false);
      };

      socket.onclose = () => {
        socketReadyRef.current = false;
        if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        if (!opened) {
          resolve(false);
          return;
        }
        // Connection dropped mid-recording: continue with the browser engine.
        if (isRecordingRef.current && socketRef.current === socket) {
          socketRef.current = null;
          show("");
          startWebSpeech();
        }
      };
    });
  }, [language, show, startWebSpeech]);

  const finishRecording = useCallback(async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
    if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    recordedUrlRef.current = URL.createObjectURL(audioBlob);
    setRecordedAudioUrl(recordedUrlRef.current);

    // Let Deepgram flush its last words, then close.
    const socket = socketRef.current;
    socketRef.current = null;
    if (socket && socket.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          socket.close();
          resolve();
        }, 3000);
        socket.addEventListener("close", () => {
          clearTimeout(timeout);
          resolve();
        });
        socket.send(JSON.stringify({ type: "CloseStream" }));
      });
    }
    show("");

    // Full-file transcription only when no live engine produced text, so it never
    // overwrites the live transcript the user already saw.
    if (!transcriptRef.current && audioChunksRef.current.length > 0) {
      setIsFinalizing(true);
      try {
        const file = new File([audioBlob], `voice_rec_${Date.now()}.webm`, { type: "audio/webm" });
        const data = await transcribeAudio(file, { summarize: false });
        if (data.transcript?.trim()) {
          transcriptRef.current = data.transcript;
          setTranscript(data.transcript);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transcription failed.");
      } finally {
        setIsFinalizing(false);
      }
    }
  }, [show]);

  const start = useCallback(async () => {
    setError("");
    setTranscript("");
    setEngine(null);
    transcriptRef.current = "";
    linesRef.current = [];
    lastWordEndRef.current = null;
    socketReadyRef.current = false;
    recognitionRef.current = null;
    audioChunksRef.current = [];
    if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    recordedUrlRef.current = null;
    setRecordedAudioUrl(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setMediaStream(stream);

      // MediaRecorder keeps the audio for playback and streams chunks to Deepgram.
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size === 0) return;
        audioChunksRef.current.push(event.data);
        const socket = socketRef.current;
        if (socketReadyRef.current && socket?.readyState === WebSocket.OPEN) {
          socket.send(event.data);
        }
      };
      recorder.onstop = () => {
        finishRecording();
      };
      recorder.start(250);

      isRecordingRef.current = true;
      isPausedRef.current = false;
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      startTimer();

      const deepgramStarted = await startDeepgram();
      if (!deepgramStarted && isRecordingRef.current) {
        socketRef.current = null;
        startWebSpeech();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone permission denied or device unavailable.");
    }
  }, [finishRecording, startDeepgram, startWebSpeech]);

  const pause = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecordingRef.current || isPausedRef.current) return;
    isPausedRef.current = true;
    mediaRecorderRef.current.pause();
    if (recognitionRef.current) stopQuietly(() => recognitionRef.current?.stop());
    // Deepgram closes idle streams after ~10s without audio.
    const socket = socketRef.current;
    if (socket) {
      keepAliveRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "KeepAlive" }));
      }, 5000);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecordingRef.current || !isPausedRef.current) return;
    isPausedRef.current = false;
    mediaRecorderRef.current.resume();
    if (keepAliveRef.current) clearInterval(keepAliveRef.current);
    if (recognitionRef.current) stopQuietly(() => recognitionRef.current?.start());
    startTimer();
    setIsPaused(false);
  }, []);

  const stop = useCallback(() => {
    if (!mediaRecorderRef.current || !isRecordingRef.current) return;
    isRecordingRef.current = false;
    if (recognitionRef.current) stopQuietly(() => recognitionRef.current?.stop());
    clearTimers();
    mediaRecorderRef.current.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  /** Replace the transcript text, e.g. with an AI-corrected version. */
  const replaceTranscript = useCallback((text: string) => {
    transcriptRef.current = text;
    setTranscript(text);
  }, []);

  const reset = useCallback(() => {
    if (recordedUrlRef.current) URL.revokeObjectURL(recordedUrlRef.current);
    recordedUrlRef.current = null;
    setRecordedAudioUrl(null);
    setTranscript("");
    setRecordingTime(0);
    setError("");
    setEngine(null);
    transcriptRef.current = "";
    linesRef.current = [];
  }, []);

  return {
    isRecording,
    isPaused,
    recordingTime,
    transcript,
    recordedAudioUrl,
    mediaStream,
    isFinalizing,
    engine,
    error,
    start,
    pause,
    resume,
    stop,
    reset,
    replaceTranscript,
  };
}
