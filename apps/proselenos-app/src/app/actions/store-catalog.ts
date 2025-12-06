'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { supabase, isSupabaseConfigured, getSupabaseUserByGoogleId } from '@/lib/supabase';

export interface StoreEntry {
  projectId: string;
  bookHash: string;
  title: string;
  author: string;
  description: string;
  ownerId: string;
  publishedAt: number;
  updatedAt: number;
  coverColor?: string;
  hasCover?: boolean;
  epubFilename?: string;
}

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Generate a muted color from ownerId and bookHash
 */
function generateMutedColor(ownerId: string, bookHash: string): string {
  let ownerNum = 0;
  for (let i = 0; i < ownerId.length; i++) {
    ownerNum = ((ownerNum << 5) - ownerNum + ownerId.charCodeAt(i)) | 0;
  }
  const baseHue = Math.abs(ownerNum) % 360;

  let bookNum = 0;
  for (let i = 0; i < bookHash.length; i++) {
    bookNum = ((bookNum << 5) - bookNum + bookHash.charCodeAt(i)) | 0;
  }
  const variation = (Math.abs(bookNum) % 31) - 15;
  const hue = (baseHue + variation + 360) % 360;

  const saturation = 35 + (Math.abs(bookNum) % 11);
  const lightness = 28 + (Math.abs(bookNum) % 11);

  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hueToRgb(p, q, h + 1/3) * 255);
  const g = Math.round(hueToRgb(p, q, h) * 255);
  const b = Math.round(hueToRgb(p, q, h - 1/3) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * No-op for compatibility - Supabase doesn't need repo creation
 */
export async function ensureLibraryRepoExists(): Promise<void> {
  // No-op - Supabase buckets are created via SQL setup
}

/**
 * Get the public catalog entries from Supabase
 */
export async function getPublicCatalog(): Promise<ActionResult<StoreEntry[]>> {
  try {
    if (!isSupabaseConfigured()) {
      return { success: true, data: [] };
    }

    const { data, error } = await supabase!
      .from('books')
      .select('*')
      .order('published_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    // Transform to StoreEntry format
    const entries: StoreEntry[] = (data || []).map(book => ({
      projectId: book.project_id,
      bookHash: book.book_hash,
      title: book.title,
      author: book.author_name || '',
      description: book.description || '',
      ownerId: book.author_id || '',
      publishedAt: new Date(book.published_at).getTime(),
      updatedAt: new Date(book.updated_at).getTime(),
      coverColor: book.cover_color,
      hasCover: book.has_cover,
      epubFilename: book.epub_path?.split('/').pop(),
    }));

    return { success: true, data: entries };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to fetch catalog' };
  }
}

/**
 * Publish a book to the public catalog
 */
export async function publishToPublicCatalog(
  projectId: string,
  bookData: {
    hash: string;
    title: string;
    author: string;
    description?: string;
    coverThumbnailBase64?: string;
    epubFilename?: string;
  }
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    const googleId = (session.user as { id?: string }).id;
    if (!googleId) {
      return { success: false, error: 'User ID not found in session' };
    }

    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get user's UUID
    const user = await getSupabaseUserByGoogleId(googleId);
    if (!user) {
      return { success: false, error: 'User not found in Supabase' };
    }

    const now = new Date().toISOString();
    const epubFilename = bookData.epubFilename || 'manuscript.epub';
    const epubPath = `${googleId}/${projectId}/${epubFilename}`;

    // Check for existing entry
    const { data: existing } = await supabase!
      .from('books')
      .select('id, book_hash, has_cover, published_at')
      .eq('project_id', projectId)
      .single();

    // If existing entry has different hash and had cover, delete old cover
    if (existing && existing.has_cover && existing.book_hash !== bookData.hash) {
      await supabase!.storage
        .from('bookstore-covers')
        .remove([`${existing.book_hash}.jpg`]);
    }

    // Upload cover thumbnail if provided
    let hasCover = existing?.has_cover || false;
    if (bookData.coverThumbnailBase64) {
      try {
        const base64Data = bookData.coverThumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
        const coverBuffer = Buffer.from(base64Data, 'base64');

        const { error: coverError } = await supabase!.storage
          .from('bookstore-covers')
          .upload(`${bookData.hash}.jpg`, coverBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!coverError) {
          hasCover = true;
        }
      } catch (error) {
        console.error('Failed to upload cover thumbnail:', error);
      }
    }

    // Copy EPUB from author-files to bookstore-epubs
    const { data: epubData, error: downloadError } = await supabase!.storage
      .from('author-files')
      .download(epubPath);

    if (downloadError || !epubData) {
      return { success: false, error: 'EPUB file not found in project' };
    }

    const bookstoreEpubPath = `${bookData.hash}.epub`;
    const epubBuffer = await epubData.arrayBuffer();

    await supabase!.storage
      .from('bookstore-epubs')
      .upload(bookstoreEpubPath, epubBuffer, {
        contentType: 'application/epub+zip',
        upsert: true,
      });

    // Upsert book entry
    const bookRecord = {
      project_id: projectId,
      book_hash: bookData.hash,
      title: bookData.title,
      author_name: bookData.author,
      author_id: user.id,
      description: bookData.description || '',
      epub_path: bookstoreEpubPath,
      cover_color: generateMutedColor(googleId, bookData.hash),
      has_cover: hasCover,
      published_at: existing?.published_at || now,
      updated_at: now,
    };

    if (existing) {
      await supabase!
        .from('books')
        .update(bookRecord)
        .eq('id', existing.id);
    } else {
      await supabase!
        .from('books')
        .insert(bookRecord);
    }

    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to publish to catalog' };
  }
}

/**
 * Remove a book from the public catalog
 */
export async function removeFromPublicCatalog(projectId: string): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get the book entry first (to delete associated files)
    const { data: book } = await supabase!
      .from('books')
      .select('book_hash, has_cover')
      .eq('project_id', projectId)
      .single();

    if (!book) {
      return { success: true }; // Already gone
    }

    // Delete cover if it exists
    if (book.has_cover) {
      await supabase!.storage
        .from('bookstore-covers')
        .remove([`${book.book_hash}.jpg`]);
    }

    // Delete EPUB from bookstore
    await supabase!.storage
      .from('bookstore-epubs')
      .remove([`${book.book_hash}.epub`]);

    // Delete catalog entry
    await supabase!
      .from('books')
      .delete()
      .eq('project_id', projectId);

    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to remove from catalog' };
  }
}

/**
 * Import a book from the store
 * Returns the binary data for client-side IndexedDB storage
 */
export async function importBookFromStore(
  bookHash: string
): Promise<ActionResult<{
  epubDataBase64: string;
  filename: string;
  title: string;
  author: string;
}>> {
  try {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get book from catalog
    const { data: book, error: bookError } = await supabase!
      .from('books')
      .select('title, author_name, epub_path')
      .eq('book_hash', bookHash)
      .single();

    if (bookError || !book) {
      return { success: false, error: 'Book not found in catalog' };
    }

    // Download EPUB from public bucket
    const { data: epubData, error: downloadError } = await supabase!.storage
      .from('bookstore-epubs')
      .download(`${bookHash}.epub`);

    if (downloadError || !epubData) {
      return { success: false, error: 'Failed to download EPUB' };
    }

    const arrayBuffer = await epubData.arrayBuffer();
    const epubDataBase64 = Buffer.from(arrayBuffer).toString('base64');

    return {
      success: true,
      data: {
        epubDataBase64,
        filename: book.epub_path?.split('/').pop() || 'manuscript.epub',
        title: book.title,
        author: book.author_name || '',
      },
    };
  } catch (error: unknown) {
    console.error('Import book error:', error);
    return { success: false, error: 'Failed to import book. It may have been removed by the author.' };
  }
}
