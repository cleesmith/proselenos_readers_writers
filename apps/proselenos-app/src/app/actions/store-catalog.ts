'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { createGitHubClient, getGitHubOwner } from '@/lib/github-storage';
import type { Octokit } from '@octokit/rest';

const LIBRARY_REPO = 'proselenos-bookstore';
const CATALOG_FILE = 'catalog.json';

export interface StoreEntry {
  projectId: string;  // stable identifier (project folder name)
  bookHash: string;   // for file reference (may change on regeneration)
  title: string;
  author: string;
  description: string;
  ownerRepo: string;  // e.g. "101441964303966098868_proselenosebooks"
  ownerId: string;
  publishedAt: number;
  updatedAt: number;
  coverColor?: string;  // muted background color for cover, e.g. "#4a5568"
  hasCover?: boolean;   // true if cover thumbnail exists at covers/{bookHash}.jpg
  epubFilename?: string;  // undefined defaults to 'manuscript.epub'
}

// Catalog is just an array of StoreEntry

interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
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
 * Ensure the proselenos-library repo exists (private)
 * Exported so it can be called during app initialization
 */
export async function ensureLibraryRepoExists(): Promise<void> {
  const octokit = createGitHubClient();
  const owner = getGitHubOwner();
  await ensureLibraryRepoExistsInternal(octokit, owner);
}

async function ensureLibraryRepoExistsInternal(octokit: Octokit, owner: string): Promise<void> {
  try {
    await octokit.repos.get({ owner, repo: LIBRARY_REPO });
  } catch (error: unknown) {
    const octokitError = error as { status?: number };
    if (octokitError.status === 404) {
      await octokit.repos.createForAuthenticatedUser({
        name: LIBRARY_REPO,
        description: 'Public book catalog for Proselenos Bookstore',
        private: false,  // PUBLIC for raw.githubusercontent.com access
        auto_init: true,
      });
    } else {
      throw error;
    }
  }
}

/**
 * Get the public catalog entries
 */
export async function getPublicCatalog(): Promise<ActionResult<StoreEntry[]>> {
  try {
    const octokit = createGitHubClient();
    const owner = getGitHubOwner();

    const response = await octokit.repos.getContent({
      owner,
      repo: LIBRARY_REPO,
      path: CATALOG_FILE,
    });

    if ('content' in response.data && typeof response.data.content === 'string') {
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      const parsed = JSON.parse(content);
      // Handle both old format {version, entries} and new format (plain array)
      const entries: StoreEntry[] = Array.isArray(parsed) ? parsed : (parsed.entries || []);
      return { success: true, data: entries };
    }

    return { success: true, data: [] };
  } catch (error: unknown) {
    const octokitError = error as { status?: number; message?: string };
    // 404 means repo or file doesn't exist yet - return empty
    if (octokitError.status === 404) {
      return { success: true, data: [] };
    }
    return { success: false, error: octokitError.message || 'Failed to fetch catalog' };
  }
}

/**
 * Publish a book to the public catalog
 * @param coverThumbnailBase64 - Optional cover thumbnail as base64 data URL (will be uploaded to covers/{bookHash}.jpg)
 */
export async function publishToPublicCatalog(
  projectId: string,
  bookData: {
    hash: string;
    title: string;
    author: string;
    description?: string;
    coverThumbnailBase64?: string;
    epubFilename?: string;  // undefined defaults to 'manuscript.epub'
  }
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    const userId = (session.user as { id?: string }).id;
    if (!userId) {
      return { success: false, error: 'User ID not found in session' };
    }

    const userRepo = `${userId}_proselenos`;

    const octokit = createGitHubClient();
    const owner = getGitHubOwner();

    // Ensure library repo exists
    await ensureLibraryRepoExistsInternal(octokit, owner);

    // Fetch existing catalog (or create empty)
    let entries: StoreEntry[] = [];
    let existingSha: string | undefined;

    try {
      const response = await octokit.repos.getContent({
        owner,
        repo: LIBRARY_REPO,
        path: CATALOG_FILE,
      });

      if ('content' in response.data && 'sha' in response.data) {
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        const parsed = JSON.parse(content);
        // Handle both old format {version, entries} and new format (plain array)
        entries = Array.isArray(parsed) ? parsed : (parsed.entries || []);
        existingSha = response.data.sha;
      }
    } catch (error: unknown) {
      const octokitError = error as { status?: number };
      if (octokitError.status !== 404) throw error;
      // 404 is fine - we'll create the file
    }

    const now = Date.now();
    const existingEntry = entries.find(e => e.projectId === projectId);

    // If existing entry has a different bookHash and had a cover, delete the old cover
    // This prevents orphaned cover files from accumulating when covers are updated
    if (existingEntry && existingEntry.hasCover && existingEntry.bookHash !== bookData.hash) {
      try {
        const oldCoverPath = `covers/${existingEntry.bookHash}.jpg`;
        const oldCoverResponse = await octokit.repos.getContent({
          owner,
          repo: LIBRARY_REPO,
          path: oldCoverPath,
        });
        if ('sha' in oldCoverResponse.data) {
          await octokit.repos.deleteFile({
            owner,
            repo: LIBRARY_REPO,
            path: oldCoverPath,
            message: `Remove old cover: ${existingEntry.title}`,
            sha: oldCoverResponse.data.sha,
          });
        }
      } catch {
        // Old cover doesn't exist or couldn't be deleted - continue anyway
      }
    }

    // Upload cover thumbnail if provided
    let hasCover = false;
    if (bookData.coverThumbnailBase64) {
      try {
        // Remove data URL prefix if present
        const base64Data = bookData.coverThumbnailBase64.replace(/^data:image\/\w+;base64,/, '');
        const coverPath = `covers/${bookData.hash}.jpg`;

        // Check if cover already exists (to get SHA for update)
        let coverSha: string | undefined;
        try {
          const existingCover = await octokit.repos.getContent({
            owner,
            repo: LIBRARY_REPO,
            path: coverPath,
          });
          if ('sha' in existingCover.data) {
            coverSha = existingCover.data.sha;
          }
        } catch {
          // Cover doesn't exist yet, that's fine
        }

        // Upload cover thumbnail
        await octokit.repos.createOrUpdateFileContents({
          owner,
          repo: LIBRARY_REPO,
          path: coverPath,
          message: `Add cover: ${bookData.title}`,
          content: base64Data,
          sha: coverSha,
        });

        hasCover = true;
      } catch (error) {
        console.error('Failed to upload cover thumbnail:', error);
        // Continue without cover - not a fatal error
      }
    }

    const entry: StoreEntry = {
      projectId,
      bookHash: bookData.hash,
      title: bookData.title,
      author: bookData.author,
      description: bookData.description || '',
      ownerRepo: userRepo,
      ownerId: userId,
      publishedAt: existingEntry ? existingEntry.publishedAt : now,
      updatedAt: now,
      coverColor: generateMutedColor(userId, bookData.hash),
      hasCover: hasCover || existingEntry?.hasCover,
      epubFilename: bookData.epubFilename,
    };

    if (existingEntry) {
      const existingIndex = entries.indexOf(existingEntry);
      entries[existingIndex] = entry;
    } else {
      entries.push(entry);
    }

    // Sort by publishedAt descending (newest first)
    entries.sort((a, b) => b.publishedAt - a.publishedAt);

    // Write updated catalog (as plain array)
    const jsonContent = JSON.stringify(entries, null, 2);
    const contentBase64 = Buffer.from(jsonContent).toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: LIBRARY_REPO,
      path: CATALOG_FILE,
      message: `Update catalog: ${bookData.title}`,
      content: contentBase64,
      sha: existingSha,
    });

    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to publish to catalog' };
  }
}

/**
 * Remove a book from the public catalog by projectId
 */
export async function removeFromPublicCatalog(
  projectId: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, error: 'Not authenticated' };
    }

    const octokit = createGitHubClient();
    const owner = getGitHubOwner();

    // Fetch existing catalog
    let entries: StoreEntry[] = [];
    let existingSha: string | undefined;

    try {
      const response = await octokit.repos.getContent({
        owner,
        repo: LIBRARY_REPO,
        path: CATALOG_FILE,
      });

      if ('content' in response.data && 'sha' in response.data) {
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        const parsed = JSON.parse(content);
        entries = Array.isArray(parsed) ? parsed : (parsed.entries || []);
        existingSha = response.data.sha;
      }
    } catch (error: unknown) {
      const octokitError = error as { status?: number };
      if (octokitError.status === 404) {
        // No catalog exists, nothing to remove
        return { success: true };
      }
      throw error;
    }

    // Find and remove entry by projectId
    const existingIndex = entries.findIndex(e => e.projectId === projectId);
    if (existingIndex === -1) {
      // Entry doesn't exist, nothing to remove
      return { success: true };
    }

    const removedEntry = entries[existingIndex];
    const removedTitle = removedEntry?.title || 'Unknown';
    entries.splice(existingIndex, 1);

    // Delete the cover file if it exists
    if (removedEntry?.hasCover && removedEntry?.bookHash) {
      try {
        const coverPath = `covers/${removedEntry.bookHash}.jpg`;
        const coverResponse = await octokit.repos.getContent({
          owner,
          repo: LIBRARY_REPO,
          path: coverPath,
        });
        if ('sha' in coverResponse.data) {
          await octokit.repos.deleteFile({
            owner,
            repo: LIBRARY_REPO,
            path: coverPath,
            message: `Remove cover: ${removedTitle}`,
            sha: coverResponse.data.sha,
          });
        }
      } catch {
        // Cover doesn't exist or couldn't be deleted - continue anyway
      }
    }

    // Write updated catalog
    const jsonContent = JSON.stringify(entries, null, 2);
    const contentBase64 = Buffer.from(jsonContent).toString('base64');

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: LIBRARY_REPO,
      path: CATALOG_FILE,
      message: `Remove from catalog: ${removedTitle}`,
      content: contentBase64,
      sha: existingSha,
    });

    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to remove from catalog' };
  }
}

/**
 * Import a book from the store - fetches epub binary from author's repo
 * Returns the binary data for client-side IndexedDB storage
 * No authentication required - anyone can import books from the store
 */
export async function importBookFromStore(
  bookHash: string
): Promise<ActionResult<{
  epubData: ArrayBuffer;
  filename: string;
  title: string;
  author: string;
}>> {
  try {
    // Get catalog to find the book
    const catalogResult = await getPublicCatalog();
    if (!catalogResult.success || !catalogResult.data) {
      return { success: false, error: 'Failed to fetch catalog' };
    }

    const entry = catalogResult.data.find(e => e.bookHash === bookHash);
    if (!entry) {
      return { success: false, error: 'Book not found in catalog' };
    }

    const octokit = createGitHubClient();
    const owner = getGitHubOwner();

    // Fetch epub directly from author's repo
    // Path pattern: {projectId}/{epubFilename} (defaults to manuscript.epub)
    const epubFilename = entry.epubFilename || 'manuscript.epub';
    const epubPath = `${entry.projectId}/${epubFilename}`;

    const fileResponse = await octokit.repos.getContent({
      owner,
      repo: entry.ownerRepo,
      path: epubPath,
    });

    if (!('content' in fileResponse.data) || typeof fileResponse.data.content !== 'string') {
      return { success: false, error: 'EPUB file not found' };
    }

    const epubBuffer = Buffer.from(fileResponse.data.content, 'base64');
    const epubData = epubBuffer.buffer.slice(
      epubBuffer.byteOffset,
      epubBuffer.byteOffset + epubBuffer.byteLength
    );

    return {
      success: true,
      data: {
        epubData,
        filename: epubFilename,
        title: entry.title,
        author: entry.author,
      },
    };
  } catch (error: unknown) {
    const err = error as { message?: string };
    return { success: false, error: err.message || 'Failed to import book' };
  }
}
