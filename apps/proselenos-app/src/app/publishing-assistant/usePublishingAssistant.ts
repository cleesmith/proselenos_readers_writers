// apps/proselenos-app/src/app/publishing-assistant/usePublishingAssistant.ts

import { useState, useCallback } from 'react';
import { PublishingAssistantState, FileType, PublishingStep } from '@/lib/publishing-assistant/types';
import { generateHTMLOnlyAction, generateEPUBForLocalImportAction, generatePDFOnlyAction } from '@/lib/publish-actions';
import { listTxtFilesAction, deleteManuscriptOutputAction } from '@/lib/github-project-actions';
import { useEnv } from '@/context/EnvContext';
import { useLibraryStore } from '@/store/libraryStore';

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
  // Get app service and library for local import
  const { appService, envConfig } = useEnv();
  const { library, updateBook } = useLibraryStore();

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
    }
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
      }
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
      }
    }));
  }, []);

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
      }
    }));
  }, []);

  // Individual file generation
  // For EPUB: uploads to GitHub AND imports into local reader library
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
          // EPUB: Upload to GitHub AND import into local reader library
          const localResult = await generateEPUBForLocalImportAction(
            state.selectedManuscript.path,
            currentProjectId
          );

          if (!localResult.success || !localResult.data) {
            throw new Error(localResult.error || 'Failed to generate EPUB');
          }

          // Convert base64 to Uint8Array (same pattern as useBookRepo)
          const binaryString = atob(localResult.data.epubBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Create File object from the binary data
          const epubFile = new File(
            [bytes],
            localResult.data.epubFilename,
            { type: 'application/epub+zip' }
          );

          // Import into IndexedDB via appService (same as big + button)
          if (!appService) {
            throw new Error('App service not available');
          }

          const importedBook = await appService.importBook(epubFile, library);
          if (!importedBook) {
            throw new Error('Failed to import generated EPUB into library');
          }

          // Mark as downloaded and update library
          importedBook.downloadedAt = Date.now();
          await updateBook(envConfig, importedBook);

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
  }, [state.selectedManuscript, currentProjectId, appService, envConfig, library, updateBook]);

  return {
    state,
    actions: {
      openModal,
      closeModal,
      selectManuscript,
      resetToFileSelection,
      generateFile
    }
  };
}
