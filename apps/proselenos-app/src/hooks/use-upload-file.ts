/**
 * Media upload hook that stores directly to IndexedDB.
 * No external service required - files persist locally.
 *
 * Storage conventions:
 *   images/{filename} → EPUB3 structure: OEBPS/images/
 *   audio/{filename}  → EPUB3 structure: OEBPS/audio/
 */
import * as React from 'react';
import { toast } from 'sonner';

import { saveManuscriptImage, saveManuscriptAudio } from '@/services/manuscriptStorage';

export interface UploadedFile {
  key: string;
  name: string;
  size: number;
  type: string;
  url: string;  // Format: "images/{filename}" - relative path for EPUB compatibility
}

interface UseUploadFileProps {
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: unknown) => void;
}

export function useUploadFile({
  onUploadComplete,
  onUploadError,
}: UseUploadFileProps = {}) {
  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);

  async function uploadFile(file: File): Promise<UploadedFile | undefined> {
    setIsUploading(true);
    setUploadingFile(file);
    setProgress(0);

    try {
      // Use sanitized original filename (no timestamp prefix)
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uniqueFilename = sanitizedName;

      // Simulate progress for UX (actual IndexedDB write is fast)
      setProgress(30);

      // Route to appropriate storage based on file type
      const isAudio = file.type.startsWith('audio/');
      if (isAudio) {
        await saveManuscriptAudio(uniqueFilename, file);
      } else {
        await saveManuscriptImage(uniqueFilename, file);
      }

      setProgress(100);

      // Return URL in EPUB-compatible format
      // Images: "images/{filename}" → OEBPS/images/
      // Audio:  "audio/{filename}"  → OEBPS/audio/
      const result: UploadedFile = {
        key: uniqueFilename,
        name: file.name,
        size: file.size,
        type: file.type,
        url: isAudio ? `audio/${uniqueFilename}` : `images/${uniqueFilename}`,
      };

      setUploadedFile(result);
      onUploadComplete?.(result);

      return result;
    } catch (error) {
      console.error('Media upload failed:', error);
      const message = error instanceof Error ? error.message : 'Failed to save file';
      toast.error(message);
      onUploadError?.(error);
      return undefined;
    } finally {
      setProgress(0);
      setIsUploading(false);
      setUploadingFile(undefined);
    }
  }

  return {
    isUploading,
    progress,
    uploadedFile,
    uploadFile,
    uploadingFile,
  };
}

export function getErrorMessage(err: unknown) {
  if (err instanceof Error) {
    return err.message;
  }
  return 'Something went wrong, please try again later.';
}

export function showErrorToast(err: unknown) {
  const errorMessage = getErrorMessage(err);
  return toast.error(errorMessage);
}
