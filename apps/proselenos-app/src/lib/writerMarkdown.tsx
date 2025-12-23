// lib/writerMarkdown.tsx
// Lightweight Markdown renderer for writer-centric chat display.
// Features: headings, paragraphs, blockquotes, ordered/unordered lists, bold/italic.
// Explicitly excludes: code fences, inline code, links, HTML injection.

import React from 'react';

type Theme = 'light' | 'dark';

function stripLinksAndCode(text: string): string {
  // Images: keep alt text only
  let out = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1');
  // Inline links: keep link text only
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  // Reference style links [text][id] -> keep text
  out = out.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
  // Inline code: remove backticks, keep content
  out = out.replace(/`([^`]*)`/g, '$1');
  return out;
}

function applyMarker(
  text: string,
  marker: string,
  wrap: (children: React.ReactNode, key: string) => React.ReactNode,
  keyPrefix: string
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  let partIndex = 0;
  while (i < text.length) {
    const start = text.indexOf(marker, i);
    if (start === -1) {
      out.push(text.slice(i));
      break;
    }
    // Push leading text
    if (start > i) out.push(text.slice(i, start));
    const end = text.indexOf(marker, start + marker.length);
    if (end === -1) {
      // unmatched, keep literal
      out.push(text.slice(start));
      break;
    }
    const inner = text.slice(start + marker.length, end);
    out.push(wrap(inner, `${keyPrefix}-${partIndex++}`));
    i = end + marker.length;
  }
  return out;
}

function applyEmphasis(nodes: React.ReactNode[], keyPrefix: string): React.ReactNode[] {
  // First, apply strong (** or __), then emphasis (* or _)
  const resultAfterStrong: React.ReactNode[] = [];
  nodes.forEach((node, idx) => {
    if (typeof node !== 'string') {
      resultAfterStrong.push(node);
      return;
    }
    // Apply **strong**
    const strongApplied = applyMarker(
      node,
      '**',
      (children, key) => <strong key={`${keyPrefix}-b-ast-${idx}-${key}`}>{children}</strong>,
      `${keyPrefix}-b-ast-${idx}`
    );
    // Apply __strong__ on resulting string segments only
    const __applied: React.ReactNode[] = [];
    strongApplied.forEach((subNode, subIdx) => {
      if (typeof subNode !== 'string') {
        __applied.push(subNode);
        return;
      }
      const parts = applyMarker(
        subNode,
        '__',
        (children, key) => <strong key={`${keyPrefix}-b-us-${idx}-${subIdx}-${key}`}>{children}</strong>,
        `${keyPrefix}-b-us-${idx}-${subIdx}`
      );
      __applied.push(...parts);
    });
    resultAfterStrong.push(...__applied);
  });

  // Then apply emphasis *em* and _em_
  const resultAfterEm: React.ReactNode[] = [];
  resultAfterStrong.forEach((node, idx) => {
    if (typeof node !== 'string') {
      resultAfterEm.push(node);
      return;
    }
    const emApplied = applyMarker(
      node,
      '*',
      (children, key) => <em key={`${keyPrefix}-i-ast-${idx}-${key}`}>{children}</em>,
      `${keyPrefix}-i-ast-${idx}`
    );
    const _applied: React.ReactNode[] = [];
    emApplied.forEach((subNode, subIdx) => {
      if (typeof subNode !== 'string') {
        _applied.push(subNode);
        return;
      }
      const parts = applyMarker(
        subNode,
        '_',
        (children, key) => <em key={`${keyPrefix}-i-us-${idx}-${subIdx}-${key}`}>{children}</em>,
        `${keyPrefix}-i-us-${idx}-${subIdx}`
      );
      _applied.push(...parts);
    });
    resultAfterEm.push(..._applied);
  });
  return resultAfterEm;
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const stripped = stripLinksAndCode(text);
  // For inline rendering, apply emphasis rules
  const nodes: React.ReactNode[] = [stripped];
  return applyEmphasis(nodes, keyPrefix);
}

function headingStyle(level: number, theme: Theme): React.CSSProperties {
  const baseColor = theme === 'dark' ? '#e2e8f0' : '#1a202c';
  const sizes: Record<number, string> = {
    1: '20px',
    2: '18px',
    3: '16px',
    4: '15px',
    5: '14px',
    6: '14px'
  };
  return {
    margin: '4px 0',
    fontSize: sizes[level] || '16px',
    fontWeight: 700,
    color: baseColor
  };
}

function paragraphStyle(): React.CSSProperties {
  return { margin: '6px 0' };
}

function blockquoteStyle(theme: Theme): React.CSSProperties {
  return {
    margin: '6px 0',
    padding: '4px 8px',
    borderLeft: `3px solid ${theme === 'dark' ? '#718096' : '#cbd5e0'}`,
    color: theme === 'dark' ? '#cbd5e0' : '#4a5568',
    fontStyle: 'italic'
  };
}

function listStyle(): React.CSSProperties {
  return { margin: '6px 0 6px 20px' };
}

export function renderWriterMarkdown(content: string, isDarkMode: boolean): React.ReactElement {
  const theme: Theme = isDarkMode ? 'dark' : 'light';
  const text = content.replace(/\r\n?/g, '\n');
  const lines = text.split('\n');

  const elements: React.ReactElement[] = [];
  let i = 0;
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let inCodeBlock = false;
  let keyCounter = 0;

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const joined = paragraphBuffer.join(' ');
      elements.push(
        <p key={`p-${keyCounter++}`} style={paragraphStyle()}>{renderInline(joined, `p-${keyCounter}`)}</p>
      );
      paragraphBuffer = [];
    }
  };

  const flushList = () => {
    if (listBuffer.length > 0 && listType) {
      const items = listBuffer.map((item, idx) => (
        <li key={`li-${keyCounter}-${idx}`}>{renderInline(item.trim(), `li-${keyCounter}-${idx}`)}</li>
      ));
      if (listType === 'ul') {
        elements.push(<ul key={`ul-${keyCounter++}`} style={listStyle()}>{items}</ul>);
      } else {
        elements.push(<ol key={`ol-${keyCounter++}`} style={listStyle()}>{items}</ol>);
      }
      listBuffer = [];
      listType = null;
    }
  };

  while (i < lines.length) {
    let line = lines[i];
    if (!line) {
      i += 1;
      continue;
    }

    // Toggle code block fences; we don't render special formatting
    if (/^\s*```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      i += 1;
      continue;
    }

    // Horizontal rule
    if (!inCodeBlock && /^\s*(---|\*\*\*|___)\s*$/.test(line)) {
      flushParagraph();
      flushList();
      elements.push(<hr key={`hr-${keyCounter++}`} />);
      i += 1;
      continue;
    }

    // Headings
    const headingMatch: RegExpMatchArray | null = inCodeBlock ? null : line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch && headingMatch[1] && headingMatch[2]) {
      flushParagraph();
      flushList();
      const level = Math.min(6, headingMatch[1].length);
      const textContent = headingMatch[2].trim();
      elements.push(
        <div key={`h-${keyCounter++}`} style={headingStyle(level, theme)}>
          {renderInline(textContent, `h-${keyCounter}`)}
        </div>
      );
      i += 1;
      continue;
    }

    // Blockquote (accumulate contiguous blockquote lines)
    if (!inCodeBlock && /^\s*>\s?/.test(line)) {
      flushParagraph();
      flushList();
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const quoteLine = lines[i];
        if (!quoteLine || !/^\s*>\s?/.test(quoteLine)) break;
        quoteLines.push(quoteLine.replace(/^\s*>\s?/, ''));
        i += 1;
      }
      const quoteText = quoteLines.join(' ');
      elements.push(
        <blockquote key={`bq-${keyCounter++}`} style={blockquoteStyle(theme)}>
          {renderInline(quoteText, `bq-${keyCounter}`)}
        </blockquote>
      );
      continue;
    }

    // Lists
    const ulMatch: RegExpMatchArray | null = inCodeBlock ? null : line.match(/^\s*[-*+]\s+(.*)$/);
    const olMatch: RegExpMatchArray | null = inCodeBlock ? null : line.match(/^\s*(\d+)\.\s+(.*)$/);
    if ((ulMatch && ulMatch[1]) || (olMatch && olMatch[2])) {
      flushParagraph();
      let thisType: 'ul' | 'ol';
      let contentText: string;
      if (ulMatch && ulMatch[1]) {
        thisType = 'ul';
        contentText = ulMatch[1].trim();
      } else if (olMatch && olMatch[2]) {
        thisType = 'ol';
        contentText = olMatch[2].trim();
      } else {
        i += 1;
        continue;
      }
      if (listType && listType !== thisType) {
        flushList();
      }
      listType = thisType;
      listBuffer.push(contentText);
      i += 1;
      // Accumulate subsequent list items of the same type
      while (i < lines.length) {
        const nextLine = lines[i];
        if (!nextLine) break;
        const nextUl: RegExpMatchArray | null = nextLine.match(/^\s*[-*+]\s+(.*)$/);
        const nextOl: RegExpMatchArray | null = nextLine.match(/^\s*(\d+)\.\s+(.*)$/);
        const isSameType = thisType === 'ul' ? (!!nextUl && !!nextUl[1]) : (!!nextOl && !!nextOl[2]);
        if (!isSameType) break;
        let itemText: string;
        if (thisType === 'ul' && nextUl && nextUl[1]) {
          itemText = nextUl[1].trim();
        } else if (thisType === 'ol' && nextOl && nextOl[2]) {
          itemText = nextOl[2].trim();
        } else {
          break;
        }
        listBuffer.push(itemText);
        i += 1;
      }
      flushList();
      continue;
    }

    // Blank line flushes paragraph
    if (!inCodeBlock && /^\s*$/.test(line)) {
      flushParagraph();
      i += 1;
      continue;
    }

    // Default: add to paragraph buffer; if inside code block, treat as plain text
    paragraphBuffer.push(line);
    i += 1;
  }

  // Flush any remaining buffers
  flushList();
  flushParagraph();

  return <>{elements}</>;
}

export default renderWriterMarkdown;
