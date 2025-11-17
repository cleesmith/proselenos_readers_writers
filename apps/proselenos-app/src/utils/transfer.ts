// No Desktop - desktop upload/download removed

export type UploadMethod = 'POST' | 'PUT';

export interface ProgressPayload {
  progress: number;
  total: number;
  transferSpeed: number;
}

export type ProgressHandler = (progress: ProgressPayload) => void;

export const webUpload = (file: File, uploadUrl: string, onProgress?: ProgressHandler) => {
  return new Promise<void>((resolve, reject) => {
    const startTime = Date.now();
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress({
          progress: event.loaded,
          total: event.total,
          transferSpeed: event.loaded / ((Date.now() - startTime) / 1000),
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed'));

    xhr.send(file);
  });
};

export const webDownload = async (downloadUrl: string, onProgress?: ProgressHandler) => {
  const response = await fetch(downloadUrl);
  if (!response.ok) throw new Error('File download failed');

  const contentLength = response.headers.get('Content-Length');
  if (!contentLength) throw new Error('Cannot track progress: Content-Length missing');

  const totalSize = parseInt(contentLength, 10);
  let receivedSize = 0;
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];

  const startTime = Date.now();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedSize += value.length;

    if (onProgress) {
      onProgress({
        progress: receivedSize,
        total: totalSize,
        transferSpeed: receivedSize / ((Date.now() - startTime) / 1000),
      });
    }
  }

  return new Blob(chunks as BlobPart[]);
};

// No Desktop - desktop upload removed
export const desktopUpload = async (
  _url: string,
  _filePath: string,
  _method: UploadMethod,
  _progressHandler?: ProgressHandler,
  _headers?: Map<string, string>,
): Promise<string> => {
  throw new Error('Desktop upload not supported - web only');
};

// No Desktop - desktop download removed
export const desktopDownload = async (
  _url: string,
  _filePath: string,
  _progressHandler?: ProgressHandler,
  _headers?: Map<string, string>,
  _body?: string,
): Promise<void> => {
  throw new Error('Desktop download not supported - web only');
};