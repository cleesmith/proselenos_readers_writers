// services/webReadyService.ts
// Downloads a library book as a "web ready" zip: index.html + images/ + audio/

import { parseEpub } from '@/services/epubService';
import { getLocalBookFilename } from '@/utils/book';
import { generateWebReadyZip, makeWebReadySlug } from '@/lib/web-ready-generator';
import { Book } from '@/types/book';
import { EnvConfigType } from '@/services/environment';

/**
 * Download a library book as a web-ready zip file.
 * Pipeline: IndexedDB EPUB -> parseEpub -> generateWebReadyZip -> browser download
 */
export async function downloadBookAsWebReady(
  book: Book,
  envConfig: EnvConfigType,
  isDarkMode: boolean,
): Promise<void> {
  // 1. Fetch the EPUB file from IndexedDB
  const appService = await envConfig.getAppService();
  const file = await appService.openFile(getLocalBookFilename(book), 'Books');

  // 2. Parse the EPUB into sections, images, audio, and metadata
  const parsed = await parseEpub(file);

  // 3. Generate the web-ready zip
  const blob = await generateWebReadyZip({
    title: parsed.title || book.title || 'Untitled',
    author: parsed.author || book.author || 'Unknown Author',
    year: new Date().getFullYear().toString(),
    sections: parsed.sections.map(s => ({
      title: s.title,
      content: s.xhtml,
      sceneCraftConfig: s.sceneCraftConfig,
    })),
    isDarkMode,
    coverImage: parsed.coverImage || undefined,
    images: parsed.images,
    audios: parsed.audios,
    publisher: parsed.publisher,
    subtitle: parsed.subtitle,
  });

  // 4. Trigger browser download
  const slug = makeWebReadySlug(
    parsed.title || book.title || 'Untitled',
    parsed.author || book.author || 'Unknown Author',
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
