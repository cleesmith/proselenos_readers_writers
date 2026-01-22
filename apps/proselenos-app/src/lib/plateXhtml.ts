/**
 * Plate XHTML Serialization Utilities
 *
 * Bidirectional converters for EPUB-native content pipeline:
 * - plateToXhtml: PlateJS JSON → Clean EPUB3 XHTML
 * - xhtmlToPlate: EPUB3 XHTML → PlateJS JSON
 * - plateToPlainText: PlateJS JSON → Plain text (for word count, search, AI)
 */

import type { Value } from 'platejs';

// PlateJS node types we support
interface PlateText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
}

interface PlateElement {
  type: string;
  children: (PlateElement | PlateText)[];
  url?: string;  // For links
  alt?: string;  // For images
  [key: string]: unknown;
}

/**
 * PlateJS JSON → Clean EPUB3 XHTML
 *
 * Converts Slate value to clean XHTML suitable for EPUB3:
 * - Strips data-slate-* attributes
 * - Converts to proper XHTML elements
 * - Handles bold, italic, links, images
 */
export function plateToXhtml(value: Value): string {
  if (!value || !Array.isArray(value) || value.length === 0) {
    return '';
  }

  const html = value.map(node => serializeNode(node as PlateElement | PlateText)).join('');
  return html;
}

/**
 * Serialize a single PlateJS node to XHTML
 */
function serializeNode(node: PlateElement | PlateText): string {
  // Text node
  if ('text' in node) {
    return serializeText(node as PlateText);
  }

  // Element node
  const element = node as PlateElement;
  const children = element.children
    .map(child => serializeNode(child as PlateElement | PlateText))
    .join('');

  switch (element.type) {
    case 'p':
      return `<p>${children}</p>\n`;

    case 'h1':
      return `<h1>${children}</h1>\n`;

    case 'h2':
      return `<h2>${children}</h2>\n`;

    case 'h3':
      return `<h3>${children}</h3>\n`;

    case 'h4':
      return `<h4>${children}</h4>\n`;

    case 'h5':
      return `<h5>${children}</h5>\n`;

    case 'h6':
      return `<h6>${children}</h6>\n`;

    case 'blockquote':
      return `<blockquote>${children}</blockquote>\n`;

    case 'a':
    case 'link':
      const href = element.url || '';
      return `<a href="${escapeAttr(href)}">${children}</a>`;

    case 'img':
    case 'image':
      const imgSrc = (element.url || '') as string;
      const imgAlt = (element.alt || '') as string;
      const imgFilename = imgSrc.split('/').pop() || imgSrc;
      const imgWidth = element.width as string | number | undefined;
      // Caption is stored as array of text nodes: [{ text: 'caption' }]
      const imgCaption = (element.caption as Array<{text: string}> | undefined)?.[0]?.text || '';

      // Ensure width has CSS units - PlateJS stores numbers for pixel values
      let widthValue: string | undefined;
      if (typeof imgWidth === 'number') {
        widthValue = `${imgWidth}px`;
      } else if (typeof imgWidth === 'string' && imgWidth) {
        // Already has units (e.g., "50%", "200px") or add px if just a number string
        widthValue = /^\d+$/.test(imgWidth) ? `${imgWidth}px` : imgWidth;
      } else {
        widthValue = undefined;
      }
      const widthStyle = widthValue ? ` style="width:${widthValue}"` : '';
      let figureHtml = `<figure${widthStyle}>\n`;
      figureHtml += `  <img src="images/${escapeAttr(imgFilename)}" alt="${escapeAttr(imgAlt)}"/>\n`;
      if (imgCaption) {
        figureHtml += `  <figcaption>${escapeHtml(imgCaption)}</figcaption>\n`;
      }
      figureHtml += `</figure>\n`;
      return figureHtml;

    case 'ul':
      return `<ul>\n${children}</ul>\n`;

    case 'ol':
      return `<ol>\n${children}</ol>\n`;

    case 'li':
      return `<li>${children}</li>\n`;

    case 'hr':
      return '<hr/>\n';

    default:
      // Unknown element type - just return children wrapped in div
      if (children) {
        return `<div>${children}</div>\n`;
      }
      return '';
  }
}

/**
 * Serialize text with marks (bold, italic, etc.)
 */
function serializeText(node: PlateText): string {
  let text = escapeHtml(node.text);

  // Apply marks in reverse order (innermost first)
  if (node.strikethrough) {
    text = `<del>${text}</del>`;
  }
  if (node.underline) {
    text = `<u>${text}</u>`;
  }
  if (node.italic) {
    text = `<em>${text}</em>`;
  }
  if (node.bold) {
    text = `<strong>${text}</strong>`;
  }

  return text;
}

/**
 * EPUB3 XHTML → PlateJS JSON
 *
 * Parses XHTML from EPUB and converts to Slate value:
 * - <p> → { type: 'p', children: [...] }
 * - <em>, <i> → { text: '...', italic: true }
 * - <strong>, <b> → { text: '...', bold: true }
 * - <a href="..."> → { type: 'a', url: '...', children: [...] }
 * - <img> → { type: 'img', url: '...', alt: '...', children: [...] }
 */
export function xhtmlToPlate(xhtml: string): Value {
  if (!xhtml || xhtml.trim() === '') {
    return createEmptyValue();
  }

  // Parse XHTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtml, 'text/html');

  const blocks: (PlateElement | PlateText)[] = [];

  // Process body children
  const body = doc.body;
  if (!body) {
    return createEmptyValue();
  }

  // Get all block-level elements
  const blockElements = body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, div, hr, figure');

  if (blockElements.length === 0) {
    // No block elements - treat entire body as a paragraph
    const content = parseChildren(body);
    if (content.length > 0) {
      blocks.push({ type: 'p', children: content });
    }
  } else {
    blockElements.forEach(el => {
      // Skip if this element is nested inside another block we'll process
      const parent = el.parentElement;
      if (parent && parent !== body && parent.tagName !== 'LI') {
        const parentTag = parent.tagName.toLowerCase();
        if (['div', 'blockquote', 'ul', 'ol'].includes(parentTag)) {
          return;
        }
      }

      const node = parseElement(el);
      if (node) {
        blocks.push(node);
      }
    });
  }

  // Ensure we have at least one block
  if (blocks.length === 0) {
    return createEmptyValue();
  }

  return blocks as Value;
}

/**
 * Parse an HTML element to PlateJS node
 */
function parseElement(el: Element): PlateElement | null {
  const tag = el.tagName.toLowerCase();
  const children = parseChildren(el);

  // Ensure children has at least empty text
  const validChildren = children.length > 0 ? children : [{ text: '' }];

  switch (tag) {
    case 'p':
      return { type: 'p', children: validChildren };

    case 'h1':
      return { type: 'h1', children: validChildren };

    case 'h2':
      return { type: 'h2', children: validChildren };

    case 'h3':
      return { type: 'h3', children: validChildren };

    case 'h4':
      return { type: 'h4', children: validChildren };

    case 'h5':
      return { type: 'h5', children: validChildren };

    case 'h6':
      return { type: 'h6', children: validChildren };

    case 'blockquote':
      return { type: 'blockquote', children: validChildren };

    case 'ul':
      return { type: 'ul', children: parseListItems(el) };

    case 'ol':
      return { type: 'ol', children: parseListItems(el) };

    case 'hr':
      return { type: 'hr', children: [{ text: '' }] };

    case 'div':
      // Check if it's an image container
      const img = el.querySelector('img');
      if (img) {
        return parseImageElement(img);
      }
      // Otherwise treat as paragraph
      return { type: 'p', children: validChildren };

    case 'img':
      return parseImageElement(el);

    case 'figure':
      return parseFigureElement(el);

    default:
      // Unknown element - treat as paragraph
      return { type: 'p', children: validChildren };
  }
}

/**
 * Parse list items
 */
function parseListItems(el: Element): PlateElement[] {
  const items: PlateElement[] = [];
  const lis = el.querySelectorAll(':scope > li');

  lis.forEach(li => {
    const children = parseChildren(li);
    items.push({
      type: 'li',
      children: children.length > 0 ? children : [{ text: '' }]
    });
  });

  return items.length > 0 ? items : [{ type: 'li', children: [{ text: '' }] }];
}

/**
 * Parse an img element
 * Preserves the "images/{filename}" format for consistency with upload
 */
function parseImageElement(el: Element): PlateElement {
  const src = el.getAttribute('src') || '';
  const alt = el.getAttribute('alt') || '';

  // Keep the URL as-is if it already has "images/" prefix
  // Otherwise, add the prefix for consistency with upload format
  let url = src;
  if (src && !src.startsWith('images/') && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
    // It's a relative path without images/ prefix - add it
    const filename = src.split('/').pop() || src;
    url = `images/${filename}`;
  }

  return {
    type: 'img',
    url: url,
    alt: alt,
    children: [{ text: '' }]
  };
}

/**
 * Parse a figure element (image with optional caption and width)
 * Matches PlateJS serializeHtml output format
 */
function parseFigureElement(el: Element): PlateElement {
  const img = el.querySelector('img');
  const figcaption = el.querySelector('figcaption');

  if (!img) {
    // No image inside figure - treat as paragraph
    return { type: 'p', children: [{ text: el.textContent || '' }] };
  }

  const src = img.getAttribute('src') || '';
  const alt = img.getAttribute('alt') || '';

  // Normalize URL to images/{filename} format
  let url = src;
  if (src && !src.startsWith('images/') && !src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
    const filename = src.split('/').pop() || src;
    url = `images/${filename}`;
  }

  // Parse width from figure's style attribute
  const style = el.getAttribute('style') || '';
  const widthMatch = style.match(/width:\s*([^;]+)/);
  let width: string | number | undefined;
  if (widthMatch && widthMatch[1]) {
    const rawWidth = widthMatch[1].trim();
    // If it's a pixel value, convert to number (PlateJS expects number for pixels)
    const pxMatch = rawWidth.match(/^(\d+(?:\.\d+)?)px$/);
    if (pxMatch && pxMatch[1]) {
      width = parseFloat(pxMatch[1]);
    } else {
      // Keep as string for percentages or other units
      width = rawWidth;
    }
  }

  // Parse caption text
  const captionText = figcaption?.textContent || '';

  const node: PlateElement = {
    type: 'img',
    url: url,
    alt: alt,
    children: [{ text: '' }]
  };

  if (width !== undefined) {
    (node as any).width = width;
  }
  if (captionText) {
    (node as any).caption = [{ text: captionText }];
  }

  return node;
}

/**
 * Parse children of an element, handling inline elements and text
 */
function parseChildren(el: Element): (PlateElement | PlateText)[] {
  const children: (PlateElement | PlateText)[] = [];

  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      // Skip whitespace-only text nodes between elements
      if (text.trim() || (text.includes(' ') && children.length > 0)) {
        children.push({ text });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const childEl = node as Element;
      const tag = childEl.tagName.toLowerCase();

      // Handle inline elements
      if (['strong', 'b'].includes(tag)) {
        const innerChildren = parseChildren(childEl);
        innerChildren.forEach(child => {
          if ('text' in child) {
            children.push({ ...child, bold: true });
          } else {
            children.push(child);
          }
        });
      } else if (['em', 'i'].includes(tag)) {
        const innerChildren = parseChildren(childEl);
        innerChildren.forEach(child => {
          if ('text' in child) {
            children.push({ ...child, italic: true });
          } else {
            children.push(child);
          }
        });
      } else if (['u'].includes(tag)) {
        const innerChildren = parseChildren(childEl);
        innerChildren.forEach(child => {
          if ('text' in child) {
            children.push({ ...child, underline: true });
          } else {
            children.push(child);
          }
        });
      } else if (['del', 's', 'strike'].includes(tag)) {
        const innerChildren = parseChildren(childEl);
        innerChildren.forEach(child => {
          if ('text' in child) {
            children.push({ ...child, strikethrough: true });
          } else {
            children.push(child);
          }
        });
      } else if (tag === 'a') {
        const href = childEl.getAttribute('href') || '';
        const linkChildren = parseChildren(childEl);
        children.push({
          type: 'a',
          url: href,
          children: linkChildren.length > 0 ? linkChildren : [{ text: '' }]
        });
      } else if (tag === 'img') {
        children.push(parseImageElement(childEl) as PlateElement);
      } else if (tag === 'br') {
        children.push({ text: '\n' });
      } else if (tag === 'span') {
        // Process span children inline
        const spanChildren = parseChildren(childEl);
        children.push(...spanChildren);
      } else {
        // Unknown inline element - extract text
        const text = childEl.textContent || '';
        if (text) {
          children.push({ text });
        }
      }
    }
  });

  return children;
}

/**
 * PlateJS JSON → Plain text
 *
 * Extracts plain text from Slate value for:
 * - Word count
 * - Full-text search
 * - AI tools input
 */
export function plateToPlainText(value: Value): string {
  if (!value || !Array.isArray(value)) {
    return '';
  }

  const lines: string[] = [];

  for (const node of value) {
    const text = extractTextFromNode(node as PlateElement | PlateText);
    if (text) {
      lines.push(text);
    }
  }

  return lines.join('\n\n');
}

/**
 * Type guard for PlateText
 */
function isPlateText(node: PlateElement | PlateText): node is PlateText {
  return 'text' in node && typeof (node as PlateText).text === 'string';
}

/**
 * Extract plain text from a single node
 */
function extractTextFromNode(node: PlateElement | PlateText): string {
  if (isPlateText(node)) {
    return node.text;
  }

  const element = node as PlateElement;
  const texts: string[] = [];

  for (const child of element.children) {
    const text = extractTextFromNode(child as PlateElement | PlateText);
    if (text) {
      texts.push(text);
    }
  }

  return texts.join('');
}

/**
 * Create an empty PlateJS document
 */
export function createEmptyValue(): Value {
  return [
    {
      type: 'p',
      children: [{ text: '' }],
    },
  ];
}

/**
 * HTML escape for text content
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * HTML escape for attribute values
 */
function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * XHTML → Plain text
 *
 * Extracts plain text from XHTML for:
 * - Word count
 * - Full-text search
 * - AI tools input
 *
 * This is a direct XHTML parser that doesn't go through PlateJS.
 */
export function xhtmlToPlainText(xhtml: string): string {
  if (!xhtml || xhtml.trim() === '') {
    return '';
  }

  // Parse XHTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtml, 'text/html');

  // Get text content from body, or entire document if no body
  const textContent = doc.body?.textContent || doc.documentElement?.textContent || '';

  // Clean up: normalize whitespace but preserve paragraph breaks
  return textContent
    .replace(/\s+/g, ' ')  // Collapse whitespace
    .trim();
}
