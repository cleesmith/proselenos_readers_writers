// epub-to-pdf.ts
//
// Client-side epub → print PDF using JSZip + Paged.js

import JSZip from 'jszip';
import { PRINT_CSS } from './print-styles';

export interface PdfOptions {
  title: string;
  author: string;
  publisher?: string;      // e.g. "Slip the Trap"
  year?: string;           // e.g. "2026"
  copyright?: string;      // custom copyright text, or auto-generated
  includeToc?: boolean;    // default true
}

// ─── 1. Parse the epub's OPF to get spine-ordered XHTML paths ───

async function getSpineItems(zip: JSZip): Promise<string[]> {
  // Find container.xml → rootfile path
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) throw new Error('No container.xml found in epub');

  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');
  const rootfilePath =
    containerDoc.querySelector('rootfile')?.getAttribute('full-path') ?? '';

  if (!rootfilePath) throw new Error('No rootfile path in container.xml');

  // Parse the OPF
  const opfText = await zip.file(rootfilePath)?.async('text');
  if (!opfText) throw new Error(`Cannot read OPF at ${rootfilePath}`);

  const opfDoc = parser.parseFromString(opfText, 'application/xml');
  const opfDir = rootfilePath.includes('/')
    ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1)
    : '';

  // Build manifest id → href map
  const manifest = new Map<string, string>();
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id') ?? '';
    const href = item.getAttribute('href') ?? '';
    manifest.set(id, href);
  });

  // Walk the spine in order
  const spineItems: string[] = [];
  opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
    const idref = ref.getAttribute('idref') ?? '';
    const href = manifest.get(idref);
    if (href) {
      spineItems.push(opfDir + href);
    }
  });

  return spineItems;
}

// ─── 2. Extract chapter HTML bodies and inline images as base64 ───

interface ChapterData {
  title: string;
  html: string;
  id: string;         // anchor id for TOC links
}

// Paths that are typically front matter in epubs — we skip these
// since we generate our own title/copyright/toc pages
const FRONT_MATTER_PATTERNS = [
  /title[-_]?page/i,
  /cover/i,
  /copyright/i,
  /toc/i,
  /^contents\.x?html/i,
  /table[-_]?of[-_]?contents/i,
  /nav\.x?html/i,
  /frontmatter/i,
  /halftitle/i,
  /dedication/i,
];

function isFrontMatter(path: string): boolean {
  const filename = path.split('/').pop() ?? '';
  return FRONT_MATTER_PATTERNS.some((pat) => pat.test(filename));
}

async function extractChapters(
  zip: JSZip,
  spinePaths: string[]
): Promise<ChapterData[]> {
  const chapters: ChapterData[] = [];

  for (const path of spinePaths) {
    // Skip epub's own front matter — we generate ours
    if (isFrontMatter(path)) continue;

    const xhtml = await zip.file(path)?.async('text');
    if (!xhtml) continue;

    const parser = new DOMParser();
    const doc = parser.parseFromString(xhtml, 'application/xhtml+xml');
    const body = doc.querySelector('body');
    if (!body) continue;

    // Skip if body is basically empty (some epubs have blank spacer files)
    const textContent = body.textContent?.trim() ?? '';
    if (textContent.length < 10 && !body.querySelector('img')) continue;

    // Convert relative image srcs to base64 data URIs
    const chapterDir = path.includes('/')
      ? path.substring(0, path.lastIndexOf('/') + 1)
      : '';

    const images = body.querySelectorAll('img');
    for (const img of Array.from(images)) {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) continue;

      const imgPath = chapterDir + src;
      const imgFile = zip.file(imgPath);
      if (imgFile) {
        const blob = await imgFile.async('base64');
        const ext = src.split('.').pop()?.toLowerCase() ?? 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        img.setAttribute('src', `data:${mime};base64,${blob}`);
      }
    }

    // Flatten all <a> links to plain <span> for KDP print compliance.
    // External links become "text (url)", internal #links keep just their text.
    flattenLinksForPrint(body);

    // Extract chapter title from h1, h2, or the <title> element
    const titleEl = body.querySelector('h1, h2') ?? doc.querySelector('title');
    const chapterTitle = titleEl?.textContent?.trim() ?? `Chapter ${chapters.length + 1}`;

    const chapterId = `chapter-${chapters.length + 1}`;

    // Ensure content is wrapped in article.scene for consistent CSS hooks.
    // If the source xhtml already has one, use it as-is.
    // Otherwise, wrap the body content.
    const hasArticle = body.querySelector('article.scene');
    let chapterHtml: string;

    if (hasArticle) {
      // Add the id to the existing article for TOC linking
      hasArticle.setAttribute('id', chapterId);
      chapterHtml = body.innerHTML;
    } else {
      chapterHtml = `<article class="scene" id="${chapterId}">${body.innerHTML}</article>`;
    }

    chapters.push({
      title: chapterTitle,
      html: chapterHtml,
      id: chapterId,
    });
  }

  return chapters;
}

// ─── 2b. Strip hyperlinks for KDP print compliance ───

function flattenLinksForPrint(container: Element): void {
  const anchors = Array.from(container.querySelectorAll('a'));
  for (const a of anchors) {
    const href = a.getAttribute('href') ?? '';
    const text = a.textContent ?? '';
    const span = a.ownerDocument.createElement('span');
    if (href && !href.startsWith('#')) {
      span.textContent = `${text} (${href})`;
    } else {
      span.textContent = text;
    }
    a.replaceWith(span);
  }
}

// ─── 3. Generate front matter HTML ───

function buildTitlePage(options: PdfOptions): string {
  return `
  <section class="front-matter title-page">
    <div class="book-title">${escapeHtml(options.title)}</div>
    <div class="book-author">${escapeHtml(options.author)}</div>
  </section>`;
}

function buildCopyrightPage(options: PdfOptions): string {
  const year = options.year ?? new Date().getFullYear().toString();
  const publisher = options.publisher ? `<p>Published by ${escapeHtml(options.publisher)}</p>` : '';
  const copyrightText = options.copyright
    ?? `Copyright \u00A9 ${year} ${options.author}. All rights reserved.`;

  return `
  <section class="front-matter copyright-page">
    <div>
      <p>${escapeHtml(options.title)}</p>
      <p>${escapeHtml(copyrightText)}</p>
      ${publisher}
      <p>Created with EverythingEbooks</p>
    </div>
  </section>`;
}

function buildTocPage(chapters: ChapterData[]): string {
  const items = chapters
    .map((ch) => `    <li>${escapeHtml(ch.title)}</li>`)
    .join('\n');

  return `
  <section class="front-matter toc-page">
    <h2>Contents</h2>
    <ul class="toc-list">
${items}
    </ul>
  </section>`;
}

// ─── 4. Assemble full HTML document for Paged.js ───

function buildPrintDocument(
  chapters: ChapterData[],
  options: PdfOptions
): string {
  const includeToc = options.includeToc !== false; // default true

  const frontMatter = [
    buildTitlePage(options),
    buildCopyrightPage(options),
    ...(includeToc ? [buildTocPage(chapters)] : []),
  ].join('\n');

  const chapterHtml = chapters.map((ch) => ch.html).join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${escapeHtml(options.title)}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <!-- Hidden elements that feed the running headers via string-set -->
  <span class="pdf-author">${escapeHtml(options.author)}</span>
  <span class="pdf-title">${escapeHtml(options.title)}</span>

  ${frontMatter}

  ${chapterHtml}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── 5. Apply no-indent classes that replace crash-prone CSS selectors ───

function applyNoIndentClasses(doc: Document): void {
  // h1 + p
  doc.querySelectorAll('h1').forEach((h1) => {
    const next = h1.nextElementSibling;
    if (next?.tagName === 'P') next.classList.add('no-indent-first');
  });
  // .scene-break + p
  doc.querySelectorAll('.scene-break').forEach((sb) => {
    const next = sb.nextElementSibling;
    if (next?.tagName === 'P') next.classList.add('no-indent-first');
  });
  // article.scene > p:first-of-type
  doc.querySelectorAll('article.scene').forEach((article) => {
    const firstP = article.querySelector(':scope > p');
    if (firstP) firstP.classList.add('no-indent-first');
  });
}

// ─── 6. Open a new window, apply classes, then inject polyfill ───

async function renderAndPrint(html: string, _title: string): Promise<void> {
  const printWindow = window.open('', '_blank');
  if (!printWindow) throw new Error('Popup blocked — allow popups for this site');

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Apply no-indent classes before pagedjs processes the DOM
  applyNoIndentClasses(printWindow.document);

  // Inject polyfill — auto-runs since readyState is already "complete"
  const script = printWindow.document.createElement('script');
  script.src = '/paged.polyfill.js';
  printWindow.document.body.appendChild(script);
}

// ─── 7. Public API: the one function your icon calls ───

export async function generatePdfFromEpub(
  epubData: ArrayBuffer,
  options: PdfOptions
): Promise<void> {
  // Unzip
  const zip = await JSZip.loadAsync(epubData);

  // Get spine-ordered chapter paths
  const spinePaths = await getSpineItems(zip);

  // Extract chapters with titles, skipping epub's own front matter
  const chapters = await extractChapters(zip, spinePaths);

  if (chapters.length === 0) {
    throw new Error('No chapter content found in epub');
  }

  // Build the full print-ready HTML with generated front matter
  const printHtml = buildPrintDocument(chapters, options);

  // Render in iframe with Paged.js and trigger browser print→PDF
  await renderAndPrint(printHtml, options.title);
}
