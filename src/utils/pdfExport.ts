import { jsPDF } from "jspdf";

export interface PDFExportData {
  title?: string;
  transcript: string;
  summary?: string;
  timestamp?: string;
}

export function exportTranscriptToPDF({
  title = "UNITE AI — VERBATIM AUDIO SPEECH TRANSCRIPT",
  transcript,
  summary,
  timestamp = new Date().toLocaleString(),
}: PDFExportData) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - margin * 2;
  let yPos = 20;

  // Header Banner
  doc.setFillColor(28, 28, 28); // #1C1C1C
  doc.rect(margin, yPos, contentWidth, 14, "F");

  doc.setTextColor(227, 223, 206); // #E3DFCE
  doc.setFont("courier", "bold");
  doc.setFontSize(12);
  doc.text("UNITE.TXT // AUDIO SPEECH ENGINE", margin + 5, yPos + 9);

  yPos += 22;

  // Date & Title
  doc.setTextColor(28, 28, 28);
  doc.setFontSize(10);
  doc.setFont("courier", "bold");
  doc.text(`RECORDING TIMESTAMP: ${timestamp}`, margin, yPos);
  yPos += 8;

  doc.setLineWidth(0.5);
  doc.setDrawColor(28, 28, 28);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // AI Executive Summary (if available)
  if (summary && summary.trim().length > 0) {
    doc.setFillColor(223, 219, 203); // #DFDBCB
    doc.rect(margin, yPos, contentWidth, 8, "F");
    doc.setFont("courier", "bold");
    doc.setFontSize(10);
    doc.setTextColor(28, 28, 28);
    doc.text("[ EXECUTIVE AI SUMMARY ]", margin + 4, yPos + 6);
    yPos += 12;

    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);

    const summaryLines = doc.splitTextToSize(summary, contentWidth);
    summaryLines.forEach((line: string) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(line, margin, yPos);
      yPos += 5;
    });

    yPos += 8;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  }

  // Verbatim Transcript Section
  doc.setFillColor(28, 28, 28);
  doc.rect(margin, yPos, contentWidth, 8, "F");
  doc.setFont("courier", "bold");
  doc.setFontSize(10);
  doc.setTextColor(227, 223, 206);
  doc.text("[ VERBATIM AUDIO TRANSCRIPT ]", margin + 4, yPos + 6);
  yPos += 14;

  doc.setFont("courier", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(20, 20, 20);

  const transcriptLines = doc.splitTextToSize(transcript, contentWidth);
  transcriptLines.forEach((line: string) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(line, margin, yPos);
    yPos += 5;
  });

  // Footer / Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `UNITE AI SYSTEM (C) ${new Date().getFullYear()} — Page ${i} of ${totalPages}`,
      margin,
      287
    );
  }

  // Save File
  const safeFilename = `UNITE_AUDIO_TRANSCRIPT_${Date.now()}.pdf`;
  doc.save(safeFilename);
}
