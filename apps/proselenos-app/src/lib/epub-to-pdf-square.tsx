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
  // Content pages (every page after the copyright page): same as pageOdd/
  // pageEven but with an extra 0.5" of top padding.
  contentPageOdd: {
    paddingTop: 63,    // 27 + 36 (0.5") — extra breathing room at the top
    paddingBottom: 27,
    paddingLeft: 63,
    paddingRight: 63,
    fontFamily: 'EBGaramond',
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 1.4,
  },
  contentPageEven: {
    paddingTop: 63,
    paddingBottom: 27,
    paddingLeft: 63,
    paddingRight: 63,
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

// ─── Kids-book chapter split: image+caption on verso, body text on recto ───

interface ChapterSplit {
  versoElements: React.ReactNode[];
  rectoElements: React.ReactNode[];
}

function splitChapterForKidsBook(html: string): ChapterSplit | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
  const root = doc.body.firstChild as Element | null;
  if (!root) return null;

  // Collect renderable content elements in document order, flattening
  // through container wrappers (div/section/etc.) but stopping at leaf
  // content tags. Headings are dropped entirely.
  const leafTags = new Set(['img', 'p', 'blockquote', 'ul', 'ol', 'hr']);
  const contentEls: Element[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return;
    if (leafTags.has(tag)) {
      contentEls.push(el);
      return;
    }
    for (const child of Array.from(el.childNodes)) walk(child);
  };
  walk(root);

  if (contentEls.length === 0) return null;

  const imgIndex = contentEls.findIndex(el => el.tagName.toLowerCase() === 'img');

  // versoElements / rectoElements name their final printed destination:
  //   versoElements → left (verso) page of the spread
  //   rectoElements → right (recto) page of the spread
  const versoElements: React.ReactNode[] = [];
  const rectoElements: React.ReactNode[] = [];

  if (imgIndex === -1) {
    // Back matter (no image): all content on recto, verso blank.
    for (const el of contentEls) {
      const n = convertNode(el);
      if (n) rectoElements.push(n);
    }
  } else {
    // Image chapter: image on recto, body text on verso, caption dropped.
    const imgEl = contentEls[imgIndex]!;
    const imgNode = convertNode(imgEl);
    if (imgNode) rectoElements.push(imgNode);
    const captionIndex = imgIndex + 1;
    const textEls = contentEls.filter((_, i) => i !== imgIndex && i !== captionIndex);
    for (const el of textEls) {
      const n = convertNode(el);
      if (n) versoElements.push(n);
    }
  }

  return { versoElements, rectoElements };
}

// ─── BookDocumentSquare component (no header, no page numbers, no TOC) ───

export const BookDocumentSquare: React.FC<{
  chapters: ChapterData[];
  options: PdfOptions;
}> = ({ chapters, options }) => {
  const splits: Array<{ id: string } & ChapterSplit> = [];
  for (const ch of chapters) {
    const s = splitChapterForKidsBook(ch.html);
    if (s) splits.push({ id: ch.id, ...s });
  }

  return (
    <Document pageLayout="twoPageRight">
      {/* Page 1 (recto): Title Page */}
      <Page size={[612, 612]} style={styles.pageOdd}>
        <View style={styles.titlePage}>
          <Text style={styles.bookTitle}>{options.title}</Text>
          <Text style={styles.bookAuthor}>{options.author}</Text>
        </View>
      </Page>

      {/* Page 2 (verso): Blank — satisfies KDP's title-page convention
          (back of title leaf is blank, representing the inside cover) */}
      <Page size={[612, 612]} style={styles.pageEven}>
        <View />
      </Page>

      {/* Page 3 (recto): Copyright — always emitted (blank if none) */}
      <Page size={[612, 612]} style={styles.pageOdd}>
        {options.copyrightHtml ? (
          <View style={styles.copyrightPage}>
            {convertHtmlToElements(options.copyrightHtml)}
          </View>
        ) : (
          <View />
        )}
      </Page>

      {/* Page 4 (verso): Forced blank after copyright. From here on, every
          page uses the contentPage styles which add 0.5" of top padding. */}
      <Page size={[612, 612]} style={styles.contentPageEven}>
        <View />
      </Page>

      {/* Each entry: 2 pages. First emitted page lands on recto (odd).
          Image chapters: image recto, body text verso.
          Back matter (no image): content recto, blank verso. */}
      {splits.map(({ id, versoElements, rectoElements }) => (
        <React.Fragment key={id}>
          <Page size={[612, 612]} style={styles.contentPageOdd}>
            {rectoElements.length > 0 ? rectoElements : <View />}
          </Page>
          <Page size={[612, 612]} style={styles.contentPageEven}>
            {versoElements.length > 0 ? versoElements : <View />}
          </Page>
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
