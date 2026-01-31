/**
 * DOCX Export for Vellum/Atticus Import
 *
 * Exports the workspace (all sections) to a .docx file that
 * Vellum and Atticus can import and recognize chapters.
 *
 * Key requirements for Vellum:
 * - Page Break + Heading 1 = chapter detection
 * - Preserve paragraph structure
 * - Left-aligned (Vellum handles formatting)
 */

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } from 'docx';
import { loadFullWorkingCopy } from '@/services/manuscriptStorage';

/**
 * Parse XHTML and extract paragraphs as separate text blocks
 * Preserves paragraph structure while stripping HTML formatting
 */
function extractParagraphsFromXhtml(xhtml: string): string[] {
  if (!xhtml || xhtml.trim() === '') {
    return [];
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtml, 'text/html');
  const body = doc.body;
  if (!body) return [];

  const paragraphs: string[] = [];

  // Walk through all block-level elements and extract text
  const blockElements = body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li, div');

  for (const el of blockElements) {
    // Skip if this element is nested inside another block we'll process
    // (e.g., a <p> inside a <blockquote> - we want the blockquote's full text)
    const parent = el.parentElement;
    if (parent && parent !== body &&
        ['BLOCKQUOTE', 'LI', 'DIV'].includes(parent.tagName) &&
        parent.closest('body') === body) {
      // Check if parent is also in our selection - if so, skip this nested element
      const parentIsBlock = parent.matches('p, h1, h2, h3, h4, h5, h6, blockquote, li, div');
      if (parentIsBlock) continue;
    }

    const text = el.textContent?.trim() || '';
    if (text) {
      paragraphs.push(text);
    }
  }

  // If no block elements found, fall back to body text split by whitespace patterns
  if (paragraphs.length === 0) {
    const bodyText = body.textContent?.trim() || '';
    if (bodyText) {
      // Try to split on what looks like paragraph boundaries
      const chunks = bodyText.split(/\n\s*\n/).filter(p => p.trim());
      if (chunks.length > 1) {
        return chunks.map(c => c.trim());
      }
      return [bodyText];
    }
  }

  return paragraphs;
}

/**
 * Export workspace to DOCX blob
 *
 * @returns Blob containing the .docx file
 * @throws Error if no manuscript is loaded
 */
export async function exportWorkspaceToDocx(): Promise<Blob> {
  const workingCopy = await loadFullWorkingCopy();
  if (!workingCopy || workingCopy.sections.length === 0) {
    throw new Error('No manuscript loaded');
  }

  const docParagraphs: Paragraph[] = [];
  let isFirstSection = true;

  for (const section of workingCopy.sections) {
    // Note: Cover sections are filtered out at the state level, so no need to skip here

    // Page break before each section (except first)
    // Vellum requires: Page Break + Heading 1 to detect chapters
    if (!isFirstSection) {
      docParagraphs.push(new Paragraph({
        children: [new PageBreak()]
      }));
    }
    isFirstSection = false;

    // Section title as Heading 1
    docParagraphs.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.LEFT,
      spacing: { after: 200 },
      children: [new TextRun(section.title)]
    }));

    // Extract paragraphs from XHTML, preserving structure
    const textParagraphs = extractParagraphsFromXhtml(section.xhtml);

    for (const text of textParagraphs) {
      docParagraphs.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 200 },
        children: [new TextRun(text)]
      }));
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children: docParagraphs }]
  });

  return await Packer.toBlob(doc);
}
