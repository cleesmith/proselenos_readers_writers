// epub-to-pdf.tsx
//
// Client-side epub → PDF using JSZip + @react-pdf/renderer

import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, Font, pdf } from '@react-pdf/renderer';
import JSZip from 'jszip';
Font.register({
  family: 'EBGaramond',
  fonts: [
    { src: '/fonts/EBGaramond-Regular.ttf', fontWeight: 'normal' },
    { src: '/fonts/EBGaramond-Bold.ttf', fontWeight: 'bold' },
    { src: '/fonts/EBGaramond-Italic.ttf', fontWeight: 'normal', fontStyle: 'italic' },
    { src: '/fonts/EBGaramond-BoldItalic.ttf', fontWeight: 'bold', fontStyle: 'italic' },
  ],
});

export interface PdfOptions {
  title: string;
  author: string;
  publisher?: string;      // e.g. "Slip the Trap"
  year?: string;           // e.g. "2026"
  copyrightHtml?: string;  // HTML from the epub's copyright.xhtml, or omit to skip
  includeToc?: boolean;    // default true
}

// ─── 1. Parse the epub's OPF to get spine-ordered XHTML paths ───

export async function getSpineItems(zip: JSZip): Promise<string[]> {
  // Find container.xml → rootfile path
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (!containerXml) throw new Error('No container.xml found in epub');

  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');
  const rootfilePath =
    containerDoc.querySelector('rootfile')?.getAttribute('full-path') ?? '';

  if (!rootfilePath) throw new Error('No rootfile path in container.xml');

  // Parse the OPF
  const opfText = await zip.file(rootfilePath)?.async('text');
  if (!opfText) throw new Error(`Cannot read OPF at ${rootfilePath}`);

  const opfDoc = parser.parseFromString(opfText, 'application/xml');
  const opfDir = rootfilePath.includes('/')
    ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1)
    : '';

  // Build manifest id → href map
  const manifest = new Map<string, string>();
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id') ?? '';
    const href = item.getAttribute('href') ?? '';
    manifest.set(id, href);
  });

  // Walk the spine in order
  const spineItems: string[] = [];
  opfDoc.querySelectorAll('spine > itemref').forEach((ref) => {
    const idref = ref.getAttribute('idref') ?? '';
    const href = manifest.get(idref);
    if (href) {
      spineItems.push(opfDir + href);
    }
  });

  return spineItems;
}

// ─── 2. Extract chapter HTML bodies and inline images as base64 ───

export interface ChapterData {
  title: string;
  html: string;
  id: string;         // anchor id for TOC links
}

// Paths that are typically front matter in epubs — we skip these
// since we generate our own title/copyright/toc pages
const FRONT_MATTER_PATTERNS = [
  /title[-_]?page/i,
  /cover/i,
  /copyright/i,
  /toc/i,
  /^contents\.x?html/i,
  /table[-_]?of[-_]?contents/i,
  /nav\.x?html/i,
  /frontmatter/i,
  /halftitle/i,
  /dedication/i,
];

function isFrontMatter(path: string): boolean {
  const filename = path.split('/').pop() ?? '';
  return FRONT_MATTER_PATTERNS.some((pat) => pat.test(filename));
}

export async function extractChapters(
  zip: JSZip,
  spinePaths: string[]
): Promise<ChapterData[]> {
  const chapters: ChapterData[] = [];

  for (const path of spinePaths) {
    // Skip epub's own front matter — we generate ours
    if (isFrontMatter(path)) continue;

    const xhtml = await zip.file(path)?.async('text');
    if (!xhtml) continue;

    const parser = new DOMParser();
    const doc = parser.parseFromString(xhtml, 'application/xhtml+xml');
    const body = doc.querySelector('body');
    if (!body) continue;

    // Skip if body is basically empty (some epubs have blank spacer files)
    const textContent = body.textContent?.trim() ?? '';
    if (textContent.length < 10 && !body.querySelector('img')) continue;

    // Convert relative image srcs to base64 data URIs
    const chapterDir = path.includes('/')
      ? path.substring(0, path.lastIndexOf('/') + 1)
      : '';

    const images = body.querySelectorAll('img');
    for (const img of Array.from(images)) {
      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) continue;

      const imgPath = chapterDir + src;
      const imgFile = zip.file(imgPath);
      if (imgFile) {
        const blob = await imgFile.async('base64');
        const ext = src.split('.').pop()?.toLowerCase() ?? 'png';
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        img.setAttribute('src', `data:${mime};base64,${blob}`);
      }
    }

    // Flatten all <a> links to plain <span> for print compliance
    flattenLinksForPrint(body);

    // Extract chapter title from h1, h2, or the <title> element
    const titleEl = body.querySelector('h1, h2') ?? doc.querySelector('title');
    const chapterTitle = titleEl?.textContent?.trim() ?? `Chapter ${chapters.length + 1}`;

    const chapterId = `chapter-${chapters.length + 1}`;

    chapters.push({
      title: chapterTitle,
      html: body.innerHTML,
      id: chapterId,
    });
  }

  return chapters;
}

// ─── 2a. Extract copyright page HTML from the epub ───

export async function extractCopyrightHtml(
  zip: JSZip,
  spinePaths: string[]
): Promise<string | null> {
  for (const path of spinePaths) {
    const filename = path.split('/').pop() ?? '';
    if (!/copyright/i.test(filename)) continue;

    const xhtml = await zip.file(path)?.async('text');
    if (!xhtml) continue;

    const parser = new DOMParser();
    const doc = parser.parseFromString(xhtml, 'application/xhtml+xml');
    const body = doc.querySelector('body');
    if (!body) continue;

    const textContent = body.textContent?.trim() ?? '';
    if (textContent.length < 5) continue;

    // Flatten links for print (same treatment as chapters)
    flattenLinksForPrint(body);

    return body.innerHTML;
  }
  return null;
}

// ─── 2b. Strip hyperlinks for print compliance ───

function flattenLinksForPrint(container: Element): void {
  const anchors = Array.from(container.querySelectorAll('a'));
  for (const a of anchors) {
    const href = a.getAttribute('href') ?? '';
    const text = a.textContent ?? '';
    const span = a.ownerDocument.createElement('span');
    if (href && !href.startsWith('#')) {
      span.textContent = `${text} (${href})`;
    } else {
      span.textContent = text;
    }
    a.replaceWith(span);
  }
}

// ─── 3. React-PDF styles ───

const styles = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 50,
    paddingLeft: 54,
    paddingRight: 45,
    fontFamily: 'EBGaramond',
    fontSize: 11,
    lineHeight: 1.4,
  },
  header: {
    position: 'absolute',
    top: 25,
    left: 54,
    right: 45,
    textAlign: 'center',
    color: 'grey',
    fontSize: 9,
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 12,
    top: 618,
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
    fontSize: 28,
    fontFamily: 'EBGaramond',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 1.6,
    marginBottom: 120,
  },
  bookAuthor: {
    fontSize: 16,
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
    fontSize: 9,
    lineHeight: 1.6,
    marginBottom: 4,
  },
  // TOC page
  tocPage: {
    paddingTop: 80,
  },
  tocHeading: {
    fontSize: 18,
    fontFamily: 'EBGaramond',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
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
    width: 200,
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

// ─── 4. HTML-to-react-pdf converter ───

export let elementKeyCounter = 0;

export function resetElementKeyCounter() {
  elementKeyCounter = 0;
}

function nextKey(): string {
  return `el-${elementKeyCounter++}`;
}

/**
 * Converts an HTML string (from epub chapter content) into an array of
 * react-pdf elements. This is the core bridge between DOM-parsed epub
 * content and the react-pdf component tree.
 *
 * Key constraint: react-pdf's <Text> can nest other <Text> for inline
 * styling, but cannot contain <View> or <Image>. Block elements and
 * images must be at <View> level.
 */
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
 * as nested <Text> elements (which react-pdf supports for inline styling).
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

// ─── 5. BookDocument component ───

export const BookDocument: React.FC<{
  chapters: ChapterData[];
  options: PdfOptions;
}> = ({ chapters, options }) => {
  const includeToc = options.includeToc !== false;

  return (
    <Document>
      <Page size={[432, 648]} style={styles.page}>
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

// ─── 6. Public API: the one function your icon calls ───

export async function generatePdfFromEpub(
  epubData: ArrayBuffer,
  options: PdfOptions
): Promise<void> {
  // Reset key counter for each generation
  resetElementKeyCounter();

  const zip = await JSZip.loadAsync(epubData);
  const spinePaths = await getSpineItems(zip);
  const chapters = await extractChapters(zip, spinePaths);

  if (chapters.length === 0) {
    throw new Error('No chapter content found in epub');
  }

  // Generate PDF blob entirely client-side
  const blob = await pdf(<BookDocument chapters={chapters} options={options} />).toBlob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
