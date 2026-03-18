// epub-to-pdf-5x8.tsx
//
// Client-side epub → 5×8 inch PDF using JSZip + book-pdf
// Cloned from epub-to-pdf.tsx — single continuous page flow with
// running headers, page numbers, and table of contents.
// Targeting Amazon KDP's most popular small paperback trim size.

import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, pdf } from 'book-pdf';
import JSZip from 'jszip';
import {
  getSpineItems,
  extractChapters,
  type PdfOptions,
  type ChapterData,
} from './epub-to-pdf';
// Font registration handled by book-pdf (EBGaramond is the only font)

// ─── Styles (5×8 format) ───

const styles = StyleSheet.create({
  page: {
    paddingTop: 45,
    paddingBottom: 45,
    paddingLeft: 63,
    paddingRight: 63,
    fontFamily: 'EBGaramond',
    fontSize: 11,
    lineHeight: 1.4,
  },
  header: {
    position: 'absolute',
    top: 22,
    left: 63,
    right: 63,
    textAlign: 'center',
    color: 'grey',
    fontSize: 9,
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 12,
    top: 546,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'grey',
  },
  // Title page
  titlePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookTitle: {
    fontSize: 26,
    fontFamily: 'EBGaramond',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 1.6,
    marginBottom: 100,
  },
  bookAuthor: {
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 25,
  },
  // Copyright page
  copyrightPage: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 50,
  },
  copyrightText: {
    fontSize: 9,
    lineHeight: 1.6,
    marginBottom: 4,
  },
  // TOC page
  tocPage: {
    paddingTop: 70,
  },
  tocHeading: {
    fontSize: 16,
    fontFamily: 'EBGaramond',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 25,
  },
  tocItem: {
    fontSize: 11,
    marginBottom: 8,
  },
  // Content styles
  paragraph: {
    marginBottom: 10,
    textAlign: 'left',
  },
  h1: {
    fontSize: 18,
    fontFamily: 'EBGaramond',
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
  },
  h2: {
    fontSize: 15,
    fontFamily: 'EBGaramond',
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 10,
  },
  h3: {
    fontSize: 13,
    fontFamily: 'EBGaramond',
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  image: {
    width: 180,
    marginVertical: 15,
    alignSelf: 'center' as const,
  },
  sceneBreak: {
    textAlign: 'center',
    marginVertical: 15,
  },
  listItem: {
    marginBottom: 4,
    paddingLeft: 15,
  },
  blockquote: {
    paddingLeft: 20,
    fontStyle: 'italic',
    marginBottom: 10,
  },
});

// ─── HTML-to-book-pdf converter (own key counter) ───

let elementKeyCounter = 0;

export function resetElementKeyCounter() {
  elementKeyCounter = 0;
}

function nextKey(): string {
  return `f8-${elementKeyCounter++}`;
}

function convertHtmlToElements(html: string): React.ReactNode[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild;
  if (!root) return [];
  return convertChildren(root);
}

function convertChildren(node: Node): React.ReactNode[] {
  const results: React.ReactNode[] = [];
  const children = Array.from(node.childNodes);
  for (const child of children) {
    const converted = convertNode(child);
    if (converted !== null) {
      results.push(converted);
    }
  }
  return results;
}

function convertNode(node: Node): React.ReactNode {
  // Text node
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (text.trim() === '') return null;
    return <Text key={nextKey()} style={styles.paragraph}>{text}</Text>;
  }

  // Element node
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'p': {
      const inlineContent = collectInlineContent(el);
      if (inlineContent.length === 0) return null;
      return <Text key={nextKey()} style={styles.paragraph}>{inlineContent}</Text>;
    }

    case 'h1':
      return <Text key={nextKey()} style={styles.h1}>{el.textContent ?? ''}</Text>;

    case 'h2':
      return <Text key={nextKey()} style={styles.h2}>{el.textContent ?? ''}</Text>;

    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return <Text key={nextKey()} style={styles.h3}>{el.textContent ?? ''}</Text>;

    case 'img': {
      const src = el.getAttribute('src');
      if (!src) return null;
      // eslint-disable-next-line jsx-a11y/alt-text
      return <Image key={nextKey()} style={styles.image} src={src} />;
    }

    case 'hr':
      return (
        <View key={nextKey()} style={styles.sceneBreak}>
          <Text>* * *</Text>
        </View>
      );

    case 'br':
      return <Text key={nextKey()}>{'\n'}</Text>;

    case 'ul':
    case 'ol': {
      const items: React.ReactNode[] = [];
      let listIndex = 0;
      for (const li of Array.from(el.children)) {
        if (li.tagName.toLowerCase() === 'li') {
          listIndex++;
          const prefix = tag === 'ol' ? `${listIndex}. ` : '\u2022 ';
          items.push(
            <Text key={nextKey()} style={styles.listItem}>
              {prefix}{li.textContent ?? ''}
            </Text>
          );
        }
      }
      return <View key={nextKey()}>{items}</View>;
    }

    case 'blockquote': {
      const inlineContent = collectInlineContent(el);
      return (
        <View key={nextKey()} style={styles.blockquote}>
          <Text>{inlineContent}</Text>
        </View>
      );
    }

    case 'div':
    case 'section':
    case 'article':
    case 'aside':
    case 'figure':
    case 'figcaption':
    case 'nav':
    case 'main':
    case 'header':
    case 'footer': {
      // Block-level containers: recursively convert children
      const children = convertChildren(el);
      if (children.length === 0) return null;
      return <View key={nextKey()}>{children}</View>;
    }

    case 'em':
    case 'i':
      return <Text key={nextKey()} style={{ fontStyle: 'italic' }}>{el.textContent ?? ''}</Text>;

    case 'strong':
    case 'b':
      return <Text key={nextKey()} style={{ fontFamily: 'EBGaramond', fontWeight: 'bold' }}>{el.textContent ?? ''}</Text>;

    case 'span':
    case 'small':
    case 'sup':
    case 'sub':
    case 'u':
    case 'a':
      return <Text key={nextKey()}>{el.textContent ?? ''}</Text>;

    default: {
      // Unknown element: render children as fallback
      const children = convertChildren(el);
      if (children.length === 0) return null;
      if (children.length === 1) return children[0];
      return <View key={nextKey()}>{children}</View>;
    }
  }
}

/**
 * Collects inline content from an element, preserving bold/italic
 * as nested <Text> elements (which book-pdf supports for inline styling).
 */
function collectInlineContent(el: Element): React.ReactNode[] {
  const results: React.ReactNode[] = [];

  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text) results.push(text);
      continue;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const childEl = child as Element;
    const childTag = childEl.tagName.toLowerCase();

    switch (childTag) {
      case 'em':
      case 'i':
        results.push(
          <Text key={nextKey()} style={{ fontStyle: 'italic' }}>{childEl.textContent ?? ''}</Text>
        );
        break;
      case 'strong':
      case 'b':
        results.push(
          <Text key={nextKey()} style={{ fontFamily: 'EBGaramond', fontWeight: 'bold' }}>{childEl.textContent ?? ''}</Text>
        );
        break;
      case 'br':
        results.push('\n');
        break;
      case 'img': {
        // Images can't be nested inside <Text>, so we skip them in inline context.
        // They'll be handled at block level if the parent is a block container.
        break;
      }
      default:
        // For any other inline-ish element, just grab text content
        results.push(childEl.textContent ?? '');
        break;
    }
  }

  return results;
}

// ─── BookDocument5x8 component ───

export const BookDocument5x8: React.FC<{
  chapters: ChapterData[];
  options: PdfOptions;
}> = ({ chapters, options }) => {
  const includeToc = options.includeToc !== false;

  return (
    <Document>
      <Page size={[360, 576]} style={styles.page}>
        {/* Running header: hidden on first few pages */}
        <Text style={styles.header} fixed render={({ pageNumber }: { pageNumber: number }) => {
          if (pageNumber <= 3) return '';
          return pageNumber % 2 === 0 ? options.author : options.title;
        }} />

        {/* Title Page */}
        <View style={styles.titlePage}>
          <Text style={styles.bookTitle}>{options.title}</Text>
          <Text style={styles.bookAuthor}>{options.author}</Text>
        </View>

        {/* Copyright Page — only if the epub has one */}
        {options.copyrightHtml && (
          <View break style={styles.copyrightPage}>
            {convertHtmlToElements(options.copyrightHtml)}
          </View>
        )}

        {/* Table of Contents */}
        {includeToc && (
          <View break style={styles.tocPage}>
            <Text style={styles.tocHeading}>Contents</Text>
            {chapters.map((ch, i) => (
              <Text key={i} style={styles.tocItem}>{ch.title}</Text>
            ))}
          </View>
        )}

        {/* Chapters — each starts on a new page */}
        {chapters.map((ch) => (
          <View break key={ch.id}>
            {convertHtmlToElements(ch.html)}
          </View>
        ))}

        {/* Page numbers: hidden on page 1 */}
        <Text style={styles.pageNumber} fixed render={({ pageNumber }: { pageNumber: number }) => {
          if (pageNumber === 1) return '';
          return String(pageNumber);
        }} />
      </Page>
    </Document>
  );
};

// ─── Public API ───

export async function generatePdfFromEpub5x8(
  epubData: ArrayBuffer,
  options: PdfOptions
): Promise<void> {
  resetElementKeyCounter();

  const zip = await JSZip.loadAsync(epubData);
  const spinePaths = await getSpineItems(zip);
  const chapters = await extractChapters(zip, spinePaths);

  if (chapters.length === 0) {
    throw new Error('No chapter content found in epub');
  }

  const blob = await pdf(<BookDocument5x8 chapters={chapters} options={options} />).toBlob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
