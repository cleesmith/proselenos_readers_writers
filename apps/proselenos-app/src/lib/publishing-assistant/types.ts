// Publishing Assistant Types
// Progress-based workflow for manuscript publishing

export type PublishingStepId = 'html' | 'cover' | 'epub' | 'pdf' | 'complete';

export type FileType = 'html' | 'epub' | 'pdf';

export interface FileState {
  isProcessing: boolean;     // Currently generating this file
  createdInSession: boolean; // File was successfully created in THIS session
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

export interface CoverImageState {
  file: File | null;
  previewUrl: string | null;
  base64: string | null;        // For sending to server actions
  width: number | null;
  height: number | null;
  warning: string | null;       // Warning if image is too small
  isProcessing: boolean;
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
  publishToStore: boolean;
  coverImage: CoverImageState;
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