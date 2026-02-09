// src/lib/epub-generator.ts
// Client-side EPUB generation - extracted from publish-actions.ts
// Only 2 changes: nodebuffer → uint8array, Buffer → Uint8Array via atob
//
// XHTML-Native: Sections now contain XHTML directly as single source of truth.
// No PlateJS conversion needed - XHTML is ready to embed in EPUB.

import JSZip from 'jszip';
import { ManuscriptSettings, WorkingCopyMeta, WorkingCopySection } from '@/services/manuscriptStorage';
import { xhtmlToPlainText } from './plateXhtml';
import { VISUAL_NARRATIVE_CSS } from './visual-narrative-css';

// TypeScript Interfaces
// XHTML-Native: Chapter now stores xhtml directly
export interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string[];     // Plain text paragraphs (for fallback/legacy)
  paragraphs: string[];  // Same as content (legacy)
  xhtml?: string;        // XHTML content (single source of truth)
}

/**
 * Main entry point - generates EPUB from manuscript text
 */
export async function generateEpubFromManuscript(
  manuscriptText: string,
  settings: ManuscriptSettings,
  coverImageBase64?: string
): Promise<Uint8Array> {
  // Parse manuscript into chapters
  const chapters = parseManuscriptText(manuscriptText);

  // Build metadata object expected by EPUB functions
  const metadata = {
    title: settings.title || 'Untitled',
    displayTitle: settings.title || 'Untitled',
    author: settings.author || 'Unknown Author',
    publisher: settings.publisher || 'Independent Publisher',
    aboutAuthor: settings.aboutAuthor || '',
    language: 'en',
    description: 'Created with EverythingEbooks'
  };

  // Convert cover image if provided
  let coverImageData: Uint8Array | undefined;
  if (coverImageBase64) {
    // Remove data URL prefix if present
    const base64Data = coverImageBase64.replace(/^data:image\/\w+;base64,/, '');
    // Browser-compatible: atob + Uint8Array instead of Buffer
    const binaryString = atob(base64Data);
    coverImageData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      coverImageData[i] = binaryString.charCodeAt(i);
    }
  }

  return generateEPUB(chapters, metadata, coverImageData);
}

// Interface for inline images
export interface ManuscriptImage {
  filename: string;
  blob: Blob;
}

/**
 * Generate EPUB from structured working copy data (for Authors Mode "Save" button)
 * Unlike generateEpubFromManuscript which parses raw text, this takes structured sections directly.
 *
 * XHTML-Native: Sections now contain XHTML directly - no conversion needed.
 */
// Audio file interface (for Visual Narrative)
export interface ManuscriptAudioFile {
  filename: string;
  blob: Blob;
}

export async function generateEpubFromWorkingCopy(
  meta: WorkingCopyMeta,
  sections: WorkingCopySection[],
  coverBlob?: Blob | null,
  images?: ManuscriptImage[],
  audioFiles?: ManuscriptAudioFile[]
): Promise<Uint8Array> {
  // Find Copyright section content (if exists)
  const copyrightSection = sections.find(s =>
    s.id === 'copyright' || s.title.toLowerCase() === 'copyright'
  );
  // XHTML-Native: Use raw XHTML directly to preserve paragraph structure
  const copyrightXhtml = copyrightSection?.xhtml || '';
  // Fallback plain text (for legacy data without XHTML)
  const copyrightContent = copyrightXhtml
    ? xhtmlToPlainText(copyrightXhtml)
    : '';

  // Find Cover section to extract cover image (if user added one via Format > Image)
  const coverSection = sections.find(s =>
    s.id === 'cover' || s.title.toLowerCase() === 'cover'
  );

  // Extract inline image from Cover section XHTML (e.g., <img src="images/filename.png">)
  let coverImageFromSection: string | null = null;
  if (coverSection?.xhtml) {
    // Look for image in XHTML
    const imageMatch = coverSection.xhtml.match(/src="images\/([^"]+)"/);
    if (imageMatch && imageMatch[1]) {
      coverImageFromSection = imageMatch[1]; // e.g., "ny2026.png"
    }
    // Also check for markdown format (legacy)
    const mdMatch = coverSection.xhtml.match(/!\[[^\]]*\]\(([^)]+)\)/);
    if (mdMatch && mdMatch[1]) {
      coverImageFromSection = mdMatch[1];
    }
  }

  // Convert sections to Chapter format, skipping Cover, Title Page and Copyright (we generate those separately)
  // Also separate no-matter sections (they get linear="no" in spine)
  // XHTML-Native: Use xhtml field directly
  const chapters: Chapter[] = [];
  const noMatterSections: Chapter[] = [];
  let chapterNum = 0;

  for (const section of sections) {
    // Skip cover, title page and copyright sections - we generate those from metadata
    if (section.id === 'cover' || section.title.toLowerCase() === 'cover') {
      continue;
    }
    if (section.id === 'title-page' || section.title.toLowerCase() === 'title page') {
      continue;
    }
    if (section.id === 'copyright' || section.title.toLowerCase() === 'copyright') {
      continue;
    }

    // XHTML-Native: Get plain text for fallback, but keep XHTML as source of truth
    const plainText = xhtmlToPlainText(section.xhtml);
    const paragraphs = plainText
      .split(/\n\s*\n/)
      .map(p => p.replace(/\n/g, ' ').trim())
      .filter(p => p.length > 0);

    const chapterData: Chapter = {
      id: section.id,
      number: 0, // Will be set below for regular chapters
      title: section.title,
      content: paragraphs,     // Plain text fallback
      paragraphs: paragraphs,  // Legacy
      xhtml: section.xhtml,    // XHTML source of truth
    };

    // No Matter sections go to separate array
    if (section.type === 'no-matter') {
      noMatterSections.push(chapterData);
    } else {
      chapterNum++;
      chapterData.number = chapterNum;
      chapters.push(chapterData);
    }
  }

  // Build metadata object from WorkingCopyMeta
  const metadata = {
    title: meta.title || 'Untitled',
    displayTitle: meta.title || 'Untitled',
    subtitle: meta.subtitle || '',
    author: meta.author || 'Unknown Author',
    publisher: meta.publisher || 'Independent Publisher',
    aboutAuthor: '', // Could add to WorkingCopyMeta later
    language: meta.language || 'en',
    description: meta.description || 'Created with EverythingEbooks',
    rights: meta.rights || '',
    copyrightXhtml: copyrightXhtml, // Raw XHTML for direct use (preserves formatting)
    copyrightContent: copyrightContent, // Plain text fallback
  };

  // Convert inline images to Uint8Array format (do this first so we can check for cover image)
  const inlineImages: Array<{filename: string, data: Uint8Array}> = [];
  if (images && images.length > 0) {
    for (const img of images) {
      const arrayBuffer = await img.blob.arrayBuffer();
      inlineImages.push({
        filename: img.filename,
        data: new Uint8Array(arrayBuffer)
      });
    }
  }

  // Convert cover Blob to Uint8Array if provided
  let coverImageData: Uint8Array | undefined;
  if (coverBlob) {
    // Use metadata cover (sidebar thumbnail)
    const arrayBuffer = await coverBlob.arrayBuffer();
    coverImageData = new Uint8Array(arrayBuffer);
  } else if (coverImageFromSection) {
    // Fallback: use image from Cover section content
    const coverImg = inlineImages.find(img => img.filename === coverImageFromSection);
    if (coverImg) {
      coverImageData = coverImg.data;
    }
  }

  // Convert audio files to Uint8Array format
  const inlineAudios: Array<{filename: string, data: Uint8Array}> = [];
  if (audioFiles && audioFiles.length > 0) {
    for (const aud of audioFiles) {
      const arrayBuffer = await aud.blob.arrayBuffer();
      inlineAudios.push({
        filename: aud.filename,
        data: new Uint8Array(arrayBuffer)
      });
    }
  }

  // Detect if any section contains Visual Narrative content
  const hasVnContent = sections.some(s =>
    s.xhtml && (
      s.xhtml.includes('class="dialogue"') ||
      s.xhtml.includes('class="internal"') ||
      s.xhtml.includes('class="emphasis-line"') ||
      s.xhtml.includes('class="scene-break"') ||
      s.xhtml.includes('class="scene-audio"') ||
      s.xhtml.includes('class="visual ')
    )
  );

  return generateEPUB(chapters, metadata, coverImageData, inlineImages, noMatterSections, inlineAudios, hasVnContent);
}

/**
 * Detect image type from binary data by checking magic bytes
 */
function detectImageType(data: Uint8Array): { extension: string; mediaType: string } {
  // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return { extension: 'png', mediaType: 'image/png' };
  }
  // Check JPEG signature: FF D8 FF
  if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
    return { extension: 'jpg', mediaType: 'image/jpeg' };
  }
  // Check GIF signature: 47 49 46 38
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x38) {
    return { extension: 'gif', mediaType: 'image/gif' };
  }
  // Check WebP signature: 52 49 46 46 ... 57 45 42 50
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
      data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
    return { extension: 'webp', mediaType: 'image/webp' };
  }
  // Default to JPEG if unknown
  return { extension: 'jpg', mediaType: 'image/jpeg' };
}

/**
 * Generate EPUB file from chapters and metadata
 */
async function generateEPUB(
  chapters: Chapter[],
  metadata: any,
  coverImageData?: Uint8Array,
  inlineImages?: Array<{filename: string, data: Uint8Array}>,
  noMatterSections?: Chapter[],
  inlineAudios?: Array<{filename: string, data: Uint8Array}>,
  hasVnContent?: boolean
): Promise<Uint8Array> {
  const zip = new JSZip();

  // Generate a single UUID to be shared between content.opf and toc.ncx
  const bookUUID = generateUUID();

  // 1. Add mimetype (uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  const containerXML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.file('META-INF/container.xml', containerXML);

  // 3. Handle cover - always create cover.xhtml (with image or text fallback)
  // Detect actual image type from binary data to use correct extension/media-type
  let coverImageInfo: { extension: string; mediaType: string } | null = null;
  const hasCover = !!coverImageData;
  if (coverImageData) {
    coverImageInfo = detectImageType(coverImageData);
    // Add cover image file with correct extension
    zip.file(`OEBPS/images/cover.${coverImageInfo.extension}`, coverImageData, { compression: 'STORE' });
  }
  // Always create cover page (with image or text fallback)
  const coverXHTML = createCoverPage(metadata, hasCover, coverImageInfo?.extension || 'jpg');
  zip.file('OEBPS/cover.xhtml', coverXHTML);

  // 3b. Add inline images to OEBPS/images/
  // Images are already compressed (PNG, JPEG, WebP) — store without re-compression
  if (inlineImages && inlineImages.length > 0) {
    for (const img of inlineImages) {
      zip.file(`OEBPS/images/${img.filename}`, img.data, { compression: 'STORE' });
    }
  }

  // 3c. Add audio files to OEBPS/audio/ (Visual Narrative)
  // Audio files are already compressed (MP3, AAC, OGG) — store without re-compression
  if (inlineAudios && inlineAudios.length > 0) {
    for (const aud of inlineAudios) {
      zip.file(`OEBPS/audio/${aud.filename}`, aud.data, { compression: 'STORE' });
    }
  }

  // 4. Create title page
  const titlePageHTML = createTitlePage(metadata);
  zip.file('OEBPS/title-page.xhtml', titlePageHTML);

  // 5. Create copyright page
  const copyrightHTML = createCopyrightPage(metadata);
  zip.file('OEBPS/copyright.xhtml', copyrightHTML);

  // 6. Create contents page (includes No Matter sections under "Author's Notes")
  const contentsHTML = createContentsPage(chapters, metadata, noMatterSections);
  zip.file('OEBPS/contents.xhtml', contentsHTML);

  // 7. Create chapter HTML files
  // Per-chapter VN detection: VN chapters get visual-narrative.css, others get style.css
  chapters.forEach(chapter => {
    const useVn = chapterHasVnContent(chapter.xhtml);
    const chapterHTML = createChapterHTML(chapter, metadata, false, useVn);
    zip.file(`OEBPS/${chapter.id}.xhtml`, chapterHTML);
  });

  // 7b. Create No Matter files in nomatter/ folder (if any)
  // Pass isNoMatter=true so CSS path uses "../css/" prefix (fixes RSC-007)
  if (noMatterSections && noMatterSections.length > 0) {
    noMatterSections.forEach(section => {
      const useVn = chapterHasVnContent(section.xhtml);
      const sectionHTML = createChapterHTML(section, metadata, true, useVn);
      zip.file(`OEBPS/nomatter/${section.id}.xhtml`, sectionHTML);
    });
  }

  // 8. Create about author page (only if metadata exists)
  if (metadata.aboutAuthor && metadata.aboutAuthor.trim()) {
    const aboutAuthorHTML = createAboutAuthorPage(metadata);
    zip.file('OEBPS/about-author.xhtml', aboutAuthorHTML);
  }

  // 9. Create content.opf (EPUB 3.0 format) with all new items
  // Pass the shared UUID and cover image info for correct media-type
  const contentOPF = createEpub3ContentOPF(chapters, metadata, hasCover ? 'cover-image' : null, inlineImages, noMatterSections, bookUUID, coverImageInfo, inlineAudios, hasVnContent);
  zip.file('OEBPS/content.opf', contentOPF);

  // 10. Create nav.xhtml (EPUB 3.0 navigation, includes No Matter sections)
  const navXHTML = createNavXHTML(chapters, metadata, noMatterSections);
  zip.file('OEBPS/nav.xhtml', navXHTML);

  // 11. Create toc.ncx for EPUB 2 compatibility
  // Pass the same UUID used in content.opf for consistency
  const tocNCX = createTocNCX(chapters, metadata, bookUUID);
  zip.file('OEBPS/toc.ncx', tocNCX);

  // 12. Create CSS files in css/ subfolder
  const styleCSS = createFullWidthCSS();
  zip.file('OEBPS/css/style.css', styleCSS);

  // 12b. Add Visual Narrative CSS (if VN content detected)
  if (hasVnContent) {
    zip.file('OEBPS/css/visual-narrative.css', VISUAL_NARRATIVE_CSS);
  }

  // Generate and return the EPUB
  // CHANGE: 'nodebuffer' → 'uint8array' for browser compatibility
  const epubData = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return epubData;
}

/**
 * Parse manuscript text into chapters
 * Supports various title formats with double newline before title and single newline after
 */
export function parseManuscriptText(text: string): Chapter[] {
  const chapters: Chapter[] = [];

  // Normalize line endings and trim
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Split by double (or more) newlines - this gives us potential chapter boundaries
  const sections = text.split(/\n\s*\n\s*\n+/);

  let chapterCount = 0;

  for (let i = 0; i < sections.length; i++) {
    const sectionRaw = sections[i];
    if (!sectionRaw) continue;
    const section = sectionRaw.trim();
    if (!section || section.length < 50) continue;

    // Split section into lines
    const lines = section.split('\n');
    if (lines.length < 2) continue;

    // First line could be a title
    const firstLineRaw = lines[0];
    if (!firstLineRaw) continue;
    const firstLine = firstLineRaw.trim();
    const remainingContent = lines.slice(1).join('\n').trim();

    // Check if first line looks like a title (not too long, has content after it)
    if (firstLine && firstLine.length <= 120 && remainingContent.length > 50) {
      chapterCount++;

      // Format the title appropriately
      const formattedTitle = formatChapterTitle(firstLine, chapterCount);

      // Split remaining content into paragraphs
      const paragraphs = remainingContent
        .split(/\n\s*\n/)
        .map(p => p.replace(/\n/g, ' ').trim())
        .filter(p => p.length > 0);

      if (paragraphs.length > 0) {
        chapters.push({
          id: `chapter${chapterCount}`,
          number: chapterCount,
          title: formattedTitle,
          content: paragraphs,
          paragraphs: paragraphs
        });
      }
    } else {
      // Whole section is content without clear title
      chapterCount++;

      const paragraphs = section
        .split(/\n\s*\n/)
        .map(p => p.replace(/\n/g, ' ').trim())
        .filter(p => p.length > 0);

      if (paragraphs.length > 0) {
        chapters.push({
          id: `chapter${chapterCount}`,
          number: chapterCount,
          title: `Chapter ${chapterCount}`,
          content: paragraphs,
          paragraphs: paragraphs
        });
      }
    }
  }

  // If no chapters found, treat whole text as one chapter
  if (chapters.length === 0) {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map(p => p.replace(/\n/g, ' ').trim())
      .filter(p => p.length > 0);

    if (paragraphs.length > 0) {
      chapters.push({
        id: 'chapter1',
        number: 1,
        title: 'Chapter 1',
        content: paragraphs,
        paragraphs: paragraphs
      });
    }
  }

  return chapters;
}

/**
 * Format a chapter title, preserving existing formats or adding "Chapter N" if needed
 */
function formatChapterTitle(title: string, chapterNum: number): string {
  // Already has "Chapter N" format
  const chapterMatch = title.match(/^Chapter\s+(\d+|[IVXLCDM]+)[\.:]?\s*(.*)$/i);
  if (chapterMatch && chapterMatch[2]) {
    const num = chapterMatch[1];
    const subtitle = chapterMatch[2].trim();
    return subtitle ? `Chapter ${num}: ${subtitle}` : `Chapter ${num}`;
  }

  // Numbered format like "1. Title"
  const numberedMatch = title.match(/^(\d+)\.\s*(.*)$/);
  if (numberedMatch && numberedMatch[2]) {
    const subtitle = numberedMatch[2].trim();
    return subtitle ? `Chapter ${numberedMatch[1]}: ${subtitle}` : `Chapter ${numberedMatch[1]}`;
  }

  // Markdown heading
  const markdownMatch = title.match(/^#+\s+(.+)$/);
  if (markdownMatch && markdownMatch[1]) {
    return markdownMatch[1].trim();
  }

  // Scene break markers
  if (/^\*\s*\*\s*\*$/.test(title)) {
    return `Chapter ${chapterNum}`;
  }

  // Plain text title - if it's short and looks like a title, keep it as is
  if (title.length <= 80 && !title.includes('.') && !title.includes('?')) {
    // Check if it's all caps or title case - likely a real title
    if (title === title.toUpperCase() || /^[A-Z]/.test(title)) {
      return title;
    }
  }

  // Default: add Chapter prefix
  return `Chapter ${chapterNum}: ${title}`;
}

/**
 * Utility Functions
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Get media type for image filename
 */
function getImageMediaType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/jpeg';
  }
}

function getAudioMediaType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'wav':
      return 'audio/wav';
    case 'mp3':
      return 'audio/mpeg';
    case 'ogg':
      return 'audio/ogg';
    case 'm4a':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    default:
      return 'audio/wav';
  }
}

/**
 * Convert markdown (bold, italic, links, images) to HTML
 * Applied after escapeHtml since markdown syntax doesn't contain <>
 */
function processMarkdown(text: string): string {
  let result = text;

  // Bold: **text**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic: __text__
  result = result.replace(/__(.+?)__/g, '<em>$1</em>');

  // Images: ![alt](filename) - convert to block-level image
  // This breaks out of the <p> tag and creates a centered image container
  result = result.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '</p><div class="image-container"><img src="images/$2" alt="$1"/></div><p>'
  );

  // Links: [text](url) - must come after images since both use []()
  result = result.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>');

  return result;
}

/**
 * Create title page HTML
 */
function createTitlePage(metadata: any): string {
  const upperTitle = metadata.displayTitle.toUpperCase();

  // Add subtitle element if present
  const subtitleHTML = metadata.subtitle
    ? `\n    <p class="book-subtitle">${escapeHtml(metadata.subtitle)}</p>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Title Page</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <section class="title-page" epub:type="titlepage">
    <h1 class="book-title">${escapeHtml(upperTitle)}</h1>${subtitleHTML}
    <p class="book-author">${escapeHtml(metadata.author)}</p>
    <p class="book-publisher">${escapeHtml(metadata.publisher || 'Independent Publisher')}</p>
  </section>
</body>
</html>`;
}

/**
 * Create copyright page HTML
 */
function createCopyrightPage(metadata: any): string {
  let copyrightContent: string;

  if (metadata.copyrightXhtml && metadata.copyrightXhtml.trim()) {
    // XHTML-Native: Use XHTML directly (preserves paragraphs, spacing, formatting)
    copyrightContent = metadata.copyrightXhtml;
  } else if (metadata.copyrightContent && metadata.copyrightContent.trim()) {
    // Fallback: plain text → paragraph splitting
    copyrightContent = metadata.copyrightContent
      .split(/\n\s*\n/)
      .map((p: string) => `    <p>${escapeHtml(p.replace(/\n/g, ' ').trim())}</p>`)
      .join('\n');
  } else {
    // Standard copyright template (Vellum style)
    const year = new Date().getFullYear();
    const author = metadata.author || 'Anonymous';
    copyrightContent = `    <p>Copyright © ${year} by ${escapeHtml(author)}</p>
    <p>All rights reserved.</p>
    <p>No part of this book may be reproduced in any form or by any electronic or mechanical means, including information storage and retrieval systems, without written permission from the author, except for the use of brief quotations in a book review.</p>
    <p></p>
    <p>Published by ${escapeHtml(metadata.publisher || 'Independent Publisher')}</p>
    <p></p>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Copyright</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <section class="copyright-page" epub:type="copyright-page">
${copyrightContent}
  </section>
</body>
</html>`;
}

/**
 * Create contents page HTML (Vellum-style structure for clickable links)
 * Includes No Matter sections under "Author's Notes" heading (fixes OPF-096)
 */
function createContentsPage(chapters: Chapter[], metadata: any, noMatterSections?: Chapter[]): string {
  const chapterItems = chapters
    .map(ch => `      <div class="toc-item">
        <p class="toc-content"><a href="${ch.id}.xhtml"><span class="toc-item-title">${escapeHtml(ch.title)}</span></a></p>
      </div>`)
    .join('\n');

  const aboutAuthorItem = metadata.aboutAuthor && metadata.aboutAuthor.trim()
    ? `\n      <div class="toc-item">
        <p class="toc-content"><a href="about-author.xhtml"><span class="toc-item-title">About the Author</span></a></p>
      </div>`
    : '';

  // No Matter sections appear under "Author's Notes" heading (makes them reachable, fixes OPF-096)
  let noMatterItems = '';
  if (noMatterSections && noMatterSections.length > 0) {
    const noMatterLinks = noMatterSections
      .map(s => `      <div class="toc-item">
        <p class="toc-content"><a href="nomatter/${s.id}.xhtml"><span class="toc-item-title">${escapeHtml(s.title)}</span></a></p>
      </div>`)
      .join('\n');
    noMatterItems = `\n      <div class="toc-section-header">
        <p class="toc-section-title">Author's Notes</p>
      </div>\n${noMatterLinks}`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en" lang="en">
<head>
  <title>Contents</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <div id="table-of-contents" class="contents-page" role="doc-toc" epub:type="toc">
    <h1 class="toc-title">CONTENTS</h1>
    <div class="toc-contents">
${chapterItems}${aboutAuthorItem}${noMatterItems}
    </div>
  </div>
</body>
</html>`;
}

/**
 * Check if a single chapter's XHTML contains Visual Narrative content.
 * Same class checks as the global hasVnContent detection (line ~217).
 */
function chapterHasVnContent(xhtml?: string): boolean {
  if (!xhtml) return false;
  return (
    xhtml.includes('class="dialogue"') ||
    xhtml.includes('class="internal"') ||
    xhtml.includes('class="emphasis-line"') ||
    xhtml.includes('class="scene-break"') ||
    xhtml.includes('class="scene-audio"') ||
    xhtml.includes('class="visual ')
  );
}

/**
 * Create HTML for a chapter
 * XHTML-Native: Uses xhtml directly if available (no conversion needed),
 * otherwise falls back to processMarkdown for backwards compatibility.
 *
 * @param isNoMatter - When true, CSS path uses "../css/" prefix for nomatter/ folder
 * @param useVnCss - When true, uses visual-narrative.css and <article class="scene"> wrapper
 */
function createChapterHTML(chapter: Chapter, _metadata: any, isNoMatter: boolean = false, useVnCss: boolean = false): string {
  let bodyContent: string;

  if (chapter.xhtml) {
    // XHTML-Native: Use XHTML directly - no conversion needed!
    bodyContent = chapter.xhtml;
  } else {
    // Fallback: Use plain text paragraphs with markdown processing
    bodyContent = chapter.content
      .map(p => `<p>${processMarkdown(escapeHtml(p))}</p>`)
      .join('\n');
  }

  // No Matter sections are in nomatter/ folder, so need "../css/" prefix
  const cssPrefix = isNoMatter ? '../css/' : 'css/';

  if (useVnCss) {
    // VN chapters: use visual-narrative.css only (no style.css — its * reset would conflict)
    // Wrap in <article class="scene"> with <h1 class="scene-title"> to match Preview structure
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeHtml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="${cssPrefix}visual-narrative.css"/>
</head>
<body>
  <article class="scene" epub:type="chapter">
    <h1 class="scene-title">${escapeHtml(chapter.title)}</h1>
${bodyContent}
  </article>
</body>
</html>`;
  }

  // Non-VN chapters: standard style.css with <section class="chapter"> (unchanged)
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeHtml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="${cssPrefix}style.css"/>
</head>
<body>
  <section class="chapter" epub:type="chapter">
    <h1>${escapeHtml(chapter.title)}</h1>
${bodyContent}
  </section>
</body>
</html>`;
}

/**
 * Create about the author page HTML
 */
function createAboutAuthorPage(metadata: any): string {
  let aboutContent;

  if (metadata.aboutAuthor && metadata.aboutAuthor.trim()) {
    // Use custom about text from metadata
    aboutContent = metadata.aboutAuthor.split('\n').map((line: string) =>
      line.trim() ? `    <p>${escapeHtml(line.trim())}</p>` : '    <p></p>'
    ).join('\n');
  } else {
    // Use default about text
    aboutContent = `    <p>${escapeHtml(metadata.author)} is an author who creates compelling stories.</p>
    <p></p>
    <p>When not writing, they enjoy exploring new narrative possibilities and reading well-crafted books.</p>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>About the Author</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <section class="about-author-page" epub:type="appendix">
    <h1>About the Author</h1>
${aboutContent}
  </section>
</body>
</html>`;
}

/**
 * Create cover page XHTML for EPUB
 * If hasCoverImage is true, shows the cover image
 * Otherwise, shows a styled text cover with title and author
 */
function createCoverPage(metadata: { title: string; author: string }, hasCoverImage: boolean, coverExtension: string = 'jpg'): string {
  if (hasCoverImage) {
    // Image-based cover - use correct extension for the actual image type
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Cover</title>
  <style type="text/css">
    body { margin: 0; padding: 0; text-align: center; }
    img { max-width: 100%; max-height: 100%; }
  </style>
</head>
<body epub:type="cover">
  <img src="images/cover.${coverExtension}" alt="Cover"/>
</body>
</html>`;
  } else {
    // Text-based fallback cover (blue background with title/author)
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Cover</title>
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      background-color: #00517b;
      color: #ffffff;
      font-family: Georgia, serif;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      text-align: center;
    }
    h1 {
      font-size: 2.5em;
      margin: 0 0 0.5em 0;
      padding: 0 1em;
    }
    .author {
      font-size: 1.2em;
      font-style: italic;
    }
  </style>
</head>
<body epub:type="cover">
  <h1>${escapeHtml(metadata.title || 'Untitled')}</h1>
  <p class="author">${escapeHtml(metadata.author || 'Anonymous')}</p>
</body>
</html>`;
  }
}

/**
 * Create EPUB 3.0 content.opf file
 */
function createEpub3ContentOPF(
  chapters: Chapter[],
  metadata: any,
  coverImageId: string | null = null,
  inlineImages?: Array<{filename: string, data: Uint8Array}>,
  noMatterSections?: Chapter[],
  uuid?: string,
  coverImageInfo?: { extension: string; mediaType: string } | null,
  inlineAudios?: Array<{filename: string, data: Uint8Array}>,
  hasVnContent?: boolean
): string {
  // Use provided UUID or generate a new one (for backwards compatibility)
  const bookId = uuid || generateUUID();
  const date = new Date().toISOString().split('T')[0];
  // dcterms:modified requires format CCYY-MM-DDThh:mm:ssZ (no milliseconds)
  const modifiedDate = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  // Cover metadata and manifest - always include cover page, optionally include cover image
  let coverMeta = '';
  let coverManifest = '';
  // Cover page is always included (with image or text fallback)
  const coverPageManifest = `    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>`;

  if (coverImageId && coverImageInfo) {
    coverMeta = `    <meta name="cover" content="${coverImageId}"/>`;
    coverManifest = `    <item id="${coverImageId}" href="images/cover.${coverImageInfo.extension}" media-type="${coverImageInfo.mediaType}" properties="cover-image"/>`;
  } else if (coverImageId) {
    // Fallback for backwards compatibility (shouldn't happen with new code)
    coverMeta = `    <meta name="cover" content="${coverImageId}"/>`;
    coverManifest = `    <item id="${coverImageId}" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`;
  }

  // Inline images manifest entries
  let inlineImagesManifest = '';
  if (inlineImages && inlineImages.length > 0) {
    inlineImagesManifest = inlineImages
      .map(img => {
        // Create safe ID from filename (replace non-alphanumeric with dash)
        const safeId = `img-${img.filename.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const mediaType = getImageMediaType(img.filename);
        return `    <item id="${safeId}" href="images/${img.filename}" media-type="${mediaType}"/>`;
      })
      .join('\n');
  }

  // Audio manifest entries (Visual Narrative)
  let inlineAudiosManifest = '';
  if (inlineAudios && inlineAudios.length > 0) {
    inlineAudiosManifest = inlineAudios
      .map(aud => {
        const safeId = `audio-${aud.filename.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const mediaType = getAudioMediaType(aud.filename);
        return `    <item id="${safeId}" href="audio/${aud.filename}" media-type="${mediaType}"/>`;
      })
      .join('\n');
  }

  // VN CSS manifest entry
  const vnCssManifest = hasVnContent
    ? `    <item id="vn-style" href="css/visual-narrative.css" media-type="text/css"/>`
    : '';

  const manifest = chapters
    .map(ch => `    <item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n');

  // No Matter manifest entries (in nomatter/ folder)
  let noMatterManifest = '';
  if (noMatterSections && noMatterSections.length > 0) {
    noMatterManifest = noMatterSections
      .map(s => `    <item id="${s.id}" href="nomatter/${s.id}.xhtml" media-type="application/xhtml+xml"/>`)
      .join('\n');
  }

  // Build spine items - cover page is always first
  // No Matter sections come last with linear="no"
  const spineItems = [
    '    <itemref idref="cover-page"/>',
    '    <itemref idref="title-page"/>',
    '    <itemref idref="copyright"/>',
    '    <itemref idref="contents"/>',
    ...chapters.map(ch => `    <itemref idref="${ch.id}"/>`),
    ...(metadata.aboutAuthor && metadata.aboutAuthor.trim() ? ['    <itemref idref="about-author"/>'] : []),
    // No Matter sections with linear="no" (excluded from linear reading flow)
    ...(noMatterSections ? noMatterSections.map(s => `    <itemref idref="${s.id}" linear="no"/>`) : [])
  ].join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" prefix="cc: http://creativecommons.org/ns#">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${bookId}</dc:identifier>
    <dc:title>${escapeHtml(metadata.displayTitle)}</dc:title>
    <dc:creator>${escapeHtml(metadata.author)}</dc:creator>
    <dc:language>${metadata.language}</dc:language>
    <dc:publisher>${escapeHtml(metadata.publisher || 'Independent Publisher')}</dc:publisher>
    <dc:description>${escapeHtml(metadata.description)}</dc:description>
    <dc:date>${date}</dc:date>
    <meta property="dcterms:modified">${modifiedDate}</meta>
${coverMeta}
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
${coverPageManifest}
    <item id="title-page" href="title-page.xhtml" media-type="application/xhtml+xml"/>
    <item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/>
    <item id="contents" href="contents.xhtml" media-type="application/xhtml+xml"/>
    ${metadata.aboutAuthor && metadata.aboutAuthor.trim() ? '<item id="about-author" href="about-author.xhtml" media-type="application/xhtml+xml"/>' : ''}
    <item id="style" href="css/style.css" media-type="text/css"/>
${coverManifest}
${inlineImagesManifest}
${inlineAudiosManifest}
${vnCssManifest}
${manifest}
${noMatterManifest}
  </manifest>
  <spine toc="toc">
${spineItems}
  </spine>
</package>`;
}

/**
 * Create NCX file for EPUB 2 compatibility
 */
function createTocNCX(chapters: Chapter[], metadata: any, uuid?: string): string {
  // Use provided UUID or generate a new one (for backwards compatibility)
  // IMPORTANT: This UUID must match the one in content.opf for EPUBCheck validation
  const bookId = uuid || generateUUID();

  const navPoints = [];
  let playOrder = 1;

  // Add title page
  navPoints.push(`    <navPoint id="navpoint-${playOrder}" playOrder="${playOrder}">
      <navLabel>
        <text>Title Page</text>
      </navLabel>
      <content src="title-page.xhtml"/>
    </navPoint>`);
  playOrder++;

  // Add copyright page
  navPoints.push(`    <navPoint id="navpoint-${playOrder}" playOrder="${playOrder}">
      <navLabel>
        <text>Copyright</text>
      </navLabel>
      <content src="copyright.xhtml"/>
    </navPoint>`);
  playOrder++;

  // Add contents
  navPoints.push(`    <navPoint id="navpoint-${playOrder}" playOrder="${playOrder}">
      <navLabel>
        <text>Contents</text>
      </navLabel>
      <content src="contents.xhtml"/>
    </navPoint>`);
  playOrder++;

  // Add chapters
  chapters.forEach(chapter => {
    navPoints.push(`    <navPoint id="navpoint-${playOrder}" playOrder="${playOrder}">
      <navLabel>
        <text>${escapeHtml(chapter.title)}</text>
      </navLabel>
      <content src="${chapter.id}.xhtml"/>
    </navPoint>`);
    playOrder++;
  });

  // Add about author page (only if metadata exists)
  if (metadata.aboutAuthor && metadata.aboutAuthor.trim()) {
    navPoints.push(`    <navPoint id="navpoint-${playOrder}" playOrder="${playOrder}">
      <navLabel>
        <text>About the Author</text>
      </navLabel>
      <content src="about-author.xhtml"/>
    </navPoint>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeHtml(metadata.displayTitle)}</text>
  </docTitle>
  <docAuthor>
    <text>${escapeHtml(metadata.author)}</text>
  </docAuthor>
  <navMap>
${navPoints.join('\n')}
  </navMap>
</ncx>`;
}

/**
 * Create EPUB 3.0 navigation document
 * Includes No Matter sections under "Author's Notes" (makes them reachable, fixes OPF-096)
 */
function createNavXHTML(chapters: Chapter[], metadata: any, noMatterSections?: Chapter[]): string {
  const navItems = [
    '      <li><a href="title-page.xhtml">Title Page</a></li>',
    '      <li><a href="copyright.xhtml">Copyright</a></li>',
    '      <li><a href="contents.xhtml">Contents</a></li>',
    ...chapters.map(ch => `      <li><a href="${ch.id}.xhtml">${escapeHtml(ch.title)}</a></li>`),
    ...(metadata.aboutAuthor && metadata.aboutAuthor.trim() ? ['      <li><a href="about-author.xhtml">About the Author</a></li>'] : [])
  ];

  // Add No Matter sections under "Author's Notes" heading (nested list)
  if (noMatterSections && noMatterSections.length > 0) {
    const noMatterSubItems = noMatterSections
      .map(s => `          <li><a href="nomatter/${s.id}.xhtml">${escapeHtml(s.title)}</a></li>`)
      .join('\n');
    navItems.push(`      <li>
        <span>Author's Notes</span>
        <ol>
${noMatterSubItems}
        </ol>
      </li>`);
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Navigation</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Table of Contents</h1>
    <ol>
${navItems.join('\n')}
    </ol>
  </nav>
</body>
</html>`;
}

/**
 * Create Kindle-compatible CSS (exact copy from working code)
 */
function createFullWidthCSS(): string {
  return `/* EverythingEbooks EPUB - Kindle-Compatible CSS */

/* Reset and base styles */
html {
  font-size: 100%;
}

body {
  font-family: serif;
  line-height: 1.6;
  margin: 1em;
  padding: 0;
  text-align: left;
}

/* Title page */
.title-page {
  text-align: center;
  page-break-after: always;
  margin: 0;
  padding: 0;
}

.book-title {
  text-align: center;
  font-size: 1.8em;
  font-weight: bold;
  margin: 0;
  padding-top: 25%;  /* Position from top */
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.book-subtitle {
  text-align: center;
  font-size: 1.1em;
  font-style: italic;
  margin: 0;
  padding-top: 5%;
}

.book-author {
  text-align: center;
  font-size: 1.3em;
  margin: 0;
  padding-top: 20%;  /* Space from title */
  font-weight: normal;
}

.book-publisher {
  text-align: center;
  font-size: 1em;
  margin: 0;
  padding-top: 20%;  /* Space from author */
  font-weight: normal;
}

/* Copyright page */
.copyright-page {
  page-break-after: always;
  margin: 2em 0;
}

.copyright-page p {
  text-align: left;
  margin: 0.8em 0;
  text-indent: 0;
  font-size: 0.9em;
}

/* Contents page */
.contents-page {
  page-break-after: always;
  margin: 2em 0;
}

.toc-title {
  text-align: center;
  font-size: 1.5em;
  margin: 2em 0;
  font-weight: bold;
  text-transform: uppercase;
}

.toc-contents {
  margin: 1em 0;
  padding: 0;
}

.toc-item {
  margin: 1em 0;
  text-align: left;
}

.toc-content {
  margin: 0;
  text-indent: 0;
}

.toc-content a {
  text-decoration: none;
  color: inherit;
}

.toc-item-title {
  display: inline;
}

/* TOC section header (e.g., "Author's Notes") */
.toc-section-header {
  margin: 2em 0 0.5em 0;
}

.toc-section-title {
  font-weight: bold;
  font-style: italic;
  margin: 0;
  text-indent: 0;
}

/* Chapter styles */
.chapter {
  page-break-before: always;
  margin: 0;
}

h1 {
  font-size: 1.5em;
  font-weight: bold;
  margin: 3em 0 2em 0;
  text-align: center;
  page-break-after: avoid;
}

p {
  margin: 0 0 1em 0;
  text-indent: 1.5em;
  text-align: justify;
  line-height: 1.6;
}

/* First paragraph after chapter heading */
.chapter p:first-of-type {
  text-indent: 0;
  margin-top: 1.5em;
}

/* Inline images */
.image-container {
  text-align: center;
  margin: 1.5em 0;
  page-break-inside: avoid;
}

.image-container img {
  max-width: 100%;
  height: auto;
}

/* About author page */
.about-author-page {
  page-break-before: always;
  margin: 2em 0;
}

.about-author-page h1 {
  text-align: center;
  font-size: 1.5em;
  margin: 2em 0;
  font-weight: bold;
}

.about-author-page p {
  text-align: left;
  text-indent: 1.5em;
  margin: 0 0 1em 0;
}

.about-author-page p:first-of-type {
  text-indent: 0;
}

/* Navigation styles */
nav h1 {
  text-align: center;
  font-size: 1.5em;
  margin: 2em 0;
  font-weight: bold;
}

nav ol {
  list-style: none;
  margin: 1em 0;
  padding: 0;
}

nav li {
  margin: 1em 0;
  text-align: left;
}

nav a {
  text-decoration: none;
  color: inherit;
}

/* Basic responsive adjustments */
@media screen and (max-width: 600px) {
  body {
    margin: 0.5em;
  }

  .book-title {
    font-size: 1.5em;
  }

  h1 {
    font-size: 1.3em;
  }
}`;
}

/**
 * Generate a simple UUID
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
