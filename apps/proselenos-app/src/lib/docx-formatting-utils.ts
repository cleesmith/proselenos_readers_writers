// lib/docx-formatting-utils.ts
//
// Client-side utility for converting DOCX files to well-formatted plain text.
// This mirrors the server-side conversion logic that parses HTML structure
// and applies proper spacing for sections and paragraphs.

import mammoth from 'mammoth';

interface Section {
  title: string;
  textBlocks: string[];
}

/**
 * Converts a DOCX file (provided as an ArrayBuffer) to plain text with proper spacing.
 *
 * Spacing rules:
 * - 2 blank lines (3 newlines) before each section
 * - 1 blank line (2 newlines) after section titles
 * - 1 blank line (2 newlines) between paragraphs
 * - 2 blank lines (3 newlines) at the end of the file
 *
 * Sections are defined by <h1> headings in the DOCX structure.
 *
 * @param arrayBuffer The DOCX file contents as an ArrayBuffer
 * @returns Formatted plain text with proper spacing
 */
export async function convertDocxToFormattedText(arrayBuffer: ArrayBuffer): Promise<string> {
  // Convert DOCX to HTML (preserves structure unlike extractRawText)
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const htmlContent = result.value;

  // Parse HTML using browser's native DOM
  const div = document.createElement('div');
  div.innerHTML = htmlContent;

  // Get all block elements (headings and paragraphs)
  const blocks = div.querySelectorAll('p, h1, h2, h3, h4, h5, h6');

  // Build sections. Each <h1> starts a new section.
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  Array.from(blocks).forEach((block) => {
    const tagName = block.tagName.toLowerCase();

    // Normalize text: replace non-breaking spaces and collapse whitespace
    const rawText = block.textContent || '';
    const normalizedText = rawText
      .replace(/\u00a0/g, ' ')    // Convert NBSP to regular space
      .replace(/\s+/g, ' ')       // Collapse multiple whitespace into single space
      .trim();

    // Only <h1> elements start a new section
    const startNewSection = tagName === 'h1';

    if (startNewSection) {
      // Start a new section with this heading as the title
      currentSection = { title: normalizedText, textBlocks: [] };
      sections.push(currentSection);
    } else {
      // Add paragraph to current section (or create first section if none exists)
      if (!currentSection) {
        currentSection = { title: '', textBlocks: [] };
        sections.push(currentSection);
      }

      // Only add non-empty text blocks
      if (normalizedText) {
        currentSection.textBlocks.push(normalizedText);
      }
    }
  });

  // Build the final manuscript text with proper spacing
  let manuscriptText = '';

  sections.forEach((section) => {
    // Two blank lines before each section (3 newlines)
    manuscriptText += '\n\n\n';

    // Add section title if present
    if (section.title) {
      manuscriptText += section.title;
      // One blank line after the heading (2 newlines)
      manuscriptText += '\n\n';
    }

    // Join text blocks with one blank line between them (2 newlines)
    manuscriptText += section.textBlocks.join('\n\n');
  });

  // Ensure the file ends with exactly 2 blank lines (3 newlines total)
  manuscriptText += '\n\n\n';

  return manuscriptText;
}

/**
 * Counts the number of sections in the formatted text.
 * Useful for providing feedback to users about the conversion.
 *
 * @param arrayBuffer The DOCX file contents as an ArrayBuffer
 * @returns The number of sections (based on <h1> headings)
 */
export async function countDocxSections(arrayBuffer: ArrayBuffer): Promise<number> {
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const htmlContent = result.value;

  const div = document.createElement('div');
  div.innerHTML = htmlContent;

  const h1Elements = div.querySelectorAll('h1');
  return h1Elements.length;
}
