// Publishing Assistant Hook
// State management for publishing progress workflow

import { useState, useCallback } from 'react';
import { PublishingAssistantState, FileType, PublishingStep } from '@/lib/publishing-assistant/types';
import { generateHTMLOnlyAction, generateEPUBOnlyAction, generatePDFOnlyAction } from '@/lib/publish-actions';
import { listTxtFilesAction, checkManuscriptFilesExistAction, deleteManuscriptOutputAction } from '@/lib/github-project-actions';

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
      html: { exists: false, isProcessing: false },
      epub: { exists: false, isProcessing: false },
      pdf: { exists: false, isProcessing: false }
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
        html: { exists: false, isProcessing: false },
        epub: { exists: false, isProcessing: false },
        pdf: { exists: false, isProcessing: false }
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
        html: { exists: false, isProcessing: false },
        epub: { exists: false, isProcessing: false },
        pdf: { exists: false, isProcessing: false }
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

    // Check for existing manuscript files
    try {
      const existsResult = await checkManuscriptFilesExistAction(currentProjectId);
      if (existsResult.success && existsResult.data) {
        const data = existsResult.data;
        setState(prev => ({
          ...prev,
          fileStates: {
            html: { exists: data.html, isProcessing: false },
            epub: { exists: data.epub, isProcessing: false },
            pdf: { exists: data.pdf, isProcessing: false }
          }
        }));
      }
    } catch (error) {
      console.error('Error checking file existence:', error);
    }
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
        html: { exists: false, isProcessing: false },
        epub: { exists: false, isProcessing: false },
        pdf: { exists: false, isProcessing: false }
      }
    }));
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
          result = await generateEPUBOnlyAction(state.selectedManuscript.path, currentProjectId);
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
            exists: result.success,
            isProcessing: false,
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
  }, [state.selectedManuscript, currentProjectId]);

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
