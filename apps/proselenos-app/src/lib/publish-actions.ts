// apps/proselenos-app/src/lib/publish-actions.ts
// Publishing actions - now uses Supabase storage

'use server';

import 'server-only';

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { readTextFile, uploadFileToProject } from '@/lib/project-storage';

type ActionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

// TypeScript Interfaces
interface Chapter {
  id: string;
  number: number;
  title: string;
  content: string[];
}

interface PublishResult {
  generatedFiles: string[];
  stats: {
    chapterCount: number;
    wordCount: number;
    pageCount?: number;
    spineWidth?: number;
  };
}

/**
 * Common helper function to prepare manuscript data
 * manuscriptFilePath: path like "projectName/manuscript.txt"
 * projectName: the project folder name
 */
async function prepareManuscriptData(manuscriptFilePath: string, projectName: string) {
  // Get session from server
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized - please sign in' };
  }

  const userId = session.user.id;

  // Extract filename from path (e.g., "ProjectName/manuscript.txt" -> "manuscript.txt")
  const fileName = manuscriptFilePath.includes('/') ? manuscriptFilePath.split('/').pop()! : manuscriptFilePath;

  // Read manuscript content from Supabase storage
  let manuscriptContent: string;
  try {
    manuscriptContent = await readTextFile(userId, projectName, fileName);
  } catch (error) {
    return { success: false, error: 'Failed to read manuscript file' };
  }

  // Load project metadata from Supabase storage
  let metadata: any;
  try {
    const metadataJson = await readTextFile(userId, projectName, 'book-metadata.json');
    const metadataData = JSON.parse(metadataJson);

    metadata = {
      ...metadataData,
      displayTitle: metadataData.title,
      language: 'en',
      description: 'Created with manuscript publishing system'
    };
  } catch {
    // book-metadata.json doesn't exist yet - use defaults
    console.log('book-metadata.json not found, using defaults');
    metadata = {
      title: projectName,
      displayTitle: projectName,
      author: 'Author Name',
      publisher: 'Independent Publisher',
      language: 'en',
      description: 'Created with manuscript publishing system',
      aboutAuthor: '',
      buyUrl: ''
    };
  }

  const chapters = parseManuscriptText(manuscriptContent);
  const wordCount = countWords(manuscriptContent);

  return {
    success: true,
    data: {
      userId,
      manuscriptContent,
      metadata,
      chapters,
      wordCount
    }
  };
}

/**
 * Generate HTML file only
 * manuscriptFilePath: path like "projectName/manuscript.txt"
 * projectName: the project folder name
 */
export async function generateHTMLOnlyAction(
  manuscriptFilePath: string,
  projectName: string
): Promise<ActionResult<{fileName: string; fileId: string}>> {
  try {
    const prepResult = await prepareManuscriptData(manuscriptFilePath, projectName);
    if (!prepResult.success || !prepResult.data) {
      return { success: false, error: prepResult.error };
    }

    const { userId, chapters, metadata } = prepResult.data;

    // Generate HTML
    const htmlContent = generateHTML(chapters, metadata);
    const htmlFilename = 'manuscript.html';

    // Upload HTML file to Supabase storage
    await uploadFileToProject(userId, projectName, htmlFilename, htmlContent);

    return {
      success: true,
      data: {
        fileName: htmlFilename,
        fileId: `${projectName}/${htmlFilename}`
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to generate HTML file' };
  }
}

/**
 * Generate EPUB file only
 * manuscriptFilePath: path like "projectName/manuscript.txt"
 * projectName: the project folder name
 */
export async function generateEPUBOnlyAction(
  manuscriptFilePath: string,
  projectName: string
): Promise<ActionResult<{fileName: string; fileId: string}>> {
  try {
    const prepResult = await prepareManuscriptData(manuscriptFilePath, projectName);
    if (!prepResult.success || !prepResult.data) {
      return { success: false, error: prepResult.error };
    }

    const { userId, chapters, metadata } = prepResult.data;

    // Generate EPUB
    const epubBuffer = await generateEPUB(chapters, metadata, projectName);
    const epubFilename = 'manuscript.epub';

    // Convert Buffer to ArrayBuffer for upload
    const epubArrayBuffer = epubBuffer.buffer.slice(
      epubBuffer.byteOffset,
      epubBuffer.byteOffset + epubBuffer.byteLength
    ) as ArrayBuffer;

    // Upload EPUB file to Supabase storage
    await uploadFileToProject(userId, projectName, epubFilename, epubArrayBuffer);

    return {
      success: true,
      data: {
        fileName: epubFilename,
        fileId: `${projectName}/${epubFilename}`
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to generate EPUB file' };
  }
}

/**
 * Generate EPUB for local import (uploads to Supabase AND returns base64 for local import)
 * This combines upload + local import in one operation
 * manuscriptFilePath: path like "projectName/manuscript.txt"
 * projectName: the project folder name
 */
export async function generateEPUBForLocalImportAction(
  manuscriptFilePath: string,
  projectName: string,
  coverImageBase64?: string
): Promise<ActionResult<{epubBase64: string; epubFilename: string; fileId: string}>> {
  try {
    const prepResult = await prepareManuscriptData(manuscriptFilePath, projectName);
    if (!prepResult.success || !prepResult.data) {
      return { success: false, error: prepResult.error };
    }

    const { userId, chapters, metadata } = prepResult.data;

    // Convert cover image base64 to buffer if provided
    let coverImageBuffer: Buffer | undefined;
    if (coverImageBase64) {
      // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Data = coverImageBase64.replace(/^data:image\/\w+;base64,/, '');
      coverImageBuffer = Buffer.from(base64Data, 'base64');
    }

    // Generate EPUB (only once!)
    const epubBuffer = await generateEPUB(chapters, metadata, projectName, coverImageBuffer);
    const epubFilename = 'manuscript.epub';

    // Convert Buffer to ArrayBuffer for upload
    const epubArrayBuffer = epubBuffer.buffer.slice(
      epubBuffer.byteOffset,
      epubBuffer.byteOffset + epubBuffer.byteLength
    ) as ArrayBuffer;

    // Upload EPUB file to Supabase storage (author's backup)
    await uploadFileToProject(userId, projectName, epubFilename, epubArrayBuffer);

    // Also convert to base64 for local import
    const epubBase64 = epubBuffer.toString('base64');

    return {
      success: true,
      data: {
        epubBase64,
        epubFilename,
        fileId: `${projectName}/${epubFilename}`
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to generate EPUB for local import' };
  }
}

/**
 * Main server action for publishing manuscripts
 * Converts manuscript text to HTML and EPUB and uploads to Supabase storage
 * manuscriptFilePath: path like "projectName/manuscript.txt"
 * projectName: the project folder name
 */
export async function publishManuscriptAction(
  manuscriptFilePath: string,
  projectName: string
): Promise<ActionResult<PublishResult>> {
  // Get session from server
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized - please sign in' };
  }

  const userId = session.user.id;

  try {
    const prepResult = await prepareManuscriptData(manuscriptFilePath, projectName);
    if (!prepResult.success || !prepResult.data) {
      return { success: false, error: prepResult.error };
    }

    const { chapters, metadata, wordCount } = prepResult.data;

    // Clean up existing manuscript files before creating new ones
    await cleanupExistingManuscriptFiles(projectName);

    // Generate HTML
    const htmlContent = generateHTML(chapters, metadata);

    // Generate EPUB
    const epubBuffer = await generateEPUB(chapters, metadata, projectName);

    // Create clean filenames for publishing (no timestamps)
    const htmlFilename = 'manuscript.html';
    const epubFilename = 'manuscript.epub';

    // Upload HTML file to Supabase storage
    await uploadFileToProject(userId, projectName, htmlFilename, htmlContent);

    // Convert EPUB Buffer to ArrayBuffer for upload
    const epubArrayBuffer = epubBuffer.buffer.slice(
      epubBuffer.byteOffset,
      epubBuffer.byteOffset + epubBuffer.byteLength
    ) as ArrayBuffer;

    // Upload EPUB file to Supabase storage
    await uploadFileToProject(userId, projectName, epubFilename, epubArrayBuffer);

    return {
      success: true,
      data: {
        generatedFiles: [htmlFilename, epubFilename],
        stats: {
          chapterCount: chapters.length,
          wordCount: wordCount
        }
      },
      message: `Successfully generated HTML and EPUB with ${chapters.length} chapters`
    };

  } catch (error) {
    console.error('Error in publishManuscriptAction:', error);
    return {
      success: false,
      error: `Failed to publish manuscript: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Parse manuscript text into chapters
 * Supports various title formats with double newline before title and single newline after
 */
function parseManuscriptText(text: string): Chapter[] {
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
          content: paragraphs
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
          content: paragraphs
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
        content: paragraphs
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
 * Generate HTML content from chapters and metadata
 */
function generateHTML(chapters: Chapter[], metadata: any): string {
  const titleAuthor = `${metadata.title} by ${metadata.author}`;
  const titleAuthorDisplay = `${metadata.title} &nbsp;<small><em>by ${metadata.author}</em></small>`;
  
  const chaptersHTML = chapters.map(chapter => `
<div class="chapter-container">
  <div class="chapter-title">${escapeHtml(chapter.title)}</div>
  <div class="chapter-text">
    ${chapter.content.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('\n    ')}
  </div>
</div>`).join('\n\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(titleAuthor)}</title>
  <style>
    :root {
      --button-bg-color: #4CAF50;
      --button-text-color: #ffffff;
      --border-color: #444;
      --background-light: #f5f5f5;
      --text-light: #333333;
      --background-dark: #2c3035;
      --text-dark: #ffffff;
    }
    
    body {
      font-family: Arial, sans-serif;
      background-color: var(--background-dark);
      color: var(--text-dark);
      transition: background-color 0.3s, color 0.3s;
      padding: 20px;
      min-height: 100vh;
      margin: 0;
      line-height: 1.5;
    }
    
    body.light-mode {
      background-color: var(--background-light);
      color: var(--text-light);
    }
    
    h1 {
      color: inherit;
    }
    
    /* Dark mode: dark container with white text */
    .chapter-container {
      border: 2px solid #ff9800;
      border-radius: 4px;
      padding: 10px;
      margin-bottom: 15px;
      background: rgba(0, 0, 0, 0.3);
      color: var(--text-dark);
    }
    
    /* Light mode: light container with dark text */
    body.light-mode .chapter-container {
      background: #fff7e6;
      color: var(--text-light);
    }
    
    .chapter-title {
      font-weight: bold;
      margin-bottom: 8px;
      font-size: 1.2em;
    }
    
    .chapter-text p {
      margin-bottom: 1em;
    }
    
    /* Footer styling */
    .footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: #000;
      color: #9e9e9e;
      padding: 10px 20px;
      text-align: center;
      font-size: 15px;
      transition: background-color 0.3s;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    
    body.light-mode .footer {
      background-color: #333;
    }
    
    /* Dark mode toggle */
    #darkModeToggle {
      font-size: 16px;
      background-color: transparent;
      color: inherit;
      border: none;
      cursor: pointer;
      text-align: center;
      transition: all 0.3s ease;
      margin-left: 10px;
      padding: 0;
    }
    
    #darkModeToggle:hover {
      transform: scale(1.1);
    }
    
    .footer-spacer {
      height: 60px;
    }
  </style>
</head>
<body>

<h2>${titleAuthorDisplay}</h2>
${chaptersHTML}

<div class="footer-spacer"></div>
<div class="footer">
  <div>© &nbsp;2025 &nbsp;&nbsp;${titleAuthorDisplay} &nbsp;&nbsp;<button id="darkModeToggle" title="Switch dark and light mode">☀️</button></div>
</div>

<script>
  // toggle dark/light mode
  document.getElementById('darkModeToggle').addEventListener('click', function() {
    document.body.classList.toggle('light-mode');
    // Change the icon based on the current mode
    this.textContent = document.body.classList.contains('light-mode') ? '🌙' : '☀️';
    
    // optionally save the user's preference in localStorage
    localStorage.setItem('lightMode', document.body.classList.contains('light-mode'));
  });
  
  // check for saved preference on page load
  window.addEventListener('DOMContentLoaded', function() {
    // default is dark mode (no class needed)
    const lightMode = localStorage.getItem('lightMode') === 'true';
    if (lightMode) {
      document.body.classList.add('light-mode');
      document.getElementById('darkModeToggle').textContent = '🌙';
    }
  });
</script>
</body>
</html>`;
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
 * Convert markdown links [text](url) to HTML <a> tags
 * Applied after escapeHtml since markdown links don't contain <>
 */
function processMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>');
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(word => word.length > 0).length;
}

/**
 * Clean up existing manuscript files before publishing new ones
 */
async function cleanupExistingManuscriptFiles(_projectName: string): Promise<void> {
  // No explicit deletion needed
}

/**
 * Generate EPUB file from chapters and metadata
 * @param coverImageBuffer - Optional cover image as a Buffer (JPEG format)
 */
async function generateEPUB(chapters: Chapter[], metadata: any, _projectFolderId: string, coverImageBuffer?: Buffer): Promise<Buffer> {
  const JSZip = require('jszip');
  const zip = new JSZip();

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

  // 3. Handle cover image if provided
  const hasCover = !!coverImageBuffer;
  if (coverImageBuffer) {
    // Add cover image file
    zip.file('OEBPS/images/cover.jpg', coverImageBuffer);

    // Add cover page XHTML
    const coverXHTML = createCoverPage();
    zip.file('OEBPS/cover.xhtml', coverXHTML);
  }

  // 4. Create title page
  const titlePageHTML = createTitlePage(metadata);
  zip.file('OEBPS/title-page.xhtml', titlePageHTML);

  // 5. Create copyright page
  const copyrightHTML = createCopyrightPage(metadata);
  zip.file('OEBPS/copyright.xhtml', copyrightHTML);

  // 6. Create contents page
  const contentsHTML = createContentsPage(chapters, metadata);
  zip.file('OEBPS/contents.xhtml', contentsHTML);

  // 7. Create chapter HTML files
  chapters.forEach(chapter => {
    const chapterHTML = createChapterHTML(chapter, metadata);
    zip.file(`OEBPS/${chapter.id}.xhtml`, chapterHTML);
  });

  // 8. Create about author page (only if metadata exists)
  if (metadata.aboutAuthor && metadata.aboutAuthor.trim()) {
    const aboutAuthorHTML = createAboutAuthorPage(metadata);
    zip.file('OEBPS/about-author.xhtml', aboutAuthorHTML);
  }

  // 9. Create content.opf (EPUB 3.0 format) with all new items
  const contentOPF = createEpub3ContentOPF(chapters, metadata, hasCover ? 'cover-image' : null);
  zip.file('OEBPS/content.opf', contentOPF);

  // 10. Create nav.xhtml (EPUB 3.0 navigation)
  const navXHTML = createNavXHTML(chapters, metadata);
  zip.file('OEBPS/nav.xhtml', navXHTML);

  // 11. Create toc.ncx for EPUB 2 compatibility
  const tocNCX = createTocNCX(chapters, metadata);
  zip.file('OEBPS/toc.ncx', tocNCX);

  // 12. Create CSS files in css/ subfolder (NEW structure)
  const styleCSS = createFullWidthCSS();
  zip.file('OEBPS/css/style.css', styleCSS);

  // Generate and return the EPUB
  const epubBuffer = await zip.generateAsync({ 
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  return epubBuffer;
}

/**
 * Create title page HTML
 */
function createTitlePage(metadata: any): string {
  const upperTitle = metadata.displayTitle.toUpperCase();
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Title Page</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <section class="title-page" epub:type="titlepage">
    <h1 class="book-title">${escapeHtml(upperTitle)}</h1>
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
  const year = new Date().getFullYear();

  // Standard copyright template (like Vellum)
  const copyrightContent = `    <p>Copyright © ${year} ${escapeHtml(metadata.author)}</p>
    <p></p>
    <p>All rights reserved.</p>
    <p></p>
    <p>Published by ${escapeHtml(metadata.publisher || 'Independent Publisher')}</p>
    <p></p>
    <p>This is a work of fiction. Names, characters, places, and incidents either are the product of the author's imagination or are used fictitiously. Any resemblance to actual persons, living or dead, events, or locales is entirely coincidental.</p>
    <p></p>
    <p>First Edition: ${year}</p>`;

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
 * Create contents page HTML
 */
function createContentsPage(chapters: Chapter[], metadata: any): string {
  const chapterItems = chapters
    .map(ch => `    <li><a href="${ch.id}.xhtml">${escapeHtml(ch.title)}</a></li>`)
    .join('\n');
  
  const tocItems = [
    chapterItems,
    ...(metadata.aboutAuthor && metadata.aboutAuthor.trim() ? ['    <li><a href="about-author.xhtml">About the Author</a></li>'] : [])
  ].join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>Contents</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <section class="contents-page" epub:type="toc">
    <h1>Contents</h1>
    <nav class="book-toc">
      <ol>
${tocItems}
      </ol>
    </nav>
  </section>
</body>
</html>`;
}

/**
 * Create HTML for a chapter
 */
function createChapterHTML(chapter: Chapter, _metadata: any): string {
  const paragraphs = chapter.content
    .map(p => `    <p>${processMarkdownLinks(escapeHtml(p))}</p>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeHtml(chapter.title)}</title>
  <link rel="stylesheet" type="text/css" href="css/style.css"/>
</head>
<body>
  <section class="chapter" epub:type="chapter">
    <h1>${escapeHtml(chapter.title)}</h1>
${paragraphs}
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
 */
function createCoverPage(): string {
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
  <img src="images/cover.jpg" alt="Cover"/>
</body>
</html>`;
}

/**
 * Create EPUB 3.0 content.opf file
 */
function createEpub3ContentOPF(chapters: Chapter[], metadata: any, coverImageId: string | null = null): string {
  const uuid = generateUUID();
  const date = new Date().toISOString().split('T')[0];

  // Cover metadata and manifest
  let coverMeta = '';
  let coverManifest = '';
  let coverPageManifest = '';

  if (coverImageId) {
    coverMeta = `    <meta name="cover" content="${coverImageId}"/>`;
    coverManifest = `    <item id="${coverImageId}" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>`;
    coverPageManifest = `    <item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>`;
  }

  const manifest = chapters
    .map(ch => `    <item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n');

  // Build spine items - cover page first if present
  const spineItems = [
    ...(coverImageId ? ['    <itemref idref="cover-page"/>'] : []),
    '    <itemref idref="title-page"/>',
    '    <itemref idref="copyright"/>',
    '    <itemref idref="contents"/>',
    ...chapters.map(ch => `    <itemref idref="${ch.id}"/>`),
    ...(metadata.aboutAuthor && metadata.aboutAuthor.trim() ? ['    <itemref idref="about-author"/>'] : [])
  ].join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package version="3.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" prefix="cc: http://creativecommons.org/ns#">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${uuid}</dc:identifier>
    <dc:title>${escapeHtml(metadata.displayTitle)}</dc:title>
    <dc:creator>${escapeHtml(metadata.author)}</dc:creator>
    <dc:language>${metadata.language}</dc:language>
    <dc:publisher>${escapeHtml(metadata.publisher || 'Independent Publisher')}</dc:publisher>
    <dc:description>${escapeHtml(metadata.description)}</dc:description>
    <dc:date>${date}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString()}</meta>
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
${manifest}
  </manifest>
  <spine toc="toc">
${spineItems}
  </spine>
</package>`;
}

/**
 * Create NCX file for EPUB 2 compatibility
 */
function createTocNCX(chapters: Chapter[], metadata: any): string {
  const uuid = generateUUID();
  
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
    <meta name="dtb:uid" content="${uuid}"/>
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
 */
function createNavXHTML(chapters: Chapter[], metadata: any): string {
  const navItems = [
    '      <li><a href="title-page.xhtml">Title Page</a></li>',
    '      <li><a href="copyright.xhtml">Copyright</a></li>',
    '      <li><a href="contents.xhtml">Contents</a></li>',
    ...chapters.map(ch => `      <li><a href="${ch.id}.xhtml">${escapeHtml(ch.title)}</a></li>`),
    ...(metadata.aboutAuthor && metadata.aboutAuthor.trim() ? ['      <li><a href="about-author.xhtml">About the Author</a></li>'] : [])
  ].join('\n');

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
${navItems}
    </ol>
  </nav>
</body>
</html>`;
}

/**
 * Create Kindle-compatible CSS (exact copy from working code)
 */
function createFullWidthCSS(): string {
  return `/* Proselenos EPUB - Kindle-Compatible CSS */

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

.contents-page h1 {
  text-align: center;
  font-size: 1.5em;
  margin: 2em 0;
  font-weight: bold;
}

.book-toc ol {
  list-style: none;
  margin: 1em 0;
  padding: 0;
}

.book-toc li {
  margin: 1em 0;
  text-align: left;
}

.book-toc a {
  text-decoration: none;
  color: inherit;
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
