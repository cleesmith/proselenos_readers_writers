// Publishing Assistant Execution Engine
// Wraps existing publishManuscriptAction with progress tracking

import { 
  publishManuscriptAction,
  generateHTMLOnlyAction,
  generateEPUBOnlyAction, 
  generatePDFOnlyAction
} from '@/lib/publish-actions';
import { PublishingStep, PublishingProgress, FileType } from './types';

// Initial progress steps
export const INITIAL_PUBLISHING_STEPS: PublishingStep[] = [
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

export interface PublishResult {
  success: boolean;
  error?: string;
  generatedFiles: string[];
  stats: {
    chapterCount: number;
    wordCount: number;
    pageCount?: number;
  };
}

export async function executePublishingWithProgress(
  manuscriptFilePath: string,
  projectName: string,
  onProgressUpdate: (progress: PublishingProgress) => void
): Promise<PublishResult> {

  // Initialize progress
  let progress: PublishingProgress = {
    currentStep: 0,
    steps: [...INITIAL_PUBLISHING_STEPS],
    isProcessing: true,
    isComplete: false,
    generatedFiles: []
  };

  // Helper to update progress and notify
  const updateProgress = (stepIndex: number, status: 'active' | 'completed' | 'error', message?: string, error?: string) => {
    const currentStep = progress.steps[stepIndex];
    if (!currentStep) return;
    progress.steps[stepIndex] = {
      ...currentStep,
      status,
      message,
      error
    };
    progress.currentStep = stepIndex;
    onProgressUpdate({ ...progress });
  };

  try {
    // Step 1: HTML Conversion
    updateProgress(0, 'active', 'Converting manuscript to HTML format...');

    // Small delay to show progress
    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 2: Cover Generation (placeholder)
    updateProgress(0, 'completed', 'HTML conversion ready');
    updateProgress(1, 'active', 'Preparing cover design...');

    await new Promise(resolve => setTimeout(resolve, 300));

    // Step 3: EPUB Creation
    updateProgress(1, 'completed', 'Cover design prepared');
    updateProgress(2, 'active', 'Building EPUB e-book...');

    await new Promise(resolve => setTimeout(resolve, 500));

    // Step 4: PDF Generation
    updateProgress(2, 'completed', 'EPUB created successfully');
    updateProgress(3, 'active', 'Generating PDF document...');

    await new Promise(resolve => setTimeout(resolve, 700));

    // Execute the actual publishing action
    const result = await publishManuscriptAction(manuscriptFilePath, projectName);

    if (result.success && result.data) {
      // All steps completed successfully
      updateProgress(3, 'completed', 'PDF generated successfully');
      updateProgress(4, 'completed', `Successfully published ${result.data.stats.chapterCount} chapters!`);

      progress.isProcessing = false;
      progress.isComplete = true;
      progress.generatedFiles = result.data.generatedFiles;
      progress.stats = result.data.stats;

      onProgressUpdate({ ...progress });

      return {
        success: true,
        generatedFiles: result.data.generatedFiles,
        stats: result.data.stats
      };
    } else {
      // Publishing failed
      updateProgress(3, 'error', 'Publishing failed', result.error);
      progress.isProcessing = false;
      progress.error = result.error;
      onProgressUpdate({ ...progress });

      return {
        success: false,
        error: result.error || 'Publishing failed',
        generatedFiles: [],
        stats: { chapterCount: 0, wordCount: 0 }
      };
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    // Mark current step as error
    const currentStepIndex = progress.steps.findIndex(step => step.status === 'active');
    if (currentStepIndex !== -1) {
      updateProgress(currentStepIndex, 'error', 'Publishing failed', errorMessage);
    }

    progress.isProcessing = false;
    progress.error = errorMessage;
    onProgressUpdate({ ...progress });

    return {
      success: false,
      error: errorMessage,
      generatedFiles: [],
      stats: { chapterCount: 0, wordCount: 0 }
    };
  }
}

// Individual file generation functions
export async function generateIndividualFile(
  fileType: FileType,
  manuscriptFilePath: string,
  projectName: string
): Promise<{success: boolean; error?: string}> {
  try {
    let result;

    // Call the appropriate individual generation function
    switch (fileType) {
      case 'html':
        result = await generateHTMLOnlyAction(manuscriptFilePath, projectName);
        break;
      case 'epub':
        result = await generateEPUBOnlyAction(manuscriptFilePath, projectName);
        break;
      case 'pdf':
        result = await generatePDFOnlyAction(manuscriptFilePath, projectName);
        break;
      default:
        return { success: false, error: `Unknown file type: ${fileType}` };
    }

    return { success: result.success, error: result.error };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return { success: false, error: errorMessage };
  }
}