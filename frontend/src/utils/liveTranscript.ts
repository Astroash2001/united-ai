/**
 * Builds the live-recording transcript from finalized speech results.
 *
 * Deepgram words carry start/end times and (with diarization) a speaker number,
 * so the transcript is grouped into "[mm:ss] [Speaker N] text" lines that can
 * be clicked to seek the recording. Browser (Web Speech) results have no times
 * and become plain lines.
 */

export interface TranscriptLine {
  /** Start time in seconds from the beginning of the recording; null when unknown. */
  start: number | null;
  /** Zero-based speaker number from diarization; null when unknown. */
  speaker: number | null;
  text: string;
}

export interface DeepgramWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  speaker?: number;
}

/** Silence longer than this starts a new timestamped line. */
const PAUSE_GAP_SECONDS = 2;
/** A line this long is closed at the next sentence end. */
const LONG_LINE_CHARS = 280;
const SENTENCE_END = /[.!?।]$/;

export function formatClock(seconds: number): string {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
}

export interface TimedAppendResult {
  lines: TranscriptLine[];
  /** End time of the last word added; pass it to the next call. */
  lastEnd: number | null;
}

/**
 * Add finalized Deepgram words. Returns new lines; the input is not modified.
 * lastEnd is the end time of the previously added word (null at the start).
 */
export function appendTimedWords(
  lines: TranscriptLine[],
  words: DeepgramWord[],
  lastEnd: number | null,
): TimedAppendResult {
  const result = lines.map((line) => ({ ...line }));

  for (const word of words) {
    const text = word.punctuated_word || word.word;
    if (!text) continue;
    const speaker = word.speaker ?? null;
    const current = result[result.length - 1];

    const startNewLine =
      !current ||
      current.start === null ||
      (speaker !== null && current.speaker !== null && speaker !== current.speaker) ||
      (lastEnd !== null && word.start - lastEnd > PAUSE_GAP_SECONDS) ||
      (current.text.length >= LONG_LINE_CHARS && SENTENCE_END.test(current.text));

    if (startNewLine) {
      result.push({ start: word.start, speaker, text });
    } else {
      current.text = `${current.text} ${text}`;
      if (current.speaker === null) current.speaker = speaker;
    }
    lastEnd = word.end;
  }

  return { lines: result, lastEnd };
}

/** Add a finalized phrase without timing (browser speech engine). */
export function appendPlainText(lines: TranscriptLine[], text: string): TranscriptLine[] {
  const trimmed = text.trim();
  if (!trimmed) return lines;
  const result = lines.map((line) => ({ ...line }));
  const current = result[result.length - 1];
  if (current && current.start === null) {
    current.text = `${current.text} ${trimmed}`;
  } else {
    result.push({ start: null, speaker: null, text: trimmed });
  }
  return result;
}

/**
 * Render lines as transcript text. Speaker labels appear only once more than
 * one speaker has been heard. Interim (not yet final) words go at the end.
 */
export function renderTranscript(lines: TranscriptLine[], interimText = ""): string {
  const speakers = new Set(lines.map((line) => line.speaker).filter((speaker) => speaker !== null));
  const showSpeakers = speakers.size > 1;

  const rendered = lines.map((line) => {
    const time = line.start !== null ? `[${formatClock(line.start)}] ` : "";
    const who = showSpeakers && line.speaker !== null ? `[Speaker ${line.speaker + 1}] ` : "";
    return `${time}${who}${line.text}`;
  });

  const interim = interimText.trim();
  if (interim) {
    if (rendered.length > 0) {
      rendered[rendered.length - 1] += ` ${interim}`;
    } else {
      rendered.push(interim);
    }
  }
  return rendered.join("\n");
}
