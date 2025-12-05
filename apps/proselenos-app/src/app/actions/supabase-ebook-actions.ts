'use server';

/**
 * Supabase Ebook Server Actions
 *
 * All Supabase operations for private ebook backup/restore.
 * These actions are called from client hooks but run on the server.
 *
 * Storage structure:
 *   private-ebooks/{google_id}/{book_hash}/
 *     - {title}.epub
 *     - config.json
 *     - cover.png (optional)
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// ============================================
// Types
// ============================================

interface UploadResult {
  success: boolean;
  error?: string;
}

interface UserEbook {
  id: string;
  bookHash: string;
  title: string | null;
  authorName: string | null;
  uploadedAt: string;
}

interface ListResult {
  success: boolean;
  ebooks?: UserEbook[];
  error?: string;
}

interface DownloadResult {
  success: boolean;
  epubBase64?: string;
  epubFilename?: string;
  configJson?: string;
  coverBase64?: string | null;
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

// ============================================
// Upload Actions
// ============================================

/**
 * Upload an ebook and its config to Supabase Storage
 *
 * @param bookHash - Unique book identifier (md5 hash)
 * @param title - Book title (used in filename)
 * @param authorName - Book author
 * @param epubBase64 - EPUB file as base64 string
 * @param configJson - config.json content as string
 * @param coverBase64 - Cover image as base64 string (optional)
 */
export async function uploadEbookToSupabase(
  bookHash: string,
  title: string,
  authorName: string,
  epubBase64: string,
  configJson: string,
  coverBase64?: string | null
): Promise<UploadResult> {
  try {
    // Check if Supabase is configured
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    // Get authenticated user
    const googleId = await getSessionUserId();
    if (!googleId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Get user's UUID from users table
    const userUuid = await getUserUuid(googleId);
    if (!userUuid) {
      return { success: false, error: 'User not found in database' };
    }

    // Storage path: private-ebooks/{google_id}/{book_hash}/
    const basePath = `${googleId}/${bookHash}`;

    // Convert base64 to Uint8Array for upload
    const epubBuffer = Buffer.from(epubBase64, 'base64');

    // Create a safe filename from title
    const safeTitle = title.replace(/[^a-zA-Z0-9-_. ]/g, '_').substring(0, 100);
    const epubFilename = `${safeTitle}.epub`;

    // Upload EPUB file
    const { error: epubError } = await supabase.storage
      .from('private-ebooks')
      .upload(`${basePath}/${epubFilename}`, epubBuffer, {
        contentType: 'application/epub+zip',
        upsert: true,
      });

    if (epubError) {
      console.error('Failed to upload EPUB:', epubError);
      return { success: false, error: `Failed to upload EPUB: ${epubError.message}` };
    }

    // Upload config.json
    const { error: configError } = await supabase.storage
      .from('private-ebooks')
      .upload(`${basePath}/config.json`, configJson, {
        contentType: 'application/json',
        upsert: true,
      });

    if (configError) {
      console.error('Failed to upload config:', configError);
      return { success: false, error: `Failed to upload config: ${configError.message}` };
    }

    // Upload cover if provided
    if (coverBase64) {
      const coverBuffer = Buffer.from(coverBase64, 'base64');
      const { error: coverError } = await supabase.storage
        .from('private-ebooks')
        .upload(`${basePath}/cover.png`, coverBuffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (coverError) {
        // Log but don't fail - cover is optional
        console.error('Failed to upload cover:', coverError);
      }
    }

    // Upsert metadata to user_ebooks table
    const { error: dbError } = await supabase.from('user_ebooks').upsert(
      {
        user_id: userUuid,
        book_hash: bookHash,
        title: title,
        author_name: authorName,
        uploaded_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,book_hash' }
    );

    if (dbError) {
      console.error('Failed to update user_ebooks:', dbError);
      // Don't fail - files are uploaded, metadata is secondary
    }

    console.log(`Successfully uploaded ${title} to Supabase Storage`);
    return { success: true };
  } catch (error) {
    console.error('Upload error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// List Actions
// ============================================

/**
 * List all ebooks backed up by the current user
 */
export async function listUserEbooks(): Promise<ListResult> {
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

    const { data, error } = await supabase
      .from('user_ebooks')
      .select('id, book_hash, title, author_name, uploaded_at')
      .eq('user_id', userUuid)
      .order('uploaded_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const ebooks: UserEbook[] = (data || []).map((row) => ({
      id: row.id,
      bookHash: row.book_hash,
      title: row.title,
      authorName: row.author_name,
      uploadedAt: row.uploaded_at,
    }));

    return { success: true, ebooks };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// Download Actions
// ============================================

/**
 * Download an ebook from Supabase Storage
 *
 * @param bookHash - Unique book identifier
 */
export async function downloadUserEbook(bookHash: string): Promise<DownloadResult> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const googleId = await getSessionUserId();
    if (!googleId) {
      return { success: false, error: 'Not authenticated' };
    }

    const basePath = `${googleId}/${bookHash}`;

    // List files in the book's folder to find the epub filename
    const { data: files, error: listError } = await supabase.storage
      .from('private-ebooks')
      .list(basePath);

    if (listError || !files) {
      return { success: false, error: 'Failed to list files' };
    }

    // Find the epub file
    const epubFile = files.find((f) => f.name.endsWith('.epub'));
    if (!epubFile) {
      return { success: false, error: 'EPUB file not found' };
    }

    // Download EPUB
    const { data: epubData, error: epubError } = await supabase.storage
      .from('private-ebooks')
      .download(`${basePath}/${epubFile.name}`);

    if (epubError || !epubData) {
      return { success: false, error: 'Failed to download EPUB' };
    }

    const epubArrayBuffer = await epubData.arrayBuffer();
    const epubBase64 = Buffer.from(epubArrayBuffer).toString('base64');

    // Download config.json
    const { data: configData, error: configError } = await supabase.storage
      .from('private-ebooks')
      .download(`${basePath}/config.json`);

    let configJson: string | undefined;
    if (!configError && configData) {
      configJson = await configData.text();
    }

    // Try to download cover (optional)
    let coverBase64: string | null = null;
    const { data: coverData, error: coverError } = await supabase.storage
      .from('private-ebooks')
      .download(`${basePath}/cover.png`);

    if (!coverError && coverData) {
      const coverArrayBuffer = await coverData.arrayBuffer();
      coverBase64 = Buffer.from(coverArrayBuffer).toString('base64');
    }

    return {
      success: true,
      epubBase64,
      epubFilename: epubFile.name,
      configJson,
      coverBase64,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete an ebook from Supabase Storage
 *
 * @param bookHash - Unique book identifier
 */
export async function deleteUserEbook(bookHash: string): Promise<UploadResult> {
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

    const basePath = `${googleId}/${bookHash}`;

    // List and delete all files in the folder
    const { data: files } = await supabase.storage.from('private-ebooks').list(basePath);

    if (files && files.length > 0) {
      const filePaths = files.map((f) => `${basePath}/${f.name}`);
      await supabase.storage.from('private-ebooks').remove(filePaths);
    }

    // Delete from user_ebooks table
    await supabase.from('user_ebooks').delete().eq('user_id', userUuid).eq('book_hash', bookHash);

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
