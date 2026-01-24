// app/writing-assistant/useWritingAssistant.ts
// Local-first: IndexedDB + client-side OpenRouter API calls

import { useState, useCallback } from 'react';
import { WorkflowState, WorkflowStep, WorkflowStepId } from './types';
import { INITIAL_WORKFLOW_STEPS } from './constants';
import { showAlert } from '../shared/alerts';
import {
  loadApiKey,
  loadAppSettings,
  getWritingAssistantPrompt,
  loadWorkingCopyMeta,
  saveWorkingCopyMeta,
  loadManuscriptMeta,
  loadSectionXhtml,
  saveSection,
  loadSection
} from '@/services/manuscriptStorage';
import { xhtmlToPlainText } from '@/lib/plateXhtml';

// Map workflow step IDs to manuscript section IDs and titles
const SECTION_MAP: Record<'brainstorm' | 'outline' | 'world', { id: string; title: string }> = {
  brainstorm: { id: 'brainstorm', title: 'Brainstorm' },
  outline: { id: 'outline', title: 'Outline' },
  world: { id: 'world', title: 'World' },
};

export function useWritingAssistant(
  _currentProvider: string,
  _currentModel: string,
  _session: any,
  isDarkMode: boolean,
  onLoadFileIntoEditor?: (content: string, fileName: string, fileId?: string) => void,
  _onModalCloseReopen?: () => void,
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

  // Check which sections exist in manuscript (find by title, case-insensitive)
  const detectExistingFiles = useCallback(async () => {
    const meta = await loadManuscriptMeta();
    const sections = meta?.sections || [];

    const brainstormSection = sections.find(s => s.title.toLowerCase().trim() === 'brainstorm');
    const outlineSection = sections.find(s => s.title.toLowerCase().trim() === 'outline');
    const worldSection = sections.find(s => s.title.toLowerCase().trim() === 'world');
    const hasChapters = sections.some(s => s.type === 'chapter');

    return {
      brainstorm: brainstormSection ? { id: brainstormSection.id, name: 'Brainstorm', path: brainstormSection.id } : undefined,
      outline: outlineSection ? { id: outlineSection.id, name: 'Outline', path: outlineSection.id } : undefined,
      world: worldSection ? { id: worldSection.id, name: 'World', path: worldSection.id } : undefined,
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

    // Load brainstorm content from manuscript section for context
    let brainstormContext: string | null = null;
    try {
      const brainstormId = state.projectFiles.brainstorm?.id || SECTION_MAP.brainstorm.id;
      const xhtml = await loadSectionXhtml(brainstormId);
      brainstormContext = xhtml ? xhtmlToPlainText(xhtml) : null;
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
      return { canRun: true };
    }

    if (stepId === 'outline') {
      if (!files.brainstorm) {
        return {
          canRun: false,
          errorMessage: 'Error: Brainstorm section must exist before creating an outline.\nClick Run on Brainstorm first, then use Chat to add ideas.'
        };
      }
      return { canRun: true };
    }

    if (stepId === 'world') {
      if (!files.outline) {
        return {
          canRun: false,
          errorMessage: 'Error: Outline section must exist before building the world.'
        };
      }
      return { canRun: true };
    }

    if (stepId === 'chapters') {
      if (!files.outline) {
        return {
          canRun: false,
          errorMessage: 'Error: Outline section must exist before writing chapters.'
        };
      }
      if (!files.world) {
        return {
          canRun: false,
          errorMessage: 'Error: World section must exist before writing chapters.'
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

    // For brainstorm: auto-create blank section if it doesn't exist
    if (stepId === 'brainstorm' && !currentFiles.brainstorm) {
      const info = SECTION_MAP.brainstorm;
      await saveSection({
        id: info.id,
        title: info.title,
        xhtml: '<p></p>',
        type: 'no-matter',
      });
      // Refresh file detection and update state
      const refreshedFiles = await detectExistingFiles();
      setState(prev => ({
        ...prev,
        steps: prev.steps.map(step =>
          step.id === 'brainstorm'
            ? { ...step, status: 'completed' as const, fileName: info.id, fileId: info.id }
            : step
        ),
        projectFiles: refreshedFiles
      }));
      // Notify parent to refresh sidebar
      if (onChapterAdded) onChapterAdded(info.id);
      return; // Don't call AI — user should Chat to fill content first
    }

    // For outline: verify brainstorm has actual content
    if (stepId === 'outline') {
      const bId = currentFiles.brainstorm?.id || SECTION_MAP.brainstorm.id;
      const brainstormXhtml = await loadSectionXhtml(bId);
      const brainstormText = brainstormXhtml ? xhtmlToPlainText(brainstormXhtml) : '';
      if (!brainstormText.trim()) {
        showAlert('Error: Brainstorm is empty.\nUse Chat to add story ideas before creating an outline.', 'error', undefined, isDarkMode);
        return;
      }
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
        const bId = currentFiles.brainstorm?.id || SECTION_MAP.brainstorm.id;
        const brainstormXhtml = await loadSectionXhtml(bId);
        context = brainstormXhtml ? xhtmlToPlainText(brainstormXhtml) : '';
      } else if (stepId === 'outline') {
        // Outline uses brainstorm as input
        const bId = currentFiles.brainstorm?.id || SECTION_MAP.brainstorm.id;
        const brainstormXhtml = await loadSectionXhtml(bId);
        const brainstormContent = brainstormXhtml ? xhtmlToPlainText(brainstormXhtml) : '';
        context = `=== BRAINSTORM ===\n${brainstormContent}\n=== END BRAINSTORM ===`;
      } else if (stepId === 'world') {
        // World uses outline as input
        const oId = currentFiles.outline?.id || SECTION_MAP.outline.id;
        const outlineXhtml = await loadSectionXhtml(oId);
        const outlineContent = outlineXhtml ? xhtmlToPlainText(outlineXhtml) : '';
        context = `=== OUTLINE ===\n${outlineContent}\n=== END OUTLINE ===`;
      } else if (stepId === 'chapters') {
        // Chapters uses outline + world + existing chapters from Working Copy
        const oId = currentFiles.outline?.id || SECTION_MAP.outline.id;
        const outlineXhtml = await loadSectionXhtml(oId);
        const outlineContent = outlineXhtml ? xhtmlToPlainText(outlineXhtml) : '';
        const wId = currentFiles.world?.id || SECTION_MAP.world.id;
        const worldXhtml = await loadSectionXhtml(wId);
        const worldContent = worldXhtml ? xhtmlToPlainText(worldXhtml) : '';

        // Build manuscript content from Working Copy chapters
        // XHTML-Native: Convert xhtml to plain text for AI
        const meta = await loadWorkingCopyMeta();
        let manuscriptContent = '';
        if (meta) {
          for (const id of meta.sectionIds) {
            const section = await loadSection(id);
            if (section && section.type === 'chapter') {
              const plainText = xhtmlToPlainText(section.xhtml);
              // Only count chapters with actual content as "written"
              if (plainText.trim()) {
                manuscriptContent += `\n\n${section.title}\n\n${plainText}`;
              }
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

      // Save result as a manuscript section
      let savedSectionId: string | null = null;
      let chapterLabel = '';

      if (stepId === 'chapters') {
        // Create new chapter in Working Copy structure
        const meta = await loadWorkingCopyMeta();
        if (!meta) {
          throw new Error('No manuscript loaded. Please create or open a manuscript first.');
        }

        // Extract chapter title from AI result (first line typically "Chapter X: Title")
        const firstLine = result.split('\n')[0]?.trim() || '';
        const outForTitleId = currentFiles.outline?.id || SECTION_MAP.outline.id;
        const outlineForTitle = await loadSectionXhtml(outForTitleId);
        // Only trust firstLine if it matches "Chapter N" pattern (not just startsWith)
        const chapterTitle = /^Chapter\s+\d+/i.test(firstLine) ? firstLine : findNextChapter(
          outlineForTitle ? xhtmlToPlainText(outlineForTitle) : '',
          ''
        );

        // Build a short label for display (e.g., "chapter 2")
        const chMatch = chapterTitle.match(/^(Chapter\s+\d+)/i);
        chapterLabel = chMatch ? chMatch[1].toLowerCase() : `chapter`;

        // Check if there's an existing empty chapter to overwrite
        let existingEmptyId: string | null = null;
        for (const id of meta.sectionIds) {
          const section = await loadSection(id);
          if (section && section.type === 'chapter') {
            const plainText = xhtmlToPlainText(section.xhtml);
            if (!plainText.trim()) {
              existingEmptyId = id;
              break;
            }
          }
        }

        // Convert AI result (plain text) to XHTML
        const xhtml = result.split('\n\n')
          .map((p: string) => `<p>${escapeHtml(p.trim())}</p>`)
          .filter((p: string) => p !== '<p></p>')
          .join('\n') || '<p></p>';

        if (existingEmptyId) {
          // Overwrite the existing empty chapter
          savedSectionId = existingEmptyId;
          await saveSection({
            id: savedSectionId,
            title: chapterTitle,
            xhtml: xhtml,
            type: 'chapter',
          });
        } else {
          // Generate next section ID and create new chapter
          const numbers = meta.sectionIds.map(id => parseInt(id.split('-')[1] || '0') || 0);
          const nextNum = Math.max(0, ...numbers) + 1;
          savedSectionId = `section-${String(nextNum).padStart(3, '0')}`;

          await saveSection({
            id: savedSectionId,
            title: chapterTitle,
            xhtml: xhtml,
            type: 'chapter',
          });

          // Only append to sectionIds for truly new sections
          meta.sectionIds.push(savedSectionId);
          await saveWorkingCopyMeta(meta);
        }
      } else {
        // brainstorm, outline, or world - save as no-matter section
        const info = SECTION_MAP[stepId as 'brainstorm' | 'outline' | 'world'];
        const existingId = currentFiles[stepId as 'brainstorm' | 'outline' | 'world']?.id;
        savedSectionId = existingId || info.id;

        // Convert plain text AI result to XHTML paragraphs
        const xhtml = result.split('\n\n')
          .map((p: string) => `<p>${escapeHtml(p.trim())}</p>`)
          .filter((p: string) => p !== '<p></p>')
          .join('\n') || '<p></p>';

        await saveSection({
          id: savedSectionId,
          title: info.title,
          xhtml,
          type: 'no-matter',
        });
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
              fileName: stepId === 'chapters' ? chapterLabel : (savedSectionId || stepId),
              fileId: savedSectionId || stepId,
              createdAt: new Date().toISOString(),
              timerInterval: undefined
            };
          }
          return step;
        }),
        projectFiles: refreshedFiles
      }));

      // Call onChapterAdded to refresh sidebar and select the new section
      if (savedSectionId && onChapterAdded) {
        setTimeout(() => onChapterAdded(savedSectionId!), 100);
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
  }, [detectExistingFiles, canRunStep, isDarkMode, onChapterAdded]);

  // View section content - select it in the sidebar/editor
  const viewFile = useCallback(async (stepId: WorkflowStepId) => {
    if (stepId === 'brainstorm' || stepId === 'outline' || stepId === 'world') {
      const sectionId = state.projectFiles[stepId]?.id || SECTION_MAP[stepId].id;
      // Check if section exists
      const meta = await loadManuscriptMeta();
      const exists = meta?.sections.some(s => s.id === sectionId) ?? false;

      if (exists && onChapterAdded) {
        // Select the section in the sidebar/editor
        onChapterAdded(sectionId);
      } else if (!exists && stepId === 'brainstorm' && onLoadFileIntoEditor) {
        // For brainstorm, open editor with default content if section doesn't exist
        const defaultContent = 'Type some of your ideas in here, so the AI can extend and enhance ...';
        onLoadFileIntoEditor(defaultContent, 'Brainstorm', SECTION_MAP.brainstorm.id);
      }
    } else if (stepId === 'chapters' && onChapterAdded) {
      // Find the last chapter and select it
      const meta = await loadWorkingCopyMeta();
      if (meta) {
        // Find the last chapter section
        for (let i = meta.sectionIds.length - 1; i >= 0; i--) {
          const sId = meta.sectionIds[i];
          if (!sId) continue;
          const section = await loadSection(sId);
          if (section?.type === 'chapter') {
            onChapterAdded(section.id);
            break;
          }
        }
      }
    }
  }, [onLoadFileIntoEditor, onChapterAdded, state.projectFiles]);

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

// Helper: Escape HTML special characters
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
