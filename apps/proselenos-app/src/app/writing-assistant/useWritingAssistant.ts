// app/writing-assistant/useWritingAssistant.ts

import { useState, useCallback } from 'react';
import { WorkflowState, WorkflowStep, WorkflowStepId } from './types';
import { INITIAL_WORKFLOW_STEPS } from './constants';
import { 
  detectExistingWorkflowFilesAction,
  executeWorkflowStepAction,
  getWorkflowFileContentAction
} from '@/lib/writing-assistant/workflow-actions';
import { getToolPromptAction } from '@/lib/tools-actions';
import { showAlert } from '../shared/alerts';

export function useWritingAssistant(
  currentProjectId: string | null,
  currentProvider: string,
  currentModel: string,
  _session: any,
  isDarkMode: boolean,
  onLoadFileIntoEditor?: (content: string, fileName: string, fileId?: string) => void,
  onModalCloseReopen?: () => void
) {
  const [state, setState] = useState<WorkflowState>({
    isModalOpen: false,
    currentStep: 0,
    steps: INITIAL_WORKFLOW_STEPS,
    isLoading: false,
    projectFiles: { chapters: [] }
  });
  
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);

  // Open modal and detect existing files
  const openModal = useCallback(async () => {
    if (!currentProjectId) return;

    setState(prev => ({ ...prev, isModalOpen: true, isLoading: true }));

    try {
      const existingFiles = await detectExistingWorkflowFilesAction(currentProjectId);

      if (existingFiles.success && existingFiles.data) {
        const updatedSteps = await updateStepsWithFiles(state.steps, existingFiles.data);

        setState(prev => ({
          ...prev,
          steps: updatedSteps,
          projectFiles: existingFiles.data || { chapters: [] },
          isLoading: false
        }));
      } else {
        setState(prev => ({
          ...prev,
          error: 'Failed to load existing workflow files',
          isLoading: false
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to load existing workflow files',
        isLoading: false
      }));
    }
  }, [currentProjectId, state.steps]);

  // Close modal
  const closeModal = useCallback(() => {
    setState(prev => ({ ...prev, isModalOpen: false }));
  }, []);

  // Open Chat for Brainstorm - closes modal and clicks existing Chat button
  const openChatForBrainstorm = useCallback((onClose?: () => void) => {
    // Close the modal first (both internal state and parent modal)
    closeModal();
    if (onClose) {
      onClose();
    }
    
    // Small delay to ensure modal is closed before trying to find and click Chat button
    setTimeout(() => {
      try {
        // Try different selectors to find the existing Chat button
        let chatButton = null;
        
        // Try by ID first
        chatButton = document.getElementById('chat-button');
        
        // Try by common class names
        if (!chatButton) {
          chatButton = document.querySelector('.chat-button');
        }
        
        // Try by data attribute
        if (!chatButton) {
          chatButton = document.querySelector('[data-component="chat"]');
        }
        
        // Try by text content (less reliable but covers more cases)
        if (!chatButton) {
          const buttons = Array.from(document.querySelectorAll('button'));
          chatButton = buttons.find(button => 
            button.textContent?.toLowerCase().includes('chat') ||
            button.getAttribute('aria-label')?.toLowerCase().includes('chat')
          );
        }
        
        // Try to find any button with "Chat" in it (broader search)
        if (!chatButton) {
          const allElements = Array.from(document.querySelectorAll('*'));
          chatButton = allElements.find(el => 
            (el.tagName === 'BUTTON' || el.tagName === 'DIV' || el.tagName === 'A') &&
            el.textContent?.trim() === 'Chat'
          ) as HTMLElement;
        }
        
        if (chatButton && typeof (chatButton as HTMLElement).click === 'function') {
          (chatButton as HTMLElement).click();
        } else {
          console.warn('Chat button not found. Available buttons:', 
            Array.from(document.querySelectorAll('button')).map(btn => ({
              text: btn.textContent,
              id: btn.id,
              className: btn.className
            }))
          );
          
          showAlert('Chat button not found. Please click the Chat button manually.', 'error', undefined, isDarkMode);
        }
      } catch (error) {
        console.error('Error finding/clicking Chat button:', error);
        showAlert('Could not open Chat. Please click the Chat button manually.', 'error', undefined, isDarkMode);
      }
    }, 100);
  }, [closeModal, isDarkMode]);

  // Check file prerequisites
  const checkPrerequisites = useCallback((stepId: WorkflowStepId): { canRun: boolean; errorMessage?: string } => {
    const step = state.steps.find(s => s.id === stepId);
    if (!step) return { canRun: false, errorMessage: 'Step not found' };

    // Special check for brainstorm - it needs a file created in the Editor first
    if (stepId === 'brainstorm') {
      const brainstormFile = state.projectFiles.brainstorm;
      if (!brainstormFile || !brainstormFile.id) {
        return { 
          canRun: false, 
          errorMessage: `Error: brainstorm.txt must exist.\nClick on Chat or Editor to create some story ideas in a brainstorm.txt file.`
        };
      }
      return { canRun: true };
    }

    // Check prerequisites for other steps
    if (stepId === 'outline') {
      if (!state.projectFiles.brainstorm || !state.projectFiles.brainstorm.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: brainstorm.txt must exist before creating an outline. Please run Brainstorm first.'
        };
      }
    }

    if (stepId === 'world') {
      if (!state.projectFiles.outline || !state.projectFiles.outline.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: outline.txt must exist before building the world. Please run Outline first.'
        };
      }
    }

    if (stepId === 'chapters') {
      if (!state.projectFiles.outline || !state.projectFiles.outline.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: outline.txt must exist before writing chapters. Please run Outline first.'
        };
      }
      if (!state.projectFiles.world || !state.projectFiles.world.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: world.txt must exist before writing chapters. Please run World Builder first.'
        };
      }
    }

    return { canRun: true };
  }, [state.steps, state.projectFiles]);

  // Helper function to update dependent steps
  const updateDependentSteps = useCallback((completedStepId: WorkflowStepId) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step => {
        if (step.dependencies.includes(completedStepId)) {
          const allDependenciesCompleted = step.dependencies.every(depId =>
            prev.steps.find(s => s.id === depId)?.status === 'completed'
          );
          
          return allDependenciesCompleted 
            ? { ...step, status: 'ready' }
            : step;
        }
        return step;
      })
    }));
  }, []);

  // Execute workflow step with prerequisite check
  const executeStep = useCallback(async (stepId: WorkflowStepId) => {
    if (!currentProjectId) return;

    // ALWAYS get fresh file data before execution to avoid stale state issues
    const freshFiles = await detectExistingWorkflowFilesAction(currentProjectId);

    const currentFiles = freshFiles.success && freshFiles.data ? freshFiles.data : state.projectFiles;

    // Check prerequisites with fresh file data
    const { canRun, errorMessage } = checkPrerequisitesWithFiles(stepId, currentFiles);
    if (!canRun) {
      showAlert(errorMessage || 'Cannot run this step', 'error', undefined, isDarkMode);
      return;
    }

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
          ? { 
              ...step, 
              status: 'executing',
              startTime: now,
              elapsedTime: 0,
              timerInterval: interval
            } : step
      )
    }));

    try {
      const result = await executeWorkflowStepAction(
        stepId,
        '', // No userInput needed - files contain the content
        currentProjectId,
        currentProvider,
        currentModel,
        currentFiles // Use fresh files instead of potentially stale state.projectFiles
      );

      if (result.success) {
        // Refresh project files again after successful execution
        const refreshedFiles = await detectExistingWorkflowFilesAction(currentProjectId!);
        
        setState(prev => ({
          ...prev,
          steps: prev.steps.map(step => {
            if (step.id === stepId) {
              // Clear timer
              if (step.timerInterval) {
                clearInterval(step.timerInterval);
              }
              return {
                ...step, 
                status: 'completed',
                fileName: result.fileName,
                fileId: result.fileId,
                createdAt: new Date().toISOString(),
                timerInterval: undefined
              };
            }
            return step;
          }),
          projectFiles: refreshedFiles.success && refreshedFiles.data ? refreshedFiles.data : {
            ...prev.projectFiles,
            [stepId]: result.file
          }
        }));
        
        // Update dependent steps
        updateDependentSteps(stepId);

        // Close and reopen modal after successful execution
        if (onModalCloseReopen) {
          // Small delay to ensure UI updates are complete
          setTimeout(() => {
            onModalCloseReopen();
          }, 100);
        }
      } else {
        setState(prev => ({
          ...prev,
          steps: prev.steps.map(step => {
            if (step.id === stepId) {
              // Clear timer on error
              if (step.timerInterval) {
                clearInterval(step.timerInterval);
              }
              return {
                ...step, 
                status: 'error', 
                error: result.error,
                timerInterval: undefined
              };
            }
            return step;
          })
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        steps: prev.steps.map(step => {
          if (step.id === stepId) {
            // Clear timer on error
            if (step.timerInterval) {
              clearInterval(step.timerInterval);
            }
            return {
              ...step, 
              status: 'error', 
              error: 'Execution failed',
              timerInterval: undefined
            };
          }
          return step;
        })
      }));
    }
  }, [currentProjectId, currentProvider, currentModel, checkPrerequisites, updateDependentSteps, isDarkMode]);

  // Helper function to check prerequisites with provided files instead of state
  const checkPrerequisitesWithFiles = useCallback((stepId: WorkflowStepId, files: any): { canRun: boolean; errorMessage?: string } => {
    // Special check for brainstorm - it needs a file created in the Editor first
    if (stepId === 'brainstorm') {
      const brainstormFile = files.brainstorm;
      if (!brainstormFile || !brainstormFile.id) {
        return { 
          canRun: false, 
          errorMessage: `Error: brainstorm.txt must exist.\nClick on Chat or Editor to create some story ideas in a brainstorm.txt file.`
        };
      }
      return { canRun: true };
    }

    // Check prerequisites for other steps
    if (stepId === 'outline') {
      if (!files.brainstorm || !files.brainstorm.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: brainstorm.txt must exist before creating an outline. Please run Brainstorm first.'
        };
      }
    }

    if (stepId === 'world') {
      if (!files.outline || !files.outline.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: outline.txt must exist before building the world. Please run Outline first.'
        };
      }
    }

    if (stepId === 'chapters') {
      if (!files.outline || !files.outline.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: outline.txt must exist before writing chapters. Please run Outline first.'
        };
      }
      if (!files.world || !files.world.id) {
        return { 
          canRun: false, 
          errorMessage: 'Error: world.txt must exist before writing chapters. Please run World Builder first.'
        };
      }
    }

    return { canRun: true };
  }, []);

  // View file content
  const viewFile = useCallback(async (stepId: WorkflowStepId) => {
    const step = state.steps.find(s => s.id === stepId);

    // Special handling for brainstorm step - check if file exists in project files first
    if (stepId === 'brainstorm') {
      const fileName = step?.fileName || 'brainstorm.txt';
      const brainstormFile = state.projectFiles.brainstorm;

      const filePath = brainstormFile?.path || step?.fileId;
      if (filePath) {
        // File exists, load its content
        try {
          const result = await getWorkflowFileContentAction(filePath);
          if (result.success && result.content && onLoadFileIntoEditor) {
            onLoadFileIntoEditor(result.content, fileName, filePath);
          }
        } catch (error) {
          console.error('Failed to load file content:', error);
        }
      } else {
        // File doesn't exist yet, open editor with default content for brainstorm
        const defaultContent = 'Type some of your ideas in here, so the AI can extend and enhance ...';
        if (onLoadFileIntoEditor) {
          onLoadFileIntoEditor(defaultContent, fileName);
        }
      }
      return;
    }

    // Original logic for other steps
    if (!step?.fileId || !step?.fileName) return;

    try {
      const result = await getWorkflowFileContentAction(step.fileId);
      if (result.success && result.content && onLoadFileIntoEditor) {
        onLoadFileIntoEditor(result.content, step.fileName, step.fileId);
      }
    } catch (error) {
      console.error('Failed to load file content:', error);
    }
  }, [state.steps, onLoadFileIntoEditor]);

  // Redo step handler with prerequisite check
  const redoStep = useCallback(async (stepId: WorkflowStepId) => {
    // Check prerequisites before redoing
    const { canRun, errorMessage } = checkPrerequisites(stepId);
    if (!canRun) {
      showAlert(errorMessage || 'Cannot run this step', 'error', undefined, isDarkMode);
      return;
    }

    setState(prev => ({
      ...prev,
      steps: prev.steps.map(step =>
        step.id === stepId 
          ? { ...step, status: 'ready', error: undefined }
          : step
      )
    }));
    
    await executeStep(stepId);
  }, [checkPrerequisites, executeStep]);

  // Edit prompt handler - using existing AI Tools system
  const editPrompt = useCallback(async (stepId: WorkflowStepId) => {
    if (!onLoadFileIntoEditor || isLoadingPrompt) return;
    
    // Map workflow steps to existing AI Writing Tools prompts
    const toolPromptMap = {
      brainstorm: 'AI Writing Tools/brainstorm.txt',
      outline: 'AI Writing Tools/outline_writer.txt', 
      world: 'AI Writing Tools/world_writer.txt',
      chapters: 'AI Writing Tools/chapter_writer.txt'
    };
    
    const toolId = toolPromptMap[stepId];
    if (!toolId) return;
    
    setIsLoadingPrompt(true);
    try {
      const result = await getToolPromptAction(toolId);
      if (result.success && typeof result.content === 'string') {
        // Pass the file ID for proper existing file mode
        onLoadFileIntoEditor(result.content, `tool-prompts/${toolId}`, result.fileId);
      } else {
        console.error('Failed to load workflow prompt:', result.error);
      }
    } catch (error) {
      console.error('Error loading workflow prompt:', error);
    } finally {
      setIsLoadingPrompt(false);
    }
  }, [onLoadFileIntoEditor, isLoadingPrompt]);

  // Check if any step is currently executing
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
      openChatForBrainstorm // New action for Chat button
    }
  };
}

// Helper function to update steps based on existing files
async function updateStepsWithFiles(
  steps: WorkflowStep[], 
  existingFiles: any
): Promise<WorkflowStep[]> {
  return steps.map(step => {
    const fileExists = existingFiles[step.id];
    if (fileExists && (Array.isArray(fileExists) ? fileExists.length > 0 : fileExists)) {
      const file = Array.isArray(fileExists) ? fileExists[0] : fileExists;

      return {
        ...step,
        status: 'completed',
        fileName: file.name,
        fileId: file.path || file.id,
        createdAt: file.modifiedTime || file.createdTime
      };
    }
    
    // All steps start as ready (no more pending/blocked states)
    return {
      ...step,
      status: 'ready'
    };
  });
}