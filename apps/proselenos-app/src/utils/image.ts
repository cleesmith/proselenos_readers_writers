// Cover image processing result
export interface ProcessedCoverImage {
  arrayBuffer: ArrayBuffer;  // For EPUB embedding
  base64: string;            // For server actions (base64 data URL)
  previewUrl: string;        // Blob URL for preview
  width: number;
  height: number;
  warning?: string;          // Warning if image is too small
}

// Process a cover image file for EPUB embedding
// - Validates dimensions (warns if too small per Amazon guidelines)
// - Resizes if too large (max 1600x2560)
// - Converts to JPEG at 85% quality
// - Returns ArrayBuffer for EPUB, base64 for server, blob URL for preview
export async function processCoverImage(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {}
): Promise<ProcessedCoverImage> {
  const { maxWidth = 1600, maxHeight = 2560, quality = 0.85 } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = async () => {
      try {
        let warning: string | undefined;
        let targetWidth = img.width;
        let targetHeight = img.height;

        // Check if image is too small (Amazon minimum: 500px shortest side)
        const shortestSide = Math.min(img.width, img.height);
        if (shortestSide < 500) {
          warning = `Cover image is small (${img.width}x${img.height}). Amazon recommends at least 500px on the shortest side for proper display.`;
        }

        // Resize if too large
        if (img.width > maxWidth || img.height > maxHeight) {
          const widthRatio = maxWidth / img.width;
          const heightRatio = maxHeight / img.height;
          const ratio = Math.min(widthRatio, heightRatio);
          targetWidth = Math.round(img.width * ratio);
          targetHeight = Math.round(img.height * ratio);
        }

        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Get base64 data URL
        const base64 = canvas.toDataURL('image/jpeg', quality);

        // Get blob for ArrayBuffer and preview URL
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create image blob'));
              return;
            }

            const previewUrl = URL.createObjectURL(blob);

            // Convert blob to ArrayBuffer
            blob.arrayBuffer().then((arrayBuffer) => {
              URL.revokeObjectURL(objectUrl);
              resolve({
                arrayBuffer,
                base64,
                previewUrl,
                width: targetWidth,
                height: targetHeight,
                warning,
              });
            }).catch(reject);
          },
          'image/jpeg',
          quality
        );
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to process cover image: ${error}`));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load cover image'));
    };

    img.src = objectUrl;
  });
}

// Generate a thumbnail version of a cover image for Bookstore display
export async function generateCoverThumbnail(
  base64DataUrl: string,
  targetWidth: number = 400,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        const aspectRatio = img.height / img.width;
        const targetHeight = Math.round(targetWidth * aspectRatio);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const thumbnailBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(thumbnailBase64);
      } catch (error) {
        reject(new Error(`Failed to generate thumbnail: ${error}`));
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for thumbnail'));
    img.src = base64DataUrl;
  });
}

export async function fetchImageAsBase64(
  url: string,
  options: {
    targetWidth?: number;
    format?: 'image/jpeg' | 'image/png' | 'image/webp';
    quality?: number;
  } = {},
): Promise<string> {
  const { targetWidth = 256, format = 'image/jpeg', quality = 0.85 } = options;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const blob = await response.blob();

    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          const aspectRatio = img.height / img.width;
          const newWidth = targetWidth;
          const newHeight = Math.round(newWidth * aspectRatio);

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }

          canvas.width = newWidth;
          canvas.height = newHeight;

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.drawImage(img, 0, 0, newWidth, newHeight);

          const base64 = canvas.toDataURL(format, quality);
          resolve(base64);
        } catch (error) {
          reject(new Error(`Failed to scale image: ${error}`));
        }
      };

      img.onerror = () => reject(new Error('Failed to load image for scaling'));

      const objectUrl = URL.createObjectURL(blob);
      img.src = objectUrl;

      const cleanup = () => URL.revokeObjectURL(objectUrl);
      const originalOnload = img.onload;
      const originalOnerror = img.onerror;

      img.onload = function (ev) {
        cleanup();
        if (originalOnload) originalOnload.call(this, ev);
      };

      img.onerror = function (ev) {
        cleanup();
        if (originalOnerror) originalOnerror.call(this, ev);
      };
    });
  } catch (error) {
    console.error('Error fetching and encoding image:', error);
    throw error;
  }
}
