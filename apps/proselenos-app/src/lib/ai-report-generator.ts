// src/lib/ai-report-generator.ts
// Generates a simple EPUB for AI tool reports

import JSZip from 'jszip';

/**
 * Generate an EPUB containing the AI tool report.
 * Chapter 1: AI Response
 * Chapter 2: Request Sent (prompt + manuscript)
 */
export async function generateAIReportEpub(
  toolName: string,
  aiResponse: string,
  requestContent: string
): Promise<Uint8Array> {
  const zip = new JSZip();

  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString();
  const title = `${dateStr}\n${timeStr}\n${toPascalCase(toolName)}`;
  const author = 'AI Report';                // Shows as line 3 in Library
  const uuid = generateUUID();
  const date = now.toISOString().split('T')[0] || now.toISOString().slice(0, 10);

  // 1. mimetype (uncompressed)
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });

  // 2. META-INF/container.xml
  zip.file('META-INF/container.xml', `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`);

  // 3. CSS
  zip.file('OEBPS/css/style.css', createReportCSS());

  // 4. Title page
  zip.file('OEBPS/title-page.xhtml', createTitlePage(title, author, toolName));

  // 5. Chapter 1: AI Response
  zip.file('OEBPS/chapter1.xhtml', createChapterPage('AI Response', aiResponse, 'chapter1'));

  // 6. Chapter 2: Request Sent
  zip.file('OEBPS/chapter2.xhtml', createChapterPage('Request Sent', requestContent, 'chapter2'));

  // 7. Navigation (EPUB 3.0)
  zip.file('OEBPS/nav.xhtml', createNavXHTML(title));

  // 8. TOC NCX (EPUB 2 compatibility)
  zip.file('OEBPS/toc.ncx', createTocNCX(title, uuid));

  // 9. content.opf
  zip.file('OEBPS/content.opf', createContentOPF(title, author, uuid, date));

  // Generate
  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function convertMarkdownToHtml(text: string): string {
  // First escape HTML to prevent XSS
  let result = escapeHtml(text);

  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_ (but not inside words like file_name)
  // Use negative lookbehind/ahead to avoid matching inside words
  result = result.replace(/(?<!\w)\*(?!\*)(.+?)(?<!\*)\*(?!\w)/g, '<em>$1</em>');
  result = result.replace(/(?<!\w)_(?!_)(.+?)(?<!_)_(?!\w)/g, '<em>$1</em>');

  // Links: [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  return result;
}

function toPascalCase(text: string): string {
  return text
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function createTitlePage(title: string, author: string, toolName: string): string {
  // Title contains "date\ntime" - split and display on separate lines
  const [dateLine, timeLine] = title.split('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Title Page</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <section class="title-page" epub:type="titlepage">
    <p class="book-date">${escapeHtml(dateLine || '')}</p>
    <p class="book-time">${escapeHtml(timeLine || '')}</p>
    <h1 class="book-title">${escapeHtml(author)}</h1>
    <p class="tool-name">Tool: ${escapeHtml(toolName)}</p>
  </section>
</body>
</html>`;
}

function createChapterPage(chapterTitle: string, content: string, id: string): string {
  // Convert plain text to paragraphs - split on double newlines
  const paragraphs = content
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0)
    .map(p => `    <p>${convertMarkdownToHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeHtml(chapterTitle)}</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <section class="chapter" epub:type="chapter" id="${id}">
    <h1>${escapeHtml(chapterTitle)}</h1>
${paragraphs}
  </section>
</body>
</html>`;
}

function createNavXHTML(_title: string): string {
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
      <li><a href="title-page.xhtml">Title Page</a></li>
      <li><a href="chapter1.xhtml">AI Response</a></li>
      <li><a href="chapter2.xhtml">Request Sent</a></li>
    </ol>
  </nav>
</body>
</html>`;
}

function createTocNCX(title: string, uuid: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN" "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uuid}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeHtml(title)}</text>
  </docTitle>
  <navMap>
    <navPoint id="navpoint-1" playOrder="1">
      <navLabel><text>Title Page</text></navLabel>
      <content src="title-page.xhtml"/>
    </navPoint>
    <navPoint id="navpoint-2" playOrder="2">
      <navLabel><text>AI Response</text></navLabel>
      <content src="chapter1.xhtml"/>
    </navPoint>
    <navPoint id="navpoint-3" playOrder="3">
      <navLabel><text>Request Sent</text></navLabel>
      <content src="chapter2.xhtml"/>
    </navPoint>
  </navMap>
</ncx>`;
}

function createContentOPF(title: string, author: string, uuid: string, date: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${uuid}</dc:identifier>
    <dc:title>${escapeHtml(title)}</dc:title>
    <dc:creator>${escapeHtml(author)}</dc:creator>
    <dc:language>en</dc:language>
    <dc:date>${date}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString()}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="title-page" href="title-page.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter1" href="chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="chapter2" href="chapter2.xhtml" media-type="application/xhtml+xml"/>
    <item id="style" href="css/style.css" media-type="text/css"/>
  </manifest>
  <spine toc="toc">
    <itemref idref="title-page"/>
    <itemref idref="chapter1"/>
    <itemref idref="chapter2"/>
  </spine>
</package>`;
}

function createReportCSS(): string {
  return `/* AI Report EPUB CSS */

body {
  font-family: serif;
  line-height: 1.6;
  margin: 1em;
  padding: 0;
}

.title-page {
  text-align: center;
  page-break-after: always;
}

.book-title {
  font-size: 1.5em;
  font-weight: bold;
  margin-top: 20%;
}

.book-author {
  font-size: 1.1em;
  margin-top: 2em;
}

.tool-name {
  font-size: 0.9em;
  margin-top: 1em;
  font-style: italic;
}

.timestamp {
  font-size: 0.8em;
  margin-top: 1em;
  color: #666;
}

.chapter {
  page-break-before: always;
}

h1 {
  font-size: 1.3em;
  font-weight: bold;
  margin: 2em 0 1em 0;
  text-align: center;
}

p {
  margin: 0 0 1em 0;
  text-align: left;
  white-space: pre-wrap;
  word-wrap: break-word;
}

nav h1 {
  text-align: center;
}

nav ol {
  list-style: none;
  padding: 0;
}

nav li {
  margin: 1em 0;
}

nav a {
  text-decoration: none;
  color: inherit;
}`;
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
