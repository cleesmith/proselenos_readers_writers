// API route for Vercel Blob client uploads
// Handles token generation and onUploadCompleted webhook for server-to-server GitHub upload

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@proselenosebooks/auth-core/lib/auth';
import { uploadFile } from '@/lib/github-storage';

// Get max file size from env (default 30MB)
const MAX_FILE_SIZE_MB = parseInt(process.env['NEXT_PUBLIC_MAX_UPLOAD_SIZE_MB'] || '30', 10);
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_EXTENSIONS = ['.txt', '.html', '.docx', '.epub', '.pdf'];

const ALLOWED_CONTENT_TYPES = [
  'text/plain',                                                              // .txt
  'text/html',                                                               // .html
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/epub+zip',                                                    // .epub
  'application/pdf',                                                         // .pdf
];

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
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
          throw new Error(`File type ${ext} not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
        }

        // Parse client payload for projectName and fileName
        const payload = clientPayload ? JSON.parse(clientPayload) : {};

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE_BYTES,
          tokenPayload: JSON.stringify({
            userId,
            projectName: payload.projectName,
            fileName: payload.fileName
          }),
        };
      },

      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // This runs server-side after blob upload completes
        // Vercel calls this webhook - won't work on localhost

        try {
          const { userId, projectName, fileName } = JSON.parse(tokenPayload || '{}');

          if (!userId || !projectName || !fileName) {
            console.error('Missing required fields in tokenPayload:', { userId, projectName, fileName });
            return;
          }

          // Fetch file from Vercel Blob (server-to-server)
          const blobResponse = await fetch(blob.url);
          if (!blobResponse.ok) {
            console.error(`Failed to fetch blob: ${blobResponse.status}`);
            return;
          }

          const arrayBuffer = await blobResponse.arrayBuffer();
          const filePath = `${projectName}/${fileName}`;
          const fileNameLower = fileName.toLowerCase();

          // Determine content type for GitHub upload
          let content: string | ArrayBuffer;
          if (fileNameLower.endsWith('.txt') || fileNameLower.endsWith('.html')) {
            // Text files: convert to UTF-8 string
            const decoder = new TextDecoder('utf-8');
            content = decoder.decode(arrayBuffer);
          } else {
            // Binary files (docx, epub, pdf): pass ArrayBuffer directly
            content = arrayBuffer;
          }

          // Upload to GitHub
          const commitMessage = `Upload ${fileName}`;
          await uploadFile(userId, 'proselenos', filePath, content, commitMessage);

          // Delete blob from Vercel storage (cleanup)
          try {
            await del(blob.url);
          } catch (delError) {
            console.error('Failed to delete blob:', delError);
          }

          console.log(`Successfully uploaded ${fileName} to GitHub for user ${userId}`);
        } catch (error) {
          console.error('onUploadCompleted error:', error);
        }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
