// app/writing-assistant/useWritingAssistant.ts
// Local-first: IndexedDB + client-side OpenRouter API calls

import { useState, useCallback } from 'react';
import { WorkflowState, WorkflowStep, WorkflowStepId } from './types';
import { INITIAL_WORKFLOW_STEPS } from './constants';
import { showAlert } from '../shared/alerts';
import {
  loadWorkflowFile,
  saveWorkflowFile,
  workflowFileExists,
  loadApiKey,
  loadAppSettings,
  getWritingAssistantPrompt,
  loadWorkingCopyMeta,
  saveWorkingCopyMeta,
  saveSection,
  loadSection
} from '@/services/manuscriptStorage';

// Output filenames for each workflow step
const OUTPUT_FILES: Record<WorkflowStepId, string> = {
  brainstorm: 'brainstorm.txt',
  outline: 'outline.txt',
  world: 'world.txt',
  chapters: 'manuscript.txt'
};

export function useWritingAssistant(
  _currentProvider: string,
  _currentModel: string,
  _session: any,
  isDarkMode: boolean,
  onLoadFileIntoEditor?: (content: string, fileName: string, fileId?: string) => void,
  onModalCloseReopen?: () => void,
  onOpenChat?: () => void,
  onChapterAdded?: (chapterId: string) => void
) {
  const [state, setState] = useState<WorkflowState>({
    isModalOpen: false,
    currentStep: 0,
    steps: INITIAL_WORKFLOW_STEPS,
    isLoading: false,
    projectFiles: { chapters: [] }
  });

  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  // Check which files exist in IndexedDB
  const detectExistingFiles = useCallback(async () => {
    const [hasBrainstorm, hasOutline, hasWorld] = await Promise.all([
      workflowFileExists('brainstorm.txt'),
      workflowFileExists('outline.txt'),
      workflowFileExists('world.txt'),
    ]);

    // Check if Working Copy has any chapters
    const meta = await loadWorkingCopyMeta();
    let hasChapters = false;
    if (meta) {
      for (const id of meta.sectionIds) {
        const section = await loadSection(id);
        if (section?.type === 'chapter') {
          hasChapters = true;
          break;
        }
      }
    }

    return {
      brainstorm: hasBrainstorm ? { id: 'brainstorm.txt', name: 'brainstorm.txt', path: 'brainstorm.txt' } : undefined,
      outline: hasOutline ? { id: 'outline.txt', name: 'outline.txt', path: 'outline.txt' } : undefined,
      world: hasWorld ? { id: 'world.txt', name: 'world.txt', path: 'world.txt' } : undefined,
      manuscript: hasChapters ? { id: 'working-copy', name: 'chapters', path: 'working-copy' } : undefined,
      chapters: []
    };
  }, []);

  // Open modal and detect existing files
  const openModal = useCallback(async () => {
    setState(prev => ({ ...prev, isModalOpen: true, isLoading: true }));

    try {
      const existingFiles = await detectExistingFiles();
      const updatedSteps = updateStepsWithFiles(state.steps, existingFiles);

      setState(prev => ({
        ...prev,
        steps: updatedSteps,
        projectFiles: existingFiles,
        isLoading: false
      }));
    } catch (error) {
      console.error('Failed to detect existing files:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to load existing workflow files',
        isLoading: false
      }));
    }
  }, [state.steps, detectExistingFiles]);

  // Close modal
  const closeModal = useCallback(() => {
    setState(prev => ({ ...prev, isModalOpen: false }));
  }, []);

  // Open Chat for Brainstorm - loads brainstorm.txt as context
  const openChatForBrainstorm = useCallback(async (onClose?: () => void) => {
    // Close the modal first
    closeModal();
    if (onClose) {
      onClose();
    }

    // Load brainstorm content for context
    let brainstormContext: string | null = null;
    try {
      brainstormContext = await loadWorkflowFile('brainstorm.txt');
    } catch (error) {
      console.error('Failed to load brainstorm for chat context:', error);
    }

    // Store context in sessionStorage for SimpleChatModal to pick up
    if (brainstormContext) {
      sessionStorage.setItem('chatInitialContext', brainstormContext);
    }

    // Use callback if provided (preferred), otherwise fall back to DOM search
    if (onOpenChat) {
      setTimeout(() => onOpenChat(), 100);
      return;
    }

    // Fallback: Small delay to ensure modal is closed, then search DOM
    setTimeout(() => {
      try {
        // Find and click the Chat button, passing context if available
        let chatButton = document.getElementById('chat-button');
        if (!chatButton) {
          chatButton = document.querySelector('.chat-button');
        }
        if (!chatButton) {
          chatButton = document.querySelector('[data-component="chat"]');
        }
        if (!chatButton) {
          const buttons = Array.from(document.querySelectorAll('button'));
          chatButton = buttons.find(button =>
            button.textContent?.toLowerCase().includes('chat') ||
            button.getAttribute('aria-label')?.toLowerCase().includes('chat')
          ) as HTMLElement;
        }

        if (chatButton && typeof (chatButton as HTMLElement).click === 'function') {
          (chatButton as HTMLElement).click();
        } else {
          showAlert('Chat button not found. Please click the Chat button manually.', 'error', undefined, isDarkMode);
        }
      } catch (error) {
        console.error('Error finding/clicking Chat button:', error);
        showAlert('Could not open Chat. Please click the Chat button manually.', 'error', undefined, isDarkMode);
      }
    }, 100);
  }, [closeModal, isDarkMode, onOpenChat]);

  // Check if step can run based on file existence
  const canRunStep = useCallback((stepId: WorkflowStepId, files: any): { canRun: boolean; errorMessage?: string } => {
    if (stepId === 'brainstorm') {
      // Brainstorm needs the file to exist first (user creates it via Chat or Editor)
      if (!files.brainstorm) {
        return {
          canRun: false,
          errorMessage: 'Error: brainstorm.txt must exist.\nClick Chat or Editor to create story ideas in brainstorm.txt first.'
        };
      }
      return { canRun: true };
    }

    if (stepId === 'outline') {
      if (!files.brainstorm) {
        return {
          canRun: false,
          errorMessage: 'Error: brainstorm.txt must exist before creating an outline.'
        };
      }
      return { canRun: true };
    }

    if (stepId === 'world') {
      if (!files.outline) {
        return {
          canRun: false,
          errorMessage: 'Error: outline.txt must exist before building the world.'
        };
      }
      return { canRun: true };
    }

    if (stepId === 'chapters') {
      if (!files.outline) {
        return {
          canRun: false,
          errorMessage: 'Error: outline.txt must exist before writing chapters.'
        };
      }
      if (!files.world) {
        return {
          canRun: false,
          errorMessage: 'Error: world.txt must exist before writing chapters.'
        };
      }
      return { canRun: true };
    }

    return { canRun: true };
  }, []);

  // Execute workflow step - client-side OpenRouter API call
  const executeStep = useCallback(async (stepId: WorkflowStepId) => {
    // Get fresh file status
    const currentFiles = await detectExistingFiles();

    // Check prerequisites
    const { canRun, errorMessage } = canRunStep(stepId, currentFiles);
    if (!canRun) {
      showAlert(errorMessage || 'Cannot run this step', 'error', undefined, isDarkMode);
      return;
    }

    // Start timer
    const now = Date.now();
    const interval = setInterval(() => {
      setState(prev => ({
        ...prev,
        steps: prev.steps.map(step =>
          step.id === stepId && step.status === 'executing'
            ? { ...step, elapsedTime: Math.floor((Date.now() - now) / 1000) }
            : step
        )
      }));
    }, 1000) as unknown as number;

    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId
          ? { ...step, status: 'executing', startTime: now, elapsedTime: 0, timerInterval: interval }
          : step
      )
    }));

    try {
      // Load API key and model
      const apiKey = await loadApiKey();
      const settings = await loadAppSettings();

      if (!apiKey) {
        throw new Error('API key not configured. Please add your OpenRouter API key in Settings.');
      }
      if (!settings?.selectedModel) {
        throw new Error('AI model not selected. Please select a model in Settings.');
      }

      // Load AI Writing prompt (from separate IndexedDB storage)
      const toolPrompt = await getWritingAssistantPrompt(stepId);
      if (!toolPrompt) {
        throw new Error(`AI Writing prompt not found for ${stepId}. Please try reloading the app.`);
      }

      // Build context based on step
      let context = '';

      if (stepId === 'brainstorm') {
        // Brainstorm uses its own content as input
        const brainstormContent = await loadWorkflowFile('brainstorm.txt');
        context = brainstormContent || '';
      } else if (stepId === 'outline') {
        // Outline uses brainstorm as input
        const brainstormContent = await loadWorkflowFile('brainstorm.txt');
        context = `=== BRAINSTORM ===\n${brainstormContent || ''}\n=== END BRAINSTORM ===`;
      } else if (stepId === 'world') {
        // World uses outline as input
        const outlineContent = await loadWorkflowFile('outline.txt');
        context = `=== OUTLINE ===\n${outlineContent || ''}\n=== END OUTLINE ===`;
      } else if (stepId === 'chapters') {
        // Chapters uses outline + world + existing chapters from Working Copy
        const outlineContent = await loadWorkflowFile('outline.txt');
        const worldContent = await loadWorkflowFile('world.txt');

        // Build manuscript content from Working Copy chapters
        const meta = await loadWorkingCopyMeta();
        let manuscriptContent = '';
        if (meta) {
          for (const id of meta.sectionIds) {
            const section = await loadSection(id);
            if (section && section.type === 'chapter') {
              manuscriptContent += `\n\n${section.title}\n\n${section.content}`;
            }
          }
        }

        // Find next chapter to write
        const nextChapter = findNextChapter(outlineContent || '', manuscriptContent);

        context = `=== OUTLINE ===\n${outlineContent || ''}\n=== END OUTLINE ===\n\n` +
          `=== WORLD ===\n${worldContent || ''}\n=== END WORLD ===\n\n` +
          `=== EXISTING MANUSCRIPT ===\n${manuscriptContent}\n=== END EXISTING MANUSCRIPT ===\n\n` +
          `=== NEXT CHAPTER TO WRITE ===\n${nextChapter}\n=== END NEXT CHAPTER ===`;
      }

      // Build message
      const combinedContent = `${context}\n\n=== INSTRUCTIONS ===\n${toolPrompt}\n=== END INSTRUCTIONS ===`;

      // Client-side OpenRouter API call
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : 'https://everythingebooks.org',
          'X-Title': 'EverythingEbooks'
        },
        body: JSON.stringify({
          model: settings.selectedModel,
          messages: [{ role: 'user', content: combinedContent }],
          temperature: 0.7,
          max_tokens: 16000
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      const result = data.choices?.[0]?.message?.content || '';
      if (!result) {
        throw new Error('No response from AI');
      }

      // Save result to appropriate file
      const outputFile = OUTPUT_FILES[stepId];
      let newChapterId: string | null = null;

      if (stepId === 'chapters') {
        // Create new chapter in Working Copy structure
        const meta = await loadWorkingCopyMeta();
        if (!meta) {
          throw new Error('No manuscript loaded. Please create or open a manuscript first.');
        }

        // Extract chapter title from AI result (first line typically "Chapter X: Title")
        const firstLine = result.split('\n')[0]?.trim() || '';
        const chapterTitle = firstLine.startsWith('Chapter') ? firstLine : findNextChapter(
          await loadWorkflowFile('outline.txt') || '',
          ''
        );

        // Generate next section ID
        const numbers = meta.sectionIds.map(id => parseInt(id.split('-')[1] || '0') || 0);
        const nextNum = Math.max(0, ...numbers) + 1;
        newChapterId = `section-${String(nextNum).padStart(3, '0')}`;

        // Save new chapter section
        await saveSection({
          id: newChapterId,
          title: chapterTitle,
          content: result,
          type: 'chapter',
        });

        // Append to sectionIds and save meta
        meta.sectionIds.push(newChapterId);
        await saveWorkingCopyMeta(meta);
      } else {
        await saveWorkflowFile(outputFile, result);
      }

      // Clear timer and update state
      clearInterval(interval);

      // Refresh file status
      const refreshedFiles = await detectExistingFiles();

      setState(prev => ({
        ...prev,
        steps: prev.steps.map(step => {
          if (step.id === stepId) {
            return {
              ...step,
              status: 'completed',
              fileName: outputFile,
              fileId: outputFile,
              createdAt: new Date().toISOString(),
              timerInterval: undefined
            };
          }
          return step;
        }),
        projectFiles: refreshedFiles
      }));

      // For chapters, call onChapterAdded to refresh sidebar (modal stays open)
      // For other steps, trigger modal refresh
      if (stepId === 'chapters' && newChapterId && onChapterAdded) {
        setTimeout(() => onChapterAdded(newChapterId), 100);
      } else if (onModalCloseReopen) {
        setTimeout(() => onModalCloseReopen(), 100);
      }

    } catch (error) {
      clearInterval(interval);
      const errorMsg = error instanceof Error ? error.message : 'Execution failed';

      setState(prev => ({
        ...prev,
        steps: prev.steps.map(step => {
          if (step.id === stepId) {
            return {
              ...step,
              status: 'error',
              error: errorMsg,
              timerInterval: undefined
            };
          }
          return step;
        })
      }));

      showAlert(errorMsg, 'error', undefined, isDarkMode);
    }
  }, [detectExistingFiles, canRunStep, isDarkMode, onModalCloseReopen]);

  // View file content
  const viewFile = useCallback(async (stepId: WorkflowStepId) => {
    const fileName = OUTPUT_FILES[stepId];

    try {
      let content: string | null = null;

      if (stepId === 'chapters') {
        // Build manuscript view from Working Copy chapters
        const meta = await loadWorkingCopyMeta();
        if (meta) {
          let manuscriptContent = '';
          for (const id of meta.sectionIds) {
            const section = await loadSection(id);
            if (section?.type === 'chapter') {
              manuscriptContent += `\n\n${section.title}\n\n${section.content}`;
            }
          }
          content = manuscriptContent.trim();
        }
      } else {
        content = await loadWorkflowFile(fileName);
      }

      if (content && onLoadFileIntoEditor) {
        onLoadFileIntoEditor(content, fileName, fileName);
      } else if (!content && stepId === 'brainstorm' && onLoadFileIntoEditor) {
        // For brainstorm, open editor with default content if file doesn't exist
        const defaultContent = 'Type some of your ideas in here, so the AI can extend and enhance ...';
        onLoadFileIntoEditor(defaultContent, fileName);
      }
    } catch (error) {
      console.error('Failed to load file content:', error);
    }
  }, [onLoadFileIntoEditor]);

  // Redo step
  const redoStep = useCallback(async (stepId: WorkflowStepId) => {
    const currentFiles = await detectExistingFiles();
    const { canRun, errorMessage } = canRunStep(stepId, currentFiles);

    if (!canRun) {
      showAlert(errorMessage || 'Cannot run this step', 'error', undefined, isDarkMode);
      return;
    }

    // Reset step status and execute
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId
          ? { ...step, status: 'ready', error: undefined }
          : step
      )
    }));

    await executeStep(stepId);
  }, [detectExistingFiles, canRunStep, executeStep, isDarkMode]);

  // Edit prompt (AI Writing prompts stored separately in IndexedDB)
  const editPrompt = useCallback(async (stepId: WorkflowStepId) => {
    if (!onLoadFileIntoEditor || isLoadingPrompt) return;

    setIsLoadingPrompt(true);
    try {
      const content = await getWritingAssistantPrompt(stepId);
      if (content) {
        // Use special prefix to identify AI Writing prompts
        onLoadFileIntoEditor(content, `writing-assistant/${stepId}`, `wa:${stepId}`);
      } else {
        showAlert('Prompt not found', 'error', undefined, isDarkMode);
      }
    } catch (error) {
      console.error('Error loading prompt:', error);
      showAlert('Failed to load prompt', 'error', undefined, isDarkMode);
    } finally {
      setIsLoadingPrompt(false);
    }
  }, [onLoadFileIntoEditor, isLoadingPrompt, isDarkMode]);

  // Check if any step is executing
  const isAnyStepExecuting = state.steps.some(step => step.status === 'executing');

  return {
    state: {
      ...state,
      isAnyStepExecuting,
      isLoadingPrompt
    },
    actions: {
      openModal,
      closeModal,
      executeStep,
      viewFile,
      redoStep,
      editPrompt,
      openChatForBrainstorm
    }
  };
}

// Helper: Update steps based on file existence
function updateStepsWithFiles(steps: WorkflowStep[], existingFiles: any): WorkflowStep[] {
  return steps.map(step => {
    // Map chapters step to manuscript file
    const fileKey = step.id === 'chapters' ? 'manuscript' : step.id;
    const fileExists = existingFiles[fileKey];
    if (fileExists) {
      return {
        ...step,
        status: 'completed',
        fileName: fileExists.name,
        fileId: fileExists.path
      };
    }
    return { ...step, status: 'ready' };
  });
}

// Helper: Find next chapter to write based on outline vs manuscript
function findNextChapter(outline: string | undefined, manuscript: string | undefined): string {
  const outlineText = outline || '';
  const manuscriptText = manuscript || '';

  // Simple heuristic: look for "Chapter X" patterns in outline
  // and check which ones are missing from manuscript
  const chapterPattern = /Chapter\s+(\d+)/gi;
  const outlineChapters: number[] = [];
  const manuscriptChapters: number[] = [];

  let match;
  while ((match = chapterPattern.exec(outlineText)) !== null) {
    if (match[1]) outlineChapters.push(parseInt(match[1]));
  }

  chapterPattern.lastIndex = 0;
  while ((match = chapterPattern.exec(manuscriptText)) !== null) {
    if (match[1]) manuscriptChapters.push(parseInt(match[1]));
  }

  // Find first missing chapter
  for (const chapterNum of outlineChapters) {
    if (!manuscriptChapters.includes(chapterNum)) {
      return `Chapter ${chapterNum}`;
    }
  }

  // If no chapters found in outline, default to next sequential
  const maxManuscript = manuscriptChapters.length > 0 ? Math.max(...manuscriptChapters) : 0;
  return `Chapter ${maxManuscript + 1}`;
}
