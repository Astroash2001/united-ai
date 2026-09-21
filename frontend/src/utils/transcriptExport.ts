/**
 * Transcript export formats: SRT and VTT subtitles, Markdown, and Word (DOCX).
 * PDF export lives in pdfExport.ts.
 */
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

export interface TimedLine {
  start: number; // seconds
  end: number; // seconds
  text: string;
}

export interface TranscriptExportData {
  title: string;
  transcript: string;
  summary?: string;
}

const TIMED_LINE_RE = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/;
// Fallback cue length when a line has no following timestamp.
const LAST_CUE_SECONDS = 4;

export function timestampToSeconds(timestamp: string): number {
  return timestamp.split(":").reduce((total, part) => total * 60 + Number(part), 0);
}

/**
 * Parse "[mm:ss] text" lines. Each line ends where the next one starts.
 * Lines without a timestamp are appended to the previous line.
 */
export function parseTimedLines(transcript: string): TimedLine[] {
  const lines: TimedLine[] = [];
  for (const rawLine of transcript.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(TIMED_LINE_RE);
    if (match) {
      lines.push({ start: timestampToSeconds(match[1]), end: 0, text: match[2].trim() });
    } else if (lines.length > 0) {
      lines[lines.length - 1].text += ` ${line}`;
    }
  }
  lines.forEach((line, index) => {
    const next = lines[index + 1];
    line.end = next && next.start > line.start ? next.start : line.start + LAST_CUE_SECONDS;
  });
  return lines.filter((line) => line.text);
}

export function hasTimestamps(transcript: string): boolean {
  return parseTimedLines(transcript).length > 0;
}

function formatCueTime(seconds: number, separator: "," | "."): string {
  const totalMs = Math.round(seconds * 1000);
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${separator}${pad(ms, 3)}`;
}

export function toSrt(transcript: string): string {
  return parseTimedLines(transcript)
    .map((line, index) => `${index + 1}\n${formatCueTime(line.start, ",")} --> ${formatCueTime(line.end, ",")}\n${line.text}\n`)
    .join("\n");
}

export function toVtt(transcript: string): string {
  const cues = parseTimedLines(transcript)
    .map((line) => `${formatCueTime(line.start, ".")} --> ${formatCueTime(line.end, ".")}\n${line.text}\n`)
    .join("\n");
  return `WEBVTT\n\n${cues}`;
}

export function toMarkdown({ title, transcript, summary }: TranscriptExportData): string {
  const parts = [`# ${title}`, `_Exported ${new Date().toLocaleString()}_`];
  if (summary) parts.push(`## Summary\n\n${summary}`);
  parts.push(`## Transcript\n\n${transcript}`);
  return parts.join("\n\n") + "\n";
}

export async function toDocx({ title, transcript, summary }: TranscriptExportData): Promise<Blob> {
  const paragraphs = (text: string) =>
    text.split("\n").map((line) => new Paragraph({ children: [new TextRun(line)] }));

  const children = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
    new Paragraph({ children: [new TextRun({ text: `Exported ${new Date().toLocaleString()}`, italics: true })] }),
  ];
  if (summary) {
    children.push(new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_1 }), ...paragraphs(summary));
  }
  children.push(new Paragraph({ text: "Transcript", heading: HeadingLevel.HEADING_1 }), ...paragraphs(transcript));

  return Packer.toBlob(new Document({ sections: [{ children }] }));
}

export function downloadFile(content: Blob | string, filename: string, mimeType = "text/plain;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type: mimeType }) : content;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
