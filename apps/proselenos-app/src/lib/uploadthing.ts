// Uploadthing stub for PlateJS media upload functionality
// This is a placeholder - actual file uploads in proselenos use IndexedDB

import { createUploadthing, type FileRouter } from 'uploadthing/next';

const f = createUploadthing();

// File router for the editor uploader
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ourFileRouter: FileRouter = {
  editorUploader: f({
    image: { maxFileSize: '4MB', maxFileCount: 1 },
    video: { maxFileSize: '16MB', maxFileCount: 1 },
    audio: { maxFileSize: '8MB', maxFileCount: 1 },
    pdf: { maxFileSize: '4MB', maxFileCount: 1 },
  })
    .middleware(async () => {
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url };
    }),
};

export type OurFileRouter = typeof ourFileRouter;
