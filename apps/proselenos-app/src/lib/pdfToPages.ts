// lib/pdfToPages.ts
// Parse PDF files into working copy structure for Authors mode
// One PDF page becomes one editable section

let pdfjsLibCache: typeof import('pdfjs-dist') | null = null;

async function getPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (pdfjsLibCache) return pdfjsLibCache;
  const lib = await import('pdfjs-dist');
  lib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  pdfjsLibCache = lib;
  return lib;
}

export interface ParsedPdf {
  title: string;
  author: string;
  language: string;
  coverImage: Blob | null;
  sections: { id: string; title: string; content: string; type?: 'title-page' | 'copyright' }[];
}

export async function parsePdf(file: File): Promise<ParsedPdf> {
  const pdfjsLib = await getPdfjs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;

  const meta = await pdfDoc.getMetadata().catch(() => null);
  const info = (meta?.info ?? {}) as Record<string, unknown>;
  const fileTitle = file.name.replace(/\.pdf$/i, '');
  const metaTitle = typeof info.Title === 'string' ? info.Title.trim() : '';
  const metaAuthor = typeof info.Author === 'string' ? info.Author.trim() : '';
  const title = metaTitle || fileTitle;
  const author = metaAuthor;

  const sections: ParsedPdf['sections'] = [];
  sections.push(
    { id: 'title-page', title: 'Title Page', content: '', type: 'title-page' },
    { id: 'copyright',  title: 'Copyright',  content: '', type: 'copyright'  },
  );
  let totalChars = 0;

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const textContent = await page.getTextContent();

    const items = textContent.items
      .filter((it: any) => typeof it.str === 'string')
      .map((it: any) => ({
        str: it.str as string,
        x: it.transform[4] as number,
        y: it.transform[5] as number,
        height: (it.height as number) || (it.transform[3] as number) || 12,
        hasEOL: Boolean(it.hasEOL),
      }));

    items.sort((a, b) => (b.y - a.y) || (a.x - b.x));

    let text = '';
    let prevY: number | null = null;
    let prevHeight = 12;
    for (const it of items) {
      if (prevY !== null) {
        const dy = prevY - it.y;
        if (dy > prevHeight * 1.6) text += '\n\n';
        else if (dy > prevHeight * 0.4) text += '\n';
        else if (text && !text.endsWith(' ') && !text.endsWith('\n')) text += ' ';
      }
      text += it.str;
      if (it.hasEOL) text += '\n';
      prevY = it.y;
      prevHeight = it.height || prevHeight;
    }

    text = text.trim();
    totalChars += text.length;

    sections.push({
      id: `page-${String(i).padStart(4, '0')}`,
      title: `Page ${i}`,
      content: text,
    });

    page.cleanup();
  }

  if (pdfDoc.numPages > 0 && totalChars / pdfDoc.numPages < 20) {
    throw new Error(
      'This PDF appears to contain scanned page images, not selectable text. Text extraction requires a text-based PDF.',
    );
  }

  return {
    title,
    author,
    language: '',
    coverImage: null,
    sections,
  };
}
