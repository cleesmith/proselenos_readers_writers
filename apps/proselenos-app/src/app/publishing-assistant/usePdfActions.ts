// usePdfActions.ts - Hook for PDF generation

import { useState, useCallback } from 'react';
import { generatePDFOnlyAction } from '@/lib/publish-actions';
import { listTxtFilesAction } from '@/lib/github-project-actions';

interface PdfActionsState {
  isOpen: boolean;
  txtFiles: any[];
  selectedTxt: any | null;
  isGenerating: boolean;
  error: string | null;
  success: boolean;
}

const INITIAL_STATE: PdfActionsState = {
  isOpen: false,
  txtFiles: [],
  selectedTxt: null,
  isGenerating: false,
  error: null,
  success: false
};

export function usePdfActions(currentProjectId: string | null) {
  const [state, setState] = useState<PdfActionsState>({ ...INITIAL_STATE });

  // Open modal and load txt files
  const openModal = useCallback(async () => {
    if (!currentProjectId) return;

    setState({
      ...INITIAL_STATE,
      isOpen: true
    });

    try {
      const result = await listTxtFilesAction(currentProjectId);
      setState(prev => ({
        ...prev,
        txtFiles: result.success && result.data?.files ? result.data.files : []
      }));
    } catch (error) {
      console.error('Error loading files:', error);
    }
  }, [currentProjectId]);

  // Close modal
  const closeModal = useCallback(() => {
    setState({ ...INITIAL_STATE });
  }, []);

  // Select txt file
  const selectTxt = useCallback((file: any | null) => {
    setState(prev => ({
      ...prev,
      selectedTxt: file,
      error: null,
      success: false
    }));
  }, []);

  // Generate PDF
  const generatePdf = useCallback(async () => {
    if (!state.selectedTxt || !currentProjectId) return;

    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
      success: false
    }));

    try {
      const result = await generatePDFOnlyAction(state.selectedTxt.path, currentProjectId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate PDF');
      }

      setState(prev => ({
        ...prev,
        isGenerating: false,
        success: true
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }, [state.selectedTxt, currentProjectId]);

  return {
    state,
    actions: {
      openModal,
      closeModal,
      selectTxt,
      generatePdf
    }
  };
}
