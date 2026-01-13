// services/epubService.ts
// Client-side epub parsing service

import JSZip from 'jszip';
import { extractMarkdownFromHtml } from './htmlExtractor';
import { ElementType } from '@/app/authors/elementTypes';

export interface ParsedSection {
  id: string;
  title: string;
  href: string;
  content: string;
  type?: ElementType;
}

export interface ParsedEpub {
  title: string;
  author: string;
  language: string;
  coverImage: Blob | null;
  sections: ParsedSection[];
  images?: Array<{filename: string, blob: Blob}>;  // Inline images (not cover), optional for backwards compatibility
}

/**
 * Infer section type from title for formatting support.
 * Only structural/metadata sections are non-chapters.
 */
function inferSectionType(title: string): ElementType {
  const lowerTitle = title.toLowerCase();

  // Only truly structural/metadata sections are non-chapters
  // (these don't need markdown formatting)
  if (lowerTitle === 'cover') return 'cover';
  if (lowerTitle.includes('title page')) return 'title-page';
  if (lowerTitle.includes('copyright')) return 'copyright';
  if (lowerTitle.includes('table of contents') || lowerTitle === 'contents') return 'table-of-contents';
  if (lowerTitle.includes('about the author')) return 'about-the-author';
  if (lowerTitle.includes('also by')) return 'also-by';

  // Everything else is author-written content that should support formatting:
  // - Chapters, Prologue, Epilogue, Introduction, Preface, Afterword,
  //   Acknowledgments, Dedication, etc.
  return 'chapter';
}

/**
 * Parse an epub file and extract its content as plain text sections.
 */
export async function parseEpub(file: File): Promise<ParsedEpub> {
  // Load the zip
  const zip = await JSZip.loadAsync(file);

  // Step 1: Find the rootfile path from container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) {
    throw new Error('Invalid epub: missing META-INF/container.xml');
  }

  const rootfilePath = parseRootfilePath(containerXml);
  if (!rootfilePath) {
    throw new Error('Invalid epub: could not find rootfile path');
  }

  // Get the base directory (e.g., "OEBPS/" from "OEBPS/content.opf")
  const baseDir = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);

  // Step 2: Parse content.opf
  const contentOpf = await zip.file(rootfilePath)?.async('string');
  if (!contentOpf) {
    throw new Error(`Invalid epub: missing ${rootfilePath}`);
  }

  const { title, author, language, manifest, spine, coverImageId } = parseContentOpf(contentOpf);

  // Step 3: Extract cover image if present
  let coverImage: Blob | null = null;
  if (coverImageId) {
    const coverItem = manifest.get(coverImageId);
    if (coverItem) {
      const coverPath = baseDir + coverItem.href;
      const coverData = await zip.file(coverPath)?.async('blob');
      if (coverData) {
        // Create blob with correct media type
        coverImage = new Blob([coverData], { type: coverItem.mediaType });
      }
    }
  }

  // Step 3b: Extract inline images (all images except cover)
  const images: Array<{filename: string, blob: Blob}> = [];
  for (const [id, item] of manifest) {
    // Skip if not an image or if it's the cover
    if (!item.mediaType.startsWith('image/')) continue;
    if (id === coverImageId) continue;

    try {
      const imagePath = baseDir + item.href;
      const imageData = await zip.file(imagePath)?.async('blob');
      if (imageData) {
        // Extract just the filename from the href
        const filename = item.href.split('/').pop() || item.href;
        const blob = new Blob([imageData], { type: item.mediaType });
        images.push({ filename, blob });
      }
    } catch {
      // Skip images that fail to load
      console.warn(`Failed to extract image: ${item.href}`);
    }
  }

  // Step 4: Find and parse TOC to get section titles
  // Look for TOC.xhtml, nav.xhtml, or toc.ncx
  const tocTitles = await parseToc(zip, baseDir, manifest);

  // Step 5: For each spine item, read the HTML and extract text
  const sections: ParsedSection[] = [];

  for (const spineItem of spine) {
    const manifestItem = manifest.get(spineItem.idref);
    if (!manifestItem) continue;

    const href = manifestItem.href;
    const fullPath = baseDir + href;

    // Read the HTML file
    const html = await zip.file(fullPath)?.async('string');
    if (!html) continue;

    // Extract text with markdown formatting preserved
    const content = extractMarkdownFromHtml(html);

    // Get title from TOC, or fall back to HTML <title> or generate one
    let sectionTitle = tocTitles.get(href) || '';
    if (!sectionTitle) {
      // Try to get from HTML <title>
      sectionTitle = extractHtmlTitle(html) || `Section ${sections.length + 1}`;
    }

    // If linear="no", this is No Matter content (non-linear in reading flow)
    // Otherwise, infer type from title
    const sectionType: ElementType = spineItem.linear === false
      ? 'no-matter'
      : inferSectionType(sectionTitle);

    sections.push({
      id: spineItem.idref,
      title: sectionTitle,
      href: href,
      content: content,
      type: sectionType,
    });
  }

  // Enforce first 3 sections: Cover, Title Page, Copyright (in that order)
  // These sections cannot be deleted or moved by the user
  const year = new Date().getFullYear();

  // Helper to find a section by id or title
  const findSection = (id: string, titleKeyword: string) =>
    sections.find(s => s.id === id || s.title.toLowerCase() === titleKeyword);

  // Extract existing protected sections (if any)
  const existingCover = findSection('cover', 'cover');
  const existingTitlePage = findSection('title-page', 'title page');
  const existingCopyright = findSection('copyright', 'copyright');

  // Remove existing protected sections from their current positions
  const otherSections = sections.filter(s =>
    s !== existingCover && s !== existingTitlePage && s !== existingCopyright
  );

  // Create Cover section (use existing or create new)
  const coverSection: ParsedSection = existingCover || {
    id: 'cover',
    title: 'Cover',
    href: 'cover.xhtml',
    content: 'Use Format > Image to add your cover image',
    type: 'cover',
  };
  if (!coverSection.type) coverSection.type = 'cover';

  // Create Title Page section (use existing or create new)
  const titlePageSection: ParsedSection = existingTitlePage || {
    id: 'title-page',
    title: 'Title Page',
    href: 'title-page.xhtml',
    content: `${title || 'Untitled'}\n\nby ${author || 'Anonymous'}`,
    type: 'title-page',
  };
  if (!titlePageSection.type) titlePageSection.type = 'title-page';

  // Create Copyright section (use existing or create new)
  const copyrightSection: ParsedSection = existingCopyright || {
    id: 'copyright',
    title: 'Copyright',
    href: 'copyright.xhtml',
    content: `Copyright © ${year} by ${author || 'Anonymous'}\n\nAll rights reserved.\n\nNo part of this book may be reproduced in any form or by any electronic or mechanical means, including information storage and retrieval systems, without written permission from the author, except for the use of brief quotations in a book review.`,
    type: 'copyright',
  };
  if (!copyrightSection.type) copyrightSection.type = 'copyright';

  // Rebuild sections array with protected sections first
  const orderedSections = [coverSection, titlePageSection, copyrightSection, ...otherSections];

  return {
    title: title || 'Untitled',
    author: author || '',
    language: language || 'en',
    coverImage,
    sections: orderedSections,
    images,
  };
}

/**
 * Parse the rootfile path from container.xml
 */
function parseRootfilePath(containerXml: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(containerXml, 'text/xml');

  // Find <rootfile> element
  const rootfile = doc.querySelector('rootfile');
  if (rootfile) {
    return rootfile.getAttribute('full-path');
  }

  return null;
}

/**
 * Parse content.opf to extract metadata, manifest, and spine
 */
function parseContentOpf(opfContent: string): {
  title: string;
  author: string;
  language: string;
  manifest: Map<string, { id: string; href: string; mediaType: string; properties: string }>;
  spine: { idref: string; linear: boolean }[];
  coverImageId: string | null;
} {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opfContent, 'text/xml');

  // Extract metadata
  const titleEl = doc.querySelector('metadata > title, metadata > dc\\:title');
  const title = titleEl?.textContent || '';

  const creatorEl = doc.querySelector('metadata > creator, metadata > dc\\:creator');
  const author = creatorEl?.textContent || '';

  const languageEl = doc.querySelector('metadata > language, metadata > dc\\:language');
  const language = languageEl?.textContent || 'en';

  // Extract manifest (including properties for cover-image detection)
  const manifest = new Map<string, { id: string; href: string; mediaType: string; properties: string }>();
  let coverImageId: string | null = null;

  const manifestItems = doc.querySelectorAll('manifest > item');
  manifestItems.forEach((item) => {
    const id = item.getAttribute('id') || '';
    const href = item.getAttribute('href') || '';
    const mediaType = item.getAttribute('media-type') || '';
    const properties = item.getAttribute('properties') || '';
    if (id && href) {
      manifest.set(id, { id, href, mediaType, properties });
      // Check for cover-image property (EPUB 3)
      if (properties.includes('cover-image')) {
        coverImageId = id;
      }
    }
  });

  // If no cover-image property found, look for EPUB 2 style meta cover
  if (!coverImageId) {
    const coverMeta = doc.querySelector('metadata > meta[name="cover"]');
    if (coverMeta) {
      coverImageId = coverMeta.getAttribute('content') || null;
    }
  }

  // Extract spine
  const spine: { idref: string; linear: boolean }[] = [];
  const spineItems = doc.querySelectorAll('spine > itemref');
  spineItems.forEach((item) => {
    const idref = item.getAttribute('idref') || '';
    const linear = item.getAttribute('linear') !== 'no';
    if (idref) {
      spine.push({ idref, linear });
    }
  });

  return { title, author, language, manifest, spine, coverImageId };
}

/**
 * Parse TOC to get section titles mapped to hrefs
 */
async function parseToc(
  zip: JSZip,
  baseDir: string,
  manifest: Map<string, { id: string; href: string; mediaType: string; properties: string }>
): Promise<Map<string, string>> {
  const tocTitles = new Map<string, string>();

  // Look for TOC file in manifest
  // Common IDs: "ncx", "toc", "nav", or files named "toc.ncx", "TOC.xhtml", "nav.xhtml"
  let tocHref: string | null = null;
  let tocType: 'ncx' | 'xhtml' = 'xhtml';

  // First, try to find nav/toc xhtml
  for (const [id, item] of manifest) {
    const lowerHref = item.href.toLowerCase();
    const lowerId = id.toLowerCase();
    if (
      lowerHref.includes('toc') && lowerHref.endsWith('.xhtml') ||
      lowerHref.includes('toc') && lowerHref.endsWith('.html') ||
      lowerHref.includes('nav') && lowerHref.endsWith('.xhtml') ||
      lowerId === 'toc' || lowerId === 'nav'
    ) {
      tocHref = item.href;
      tocType = 'xhtml';
      break;
    }
  }

  // If not found, try toc.ncx
  if (!tocHref) {
    for (const [id, item] of manifest) {
      if (item.href.toLowerCase().endsWith('.ncx') || id.toLowerCase() === 'ncx') {
        tocHref = item.href;
        tocType = 'ncx';
        break;
      }
    }
  }

  if (!tocHref) {
    return tocTitles;
  }

  const tocContent = await zip.file(baseDir + tocHref)?.async('string');
  if (!tocContent) {
    return tocTitles;
  }

  if (tocType === 'xhtml') {
    // Parse XHTML TOC
    const parser = new DOMParser();
    const doc = parser.parseFromString(tocContent, 'text/html');

    // Find the toc nav element (not landmarks or other navs)
    const tocNav = doc.querySelector('nav[epub\\:type="toc"], nav[role="doc-toc"]');
    // Get links from toc nav only, fallback to all links if no toc nav found
    const links = tocNav ? tocNav.querySelectorAll('a[href]') : doc.querySelectorAll('a[href]');
    links.forEach((link) => {
      let href = link.getAttribute('href') || '';
      const title = link.textContent?.trim() || '';

      // Remove fragment identifier (#...)
      if (href.includes('#')) {
        href = href.split('#')[0] ?? '';
      }

      // Handle relative paths (../Text/001.html -> Text/001.html)
      if (href.startsWith('../')) {
        href = href.substring(3);
      }

      if (href && title) {
        tocTitles.set(href, title);
      }
    });
  } else {
    // Parse NCX TOC
    const parser = new DOMParser();
    const doc = parser.parseFromString(tocContent, 'text/xml');

    const navPoints = doc.querySelectorAll('navPoint');
    navPoints.forEach((navPoint) => {
      const textEl = navPoint.querySelector('navLabel > text');
      const contentEl = navPoint.querySelector('content');

      const title = textEl?.textContent?.trim() || '';
      let href = contentEl?.getAttribute('src') || '';

      // Remove fragment identifier
      if (href.includes('#')) {
        href = href.split('#')[0] ?? '';
      }

      if (href && title) {
        tocTitles.set(href, title);
      }
    });
  }

  return tocTitles;
}

/**
 * Extract the <title> from an HTML document
 */
function extractHtmlTitle(html: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return doc.querySelector('title')?.textContent?.trim() || '';
}
