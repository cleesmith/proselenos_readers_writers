// useEpubActions.ts - Local-first EPUB generation and import
// Reads from IndexedDB, generates client-side, imports to library

'use client';

import { useState, useCallback } from 'react';
import { loadManuscript, loadSettings, loadEpub, saveEpub } from '@/services/manuscriptStorage';
import { generateEpubFromManuscript } from '@/lib/epub-generator';
import { useBookImporter } from '@/hooks/useBookImporter';
import { processCoverImage } from '@/utils/image';

interface CoverImageState {
  previewUrl: string | null;
  base64: string | null;
  width: number | null;
  height: number | null;
  warning: string | null;
  isProcessing: boolean;
}

interface EpubActionsState {
  isOpen: boolean;
  // Manuscript status
  hasManuscript: boolean;
  // Uploaded EPUB status
  hasUploadedEpub: boolean;
  // Generation
  isGenerating: boolean;
  generateError: string | null;
  generateSuccess: boolean;
  // Import uploaded
  isImporting: boolean;
  importError: string | null;
  importSuccess: boolean;
  // Cover image (for generation)
  coverImage: CoverImageState;
}

const INITIAL_COVER_STATE: CoverImageState = {
  previewUrl: null,
  base64: null,
  width: null,
  height: null,
  warning: null,
  isProcessing: false
};

const INITIAL_STATE: EpubActionsState = {
  isOpen: false,
  hasManuscript: false,
  hasUploadedEpub: false,
  isGenerating: false,
  generateError: null,
  generateSuccess: false,
  isImporting: false,
  importError: null,
  importSuccess: false,
  coverImage: { ...INITIAL_COVER_STATE }
};

export function useEpubActions() {
  const { importEpubFile } = useBookImporter();
  const [state, setState] = useState<EpubActionsState>({ ...INITIAL_STATE });

  // Open modal and check what's available
  const openModal = useCallback(async () => {
    setState({
      ...INITIAL_STATE,
      isOpen: true
    });

    try {
      // Check if manuscript exists in IndexedDB
      const manuscript = await loadManuscript();
      const hasManuscript = !!manuscript && manuscript.length > 0;

      // Check if uploaded EPUB exists in IndexedDB
      const uploadedEpub = await loadEpub();
      const hasUploadedEpub = !!uploadedEpub;

      setState(prev => ({
        ...prev,
        hasManuscript,
        hasUploadedEpub
      }));
    } catch (error) {
      console.error('Error checking files:', error);
    }
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    if (state.coverImage.previewUrl) {
      URL.revokeObjectURL(state.coverImage.previewUrl);
    }
    setState({ ...INITIAL_STATE });
  }, [state.coverImage.previewUrl]);

  // Set cover image from file input
  const setCoverImage = useCallback(async (file: File) => {
    if (state.coverImage.previewUrl) {
      URL.revokeObjectURL(state.coverImage.previewUrl);
    }

    setState(prev => ({
      ...prev,
      coverImage: { ...INITIAL_COVER_STATE, isProcessing: true }
    }));

    try {
      const processed = await processCoverImage(file);
      setState(prev => ({
        ...prev,
        coverImage: {
          previewUrl: processed.previewUrl,
          base64: processed.base64,
          width: processed.width,
          height: processed.height,
          warning: processed.warning || null,
          isProcessing: false
        }
      }));
    } catch (error) {
      console.error('Error processing cover image:', error);
      setState(prev => ({
        ...prev,
        coverImage: {
          ...INITIAL_COVER_STATE,
          warning: error instanceof Error ? error.message : 'Failed to process image'
        }
      }));
    }
  }, [state.coverImage.previewUrl]);

  // Clear cover image
  const clearCoverImage = useCallback(() => {
    if (state.coverImage.previewUrl) {
      URL.revokeObjectURL(state.coverImage.previewUrl);
    }
    setState(prev => ({
      ...prev,
      coverImage: { ...INITIAL_COVER_STATE }
    }));
  }, [state.coverImage.previewUrl]);

  // Generate EPUB from manuscript.txt
  const generateEpub = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isGenerating: true,
      generateError: null,
      generateSuccess: false
    }));

    try {
      // 1. Load manuscript from IndexedDB
      const manuscript = await loadManuscript();
      if (!manuscript) {
        throw new Error('No manuscript found. Please add a manuscript.txt file first.');
      }

      // 2. Load settings (title, author, etc.) from IndexedDB
      const settings = await loadSettings();
      if (!settings) {
        throw new Error('No book settings found. Please configure title and author first.');
      }

      // 3. Generate EPUB client-side
      const epubData = await generateEpubFromManuscript(
        manuscript,
        settings,
        state.coverImage.base64 || undefined
      );

      // 4. Save to IndexedDB (publish/ store)
      // Convert Uint8Array to ArrayBuffer for storage
      const epubArrayBuffer = epubData.buffer.slice(
        epubData.byteOffset,
        epubData.byteOffset + epubData.byteLength
      ) as ArrayBuffer;
      await saveEpub(epubArrayBuffer);

      // 5. Import to e-reader library
      const filename = `${settings.title || 'manuscript'}.epub`;
      const file = new File([epubArrayBuffer], filename, { type: 'application/epub+zip' });
      await importEpubFile(file, { deduplicate: true });

      setState(prev => ({
        ...prev,
        isGenerating: false,
        generateSuccess: true,
        hasUploadedEpub: true // Now we have an EPUB saved
      }));
    } catch (error) {
      console.error('Error generating EPUB:', error);
      setState(prev => ({
        ...prev,
        isGenerating: false,
        generateError: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [state.coverImage.base64, importEpubFile]);

  // Import uploaded EPUB (from Files) to library
  const importUploadedEpub = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isImporting: true,
      importError: null,
      importSuccess: false
    }));

    try {
      // 1. Load EPUB from IndexedDB
      const epubData = await loadEpub();
      if (!epubData) {
        throw new Error('No uploaded EPUB found.');
      }

      // 2. Get settings for filename
      const settings = await loadSettings();
      const filename = settings?.title ? `${settings.title}.epub` : 'manuscript.epub';

      // 3. Create File object and import to library
      const file = new File([epubData], filename, { type: 'application/epub+zip' });
      await importEpubFile(file, { deduplicate: true });

      setState(prev => ({
        ...prev,
        isImporting: false,
        importSuccess: true
      }));
    } catch (error) {
      console.error('Error importing EPUB:', error);
      setState(prev => ({
        ...prev,
        isImporting: false,
        importError: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [importEpubFile]);

  return {
    state,
    actions: {
      openModal,
      closeModal,
      setCoverImage,
      clearCoverImage,
      generateEpub,
      importUploadedEpub
    }
  };
}
