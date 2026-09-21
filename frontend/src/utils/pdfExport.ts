/**
 * PDF export for transcripts and summaries, including Hindi.
 *
 * Built-in PDF fonts cannot draw Devanagari, so Hindi runs are drawn with an
 * embedded Noto Sans Devanagari font. fontkit shapes those runs (conjuncts,
 * vowel-sign order); everything else uses the built-in Courier font.
 */
// fontkit's Indic shaper uses generator functions compiled for regenerator-runtime.
import "regenerator-runtime/runtime.js";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";
import { downloadFile } from "./transcriptExport";

export interface PDFExportData {
  title?: string;
  transcript: string;
  summary?: string;
  timestamp?: string;
  filename?: string;
}

interface FontPair {
  latin: PDFFont;
  hindi: PDFFont | null;
}

interface Run {
  text: string;
  hindi: boolean;
}

const HAS_DEVANAGARI = /[ऀ-ॿ]/;

/** Devanagari block, Devanagari Extended, and zero-width (non-)joiners used inside Hindi words. */
function isDevanagariChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return (code >= 0x0900 && code <= 0x097f) || (code >= 0xa8e0 && code <= 0xa8ff) || code === 0x200c || code === 0x200d;
}
// Characters outside Latin-1 that the built-in (WinAnsi) fonts can still draw.
const WINANSI_EXTRA = new Set("–—‘’‚“”„•…€™ŠšŒœŽžŸƒˆ˜†‡‰‹›");

const MM = 72 / 25.4;
const PAGE_WIDTH = 210 * MM;
const PAGE_HEIGHT = 297 * MM;
const MARGIN = 15 * MM;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TOP = 20 * MM;
const BOTTOM_LIMIT = 270 * MM;

const DARK = rgb(28 / 255, 28 / 255, 28 / 255);
const PARCHMENT = rgb(227 / 255, 223 / 255, 206 / 255);
const PANEL = rgb(223 / 255, 219 / 255, 203 / 255);
const GREY = rgb(100 / 255, 100 / 255, 100 / 255);

/** Replace characters the built-in font cannot draw (e.g. emoji); drop them when nothing fits. */
function toWinAnsi(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (char === "\t") out += "    ";
    else if (code >= 0x20 && code <= 0xff && code !== 0x7f) out += char;
    else if (WINANSI_EXTRA.has(char)) out += char;
  }
  return out;
}

/** Split text into alternating Hindi / non-Hindi runs. */
export function splitScriptRuns(text: string): Run[] {
  const runs: Run[] = [];
  for (const char of text) {
    const hindi = isDevanagariChar(char);
    const last = runs[runs.length - 1];
    if (last && last.hindi === hindi) last.text += char;
    else runs.push({ text: char, hindi });
  }
  return runs;
}

/** Light Markdown cleanup for summaries: headings become bold lines, emphasis markers are removed. */
function parseSummaryLine(line: string): { text: string; bold: boolean } {
  const heading = line.match(/^\s*#{1,6}\s+(.*)$/);
  const text = (heading ? heading[1] : line).replace(/\*\*|__/g, "");
  return { text, bold: Boolean(heading) };
}

class PdfWriter {
  private page: PDFPage;
  private y: number;

  constructor(
    private doc: PDFDocument,
    private regular: FontPair,
    private bold: FontPair,
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = TOP;
  }

  private runs(text: string, fonts: FontPair) {
    return splitScriptRuns(text)
      .map((run) => {
        const font = run.hindi && fonts.hindi ? fonts.hindi : fonts.latin;
        const value = font === fonts.latin ? toWinAnsi(run.text) : run.text;
        return { text: value, font };
      })
      .filter((run) => run.text);
  }

  // Shaping Hindi is slow, so each word's width is measured once and reused.
  private widthCache = new Map<string, number>();

  private width(text: string, fonts: FontPair, size: number): number {
    const key = `${fonts === this.bold ? "b" : "r"}|${size}|${text}`;
    let width = this.widthCache.get(key);
    if (width === undefined) {
      width = this.runs(text, fonts).reduce((total, run) => total + run.font.widthOfTextAtSize(run.text, size), 0);
      this.widthCache.set(key, width);
    }
    return width;
  }

  /** Draw one line of mixed-script text; y is measured from the top of the page. */
  private drawLine(text: string, x: number, y: number, fonts: FontPair, size: number, color = DARK) {
    let cursor = x;
    for (const run of this.runs(text, fonts)) {
      this.page.drawText(run.text, { x: cursor, y: PAGE_HEIGHT - y, size, font: run.font, color });
      cursor += run.font.widthOfTextAtSize(run.text, size);
    }
  }

  /** Break text into lines that fit the content width, keeping words whole where possible. */
  private wrap(text: string, fonts: FontPair, size: number): string[] {
    const lines: string[] = [];
    let current = "";
    let currentWidth = 0;
    // Words and the spaces between them; line width is the sum of their widths.
    for (const token of text.split(/(\s+)/)) {
      if (!token) continue;
      const tokenWidth = this.width(token, fonts, size);
      if (currentWidth + tokenWidth <= CONTENT_WIDTH) {
        current += token;
        currentWidth += tokenWidth;
        continue;
      }
      if (current.trim()) lines.push(current.trimEnd());
      if (!token.trim()) {
        current = "";
        currentWidth = 0;
        continue;
      }
      current = token;
      currentWidth = tokenWidth;
      // A single word wider than the page (e.g. a long link) is split between
      // characters, keeping vowel signs and other combining marks on their letter.
      while (currentWidth > CONTENT_WIDTH) {
        const graphemes = current.match(/\P{M}\p{M}*/gu) ?? [current];
        let piece = "";
        for (const grapheme of graphemes) {
          if (piece && this.width(piece + grapheme, fonts, size) > CONTENT_WIDTH) break;
          piece += grapheme;
        }
        lines.push(piece);
        current = current.slice(piece.length);
        currentWidth = this.width(current, fonts, size);
      }
    }
    if (current.trim()) lines.push(current.trimEnd());
    return lines.length ? lines : [""];
  }

  private ensureSpace(height: number) {
    if (this.y + height > BOTTOM_LIMIT) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = TOP;
    }
  }

  banner(text: string, height: number, fill = DARK, color = PARCHMENT, size = 10) {
    this.ensureSpace(height + 6);
    this.page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - this.y - height, width: CONTENT_WIDTH, height, color: fill });
    this.drawLine(text, MARGIN + 4 * MM, this.y + height / 2 + size * 0.35, this.bold, size, color);
    this.y += height;
  }

  rule() {
    this.page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - this.y },
      thickness: 1.4,
      color: DARK,
    });
  }

  gap(mm: number) {
    this.y += mm * MM;
  }

  paragraph(text: string, size: number, { bold = false, lineHeight = 5 * MM } = {}) {
    const fonts = bold ? this.bold : this.regular;
    for (const line of this.wrap(text, fonts, size)) {
      this.ensureSpace(lineHeight);
      this.y += lineHeight;
      this.drawLine(line, MARGIN, this.y, fonts, size);
    }
  }

  footers() {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      page.drawText(toWinAnsi(`UNITE AI SYSTEM (C) ${new Date().getFullYear()} — Page ${index + 1} of ${pages.length}`), {
        x: MARGIN,
        y: PAGE_HEIGHT - 287 * MM,
        size: 8,
        font: this.regular.latin,
        color: GREY,
      });
    });
  }
}

async function loadFont(doc: PDFDocument, url: string): Promise<PDFFont> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load the Hindi font for PDF export.");
  return doc.embedFont(await response.arrayBuffer(), { subset: true });
}

/** Build the transcript PDF and return its bytes. */
export async function buildTranscriptPdf({
  title = "UNITE AI — VERBATIM AUDIO SPEECH TRANSCRIPT",
  transcript,
  summary,
  timestamp = new Date().toLocaleString(),
}: PDFExportData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(title);

  // Hindi fonts are downloaded only when the text contains Devanagari.
  const needsHindi = HAS_DEVANAGARI.test(`${title}${transcript}${summary ?? ""}`);
  const [hindiRegular, hindiBold] = needsHindi
    ? await Promise.all([
        loadFont(doc, "/fonts/NotoSansDevanagari-Regular.ttf"),
        loadFont(doc, "/fonts/NotoSansDevanagari-Bold.ttf"),
      ])
    : [null, null];
  const regular = { latin: await doc.embedFont(StandardFonts.Courier), hindi: hindiRegular };
  const bold = { latin: await doc.embedFont(StandardFonts.CourierBold), hindi: hindiBold };

  const pdf = new PdfWriter(doc, regular, bold);

  pdf.banner("UNITE.TXT // AUDIO SPEECH ENGINE", 14 * MM, DARK, PARCHMENT, 12);
  pdf.gap(4);
  pdf.paragraph(title, 10, { bold: true });
  pdf.paragraph(`RECORDING TIMESTAMP: ${timestamp}`, 10, { bold: true });
  pdf.gap(4);
  pdf.rule();
  pdf.gap(6);

  if (summary?.trim()) {
    pdf.banner("[ EXECUTIVE AI SUMMARY ]", 8 * MM, PANEL, DARK);
    pdf.gap(2);
    for (const rawLine of summary.split("\n")) {
      const { text, bold: isHeading } = parseSummaryLine(rawLine);
      if (isHeading) pdf.gap(2);
      pdf.paragraph(text, isHeading ? 10 : 9, { bold: isHeading });
    }
    pdf.gap(6);
    pdf.rule();
    pdf.gap(6);
  }

  pdf.banner("[ VERBATIM AUDIO TRANSCRIPT ]", 8 * MM);
  pdf.gap(2);
  for (const line of transcript.split("\n")) {
    pdf.paragraph(line, 9.5);
  }

  pdf.footers();
  return doc.save();
}

/** Build the transcript PDF and download it. */
export async function exportTranscriptToPDF(data: PDFExportData): Promise<void> {
  const bytes = await buildTranscriptPdf(data);
  const filename = data.filename ?? `UNITE_AUDIO_TRANSCRIPT_${Date.now()}.pdf`;
  downloadFile(new Blob([bytes], { type: "application/pdf" }), filename);
}
