// lib/epub-processing-utils.ts
// Client-side EPUB to text conversion for local-first operation
// Adapted from epub-conversion-actions.ts for browser environment

import JSZip from 'jszip';

interface ChapterData {
  title: string;
  textBlocks: string[];
}

interface ConversionResult {
  text: string;
  chapterCount: number;
  wordCount: number;
}

/**
 * Convert an EPUB file (as ArrayBuffer) to plain text
 * Uses browser's native DOMParser instead of @xmldom/xmldom
 */
export async function convertEpubToText(epubBuffer: ArrayBuffer): Promise<ConversionResult> {
  const chapters = await processEpub(epubBuffer);

  if (chapters.length === 0) {
    throw new Error('No chapters found in EPUB file');
  }

  // Generate text content: 2 blank lines BEFORE chapter titles, 1 blank line between paragraphs
  let allText = '';
  chapters.forEach((ch) => {
    // 2 blank lines BEFORE every chapter
    if (allText.length === 0) {
      allText += '\n\n';      // Start of file: 2 newlines = 2 blank lines
    } else {
      allText += '\n\n\n';    // After content: 3 newlines = 2 blank lines (1st ends prev line)
    }

    if (ch.title) {
      allText += ch.title + '\n\n';  // title + 1 blank line AFTER
    }

    allText += ch.textBlocks.join('\n\n');  // 1 blank line between paragraphs
  });

  return {
    text: allText,
    chapterCount: chapters.length,
    wordCount: countWords(allText)
  };
}

/**
 * Process an EPUB file and extract chapters
 */
async function processEpub(fileData: ArrayBuffer): Promise<ChapterData[]> {
  const zip = await JSZip.loadAsync(fileData);

  // 1. Locate the OPF file via META-INF/container.xml
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) throw new Error('META-INF/container.xml not found.');

  const containerXml = stripBOM(await containerFile.async('text'));
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');

  const rootfileElement = containerDoc.getElementsByTagName('rootfile')[0];
  if (!rootfileElement) throw new Error('OPF file reference not found.');

  const opfPath = rootfileElement.getAttribute('full-path');
  if (!opfPath) throw new Error('OPF file path is missing.');

  // Get the base path (e.g. if opfPath is "OEBPS/content.opf", base = "OEBPS/")
  const basePath = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';

  // 2. Read the OPF file
  const opfFile = zip.file(opfPath);
  if (!opfFile) throw new Error('OPF file not found: ' + opfPath);

  const opfXml = stripBOM(await opfFile.async('text'));
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');

  // 3. Build a manifest (id → href)
  const manifest: Record<string, string> = {};
  const items = opfDoc.getElementsByTagName('item');
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) {
      manifest[id] = href;
    }
  }

  // 4. Get the spine (reading order)
  const spineItems: string[] = [];
  const itemrefs = opfDoc.getElementsByTagName('itemref');
  for (let i = 0; i < itemrefs.length; i++) {
    const itemref = itemrefs[i];
    if (!itemref) continue;
    const idref = itemref.getAttribute('idref');
    if (idref && manifest[idref]) {
      spineItems.push(manifest[idref]);
    }
  }

  // 5. Process each chapter file from the spine
  const chapters: ChapterData[] = [];

  // Define a list of unwanted titles
  const unwantedTitles = ['TITLE PAGE', 'COPYRIGHT'];

  for (const itemHref of spineItems) {
    const chapterPath = basePath + itemHref;
    const chapterFile = zip.file(chapterPath);

    if (!chapterFile) {
      continue;
    }

    const chapterContent = await chapterFile.async('text');

    // Parse the chapter content into a DOM
    const doc = parser.parseFromString(chapterContent, 'text/html');

    // Extract and store the title from the first <h1>, then remove it from DOM
    let title = '';
    const h1Elements = doc.getElementsByTagName('h1');
    if (h1Elements.length > 0 && h1Elements[0]) {
      title = h1Elements[0].textContent?.trim() || '';

      // Filter out unwanted titles
      if (unwantedTitles.includes(title.toUpperCase())) {
        continue;
      }

      // Remove h1 from DOM so it's not duplicated in body text
      h1Elements[0].remove();
    }

    // Extract paragraphs from <p> elements to preserve structure
    const paragraphs = doc.getElementsByTagName('p');
    let textBlocks: string[] = [];

    if (paragraphs.length > 0) {
      for (let i = 0; i < paragraphs.length; i++) {
        const text = paragraphs[i]?.textContent?.trim();
        if (text) textBlocks.push(text);
      }
    } else {
      // Fallback for EPUBs without <p> tags: use body.textContent
      const bodyElements = doc.getElementsByTagName('body');
      if (bodyElements.length > 0 && bodyElements[0]) {
        const bodyText = bodyElements[0].textContent?.trim() || '';
        textBlocks = bodyText.split(/\n\s*\n/).filter(block => block.trim() !== '');
      }
    }

    // Special handling for CONTENTS page
    if (title.toUpperCase() === 'CONTENTS') {
      for (let i = 0; i < textBlocks.length; i++) {
        const block = textBlocks[i];
        if (!block) continue;
        // If a line is non-empty and does not start with whitespace, add an indent
        if (block.trim() && !/^\s/.test(block)) {
          textBlocks[i] = '        ' + block;
        }
      }
    }

    // If no title and content is too short, skip this chapter
    if (!title && textBlocks.join('').length < 100) {
      continue;
    }

    chapters.push({
      title: title,
      textBlocks: textBlocks
    });
  }

  return chapters;
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Strip BOM (Byte Order Mark) from XML content
 * Some EPUBs have UTF-8 BOM at the start which breaks XML parsing
 */
function stripBOM(content: string): string {
  // UTF-8 BOM is \uFEFF, UTF-16 BE is \uFFFE, UTF-16 LE is \uFEFF
  if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
    return content.slice(1);
  }
  return content;
}
