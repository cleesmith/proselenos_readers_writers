// Server action to clean up old Vercel Blob files
// Called opportunistically when users visit the authors page

'use server';

import { list, del } from '@vercel/blob';

// Delete blobs older than this (1 hour - these are temporary upload staging files)
const MAX_BLOB_AGE_MS = 60 * 60 * 1000; // 1 hour
const MAX_DELETE_PER_CLEANUP = 10; // Limit deletions per cleanup to avoid long operations

export async function cleanupOldBlobsAction(): Promise<{ deleted: number; error?: string }> {
  try {
    // List all blobs in the store
    const { blobs } = await list();

    if (blobs.length === 0) {
      return { deleted: 0 };
    }

    const now = Date.now();
    const oldBlobs = blobs
      .filter(blob => {
        const age = now - new Date(blob.uploadedAt).getTime();
        return age > MAX_BLOB_AGE_MS;
      })
      .slice(0, MAX_DELETE_PER_CLEANUP); // Limit to 10 per cleanup

    if (oldBlobs.length === 0) {
      return { deleted: 0 };
    }

    // Delete old blobs (del() accepts an array of URLs)
    await del(oldBlobs.map(b => b.url));

    console.log(`Blob cleanup: deleted ${oldBlobs.length} old blob(s)`);
    return { deleted: oldBlobs.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cleanup failed';
    console.error('Blob cleanup error:', message);
    return { deleted: 0, error: message };
  }
}
