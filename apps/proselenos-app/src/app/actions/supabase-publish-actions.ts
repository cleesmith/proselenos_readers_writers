'use server';

/**
 * Supabase Bookstore Server Actions
 *
 * All Supabase operations for the public bookstore.
 * These actions handle publishing, catalog, and download.
 *
 * Storage structure:
 *   bookstore-epubs/{book_hash}.epub    - Public EPUB files
 *   bookstore-covers/{book_hash}.jpg    - Public cover thumbnails
 *
 * Database:
 *   books table - catalog of published books (project_id is unique)
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ============================================
// Types
// ============================================

interface ActionResult {
  success: boolean;
  error?: string;
}

export interface BookstoreEntry {
  projectId: string;
  bookHash: string;
  title: string;
  author: string;
  description: string;
  publishedAt: number;
  updatedAt: number;
  coverColor: string;
  hasCover: boolean;
}

interface CatalogResult {
  success: boolean;
  books?: BookstoreEntry[];
  error?: string;
}

interface ImportResult {
  success: boolean;
  epubBase64?: string;
  filename?: string;
  title?: string;
  author?: string;
  error?: string;
}

interface SignedUrlData {
  signedUrl: string;
  path: string;
  token: string;
}

interface PublishSignedUrlResult {
  success: boolean;
  urls?: {
    epub: SignedUrlData;
    cover?: SignedUrlData;
  };
  oldBookHash?: string;
  hadCover?: boolean;
  error?: string;
}

interface ConfirmPublishResult {
  success: boolean;
  error?: string;
}

// ============================================
// Helper Functions
// ============================================

async function getSessionUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user?.id || null;
}

async function getUserUuid(googleId: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('google_id', googleId)
    .single();

  if (error || !data) {
    console.error('Failed to get user UUID:', error);
    return null;
  }

  return data.id;
}

/**
 * Generate a muted color from ownerId and bookHash
 * Same author's books get similar colors (same hue family)
 * Different books by same author get slight variations
 */
function generateMutedColor(ownerId: string, bookHash: string): string {
  // Author's base hue from Google ID
  let ownerNum = 0;
  for (let i = 0; i < ownerId.length; i++) {
    ownerNum = ((ownerNum << 5) - ownerNum + ownerId.charCodeAt(i)) | 0;
  }
  const baseHue = Math.abs(ownerNum) % 360;

  // Book variation from hash (±15°)
  let bookNum = 0;
  for (let i = 0; i < bookHash.length; i++) {
    bookNum = ((bookNum << 5) - bookNum + bookHash.charCodeAt(i)) | 0;
  }
  const variation = (Math.abs(bookNum) % 31) - 15;
  const hue = (baseHue + variation + 360) % 360;

  // Saturation: 35-45% (muted)
  const saturation = 35 + (Math.abs(bookNum) % 11);
  // Lightness: 28-38% (dark enough for white text)
  const lightness = 28 + (Math.abs(bookNum) % 11);

  // Convert HSL to hex
  const h = hue / 360;
  const s = saturation / 100;
  const l = lightness / 100;

  const hueToRgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hueToRgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hueToRgb(p, q, h) * 255);
  const b = Math.round(hueToRgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

// ============================================
// Publish Actions (Direct Upload via Signed URLs)
// ============================================

/**
 * Create signed upload URLs for direct client-to-Supabase publish.
 * Bypasses Vercel's 4.5MB serverless function limit.
 *
 * Also handles cleanup of old files if book hash changed.
 *
 * @param projectId - Stable project identifier
 * @param bookHash - New book hash
 * @param includeCover - Whether to generate cover upload URL
 */
export async function createSignedUploadUrlsForPublish(
  projectId: string,
  bookHash: string,
  includeCover: boolean
): Promise<PublishSignedUrlResult> {
  console.log(`[createSignedUploadUrlsForPublish] Generating signed URLs for bookstore publish...`);

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const googleId = await getSessionUserId();
    if (!googleId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if book already exists for this project
    const { data: existingBook } = await supabase
      .from('books')
      .select('book_hash, has_cover')
      .eq('project_id', projectId)
      .single();

    const oldBookHash = existingBook?.book_hash;
    const hadCover = existingBook?.has_cover;

    // If book hash changed, clean up old files
    if (oldBookHash && oldBookHash !== bookHash) {
      // Delete old EPUB
      await supabase.storage
        .from('bookstore-epubs')
        .remove([`${oldBookHash}.epub`]);

      // Delete old cover if it existed
      if (hadCover) {
        await supabase.storage
          .from('bookstore-covers')
          .remove([`${oldBookHash}.jpg`]);
      }
    }

    // Generate signed URL for EPUB
    const epubPath = `${bookHash}.epub`;
    const { data: epubData, error: epubError } = await supabase.storage
      .from('bookstore-epubs')
      .createSignedUploadUrl(epubPath);

    if (epubError || !epubData) {
      console.error('Failed to create signed URL for EPUB:', epubError);
      return { success: false, error: `Failed to create upload URL: ${epubError?.message}` };
    }

    // Generate signed URL for cover if requested
    let coverData: SignedUrlData | undefined;
    if (includeCover) {
      const coverPath = `${bookHash}.jpg`;
      const { data, error } = await supabase.storage
        .from('bookstore-covers')
        .createSignedUploadUrl(coverPath);

      if (!error && data) {
        coverData = {
          signedUrl: data.signedUrl,
          path: data.path,
          token: data.token,
        };
      }
    }

    return {
      success: true,
      urls: {
        epub: {
          signedUrl: epubData.signedUrl,
          path: epubData.path,
          token: epubData.token,
        },
        cover: coverData,
      },
      oldBookHash,
      hadCover,
    };
  } catch (error) {
    console.error('Error creating signed upload URLs for publish:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Confirm bookstore publish by updating the books table.
 * Called after successful direct upload to Supabase Storage.
 *
 * @param projectId - Stable project identifier
 * @param bookData - Book metadata
 */
export async function confirmBookstorePublish(
  projectId: string,
  bookData: {
    hash: string;
    title: string;
    author: string;
    description?: string;
    hasCover: boolean;
  }
): Promise<ConfirmPublishResult> {
  console.log(`[confirmBookstorePublish] Confirming publish for "${bookData.title}"...`);

  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const googleId = await getSessionUserId();
    if (!googleId) {
      return { success: false, error: 'Not authenticated' };
    }

    const userUuid = await getUserUuid(googleId);
    if (!userUuid) {
      return { success: false, error: 'User not found in database' };
    }

    // Check if this is an update or new publish
    const { data: existingBook } = await supabase
      .from('books')
      .select('book_hash, has_cover')
      .eq('project_id', projectId)
      .single();

    const now = new Date().toISOString();
    const coverColor = generateMutedColor(googleId, bookData.hash);
    const epubPath = `${bookData.hash}.epub`;

    // Upsert book record
    const { error: dbError } = await supabase.from('books').upsert(
      {
        project_id: projectId,
        book_hash: bookData.hash,
        title: bookData.title,
        author_name: bookData.author,
        author_id: userUuid,
        description: bookData.description || '',
        epub_path: epubPath,
        cover_color: coverColor,
        has_cover: bookData.hasCover || (existingBook?.has_cover && bookData.hash === existingBook?.book_hash),
        updated_at: now,
        // Only set published_at for new entries
        ...(existingBook ? {} : { published_at: now }),
      },
      { onConflict: 'project_id' }
    );

    if (dbError) {
      console.error('Failed to update books table:', dbError);
      return { success: false, error: `Failed to update catalog: ${dbError.message}` };
    }

    console.log(`Successfully published "${bookData.title}" to Supabase bookstore`);
    return { success: true };
  } catch (error) {
    console.error('Confirm publish error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Legacy Publish Action (kept for compatibility)
// ============================================

/**
 * Publish a book to the Supabase bookstore
 * @deprecated Use createSignedUploadUrlsForPublish + confirmBookstorePublish for large files
 *
 * @param projectId - Stable project identifier (unique per author)
 * @param bookData - Book metadata and content
 */
export async function publishToSupabaseBookstore(
  projectId: string,
  bookData: {
    hash: string;
    title: string;
    author: string;
    description?: string;
    epubBase64: string;
    coverThumbnailBase64?: string;
  }
): Promise<ActionResult> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const googleId = await getSessionUserId();
    if (!googleId) {
      return { success: false, error: 'Not authenticated' };
    }

    const userUuid = await getUserUuid(googleId);
    if (!userUuid) {
      return { success: false, error: 'User not found in database' };
    }

    // Check if book already exists for this project
    const { data: existingBook } = await supabase
      .from('books')
      .select('book_hash, has_cover')
      .eq('project_id', projectId)
      .single();

    const oldBookHash = existingBook?.book_hash;
    const hadCover = existingBook?.has_cover;

    // If book hash changed and had a cover, delete old cover
    if (oldBookHash && oldBookHash !== bookData.hash && hadCover) {
      await supabase.storage
        .from('bookstore-covers')
        .remove([`${oldBookHash}.jpg`]);
    }

    // If book hash changed, delete old EPUB
    if (oldBookHash && oldBookHash !== bookData.hash) {
      await supabase.storage
        .from('bookstore-epubs')
        .remove([`${oldBookHash}.epub`]);
    }

    // Upload EPUB to public storage
    const epubBuffer = Buffer.from(bookData.epubBase64, 'base64');
    const epubPath = `${bookData.hash}.epub`;

    const { error: epubError } = await supabase.storage
      .from('bookstore-epubs')
      .upload(epubPath, epubBuffer, {
        contentType: 'application/epub+zip',
        upsert: true,
      });

    if (epubError) {
      console.error('Failed to upload EPUB:', epubError);
      return { success: false, error: `Failed to upload EPUB: ${epubError.message}` };
    }

    // Upload cover thumbnail if provided
    let hasCover = false;
    if (bookData.coverThumbnailBase64) {
      // Remove data URL prefix if present
      const base64Data = bookData.coverThumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
      const coverBuffer = Buffer.from(base64Data, 'base64');
      const coverPath = `${bookData.hash}.jpg`;

      const { error: coverError } = await supabase.storage
        .from('bookstore-covers')
        .upload(coverPath, coverBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (coverError) {
        console.error('Failed to upload cover:', coverError);
        // Continue without cover - not a fatal error
      } else {
        hasCover = true;
      }
    }

    const now = new Date().toISOString();
    const coverColor = generateMutedColor(googleId, bookData.hash);

    // Upsert book record
    const { error: dbError } = await supabase.from('books').upsert(
      {
        project_id: projectId,
        book_hash: bookData.hash,
        title: bookData.title,
        author_name: bookData.author,
        author_id: userUuid,
        description: bookData.description || '',
        epub_path: epubPath,
        cover_color: coverColor,
        has_cover: hasCover || (existingBook?.has_cover && bookData.hash === oldBookHash),
        updated_at: now,
        // Only set published_at for new entries
        ...(existingBook ? {} : { published_at: now }),
      },
      { onConflict: 'project_id' }
    );

    if (dbError) {
      console.error('Failed to update books table:', dbError);
      return { success: false, error: `Failed to update catalog: ${dbError.message}` };
    }

    console.log(`Successfully published "${bookData.title}" to Supabase bookstore`);
    return { success: true };
  } catch (error) {
    console.error('Publish error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Remove a book from the Supabase bookstore
 *
 * @param projectId - Stable project identifier
 */
export async function removeFromSupabaseBookstore(projectId: string): Promise<ActionResult> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const googleId = await getSessionUserId();
    if (!googleId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get book info before deleting
    const { data: book } = await supabase
      .from('books')
      .select('book_hash, has_cover, author_id')
      .eq('project_id', projectId)
      .single();

    if (!book) {
      // Book doesn't exist, nothing to remove
      return { success: true };
    }

    // Verify ownership
    const userUuid = await getUserUuid(googleId);
    if (book.author_id !== userUuid) {
      return { success: false, error: 'Not authorized to remove this book' };
    }

    // Delete EPUB from storage
    await supabase.storage
      .from('bookstore-epubs')
      .remove([`${book.book_hash}.epub`]);

    // Delete cover if exists
    if (book.has_cover) {
      await supabase.storage
        .from('bookstore-covers')
        .remove([`${book.book_hash}.jpg`]);
    }

    // Delete from books table
    const { error: dbError } = await supabase
      .from('books')
      .delete()
      .eq('project_id', projectId);

    if (dbError) {
      console.error('Failed to delete from books table:', dbError);
      return { success: false, error: dbError.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Remove error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Catalog Actions
// ============================================

/**
 * Get the public bookstore catalog
 * No authentication required - this is public data
 */
export async function getSupabaseCatalog(): Promise<CatalogResult> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const { data, error } = await supabase
      .from('books')
      .select('project_id, book_hash, title, author_name, description, published_at, updated_at, cover_color, has_cover')
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch catalog:', error);
      return { success: false, error: error.message };
    }

    const books: BookstoreEntry[] = (data || []).map((row) => ({
      projectId: row.project_id,
      bookHash: row.book_hash,
      title: row.title,
      author: row.author_name || 'Unknown Author',
      description: row.description || '',
      publishedAt: new Date(row.published_at).getTime(),
      updatedAt: new Date(row.updated_at).getTime(),
      coverColor: row.cover_color || '#4a5568',
      hasCover: row.has_cover || false,
    }));

    return { success: true, books };
  } catch (error) {
    console.error('Catalog error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Import Actions
// ============================================

/**
 * Import a book from the bookstore (download EPUB)
 * No authentication required - bookstore is public
 *
 * @param bookHash - Book hash for file lookup
 */
export async function importBookFromSupabase(bookHash: string): Promise<ImportResult> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get book metadata from catalog
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('title, author_name')
      .eq('book_hash', bookHash)
      .single();

    if (bookError || !book) {
      return { success: false, error: 'Book not found in catalog' };
    }

    // Download EPUB from public storage
    const { data: epubData, error: epubError } = await supabase.storage
      .from('bookstore-epubs')
      .download(`${bookHash}.epub`);

    if (epubError || !epubData) {
      console.error('Failed to download EPUB:', epubError);
      return { success: false, error: 'Failed to download EPUB. It may have been removed.' };
    }

    const epubArrayBuffer = await epubData.arrayBuffer();
    const epubBase64 = Buffer.from(epubArrayBuffer).toString('base64');

    return {
      success: true,
      epubBase64,
      filename: `${book.title}.epub`,
      title: book.title,
      author: book.author_name || 'Unknown Author',
    };
  } catch (error) {
    console.error('Import error:', error);
    return {
      success: false,
      error: 'Failed to import book. It may have been removed by the author.',
    };
  }
}

