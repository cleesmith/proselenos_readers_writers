/**
 * Hook to resolve image URLs stored in IndexedDB.
 *
 * Converts URLs like "images/{filename}" to displayable blob URLs.
 * Properly cleans up Object URLs on unmount/change to prevent memory leaks.
 */
import * as React from 'react';

import { getManuscriptImage } from '@/services/manuscriptStorage';

interface ResolvedImageState {
  resolvedUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Resolves an image URL to a displayable blob URL.
 *
 * @param url - The URL from the Plate element (e.g., "images/123-photo.jpg" or just "filename.jpg")
 * @returns Object with resolvedUrl, isLoading, and error states
 */
export function useResolvedImageUrl(url: string | undefined): ResolvedImageState {
  const [state, setState] = React.useState<ResolvedImageState>({
    resolvedUrl: null,
    isLoading: true,
    error: null,
  });

  // Track the current blob URL for cleanup
  const blobUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    // Cleanup function to revoke blob URL
    const cleanup = () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };

    if (!url) {
      cleanup();
      setState({ resolvedUrl: null, isLoading: false, error: 'No URL provided' });
      return cleanup;
    }

    // If it's already an absolute URL (http/https/data), use directly
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      cleanup();
      setState({ resolvedUrl: url, isLoading: false, error: null });
      return cleanup;
    }

    // If it's a blob URL (shouldn't happen with new code, but handle legacy)
    if (url.startsWith('blob:')) {
      setState({ resolvedUrl: url, isLoading: false, error: null });
      return cleanup;
    }

    // Extract filename from "images/{filename}" format
    let filename = url;
    if (url.startsWith('images/')) {
      filename = url.slice(7); // Remove "images/" prefix
    }

    // Load from IndexedDB
    let cancelled = false;

    async function loadImage() {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const blob = await getManuscriptImage(filename);

        if (cancelled) return;

        if (blob) {
          // Cleanup previous blob URL before creating new one
          cleanup();

          const blobUrl = URL.createObjectURL(blob);
          blobUrlRef.current = blobUrl;

          setState({
            resolvedUrl: blobUrl,
            isLoading: false,
            error: null,
          });
        } else {
          setState({
            resolvedUrl: null,
            isLoading: false,
            error: `Image not found: ${filename}`,
          });
        }
      } catch (err) {
        if (cancelled) return;

        console.error('Failed to load image from IndexedDB:', err);
        setState({
          resolvedUrl: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load image',
        });
      }
    }

    loadImage();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [url]);

  return state;
}
