// lib/html-generator.ts
// Generates a single-page readable HTML file from manuscript sections

export interface HtmlGeneratorOptions {
  title: string;
  author: string;
  year?: string;
  sections: Array<{ title: string; content: string }>;
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
    // Images FIRST (before links, since ![alt](src) could be inside [text](url))
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto;" />')
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
 * Process section content - detect HTML vs plain text
 * EPUB content is already HTML, plain text needs markdown conversion
 */
function processContent(text: string): string {
  // Detect if content is already HTML (contains common HTML tags)
  const isHtml = /<(p|div|span|a|em|strong|i|b|br|img|h[1-6])[\s>\/]/i.test(text);

  if (isHtml) {
    // Content is already HTML from EPUB
    // Collapse multiple consecutive <br> tags into one (removes excessive blank lines)
    return text.replace(/(<br\s*\/?>[\s]*){2,}/gi, '<br>');
  }

  // Plain text/markdown - apply conversion
  return markdownToHtml(text);
}

/**
 * Generate a complete single-page HTML file from manuscript sections
 */
export function generateHtmlFromSections(options: HtmlGeneratorOptions): string {
  const { title, author, year = new Date().getFullYear().toString(), sections } = options;

  // Generate chapter HTML
  const chaptersHtml = sections
    .map(section => {
      let contentHtml = processContent(section.content);

      // Strip ALL <a> tags from TOC/Contents (keep inner content)
      const isToc = /contents|table of contents/i.test(section.title);
      if (isToc) {
        contentHtml = contentHtml.replace(/<a[^>]*>/gi, '');
        contentHtml = contentHtml.replace(/<\/a>/gi, '');
      }

      return `
    <div class="chapter-container">
      <div class="chapter-title">${escapeHtml(section.title)}</div>
      <div class="chapter-text">${contentHtml}</div>
    </div>`;
    })
    .join('\n');

  // Full HTML template
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    * {
      box-sizing: border-box;
    }

    body {
      font-family: Georgia, 'Times New Roman', serif;
      line-height: 1.7;
      margin: 0;
      padding: 20px;
      padding-bottom: 80px; /* Space for footer */
      background: #fffaf5;
      color: #222;
      transition: background 0.3s, color 0.3s;
    }

    body.dark-mode {
      background: #121212;
      color: #e0e0e0;
    }

    .chapter-container {
      max-width: 700px;
      margin: 0 auto 30px auto;
      padding: 20px 25px;
      border: 2px solid #b8860b;
      border-radius: 6px;
      background: #fff;
    }

    body.dark-mode .chapter-container {
      background: #1e1e1e;
      border-color: #b8860b;
    }

    .chapter-title {
      font-weight: bold;
      font-size: 1.3em;
      margin-bottom: 15px;
      color: #b8860b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .chapter-text {
      font-size: 1.1em;
    }

    .chapter-text p {
      margin: 0 0 1em 0;
      text-align: justify;
    }

    .chapter-text p:last-child {
      margin-bottom: 0;
    }

    .chapter-text a {
      color: #b8860b;
      text-decoration: underline;
    }

    .chapter-text strong {
      font-weight: bold;
    }

    .chapter-text em {
      font-style: italic;
    }

    /* Sticky Footer */
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
      color: #b8860b;
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

    @media (max-width: 600px) {
      body {
        padding: 10px;
        padding-bottom: 70px;
      }

      .chapter-container {
        padding: 15px;
      }

      .footer {
        padding: 10px 15px;
        font-size: 0.8em;
      }

      .footer-info {
        flex-wrap: wrap;
        gap: 4px;
      }
    }
  </style>
</head>
<body>
${chaptersHtml}

  <div class="footer">
    <div class="footer-info">
      <span class="footer-title">${escapeHtml(title)}</span>
      <span class="footer-author">by ${escapeHtml(author)}</span>
      <span class="footer-copyright">© ${escapeHtml(year)}</span>
    </div>
    <button class="theme-toggle" id="themeToggle" title="Toggle light/dark mode">☀️</button>
  </div>

  <script>
    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    // Check for saved preference or default to light
    const savedTheme = localStorage.getItem('html-ebook-theme');
    if (savedTheme === 'dark') {
      body.classList.add('dark-mode');
      themeToggle.textContent = '🌙';
    }

    themeToggle.addEventListener('click', () => {
      body.classList.toggle('dark-mode');
      const isDark = body.classList.contains('dark-mode');
      themeToggle.textContent = isDark ? '🌙' : '☀️';
      localStorage.setItem('html-ebook-theme', isDark ? 'dark' : 'light');
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
    .replace(/'/g, '&#039;');
}

/**
 * Trigger download of HTML file
 */
export function downloadHtmlFile(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
