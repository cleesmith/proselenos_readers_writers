// useEpubActions.ts - Hook for EPUB generation (gepub) and publishing (xepub)

import { useState, useCallback } from 'react';
import { generateEPUBForLocalImportAction } from '@/lib/publish-actions';
import { listTxtFilesAction, loadBookMetadataAction, downloadFileForBrowserAction } from '@/lib/github-project-actions';
import { listEpubFilesAction, extractCoverFromEpubAction } from '@/lib/epub-conversion-actions';
import { useBookImporter } from '@/hooks/useBookImporter';
import { publishToPublicCatalog, removeFromPublicCatalog } from '@/app/actions/store-catalog';
import { processCoverImage, generateCoverThumbnail } from '@/utils/image';

interface CoverImageState {
  previewUrl: string | null;
  base64: string | null;
  width: number | null;
  height: number | null;
  warning: string | null;
  isProcessing: boolean;
  isAutoExtracted: boolean;
}

interface EpubActionsState {
  isOpen: boolean;
  // File lists
  txtFiles: any[];
  epubFiles: any[];
  // gepub section
  selectedTxt: any | null;
  publishToStore: boolean;
  isGenerating: boolean;
  generateError: string | null;
  generateSuccess: boolean;
  // xepub section
  selectedEpub: any | null;
  isPublishing: boolean;
  publishError: string | null;
  publishSuccess: boolean;
  // shared cover image
  coverImage: CoverImageState;
}

const INITIAL_COVER_STATE: CoverImageState = {
  previewUrl: null,
  base64: null,
  width: null,
  height: null,
  warning: null,
  isProcessing: false,
  isAutoExtracted: false
};

const INITIAL_STATE: EpubActionsState = {
  isOpen: false,
  txtFiles: [],
  epubFiles: [],
  selectedTxt: null,
  publishToStore: false,
  isGenerating: false,
  generateError: null,
  generateSuccess: false,
  selectedEpub: null,
  isPublishing: false,
  publishError: null,
  publishSuccess: false,
  coverImage: { ...INITIAL_COVER_STATE }
};

export function useEpubActions(currentProjectId: string | null) {
  const { importEpubBase64 } = useBookImporter();
  const [state, setState] = useState<EpubActionsState>({ ...INITIAL_STATE });

  // Open modal and load files
  const openModal = useCallback(async () => {
    if (!currentProjectId) return;

    setState({
      ...INITIAL_STATE,
      isOpen: true
    });

    try {
      const [txtResult, epubResult] = await Promise.all([
        listTxtFilesAction(currentProjectId),
        listEpubFilesAction(currentProjectId)
      ]);

      setState(prev => ({
        ...prev,
        txtFiles: txtResult.success && txtResult.data?.files ? txtResult.data.files : [],
        epubFiles: epubResult.success && epubResult.data?.files ? epubResult.data.files : []
      }));
    } catch (error) {
      console.error('Error loading files:', error);
    }
  }, [currentProjectId]);

  // Close modal
  const closeModal = useCallback(() => {
    if (state.coverImage.previewUrl && !state.coverImage.isAutoExtracted) {
      URL.revokeObjectURL(state.coverImage.previewUrl);
    }
    setState({ ...INITIAL_STATE });
  }, [state.coverImage.previewUrl, state.coverImage.isAutoExtracted]);

  // Select txt file for gepub generation
  const selectTxt = useCallback((file: any | null) => {
    setState(prev => ({
      ...prev,
      selectedTxt: file,
      generateError: null,
      generateSuccess: false
    }));
  }, []);

  // Select epub file for xepub publishing - auto-extract cover
  const selectEpub = useCallback(async (file: any | null) => {
    // Clear previous cover if it was auto-extracted
    if (state.coverImage.isAutoExtracted && state.coverImage.previewUrl) {
      // Don't revoke - it's a data URL, not a blob URL
    }

    setState(prev => ({
      ...prev,
      selectedEpub: file,
      publishError: null,
      publishSuccess: false,
      coverImage: { ...INITIAL_COVER_STATE, isProcessing: !!file }
    }));

    if (file && currentProjectId) {
      try {
        const result = await extractCoverFromEpubAction(file.path);
        if (result.success && result.data) {
          setState(prev => ({
            ...prev,
            coverImage: {
              previewUrl: result.data!.coverBase64,
              base64: result.data!.coverBase64,
              width: null, // We don't have dimensions from extraction
              height: null,
              warning: null,
              isProcessing: false,
              isAutoExtracted: true
            }
          }));
        } else {
          setState(prev => ({
            ...prev,
            coverImage: { ...INITIAL_COVER_STATE }
          }));
        }
      } catch (error) {
        console.error('Error extracting cover:', error);
        setState(prev => ({
          ...prev,
          coverImage: { ...INITIAL_COVER_STATE }
        }));
      }
    }
  }, [currentProjectId, state.coverImage.isAutoExtracted, state.coverImage.previewUrl]);

  // Set cover image from file input (for gepub)
  const setCoverImage = useCallback(async (file: File) => {
    if (state.coverImage.previewUrl && !state.coverImage.isAutoExtracted) {
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
          isProcessing: false,
          isAutoExtracted: false
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
  }, [state.coverImage.previewUrl, state.coverImage.isAutoExtracted]);

  // Clear cover image
  const clearCoverImage = useCallback(() => {
    if (state.coverImage.previewUrl && !state.coverImage.isAutoExtracted) {
      URL.revokeObjectURL(state.coverImage.previewUrl);
    }
    setState(prev => ({
      ...prev,
      coverImage: { ...INITIAL_COVER_STATE }
    }));
  }, [state.coverImage.previewUrl, state.coverImage.isAutoExtracted]);

  // Toggle publish to store checkbox
  const togglePublishToStore = useCallback(() => {
    setState(prev => ({ ...prev, publishToStore: !prev.publishToStore }));
  }, []);

  // Generate gepub from selected txt
  const generateGepub = useCallback(async () => {
    if (!state.selectedTxt || !currentProjectId) return;

    setState(prev => ({
      ...prev,
      isGenerating: true,
      generateError: null,
      generateSuccess: false
    }));

    try {
      // 1. Generate EPUB
      const genResult = await generateEPUBForLocalImportAction(
        state.selectedTxt.path,
        currentProjectId,
        state.coverImage.base64 || undefined
      );

      if (!genResult.success || !genResult.data) {
        throw new Error(genResult.error || 'Failed to generate EPUB');
      }

      // 2. Import to library
      const importedBook = await importEpubBase64(
        genResult.data.epubBase64,
        genResult.data.epubFilename,
        { deduplicate: true }
      );

      // 3. Handle Bookstore listing
      if (state.publishToStore && importedBook) {
        let description = '';
        try {
          const metadataResult = await loadBookMetadataAction(currentProjectId);
          if (metadataResult.success && metadataResult.data?.aboutAuthor) {
            description = metadataResult.data.aboutAuthor;
          }
        } catch { /* continue without description */ }

        let coverThumbnailBase64: string | undefined;
        if (state.coverImage.base64) {
          try {
            coverThumbnailBase64 = await generateCoverThumbnail(state.coverImage.base64);
          } catch (e) {
            console.error('Failed to generate cover thumbnail:', e);
          }
        }

        await publishToPublicCatalog(currentProjectId, {
          hash: importedBook.hash,
          title: importedBook.title,
          author: importedBook.author,
          description,
          coverThumbnailBase64
        });
      } else {
        // Remove from catalog if checkbox unchecked
        await removeFromPublicCatalog(currentProjectId);
      }

      setState(prev => ({
        ...prev,
        isGenerating: false,
        generateSuccess: true
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        generateError: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [state.selectedTxt, state.publishToStore, state.coverImage.base64, currentProjectId, importEpubBase64]);

  // Publish xepub to Bookstore
  const publishXepub = useCallback(async () => {
    if (!state.selectedEpub || !currentProjectId) return;

    setState(prev => ({
      ...prev,
      isPublishing: true,
      publishError: null,
      publishSuccess: false
    }));

    try {
      // 1. Download EPUB from GitHub
      const downloadResult = await downloadFileForBrowserAction(
        currentProjectId,
        state.selectedEpub.path
      );

      if (!downloadResult.success || !downloadResult.data) {
        throw new Error(downloadResult.error || 'Failed to download EPUB');
      }

      // 2. Import to library (gets hash)
      const importedBook = await importEpubBase64(
        downloadResult.data.content,
        state.selectedEpub.name,
        { deduplicate: true }
      );

      if (!importedBook) {
        throw new Error('Failed to import EPUB to library');
      }

      // 3. Get description from metadata
      let description = '';
      try {
        const metadataResult = await loadBookMetadataAction(currentProjectId);
        if (metadataResult.success && metadataResult.data?.aboutAuthor) {
          description = metadataResult.data.aboutAuthor;
        }
      } catch { /* continue without description */ }

      // 4. Generate thumbnail from auto-extracted cover
      let coverThumbnailBase64: string | undefined;
      if (state.coverImage.base64) {
        try {
          coverThumbnailBase64 = await generateCoverThumbnail(state.coverImage.base64);
        } catch (e) {
          console.error('Failed to generate cover thumbnail:', e);
        }
      }

      // 5. Publish to catalog with epubFilename
      const publishResult = await publishToPublicCatalog(currentProjectId, {
        hash: importedBook.hash,
        title: importedBook.title,
        author: importedBook.author,
        description,
        coverThumbnailBase64,
        epubFilename: state.selectedEpub.name
      });

      if (!publishResult.success) {
        throw new Error(publishResult.error || 'Failed to publish to Proselenos Ebooks');
      }

      setState(prev => ({
        ...prev,
        isPublishing: false,
        publishSuccess: true
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isPublishing: false,
        publishError: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [state.selectedEpub, state.coverImage.base64, currentProjectId, importEpubBase64]);

  return {
    state,
    actions: {
      openModal,
      closeModal,
      selectTxt,
      selectEpub,
      setCoverImage,
      clearCoverImage,
      togglePublishToStore,
      generateGepub,
      publishXepub
    }
  };
}
