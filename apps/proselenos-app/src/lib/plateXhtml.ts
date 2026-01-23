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
  superscript?: boolean;
  subscript?: boolean;
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

  const html = serializeNodes(value as (PlateElement | PlateText)[]);
  return html;
}

/**
 * Serialize nodes, grouping consecutive indent-based list paragraphs into ul/ol
 */
function serializeNodes(nodes: (PlateElement | PlateText)[]): string {
  const parts: string[] = [];
  let i = 0;

  while (i < nodes.length) {
    const node = nodes[i]!;
    if ('type' in node && node.type === 'p' && (node as any).listStyleType) {
      // Collect consecutive list items with same listStyleType
      const listStyleType = (node as any).listStyleType;
      const isOrdered = listStyleType === 'decimal';
      const listTag = isOrdered ? 'ol' : 'ul';
      const items: string[] = [];

      while (i < nodes.length) {
        const current = nodes[i]!;
        if (!('type' in current) || current.type !== 'p' || (current as any).listStyleType !== listStyleType) break;
        const children = (current as PlateElement).children
          .map(child => serializeNode(child as PlateElement | PlateText))
          .join('');
        items.push(`<li>${children}</li>\n`);
        i++;
      }

      parts.push(`<${listTag}>\n${items.join('')}</${listTag}>\n`);
    } else {
      parts.push(serializeNode(node as PlateElement | PlateText));
      i++;
    }
  }

  return parts.join('');
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
      const pAlign = (element as any).align;
      if (pAlign && pAlign !== 'left') {
        return `<p style="text-align: ${pAlign}">${children}</p>\n`;
      }
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
  if (node.subscript) {
    text = `<sub>${text}</sub>`;
  }
  if (node.superscript) {
    text = `<sup>${text}</sup>`;
  }
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

  const parser = new DOMParser();
  const doc = parser.parseFromString(xhtml, 'text/html');
  const body = doc.body;
  if (!body) return createEmptyValue();

  const blocks = processBlockChildren(body);

  if (blocks.length === 0) {
    return createEmptyValue();
  }
  return blocks as Value;
}

/**
 * Recursively walk direct children of a container element,
 * descending into wrapper divs to find actual block content.
 */
function processBlockChildren(container: Element): (PlateElement | PlateText)[] {
  const blocks: (PlateElement | PlateText)[] = [];

  container.childNodes.forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'p': {
        // Vellum scene breaks: <p class="implicit-break scene-break"></p>
        if (el.classList.contains('scene-break') || el.classList.contains('implicit-break')) {
          // Only treat as scene break if the paragraph is empty
          const textContent = el.textContent?.trim() || '';
          if (textContent === '') {
            blocks.push({ type: 'p', children: [{ text: '' }] });
            break;
          }
        }
        const parsed = parseElement(el);
        if (parsed) blocks.push(parsed);
        break;
      }

      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6':
      case 'hr':
      case 'figure': {
        const parsed = parseElement(el);
        if (parsed) blocks.push(parsed);
        break;
      }

      case 'blockquote': {
        const parsed = parseElement(el);
        if (parsed) blocks.push(parsed);
        break;
      }

      case 'ul': case 'ol': {
        const listItems = parseListToFlatParagraphs(el);
        blocks.push(...listItems);
        break;
      }

      case 'div': {
        handleDiv(el, blocks);
        break;
      }

      case 'section': {
        // Sections are structural wrappers in many non-Vellum epubs — recurse into children
        const innerBlocks = processBlockChildren(el);
        blocks.push(...innerBlocks);
        break;
      }

      default:
        // Unknown block element - try to extract as paragraph
        const content = parseChildren(el);
        if (content.length > 0) {
          blocks.push({ type: 'p', children: content });
        }
        break;
    }
  });

  return blocks;
}

/**
 * Classify Vellum wrapper divs and extract content appropriately.
 * Vellum uses specific div classes for structural elements.
 */
function handleDiv(el: Element, blocks: (PlateElement | PlateText)[]): void {
  const id = el.id || '';

  // Vellum ornamental-break: decorative scene separator with image
  if (el.classList.contains('ornamental-break')) {
    blocks.push({ type: 'hr', children: [{ text: '' }] });
    return;
  }

  // Vellum page-break: explicit page break marker
  if (el.classList.contains('page-break')) {
    blocks.push({ type: 'hr', children: [{ text: '' }] });
    return;
  }

  // Vellum inline-image: image with optional caption
  if (el.classList.contains('inline-image')) {
    const img = el.querySelector('img');
    if (img) {
      const imgNode = parseImageElement(img);

      // Extract size from Vellum class names (inline-image-size-*)
      if (el.classList.contains('inline-image-size-small')) {
        (imgNode as any).width = '30%';
      } else if (el.classList.contains('inline-image-size-medium')) {
        (imgNode as any).width = '50%';
      } else if (el.classList.contains('inline-image-size-large')) {
        (imgNode as any).width = '75%';
      }

      // Extract alignment from Vellum class names (inline-image-flow-*)
      if (el.classList.contains('inline-image-flow-left')) {
        (imgNode as any).align = 'left';
      } else if (el.classList.contains('inline-image-flow-right')) {
        (imgNode as any).align = 'right';
      } else if (el.classList.contains('inline-image-flow-center')) {
        (imgNode as any).align = 'center';
      }

      // Extract caption (Vellum uses p.inline-image-caption)
      const captionEl = el.querySelector('figcaption, .caption, p.caption-text, p.inline-image-caption');
      const captionText = captionEl?.textContent?.trim() || '';
      if (captionText) {
        (imgNode as any).caption = [{ text: captionText }];
      }

      blocks.push(imgNode);
    }
    return;
  }

  // Vellum blockquote-container: wraps a blockquote element
  if (el.classList.contains('blockquote-container') || el.classList.contains('blockquote')) {
    const bq = el.querySelector('blockquote');
    if (bq) {
      // Parse the blockquote's content as child paragraphs
      const bqChildren = processBlockChildren(bq);
      const validChildren = bqChildren.length > 0 ? bqChildren : [{ text: '' } as PlateText];
      blocks.push({ type: 'blockquote', children: validChildren });
    } else {
      // No actual blockquote inside - recurse
      const innerBlocks = processBlockChildren(el);
      blocks.push(...innerBlocks);
    }
    return;
  }

  // Vellum list-text-feature: wraps a ul or ol
  if (el.classList.contains('list-text-feature') || el.classList.contains('list-text')) {
    const list = el.querySelector('ul, ol');
    if (list) {
      const listItems = parseListToFlatParagraphs(list);
      blocks.push(...listItems);
    } else {
      // No list found - recurse into children
      const innerBlocks = processBlockChildren(el);
      blocks.push(...innerBlocks);
    }
    return;
  }

  // Vellum alignment-block: contains a text-block with aligned paragraphs
  if (el.classList.contains('alignment-block') || el.classList.contains('text-block')) {
    // Detect alignment from class (e.g., alignment-block-align-right)
    let align: string | undefined;
    if (el.classList.contains('alignment-block-align-right')) align = 'right';
    else if (el.classList.contains('alignment-block-align-center')) align = 'center';
    else if (el.classList.contains('alignment-block-align-left')) align = 'left';

    const innerBlocks = processBlockChildren(el);
    if (align) {
      innerBlocks.forEach(block => {
        if ('type' in block) (block as any).align = align;
      });
    }
    blocks.push(...innerBlocks);
    return;
  }

  // Vellum heading div: contains chapter heading (h1/h2)
  // Skip if chapter title is already displayed in sidebar
  if (el.classList.contains('heading') && !el.classList.contains('subheading')) {
    const heading = el.querySelector('h1, h2, h3');
    if (heading) {
      const parsed = parseElement(heading);
      if (parsed) blocks.push(parsed);
    }
    return;
  }

  // Vellum text container: id like "chapter-X-text" - the actual content wrapper
  if (id && /^chapter-\d+-text$/.test(id)) {
    const innerBlocks = processBlockChildren(el);
    blocks.push(...innerBlocks);
    return;
  }

  // Vellum "text" class div: another content wrapper pattern
  if (el.classList.contains('text')) {
    const innerBlocks = processBlockChildren(el);
    blocks.push(...innerBlocks);
    return;
  }

  // Generic div with an image inside (non-Vellum pattern)
  const img = el.querySelector('img');
  if (img && !el.querySelector('p, h1, h2, h3, h4, h5, h6, div')) {
    blocks.push(parseImageElement(img));
    return;
  }

  // Default: recurse into the div's children (generic wrapper)
  const innerBlocks = processBlockChildren(el);
  if (innerBlocks.length > 0) {
    blocks.push(...innerBlocks);
  }
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
    case 'ol':
      // Lists are handled by parseListToFlatParagraphs in processBlockChildren.
      // This fallback returns a simple paragraph if parseElement is called directly.
      return { type: 'p', children: validChildren };

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
 * Parse list (ul/ol) into flat paragraphs with indent-based list properties.
 * PlateJS uses indent model: each list item is a paragraph with listStyleType/indent.
 */
function parseListToFlatParagraphs(el: Element): PlateElement[] {
  const items: PlateElement[] = [];
  const isOrdered = el.tagName.toLowerCase() === 'ol';
  const listStyleType = isOrdered ? 'decimal' : 'disc';
  const lis = el.querySelectorAll(':scope > li');

  lis.forEach((li, index) => {
    const children = parseChildren(li);
    const node: PlateElement = {
      type: 'p',
      indent: 1,
      listStyleType,
      children: children.length > 0 ? children : [{ text: '' }]
    };
    if (index > 0) {
      (node as any).listStart = index + 1;
    }
    items.push(node);
  });

  return items.length > 0 ? items : [{ type: 'p', indent: 1, listStyleType, children: [{ text: '' }] }];
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
      } else if (tag === 'sup') {
        const innerChildren = parseChildren(childEl);
        innerChildren.forEach(child => {
          if ('text' in child) {
            children.push({ ...child, superscript: true });
          } else {
            children.push(child);
          }
        });
      } else if (tag === 'sub') {
        const innerChildren = parseChildren(childEl);
        innerChildren.forEach(child => {
          if ('text' in child) {
            children.push({ ...child, subscript: true });
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
