/**
 * PDF renderer (slice A) — pdfkit-based.
 *
 * Pure function: takes report metadata + decrypted sections, returns a
 * Buffer. No DI or async I/O beyond the pdfkit stream-to-buffer dance.
 *
 * Design choices:
 *   - Built-in Helvetica fonts only — no font files to bundle for slice A.
 *   - Letter size, 50pt margins, conventional document layout.
 *   - Section heading + kind tag + body text. No tables, no headers/footers
 *     per page yet — those land in a future slice.
 *   - Slice A goal is "looks like an audit report", not "publication-grade".
 *
 * The signed-by + content-hash header doubles as forensic anchoring: anyone
 * with the PDF can recompute the hash from the rendered text… well, not
 * exactly — the rendered text reflows. The contentHash on the audit log row
 * is the source of truth; the PDF just displays it for humans.
 */

import { type ReportSectionsInput } from "@aims/validation";
import PDFDocument from "pdfkit";


export type RenderInput = {
  readonly title: string;
  readonly sections: ReportSectionsInput;
  readonly versionNumber: string;
  readonly signedBy: string;
  readonly signedAt: Date;
  readonly contentHash: string;
};

export function renderReportPdf(input: RenderInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 64, bottom: 64, left: 64, right: 64 },
      info: {
        Title: input.title,
        Author: input.signedBy,
        CreationDate: input.signedAt,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    doc.on("error", (err: Error) => {
      reject(err);
    });

    // ─── Title block ───────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(20).text(input.title, { align: "center" });
    doc.moveDown(0.4);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#666")
      .text(`Version ${input.versionNumber}`, { align: "center" })
      .text(`Signed by ${input.signedBy} on ${input.signedAt.toISOString()}`, {
        align: "center",
      })
      .text(`Content hash: ${input.contentHash}`, { align: "center" });
    doc.moveDown(2);
    doc.fillColor("#000");

    // ─── Sections ──────────────────────────────────────────────────────────
    for (const [key, section] of Object.entries(input.sections)) {
      doc.font("Helvetica-Bold").fontSize(13).text(prettifyKey(key));
      doc
        .font("Helvetica-Oblique")
        .fontSize(8)
        .fillColor("#888")
        .text(section.kind === "data" ? "Data-bound section" : "Editorial section");
      doc.moveDown(0.4);
      doc.font("Helvetica").fontSize(11).fillColor("#000");
      const body = section.content.length > 0 ? section.content : "(empty)";
      doc.text(body, { align: "left" });
      doc.moveDown(1.2);
    }

    doc.end();
  });
}

function prettifyKey(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
