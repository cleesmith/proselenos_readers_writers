'use server';

/**
 * Ebook Server Actions
 *
 * Supabase operations for private ebook backup/restore.
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

interface SignedUrlData {
  signedUrl: string;
  path: string;
  token: string;
}

interface SignedUrlResult {
  success: boolean;
  urls?: {
    epub: SignedUrlData;
    config: SignedUrlData;
    cover?: SignedUrlData;
  };
  error?: string;
}

interface ConfirmResult {
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

// ============================================
// Upload Actions (Direct Client Upload via Signed URLs)
// ============================================

/**
 * Create signed upload URLs for direct client-to-Supabase uploads.
 * This bypasses Vercel's 4.5MB serverless function limit by allowing
 * the client to upload directly to Supabase Storage.
 *
 * @param bookHash - Unique book identifier (md5 hash)
 * @param epubFilename - Sanitized EPUB filename (e.g., "My_Book.epub")
 * @param includeCover - Whether to generate a signed URL for cover upload
 */
export async function createSignedUploadUrls(
  bookHash: string,
  epubFilename: string,
  includeCover: boolean
): Promise<SignedUrlResult> {
  console.log('[createSignedUploadUrls] Generating signed URLs for direct upload...');
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const googleId = await getSessionUserId();
    if (!googleId) {
      return { success: false, error: 'Not authenticated' };
    }

    // Storage path: private-ebooks/{google_id}/{book_hash}/
    const basePath = `${googleId}/${bookHash}`;

    // Generate signed URL for EPUB
    const epubPath = `${basePath}/${epubFilename}`;
    const { data: epubData, error: epubError } = await supabase.storage
      .from('private-ebooks')
      .createSignedUploadUrl(epubPath);

    if (epubError || !epubData) {
      console.error('Failed to create signed URL for EPUB:', epubError);
      return { success: false, error: `Failed to create upload URL: ${epubError?.message}` };
    }

    // Generate signed URL for config.json
    const configPath = `${basePath}/config.json`;
    const { data: configData, error: configError } = await supabase.storage
      .from('private-ebooks')
      .createSignedUploadUrl(configPath);

    if (configError || !configData) {
      console.error('Failed to create signed URL for config:', configError);
      return { success: false, error: `Failed to create upload URL: ${configError?.message}` };
    }

    // Generate signed URL for cover if requested
    let coverData: SignedUrlData | undefined;
    if (includeCover) {
      const coverPath = `${basePath}/cover.png`;
      const { data, error } = await supabase.storage
        .from('private-ebooks')
        .createSignedUploadUrl(coverPath);

      if (!error && data) {
        coverData = {
          signedUrl: data.signedUrl,
          path: data.path,
          token: data.token,
        };
      }
      // Cover URL failure is not fatal
    }

    return {
      success: true,
      urls: {
        epub: {
          signedUrl: epubData.signedUrl,
          path: epubData.path,
          token: epubData.token,
        },
        config: {
          signedUrl: configData.signedUrl,
          path: configData.path,
          token: configData.token,
        },
        cover: coverData,
      },
    };
  } catch (error) {
    console.error('Error creating signed upload URLs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Confirm ebook upload by updating metadata in user_ebooks table.
 * Called after successful direct upload to Supabase Storage.
 *
 * @param bookHash - Unique book identifier (md5 hash)
 * @param title - Book title
 * @param authorName - Book author
 */
export async function confirmEbookUpload(
  bookHash: string,
  title: string,
  authorName: string
): Promise<ConfirmResult> {
  console.log(`[confirmEbookUpload] Confirming upload for "${title}"...`);
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
      return { success: false, error: `Failed to confirm upload: ${dbError.message}` };
    }

    console.log(`Confirmed upload of ${title} to Private Ebooks`);
    return { success: true };
  } catch (error) {
    console.error('Error confirming upload:', error);
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

/**
 * Delete ALL ebooks from Supabase Storage for the current user
 * Used for "Reset Library" feature
 */
export async function clearAllUserEbooks(): Promise<UploadResult> {
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

    // List all book folders for this user
    const { data: folders } = await supabase.storage.from('private-ebooks').list(googleId);

    if (folders && folders.length > 0) {
      // For each folder (book), delete all files inside
      for (const folder of folders) {
        if (!folder.name || folder.name === '.emptyFolderPlaceholder') continue;

        const folderPath = `${googleId}/${folder.name}`;
        const { data: files } = await supabase.storage.from('private-ebooks').list(folderPath);

        if (files && files.length > 0) {
          const filePaths = files.map((f) => `${folderPath}/${f.name}`);
          await supabase.storage.from('private-ebooks').remove(filePaths);
        }
      }
    }

    // Delete all records from user_ebooks table for this user
    await supabase.from('user_ebooks').delete().eq('user_id', userUuid);

    console.log(`Cleared all Private Ebooks for user ${googleId}`);
    return { success: true };
  } catch (error) {
    console.error('Error clearing user ebooks:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
