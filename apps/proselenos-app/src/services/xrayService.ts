// services/xrayService.ts
// Client-side epub X-ray service - extracts and displays epub structure on-the-fly

import JSZip from 'jszip';

export interface XrayEntry {
  path: string;
  name: string;
  isDirectory: boolean;
  size: number;
}

export interface XrayTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  children?: XrayTreeNode[];
}

export type ContentType = 'text' | 'image' | 'svg' | 'binary';

export interface ContentResult {
  type: ContentType;
  content: string | Blob;
  size: number;
}

// Image magic bytes signatures
const IMAGE_SIGNATURES: { bytes: number[]; type: 'image' }[] = [
  { bytes: [0xff, 0xd8, 0xff], type: 'image' }, // JPEG
  { bytes: [0x89, 0x50, 0x4e, 0x47], type: 'image' }, // PNG
  { bytes: [0x47, 0x49, 0x46, 0x38], type: 'image' }, // GIF
];

// WebP has RIFF at start and WEBP at bytes 8-11
function isWebP(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // Check for RIFF
  if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) {
    return false;
  }
  // Check for WEBP at position 8
  return bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

function checkImageSignature(bytes: Uint8Array): boolean {
  for (const sig of IMAGE_SIGNATURES) {
    if (bytes.length >= sig.bytes.length) {
      let match = true;
      for (let i = 0; i < sig.bytes.length; i++) {
        if (bytes[i] !== sig.bytes[i]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
  }
  return isWebP(bytes);
}

function isBinaryContent(text: string): boolean {
  // Check for null bytes
  if (text.includes('\x00')) return true;

  // Check ratio of non-printable characters (excluding common whitespace)
  let nonPrintable = 0;
  const sampleSize = Math.min(text.length, 1000); // Check first 1000 chars
  for (let i = 0; i < sampleSize; i++) {
    const code = text.charCodeAt(i);
    // Allow printable ASCII, newline, carriage return, tab
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      nonPrintable++;
    }
    // Also flag high non-UTF8 looking bytes
    if (code === 0xfffd) {
      // Unicode replacement character (indicates decode failure)
      nonPrintable++;
    }
  }

  // If more than 10% non-printable, treat as binary
  return nonPrintable / sampleSize > 0.1;
}

/**
 * Load epub file and extract its structure as a tree
 */
export async function loadEpubStructure(file: File): Promise<{ zip: JSZip; tree: XrayTreeNode }> {
  const zip = await JSZip.loadAsync(file);

  const entries: XrayEntry[] = [];

  // Use Object.keys to get ALL files including those without explicit directory entries
  Object.keys(zip.files).forEach((relativePath) => {
    const zipEntry = zip.files[relativePath];
    if (!zipEntry) return;
    entries.push({
      path: relativePath,
      name: relativePath.split('/').filter(Boolean).pop() || relativePath,
      isDirectory: zipEntry.dir,
      size: (zipEntry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize || 0,
    });
  });

  const tree = buildTreeFromPaths(entries);

  return { zip, tree };
}

/**
 * Build a hierarchical tree structure from flat file paths
 */
function buildTreeFromPaths(entries: XrayEntry[]): XrayTreeNode {
  const root: XrayTreeNode = {
    name: '/',
    path: '',
    isDirectory: true,
    size: 0,
    children: [],
  };

  // Sort entries so directories come first, then alphabetically
  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) {
      return a.isDirectory ? -1 : 1;
    }
    return a.path.localeCompare(b.path);
  });

  for (const entry of entries) {
    const parts = entry.path.split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!current.children) {
        current.children = [];
      }

      let child = current.children.find((c) => c.name === part);

      if (!child) {
        child = {
          name: part || '',
          path: isLast ? entry.path : currentPath + '/',
          isDirectory: isLast ? entry.isDirectory : true,
          size: isLast ? entry.size : 0,
          children: isLast && !entry.isDirectory ? undefined : [],
        };
        current.children.push(child);
      }

      current = child;
    }
  }

  // Sort children: directories first, then files, both alphabetically
  const sortChildren = (node: XrayTreeNode) => {
    if (node.children) {
      node.children.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortChildren);
    }
  };
  sortChildren(root);

  return root;
}

/**
 * Get file content and detect its type
 */
export async function getFileContent(zip: JSZip, path: string): Promise<ContentResult> {
  const file = zip.file(path);
  if (!file) {
    throw new Error(`File not found: ${path}`);
  }

  // Get as array buffer first to check magic bytes
  const arrayBuffer = await file.async('arraybuffer');
  const bytes = new Uint8Array(arrayBuffer);
  const size = bytes.length;

  // 1. Check if it's a known image format via magic bytes
  if (checkImageSignature(bytes)) {
    const blob = new Blob([arrayBuffer]);
    return { type: 'image', content: blob, size };
  }

  // 2. Try to decode as UTF-8 text
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const text = decoder.decode(bytes);

  // 3. Check if the decoded text looks binary
  if (isBinaryContent(text)) {
    const blob = new Blob([arrayBuffer]);
    return { type: 'binary', content: blob, size };
  }

  // 4. It's valid text - check if it's SVG
  if (text.includes('<svg')) {
    // Return as blob for image rendering
    const blob = new Blob([text], { type: 'image/svg+xml' });
    return { type: 'svg', content: blob, size };
  }

  // 5. Regular text content
  return { type: 'text', content: text, size };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
