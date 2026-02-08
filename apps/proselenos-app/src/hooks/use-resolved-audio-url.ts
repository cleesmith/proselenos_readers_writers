/**
 * Hook to resolve audio URLs stored in IndexedDB.
 *
 * Converts URLs like "audio/{filename}" to displayable blob URLs.
 * Properly cleans up Object URLs on unmount/change to prevent memory leaks.
 */
import * as React from 'react';

import { getManuscriptAudio } from '@/services/manuscriptStorage';

interface ResolvedAudioState {
  resolvedUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Resolves an audio URL to a playable blob URL.
 *
 * @param url - The URL from the Plate element (e.g., "audio/song.mp3")
 * @returns Object with resolvedUrl, isLoading, and error states
 */
export function useResolvedAudioUrl(url: string | undefined): ResolvedAudioState {
  const [state, setState] = React.useState<ResolvedAudioState>({
    resolvedUrl: null,
    isLoading: true,
    error: null,
  });

  // Track the current blob URL for cleanup
  const blobUrlRef = React.useRef<string | null>(null);

  React.useEffect(() => {
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

    // If it's already an absolute URL, use directly
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      cleanup();
      setState({ resolvedUrl: url, isLoading: false, error: null });
      return cleanup;
    }

    if (url.startsWith('blob:')) {
      setState({ resolvedUrl: url, isLoading: false, error: null });
      return cleanup;
    }

    // Extract filename from "audio/{filename}" format
    let filename = url;
    if (url.startsWith('audio/')) {
      filename = url.slice(6); // Remove "audio/" prefix
    }

    let cancelled = false;

    async function loadAudio() {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const blob = await getManuscriptAudio(filename);

        if (cancelled) return;

        if (blob) {
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
            error: `Audio not found: ${filename}`,
          });
        }
      } catch (err) {
        if (cancelled) return;

        console.error('Failed to load audio from IndexedDB:', err);
        setState({
          resolvedUrl: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to load audio',
        });
      }
    }

    loadAudio();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [url]);

  return state;
}
