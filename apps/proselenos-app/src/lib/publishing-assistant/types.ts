// Publishing Assistant Types
// Progress-based workflow for manuscript publishing

export type PublishingStepId = 'html' | 'cover' | 'epub' | 'pdf' | 'complete';

export type FileType = 'html' | 'epub' | 'pdf';

export interface FileState {
  exists: boolean;
  isProcessing: boolean;
  error?: string;
}

export type ProgressStatus = 
  | 'pending'     // Not started yet
  | 'active'      // Currently processing
  | 'completed'   // Successfully finished
  | 'error';      // Failed with error

export interface PublishingStep {
  id: PublishingStepId;
  name: string;
  description: string;
  status: ProgressStatus;
  message?: string;
  error?: string;
}

export interface PublishingProgress {
  currentStep: number;
  steps: PublishingStep[];
  isProcessing: boolean;
  isComplete: boolean;
  error?: string;
  generatedFiles: string[];
  stats?: {
    chapterCount: number;
    wordCount: number;
    pageCount?: number;
  };
}

export interface PublishingAssistantState {
  isModalOpen: boolean;
  selectedManuscript: any | null;
  showFileSelector: boolean;
  files: any[];
  progress: PublishingProgress;
  fileStates: {
    html: FileState;
    epub: FileState;
    pdf: FileState;
  };
}

export interface PublishingAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProject: string | null;
  currentProjectId: string | null;
  theme: any; // ThemeConfig
  isDarkMode: boolean;
}

export interface ProgressStepProps {
  step: PublishingStep;
  isActive: boolean;
  theme: any;
  fileState?: FileState;
  onAction?: () => void;
}