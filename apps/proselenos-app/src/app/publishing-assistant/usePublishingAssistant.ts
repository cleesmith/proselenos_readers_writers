// apps/proselenos-app/src/app/publishing-assistant/usePublishingAssistant.ts

import { useState, useCallback } from 'react';
import { PublishingAssistantState, FileType, PublishingStep, CoverImageState } from '@/lib/publishing-assistant/types';
import { generateHTMLOnlyAction, generateEPUBForLocalImportAction, generatePDFOnlyAction } from '@/lib/publish-actions';
import { listTxtFilesAction, deleteManuscriptOutputAction, loadBookMetadataAction } from '@/lib/github-project-actions';
import { useBookImporter } from '@/hooks/useBookImporter';
import { publishToPublicCatalog, removeFromPublicCatalog } from '@/app/actions/store-catalog';
import { processCoverImage, generateCoverThumbnail } from '@/utils/image';

// Initial cover image state
const INITIAL_COVER_STATE: CoverImageState = {
  file: null,
  previewUrl: null,
  base64: null,
  width: null,
  height: null,
  warning: null,
  isProcessing: false
};

// File type configurations for UI display
const INITIAL_PUBLISHING_STEPS: PublishingStep[] = [
  {
    id: 'html',
    name: 'Convert to HTML',
    description: 'Convert manuscript .txt to HTML format...',
    status: 'pending'
  },
  {
    id: 'epub',
    name: 'Convert to EPUB',
    description: 'Convert manuscript .txt to EPUB 3 e-book format...',
    status: 'pending'
  },
  {
    id: 'pdf',
    name: 'Convert to PDF',
    description: 'Convert manuscript .txt to PDF format (KDP ready)...',
    status: 'pending'
  }
];

export function usePublishingAssistant(
  currentProjectId: string | null
) {
  // Use the shared importer hook
  const { importEpubBase64 } = useBookImporter();

  const [state, setState] = useState<PublishingAssistantState>({
    isModalOpen: false,
    selectedManuscript: null,
    showFileSelector: false,
    files: [],
    progress: {
      currentStep: 0,
      steps: [...INITIAL_PUBLISHING_STEPS],
      isProcessing: false,
      isComplete: false,
      generatedFiles: []
    },
    fileStates: {
      html: { isProcessing: false, createdInSession: false },
      epub: { isProcessing: false, createdInSession: false },
      pdf: { isProcessing: false, createdInSession: false }
    },
    publishToStore: false,
    coverImage: { ...INITIAL_COVER_STATE }
  });

  // Open modal and load manuscript files
  const openModal = useCallback(async () => {
    if (!currentProjectId) return;

    setState(prev => ({
      ...prev,
      isModalOpen: true,
      showFileSelector: true,
      progress: {
        currentStep: 0,
        steps: [...INITIAL_PUBLISHING_STEPS],
        isProcessing: false,
        isComplete: false,
        generatedFiles: []
      },
      fileStates: {
        html: { isProcessing: false, createdInSession: false },
        epub: { isProcessing: false, createdInSession: false },
        pdf: { isProcessing: false, createdInSession: false }
      },
      coverImage: { ...INITIAL_COVER_STATE }
    }));

    try {
      const result = await listTxtFilesAction(currentProjectId);

      if (result.success && result.data?.files) {
        setState(prev => ({
          ...prev,
          files: result.data.files
        }));
      }
    } catch (error) {
      console.error('Error loading files:', error);
    }
  }, [currentProjectId]);

  // Close modal
  const closeModal = useCallback(() => {
    // Clean up cover image preview URL to avoid memory leaks
    if (state.coverImage.previewUrl) {
      URL.revokeObjectURL(state.coverImage.previewUrl);
    }
    setState(prev => ({
      ...prev,
      isModalOpen: false,
      showFileSelector: false,
      selectedManuscript: null,
      progress: {
        currentStep: 0,
        steps: [...INITIAL_PUBLISHING_STEPS],
        isProcessing: false,
        isComplete: false,
        generatedFiles: []
      },
      fileStates: {
        html: { isProcessing: false, createdInSession: false },
        epub: { isProcessing: false, createdInSession: false },
        pdf: { isProcessing: false, createdInSession: false }
      },
      coverImage: { ...INITIAL_COVER_STATE }
    }));
  }, [state.coverImage.previewUrl]);

  // Select manuscript file
  const selectManuscript = useCallback(async (file: any) => {
    if (!currentProjectId) return;

    setState(prev => ({
      ...prev,
      selectedManuscript: file,
      showFileSelector: false
    }));
  }, [currentProjectId]);

  // Reset to file selection
  const resetToFileSelection = useCallback(() => {
    // Clean up cover image preview URL
    if (state.coverImage.previewUrl) {
      URL.revokeObjectURL(state.coverImage.previewUrl);
    }
    setState(prev => ({
      ...prev,
      selectedManuscript: null,
      showFileSelector: true,
      progress: {
        currentStep: 0,
        steps: [...INITIAL_PUBLISHING_STEPS],
        isProcessing: false,
        isComplete: false,
        generatedFiles: []
      },
      fileStates: {
        html: { isProcessing: false, createdInSession: false },
        epub: { isProcessing: false, createdInSession: false },
        pdf: { isProcessing: false, createdInSession: false }
      },
      coverImage: { ...INITIAL_COVER_STATE }
    }));
  }, [state.coverImage.previewUrl]);

  // Set cover image from file input
  const setCoverImage = useCallback(async (file: File) => {
    // Clean up previous preview URL
    if (state.coverImage.previewUrl) {
      URL.revokeObjectURL(state.coverImage.previewUrl);
    }

    setState(prev => ({
      ...prev,
      coverImage: { ...prev.coverImage, isProcessing: true, warning: null }
    }));

    try {
      const processed = await processCoverImage(file);
      setState(prev => ({
        ...prev,
        coverImage: {
          file,
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

  // Toggle publish to store option
  const togglePublishToStore = useCallback(() => {
    setState(prev => ({ ...prev, publishToStore: !prev.publishToStore }));
  }, []);

  // Individual file generation
  const generateFile = useCallback(async (fileType: FileType) => {
    if (!state.selectedManuscript || !currentProjectId) return;

    // Set processing state for this file type
    setState(prev => ({
      ...prev,
      fileStates: {
        ...prev.fileStates,
        [fileType]: { ...prev.fileStates[fileType], isProcessing: true, error: undefined }
      }
    }));

    try {
      // Best-effort delete existing output before (re-)creating
      try {
        await deleteManuscriptOutputAction(
          currentProjectId,
          fileType
        );
      } catch (e) {
        // Proceed even if delete fails; generation will overwrite if supported
      }

      // Call the appropriate generation action directly
      let result;
      switch (fileType) {
        case 'html':
          result = await generateHTMLOnlyAction(state.selectedManuscript.path, currentProjectId);
          break;
        case 'epub':
          // 1. Generate EPUB on server (returns base64)
          // Pass cover image base64 if provided
          const localResult = await generateEPUBForLocalImportAction(
            state.selectedManuscript.path,
            currentProjectId,
            state.coverImage.base64 || undefined
          );

          if (!localResult.success || !localResult.data) {
            throw new Error(localResult.error || 'Failed to generate EPUB');
          }

          // 2. Import to Library with DEDUPLICATION enabled
          // This ensures we replace the "old" draft with this "new" draft
          const importedBook = await importEpubBase64(
            localResult.data.epubBase64,
            localResult.data.epubFilename,
            { deduplicate: true }
          );

          // 3. Handle bookstore listing based on checkbox state
          if (state.publishToStore && importedBook) {
            // Publish to the public catalog
            let description = '';
            try {
              const metadataResult = await loadBookMetadataAction(currentProjectId);
              if (metadataResult.success && metadataResult.data?.aboutAuthor) {
                description = metadataResult.data.aboutAuthor;
              }
            } catch {
              // Continue without description if metadata load fails
            }

            // Generate thumbnail if cover image is provided
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
            // Remove from catalog if it exists (checkbox unchecked)
            await removeFromPublicCatalog(currentProjectId);
          }

          result = { success: true };
          break;
        case 'pdf':
          result = await generatePDFOnlyAction(state.selectedManuscript.path, currentProjectId);
          break;
        default:
          result = { success: false, error: `Unknown file type: ${fileType}` };
      }

      setState(prev => ({
        ...prev,
        fileStates: {
          ...prev.fileStates,
          [fileType]: {
            isProcessing: false,
            createdInSession: result.success,
            error: result.error
          }
        }
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setState(prev => ({
        ...prev,
        fileStates: {
          ...prev.fileStates,
          [fileType]: {
            ...prev.fileStates[fileType],
            isProcessing: false,
            error: errorMessage
          }
        }
      }));
    }
  }, [state.selectedManuscript, state.publishToStore, state.coverImage.base64, currentProjectId, importEpubBase64]);

  return {
    state,
    actions: {
      openModal,
      closeModal,
      selectManuscript,
      resetToFileSelection,
      togglePublishToStore,
      generateFile,
      setCoverImage,
      clearCoverImage
    }
  };
}
