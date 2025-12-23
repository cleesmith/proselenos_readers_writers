// lib/docx-formatting-utils.ts
//
// Client-side DOCX to manuscript.txt conversion.
// Uses the EXACT SAME logic as server-side convertDocxBufferToTxt.
// Only differences: ArrayBuffer instead of Buffer, browser DOMParser instead of xmldom.

import mammoth from 'mammoth';

/**
 * Converts a DOCX file (ArrayBuffer) to manuscript-formatted plain text.
 * Uses mammoth to convert to HTML (preserving structure), then parses
 * and applies manuscript formatting rules:
 * - 2 blank lines before each chapter/section (heading)
 * - 1 blank line between paragraphs
 * - Last paragraph has no trailing blank line
 *
 * THIS LOGIC MUST MATCH docx-conversion-actions.ts:convertDocxBufferToTxt EXACTLY
 *
 * @param arrayBuffer The DOCX file contents as an ArrayBuffer
 * @returns The extracted text with proper manuscript formatting.
 */
export async function convertDocxToManuscript(arrayBuffer: ArrayBuffer): Promise<string> {
  // Use convertToHtml to preserve structure (headings, paragraphs)
  const { value: htmlContent } = await mammoth.convertToHtml({ arrayBuffer });

  // Parse HTML with browser's native DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${htmlContent}</body>`, 'text/html');

  // Get all block elements
  const body = doc.getElementsByTagName('body')[0];
  if (!body) return '';

  const blocks: Array<{ tag: string; text: string }> = [];
  const childNodes = body.childNodes;

  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    if (!node || node.nodeType !== 1) continue; // Skip non-element nodes

    const element = node as Element;
    const tagName = element.tagName?.toLowerCase() || '';
    const text = (element.textContent || '')
      .replace(/\u00a0/g, ' ')  // Convert NBSP to regular space
      .replace(/\s+/g, ' ')     // Collapse whitespace
      .trim();

    if (text && (tagName === 'p' || tagName.match(/^h[1-6]$/))) {
      // Skip ornamental separators like "***" from Vellum exports
      if (text === '***' || text === '* * *') {
        continue;
      }
      blocks.push({ tag: tagName, text });
    }
  }

  // Build manuscript text with proper spacing
  let manuscriptText = '';

  for (const block of blocks) {
    const isHeading = block.tag.match(/^h[1-6]$/);

    if (isHeading) {
      // 2 blank lines before each chapter/section
      manuscriptText += '\n\n\n' + block.text;
    } else {
      // Paragraph
      if (manuscriptText === '') {
        // First content before any heading
        manuscriptText = block.text;
      } else {
        // 1 blank line between paragraphs
        manuscriptText += '\n\n' + block.text;
      }
    }
  }

  // Ensure file ends with single newline (last paragraph has no trailing blank)
  if (manuscriptText) {
    manuscriptText = manuscriptText.trimStart() + '\n';
  }

  return manuscriptText;
}
