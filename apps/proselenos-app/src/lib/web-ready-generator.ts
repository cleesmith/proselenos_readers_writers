// apps/proselenos-app/src/lib/web-ready-generator.ts
//
// Generates a "web ready" zip: index.html (relative media paths, CSS/JS inline)
// + images/ and audio/ subfolders with real binary files.
//
// CSS/JS constants mirror html-generator.ts — keep in sync if originals change.

import JSZip from 'jszip';
import { VISUAL_NARRATIVE_CSS } from './visual-narrative-css';
import type { SceneCraftConfig } from '@/services/manuscriptStorage';

// ── Public interfaces ─────────────────────────────────────────────────────

export interface WebReadyOptions {
  title: string;
  author: string;
  year?: string;
  sections: Array<{ title: string; content: string; sceneCraftConfig?: SceneCraftConfig }>;
  isDarkMode?: boolean;
  coverImage?: Blob;
  images?: Array<{ filename: string; blob: Blob }>;
  audios?: Array<{ filename: string; blob: Blob }>;
  subtitle?: string;
  publisher?: string;
}

// ── Public functions ──────────────────────────────────────────────────────

/**
 * Build a slug for the zip download filename.
 * Example: "Vapo & Cramb" + "Clee Smith" -> "Vapo--Cramb_clee_smith_2026-03-06"
 */
export function makeWebReadySlug(title: string, author: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const titleSlug = makeTitleSlug(title);
  const authorSlug = author
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .toLowerCase();
  return `${titleSlug}_${authorSlug}_${today}`;
}

/**
 * Derive a URL-friendly slug from a book title for use in <base href>.
 * Example: "What I Learned from Birds" → "What-I-Learned-from-Birds"
 */
function makeTitleSlug(title: string): string {
  return title
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '');
}

/**
 * Generate a zip blob containing a web-ready folder:
 *   {slug}/index.html
 *   {slug}/images/...
 *   {slug}/audio/...
 */
export async function generateWebReadyZip(options: WebReadyOptions): Promise<Blob> {
  const {
    title, author, year = new Date().getFullYear().toString(),
    sections, isDarkMode = true,
    coverImage, images, audios,
    subtitle, publisher,
  } = options;

  const titleSlug = makeTitleSlug(title);
  const zip = new JSZip();
  const folder = zip.folder(titleSlug)!;
  const imagesFolder = folder.folder('images')!;
  const audioFolder = folder.folder('audio')!;

  // ── Add binary assets to zip ────────────────────────────────────────────

  // Cover image
  let coverFilename: string | undefined;
  if (coverImage) {
    const ext = getCoverExtension(coverImage);
    coverFilename = `cover.${ext}`;
    imagesFolder.file(coverFilename, coverImage, { compression: 'STORE' });
  }

  // Content images: sequential names (001.jpg, 002.png, ...)
  const imageMap = new Map<string, string>();
  let imgCounter = 0;
  if (images) {
    for (const img of images) {
      const ext = img.filename.slice(img.filename.lastIndexOf('.')).toLowerCase();
      const seqName = String(++imgCounter).padStart(3, '0') + ext;
      imageMap.set(img.filename, seqName);
      imagesFolder.file(seqName, img.blob, { compression: 'STORE' });
    }
  }

  // Audio files: sequential names (001.mp3, 002.mp3, ...)
  const audioMap = new Map<string, string>();
  let audCounter = 0;
  if (audios) {
    for (const aud of audios) {
      const ext = aud.filename.slice(aud.filename.lastIndexOf('.')).toLowerCase();
      const seqName = String(++audCounter).padStart(3, '0') + ext;
      audioMap.set(aud.filename, seqName);
      audioFolder.file(seqName, aud.blob, { compression: 'STORE' });
    }
  }

  // ── Build index.html ────────────────────────────────────────────────────

  const html = buildIndexHtml({
    title, author, year, sections, isDarkMode,
    coverFilename, subtitle, publisher,
    imageMap, audioMap,
  });

  folder.file('index.html', html, { compression: 'DEFLATE' });

  // If this book has SceneCraft scenes, also generate autoplay.html
  const hasSceneCraft = sections.some(s => s.sceneCraftConfig);
  if (hasSceneCraft) {
    const autoplayHtml = buildAutoplayHtml({
      title, author, year, sections, isDarkMode,
      coverFilename, subtitle, publisher,
      imageMap, audioMap,
    });
    folder.file('autoplay.html', autoplayHtml, { compression: 'DEFLATE' });
  }

  // Always generate Edge Read Aloud version (clean TTS-friendly HTML)
  const edgeHtml = buildEdgeHtml({
    title, author, year, sections, isDarkMode,
    coverFilename, subtitle, publisher,
    imageMap, audioMap,
  });
  folder.file('autoplay-via-edge.html', edgeHtml, { compression: 'DEFLATE' });

  return zip.generateAsync({ type: 'blob' });
}

// ── Module-level enlarge counter (reset per buildIndexHtml call) ──────────
let globalEnlargeCounter = 0;

// ── Internal: build the full HTML string ──────────────────────────────────

interface BuildHtmlOptions {
  title: string;
  author: string;
  year: string;
  sections: Array<{ title: string; content: string; sceneCraftConfig?: SceneCraftConfig }>;
  isDarkMode: boolean;
  coverFilename?: string;
  subtitle?: string;
  publisher?: string;
  imageMap?: Map<string, string>;
  audioMap?: Map<string, string>;
}

function buildIndexHtml(opts: BuildHtmlOptions): string {
  const { title, author, year, sections, isDarkMode, coverFilename, subtitle, publisher, imageMap, audioMap } = opts;

  // Reset the global enlarge counter for each new HTML build
  globalEnlargeCounter = 0;

  const titleSlug = makeTitleSlug(title);
  const sectionHtmls: string[] = [];
  let hasAnyVnContent = false;
  let hasAnySceneCraft = false;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    const lower = section.title.toLowerCase().trim();

    // Skip sections we generate from metadata
    if (lower === 'contents' || lower === 'table of contents') continue;
    if (lower === 'cover') continue;
    if (lower === 'title page') continue;

    // SceneCraft sections
    if (section.sceneCraftConfig) {
      hasAnySceneCraft = true;
      let scHtml = generateSceneCraftHtml(
        section.title, section.content, section.sceneCraftConfig, i,
        imageMap, audioMap
      );
      if (imageMap?.size || audioMap?.size) {
        scHtml = remapMediaPaths(scHtml, imageMap ?? new Map(), audioMap ?? new Map());
      }
      sectionHtmls.push(scHtml);
      continue;
    }

    let contentHtml = processContent(section.content);
    contentHtml = normalizeMediaPaths(contentHtml);
    if (imageMap?.size || audioMap?.size) {
      contentHtml = remapMediaPaths(contentHtml, imageMap ?? new Map(), audioMap ?? new Map());
    }
    contentHtml = deduplicateEnlargeIds(contentHtml, i);
    contentHtml = addTargetBlank(contentHtml);

    if (lower === 'copyright') {
      sectionHtmls.push(`
  <section class="copyright-page" id="section-${i}">
${contentHtml}
  </section>`);
    } else if (sectionHasVnContent(contentHtml)) {
      hasAnyVnContent = true;
      sectionHtmls.push(`
  <article class="scene" id="section-${i}">
    <h1 class="scene-title">${escapeHtml(section.title)}</h1>
${contentHtml}
  </article>`);
    } else {
      sectionHtmls.push(`
  <section class="chapter" id="section-${i}">
    <h1>${escapeHtml(section.title)}</h1>
${contentHtml}
  </section>`);
    }
  }

  // TOC
  const tocEntries = sections
    .map((section, index) => ({ title: section.title, index }))
    .filter(entry => !isFrontMatter(entry.title));

  const tocHtml = tocEntries.length > 0 ? `
  <div class="contents-page">
    <h1 class="toc-title">CONTENTS</h1>
    <div class="toc-contents">
${tocEntries.map(entry => `      <div class="toc-item"><p class="toc-content"><a href="./index.html#section-${entry.index}"><span class="toc-item-title">${escapeHtml(entry.title)}</span></a></p></div>`).join('\n')}
    </div>
  </div>` : '';

  const copyrightIdx = sectionHtmls.findIndex(h => h.includes('class="copyright-page"'));
  if (copyrightIdx !== -1) {
    sectionHtmls.splice(copyrightIdx + 1, 0, tocHtml);
  } else {
    sectionHtmls.splice(0, 0, tocHtml);
  }

  // Prepend cover and title page
  const coverHtml = generateCoverHtml(title, author, coverFilename);
  const titlePageHtml = generateTitlePageHtml(title, author, subtitle, publisher);
  sectionHtmls.unshift(titlePageHtml);
  sectionHtmls.unshift(coverHtml);

  const allSectionsHtml = sectionHtmls.join('\n');

  // Build combined CSS
  const vnCssBlock = hasAnyVnContent ? `\n/* ── Visual Narrative styles ──────────────── */\n${getVnClassRules()}` : '';
  const sceneCraftCssBlock = hasAnySceneCraft ? `\n${SCENECRAFT_CSS}` : '';
  const sceneCraftJsBlock = hasAnySceneCraft ? `\n${SCENECRAFT_JS}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <base href="/${titleSlug}/" />
  <style>
${EPUB_BASE_CSS}
${vnCssBlock}
${sceneCraftCssBlock}
${HTML_SPECIFIC_CSS}
  </style>
</head>
<body${isDarkMode ? ' class="dark-mode"' : ''}>
${allSectionsHtml}

  <div class="footer">
    <div class="footer-buttons">
      <button class="theme-toggle" id="themeToggle" title="Toggle light/dark mode">${isDarkMode ? '&#9728;&#65039;' : '&#127769;'}</button>
${hasAnySceneCraft ? '      <button class="playhead-toggle" id="playheadToggle" title="Toggle Scenecraft overlays"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 2H6c-1.2 0-2 .9-2 2v16c0 1.1.8 2 2 2h13c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H6V4h2v8l2.5-1.5L13 12V4h6v16z"/></svg></button>' : ''}
    </div>
    <div class="footer-info">
      <span class="footer-title">${escapeHtml(title)}</span>
      <span class="footer-author">by ${escapeHtml(author)}</span>
      <span class="footer-copyright">&copy; ${escapeHtml(year)}</span>
    </div>
  </div>

  <script>
    // Theme toggle functionality
    var themeToggle = document.getElementById('themeToggle');
    var body = document.body;

    var savedTheme = localStorage.getItem('html-ebook-theme');
    if (savedTheme === 'light' && body.classList.contains('dark-mode')) {
      body.classList.remove('dark-mode');
      themeToggle.textContent = '\u{1F319}';
    } else if (savedTheme === 'dark' && !body.classList.contains('dark-mode')) {
      body.classList.add('dark-mode');
      themeToggle.textContent = '\u2600\uFE0F';
    }

    themeToggle.addEventListener('click', function() {
      body.classList.toggle('dark-mode');
      var isDark = body.classList.contains('dark-mode');
      themeToggle.textContent = isDark ? '\u2600\uFE0F' : '\u{1F319}';
      localStorage.setItem('html-ebook-theme', isDark ? 'dark' : 'light');
    });

    // Playhead overlay toggle
    var playheadToggle = document.getElementById('playheadToggle');
    if (playheadToggle) {
      var savedPlayhead = localStorage.getItem('html-ebook-playhead');
      if (savedPlayhead === 'hidden') {
        body.classList.add('sc-overlay-hidden');
        playheadToggle.classList.add('sc-off');
      }
      playheadToggle.addEventListener('click', function() {
        body.classList.toggle('sc-overlay-hidden');
        var isHidden = body.classList.contains('sc-overlay-hidden');
        playheadToggle.classList.toggle('sc-off', isHidden);
        localStorage.setItem('html-ebook-playhead', isHidden ? 'hidden' : 'visible');
      });
    }
${sceneCraftJsBlock}
  </script>
</body>
</html>`;
}

// ── Autoplay variant: passive viewer with auto-scroll ─────────────────────

function buildAutoplayHtml(opts: BuildHtmlOptions): string {
  const { title, author, year, sections, isDarkMode, coverFilename, subtitle, publisher, imageMap, audioMap } = opts;

  // Reset the global enlarge counter for each new HTML build
  globalEnlargeCounter = 0;

  const titleSlug = makeTitleSlug(title);
  const sectionHtmls: string[] = [];
  let hasAnyVnContent = false;
  let hasAnySceneCraft = false;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    const lower = section.title.toLowerCase().trim();

    // Skip sections we generate from metadata
    if (lower === 'contents' || lower === 'table of contents') continue;
    if (lower === 'cover') continue;
    if (lower === 'title page') continue;

    // SceneCraft sections — use autoplay variant (no playhead)
    if (section.sceneCraftConfig) {
      hasAnySceneCraft = true;
      let scHtml = generateAutoplaySceneCraftHtml(
        section.title, section.content, section.sceneCraftConfig, i,
        imageMap, audioMap
      );
      if (imageMap?.size || audioMap?.size) {
        scHtml = remapMediaPaths(scHtml, imageMap ?? new Map(), audioMap ?? new Map());
      }
      sectionHtmls.push(scHtml);
      continue;
    }

    let contentHtml = processContent(section.content);
    contentHtml = normalizeMediaPaths(contentHtml);
    if (imageMap?.size || audioMap?.size) {
      contentHtml = remapMediaPaths(contentHtml, imageMap ?? new Map(), audioMap ?? new Map());
    }
    contentHtml = deduplicateEnlargeIds(contentHtml, i);
    contentHtml = addTargetBlank(contentHtml);

    if (lower === 'copyright') {
      sectionHtmls.push(`
  <section class="copyright-page" id="section-${i}">
${contentHtml}
  </section>`);
    } else if (sectionHasVnContent(contentHtml)) {
      hasAnyVnContent = true;
      sectionHtmls.push(`
  <article class="scene" id="section-${i}">
    <h1 class="scene-title">${escapeHtml(section.title)}</h1>
${contentHtml}
  </article>`);
    } else {
      sectionHtmls.push(`
  <section class="chapter" id="section-${i}">
    <h1>${escapeHtml(section.title)}</h1>
${contentHtml}
  </section>`);
    }
  }

  // TOC — links point to autoplay.html
  const tocEntries = sections
    .map((section, index) => ({ title: section.title, index }))
    .filter(entry => !isFrontMatter(entry.title));

  const tocHtml = tocEntries.length > 0 ? `
  <div class="contents-page">
    <h1 class="toc-title">CONTENTS</h1>
    <div class="toc-contents">
${tocEntries.map(entry => `      <div class="toc-item"><p class="toc-content"><a href="./autoplay.html#section-${entry.index}"><span class="toc-item-title">${escapeHtml(entry.title)}</span></a></p></div>`).join('\n')}
    </div>
  </div>` : '';

  const copyrightIdx = sectionHtmls.findIndex(h => h.includes('class="copyright-page"'));
  if (copyrightIdx !== -1) {
    sectionHtmls.splice(copyrightIdx + 1, 0, tocHtml);
  } else {
    sectionHtmls.splice(0, 0, tocHtml);
  }

  // Prepend cover and title page
  const coverHtml = generateCoverHtml(title, author, coverFilename);
  const titlePageHtml = generateTitlePageHtml(title, author, subtitle, publisher);
  sectionHtmls.unshift(titlePageHtml);
  sectionHtmls.unshift(coverHtml);

  const allSectionsHtml = sectionHtmls.join('\n');

  // Build combined CSS
  const vnCssBlock = hasAnyVnContent ? `\n/* ── Visual Narrative styles ──────────────── */\n${getVnClassRules()}` : '';
  const sceneCraftCssBlock = hasAnySceneCraft ? `\n${SCENECRAFT_AUTOPLAY_CSS}` : '';
  const sceneCraftJsBlock = hasAnySceneCraft ? `\n${SCENECRAFT_AUTOPLAY_JS}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} &#8212; Autoplay</title>
  <base href="/${titleSlug}/" />
  <style>
${EPUB_BASE_CSS}
${vnCssBlock}
${sceneCraftCssBlock}
${HTML_SPECIFIC_CSS}
  </style>
</head>
<body${isDarkMode ? ' class="dark-mode"' : ''}>
${allSectionsHtml}

  <div class="footer">
    <div class="footer-buttons">
      <button class="theme-toggle" id="themeToggle" title="Toggle light/dark mode">${isDarkMode ? '&#9728;&#65039;' : '&#127769;'}</button>
    </div>
    <div class="footer-info">
      <span class="footer-title">${escapeHtml(title)}</span>
      <span class="footer-author">by ${escapeHtml(author)}</span>
      <span class="footer-copyright">&copy; ${escapeHtml(year)}</span>
      <span class="footer-scene" id="footerScene"></span>
    </div>
    <div class="footer-status" id="footerStatus"></div>
  </div>

  <script>
    // Theme toggle functionality
    var themeToggle = document.getElementById('themeToggle');
    var body = document.body;

    var savedTheme = localStorage.getItem('html-ebook-theme');
    if (savedTheme === 'light' && body.classList.contains('dark-mode')) {
      body.classList.remove('dark-mode');
      themeToggle.textContent = '\u{1F319}';
    } else if (savedTheme === 'dark' && !body.classList.contains('dark-mode')) {
      body.classList.add('dark-mode');
      themeToggle.textContent = '\u2600\uFE0F';
    }

    themeToggle.addEventListener('click', function() {
      body.classList.toggle('dark-mode');
      var isDark = body.classList.contains('dark-mode');
      themeToggle.textContent = isDark ? '\u2600\uFE0F' : '\u{1F319}';
      localStorage.setItem('html-ebook-theme', isDark ? 'dark' : 'light');
    });
${sceneCraftJsBlock}
  </script>
</body>
</html>`;
}

// ── Edge Read Aloud version ───────────────────────────────────────────────

function buildEdgeHtml(opts: BuildHtmlOptions): string {
  const { title, author, year, sections, isDarkMode, coverFilename, subtitle, publisher, imageMap } = opts;

  globalEnlargeCounter = 0;

  const titleSlug = makeTitleSlug(title);
  const sectionHtmls: string[] = [];
  let hasAnyVnContent = false;

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    const lower = section.title.toLowerCase().trim();

    if (lower === 'contents' || lower === 'table of contents') continue;
    if (lower === 'cover') continue;
    if (lower === 'title page') continue;

    // SceneCraft sections — render as regular chapters with images, no audio
    if (section.sceneCraftConfig) {
      sectionHtmls.push(generateEdgeSceneCraftHtml(
        section.title, section.content, i, imageMap,
      ));
      continue;
    }

    let contentHtml = processContent(section.content);
    contentHtml = normalizeMediaPaths(contentHtml);
    contentHtml = stripAudioElements(contentHtml);
    if (imageMap?.size) {
      contentHtml = remapMediaPaths(contentHtml, imageMap ?? new Map(), new Map());
    }
    contentHtml = deduplicateEnlargeIds(contentHtml, i);
    contentHtml = addTargetBlank(contentHtml);

    if (lower === 'copyright') {
      sectionHtmls.push(`
  <section class="copyright-page" id="section-${i}">
${contentHtml}
  </section>`);
    } else if (sectionHasVnContent(contentHtml)) {
      hasAnyVnContent = true;
      sectionHtmls.push(`
  <article class="scene" id="section-${i}">
    <h1 class="scene-title">${escapeHtml(section.title)}</h1>
${contentHtml}
  </article>`);
    } else {
      sectionHtmls.push(`
  <section class="chapter" id="section-${i}">
    <h1>${escapeHtml(section.title)}</h1>
${contentHtml}
  </section>`);
    }
  }

  // Prepend cover, title page, and spoken intro (no TOC — Edge reads it aloud)
  const coverHtml = generateCoverHtml(title, author, coverFilename);
  const titlePageHtml = generateTitlePageHtml(title, author, subtitle, publisher);
  const subtitleHtml = subtitle ? `\n    <p style="text-indent:0;text-align:center">${escapeHtml(subtitle)}</p>` : '';
  const spokenIntro = `
  <section class="chapter">
    <h1>${escapeHtml(title)}</h1>${subtitleHtml}
    <p style="text-indent:0;text-align:center">Written by ${escapeHtml(author)}.</p>
  </section>`;
  sectionHtmls.unshift(titlePageHtml);
  sectionHtmls.unshift(coverHtml);

  // Insert spoken intro after copyright (Edge skips cover/title/copyright)
  const copyrightIdx = sectionHtmls.findIndex(h => h.includes('class="copyright-page"'));
  if (copyrightIdx !== -1) {
    sectionHtmls.splice(copyrightIdx + 1, 0, spokenIntro);
  } else {
    sectionHtmls.splice(2, 0, spokenIntro);
  }

  const allSectionsHtml = sectionHtmls.join('\n');

  const vnCssBlock = hasAnyVnContent ? `\n/* ── Visual Narrative styles ──────────────── */\n${getVnClassRules()}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} &#8212; Edge Read Aloud</title>
  <base href="/${titleSlug}/" />
  <style>
${EPUB_BASE_CSS}
${vnCssBlock}
${HTML_SPECIFIC_CSS}
  </style>
</head>
<body${isDarkMode ? ' class="dark-mode"' : ''}>
${allSectionsHtml}

  <div class="footer">
    <div class="footer-buttons">
      <button class="theme-toggle" id="themeToggle" title="Toggle light/dark mode">${isDarkMode ? '&#9728;&#65039;' : '&#127769;'}</button>
    </div>
    <div class="footer-info">
      <span class="footer-title">${escapeHtml(title)}</span>
      <span class="footer-author">by ${escapeHtml(author)}</span>
      <span class="footer-copyright">&copy; ${escapeHtml(year)}</span>
    </div>
  </div>

  <script>
    var themeToggle = document.getElementById('themeToggle');
    var body = document.body;

    var savedTheme = localStorage.getItem('html-ebook-theme');
    if (savedTheme === 'light' && body.classList.contains('dark-mode')) {
      body.classList.remove('dark-mode');
      themeToggle.textContent = '\u{1F319}';
    } else if (savedTheme === 'dark' && !body.classList.contains('dark-mode')) {
      body.classList.add('dark-mode');
      themeToggle.textContent = '\u2600\uFE0F';
    }

    themeToggle.addEventListener('click', function() {
      body.classList.toggle('dark-mode');
      var isDark = body.classList.contains('dark-mode');
      themeToggle.textContent = isDark ? '\u2600\uFE0F' : '\u{1F319}';
      localStorage.setItem('html-ebook-theme', isDark ? 'dark' : 'light');
    });
  </script>
</body>
</html>`;
}

// ── Internal helpers ──────────────────────────────────────────────────────

/**
 * Strip audio elements from HTML content (for Edge Read Aloud version).
 * Removes <audio>, <div class="audio-block">, <div class="scene-audio">.
 */
function stripAudioElements(html: string): string {
  return html
    .replace(/<div\s+class="scene-audio"[^>]*>.*?<\/div>/gs, '')
    .replace(/<div\s+class="audio-block"[^>]*>.*?<\/div>/gs, '')
    .replace(/<audio[^>]*>.*?<\/audio>/gs, '')
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Normalize media paths: strip ../ prefixes so EPUB xhtml content
 * uses relative paths like "images/foo.jpg" and "audio/bar.mp3".
 */
function normalizeMediaPaths(html: string): string {
  // src="../images/foo.jpg" -> src="images/foo.jpg"
  // src="../audio/bar.mp3"  -> src="audio/bar.mp3"
  let result = html.replace(
    /src="(?:\.\.\/)+((images|audio)\/[^"]+)"/g,
    'src="$1"'
  );
  // url(../images/foo.jpg) or url('../images/foo.jpg')
  result = result.replace(
    /url\((['"]?)(?:\.\.\/)+((images|audio)\/[^)'"]+)\1\)/g,
    'url($1$2$1)'
  );
  return result;
}

function getCoverExtension(coverBlob: Blob): string {
  const mimeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return mimeMap[coverBlob.type] || 'jpg';
}

function deduplicateEnlargeIds(html: string, sectionIndex: number): string {
  return html.replace(
    /(id|for)="enlarge-(\d+)"/g,
    `$1="enlarge-${sectionIndex}-$2"`
  );
}

function processContent(text: string): string {
  const isHtml = /<(p|div|span|a|em|strong|i|b|br|img|h[1-6]|pre|section)[\s>\/]/i.test(text);
  if (isHtml) return text;
  return markdownToHtml(text);
}

function markdownToHtml(text: string): string {
  const html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<em>$1</em>')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;height:auto"/>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n');
  return html;
}

function isFrontMatter(title: string): boolean {
  const lower = title.toLowerCase().trim();
  return lower === 'cover' ||
         lower === 'title page' ||
         lower === 'copyright' ||
         lower === 'contents' ||
         lower === 'table of contents';
}

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function addTargetBlank(html: string): string {
  return html.replace(/<a\s+(?![^>]*\btarget=)/gi, '<a target="_blank" rel="noopener" ');
}

function getVnClassRules(): string {
  return VISUAL_NARRATIVE_CSS
    .replace(/\*\s*\{[^}]*\}/g, '')
    .replace(/body\s*\{[^}]*\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── SceneCraft element types ──────────────────────────────────────────────

interface ScElement {
  type: 'sticky' | 'figure' | 'dialogue' | 'emphasis' | 'quote' | 'internal' | 'break' | 'para' | 'h1' | 'h2' | 'h3' | 'divider' | 'linebreak' | 'audio';
  text: string;
  speaker?: string;
  direction?: string;
  alt?: string;
  imgSrc?: string;
  audioSrc?: string;
  style?: string;
  width?: string;
  idx: number;
}

function parseSceneElements(xhtml: string): ScElement[] {
  if (!xhtml || !xhtml.trim()) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${xhtml}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) return [];
  const elements: ScElement[] = [];
  let idx = 0;

  function walkChildren(parent: Element) {
    for (let i = 0; i < parent.children.length; i++) {
      const node = parent.children[i];
      if (!node) continue;
      const tag = node.tagName.toLowerCase();
      const cls = node.className || '';

      if (tag === 'div' && cls.includes('sticky-wrap')) {
        const paragraphs: string[] = [];
        const textDiv = node.querySelector('.sticky-text');
        const pSource = textDiv || node;
        for (let j = 0; j < pSource.children.length; j++) {
          const child = pSource.children[j];
          if (!child) continue;
          if (child.tagName.toLowerCase() === 'p') {
            const hasContent = (child.textContent || '').trim();
            if (hasContent) paragraphs.push((child.innerHTML || '').trim());
          }
        }
        const img = node.querySelector('img.sticky-img');
        const imgSrc = img?.getAttribute('src') || undefined;
        if (paragraphs.length > 0 || imgSrc) {
          elements.push({ type: 'sticky', text: paragraphs.join('\n\n'), imgSrc, idx: idx++ });
        }
        continue;
      }
      if (tag === 'figure') {
        const img = node.querySelector('img');
        const figcaption = node.querySelector('figcaption');
        const styleAttr = node.getAttribute('style') || '';
        const widthMatch = styleAttr.match(/(?:^|;)\s*width\s*:\s*([^;]+)/);
        elements.push({
          type: 'figure', text: figcaption?.textContent?.trim() || img?.getAttribute('alt') || 'Image',
          alt: img?.getAttribute('alt') || undefined, imgSrc: img?.getAttribute('src') || undefined,
          width: widthMatch?.[1]?.trim() || undefined, idx: idx++,
        });
        continue;
      }
      if (tag === 'div' && cls.includes('dialogue')) {
        const speakerEl = node.querySelector('.speaker, span[class*="speaker"]');
        let speaker = 'unknown', direction = '';
        if (speakerEl) {
          const speakerText = (speakerEl.textContent || '').trim();
          const match = speakerText.match(/^([^(]+?)(?:\s*\(([^)]+)\))?:?\s*$/);
          if (match) { speaker = (match[1] || '').trim().toLowerCase(); direction = (match[2] || '').trim(); }
          else speaker = speakerText.replace(/:$/, '').trim().toLowerCase();
        }
        let dialogueText = '';
        for (let j = 0; j < node.childNodes.length; j++) {
          const child = node.childNodes[j];
          if (!child) continue;
          if (child.nodeType === Node.ELEMENT_NODE && (child as Element).className?.includes('speaker')) continue;
          if (child.nodeType === Node.ELEMENT_NODE) {
            dialogueText += (child as Element).innerHTML || '';
          } else {
            dialogueText += child.textContent || '';
          }
        }
        elements.push({ type: 'dialogue', text: dialogueText.trim(), speaker, direction: direction || undefined, idx: idx++ });
        continue;
      }
      if (tag === 'p' && cls.includes('emphasis-line')) {
        const hasContent = (node.textContent || '').trim();
        if (hasContent) elements.push({ type: 'emphasis', text: (node.innerHTML || '').trim(), idx: idx++ });
        continue;
      }
      if (tag === 'p' && cls.includes('internal')) {
        const hasContent = (node.textContent || '').trim();
        if (hasContent) elements.push({ type: 'internal', text: (node.innerHTML || '').trim(), idx: idx++ });
        continue;
      }
      if (tag === 'p' && cls.includes('scene-break')) {
        elements.push({ type: 'break', text: node.innerHTML?.trim() || '\u2022 \u2022 \u2022', idx: idx++ });
        continue;
      }
      if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
        const hasContent = (node.textContent || '').trim();
        if (hasContent) elements.push({ type: tag as 'h1' | 'h2' | 'h3', text: (node.innerHTML || '').trim(), idx: idx++ });
        continue;
      }
      if (tag === 'hr') {
        elements.push({ type: 'divider', text: '', idx: idx++ });
        continue;
      }
      if (tag === 'blockquote') {
        const hasContent = (node.textContent || '').trim();
        if (hasContent) elements.push({ type: 'quote', text: (node.innerHTML || '').trim(), idx: idx++ });
        continue;
      }
      if (tag === 'p') {
        const hasContent = (node.textContent || '').trim();
        const style = node.getAttribute('style') || undefined;
        if (hasContent) elements.push({ type: 'para', text: (node.innerHTML || '').trim(), style, idx: idx++ });
        continue;
      }
      if (tag === 'br') {
        elements.push({ type: 'linebreak', text: '', idx: idx++ });
        continue;
      }
      if (tag === 'div' && ((node.className || '').includes('audio-block') || (node.className || '').includes('scene-audio'))) {
        const sourceEl = node.querySelector('audio source');
        const audioSrc = sourceEl?.getAttribute('src') || '';
        const captionEl = node.querySelector('.caption, .audio-label');
        const caption = captionEl?.textContent?.trim() || '';
        elements.push({ type: 'audio', text: caption, audioSrc, idx: idx++ });
        continue;
      }
      if (tag === 'div' || tag === 'article' || tag === 'section') { walkChildren(node); continue; }
      const hasContent = (node.textContent || '').trim();
      if (hasContent) elements.push({ type: 'para', text: (node.innerHTML || '').trim(), idx: idx++ });
    }
  }
  walkChildren(root);
  return elements;
}

/**
 * Normalize an image src from EPUB xhtml to a relative path for the zip.
 * "../images/foo.jpg" -> "images/foo.jpg"
 */
function normalizeImgSrc(src: string): string {
  return src.replace(/^(?:\.\.\/)+/, '');
}

/**
 * Normalize an audio src from EPUB xhtml to a relative path for the zip.
 * "../audio/foo.mp3" -> "audio/foo.mp3"
 */
function normalizeAudioSrc(src: string): string {
  return src.replace(/^(?:\.\.\/)+/, '');
}

/**
 * Deep-clone a SceneCraft config and remap all media filenames to sequential names.
 */
function remapSceneCraftConfig(
  config: SceneCraftConfig,
  imageMap: Map<string, string>,
  audioMap: Map<string, string>,
): SceneCraftConfig {
  const c = JSON.parse(JSON.stringify(config)) as SceneCraftConfig;
  if (c.wallpaperFilename && imageMap.has(c.wallpaperFilename)) {
    c.wallpaperFilename = imageMap.get(c.wallpaperFilename)!;
  }
  if (c.ambientFilename && audioMap.has(c.ambientFilename)) {
    c.ambientFilename = audioMap.get(c.ambientFilename)!;
  }
  if (c.dialogueClips) {
    for (const key of Object.keys(c.dialogueClips)) {
      const clip = c.dialogueClips[Number(key)];
      if (clip?.filename && audioMap.has(clip.filename)) {
        clip.filename = audioMap.get(clip.filename)!;
      }
    }
  }
  if (c.stickyClips) {
    for (const key of Object.keys(c.stickyClips)) {
      const clip = c.stickyClips[Number(key)];
      if (clip?.filename && audioMap.has(clip.filename)) {
        clip.filename = audioMap.get(clip.filename)!;
      }
    }
  }
  if (c.paraClips) {
    for (const key of Object.keys(c.paraClips)) {
      const clip = c.paraClips[Number(key)];
      if (clip?.filename && audioMap.has(clip.filename)) {
        clip.filename = audioMap.get(clip.filename)!;
      }
    }
  }
  return c;
}

/**
 * Replace original media paths in HTML content with sequential filenames.
 * Catches <img src="images/...">, <audio src="audio/...">, url(images/...) etc.
 */
function remapMediaPaths(
  html: string,
  imageMap: Map<string, string>,
  audioMap: Map<string, string>,
): string {
  let result = html;
  for (const [orig, seq] of imageMap) {
    result = result.replaceAll(`images/${orig}`, `images/${seq}`);
  }
  for (const [orig, seq] of audioMap) {
    result = result.replaceAll(`audio/${orig}`, `audio/${seq}`);
  }
  return result;
}

/**
 * Generate SceneCraft HTML for a section — using relative paths instead of data URLs.
 */
function generateSceneCraftHtml(
  sectionTitle: string,
  xhtml: string,
  config: SceneCraftConfig,
  sectionIndex: number,
  imageMap?: Map<string, string>,
  audioMap?: Map<string, string>,
): string {
  const elements = parseSceneElements(xhtml);

  // Remap config filenames to sequential names if maps provided
  const cfg = (imageMap?.size || audioMap?.size)
    ? remapSceneCraftConfig(config, imageMap ?? new Map(), audioMap ?? new Map())
    : config;

  // Build data attributes for media — use relative paths
  const dataAttrs: string[] = [];
  dataAttrs.push(`data-sc-config='${escapeHtml(JSON.stringify(cfg))}'`);
  dataAttrs.push(`data-sc-title="${escapeHtml(sectionTitle)}"`);

  if (cfg.wallpaperFilename) {
    const safeKey = cfg.wallpaperFilename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    dataAttrs.push(`data-sc-img_${safeKey}="images/${cfg.wallpaperFilename}"`);
  }
  const audioFiles = new Set<string>();
  if (cfg.ambientFilename) audioFiles.add(cfg.ambientFilename);
  if (cfg.dialogueClips) {
    Object.values(cfg.dialogueClips).forEach(clip => {
      if (clip.filename) audioFiles.add(clip.filename);
    });
  }
  if (cfg.stickyClips) {
    Object.values(cfg.stickyClips).forEach(clip => {
      if (clip.filename) audioFiles.add(clip.filename);
    });
  }
  if (cfg.paraClips) {
    Object.values(cfg.paraClips).forEach(clip => {
      if (clip.filename) audioFiles.add(clip.filename);
    });
  }
  audioFiles.forEach(fn => {
    const safeKey = fn.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    dataAttrs.push(`data-sc-aud_${safeKey}="audio/${fn}"`);
  });

  // Build content blocks — use relative paths for media
  const blocksHtml = elements.map(item => {
    const escapedText = addTargetBlank(item.text);
    if (item.type === 'dialogue') {
      const spk = item.direction ? `${item.speaker} (${item.direction})` : (item.speaker || 'unknown');
      return `      <div class="sc-block sc-block-dialogue" data-idx="${item.idx}">
        <span class="sc-speaker">${escapeHtml(spk)}</span>
        ${escapedText}
      </div>`;
    }
    if (item.type === 'sticky') {
      let imgHtml = '';
      if (item.imgSrc) {
        const src = normalizeImgSrc(item.imgSrc);
        const enlargeId = `sc-enlarge-${++globalEnlargeCounter}`;
        imgHtml = `\n        <div class="sc-sticky-img" data-idx="${item.idx}"><input type="checkbox" id="${enlargeId}"/><label for="${enlargeId}" style="cursor:zoom-in;display:block"><img src="${src}" alt="${escapeHtml(item.alt || 'Sticky image')}"/></label><label class="sc-enlarge-overlay" for="${enlargeId}" style="display:none;position:fixed;inset:0;z-index:9999;background:center/contain no-repeat url('${src}');background-color:#000;cursor:zoom-out"></label></div>`;
      }
      const textLines = item.text.split('\n').filter(l => l.trim()).map(line =>
        `          <div class="sc-block" data-idx="${item.idx}">${addTargetBlank(line)}</div>`
      ).join('\n');
      return `      <div class="sc-block-sticky" data-idx="${item.idx}">${imgHtml}
        <div class="sc-sticky-text">
${textLines}
        </div>
      </div>`;
    }
    if (item.type === 'emphasis') {
      return `      <div class="sc-block sc-block-emphasis" data-idx="${item.idx}">${escapedText}</div>`;
    }
    if (item.type === 'quote') {
      return `      <div class="sc-block sc-block-quote" data-idx="${item.idx}">${escapedText}</div>`;
    }
    if (item.type === 'internal') {
      return `      <div class="sc-block sc-block-internal" data-idx="${item.idx}">${escapedText}</div>`;
    }
    if (item.type === 'break') {
      return `      <div class="sc-block sc-block-break" data-idx="${item.idx}">${escapedText}</div>`;
    }
    if (item.type === 'h1' || item.type === 'h2' || item.type === 'h3') {
      return `      <div class="sc-block sc-block-${item.type}" data-idx="${item.idx}">${escapedText}</div>`;
    }
    if (item.type === 'divider') {
      return `      <div class="sc-block sc-block-divider" data-idx="${item.idx}"></div>`;
    }
    if (item.type === 'linebreak') {
      return `      <div class="sc-block sc-block-linebreak" data-idx="${item.idx}"></div>`;
    }
    if (item.type === 'figure') {
      let imgTag = '';
      if (item.imgSrc) {
        const src = normalizeImgSrc(item.imgSrc);
        imgTag = `<img src="${src}" alt="${escapeHtml(item.alt || item.text)}" style="max-width:${item.width || '260px'};border-radius:4px;opacity:0.9;display:block"/>
          <span style="font-family:'SF Mono',monospace;font-size:0.55em;color:#5a554e;letter-spacing:0.06em;margin-top:0.4em;display:block">${escapeHtml(item.alt || item.text)}</span>`;
      }
      if (!imgTag) {
        imgTag = `<span style="color:#5a554e;font-style:italic;font-size:0.8em">[${escapeHtml(item.alt || item.text)}]</span>`;
      }
      return `      <div class="sc-block" data-idx="${item.idx}" style="text-align:left">${imgTag}</div>`;
    }
    if (item.type === 'audio') {
      let audioTag = '';
      if (item.audioSrc) {
        const src = normalizeAudioSrc(item.audioSrc);
        audioTag = `<audio controls preload="none" style="width:100%;max-width:400px"><source src="${src}"></audio>`;
      }
      if (!audioTag) {
        audioTag = `<span style="color:#5a554e;font-style:italic;font-size:0.8em">[audio]</span>`;
      }
      return `      <div class="sc-block" data-idx="${item.idx}">${audioTag}</div>`;
    }
    if (item.type === 'para') {
      const styleAttr = item.style ? ` style="${escapeHtml(item.style)}"` : '';
      return `      <div class="sc-block sc-block-para" data-idx="${item.idx}"${styleAttr}>${escapedText}</div>`;
    }
    const styleAttr = item.style ? ` style="${escapeHtml(item.style)}"` : '';
    return `      <div class="sc-block" data-idx="${item.idx}"${styleAttr}>${escapedText}</div>`;
  }).join('\n');

  return `
  <div class="sc-scene" id="section-${sectionIndex}" ${dataAttrs.join(' ')}>
    <div class="sc-bg"></div>
    <div class="sc-playhead"><div class="sc-playhead-dot"></div></div>
    <div class="sc-info"></div>
    <div class="sc-content">
      <div class="sc-dead-zone"><span>&nbsp;</span></div>
      <div class="sc-enter">${escapeHtml(sectionTitle)}</div>
${blocksHtml}
      <div class="sc-exit">&nbsp;</div>
      <div class="sc-dead-zone-after"></div>
    </div>
  </div>`;
}

/**
 * Generate SceneCraft HTML for autoplay — identical to generateSceneCraftHtml
 * except there is no playhead overlay div.
 */
function generateAutoplaySceneCraftHtml(
  sectionTitle: string,
  xhtml: string,
  config: SceneCraftConfig,
  sectionIndex: number,
  imageMap?: Map<string, string>,
  audioMap?: Map<string, string>,
): string {
  const elements = parseSceneElements(xhtml);

  // Remap config filenames to sequential names if maps provided
  const cfg = (imageMap?.size || audioMap?.size)
    ? remapSceneCraftConfig(config, imageMap ?? new Map(), audioMap ?? new Map())
    : config;

  // Build data attributes for media — use relative paths
  const dataAttrs: string[] = [];
  dataAttrs.push(`data-sc-config='${escapeHtml(JSON.stringify(cfg))}'`);
  dataAttrs.push(`data-sc-title="${escapeHtml(sectionTitle)}"`);

  if (cfg.wallpaperFilename) {
    const safeKey = cfg.wallpaperFilename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    dataAttrs.push(`data-sc-img_${safeKey}="images/${cfg.wallpaperFilename}"`);
  }
  const audioFiles = new Set<string>();
  if (cfg.ambientFilename) audioFiles.add(cfg.ambientFilename);
  if (cfg.dialogueClips) {
    Object.values(cfg.dialogueClips).forEach(clip => {
      if (clip.filename) audioFiles.add(clip.filename);
    });
  }
  if (cfg.stickyClips) {
    Object.values(cfg.stickyClips).forEach(clip => {
      if (clip.filename) audioFiles.add(clip.filename);
    });
  }
  if (cfg.paraClips) {
    Object.values(cfg.paraClips).forEach(clip => {
      if (clip.filename) audioFiles.add(clip.filename);
    });
  }
  audioFiles.forEach(fn => {
    const safeKey = fn.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    dataAttrs.push(`data-sc-aud_${safeKey}="audio/${fn}"`);
  });

  // Build content blocks — use relative paths for media
  const blocksHtml = elements.map(item => {
    const escapedText = addTargetBlank(item.text);
    if (item.type === 'dialogue') {
      const spk = item.direction ? `${item.speaker} (${item.direction})` : (item.speaker || 'unknown');
      return `      <div class="sc-block sc-block-dialogue" data-idx="${item.idx}">
        <span class="sc-speaker">${escapeHtml(spk)}</span>
        ${escapedText}
      </div>`;
    }
    if (item.type === 'sticky') {
      let imgHtml = '';
      if (item.imgSrc) {
        const src = normalizeImgSrc(item.imgSrc);
        const enlargeId = `sc-enlarge-${++globalEnlargeCounter}`;
        imgHtml = `\n        <div class="sc-sticky-img" data-idx="${item.idx}"><input type="checkbox" id="${enlargeId}"/><label for="${enlargeId}" style="cursor:zoom-in;display:block"><img src="${src}" alt="${escapeHtml(item.alt || 'Sticky image')}"/></label><label class="sc-enlarge-overlay" for="${enlargeId}" style="display:none;position:fixed;inset:0;z-index:9999;background:center/contain no-repeat url('${src}');background-color:#000;cursor:zoom-out"></label></div>`;
      }
      const textLines = item.text.split('\n').filter(l => l.trim()).map(line =>
        `          <div class="sc-block" data-idx="${item.idx}">${addTargetBlank(line)}</div>`
      ).join('\n');
      return `      <div class="sc-block-sticky" data-idx="${item.idx}">${imgHtml}
        <div class="sc-sticky-text">
${textLines}
        </div>
      </div>`;
    }
    if (item.type === 'emphasis') {
      return `      <div class="sc-block sc-block-emphasis" data-idx="${item.idx}">${escapedText}</div>`;
    }
    if (item.type === 'quote') {
      return `      <div class="sc-block sc-block-quote" data-idx="${item.idx}">${escapedText}</div>`;
    }
    if (item.type === 'internal') {
      return `      <div class="sc-block sc-block-internal" data-idx="${item.idx}">${escapedText}</div>`;
    }
    if (item.type === 'break') {
      return `      <div class="sc-block sc-block-break" data-idx="${item.idx}">${escapedText}</div>`;
    }
    if (item.type === 'h1' || item.type === 'h2' || item.type === 'h3') {
      return `      <div class="sc-block sc-block-${item.type}" data-idx="${item.idx}">${escapedText}</div>`;
    }
    if (item.type === 'divider') {
      return `      <div class="sc-block sc-block-divider" data-idx="${item.idx}"></div>`;
    }
    if (item.type === 'linebreak') {
      return `      <div class="sc-block sc-block-linebreak" data-idx="${item.idx}"></div>`;
    }
    if (item.type === 'figure') {
      let imgTag = '';
      if (item.imgSrc) {
        const src = normalizeImgSrc(item.imgSrc);
        imgTag = `<img src="${src}" alt="${escapeHtml(item.alt || item.text)}" style="max-width:${item.width || '260px'};border-radius:4px;opacity:0.9;display:block"/>
          <span style="font-family:'SF Mono',monospace;font-size:0.55em;color:#5a554e;letter-spacing:0.06em;margin-top:0.4em;display:block">${escapeHtml(item.alt || item.text)}</span>`;
      }
      if (!imgTag) {
        imgTag = `<span style="color:#5a554e;font-style:italic;font-size:0.8em">[${escapeHtml(item.alt || item.text)}]</span>`;
      }
      return `      <div class="sc-block" data-idx="${item.idx}" style="text-align:left">${imgTag}</div>`;
    }
    if (item.type === 'audio') {
      let audioTag = '';
      if (item.audioSrc) {
        const src = normalizeAudioSrc(item.audioSrc);
        audioTag = `<audio controls preload="none" style="width:100%;max-width:400px"><source src="${src}"></audio>`;
      }
      if (!audioTag) {
        audioTag = `<span style="color:#5a554e;font-style:italic;font-size:0.8em">[audio]</span>`;
      }
      return `      <div class="sc-block" data-idx="${item.idx}">${audioTag}</div>`;
    }
    if (item.type === 'para') {
      const styleAttr = item.style ? ` style="${escapeHtml(item.style)}"` : '';
      return `      <div class="sc-block sc-block-para" data-idx="${item.idx}"${styleAttr}>${escapedText}</div>`;
    }
    const styleAttr = item.style ? ` style="${escapeHtml(item.style)}"` : '';
    return `      <div class="sc-block" data-idx="${item.idx}"${styleAttr}>${escapedText}</div>`;
  }).join('\n');

  // No playhead div — autoplay uses footer-based scene display
  return `
  <div class="sc-scene" id="section-${sectionIndex}" ${dataAttrs.join(' ')}>
    <div class="sc-bg"></div>
    <div class="sc-info"></div>
    <div class="sc-content">
      <div class="sc-dead-zone"><span>&nbsp;</span></div>
      <div class="sc-enter">${escapeHtml(sectionTitle)}</div>
${blocksHtml}
      <div class="sc-exit">&nbsp;</div>
      <div class="sc-dead-zone-after"></div>
    </div>
  </div>`;
}

/**
 * Render a SceneCraft section as a regular chapter for Edge Read Aloud.
 * Keeps images, strips audio/wallpaper/dead zones/playhead.
 */
function generateEdgeSceneCraftHtml(
  sectionTitle: string,
  xhtml: string,
  sectionIndex: number,
  imageMap?: Map<string, string>,
): string {
  const elements = parseSceneElements(xhtml);

  const contentParts: string[] = [];

  for (const item of elements) {
    if (item.type === 'audio') continue;

    if (item.type === 'dialogue') {
      const spk = item.direction ? `${item.speaker} (${item.direction})` : (item.speaker || '');
      contentParts.push(`    <p><strong>${escapeHtml(spk)}</strong> ${addTargetBlank(item.text)}</p>`);
    } else if (item.type === 'sticky') {
      if (item.imgSrc) {
        const src = normalizeImgSrc(item.imgSrc);
        contentParts.push(`    <div class="image-container"><img src="${src}" alt="${escapeHtml(item.alt || 'Image')}" style="max-width:100%;height:auto"/></div>`);
      }
      const lines = item.text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        contentParts.push(`    <p>${addTargetBlank(line)}</p>`);
      }
    } else if (item.type === 'figure') {
      if (item.imgSrc) {
        const src = normalizeImgSrc(item.imgSrc);
        contentParts.push(`    <figure${item.width ? ` style="max-width:${item.width}"` : ''}><img src="${src}" alt="${escapeHtml(item.alt || item.text)}" style="max-width:100%;height:auto"/><figcaption>${escapeHtml(item.alt || item.text)}</figcaption></figure>`);
      }
    } else if (item.type === 'emphasis') {
      contentParts.push(`    <p style="text-align:center;font-style:italic">${addTargetBlank(item.text)}</p>`);
    } else if (item.type === 'internal') {
      contentParts.push(`    <p style="font-style:italic;padding-left:2em">${addTargetBlank(item.text)}</p>`);
    } else if (item.type === 'quote') {
      contentParts.push(`    <blockquote>${addTargetBlank(item.text)}</blockquote>`);
    } else if (item.type === 'break') {
      contentParts.push(`    <p style="text-align:center;letter-spacing:0.3em">${escapeHtml(item.text)}</p>`);
    } else if (item.type === 'h1' || item.type === 'h2' || item.type === 'h3') {
      contentParts.push(`    <${item.type}>${addTargetBlank(item.text)}</${item.type}>`);
    } else if (item.type === 'divider') {
      contentParts.push(`    <hr/>`);
    } else if (item.type === 'linebreak') {
      contentParts.push(`    <br/>`);
    } else if (item.type === 'para') {
      contentParts.push(`    <p>${addTargetBlank(item.text)}</p>`);
    }
  }

  let contentHtml = contentParts.join('\n');
  if (imageMap?.size) {
    contentHtml = remapMediaPaths(contentHtml, imageMap, new Map());
  }

  return `
  <section class="chapter" id="section-${sectionIndex}">
    <h1>${escapeHtml(sectionTitle)}</h1>
${contentHtml}
  </section>`;
}

function generateCoverHtml(
  title: string, author: string, coverFilename?: string
): string {
  if (coverFilename) {
    return `
  <section class="cover-page" style="text-align:center; margin:0; padding:2em 0;">
    <img src="images/${coverFilename}" alt="Cover" style="max-width:100%; max-height:90vh; object-fit:contain;"/>
  </section>`;
  }
  return `
  <section class="cover-page" style="background:#00517b; color:#fff; text-align:center; padding:25% 2em 2em; min-height:80vh; font-family:Georgia,serif;">
    <h1 style="font-size:2em; text-transform:uppercase; letter-spacing:0.15em; margin:0;">${escapeHtml(title)}</h1>
    <p style="font-size:1.2em; margin-top:2em;">${escapeHtml(author)}</p>
  </section>`;
}

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

// ── CSS/JS constants (copied from html-generator.ts) ──────────────────────

const EPUB_BASE_CSS = `/* EverythingEbooks — EPUB-matching base styles */

html {
  font-size: 100%;
}

body {
  font-family: serif;
  line-height: 1.6;
  margin: 1em auto;
  padding: 0 1.5rem;
  padding-bottom: 70px;
  text-align: left;
  max-width: min(92%, 1400px);
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
}

.chapter a,
.scene a,
.copyright-page a {
  color: #1a6fb5;
  text-decoration: underline;
  text-decoration-color: rgba(26, 111, 181, 0.4);
}

.chapter a:hover,
.scene a:hover,
.copyright-page a:hover {
  color: #155a94;
  text-decoration-color: rgba(21, 90, 148, 0.8);
}`;

const SCENECRAFT_CSS = `/* ── SceneCraft immersive scroll-driven styles ──── */
.sc-scene {
  position: relative;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
  background: #060608;
  color: #c8c0b4;
  overflow: clip;
}
.sc-scene .sc-bg {
  position: fixed;
  inset: 0;
  background-size: cover;
  background-repeat: no-repeat;
  opacity: 0;
  transition: opacity 1.5s ease;
  z-index: 0;
  pointer-events: none;
}
.sc-scene .sc-playhead {
  position: fixed;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: rgba(255,120,68,0.15);
  z-index: 10;
  pointer-events: none;
}
.sc-scene .sc-playhead-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255,120,68,0.4);
  position: absolute;
  left: 50%;
  top: -3px;
  transform: translateX(-50%);
}
.sc-scene .sc-info {
  position: fixed;
  right: 16px;
  top: calc(50% - 14px);
  font-size: 9px;
  letter-spacing: 0.12em;
  color: rgba(255,120,68,0.35);
  z-index: 10;
  pointer-events: none;
  font-family: 'SF Mono','Fira Code',monospace;
}
.sc-scene .sc-content {
  max-width: min(88%, 52rem);
  margin: 0 auto;
  padding: 50vh 2rem;
  font-family: Georgia, 'EB Garamond', serif;
  font-size: clamp(1.1rem, 2.2vw, 1.35rem);
  line-height: 2;
  position: relative;
  z-index: 2;
}
.sc-scene .sc-dead-zone {
  height: 50vh;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 2rem;
}
.sc-scene .sc-dead-zone span {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: #2a2620;
  font-style: italic;
  font-family: 'SF Mono','Fira Code',monospace;
}
.sc-scene .sc-enter {
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #c8c0b4;
  margin-bottom: 3em;
  padding-bottom: 1em;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  font-family: 'SF Mono','Fira Code',monospace;
}
.sc-scene .sc-exit {
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #c8c0b4;
  margin-top: 3em;
  padding-top: 1em;
  border-top: 1px solid rgba(255,255,255,0.03);
  font-style: italic;
  font-family: 'SF Mono','Fira Code',monospace;
}
.sc-scene .sc-dead-zone-after {
  height: 70vh;
}
.sc-scene .sc-block {
  margin-bottom: 1.6em;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.8s ease, transform 0.8s ease;
  position: relative;
  z-index: 2;
}
.sc-scene .sc-block.sc-vis {
  opacity: 1;
  transform: translateY(0);
}
.sc-scene .sc-block.sc-past {
  opacity: 0.3;
}
.sc-scene .sc-block-dialogue {
  color: #d4c090;
}
.sc-scene .sc-block-dialogue .sc-speaker {
  font-family: 'SF Mono','Fira Code',monospace;
  font-size: 0.65em;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #a08040;
  display: block;
  margin-bottom: 0.3em;
}
.sc-scene .sc-block-emphasis {
  font-style: italic;
  color: #e0c8b0;
  text-align: center;
}
.sc-scene .sc-block-quote {
  border-left: 2px solid rgba(200,192,180,0.3);
  padding-left: 1.5em;
}
.sc-scene .sc-block-internal {
  font-style: italic;
  padding-left: 2em;
}
.sc-scene .sc-block-break {
  text-align: center;
  color: #3a3530;
  letter-spacing: 0.3em;
}
.sc-scene .sc-block-h1 {
  font-size: 1.8em;
  font-weight: bold;
  font-family: Georgia, 'Times New Roman', serif;
  color: #c8c0b4;
}
.sc-scene .sc-block-h2 {
  font-size: 1.4em;
  font-weight: bold;
  font-family: Georgia, 'Times New Roman', serif;
  color: #c8c0b4;
}
.sc-scene .sc-block-h3 {
  font-size: 1.15em;
  font-weight: bold;
  font-family: Georgia, 'Times New Roman', serif;
  color: #c8c0b4;
}
.sc-scene .sc-block-divider {
  border-top: 1px solid rgba(200,192,180,0.15);
  margin: 1.6em 0;
}
.sc-scene .sc-block-linebreak {
  height: 1.2em;
  margin: 0;
}
.sc-scene .sc-block-sticky {
  display: flex;
  gap: 1.5em;
  align-items: flex-start;
  min-height: 300px;
  margin-bottom: 1.6em;
  position: relative;
  z-index: 2;
}
.sc-scene .sc-block-sticky .sc-block {
  margin-bottom: 0;
}
.sc-scene .sc-block-sticky .sc-sticky-img {
  position: sticky;
  top: 0;
  width: 40%;
  flex-shrink: 0;
}
.sc-scene .sc-block-sticky .sc-sticky-img input[type="checkbox"] {
  display: none;
}
.sc-scene .sc-block-sticky .sc-sticky-img input:checked ~ .sc-enlarge-overlay {
  display: block !important;
}
.sc-scene .sc-block-sticky .sc-sticky-img img {
  width: 100%;
  border-radius: 4px;
  opacity: 0.9;
}
.sc-scene .sc-block-sticky .sc-sticky-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1em;
  padding-top: 15vh;
}
body.sc-overlay-hidden .sc-playhead,
body.sc-overlay-hidden .sc-playhead-dot,
body.sc-overlay-hidden .sc-info,
body.sc-overlay-hidden .sc-dead-zone span {
  display: none !important;
}
/* ── Sticky-image enlarge: collapse stacking contexts so overlay reaches root ── */
body:has(.sc-sticky-img input:checked) .sc-scene .sc-content {
  z-index: auto;
}
body:has(.sc-sticky-img input:checked) .sc-block-sticky {
  z-index: auto;
}
body:has(.sc-sticky-img input:checked) .sc-sticky-img {
  position: static;
}
.sc-scene a {
  color: #e8c078;
  text-decoration: underline;
  text-decoration-color: rgba(232, 192, 120, 0.4);
}
.sc-scene a:hover {
  color: #f0d898;
  text-decoration-color: rgba(240, 216, 152, 0.7);
}`;

const SCENECRAFT_JS = `
    // SceneCraft scroll-driven immersive audio/visual engine
    (function() {
      var scenes = document.querySelectorAll('.sc-scene');
      if (!scenes.length) return;

      var DLG_FADE = 0.5;
      function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

      function createFadeIn(audioEl, vol, dur) {
        audioEl.volume = 0;
        audioEl.play().catch(function(){});
        return { el: audioEl, state: 'in', start: Date.now(), dur: dur * 1000, targetVol: vol };
      }
      function createFadeOut(obj, dur) {
        if (!obj || !obj.el) return null;
        return { el: obj.el, state: 'out', start: Date.now(), dur: dur * 1000, startVol: obj.el.volume };
      }
      function tickFade(obj) {
        if (!obj || !obj.el) return null;
        var t = obj.dur > 0 ? clamp((Date.now() - obj.start) / obj.dur, 0, 1) : 1;
        if (obj.state === 'in') {
          obj.el.volume = t * (obj.targetVol || 1);
          if (t >= 1) obj.state = 'playing';
        } else if (obj.state === 'out') {
          obj.el.volume = (1 - t) * (obj.startVol || 1);
          if (t >= 1) { obj.el.pause(); return null; }
        }
        return obj;
      }
      function killAudio(obj) {
        if (obj && obj.el) { obj.el.pause(); obj.el.src = ''; }
        return null;
      }

      // Per-scene state
      var sceneStates = [];
      scenes.forEach(function(sceneEl, si) {
        var cfg = null;
        try { cfg = JSON.parse(sceneEl.dataset.scConfig || 'null'); } catch(e) {}
        sceneStates.push({
          el: sceneEl,
          cfg: cfg,
          inScene: false,
          ambient: null,
          ambientOut: null,
          voice: null,
          voiceOut: null,
          activeDlg: -1,
          dlgObj: null,
          dlgOut: null,
          activeStk: -1,
          stkObj: null,
          stkOut: null,
          activePara: -1,
          paraObj: null,
          paraOut: null,
          blocks: sceneEl.querySelectorAll('.sc-block'),
          stickyWraps: sceneEl.querySelectorAll('.sc-block-sticky'),
          enterEl: sceneEl.querySelector('.sc-enter'),
          exitEl: sceneEl.querySelector('.sc-exit'),
          bgEl: sceneEl.querySelector('.sc-bg'),
          infoEl: sceneEl.querySelector('.sc-info'),
        });
      });

      var playheadY = window.innerHeight * 0.5;
      window.addEventListener('resize', function() { playheadY = window.innerHeight * 0.5; });

      function doEnter(s) {
        if (s.inScene || !s.cfg) return;
        s.inScene = true;
        var c = s.cfg;
        if (s.infoEl) s.infoEl.textContent = s.el.dataset.scTitle || '';

        // Wallpaper
        if (c.wallpaperFilename && s.bgEl) {
          var url = s.el.dataset['scImg_' + c.wallpaperFilename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()];
          if (url) {
            s.bgEl.style.backgroundImage = "url('" + url + "')";
            s.bgEl.style.backgroundPosition = c.wallpaperPosition || 'center';
            s.bgEl.style.opacity = String(c.wallpaperOpacity || 0.25);
          }
        }

        // Ambient audio
        s.ambientOut = killAudio(s.ambientOut);
        if (c.ambientFilename) {
          var aUrl = s.el.dataset['scAud_' + c.ambientFilename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()];
          if (aUrl) {
            var a = new Audio(aUrl);
            a.loop = !!c.ambientLoop;
            s.ambient = createFadeIn(a, c.ambientVolume || 0.5, c.fadeIn || 2);
          }
        }

      }

      function doExit(s) {
        if (!s.inScene || !s.cfg) return;
        s.inScene = false;
        var c = s.cfg;
        if (s.infoEl) s.infoEl.textContent = '';
        if (s.bgEl) s.bgEl.style.opacity = '0';

        if (s.ambient) { s.ambientOut = createFadeOut(s.ambient, c.fadeOut || 3); s.ambient = null; }
        if (s.voice) { s.voiceOut = createFadeOut(s.voice, c.fadeOut || 3); s.voice = null; }
        s.dlgObj = killAudio(s.dlgObj);
        s.dlgOut = killAudio(s.dlgOut);
        s.activeDlg = -1;
        s.stkObj = killAudio(s.stkObj);
        s.stkOut = killAudio(s.stkOut);
        s.activeStk = -1;
        s.paraObj = killAudio(s.paraObj);
        s.paraOut = killAudio(s.paraOut);
        s.activePara = -1;
      }

      function tick() {
        for (var si = 0; si < sceneStates.length; si++) {
          var s = sceneStates[si];
          if (!s.cfg) continue;
          var c = s.cfg;

          // Tick fades
          s.ambientOut = tickFade(s.ambientOut);
          s.voiceOut = tickFade(s.voiceOut);
          if (s.ambient && s.ambient.state === 'in') tickFade(s.ambient);
          if (s.voice && s.voice.state === 'in') tickFade(s.voice);
          s.dlgObj = tickFade(s.dlgObj);
          s.dlgOut = tickFade(s.dlgOut);
          s.stkObj = tickFade(s.stkObj);
          s.stkOut = tickFade(s.stkOut);
          s.paraObj = tickFade(s.paraObj);
          s.paraOut = tickFade(s.paraOut);

          // Block visibility
          for (var bi = 0; bi < s.blocks.length; bi++) {
            var b = s.blocks[bi];
            var rect = b.getBoundingClientRect();
            var center = rect.top + rect.height / 2;
            if (center < playheadY + 100) b.classList.add('sc-vis'); else b.classList.remove('sc-vis');
            if (center < playheadY - window.innerHeight * 0.3) b.classList.add('sc-past'); else b.classList.remove('sc-past');
          }

          // Scene zone detection
          var enterBottom = s.enterEl ? s.enterEl.getBoundingClientRect().bottom : 0;
          var exitTop = s.exitEl ? s.exitEl.getBoundingClientRect().top : window.innerHeight;
          if (enterBottom <= playheadY && exitTop > playheadY) {
            doEnter(s);
          } else {
            doExit(s);
          }

          // Per-dialogue voice
          if (s.inScene) {
            var currentDlg = -1;
            for (var di = 0; di < s.blocks.length; di++) {
              var db = s.blocks[di];
              var dr = db.getBoundingClientRect();
              var dataIdx = parseInt(db.dataset.idx || '-1', 10);
              if (dr.top < playheadY && dr.bottom > playheadY && db.classList.contains('sc-block-dialogue')) {
                currentDlg = dataIdx;
              }
            }
            if (currentDlg !== s.activeDlg) {
              if (s.dlgObj && s.dlgObj.el) {
                s.dlgOut = killAudio(s.dlgOut);
                s.dlgOut = createFadeOut(s.dlgObj, DLG_FADE);
                s.dlgObj = null;
              }
              s.activeDlg = currentDlg;
              if (currentDlg >= 0 && c.dialogueClips) {
                var clip = c.dialogueClips[currentDlg];
                if (clip && clip.filename) {
                  var dUrl = s.el.dataset['scAud_' + clip.filename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()];
                  if (dUrl) {
                    var da = new Audio(dUrl);
                    s.dlgObj = createFadeIn(da, clip.volume || c.dialogueVolume || 0.8, DLG_FADE);
                  }
                }
              }
            }
          }

          // Per-sticky audio
          if (s.inScene) {
            var currentStk = -1;
            for (var swi = 0; swi < s.stickyWraps.length; swi++) {
              var sw = s.stickyWraps[swi];
              var sIdx = parseInt(sw.dataset.idx || '-1', 10);
              if (sw.querySelector('.sc-block.sc-vis')) {
                currentStk = sIdx;
              }
            }
            if (currentStk !== s.activeStk) {
              if (s.stkObj && s.stkObj.el) {
                s.stkOut = killAudio(s.stkOut);
                s.stkOut = createFadeOut(s.stkObj, DLG_FADE);
                s.stkObj = null;
              }
              s.activeStk = currentStk;
              if (currentStk >= 0 && c.stickyClips) {
                var sClip = c.stickyClips[currentStk];
                if (sClip && sClip.filename) {
                  var sUrl = s.el.dataset['scAud_' + sClip.filename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()];
                  if (sUrl) {
                    var sa = new Audio(sUrl);
                    s.stkObj = createFadeIn(sa, sClip.volume || c.stickyVolume || 0.8, DLG_FADE);
                  }
                }
              }
            }
          }

          // Per-para audio
          if (s.inScene) {
            var currentPara = -1;
            for (var pi = 0; pi < s.blocks.length; pi++) {
              var pb = s.blocks[pi];
              var pr = pb.getBoundingClientRect();
              var pIdx = parseInt(pb.dataset.idx || '-1', 10);
              if (pr.top < playheadY && pr.bottom > playheadY && !pb.classList.contains('sc-block-dialogue') && pb.classList.contains('sc-block-para')) {
                currentPara = pIdx;
              }
            }
            if (currentPara !== s.activePara) {
              if (s.paraObj && s.paraObj.el) {
                s.paraOut = killAudio(s.paraOut);
                s.paraOut = createFadeOut(s.paraObj, DLG_FADE);
                s.paraObj = null;
              }
              s.activePara = currentPara;
              if (currentPara >= 0 && c.paraClips) {
                var pClip = c.paraClips[currentPara];
                if (pClip && pClip.filename) {
                  var pUrl = s.el.dataset['scAud_' + pClip.filename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()];
                  if (pUrl) {
                    var pa = new Audio(pUrl);
                    s.paraObj = createFadeIn(pa, pClip.volume || c.paraVolume || 0.8, DLG_FADE);
                  }
                }
              }
            }
          }
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    })();`;

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

body.dark-mode .chapter a,
body.dark-mode .scene a,
body.dark-mode .copyright-page a {
  color: #5bb8f5;
  text-decoration-color: rgba(91, 184, 245, 0.4);
}

body.dark-mode .chapter a:hover,
body.dark-mode .scene a:hover,
body.dark-mode .copyright-page a:hover {
  color: #7dcaff;
  text-decoration-color: rgba(125, 202, 255, 0.8);
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
  gap: 12px;
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

.playhead-toggle {
  background: none;
  border: none;
  cursor: pointer;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
}
.playhead-toggle:hover {
  background: rgba(255, 255, 255, 0.1);
}
.playhead-toggle svg {
  width: 22px;
  height: 22px;
  fill: #ff7844;
  transition: opacity 0.2s;
}
.playhead-toggle.sc-off svg {
  opacity: 0.35;
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

// ── Autoplay-specific CSS/JS constants ────────────────────────────────────

const SCENECRAFT_AUTOPLAY_CSS = `/* ── SceneCraft autoplay immersive styles ──── */
.sc-scene {
  position: relative;
  width: 100vw;
  margin-left: calc(-50vw + 50%);
  background: #060608;
  color: #c8c0b4;
  overflow: clip;
}
.sc-scene .sc-bg {
  position: fixed;
  inset: 0;
  background-size: cover;
  background-repeat: no-repeat;
  opacity: 0;
  transition: opacity 1.5s ease;
  z-index: 0;
  pointer-events: none;
}
.sc-scene .sc-info {
  display: none;
}
.sc-scene .sc-content {
  max-width: min(88%, 52rem);
  margin: 0 auto;
  padding: 50vh 2rem;
  font-family: Georgia, 'EB Garamond', serif;
  font-size: clamp(1.1rem, 2.2vw, 1.35rem);
  line-height: 2;
  position: relative;
  z-index: 2;
}
.sc-scene .sc-dead-zone {
  height: 50vh;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 2rem;
}
.sc-scene .sc-dead-zone span {
  font-size: 10px;
  letter-spacing: 0.15em;
  color: #2a2620;
  font-style: italic;
  font-family: 'SF Mono','Fira Code',monospace;
}
.sc-scene .sc-enter {
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #c8c0b4;
  margin-bottom: 3em;
  padding-bottom: 1em;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  font-family: 'SF Mono','Fira Code',monospace;
}
.sc-scene .sc-exit {
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #c8c0b4;
  margin-top: 3em;
  padding-top: 1em;
  border-top: 1px solid rgba(255,255,255,0.03);
  font-style: italic;
  font-family: 'SF Mono','Fira Code',monospace;
}
.sc-scene .sc-dead-zone-after {
  height: 70vh;
}
.sc-scene .sc-block {
  margin-bottom: 1.6em;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.8s ease, transform 0.8s ease;
  position: relative;
  z-index: 2;
}
.sc-scene .sc-block.sc-vis {
  opacity: 1;
  transform: translateY(0);
}
.sc-scene .sc-block.sc-past {
  opacity: 0.3;
}
.sc-scene .sc-block-dialogue {
  color: #d4c090;
}
.sc-scene .sc-block-dialogue .sc-speaker {
  font-family: 'SF Mono','Fira Code',monospace;
  font-size: 0.65em;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #a08040;
  display: block;
  margin-bottom: 0.3em;
}
.sc-scene .sc-block-emphasis {
  font-style: italic;
  color: #e0c8b0;
  text-align: center;
}
.sc-scene .sc-block-quote {
  border-left: 2px solid rgba(200,192,180,0.3);
  padding-left: 1.5em;
}
.sc-scene .sc-block-internal {
  font-style: italic;
  padding-left: 2em;
}
.sc-scene .sc-block-break {
  text-align: center;
  color: #3a3530;
  letter-spacing: 0.3em;
}
.sc-scene .sc-block-h1 {
  font-size: 1.8em;
  font-weight: bold;
  font-family: Georgia, 'Times New Roman', serif;
  color: #c8c0b4;
}
.sc-scene .sc-block-h2 {
  font-size: 1.4em;
  font-weight: bold;
  font-family: Georgia, 'Times New Roman', serif;
  color: #c8c0b4;
}
.sc-scene .sc-block-h3 {
  font-size: 1.15em;
  font-weight: bold;
  font-family: Georgia, 'Times New Roman', serif;
  color: #c8c0b4;
}
.sc-scene .sc-block-divider {
  border-top: 1px solid rgba(200,192,180,0.15);
  margin: 1.6em 0;
}
.sc-scene .sc-block-linebreak {
  height: 1.2em;
  margin: 0;
}
.sc-scene .sc-block-sticky {
  display: flex;
  gap: 1.5em;
  align-items: flex-start;
  min-height: 300px;
  margin-bottom: 1.6em;
  position: relative;
  z-index: 2;
}
.sc-scene .sc-block-sticky .sc-block {
  margin-bottom: 0;
}
.sc-scene .sc-block-sticky .sc-sticky-img {
  position: sticky;
  top: 0;
  width: 40%;
  flex-shrink: 0;
}
.sc-scene .sc-block-sticky .sc-sticky-img input[type="checkbox"] {
  display: none;
}
.sc-scene .sc-block-sticky .sc-sticky-img input:checked ~ .sc-enlarge-overlay {
  display: block !important;
}
.sc-scene .sc-block-sticky .sc-sticky-img img {
  width: 100%;
  border-radius: 4px;
  opacity: 0.9;
}
.sc-scene .sc-block-sticky .sc-sticky-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1em;
  padding-top: 15vh;
}
/* ── Sticky-image enlarge: collapse stacking contexts so overlay reaches root ── */
body:has(.sc-sticky-img input:checked) .sc-scene .sc-content {
  z-index: auto;
}
body:has(.sc-sticky-img input:checked) .sc-block-sticky {
  z-index: auto;
}
body:has(.sc-sticky-img input:checked) .sc-sticky-img {
  position: static;
}
.sc-scene a {
  color: #e8c078;
  text-decoration: underline;
  text-decoration-color: rgba(232, 192, 120, 0.4);
}
.sc-scene a:hover {
  color: #f0d898;
  text-decoration-color: rgba(240, 216, 152, 0.7);
}
/* ── Autoplay footer extras ──── */
.footer-scene {
  color: rgba(255,120,68,0.35);
  font-family: 'SF Mono','Fira Code',monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  margin-left: 12px;
}
.footer-scene-label {
  color: #777;
}
.footer-status {
  font-family: "SF Mono", "Fira Code", monospace;
  font-size: 10px;
  letter-spacing: 0.1em;
  color: rgba(255,120,68,0.35);
  margin-left: auto;
  user-select: none;
  transition: opacity 2s;
  white-space: nowrap;
  padding: 4px 14px;
  border-radius: 999px;
  background: transparent;
  border: 1px solid transparent;
}
.footer-status.pill {
  background: rgba(255,120,68,0.08);
  border-color: rgba(255,120,68,0.12);
  cursor: pointer;
}`;

const SCENECRAFT_AUTOPLAY_JS = `
    // SceneCraft autoplay: scroll-driven audio + auto-scroll controller
    (function() {
      var scenes = document.querySelectorAll('.sc-scene');
      if (!scenes.length) return;

      var DLG_FADE = 0.5;
      function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

      function createFadeIn(audioEl, vol, dur) {
        audioEl.volume = 0;
        audioEl.play().catch(function(){});
        return { el: audioEl, state: 'in', start: Date.now(), dur: dur * 1000, targetVol: vol };
      }
      function createFadeOut(obj, dur) {
        if (!obj || !obj.el) return null;
        return { el: obj.el, state: 'out', start: Date.now(), dur: dur * 1000, startVol: obj.el.volume };
      }
      function tickFade(obj) {
        if (!obj || !obj.el) return null;
        var t = obj.dur > 0 ? clamp((Date.now() - obj.start) / obj.dur, 0, 1) : 1;
        if (obj.state === 'in') {
          obj.el.volume = t * (obj.targetVol || 1);
          if (t >= 1) obj.state = 'playing';
        } else if (obj.state === 'out') {
          obj.el.volume = (1 - t) * (obj.startVol || 1);
          if (t >= 1) { obj.el.pause(); return null; }
        }
        return obj;
      }
      function killAudio(obj) {
        if (obj && obj.el) { obj.el.pause(); obj.el.src = ''; }
        return null;
      }

      // Per-scene state
      var sceneStates = [];
      scenes.forEach(function(sceneEl, si) {
        var cfg = null;
        try { cfg = JSON.parse(sceneEl.dataset.scConfig || 'null'); } catch(e) {}
        sceneStates.push({
          el: sceneEl,
          cfg: cfg,
          inScene: false,
          ambient: null,
          ambientOut: null,
          voice: null,
          voiceOut: null,
          activeDlg: -1,
          dlgObj: null,
          dlgOut: null,
          activeStk: -1,
          stkObj: null,
          stkOut: null,
          activePara: -1,
          paraObj: null,
          paraOut: null,
          blocks: sceneEl.querySelectorAll('.sc-block'),
          stickyWraps: sceneEl.querySelectorAll('.sc-block-sticky'),
          enterEl: sceneEl.querySelector('.sc-enter'),
          exitEl: sceneEl.querySelector('.sc-exit'),
          bgEl: sceneEl.querySelector('.sc-bg'),
        });
      });

      var playheadY = window.innerHeight * 0.5;
      window.addEventListener('resize', function() { playheadY = window.innerHeight * 0.5; });

      function doEnter(s) {
        if (s.inScene || !s.cfg) return;
        s.inScene = true;
        var c = s.cfg;
        var footerScene = document.getElementById('footerScene');
        var scTitle = s.el.dataset.scTitle || '';
        if (footerScene) footerScene.innerHTML = scTitle ? '<span class="footer-scene-label">now playing: </span>' + scTitle : '';

        // Wallpaper
        if (c.wallpaperFilename && s.bgEl) {
          var url = s.el.dataset['scImg_' + c.wallpaperFilename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()];
          if (url) {
            s.bgEl.style.backgroundImage = "url('" + url + "')";
            s.bgEl.style.backgroundPosition = c.wallpaperPosition || 'center';
            s.bgEl.style.opacity = String(c.wallpaperOpacity || 0.25);
          }
        }

        // Ambient audio
        s.ambientOut = killAudio(s.ambientOut);
        if (c.ambientFilename) {
          var aUrl = s.el.dataset['scAud_' + c.ambientFilename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()];
          if (aUrl) {
            var a = new Audio(aUrl);
            a.loop = !!c.ambientLoop;
            s.ambient = createFadeIn(a, c.ambientVolume || 0.5, c.fadeIn || 2);
          }
        }

      }

      function doExit(s) {
        if (!s.inScene || !s.cfg) return;
        s.inScene = false;
        var c = s.cfg;
        var footerScene = document.getElementById('footerScene');
        var myTitle = s.el.dataset.scTitle || '';
        if (footerScene && myTitle && footerScene.textContent.indexOf(myTitle) !== -1) {
          footerScene.innerHTML = '';
        }
        if (s.bgEl) s.bgEl.style.opacity = '0';

        if (s.ambient) { s.ambientOut = createFadeOut(s.ambient, c.fadeOut || 3); s.ambient = null; }
        if (s.voice) { s.voiceOut = createFadeOut(s.voice, c.fadeOut || 3); s.voice = null; }
        s.dlgObj = killAudio(s.dlgObj);
        s.dlgOut = killAudio(s.dlgOut);
        s.activeDlg = -1;
        s.stkObj = killAudio(s.stkObj);
        s.stkOut = killAudio(s.stkOut);
        s.activeStk = -1;
        s.paraObj = killAudio(s.paraObj);
        s.paraOut = killAudio(s.paraOut);
        s.activePara = -1;
      }

      function tick() {
        for (var si = 0; si < sceneStates.length; si++) {
          var s = sceneStates[si];
          if (!s.cfg) continue;
          var c = s.cfg;

          // Tick fades
          s.ambientOut = tickFade(s.ambientOut);
          s.voiceOut = tickFade(s.voiceOut);
          if (s.ambient && s.ambient.state === 'in') tickFade(s.ambient);
          if (s.voice && s.voice.state === 'in') tickFade(s.voice);
          s.dlgObj = tickFade(s.dlgObj);
          s.dlgOut = tickFade(s.dlgOut);
          s.stkObj = tickFade(s.stkObj);
          s.stkOut = tickFade(s.stkOut);
          s.paraObj = tickFade(s.paraObj);
          s.paraOut = tickFade(s.paraOut);

          // Block visibility
          for (var bi = 0; bi < s.blocks.length; bi++) {
            var b = s.blocks[bi];
            var rect = b.getBoundingClientRect();
            var center = rect.top + rect.height / 2;
            if (center < playheadY + 100) b.classList.add('sc-vis'); else b.classList.remove('sc-vis');
            if (center < playheadY - window.innerHeight * 0.3) b.classList.add('sc-past'); else b.classList.remove('sc-past');
          }

          // Scene zone detection
          var enterBottom = s.enterEl ? s.enterEl.getBoundingClientRect().bottom : 0;
          var exitTop = s.exitEl ? s.exitEl.getBoundingClientRect().top : window.innerHeight;
          if (enterBottom <= playheadY && exitTop > playheadY) {
            doEnter(s);
          } else {
            doExit(s);
          }

          // Per-dialogue voice
          if (s.inScene) {
            var currentDlg = -1;
            for (var di = 0; di < s.blocks.length; di++) {
              var db = s.blocks[di];
              var dr = db.getBoundingClientRect();
              var dataIdx = parseInt(db.dataset.idx || '-1', 10);
              if (dr.top < playheadY && dr.bottom > playheadY && db.classList.contains('sc-block-dialogue')) {
                currentDlg = dataIdx;
              }
            }
            if (currentDlg !== s.activeDlg) {
              if (s.dlgObj && s.dlgObj.el) {
                s.dlgOut = killAudio(s.dlgOut);
                s.dlgOut = createFadeOut(s.dlgObj, DLG_FADE);
                s.dlgObj = null;
              }
              s.activeDlg = currentDlg;
              if (currentDlg >= 0 && c.dialogueClips) {
                var clip = c.dialogueClips[currentDlg];
                if (clip && clip.filename) {
                  var dUrl = s.el.dataset['scAud_' + clip.filename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()];
                  if (dUrl) {
                    var da = new Audio(dUrl);
                    s.dlgObj = createFadeIn(da, clip.volume || c.dialogueVolume || 0.8, DLG_FADE);
                  }
                }
              }
            }
          }

          // Per-sticky audio
          if (s.inScene) {
            var currentStk = -1;
            for (var swi = 0; swi < s.stickyWraps.length; swi++) {
              var sw = s.stickyWraps[swi];
              var sIdx = parseInt(sw.dataset.idx || '-1', 10);
              if (sw.querySelector('.sc-block.sc-vis')) {
                currentStk = sIdx;
              }
            }
            if (currentStk !== s.activeStk) {
              if (s.stkObj && s.stkObj.el) {
                s.stkOut = killAudio(s.stkOut);
                s.stkOut = createFadeOut(s.stkObj, DLG_FADE);
                s.stkObj = null;
              }
              s.activeStk = currentStk;
              if (currentStk >= 0 && c.stickyClips) {
                var sClip = c.stickyClips[currentStk];
                if (sClip && sClip.filename) {
                  var sUrl = s.el.dataset['scAud_' + sClip.filename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()];
                  if (sUrl) {
                    var sa = new Audio(sUrl);
                    s.stkObj = createFadeIn(sa, sClip.volume || c.stickyVolume || 0.8, DLG_FADE);
                  }
                }
              }
            }
          }

          // Per-para audio
          if (s.inScene) {
            var currentPara = -1;
            for (var pi = 0; pi < s.blocks.length; pi++) {
              var pb = s.blocks[pi];
              var pr = pb.getBoundingClientRect();
              var pIdx = parseInt(pb.dataset.idx || '-1', 10);
              if (pr.top < playheadY && pr.bottom > playheadY && !pb.classList.contains('sc-block-dialogue') && pb.classList.contains('sc-block-para')) {
                currentPara = pIdx;
              }
            }
            if (currentPara !== s.activePara) {
              if (s.paraObj && s.paraObj.el) {
                s.paraOut = killAudio(s.paraOut);
                s.paraOut = createFadeOut(s.paraObj, DLG_FADE);
                s.paraObj = null;
              }
              s.activePara = currentPara;
              if (currentPara >= 0 && c.paraClips) {
                var pClip = c.paraClips[currentPara];
                if (pClip && pClip.filename) {
                  var pUrl = s.el.dataset['scAud_' + pClip.filename.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()];
                  if (pUrl) {
                    var pa = new Audio(pUrl);
                    s.paraObj = createFadeIn(pa, pClip.volume || c.paraVolume || 0.8, DLG_FADE);
                  }
                }
              }
            }
          }
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);

      // ── Autoplay scroll controller ──────────────────────────
      // Audio is the master clock.
      // Dialogue/para clips GATE the scroll (nearly pause until done).
      // Sticky clips PACE the scroll (keep scrolling to reveal text).
      // Ambient never affects scroll — it is just atmosphere.

      var FRONT_MATTER_SPEED = 0.3; // px/frame for cover, copyright, TOC (~18px/s)
      var BASE_SPEED = 0.8;        // px/frame through non-audio content (~48px/s @ 60fps)
      var DEAD_ZONE_SPEED = 2.5;   // px/frame through silence gaps (dead zones)
      var CREEP_SPEED = 0.15;      // px/frame — tiny drift while a dialogue clip plays
      var PAUSE_AFTER_CLIP = 45;   // frames to breathe after a clip ends (~0.75s)
      var STICKY_MIN_SPEED = 0.08;    // very low floor — let audio fully control pace
      var STICKY_MAX_SPEED = 1.2;     // cap for sticky clips
      var FPS = 60;

      var firstSceneEl = document.querySelector('.sc-scene');
      var pastFrontMatter = false;

      function isInFrontMatter() {
        if (pastFrontMatter) return false;
        if (firstSceneEl && firstSceneEl.getBoundingClientRect().top <= window.innerHeight) {
          pastFrontMatter = true;
          return false;
        }
        return true;
      }

      var autoScrollActive = false;
      var scrollDone = false;
      var postClipTimer = 0;

      function isClipPlaying(obj) {
        if (!obj || !obj.el) return false;
        return !obj.el.paused && !obj.el.ended;
      }

      function hasDuration(obj) {
        if (!obj || !obj.el) return false;
        return obj.el.duration && !isNaN(obj.el.duration) && obj.el.duration > 0;
      }

      // Only dialogue and para clips gate (nearly stop scroll).
      // Sticky clips are handled separately with pacing.
      function isGatedAudioPlaying() {
        for (var i = 0; i < sceneStates.length; i++) {
          var s = sceneStates[i];
          if (isClipPlaying(s.dlgObj)) return true;
          if (isClipPlaying(s.paraObj)) return true;
          // NOTE: stkObj is NOT here — sticky clips are paced, not gated
        }
        return false;
      }

      function isInDeadZone() {
        for (var i = 0; i < sceneStates.length; i++) {
          if (sceneStates[i].inScene) return false;
        }
        return true;
      }

      // For sticky clips: pace scroll so the sticky section finishes
      // scrolling right when the audio clip ends.
      function getStickyPacedSpeed() {
        for (var i = 0; i < sceneStates.length; i++) {
          var s = sceneStates[i];
          if (!s.inScene) continue;
          if (!isClipPlaying(s.stkObj)) continue;

          // If playing but duration not loaded yet, crawl until we can calculate
          if (!hasDuration(s.stkObj)) return STICKY_MIN_SPEED;

          var audio = s.stkObj.el;
          var remaining = audio.duration - audio.currentTime;
          if (remaining <= 0) continue;

          // Find the active sticky wrapper element
          var activeIdx = s.activeStk;
          if (activeIdx < 0) continue;

          for (var sw = 0; sw < s.stickyWraps.length; sw++) {
            var wrap = s.stickyWraps[sw];
            var idx = parseInt(wrap.dataset.idx || '-1', 10);
            if (idx !== activeIdx) continue;

            // Find the last text block inside the sticky text column
            var textBlocks = wrap.querySelectorAll('.sc-sticky-text .sc-block');
            if (!textBlocks.length) continue;
            var lastBlock = textBlocks[textBlocks.length - 1];
            var lastRect = lastBlock.getBoundingClientRect();

            // Distance = bottom of last text block to playhead
            var pixelsLeft = lastRect.bottom - playheadY;

            // If all text has already passed the playhead but audio still playing,
            // keep scrolling slowly — don't jump to BASE_SPEED
            if (pixelsLeft <= 10) return BASE_SPEED;

            var speed = pixelsLeft / (remaining * FPS);
            speed = Math.max(STICKY_MIN_SPEED, Math.min(STICKY_MAX_SPEED, speed));
            return speed;
          }

          // Sticky clip is playing but couldn't find wrapper — crawl
          return STICKY_MIN_SPEED;
        }
        return null;
      }

      function autoScroll() {
        if (!autoScrollActive || scrollDone) {
          requestAnimationFrame(autoScroll);
          return;
        }

        var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (window.scrollY >= maxScroll) {
          scrollDone = true;
          console.log('Autoplay: reached the end.');
          return;
        }

        var speed;

        // Priority 0: front matter (cover, copyright, TOC) — slow scroll
        if (isInFrontMatter()) {
          speed = FRONT_MATTER_SPEED;
          window.scrollBy(0, speed);
          requestAnimationFrame(autoScroll);
          return;
        }

        // Priority 1: dialogue/para clip playing — gate (nearly stop)
        if (isGatedAudioPlaying()) {
          speed = CREEP_SPEED;
          postClipTimer = PAUSE_AFTER_CLIP;
        }
        // Priority 2: just finished a clip — brief pause
        else if (postClipTimer > 0) {
          speed = CREEP_SPEED;
          postClipTimer--;
        }
        // Priority 3: sticky clip playing — pace through the sticky section
        else {
          var stickySpeed = getStickyPacedSpeed();
          if (stickySpeed !== null) {
            speed = stickySpeed;
          }
          // Priority 4: dead zone — move through silence
          else if (isInDeadZone()) {
            speed = DEAD_ZONE_SPEED;
          }
          // Default: gentle reading pace
          else {
            speed = BASE_SPEED;
          }
        }

        window.scrollBy(0, speed);
        requestAnimationFrame(autoScroll);
      }

      // Status indicator + start/pause control (lives in the footer)
      var statusEl = document.getElementById('footerStatus');
      statusEl.textContent = 'PRESS SPACE TO BEGIN';
      statusEl.classList.add('pill');

      document.addEventListener('keydown', function(e) {
        if (e.code === 'Space') {
          e.preventDefault();
          if (scrollDone) return;

          autoScrollActive = !autoScrollActive;

          if (autoScrollActive) {
            statusEl.textContent = 'PLAYING';
            statusEl.classList.remove('pill');
            // fade out the indicator after 1 second
            setTimeout(function() {
              if (autoScrollActive) statusEl.style.opacity = '0';
            }, 1000);
          } else {
            statusEl.style.opacity = '1';
            statusEl.textContent = 'PAUSED \\u2014 SPACE TO RESUME';
            statusEl.classList.add('pill');
          }
        }
      });

      // also allow clicking the status bar to toggle
      statusEl.addEventListener('click', function() {
        var ev = new KeyboardEvent('keydown', { code: 'Space' });
        document.dispatchEvent(ev);
      });

      requestAnimationFrame(autoScroll);

    })();`;
