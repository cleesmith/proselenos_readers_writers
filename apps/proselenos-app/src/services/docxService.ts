// services/docxService.ts
// Parse DOCX files into working copy structure for Authors mode

import mammoth from 'mammoth';

export interface ParsedDocx {
  title: string;
  author: string;
  language: string;
  coverImage: Blob | null;
  sections: { id: string; title: string; content: string; type?: string }[];
}

// Front matter headings that should NOT start a chapter
const FRONT_MATTER_HEADINGS = [
  'copyright',
  'dedication',
  'acknowledgments',
  'acknowledgements',
  'about the author',
  'also by',
  'books by',
  'title page',
  'contents',
  'table of contents',
];

/**
 * Check if a heading text indicates a chapter start (not front matter).
 * Returns true for headings like "Chapter 1", "Prologue", "Part One", etc.
 */
function isChapterHeading(text: string): boolean {
  const lower = text.toLowerCase().trim();

  // Skip front matter headings
  for (const fm of FRONT_MATTER_HEADINGS) {
    if (lower === fm || lower.startsWith(fm + ':')) {
      return false;
    }
  }

  // Chapter patterns: "Chapter 1", "Chapter One", "Chapter 1: Title"
  if (/^chapter\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(text)) {
    return true;
  }

  // Part patterns: "Part 1", "Part One", "Part I"
  if (/^part\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|i{1,3}|iv|v|vi{1,3}|ix|x)/i.test(text)) {
    return true;
  }

  // Prologue, Epilogue, Introduction (as chapter, not front matter)
  if (/^(prologue|epilogue|introduction|preface|foreword)/i.test(text)) {
    return true;
  }

  // Numbered chapter without "Chapter" prefix: "1", "1.", "1: Title", "One"
  if (/^(\d+\.?|one|two|three|four|five|six|seven|eight|nine|ten)(\s*[:.]|\s|$)/i.test(text)) {
    return true;
  }

  // If it doesn't match known patterns but is a heading, assume it's a chapter
  // (unless it's clearly front matter, which we checked above)
  // This catches custom chapter titles like "The Beginning"
  return true;
}

/**
 * Parse a DOCX file into sections for the working copy.
 * Uses mammoth to convert DOCX → HTML, then splits on chapter headings.
 * All content before the first chapter heading is treated as front matter (copyright).
 */
export async function parseDocx(file: File): Promise<ParsedDocx> {
  const arrayBuffer = await file.arrayBuffer();

  // Convert DOCX to HTML (preserves headings and paragraphs)
  const { value: htmlContent } = await mammoth.convertToHtml({ arrayBuffer });

  // Parse HTML with browser's native DOMParser
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${htmlContent}</body>`, 'text/html');
  const body = doc.body;

  if (!body) {
    throw new Error('Could not parse DOCX content');
  }

  // Get title from filename (remove .docx extension)
  const fileTitle = file.name.replace(/\.docx$/i, '');

  // Collect all elements with their text and type
  interface DocElement {
    tagName: string;
    text: string;
    isHeading: boolean;
  }

  const elements: DocElement[] = [];
  for (const node of Array.from(body.childNodes)) {
    if (node.nodeType !== 1) continue; // Skip non-element nodes

    const element = node as Element;
    const tagName = element.tagName?.toLowerCase() || '';
    const text = (element.textContent || '')
      .replace(/\u00a0/g, ' ')  // Convert NBSP to regular space
      .replace(/\s+/g, ' ')     // Collapse whitespace
      .trim();

    if (!text) continue;

    // Skip ornamental separators
    if (text === '***' || text === '* * *') continue;

    const isHeading = /^h[1-6]$/.test(tagName);
    elements.push({ tagName, text, isHeading });
  }

  // Find the first chapter heading
  let firstChapterIndex = -1;
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el && el.isHeading && isChapterHeading(el.text)) {
      firstChapterIndex = i;
      break;
    }
  }

  // Collect front matter (everything before first chapter)
  const frontMatterParagraphs: string[] = [];
  const chapterStartIndex = firstChapterIndex >= 0 ? firstChapterIndex : elements.length;

  for (let i = 0; i < chapterStartIndex; i++) {
    const el = elements[i];
    if (!el) continue;
    // Skip headings like "Copyright" - just take the content
    if (el.isHeading && el.text.toLowerCase() === 'copyright') {
      continue;
    }
    // Add paragraph content
    if (el.tagName === 'p' || !el.isHeading) {
      frontMatterParagraphs.push(el.text);
    }
  }

  // Build chapters from chapter headings onward
  const chapters: { id: string; title: string; content: string }[] = [];
  let currentChapter: { title: string; paragraphs: string[] } | null = null;
  let chapterIndex = 0;

  for (let i = chapterStartIndex; i < elements.length; i++) {
    const el = elements[i];
    if (!el) continue;

    if (el.isHeading) {
      // Save previous chapter if exists
      if (currentChapter && currentChapter.paragraphs.length > 0) {
        chapters.push({
          id: `chapter-${String(chapterIndex + 1).padStart(3, '0')}`,
          title: currentChapter.title,
          content: currentChapter.paragraphs.join('\n\n'),
        });
        chapterIndex++;
      }

      // Start new chapter
      currentChapter = {
        title: el.text,
        paragraphs: [],
      };
    } else if (currentChapter) {
      // Add content to current chapter
      currentChapter.paragraphs.push(el.text);
    }
  }

  // Save last chapter
  if (currentChapter && currentChapter.paragraphs.length > 0) {
    chapters.push({
      id: `chapter-${String(chapterIndex + 1).padStart(3, '0')}`,
      title: currentChapter.title,
      content: currentChapter.paragraphs.join('\n\n'),
    });
  }

  // If no chapters found, create one from all content
  if (chapters.length === 0) {
    const allText = (body.textContent || '').trim();
    if (allText) {
      chapters.push({
        id: 'chapter-001',
        title: 'Chapter 1',
        content: allText,
      });
    }
  }

  // Create Cover section
  const coverSection = {
    id: 'cover',
    title: 'Cover',
    content: 'Use Format > Image to add your cover image',
    type: 'cover' as const,
  };

  // Create Title Page
  const titlePageSection = {
    id: 'title-page',
    title: 'Title Page',
    content: `${fileTitle}\n\nby Anonymous`,
    type: 'title-page' as const,
  };

  // Create Copyright section (use front matter content or default)
  const year = new Date().getFullYear();
  const copyrightSection = {
    id: 'copyright',
    title: 'Copyright',
    content: frontMatterParagraphs.length > 0
      ? frontMatterParagraphs.join('\n\n')
      : `Copyright © ${year} by Anonymous\n\nAll rights reserved.\n\nNo part of this book may be reproduced in any form or by any electronic or mechanical means, including information storage and retrieval systems, without written permission from the author, except for the use of brief quotations in a book review.`,
    type: 'copyright' as const,
  };

  return {
    title: fileTitle,
    author: 'Anonymous',
    language: 'en',
    coverImage: null,
    sections: [coverSection, titlePageSection, copyrightSection, ...chapters],
  };
}
