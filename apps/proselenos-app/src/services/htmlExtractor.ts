// services/htmlExtractor.ts
// Extracts text from HTML/XHTML content (for epub parsing)

/**
 * Recursively convert an HTML node tree to markdown-formatted text.
 * Handles: <strong>, <b> -> **text**
 *          <em>, <i> -> __text__
 *          <a href="url"> -> [text](url)
 * Other elements are processed for their children only.
 */
function convertNodeToMarkdown(node: Node): string {
  // Text node: skip whitespace-only nodes (formatting), keep actual text
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    // Skip whitespace-only text nodes (indentation, newlines between tags)
    if (!text.trim()) {
      return '';
    }
    return text;
  }

  // Not an element: skip
  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const element = node as Element;
  const tagName = element.tagName.toLowerCase();

  // Recursively process all children, adding paragraph breaks between block elements
  let innerText = '';
  for (const child of Array.from(element.childNodes)) {
    const childText = convertNodeToMarkdown(child);
    // Add paragraph break before block-level elements (if we already have content)
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = (child as Element).tagName.toLowerCase();
      if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'].includes(tag)) {
        if (innerText.trim()) {
          innerText += '\n\n';
        }
      }
    }
    innerText += childText;
  }

  // Apply markdown wrappers based on tag type
  switch (tagName) {
    case 'strong':
    case 'b':
      // Avoid empty wrappers
      if (innerText.trim()) {
        return `**${innerText}**`;
      }
      return innerText;

    case 'em':
    case 'i':
      // Using __ for italic to match epub-generator.ts processMarkdown()
      if (innerText.trim()) {
        return `__${innerText}__`;
      }
      return innerText;

    case 'a':
      const href = element.getAttribute('href') || '';
      if (href && innerText.trim()) {
        return `[${innerText}](${href})`;
      }
      return innerText;

    case 'img':
      // Convert img to markdown image syntax: ![alt](filename)
      const src = element.getAttribute('src') || '';
      const alt = element.getAttribute('alt') || '';
      if (src) {
        // Extract just the filename from paths like "images/foo.jpg" or "../images/foo.jpg"
        const filename = src.split('/').pop() || src;
        // Return on its own line to ensure proper paragraph break
        return `\n![${alt}](${filename})\n`;
      }
      return '';

    default:
      // For all other elements, just return the processed children
      return innerText;
  }
}

/**
 * Extract text from HTML content, preserving inline formatting as markdown.
 * Converts <strong>/<b> to **text**, <em>/<i> to __text__, <a> to [text](url).
 * Used when importing epub files to convert XHTML chapters to markdown text.
 */
export function extractMarkdownFromHtml(html: string): string {
  // Use DOMParser (browser native)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const blocks: string[] = [];

  // Get all block-level elements that contain text
  const blockElements = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, blockquote, li');

  blockElements.forEach((el) => {
    // Skip if this element is nested inside another block we'll process
    // (e.g., a <p> inside a <div> - we only want the <p>'s text once)
    const parent = el.parentElement;
    if (parent && parent !== doc.body) {
      const parentTag = parent.tagName.toLowerCase();
      if (['div', 'blockquote', 'li'].includes(parentTag)) {
        // Skip - parent will be processed
        return;
      }
    }

    // Convert this block's content to markdown
    const markdownText = convertNodeToMarkdown(el).trim();
    if (markdownText) {
      blocks.push(markdownText);
    }
  });

  // If no block elements found, fall back to body content
  if (blocks.length === 0) {
    const bodyMarkdown = convertNodeToMarkdown(doc.body).trim();
    if (bodyMarkdown) {
      return bodyMarkdown;
    }
  }

  // Join blocks with double newlines (paragraph breaks)
  let result = blocks.join('\n\n');

  // Clean up excessive whitespace
  result = result
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines in a row
    .replace(/[ \t]+/g, ' ') // Collapse horizontal whitespace
    .trim();

  return result;
}

/**
 * Extract plain text from HTML content, preserving paragraph structure.
 * Used when importing epub files to convert XHTML chapters to plain text.
 * @deprecated Use extractMarkdownFromHtml() to preserve formatting
 */
export function extractTextFromHtml(html: string): string {
  // Use DOMParser (browser native)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const blocks: string[] = [];

  // Get all block-level elements that contain text
  const blockElements = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, div, blockquote, li');

  blockElements.forEach((el) => {
    // Skip if this element is nested inside another block we'll process
    // (e.g., a <p> inside a <div> - we only want the <p>'s text once)
    const parent = el.parentElement;
    if (parent && parent !== doc.body) {
      const parentTag = parent.tagName.toLowerCase();
      if (['div', 'blockquote', 'li'].includes(parentTag)) {
        // Skip - parent will be processed
        return;
      }
    }

    const text = el.textContent?.trim();
    if (text) {
      blocks.push(text);
    }
  });

  // If no block elements found, fall back to body text
  if (blocks.length === 0) {
    const bodyText = doc.body.textContent?.trim();
    if (bodyText) {
      return bodyText;
    }
  }

  // Join blocks with double newlines (paragraph breaks)
  let result = blocks.join('\n\n');

  // Clean up excessive whitespace
  result = result
    .replace(/\n{3,}/g, '\n\n') // Max 2 newlines in a row
    .replace(/[ \t]+/g, ' ') // Collapse horizontal whitespace
    .trim();

  return result;
}

/**
 * Count words in text
 */
export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text
    .replace(/(\r\n|\r|\n)/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}
