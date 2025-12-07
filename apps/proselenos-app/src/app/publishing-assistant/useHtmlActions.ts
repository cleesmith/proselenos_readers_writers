// useHtmlActions.ts - Hook for HTML generation

import { useState, useCallback } from 'react';
import { generateHTMLOnlyAction } from '@/lib/publish-actions';
import { listTxtFilesAction } from '@/lib/project-actions';

interface HtmlActionsState {
  isOpen: boolean;
  txtFiles: any[];
  selectedTxt: any | null;
  isGenerating: boolean;
  error: string | null;
  success: boolean;
}

const INITIAL_STATE: HtmlActionsState = {
  isOpen: false,
  txtFiles: [],
  selectedTxt: null,
  isGenerating: false,
  error: null,
  success: false
};

export function useHtmlActions(currentProjectId: string | null) {
  const [state, setState] = useState<HtmlActionsState>({ ...INITIAL_STATE });

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

  // Generate HTML
  const generateHtml = useCallback(async () => {
    if (!state.selectedTxt || !currentProjectId) return;

    setState(prev => ({
      ...prev,
      isGenerating: true,
      error: null,
      success: false
    }));

    try {
      const result = await generateHTMLOnlyAction(state.selectedTxt.path, currentProjectId);

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate HTML');
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
      generateHtml
    }
  };
}
