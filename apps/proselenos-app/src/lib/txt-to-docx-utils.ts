// lib/txt-to-docx-utils.ts
//
// Client-side TXT to DOCX conversion.
// Follows manuscript formatting rules:
// - Headings/chapters: preceded by 2 blank lines (3 newlines)
// - Paragraphs: preceded by 1 blank line (2 newlines)

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

/**
 * Converts manuscript text to a DOCX Blob for download.
 * Parses manuscript format to detect headings vs paragraphs and applies
 * proper DOCX spacing to preserve the structure.
 *
 * Manuscript rules (from docx-formatting-utils.ts):
 * - 2 blank lines before each chapter/section (heading)
 * - 1 blank line between paragraphs
 *
 * @param text The manuscript text content
 * @returns A Blob containing the DOCX file
 */
export async function convertManuscriptToDocx(text: string): Promise<Blob> {
  // Parse manuscript format: detect headings (after \n\n\n) vs paragraphs (after \n\n)
  const blocks: Array<{ isHeading: boolean; text: string }> = [];

  // Split by 2+ newlines, but track if it was 3+ (heading marker)
  const parts = text.split(/(\n{2,})/);

  let nextIsHeading = false;
  for (const part of parts) {
    if (part.match(/^\n{3,}$/)) {
      // 3+ newlines = next block is a heading
      nextIsHeading = true;
    } else if (part.match(/^\n{2}$/)) {
      // Exactly 2 newlines = next block is a paragraph
      nextIsHeading = false;
    } else if (part.trim()) {
      // Actual text content
      blocks.push({ isHeading: nextIsHeading, text: part.trim() });
      nextIsHeading = false;
    }
  }

  // Create DOCX paragraphs with proper spacing
  const docParagraphs = blocks.map(block =>
    new Paragraph({
      heading: block.isHeading ? HeadingLevel.HEADING_1 : undefined,
      spacing: block.isHeading
        ? { before: 400, after: 200 }  // Headings: extra space before
        : { after: 200 },              // Paragraphs: space after only
      children: [new TextRun(block.text)]
    })
  );

  const doc = new Document({
    sections: [{
      properties: {},
      children: docParagraphs
    }]
  });

  return await Packer.toBlob(doc);
}
