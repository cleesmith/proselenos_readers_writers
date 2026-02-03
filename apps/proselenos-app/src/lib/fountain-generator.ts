/**
 * Fountain Export for Screenplay Writers
 *
 * Exports manuscript sections to .fountain format.
 * Assumes author writes content using Fountain conventions.
 * Sections are concatenated without headers (screenplays are flat documents).
 */

import { loadFullWorkingCopy, loadSettings } from '@/services/manuscriptStorage';

/**
 * Extract plain text from XHTML content
 * Strips HTML tags and preserves text content
 */
function extractTextFromXhtml(xhtml: string): string {
  if (!xhtml || xhtml.trim() === '') {
    return '';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtml, 'text/html');
  const body = doc.body;
  if (!body) return '';

  // Get all text content, preserving paragraph breaks
  const paragraphs: string[] = [];
  const blockElements = body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, li, div');

  for (const el of blockElements) {
    const text = el.textContent?.trim() || '';
    if (text) {
      paragraphs.push(text);
    }
  }

  // If no block elements, fall back to body text
  if (paragraphs.length === 0) {
    const bodyText = body.textContent?.trim() || '';
    if (bodyText) {
      return bodyText;
    }
  }

  return paragraphs.join('\n\n');
}

/**
 * Generate Fountain title page block from metadata
 * Format: Key: Value pairs separated by blank line from content
 */
function generateTitlePage(title: string, author: string): string {
  const lines: string[] = [];

  lines.push(`Title: ${title || 'Untitled'}`);
  if (author) {
    lines.push(`Author: ${author}`);
  }
  lines.push(`Draft date: ${new Date().toLocaleDateString()}`);

  // Title page ends with blank line before content
  return lines.join('\n') + '\n\n';
}

/**
 * Export workspace to Fountain format
 *
 * @returns Blob containing the .fountain file as plain text
 * @throws Error if no manuscript is loaded
 */
export async function exportWorkspaceToFountain(): Promise<Blob> {
  const workingCopy = await loadFullWorkingCopy();
  if (!workingCopy || workingCopy.sections.length === 0) {
    throw new Error('No manuscript loaded');
  }

  // Load metadata for title page
  const meta = await loadSettings();

  // Build the Fountain document
  const parts: string[] = [];

  // Add title page
  parts.push(generateTitlePage(
    meta?.title || workingCopy.title || 'Untitled',
    meta?.author || workingCopy.author || ''
  ));

  // Add each section (no headers - screenplays flow as flat documents)
  for (const section of workingCopy.sections) {
    // Extract content without section headers
    const text = extractTextFromXhtml(section.xhtml);
    if (text) {
      parts.push(text);
      parts.push('');  // Blank line between sections
    }
  }

  // Join with newlines and return as text blob
  const fountainText = parts.join('\n');

  return new Blob([fountainText], { type: 'text/plain' });
}
