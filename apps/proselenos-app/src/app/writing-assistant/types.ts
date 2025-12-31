// app/writing-assistant/types.ts

export type WorkflowStepId = 'brainstorm' | 'outline' | 'world' | 'chapters';

export type StepStatus = 
  | 'ready'       // Can start now (default state)
  | 'executing'   // Currently running
  | 'completed'   // Successfully finished
  | 'error';      // Failed execution

export interface WorkflowStep {
  id: WorkflowStepId;
  name: string;
  description: string;
  status: StepStatus;
  dependencies: WorkflowStepId[];
  fileName?: string;
  fileId?: string;
  createdAt?: string;
  error?: string;
  startTime?: number;
  elapsedTime?: number;
  timerInterval?: number;
}

export interface WorkflowFile {
  id: string;
  name: string;
  path?: string;
  content?: string;
  createdAt?: string;
  size?: number;
}

export interface WorkflowState {
  isModalOpen: boolean;
  currentStep: number;
  steps: WorkflowStep[];
  isLoading: boolean;
  error?: string;
  isAnyStepExecuting?: boolean;
  projectFiles: {
    brainstorm?: WorkflowFile;
    outline?: WorkflowFile;
    world?: WorkflowFile;
    chapters: WorkflowFile[];
  };
}

export interface WritingAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: any; // Will use existing ThemeConfig
  isDarkMode: boolean;
  currentProvider: string;
  currentModel: string;
  session: any;
  onLoadFileIntoEditor?: (content: string, fileName: string, fileId?: string) => void;
  onModalCloseReopen?: () => void;
  onOpenChat?: () => void;
  onChapterAdded?: (chapterId: string) => void;
}

export interface WorkflowStepProps {
  step: WorkflowStep;
  isActive: boolean;
  onExecute: (stepId: WorkflowStepId) => Promise<void>;
  onView: (stepId: WorkflowStepId) => void;
  onRedo: (stepId: WorkflowStepId) => Promise<void>;
  onEditPrompt: (stepId: WorkflowStepId) => Promise<void>;
  isExecuting: boolean;
  isAnyStepExecuting: boolean;
  isLoadingPrompt: boolean;
  theme: any;
  onClose?: () => void;
  onOpenChatForBrainstorm?: (onClose?: () => void) => void; // Updated to accept onClose parameter
}

export interface StepActionsProps {
  step: WorkflowStep;
  onExecute: () => Promise<void>;
  onView: () => void;
  onRedo: () => Promise<void>;
  isExecuting: boolean;
  isAnyStepExecuting: boolean;
  theme: any;
  onClose?: () => void;
  onOpenChatForBrainstorm?: (onClose?: () => void) => void; // Updated to accept onClose parameter
}