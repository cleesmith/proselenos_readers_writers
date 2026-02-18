// lib/html-generator.ts
// Generates a single-page readable HTML file from manuscript sections
// CSS matches the EPUB output (style.css + visual-narrative.css)

import { VISUAL_NARRATIVE_CSS } from './visual-narrative-css';

export interface HtmlGeneratorOptions {
  title: string;
  author: string;
  year?: string;
  sections: Array<{ title: string; content: string }>;
  isDarkMode?: boolean;
  mediaDataUrls?: Record<string, string>; // "images/photo.jpg" → "data:image/jpeg;base64,..."
  coverImageDataUrl?: string;  // base64 data URL for cover image
  subtitle?: string;           // book subtitle
  publisher?: string;          // publisher name
}

/**
 * Convert markdown formatting to HTML (for plain text content only)
 * Handles: **bold**, __italic__, [text](url), ![alt](src)
 */
function markdownToHtml(text: string): string {
  let html = text
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold: **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic: __text__
    .replace(/__(.+?)__/g, '<em>$1</em>')
    // Convert markdown images to <img> tags
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto"/>')
    // Links: [text](url) - now safe to process after images
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Paragraphs: double newlines
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');

  return html;
}

/**
 * Check if a section title is front matter (excluded from TOC)
 */
function isFrontMatter(title: string): boolean {
  const lower = title.toLowerCase().trim();
  return lower === 'cover' ||
         lower === 'title page' ||
         lower === 'copyright' ||
         lower === 'contents' ||
         lower === 'table of contents';
}

/**
 * Check if section content contains Visual Narrative block types.
 * Same class checks as epub-generator.ts chapterHasVnContent().
 */
function sectionHasVnContent(html: string): boolean {
  return (
    html.includes('class="dialogue"') ||
    html.includes('class="internal"') ||
    html.includes('class="emphasis-line"') ||
    html.includes('class="scene-break"') ||
    html.includes('class="scene-audio"') ||
    html.includes('class="visual ') ||
    html.includes('class="sticky-wrap"')
  );
}

/**
 * Process section content - detect HTML vs plain text
 * EPUB content is already HTML, plain text needs markdown conversion
 */
function processContent(text: string): string {
  // Detect if content is already HTML (contains common HTML tags)
  const isHtml = /<(p|div|span|a|em|strong|i|b|br|img|h[1-6]|pre|section)[\s>\/]/i.test(text);

  if (isHtml) {
    return text;
  }

  // Plain text/markdown - apply conversion
  return markdownToHtml(text);
}

/**
 * Convert non-ASCII characters to numeric HTML entities.
 * Ensures HTML displays correctly regardless of browser encoding settings,
 * critical when sharing standalone .html files without a web server.
 */
function convertNonAsciiToEntities(html: string): string {
  return html.replace(/[^\x00-\x7F]/g, (char) => `&#${char.codePointAt(0)};`);
}

/**
 * Strip all media elements (images, audio) from HTML content.
 * The HTML export focuses on text + styling; binary media would appear as
 * broken references since the data isn't embedded.
 */
function stripMediaElements(html: string): string {
  let result = html
    // VN sticky image blocks: <div class="sticky-wrap">..nested divs..</div>
    .replace(/<div\s+class="sticky-wrap"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/g, '')
    // VN image blocks: <div class="visual ...">...</div>
    .replace(/<div\s+class="visual[^"]*"[^>]*>.*?<\/div>/gs, '')
    // VN scene-audio blocks: <div class="scene-audio">...</div>
    .replace(/<div\s+class="scene-audio"[^>]*>.*?<\/div>/gs, '')
    // Audio blocks: <div class="audio-block">...</div>
    .replace(/<div\s+class="audio-block"[^>]*>.*?<\/div>/gs, '')
    // Image containers: <div class="image-container">...</div>
    .replace(/<div\s+class="image-container"[^>]*>.*?<\/div>/gs, '')
    // Figures: <figure ...>...</figure>
    .replace(/<figure[^>]*>.*?<\/figure>/gs, '')
    // Standalone <img> tags
    .replace(/<img[^>]*\/?>/gi, '')
    // Standalone <audio> tags
    .replace(/<audio[^>]*>.*?<\/audio>/gs, '')
    // Clean up empty paragraphs left behind
    .replace(/<p>\s*<\/p>/g, '')
    // Collapse runs of blank lines into a single blank line
    .replace(/\n{3,}/g, '\n\n');

  return result;
}

/**
 * Replace media src references (images/*, audio/*) with base64 data URIs.
 * Handles both src="..." attributes and CSS url() references (e.g. sticky-image backgrounds).
 */
function replaceMediaRefsWithDataUrls(html: string, mediaDataUrls: Record<string, string>): string {
  let result = html;
  for (const [key, dataUrl] of Object.entries(mediaDataUrls)) {
    const filename = key.split('/').pop()!;
    const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const prefix = key.startsWith('audio/') ? 'audio' : 'images';

    // Replace src="images/filename" and src="../images/filename"
    result = result.replace(
      new RegExp(`(src=["'])((?:\\.\\./)?${prefix}/)${escapedFilename}(["'])`, 'g'),
      `$1${dataUrl}$3`
    );

    // Replace CSS url() references: url(images/filename) or url('images/filename')
    // Used by sticky-image --sticky-bg inline style variable
    result = result.replace(
      new RegExp(`url\\((['"]?)(?:\\.\\./)?${prefix}/${escapedFilename}\\1\\)`, 'g'),
      `url($1${dataUrl}$1)`
    );
  }
  return result;
}

/**
 * Make sticky-image enlarge checkbox IDs unique per section.
 * plateToXhtml() resets its counter per section, so every section has
 * id="enlarge-1", id="enlarge-2", etc. In EPUB (separate files) this is fine,
 * but in a single-page HTML all IDs must be unique for the CSS checkbox hack.
 * Rewrites "enlarge-N" → "enlarge-{sectionIndex}-N" in both id and for attributes.
 */
function deduplicateEnlargeIds(html: string, sectionIndex: number): string {
  return html.replace(
    /(id|for)="enlarge-(\d+)"/g,
    `$1="enlarge-${sectionIndex}-$2"`
  );
}

/**
 * Strip the * {} and body {} reset rules from VN CSS
 * (they conflict with the base EPUB CSS in a single-page context)
 * Keep all class-scoped rules.
 */
function getVnClassRules(): string {
  return VISUAL_NARRATIVE_CSS
    // Remove the * { ... } reset block
    .replace(/\*\s*\{[^}]*\}/g, '')
    // Remove the body { ... } block
    .replace(/body\s*\{[^}]*\}/g, '')
    // Clean up excess blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── EPUB-matching CSS (from epub-generator.ts createFullWidthCSS) ──────────

const EPUB_BASE_CSS = `/* EverythingEbooks — EPUB-matching base styles */

html {
  font-size: 100%;
}

body {
  font-family: serif;
  line-height: 1.6;
  margin: 1em auto;
  padding: 0;
  padding-bottom: 70px;
  text-align: left;
  max-width: 900px;
  background: #fffaf5;
  color: #222;
  transition: background 0.3s, color 0.3s;
}

/* Title page */
.title-page {
  text-align: center;
  margin: 0;
  padding: 0;
}

.title-page p {
  text-indent: 0;
  text-align: center;
}

.book-title {
  text-align: center;
  font-size: 1.8em;
  font-weight: bold;
  margin: 0;
  padding-top: 25%;
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
  padding-top: 20%;
  font-weight: normal;
}

.book-publisher {
  text-align: center;
  font-size: 1em;
  margin: 0;
  padding-top: 20%;
  font-weight: normal;
}

/* Copyright page */
.copyright-page {
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
  transition: color 0.2s;
}

.toc-content a:hover {
  text-decoration: underline;
}

.toc-item-title {
  display: inline;
}

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
  margin: 0;
}

h1 {
  font-size: 1.5em;
  font-weight: bold;
  margin: 3em 0 2em 0;
  text-align: center;
}

p {
  margin: 0 0 1em 0;
  text-indent: 1.5em;
  text-align: justify;
  line-height: 1.6;
}

pre {
  margin: 1em 0;
  text-align: left;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-x: auto;
  font-family: monospace;
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
}

.image-container img {
  max-width: 100%;
  height: auto;
}

/* Figures (resized images from editor) */
figure {
  text-align: center;
  margin: 1.5em auto;
  max-width: 100%;
}

figure img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

figure[data-align="left"] {
  margin-left: 0;
  margin-right: auto;
  text-align: left;
}

figure[data-align="right"] {
  margin-left: auto;
  margin-right: 0;
  text-align: right;
}

figcaption {
  font-size: 0.85em;
  text-align: center;
  margin-top: 0.5em;
  font-style: italic;
}

/* Audio blocks (non-VN) */
.audio-block {
  text-align: center;
  margin: 1.5em 0;
}

.audio-block audio {
  width: 80%;
  max-width: 400px;
}

.audio-block .caption {
  font-size: 0.85em;
  font-style: italic;
  margin-top: 0.5em;
}

/* Scene overrides — no indent, left-aligned */
.scene p {
  text-indent: 0;
  text-align: left;
}

/* About author page */
.about-author-page {
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
}`;

// ── HTML-specific CSS (dark mode, footer, responsive) ──────────────────────

const HTML_SPECIFIC_CSS = `
/* ── Dark mode ─────────────────────────────── */

body.dark-mode {
  background: #121212;
  color: #e0e0e0;
}

body.dark-mode .dialogue {
  border-left-color: rgba(200, 200, 200, 0.25);
}

body.dark-mode .toc-content a:hover {
  color: #ccc;
}

body.dark-mode img {
  opacity: 0.9;
}

body.dark-mode .scene-audio {
  border-color: rgba(200, 200, 200, 0.15);
}

/* ── Sticky Footer ─────────────────────────── */

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #1a1a1a;
  color: #ccc;
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9em;
  z-index: 1000;
}

.footer-info {
  display: flex;
  gap: 8px;
  align-items: center;
}

.footer-title {
  font-weight: bold;
  color: #707070;
}

.footer-author {
  color: #999;
}

.footer-copyright {
  color: #777;
}

.theme-toggle {
  background: none;
  border: none;
  font-size: 1.4em;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background 0.2s;
}

.theme-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
}

.download-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
}

.download-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.download-btn svg {
  width: 24px;
  height: 24px;
  fill: #ccc;
  transition: fill 0.2s;
}

.download-btn:hover svg {
  fill: #22c55e;
}

.footer-buttons {
  display: flex;
  gap: 4px;
  align-items: center;
}

/* ── Responsive ────────────────────────────── */

@media (max-width: 600px) {
  body {
    margin: 0.5em;
    padding-bottom: 70px;
  }

  .book-title {
    font-size: 1.5em;
  }

  h1 {
    font-size: 1.3em;
  }

  .footer {
    padding: 10px 15px;
    font-size: 0.8em;
  }

  .footer-info {
    flex-wrap: wrap;
    gap: 4px;
  }
}`;

/**
 * Generate cover page HTML.
 * If a cover image data URL is available, show it centered.
 * Otherwise, produce a styled text fallback matching EPUB's blue-background cover.
 */
function generateCoverHtml(
  title: string, author: string, coverImageDataUrl?: string
): string {
  if (coverImageDataUrl) {
    return `
  <section class="cover-page" style="text-align:center; margin:0; padding:2em 0;">
    <img src="${coverImageDataUrl}" alt="Cover" style="max-width:100%; max-height:90vh; object-fit:contain;"/>
  </section>`;
  }
  // Text fallback — styled like EPUB's blue cover
  return `
  <section class="cover-page" style="background:#00517b; color:#fff; text-align:center; padding:25% 2em 2em; min-height:80vh; font-family:Georgia,serif;">
    <h1 style="font-size:2em; text-transform:uppercase; letter-spacing:0.15em; margin:0;">${escapeHtml(title)}</h1>
    <p style="font-size:1.2em; margin-top:2em;">${escapeHtml(author)}</p>
  </section>`;
}

/**
 * Generate title page HTML from metadata.
 * Mirrors EPUB's createTitlePage() using the same CSS classes from EPUB_BASE_CSS.
 */
function generateTitlePageHtml(
  title: string, author: string, subtitle?: string, publisher?: string
): string {
  const subtitleHtml = subtitle
    ? `\n    <p class="book-subtitle">${escapeHtml(subtitle)}</p>` : '';
  return `
  <section class="title-page">
    <p class="book-title">${escapeHtml(title.toUpperCase())}</p>${subtitleHtml}
    <p class="book-author">${escapeHtml(author)}</p>
    <p class="book-publisher">${escapeHtml(publisher || 'Independent Publisher')}</p>
  </section>`;
}

/**
 * Generate a complete single-page HTML file from manuscript sections.
 * HTML structure and CSS match the EPUB output from epub-generator.ts.
 */
export function generateHtmlFromSections(options: HtmlGeneratorOptions): string {
  const { title, author, year = new Date().getFullYear().toString(), sections, isDarkMode = true, mediaDataUrls, coverImageDataUrl, subtitle, publisher } = options;

  // Build section HTML array (instead of one big string we split later)
  const sectionHtmls: string[] = [];

  // Track whether any section uses VN content (to include VN CSS)
  let hasAnyVnContent = false;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    const lower = section.title.toLowerCase().trim();

    // Skip sections we generate from metadata (like EPUB does)
    if (lower === 'contents' || lower === 'table of contents') continue;
    if (lower === 'cover') continue;
    if (lower === 'title page') continue;

    let contentHtml = processContent(section.content);
    if (mediaDataUrls && Object.keys(mediaDataUrls).length > 0) {
      contentHtml = replaceMediaRefsWithDataUrls(contentHtml, mediaDataUrls);
    } else {
      contentHtml = stripMediaElements(contentHtml);
    }
    contentHtml = deduplicateEnlargeIds(contentHtml, i);
    contentHtml = convertNonAsciiToEntities(contentHtml);

    if (lower === 'copyright') {
      // Copyright → <section class="copyright-page">
      sectionHtmls.push(`
  <section class="copyright-page" id="section-${i}">
${contentHtml}
  </section>`);
    } else if (sectionHasVnContent(contentHtml)) {
      // VN chapter → <article class="scene">
      hasAnyVnContent = true;
      sectionHtmls.push(`
  <article class="scene" id="section-${i}">
    <h1 class="scene-title">${escapeHtml(section.title)}</h1>
${contentHtml}
  </article>`);
    } else {
      // Regular chapter → <section class="chapter">
      sectionHtmls.push(`
  <section class="chapter" id="section-${i}">
    <h1>${escapeHtml(section.title)}</h1>
${contentHtml}
  </section>`);
    }
  }

  // Generate TOC with links to non-front-matter sections
  const tocEntries = sections
    .map((section, index) => ({ title: section.title, index }))
    .filter(entry => !isFrontMatter(entry.title));

  const tocHtml = tocEntries.length > 0 ? `
  <div class="contents-page">
    <h1 class="toc-title">CONTENTS</h1>
    <div class="toc-contents">
${tocEntries.map(entry => `      <div class="toc-item"><p class="toc-content"><a href="#section-${entry.index}"><span class="toc-item-title">${escapeHtml(entry.title)}</span></a></p></div>`).join('\n')}
    </div>
  </div>` : '';

  // Insert TOC after Copyright section (or at the beginning)
  const copyrightIdx = sectionHtmls.findIndex(h => h.includes('class="copyright-page"'));
  if (copyrightIdx !== -1) {
    sectionHtmls.splice(copyrightIdx + 1, 0, tocHtml);
  } else {
    sectionHtmls.splice(0, 0, tocHtml);
  }

  // Prepend cover and title page (generated from metadata, like EPUB)
  const coverHtml = generateCoverHtml(title, author, coverImageDataUrl);
  const titlePageHtml = generateTitlePageHtml(title, author, subtitle, publisher);
  sectionHtmls.unshift(titlePageHtml);
  sectionHtmls.unshift(coverHtml);

  const allSectionsHtml = sectionHtmls.join('\n');

  // Build combined CSS
  const vnCssBlock = hasAnyVnContent ? `\n/* ── Visual Narrative styles ──────────────── */\n${getVnClassRules()}` : '';

  // Full HTML template
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${EPUB_BASE_CSS}
${vnCssBlock}
${HTML_SPECIFIC_CSS}
  </style>
</head>
<body${isDarkMode ? ' class="dark-mode"' : ''}>
${allSectionsHtml}

  <div class="footer">
    <div class="footer-info">
      <span class="footer-title">${escapeHtml(title)}</span>
      <span class="footer-author">by ${escapeHtml(author)}</span>
      <span class="footer-copyright">&copy; ${escapeHtml(year)}</span>
    </div>
    <div class="footer-buttons">
      <button class="download-btn" id="downloadBtn" title="Download HTML file">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
      </button>
      <button class="theme-toggle" id="themeToggle" title="Toggle light/dark mode">${isDarkMode ? '&#127769;' : '&#9728;&#65039;'}</button>
    </div>
  </div>

  <script>
    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    // Check for saved preference - override initial mode if user previously toggled
    const savedTheme = localStorage.getItem('html-ebook-theme');
    if (savedTheme === 'light' && body.classList.contains('dark-mode')) {
      body.classList.remove('dark-mode');
      themeToggle.textContent = '\u2600\uFE0F';
    } else if (savedTheme === 'dark' && !body.classList.contains('dark-mode')) {
      body.classList.add('dark-mode');
      themeToggle.textContent = '\u{1F319}';
    }

    themeToggle.addEventListener('click', () => {
      body.classList.toggle('dark-mode');
      const isDark = body.classList.contains('dark-mode');
      themeToggle.textContent = isDark ? '\u{1F319}' : '\u2600\uFE0F';
      localStorage.setItem('html-ebook-theme', isDark ? 'dark' : 'light');
    });

    // Download functionality
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.addEventListener('click', () => {
      // Hide download button before capturing HTML (not needed in downloaded file)
      downloadBtn.style.display = 'none';
      const html = '<!DOCTYPE html>' + document.documentElement.outerHTML;
      downloadBtn.style.display = '';

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.title + '.html';
      a.click();
      URL.revokeObjectURL(url);
    });
  </script>
</body>
</html>`;

  return html;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/[^\x00-\x7F]/g, (char) => `&#${char.codePointAt(0)};`);
}

/**
 * Open HTML content in a new browser tab via a real HTTPS URL.
 * Stores the HTML in IndexedDB and opens /reader/view which reads it back.
 * This avoids blob: URLs which Chrome blocks from tab-sharing (e.g. Gemini).
 */
export async function openHtmlInNewTab(html: string): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('AppFileSystem', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    store.put({ path: '__reader_view_html', content: html });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  window.open('/reader/view', '_blank');
}
