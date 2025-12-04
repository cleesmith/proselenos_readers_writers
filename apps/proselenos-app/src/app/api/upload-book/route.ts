// API route for Vercel Blob client uploads of ebooks
// Handles token generation and onUploadCompleted webhook for server-to-server GitHub upload
// Uploads to user's proselenosebooks repo (Private Ebooks backup)

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { uploadFiles } from '@/lib/github-storage';

// Get max file size from env (default 30MB)
const MAX_FILE_SIZE_MB = parseInt(process.env['NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB'] || '30', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const BOOKS_PREFIX = 'Proselenosebooks/Books/';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname: string, clientPayload: string | null) => {
        // Validate session
        const session = await getServerSession(authOptions);
        if (!session?.user) {
          throw new Error('Not authenticated');
        }

        const userId = (session.user as { id?: string }).id;
        if (!userId) {
          throw new Error('Could not determine user identity');
        }

        // Validate file extension
        const ext = pathname.toLowerCase().slice(pathname.lastIndexOf('.'));
        if (ext !== '.epub') {
          throw new Error(`File type ${ext} not allowed. Only .epub files are supported.`);
        }

        // Parse client payload for book details
        const payload = clientPayload ? JSON.parse(clientPayload) : {};

        return {
          allowedContentTypes: ['application/epub+zip'],
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          tokenPayload: JSON.stringify({
            userId,
            bookHash: payload.bookHash,
            bookTitle: payload.bookTitle,
            epubFilename: payload.epubFilename,
            configData: payload.configData,
          }),
        };
      },

      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This runs server-side after blob upload completes
        // Vercel calls this webhook - won't work on localhost

        // Helper to delete blob - always called at end
        const deleteBlob = async () => {
          try {
            await del(blob.url);
          } catch (delError) {
            console.error('Failed to delete blob:', delError);
          }
        };

        // Helper to retry an async operation
        const withRetry = async <T>(
          operation: () => Promise<T>,
          maxRetries: number = 2,
          delayMs: number = 500
        ): Promise<T> => {
          let lastError: Error | undefined;
          for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
              return await operation();
            } catch (error) {
              lastError = error instanceof Error ? error : new Error(String(error));
              if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
              }
            }
          }
          throw lastError;
        };

        try {
          const { userId, bookHash, bookTitle, epubFilename, configData } = JSON.parse(tokenPayload || '{}');

          if (!userId || !bookHash || !epubFilename) {
            console.error('Missing required fields in tokenPayload:', { userId, bookHash, epubFilename });
            await deleteBlob();
            return;
          }

          // Fetch EPUB from Vercel Blob with retry
          const fetchUrl = blob.downloadUrl || blob.url;
          const epubData = await withRetry(async () => {
            const response = await fetch(fetchUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch blob: ${response.status}`);
            }
            return response.arrayBuffer();
          });

          // Prepare files to upload
          const epubPath = `${BOOKS_PREFIX}${bookHash}/${epubFilename}`;
          const filesToUpload: Array<{ path: string; content: string | ArrayBuffer }> = [
            { path: epubPath, content: epubData },
          ];

          // Include config.json if provided
          if (configData) {
            const configPath = `${BOOKS_PREFIX}${bookHash}/config.json`;
            filesToUpload.push({ path: configPath, content: configData });
          }

          // Upload to GitHub (proselenosebooks repo) with retry
          const commitMessage = `Upload ${bookTitle || epubFilename}`;
          await withRetry(async () => {
            await uploadFiles(userId, 'proselenosebooks', filesToUpload, commitMessage);
          });

          // Success - delete blob
          await deleteBlob();
          console.log(`Uploaded ${epubFilename} to GitHub (proselenosebooks) for user ${userId}`);
        } catch (error) {
          console.error('onUploadCompleted error:', error);
          // Still try to delete blob even if something failed
          await deleteBlob();
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
