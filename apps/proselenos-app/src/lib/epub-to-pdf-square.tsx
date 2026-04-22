// apps/proselenos-app/src/lib/epub-to-pdf-square.tsx
//
// Client-side epub → 8.5×8.5 inch square PDF using JSZip + book-pdf
// Cloned from epub-to-pdf.tsx — no page numbers, no running headers, no TOC.
// Targeting children's books and art books on Amazon KDP.

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

// ─── Styles (square format: no header, pageNumber, toc styles) ───

const styles = StyleSheet.create({
  pageOdd: {
    paddingTop: 27,
    paddingBottom: 27,
    paddingLeft: 63,   // 0.875" — matches Vellum
    paddingRight: 63,  // 0.875" — matches Vellum
    fontFamily: 'EBGaramond',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 1.4,
  },
  pageEven: {
    paddingTop: 27,
    paddingBottom: 27,
    paddingLeft: 63,   // 0.875" — matches Vellum
    paddingRight: 63,  // 0.875" — matches Vellum
    fontFamily: 'EBGaramond',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 1.4,
  },
  // Title page
  titlePage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookTitle: {
    fontSize: 40,
    fontFamily: 'EBGaramond',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 1.6,
    marginBottom: 120,
  },
  bookAuthor: {
    fontSize: 32,
    fontFamily: 'EBGaramond',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 30,
  },
  // Copyright page
  copyrightPage: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 60,
  },
  copyrightText: {
    fontSize: 18,
    fontFamily: 'EBGaramond',
    lineHeight: 1.6,
    marginBottom: 4,
  },
  // Content styles
  paragraph: {
    fontFamily: 'EBGaramond',
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'left',
  },
  image: {
    width: 486,              // content width: 612 - 63 - 63 (0.875" margins)
    maxHeight: 558,          // content height: 612 - 27 - 27
    objectFit: 'contain',    // scale proportionally, never distort
    alignSelf: 'center',
    marginVertical: 15,
  },
  sceneBreak: {
    fontFamily: 'EBGaramond',
    textAlign: 'center',
    marginVertical: 15,
  },
  listItem: {
    fontFamily: 'EBGaramond',
    fontWeight: 'bold',
    marginBottom: 4,
    paddingLeft: 15,
  },
  blockquote: {
    fontFamily: 'EBGaramond',
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
  return `sq-${elementKeyCounter++}`;
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
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return null;

    case 'img': {
      const src = el.getAttribute('src');
      if (!src) return null;
      // eslint-disable-next-line jsx-a11y/alt-text
      return <Image key={nextKey()} style={styles.image} src={src} />;
    }

    case 'hr':
      return (
        <View key={nextKey()} style={styles.sceneBreak}>
          <Text style={{ fontFamily: 'EBGaramond', fontWeight: 'bold' }}>* * *</Text>
        </View>
      );

    case 'br':
      return <Text key={nextKey()} style={{ fontFamily: 'EBGaramond', fontWeight: 'bold' }}>{'\n'}</Text>;

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
          <Text style={{ fontFamily: 'EBGaramond' }}>{inlineContent}</Text>
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
      const children = convertChildren(el);
      if (children.length === 0) return null;
      return <View key={nextKey()}>{children}</View>;
    }

    case 'em':
    case 'i':
      return <Text key={nextKey()} style={{ fontFamily: 'EBGaramond', fontStyle: 'italic' }}>{el.textContent ?? ''}</Text>;

    case 'strong':
    case 'b':
      return <Text key={nextKey()} style={{ fontFamily: 'EBGaramond', fontWeight: 'bold' }}>{el.textContent ?? ''}</Text>;

    case 'span':
    case 'small':
    case 'sup':
    case 'sub':
    case 'u':
    case 'a':
      return <Text key={nextKey()} style={{ fontFamily: 'EBGaramond', fontWeight: 'bold' }}>{el.textContent ?? ''}</Text>;

    default: {
      const children = convertChildren(el);
      if (children.length === 0) return null;
      if (children.length === 1) return children[0];
      return <View key={nextKey()}>{children}</View>;
    }
  }
}

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
          <Text key={nextKey()} style={{ fontFamily: 'EBGaramond', fontStyle: 'italic' }}>{childEl.textContent ?? ''}</Text>
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
        break;
      }
      default:
        results.push(childEl.textContent ?? '');
        break;
    }
  }

  return results;
}

// ─── BookDocumentSquare component (no header, no page numbers, no TOC) ───

export const BookDocumentSquare: React.FC<{
  chapters: ChapterData[];
  options: PdfOptions;
}> = ({ chapters, options }) => {
  // Drop chapters that convert to no renderable content (e.g. spine items
  // that are only <h1>…</h1>, which convertNode filters to null). Emitting
  // a Page for those would produce phantom blanks and flip recto/verso.
  const renderedChapters = chapters
    .map(ch => ({ id: ch.id, elements: convertHtmlToElements(ch.html) }))
    .filter(ch => ch.elements.length > 0);

  return (
    <Document pageLayout="twoPageRight">
      {/* Page 1 (recto): Title Page */}
      <Page size={[612, 612]} style={styles.pageOdd}>
        <View style={styles.titlePage}>
          <Text style={styles.bookTitle}>{options.title}</Text>
          <Text style={styles.bookAuthor}>{options.author}</Text>
        </View>
      </Page>

      {/* Page 2 (verso): Copyright Page — always emitted (blank if epub has none) so chapters land on recto */}
      <Page size={[612, 612]} style={styles.pageEven}>
        {options.copyrightHtml ? (
          <View style={styles.copyrightPage}>
            {convertHtmlToElements(options.copyrightHtml)}
          </View>
        ) : (
          <View />
        )}
      </Page>

      {/* Chapters — each starts on recto; a blank verso follows each (except the last) */}
      {renderedChapters.map((ch, i) => (
        <React.Fragment key={ch.id}>
          <Page size={[612, 612]} style={styles.pageOdd}>
            {ch.elements}
          </Page>
          {i < renderedChapters.length - 1 && (
            <Page size={[612, 612]} style={styles.pageEven}>
              <View />
            </Page>
          )}
        </React.Fragment>
      ))}
    </Document>
  );
};

// ─── Public API ───
// No post-processing needed — book-pdf only produces EBGaramond fonts

export async function generatePdfFromEpubSquare(
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

  const blob = await pdf(
    <BookDocumentSquare chapters={chapters} options={options} />
  ).toBlob();

  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
