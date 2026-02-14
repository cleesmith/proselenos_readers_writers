// services/htmlReadingService.ts
// Opens an EPUB book from the library as a single-page HTML in a new tab.
// Reuses the same HTML generation pipeline as Authors Mode's "Menu > HTML" export.

import JSZip from 'jszip';
import { parseEpub } from '@/services/epubService';
import { generateHtmlFromSections, openHtmlInNewTab } from '@/lib/html-generator';
import { getLocalBookFilename } from '@/utils/book';
import { Book } from '@/types/book';
import { EnvConfigType } from '@/services/environment';

/**
 * Extract audio files from an EPUB zip.
 * Independently parses the EPUB manifest to find audio/* items,
 * without modifying the existing parseEpub() pipeline.
 */
async function extractAudioFromEpub(
  file: File
): Promise<Array<{ filename: string; blob: Blob }>> {
  const zip = await JSZip.loadAsync(file);

  // Find rootfile path from container.xml
  const containerXml = await zip.file('META-INF/container.xml')?.async('string');
  if (!containerXml) return [];

  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'text/xml');
  const rootfilePath = containerDoc.querySelector('rootfile')?.getAttribute('full-path');
  if (!rootfilePath) return [];

  const baseDir = rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1);

  // Parse content.opf manifest for audio items
  const opfContent = await zip.file(rootfilePath)?.async('string');
  if (!opfContent) return [];

  const opfDoc = parser.parseFromString(opfContent, 'text/xml');
  const audioItems: Array<{ href: string; mediaType: string }> = [];

  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const href = item.getAttribute('href') || '';
    const mediaType = item.getAttribute('media-type') || '';
    if (href && mediaType.startsWith('audio/')) {
      audioItems.push({ href, mediaType });
    }
  });

  // Extract the actual audio blobs from the zip
  const results: Array<{ filename: string; blob: Blob }> = [];
  for (const entry of audioItems) {
    try {
      const audioPath = baseDir + entry.href;
      const audioData = await zip.file(audioPath)?.async('blob');
      if (audioData) {
        const filename = entry.href.split('/').pop() || entry.href;
        const blob = new Blob([audioData], { type: entry.mediaType });
        results.push({ filename, blob });
      }
    } catch {
      console.warn(`Failed to extract audio: ${entry.href}`);
    }
  }

  return results;
}

/**
 * Convert a Blob to a base64 data URL string.
 * Uses chunked encoding to avoid call-stack overflow on large files.
 */
async function blobToDataUrl(blob: Blob, filename: string): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  // Use blob's own MIME type if available and meaningful
  if (blob.type && blob.type !== 'application/octet-stream') {
    return `data:${blob.type};base64,${base64}`;
  }

  // Fallback: infer from extension (images + audio)
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeMap: Record<string, string> = {
    png: 'image/png', gif: 'image/gif',
    svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', m4a: 'audio/mp4',
    aac: 'audio/aac', webm: 'audio/webm', wav: 'audio/wav',
  };
  const mime = mimeMap[ext] || 'application/octet-stream';
  return `data:${mime};base64,${base64}`;
}

/**
 * Open a library book as a styled HTML page in a new browser tab.
 *
 * Pipeline: IndexedDB EPUB file → parseEpub → base64 images → generateHtmlFromSections → new tab
 */
export async function openBookAsHtml(
  book: Book,
  envConfig: EnvConfigType,
  isDarkMode: boolean,
): Promise<void> {
  // 1. Fetch the EPUB file from IndexedDB
  const appService = await envConfig.getAppService();
  const file = await appService.openFile(getLocalBookFilename(book), 'Books');

  // 2. Parse the EPUB into sections, images, and metadata
  const parsed = await parseEpub(file);

  // 3. Convert inline images to base64 data URLs
  const mediaDataUrls: Record<string, string> = {};
  if (parsed.images) {
    for (const img of parsed.images) {
      mediaDataUrls[`images/${img.filename}`] = await blobToDataUrl(img.blob, img.filename);
    }
  }

  // 4. Extract and convert audio files from the EPUB
  const audios = await extractAudioFromEpub(file);
  for (const aud of audios) {
    mediaDataUrls[`audio/${aud.filename}`] = await blobToDataUrl(aud.blob, aud.filename);
  }

  // 5. Convert cover image to base64 data URL
  let coverImageDataUrl: string | undefined;
  if (parsed.coverImage) {
    coverImageDataUrl = await blobToDataUrl(parsed.coverImage, 'cover.jpg');
  }

  // 6. Generate the single-page HTML
  const html = generateHtmlFromSections({
    title: parsed.title || book.title || 'Untitled',
    author: parsed.author || book.author || 'Unknown Author',
    year: new Date().getFullYear().toString(),
    sections: parsed.sections.map(s => ({
      title: s.title,
      content: s.xhtml,
    })),
    isDarkMode,
    mediaDataUrls,
    coverImageDataUrl,
  });

  // 7. Open in new tab
  openHtmlInNewTab(html);
}
