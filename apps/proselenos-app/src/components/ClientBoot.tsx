// Modified version of ClientBoot.tsx

// This file mirrors the structure of the original `components/ClientBoot.tsx` from
// the Proselenos project for the Authors mode integration.

'use client';

import { useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import ProselenosHeader from '../app/proselenos/proselenosHeader';
import SettingsDialog from '../components/SettingsDialog';
import ModelsDropdown from '../components/ModelsDropdown';
import EditorModal from '../app/proselenos/EditorModal';
import ProjectSection from '../app/projects/ProjectSection';
import ProjectSelectorModal from '../app/projects/ProjectSelectorModal';
import LocalDocxImportModal from '../app/projects/LocalDocxImportModal';
import ExportModal from '../app/projects/ExportModal';
import FilesModal from '../app/projects/FilesModal';
import { useProjectManager } from '../app/projects/useProjectManager';
import AIToolsSection from '../app/ai-tools/AIToolsSection';
import FileSelectorModal from '../app/ai-tools/FileSelectorModal';
import { useToolsManager } from '../app/ai-tools/useToolsManager';
import NonAIToolsSection from '../app/non-ai-tools/NonAIToolsSection';
import { useNonAITools } from '../app/non-ai-tools/useNonAITools';
import { getTheme } from '../app/shared/theme';
import { showAlert, showStickyErrorWithLogout } from '../app/shared/alerts';
import AboutModal from '../components/AboutModal';
import {
  getproselenosConfigAction,
  installToolPromptsAction,
  updateSelectedModelAction,
  updateDarkModeAction,
} from '@/lib/config-actions';
import {
  createOrUpdateFileAction,
  readFileAction,
  listTxtFilesAction,
} from '@/lib/project-actions';
import {
  loadBookMetadataAction,
  saveBookMetadataAction,
} from '@/lib/project-actions';
import { hasApiKeyAction } from '@/lib/api-key-actions';
import ProjectSettingsModal, { ProjectMetadata } from '../app/projects/ProjectSettingsModal';
import type { InitPayloadForClient } from '../lib/fastInitServer';

// Helper function to sanitize error messages for user display
// Removes provider-specific details while keeping logs intact
const sanitizeErrorMessage = (error: string | undefined): string => {
  if (!error) return 'An unexpected error occurred.';

  // Strip docs URLs from error messages
  const withoutUrls = error.replace(/\s*-\s*https:\/\/[^\s]+/g, '');

  // Map common errors to user-friendly messages
  if (error.includes('Bad credentials') || error.includes('401')) {
    return 'Authentication failed. Please sign out and sign in again.';
  }
  if (error.includes('403') || error.includes('Forbidden')) {
    return 'Access denied. Please check your credentials.';
  }
  if (error.includes('404') || error.includes('Not Found')) {
    return 'Resource not found.';
  }
  if (error.includes('network') || error.includes('ENOTFOUND')) {
    return 'Connection failed. Please check your internet connection.';
  }

  // Default: strip URLs and return
  return withoutUrls.trim() || 'An unexpected error occurred.';
};

export default function ClientBoot({ init }: { init: InitPayloadForClient | null }) {
  const { data: session, status } = useSession();
  
  // Projects Domain State
  const [projectState, projectActions] = useProjectManager();
  
  // AI Tools Domain State
  const [toolsState, toolsActions] = useToolsManager();
  
  // Non-AI Tools Domain State
  const [nonAIToolsState, nonAIToolsActions] = useNonAITools();
  
  // Core app state
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(init?.config?.isDarkMode ?? false);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [currentFileName, setCurrentFileName] = useState<string | null>(null);
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showModelsDropdown, setShowModelsDropdown] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('openrouter');
  const [currentModel, setCurrentModel] = useState('');
  const [hasConfiguredProvider, setHasConfiguredProvider] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isStorageOperationPending, setIsStorageOperationPending] = useState(false);
  const [hasCheckedToolPrompts, setHasCheckedToolPrompts] = useState(false);
  const [isInstallingToolPrompts, setIsInstallingToolPrompts] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [hasShownReadyModal, setHasShownReadyModal] = useState(false);
  const [isSystemInitializing, setIsSystemInitializing] = useState(true);
  const [initFailed, setInitFailed] = useState(false);
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | undefined>(undefined);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  // Editor TXT file selector state
  const [showEditorFileSelector, setShowEditorFileSelector] = useState(false);
  const [editorFileSelectorFiles, setEditorFileSelectorFiles] = useState<any[]>([]);

  const theme = getTheme(isDarkMode);

  // Utility: add a timeout to any promise to prevent hangs during initialization
  const withTimeout = useCallback(async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        const id = setTimeout(() => {
          clearTimeout(id);
          reject(new Error(`${label} timed out after ${ms}ms`));
        }, ms);
      }),
    ]) as T;
  }, []);

  // Initialize from fast init payload
  useEffect(() => {
    if (!init) return;

    // Hydrate config settings
    if (init.config?.settings.current_project) {
      projectActions.setCurrentProject(init.config.settings.current_project);
      projectActions.setCurrentProjectId(init.config.settings.current_project_folder_id);
      projectActions.setUploadStatus(`✅ Project loaded: ${init.config.settings.current_project}`);
    }
    if (init.config?.selectedApiProvider) {
      setCurrentProvider(init.config.selectedApiProvider);
      setHasConfiguredProvider(true);
    }
    if (init.config?.selectedAiModel) {
      setCurrentModel(init.config.selectedAiModel);
    }

    // Hydrate tools
    const allTools = Object.entries(init.toolsByCategory).flatMap(([category, tools]) =>
      tools.map((t) => ({
        id: `${category}/${t.name}`, // Use category/filename format instead of file ID
        name: t.name.replace(/\.(txt|md|json)$/i, ''),
        category,
      }))
    );
    toolsActions.setAvailableTools(allTools);
    toolsActions.setToolsReady(true);
    
    console.log(`Fast init completed in ${init.durationMs}ms`);
  }, [init]); // Removed projectActions and toolsActions from dependencies

  // Check tool-prompts installation status after fast init
  useEffect(() => {
    const checkToolPromptsStatus = async () => {
      // Only run once per session/init
      if (!session?.accessToken || hasCheckedToolPrompts || !init) return;
      
      try {
        // If there are no tool categories at all, we need to install the tool-prompts folder
        if (Object.keys(init.toolsByCategory).length === 0) {
          setIsInstallingToolPrompts(true);
          setIsStorageOperationPending(true);
          
          try {
            // Initialize tool prompts from defaults
            const installResult = await installToolPromptsAction();

            if (installResult.success) {
              // Tools ready from template
              setIsStorageOperationPending(false);
              // Do NOT load tools here; first-time users will load them when they create the first project
            } else {
              // Installation failed: show an error modal and mark init as failed
              setIsStorageOperationPending(false);
              setIsInstallingToolPrompts(false);
              setInitFailed(true);

              const errorMsg = installResult.message || installResult.error || 'Unknown error';
              showStickyErrorWithLogout('Initialization failed', `Tool-prompts install failed: ${sanitizeErrorMessage(errorMsg)}`, isDarkMode);
              return;
            }
          } catch (error) {
            // Catch runtime errors during installation (network issues, timeouts, etc.)
            setIsStorageOperationPending(false);
            setIsInstallingToolPrompts(false);
            setInitFailed(true);

            const msg = error instanceof Error ? error.message : String(error);
            showStickyErrorWithLogout(
              'Initialization error',
              `Something went wrong setting up your workspace: ${sanitizeErrorMessage(msg)}

  Please try signing in again. If the problem persists, check your internet connection.`,
              isDarkMode
            );
            return;
          } finally {
            // Whether success or failure, stop showing the install spinner
            setIsInstallingToolPrompts(false);
          }
        } else {
          // Tool prompts already exist in storage
          setIsStorageOperationPending(false);
          // Load tools immediately if they haven't been loaded yet
          if (!toolsState.toolsReady) {
            try {
              await toolsActions.loadAvailableTools(isDarkMode);
            } catch (err) {
              console.error('Error loading AI tools:', err);
            }
          }
        }
      } catch (error) {
        console.error('Error checking tool-prompts installation:', error);
      } finally {
        // Mark that we have performed this check so it doesn’t run again
        setHasCheckedToolPrompts(true);
      }
    };
    
    // Start the check after the fast-init payload is available
    if (init) {
      checkToolPromptsStatus();
    }
    // Depend on toolsState.toolsReady to avoid stale closures
  }, [
    session,
    hasCheckedToolPrompts,
    isDarkMode,
    init,
    toolsState.toolsReady,
    toolsActions,
    isInstallingToolPrompts,
  ]);

  // Supabase user is created on sign-in via NextAuth handler
  // Just mark storage as ready when session exists
  useEffect(() => {
    if (session?.user?.id && !hasCheckedStorage) {
      setIsStorageReady(true);
      setHasCheckedStorage(true);
    }
  }, [session?.user?.id, hasCheckedStorage]);

  // Helper function to get loading status
  const getLoadingStatus = () => {
    const checks = [
      { name: 'Storage', ready: isStorageReady },
      { name: 'AI Tools', ready: toolsState.toolsReady },
      { name: 'Authentication', ready: !!session?.accessToken },
      { name: 'Project', ready: projectState.currentProject || !init?.config?.settings.current_project },
    ];
    
    const readyCount = checks.filter((check) => check.ready).length;
    const notReady = checks.filter((check) => !check.ready);
    
    return {
      allReady: readyCount === checks.length,
      readyCount,
      totalCount: checks.length,
      notReady: notReady.map((check) => check.name),
    };
  };

  // Show Ready modal when all systems are ready
  useEffect(() => {
    if (!session) return; // Don't run initialization logic without session
    if (initFailed) return; // Don't show init modals after failure

    const statusInfo = getLoadingStatus();

    if (statusInfo.allReady && !hasShownReadyModal) {
      // Mark as shown before opening the Ready modal so it fires only once
      setHasShownReadyModal(true);
      Swal.close(); // Close any initializing alert
      // Commented out - Ready modal removed for faster UX, keeping code for future reference
      // Swal.fire({
      //   title: 'Ready!',
      //   html: `All systems loaded successfully!<br><br>Loading... (${statusInfo.readyCount}/${statusInfo.totalCount}) - Complete!`,
      //   icon: 'success',
      //   background: isDarkMode ? '#222' : '#fff',
      //   color: isDarkMode ? '#fff' : '#333',
      //   confirmButtonColor: '#10b981',
      //   confirmButtonText: 'Click to read, write, edit ... repeat',
      //   allowOutsideClick: false,
      //   allowEscapeKey: false,
      // }).then(() => {
        setIsSystemInitializing(false); // Enable UI buttons
        // Show welcome guide only for new users (treat unknown as missing)
        const isNewUser = !projectState.currentProject && (hasApiKey === false || hasApiKey === null);
        if (isNewUser) {
          showWelcomeGuide();
        }
      // });
    } else if (!statusInfo.allReady && isSystemInitializing && !initFailed) {
      // Update or show persistent initializing modal
      if (Swal.isVisible()) {
        // Update existing modal
        Swal.update({
          html: `Loading... (${statusInfo.readyCount}/${statusInfo.totalCount})<br>Waiting for: ${statusInfo.notReady.join(', ')}`,
        });
      } else {
        // Show new modal
        Swal.fire({
          title: 'Initializing Proselenos...',
          html: `Loading... (${statusInfo.readyCount}/${statusInfo.totalCount})<br>Waiting for: ${statusInfo.notReady.join(', ')}`,
          icon: 'info',
          background: isDarkMode ? '#222' : '#fff',
          color: isDarkMode ? '#fff' : '#333',
          showConfirmButton: false,
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });
      }
    }
  }, [
    isStorageReady,
    toolsState.toolsReady,
    session?.accessToken,
    hasApiKey,
    projectState.currentProject,
    init?.config?.settings.current_project,
    hasShownReadyModal,
    isSystemInitializing,
    isDarkMode,
    initFailed,
  ]);

  // When a project is selected (either by creation or selection), automatically disable system-initializing state so buttons reappear.
  useEffect(() => {
    if (projectState.currentProject && isSystemInitializing) {
      setIsSystemInitializing(false);
    }
  }, [projectState.currentProject, isSystemInitializing]);

  // Check if API key exists for Models button visibility
  const checkApiKey = useCallback(async () => {
    if (!session?.accessToken || !currentProvider) return;
    
    try {
      const result = await withTimeout(hasApiKeyAction(currentProvider), 8000, 'Checking API key');
      if (result.success) {
        setHasApiKey(result.hasKey || false);
      } else {
        setHasApiKey(false);
      }
    } catch (error) {
      console.error('Error checking API key:', error);
      setHasApiKey(false);
    }
  }, [session?.accessToken, currentProvider]);

  // Auto-load previous project when session is ready (if not loaded from fast init)
  useEffect(() => {
    if (session?.accessToken && !projectState.currentProject && !init?.config?.settings.current_project) {
      loadFullConfig();
    }
  }, [session?.accessToken, projectState.currentProject, init]);

  // Check API key status when session or provider changes
  useEffect(() => {
    if (session?.accessToken && currentProvider) {
      checkApiKey();
    }
  }, [session?.accessToken, currentProvider, checkApiKey]);

  // Load full config (including settings decryption) when needed
  const loadFullConfig = useCallback(async () => {
    if (!session || isLoadingConfig) return;
    
    setIsLoadingConfig(true);
    
    try {
      const result = await withTimeout(
        getproselenosConfigAction(),
        15000,
        'Loading configuration'
      );
      
      if (result.success && result.data?.config) {
        const config = result.data.config;
        const { current_project, current_project_folder_id } = config.settings;
        
        // Load provider and model settings if they exist
        if (config.selectedApiProvider) {
          setCurrentProvider(config.selectedApiProvider);
          setHasConfiguredProvider(true);
        }
        if (config.selectedAiModel) {
          setCurrentModel(config.selectedAiModel);
        }
        
        // Set project if it exists in config
        if (current_project && current_project_folder_id) {
          projectActions.setCurrentProject(current_project);
          projectActions.setCurrentProjectId(current_project_folder_id);
          projectActions.setUploadStatus(`✅ Project loaded: ${current_project}`);
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setIsLoadingConfig(false);
    }
  }, [session, isLoadingConfig, projectActions.setCurrentProject, projectActions.setCurrentProjectId, projectActions.setUploadStatus, init]);

  // Toggle theme
  const toggleTheme = async () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    if (session) {
      await updateDarkModeAction(newDarkMode);
    }
  };

  // Open full-screen editor for current project
  const openEditor = () => {
    if (!projectState.currentProject) {
      showAlert('Select a Project first!\nEditor is restricted to a Writing Project.', 'warning', undefined, isDarkMode);
      return;
    }
    setEditorContent('');
    setCurrentFileName(null);
    setCurrentFilePath(null);
    setShowEditorModal(true);
  };

  // Editor file operations
  const handleEditorSaveFile = async (content: string, fileName?: string) => {
    if (!session?.user?.id) {
      throw new Error('Not authenticated');
    }

    // Require project for saving
    if (!projectState.currentProject) {
      throw new Error('Project is required');
    }

    // If updating existing file, use existing path; otherwise require filename
    if (currentFilePath) {
      const result = await createOrUpdateFileAction(
        projectState.currentProject,
        currentFileName || 'untitled.txt',
        content,
        currentFilePath
      );
      if (!result.success) {
        throw new Error(result.error);
      }
      return;
    }

    // Creating new file - require filename
    if (!fileName) {
      throw new Error('File name is required for new files');
    }

    const result = await createOrUpdateFileAction(
      projectState.currentProject,
      fileName,
      content
    );
    if (!result.success) {
      throw new Error(result.error);
    }

    // Update state with new file path
    if (result.data?.filePath) {
      setCurrentFilePath(result.data.filePath);
      setCurrentFileName(fileName);
    }
  };

  const handleEditorBrowseFiles = async () => {
    if (!session?.user?.id) {
      projectActions.setUploadStatus('❌ Not authenticated');
      showAlert('You must sign in first!', 'error', undefined, isDarkMode);
      return;
    }
    if (!projectState.currentProject) {
      showAlert('Select a project first!', 'info', undefined, isDarkMode);
      return;
    }

    setIsStorageOperationPending(true);
    projectActions.setUploadStatus('Loading TXT files...');
    try {
      const result = await listTxtFilesAction(projectState.currentProject);

      if (result.success && result.data?.files) {
        if (result.data.files.length === 0) {
          showAlert('No TXT files found in the current project. Please add a .txt file first.', 'info', undefined, isDarkMode);
          return;
        }
        setEditorFileSelectorFiles(result.data.files);
        setShowEditorFileSelector(true);
        projectActions.setUploadStatus(`Found ${result.data.files.length} TXT files`);
      } else {
        showAlert(`Failed to load project files: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showAlert(`Error loading project files: ${msg}`, 'error', undefined, isDarkMode);
    } finally {
      setIsStorageOperationPending(false);
    }
  };

  const handleEditorFileSelectorClose = () => {
    setShowEditorFileSelector(false);
  };
  
  const handleEditorFileSelect = async (file: any) => {
    if (!session?.user?.id) {
      showAlert('Not authenticated!', 'error', undefined, isDarkMode);
      return;
    }
    if (!projectState.currentProject) {
      showAlert('No project selected!', 'error', undefined, isDarkMode);
      return;
    }
    try {
      const result = await readFileAction(projectState.currentProject, file.path);

      if (result.success) {
        const content = result.data?.content || '';
        handleLoadFileIntoEditor(content, file.name, file.path);
      } else {
        showAlert(`Failed to load file: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      showAlert(`Error reading file: ${msg}`, 'error', undefined, isDarkMode);
    } finally {
      setShowEditorFileSelector(false);
    }
  };

  // Settings save handler (API key only - provider is always openrouter)
  const handleSettingsSave = async (_provider: string) => {
    if (!session?.accessToken) {
      projectActions.setUploadStatus('❌ Not authenticated');
      return;
    }

    // Just refresh API key status after save
    await checkApiKey();
  };

  // Project action handlers
  const handleSelectProject = () => {
    projectActions.openProjectSelector(session, isDarkMode);
  };
  
  const handleOpenSettings = async () => {
    // Load full config including settings decryption when opening settings
    if (!hasConfiguredProvider && init?.hasSettingsFile) {
      await loadFullConfig();
    }
    setShowSettingsDialog(true);
  };
  
  const handleOpenAbout = () => {
    setShowAboutModal(true);
  };
  
  const handleModelsClick = () => {
    setShowModelsDropdown(true);
  };
  
  const handleModelSelect = async (model: string) => {
    if (!session?.accessToken) {
      projectActions.setUploadStatus('❌ Not authenticated');
      return;
    }
    
    projectActions.setUploadStatus(`Updating AI model to ${model}...`);


    try {
      const result = await updateSelectedModelAction(model);
      if (result.success) {
        setCurrentModel(model);
        projectActions.setUploadStatus(`✅ AI model updated to ${model}`);
      } else {
        projectActions.setUploadStatus(`❌ Failed to update model: ${result.error}`);
      }
    } catch (error) {
      projectActions.setUploadStatus(`❌ Failed to update model: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleProjectSettings = async () => {
    if (!projectState.currentProject) {
      showAlert('Please select a project first!', 'warning', undefined, isDarkMode);
      return;
    }

    setIsLoadingMetadata(true);
    setShowProjectSettingsModal(true);

    try {
      const result = await loadBookMetadataAction(projectState.currentProject);

      if (result.success && result.data) {
        setProjectMetadata(result.data);
      } else {
        showAlert(`Failed to load project settings: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      showAlert(`Error loading project settings: ${error instanceof Error ? error.message : String(error)}`, 'error', undefined, isDarkMode);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const handleDocxImport = () => {
    projectActions.handleLocalDocxImport(isDarkMode);
  };
  
  const handleTxtExport = () => {
    projectActions.handleTxtExport(session, isDarkMode, setIsStorageOperationPending);
  };

  const handleFilesClick = () => {
    // Directly open the Files modal
    projectActions.setShowUploadModal(true);
  };

  const handleUploadFileSelect = (file: File) => {
    projectActions.selectUploadFile(file, isDarkMode);
  };

  const handlePerformUpload = () => {
    projectActions.performFileUpload(session, isDarkMode);
  };

  const handleCloseFilesModal = () => {
    projectActions.setShowUploadModal(false);
    projectActions.setSelectedUploadFile(null);
  };
  
  // Project modal handlers
  const handleProjectSelect = (folder: any) => {
    projectActions.selectProject(
      session,
      folder,
      setIsStorageOperationPending,
      () => {
        // Clear selected manuscript when project changes (placeholder for AI tools phase)
      }
    );
  };

  const handleProjectNavigation = (folderId: string) => {
    projectActions.navigateToFolder(
      folderId,
      setIsStorageOperationPending
    );
  };

  // Create the very first project and wait for the async call to finish
  const handleCreateNewProject = async () => {
    await projectActions.createNewProject(
      session,
      setIsStorageOperationPending,
      isDarkMode
    );
    // Once the project exists and tools are loaded, turn off initialization
    setIsSystemInitializing(false);
  };
  
  const handleLoadFileIntoEditor = (content: string, fileName: string, filePath?: string) => {
    setEditorContent(content);
    setCurrentFileName(fileName);
    setCurrentFilePath(filePath || null);
    setShowEditorModal(true);
  };

  // AI Tools handlers
  const handleCategoryChange = (category: string) => {
    toolsActions.setSelectedCategory(category);
    
    // Filter and sort tools alphabetically by their display name.
    const filtered = toolsState.availableTools
      .filter((tool) => tool.category === category)
      .sort((a, b) => {
        // Remove underscores and compare case‑insensitively
        const nameA = a.name.replace(/_/g, ' ').toLowerCase();
        const nameB = b.name.replace(/_/g, ' ').toLowerCase();
        return nameA.localeCompare(nameB);
      });
    
    toolsActions.setToolsInCategory(filtered);
  };
  
  const handleSetupTool = () => {
    toolsActions.setupAITool(
      session,
      projectState.currentProject,
      projectState.currentProjectId,
      setIsStorageOperationPending,
      isDarkMode
    );
  };
  
  const handleExecuteTool = () => {
    toolsActions.executeAITool(
      session,
      projectState.currentProject,
      projectState.currentProjectId,
      currentProvider,
      currentModel,
      projectActions.setUploadStatus,
      isDarkMode
    );
  };

  // Non-AI Tools Select handler
  const handleNonAISetupTool = () => {
    nonAIToolsActions.setupNonAITool(
      session,
      projectState.currentProject,
      projectState.currentProjectId,
      setIsStorageOperationPending,
      isDarkMode
    );
  };
  
  const handleFileSelectorClose = () => {
    toolsActions.setShowFileSelector(false);
    toolsActions.setToolResult('');
  };
  
  const handleFileSelect = (file: any) => {
    toolsActions.setSelectedManuscriptForTool(file);
    toolsActions.setShowFileSelector(false);
  };
  
  // Non-AI Tools File Selector handlers
  const handleNonAIFileSelectorClose = () => {
    nonAIToolsActions.setShowFileSelector(false);
  };
  
  const handleNonAIFileSelect = (file: any) => {
    nonAIToolsActions.setSelectedManuscriptForTool(file);
    nonAIToolsActions.setShowFileSelector(false);
  };
  
  // Non-AI Tools action handlers
  const handleNonAIToolChange = (tool: string) => {
    nonAIToolsActions.setSelectedNonAITool(tool);
  };
  
  const handleNonAIClearTool = () => {
    nonAIToolsActions.clearTool();
  };
  
  const handleNonAIExecuteTool = () => {
    nonAIToolsActions.handleRun(
      session,
      isStorageOperationPending,
      toolsState.toolExecuting,
      projectState.currentProject,
      projectState.currentProjectId,
      (type, message, isDarkMode) => showAlert(message, type, undefined, isDarkMode),
      isDarkMode
    );
  };
  
  // Project Settings Modal handlers
  const handleProjectSettingsClose = () => {
    setShowProjectSettingsModal(false);
    setProjectMetadata(undefined);
  };
  
  const handleProjectSettingsSave = async (metadata: ProjectMetadata) => {
    if (!projectState.currentProject) {
      showAlert('No project selected!', 'error', undefined, isDarkMode);
      return;
    }

    setIsSavingMetadata(true);
    projectActions.setUploadStatus('Saving project settings...');

    try {
      const result = await saveBookMetadataAction(
        projectState.currentProject,
        metadata
      );

      if (result.success) {
        setProjectMetadata(metadata);
        projectActions.setUploadStatus('✅ Project settings saved successfully');
        // Auto-close modal on successful save
        setShowProjectSettingsModal(false);
        setProjectMetadata(undefined);
      } else {
        projectActions.setUploadStatus(`❌ Failed to save project settings: ${result.error}`);
        showAlert(`Failed to save project settings: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      projectActions.setUploadStatus(`❌ Error saving project settings: ${errorMessage}`);
      showAlert(`Error saving project settings: ${errorMessage}`, 'error', undefined, isDarkMode);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  // Show welcome guide for new users
  const showWelcomeGuide = () => {
    Swal.fire({
      title: '🎉 Welcome to Proselenos!',
      html: `
        <div style="text-align: left; line-height: 1.6;">
          <div style="margin-bottom: 24px;">
            <p style="margin: 0 0 20px 0; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; font-size: 14px;">
              Let's get you set up with these 4 essential steps:
            </p>
            
            <!-- Step 1 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
              <div style="
                background: #4285F4; 
                color: white; 
                width: 24px; 
                height: 24px; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 12px; 
                font-weight: 600; 
                margin-right: 12px; 
                flex-shrink: 0;
              ">1</div>
              <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px; color: ${isDarkMode ? '#fff' : '#111'};">
                  Create First Project
                </div>
                <div style="font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; line-height: 1.4;">
                  Click "Select Project" button to create your first writing project folder
                </div>
              </div>
            </div>
            
            <!-- Step 2 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
              <div style="
                background: #4285F4; 
                color: white; 
                width: 24px; 
                height: 24px; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 12px; 
                font-weight: 600; 
                margin-right: 12px; 
                flex-shrink: 0;
              ">2</div>
              <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px; color: ${isDarkMode ? '#fff' : '#111'};">
                  Add OpenRouter API Key
                </div>
                <div style="font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; line-height: 1.4;">
                  Click the "AI API key" button in the header to add your <a href="https://openrouter.ai" target="_blank" style="color: #4285F4; text-decoration: none;">OpenRouter</a> API key
                </div>
              </div>
            </div>
            
            <!-- Step 3 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 16px;">
              <div style="
                background: #4285F4; 
                color: white; 
                width: 24px; 
                height: 24px; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 12px; 
                font-weight: 600; 
                margin-right: 12px; 
                flex-shrink: 0;
              ">3</div>
              <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px; color: ${isDarkMode ? '#fff' : '#111'};">
                  Choose AI Model
                </div>
                <div style="font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; line-height: 1.4;">
                  Click "Models" button and select a model
                </div>
              </div>
            </div>
            
            <!-- Step 4 -->
            <div style="display: flex; align-items: flex-start; margin-bottom: 20px;">
              <div style="
                background: #10b981; 
                color: white; 
                width: 24px; 
                height: 24px; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 12px; 
                font-weight: 600; 
                margin-right: 12px; 
                flex-shrink: 0;
              ">4</div>
              <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px; color: ${isDarkMode ? '#fff' : '#111'};">
                  Test with Chat
                </div>
                <div style="font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; line-height: 1.4;">
                  Click the "Chat" button to verify your setup is working correctly
                </div>
              </div>
            </div>
            
            <!-- Pro Tip -->
            <div style="
              background: ${isDarkMode ? '#333' : '#f3f4f6'}; 
              padding: 12px; 
              border-radius: 8px; 
              border-left: 4px solid #10b981;
            ">
              <div style="font-weight: 600; margin-bottom: 4px; color: ${isDarkMode ? '#10b981' : '#059669'}; font-size: 13px;">
                💡 Tip
              </div>
              <div style="font-size: 12px; color: ${isDarkMode ? '#d1d5db' : '#4b5563'}; line-height: 1.4;">
                You can upload Word documents or text files to your projects for AI editing and analysis!
              </div>
              <div style="font-size: 12px; color: ${isDarkMode ? '#d1d5db' : '#4b5563'}; line-height: 1.3;">
                Just in case, these 4 steps are repeated on the About page!
              </div>
            </div>
          </div>
        </div>
      `,
      icon: 'success',
      background: isDarkMode ? '#222' : '#fff',
      color: isDarkMode ? '#fff' : '#333',
      confirmButtonText: "Let's Get Started!",
      confirmButtonColor: '#4285F4',
      width: 600,
      customClass: {
        popup: 'swal2-responsive',
      },
    });
  };
  
  if (status === 'loading') {
    return (
      <div
        style={{
          padding: '20px',
          backgroundColor: theme.bg,
          color: theme.text,
          minHeight: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        Loading Proselenos...
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header - Only show when logged in */}
      {session && (
        <ProselenosHeader
          session={session}
          theme={theme}
          isDarkMode={isDarkMode}
          hasApiKey={hasApiKey === true}
          isStorageOperationPending={isStorageOperationPending}
          toolExecuting={toolsState.toolExecuting}
          currentProject={projectState.currentProject}
          currentProjectId={projectState.currentProjectId}
          isSystemInitializing={isSystemInitializing}
          onThemeToggle={toggleTheme}
          onAboutClick={handleOpenAbout}
        />
      )}
      
      {!session ? (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#ffffff',
            color: '#333',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Header Bar */}
          <header
            style={{
              borderBottom: '1px solid #e0e0e0',
              padding: '0 24px',
              height: '60px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f5f5f5',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 'bold',
                }}
              >
                <img
                  src="/icon.png"
                  alt="Proselenos Logo"
                  style={{
                    width: '80px',
                    height: '96px',
                    objectFit: 'contain',
                  }}
                />
              </div>
              <span style={{ fontSize: '18px', fontWeight: '600' }}>Proselenos</span>
            </div>
            
            <nav style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
              <a href="#features" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>Features</a>
              <a href="#pricing" style={{ color: '#666', textDecoration: 'none', fontSize: '14px' }}>Pricing</a>
              <button
                onClick={() => signIn('google')}
                style={{
                  backgroundColor: '#4285f4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#3367d6')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#4285f4')}
              >
                Sign in with Google
              </button>
            </nav>
          </header>
          
          {/* Main Content */}
          <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px' }}>
            {/* Hero Section */}
            <div style={{ textAlign: 'center', marginBottom: '80px' }}>
              <h1
                style={{
                  fontSize: '48px',
                  fontWeight: '700',
                  margin: '0 0 16px 0',
                  background: 'linear-gradient(135deg, #111 0%, #666 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: '1.2',
                }}
              >
                Welcome to Proselenos
              </h1>
              <p
                style={{
                  fontSize: '20px',
                  color: '#666',
                  margin: '0 0 40px 0',
                  maxWidth: '600px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                Professional manuscript editing powered by AI
              </p>
            </div>
            
            {/* Description */}
            <div
              style={{
                backgroundColor: '#f9f9f9',
                borderRadius: '16px',
                padding: '40px',
                marginBottom: '60px',
                border: '1px solid #e0e0e0',
              }}
            >
              <p
                style={{
                  fontSize: '16px',
                  lineHeight: '1.7',
                  color: '#333',
                  margin: 0,
                  textAlign: 'left',
                  maxWidth: '800px',
                  marginLeft: 'auto',
                  marginRight: 'auto',
                }}
              >
                Proselenos is a powerful manuscript-editing platform designed specifically for writers working on full-length writing projects. Whether you&apos;re editing a novel, memoir, or non-fiction work, Proselenos provides comprehensive tools to refine and polish your complete manuscript. Upload your entire manuscript and get detailed editing assistance, structural analysis, and formatting help to bring your work to professional publishing standards.
                <br />
                <blockquote>&nbsp;&nbsp;&nbsp; 🌖 <i>Like the moon, Proselenos reflects just enough light to make your prose shine.</i> ✨</blockquote>
              </p>
            </div>
            
            {/* Features Section */}
            <section id="features" style={{ marginBottom: '60px' }}>
              <h2
                style={{
                  fontSize: '32px',
                  fontWeight: '600',
                  textAlign: 'center',
                  marginBottom: '40px',
                  color: '#111',
                }}
              >
                Key Features
              </h2>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '24px',
                }}
              >
                {[
                  {
                    title: 'Secure storage',
                    description: 'Your manuscripts and settings are stored securely online.',
                  },
                  {
                    title: 'Full manuscript editing',
                    description: 'Including consistency checking and narrative flow optimisation.',
                  },
                  {
                    title: 'Advanced editing tools',
                    description: 'Grammar checking, style analysis, pacing optimisation, structural improvements, as well as your own customized AI prompts.',
                  },
                  {
                    title: 'Document management',
                    description: 'Import/Export Word .docx documents, to manage your flow with other writing applications.',
                  },
                  {
                    title: 'Project organisation',
                    description: 'Organise multiple manuscript projects with easy switching between writing projects.',
                  },
                  {
                    title: 'Publishing preparation',
                    description: 'Generate publication-ready EPUB and PDF files for digital and print publishing. Also, the included Editor is capable of reading aloud your manuscript.',
                  },
                ].map((feature, index) => (
                  <div
                    key={index}
                    style={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      padding: '24px',
                      border: '1px solid #e0e0e0',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <h3
                      style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        marginBottom: '12px',
                        color: '#111',
                      }}
                    >
                      {feature.title}:
                    </h3>
                    <p
                      style={{
                        fontSize: '14px',
                        lineHeight: '1.6',
                        color: '#666',
                        margin: 0,
                      }}
                    >
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            
            {/* Pricing Section */}
            <section id="pricing" style={{ marginBottom: '60px' }}>
              <h2
                style={{
                  fontSize: '32px',
                  fontWeight: '600',
                  textAlign: 'center',
                  marginBottom: '40px',
                  color: '#111',
                }}
              >
                Pricing
              </h2>
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  padding: '40px',
                  border: '1px solid #e0e0e0',
                  textAlign: 'center',
                  maxWidth: '500px',
                  margin: '0 auto',
                }}
              >
                <h3
                  style={{
                    fontSize: '24px',
                    fontWeight: '600',
                    marginBottom: '16px',
                    color: '#4285f4',
                  }}
                >
                  Free
                </h3>
                <p
                  style={{
                    fontSize: '16px',
                    color: '#333',
                    lineHeight: '1.6',
                    margin: 0,
                  }}
                >
                  Proselenos is free to use!
                  <br />
                  <br />
                  OpenRouter charges for API key usage based on your AI model selection and usage.
                </p>
              </div>
            </section>
            
            {/* Privacy & Security Section */}
            <section style={{ marginBottom: '60px' }}>
              <h2
                style={{
                  fontSize: '32px',
                  fontWeight: '600',
                  textAlign: 'center',
                  marginBottom: '40px',
                  color: '#111',
                }}
              >
                Privacy & Security
              </h2>
              <div
                style={{
                  backgroundColor: '#f9f9f9',
                  borderRadius: '16px',
                  padding: '40px',
                  border: '1px solid #e0e0e0',
                }}
              >
                <p
                  style={{
                    fontSize: '16px',
                    lineHeight: '1.7',
                    color: '#333',
                    marginBottom: '24px',
                    textAlign: 'left',
                  }}
                >
                  Your manuscripts remain private and secure.
                  <br />
                  <br />
                  Proselenos requests only the Google permissions necessary to function:
                </p>
                <div style={{ marginBottom: '24px' }}>
                  <p
                    style={{
                      fontSize: '14px',
                      color: '#666',
                      margin: '0 0 8px 0',
                      fontFamily: 'monospace',
                      backgroundColor: '#fff',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #ddd',
                    }}
                  >
                    openid, email, profile
                  </p>
                  <p
                    style={{
                      fontSize: '14px',
                      color: '#333',
                      margin: '8px 0 0 0',
                    }}
                  >
                    - used to authenticate you and retrieve your basic account information
                  </p>
                </div>
                <p
                  style={{
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: '#666',
                    margin: 0,
                    textAlign: 'center',
                  }}
                >
                  You can <a href="https://myaccount.google.com/permissions" style={{ color: '#4299e1' }}>revoke these permissions</a> at any time through your Google Account settings.
                  <br />
                  <br />
                  For more information, see our
                  <a href="/privacy.html" style={{ color: '#4299e1' }}> Privacy Policy</a>
                  &nbsp;and&nbsp;
                  <a href="/terms.html" style={{ color: '#4299e1' }}> Terms of Service</a>.
                </p>
              </div>
            </section>
            
            {/* Final CTA */}
            <div style={{ textAlign: 'center' }}>
              <a
                href="https://a.co/d/5feXsK0"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-xl px-4 py-2 text-sm font-medium shadow hover:opacity-90 focus:outline-none focus:ring"
                style={{ backgroundColor: '#794bc4', color: '#fff' }}
                aria-label="Proselenos book"
              >
                Proselenos the book
              </a>
              
              &nbsp;&nbsp;&nbsp;&nbsp;
              
              <button
                onClick={() => signIn('google')}
                style={{
                  backgroundColor: '#4285f4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '16px 32px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(66, 133, 244, 0.3)',
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#3367d6';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#4285f4';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Sign in with Google
              </button>
            </div>
          </main>
        </div>
      ) : (
        <div style={{ padding: '16px 20px' }}>
          {/* Projects Section */}
          <ProjectSection
            currentProject={projectState.currentProject}
            uploadStatus={projectState.uploadStatus}
            isLoadingConfig={isLoadingConfig}
            isStorageOperationPending={isStorageOperationPending}
            toolExecuting={toolsState.toolExecuting}
            theme={theme}
            isDarkMode={isDarkMode}
            isSystemInitializing={isSystemInitializing}
            isDocxConverting={projectState.isConverting}
            isDocxDialogOpen={projectState.showDocxSelector || projectState.showFilenameDialog}
            isTxtConverting={projectState.isConvertingTxt}
            isTxtDialogOpen={projectState.showTxtSelector || projectState.showTxtFilenameDialog}
            onSelectProject={handleSelectProject}
            onProjectSettings={handleProjectSettings}
            onFilesClick={handleFilesClick}
            onDocxImport={handleDocxImport}
            onTxtExport={handleTxtExport}
            onEditorClick={openEditor}
          />
          
          {/* AI Tools Section */}
          <AIToolsSection
            session={session}
            selectedCategory={toolsState.selectedCategory}
            selectedTool={toolsState.selectedTool}
            toolsInCategory={toolsState.toolsInCategory}
            toolsReady={toolsState.toolsReady}
            isInstallingToolPrompts={isInstallingToolPrompts}
            selectedManuscriptForTool={toolsState.selectedManuscriptForTool}
            toolExecuting={toolsState.toolExecuting}
            toolResult={toolsState.toolResult}
            toolJustFinished={toolsState.toolJustFinished}
            savedReportFileName={toolsState.savedReportFileName}
            savedReportFileId={toolsState.savedReportFileId}
            elapsedTime={toolsState.elapsedTime}
            manuscriptContent={toolsState.manuscriptContent}
            currentProject={projectState.currentProject}
            currentProjectId={projectState.currentProjectId}
            isStorageOperationPending={isStorageOperationPending}
            isSystemInitializing={isSystemInitializing}
            theme={theme}
            isDarkMode={isDarkMode}
            currentProvider={currentProvider}
            currentModel={currentModel}
            hasConfiguredProvider={hasConfiguredProvider}
            hasApiKey={hasApiKey === true}
            onCategoryChange={handleCategoryChange}
            onToolChange={toolsActions.setSelectedTool}
            onSetupTool={handleSetupTool}
            onClearTool={toolsActions.clearTool}
            onExecuteTool={handleExecuteTool}
            onLoadFileIntoEditor={handleLoadFileIntoEditor}
            onModelsClick={handleModelsClick}
            onSettingsClick={handleOpenSettings}
          />
          
          {/* Non-AI Tools Section */}
          <div style={{ marginBottom: '20px' }}>
            <NonAIToolsSection
              selectedNonAITool={nonAIToolsState.selectedNonAITool}
              selectedManuscriptForTool={nonAIToolsState.selectedManuscriptForTool}
              isPublishing={nonAIToolsState.isPublishing}
              publishResult={nonAIToolsState.publishResult}
              toolJustFinished={nonAIToolsState.toolJustFinished}
              currentProject={projectState.currentProject}
              currentProjectId={projectState.currentProjectId}
              isStorageOperationPending={isStorageOperationPending}
              theme={theme}
              isDarkMode={isDarkMode}
              toolExecuting={toolsState.toolExecuting}
              session={session}
              onToolChange={handleNonAIToolChange}
              onSetupTool={handleNonAISetupTool}
              onClearTool={handleNonAIClearTool}
              onExecuteTool={handleNonAIExecuteTool}
              onShowAlert={(type, message, isDarkMode) => showAlert(message, type, undefined, isDarkMode)}
            />
          </div>
        </div>
      )}
      
      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        onSave={handleSettingsSave}
        isDarkMode={isDarkMode}
        theme={theme}
        currentProvider={currentProvider}
      />
      
      {/* Models Dropdown */}
      <ModelsDropdown
        isOpen={showModelsDropdown}
        onClose={() => setShowModelsDropdown(false)}
        onSelectModel={handleModelSelect}
        isDarkMode={isDarkMode}
        theme={theme}
        currentModel={currentModel}
      />
      
      {/* Editor Modal */}
      <EditorModal
        isOpen={showEditorModal}
        theme={theme}
        isDarkMode={isDarkMode}
        currentProject={projectState.currentProject}
        currentProjectId={projectState.currentProjectId}
        currentFileName={currentFileName}
        currentFilePath={currentFilePath}
        editorContent={editorContent}
        onClose={() => setShowEditorModal(false)}
        onContentChange={setEditorContent}
        onSaveFile={handleEditorSaveFile}
        onBrowseFiles={handleEditorBrowseFiles}
      />
      
      {/* Editor TXT File Selector Modal */}
      <FileSelectorModal
        isOpen={showEditorFileSelector}
        theme={theme}
        isDarkMode={isDarkMode}
        fileSelectorFiles={editorFileSelectorFiles}
        selectedManuscriptForTool={null}
        onClose={handleEditorFileSelectorClose}
        onSelectFile={handleEditorFileSelect}
      />
      
      {/* Project Selector Modal */}
      <ProjectSelectorModal
        session={session}
        isOpen={projectState.showModal}
        theme={theme}
        isDarkMode={isDarkMode}
        currentProject={projectState.currentProject}
        modalFiles={projectState.modalFiles}
        breadcrumbs={projectState.breadcrumbs}
        newProjectName={projectState.newProjectName}
        isProjectFilesBrowser={projectState.isProjectFilesBrowser}
        isStorageOperationPending={isStorageOperationPending}
        toolExecuting={toolsState.toolExecuting}
        onClose={projectActions.closeModal}
        onSelectProject={handleProjectSelect}
        onNavigateToFolder={handleProjectNavigation}
        onCreateNewProject={handleCreateNewProject}
        onNewProjectNameChange={projectActions.setNewProjectName}
        onLoadFileIntoEditor={handleLoadFileIntoEditor}
        onUploadStatusUpdate={projectActions.setUploadStatus}
      />

      {/* Import DOCX - now handled by LocalDocxImportModal (local file upload) */}

      {/* Export TXT Modal */}
      <ExportModal
        showTxtSelector={projectState.showTxtSelector}
        showTxtFilenameDialog={projectState.showTxtFilenameDialog}
        txtFiles={projectState.txtFiles}
        selectedTxtFile={projectState.selectedTxtFile}
        txtOutputFileName={projectState.txtOutputFileName}
        isConvertingTxt={projectState.isConvertingTxt}
        theme={theme}
        isDarkMode={isDarkMode}
        onSelectFile={projectActions.selectTxtFile}
        onCancelFileSelector={() => {
          projectActions.setShowTxtSelector(false);
          projectActions.setSelectedTxtFile(null);
        }}
        onFilenameChange={projectActions.setTxtOutputFileName}
        onCancelFilename={() => {
          projectActions.setShowTxtFilenameDialog(false);
          projectActions.setSelectedTxtFile(null);
          projectActions.setTxtOutputFileName('');
        }}
        onConfirmConversion={() => projectActions.performTxtConversion(session, isDarkMode)}
      />
      
      {/* Files Modal (Upload/Download/Delete) */}
      <FilesModal
        isOpen={projectState.showUploadModal}
        theme={theme}
        isDarkMode={isDarkMode}
        currentProject={projectState.currentProject}
        selectedUploadFile={projectState.selectedUploadFile}
        uploadFileName={projectState.uploadFileName}
        isUploading={projectState.isUploading}
        onClose={handleCloseFilesModal}
        onFileSelect={handleUploadFileSelect}
        onFileNameChange={projectActions.setUploadFileName}
        onUpload={handlePerformUpload}
      />

      {/* Local DOCX Import Modal */}
      <LocalDocxImportModal
        isOpen={projectState.showLocalDocxImportModal}
        theme={theme}
        isDarkMode={isDarkMode}
        currentProject={projectState.currentProject}
        currentProjectId={projectState.currentProjectId}
        accessToken={session?.accessToken || null}
        isConverting={projectState.isLocalDocxConverting}
        onClose={() => projectActions.setShowLocalDocxImportModal(false)}
        onConversionComplete={projectActions.handleLocalDocxConversionComplete}
        setUploadStatus={projectActions.setUploadStatus}
      />

      {/* AI Tools File Selector Modal */}
      <FileSelectorModal
        isOpen={toolsState.showFileSelector}
        theme={theme}
        isDarkMode={isDarkMode}
        fileSelectorFiles={toolsState.fileSelectorFiles}
        selectedManuscriptForTool={toolsState.selectedManuscriptForTool}
        selectedTool={toolsState.selectedTool}
        onClose={handleFileSelectorClose}
        onSelectFile={handleFileSelect}
      />
      
      {/* Non-AI Tools File Selector Modal */}
      <FileSelectorModal
        isOpen={nonAIToolsState.showFileSelector}
        theme={theme}
        isDarkMode={isDarkMode}
        fileSelectorFiles={nonAIToolsState.fileSelectorFiles}
        selectedManuscriptForTool={nonAIToolsState.selectedManuscriptForTool}
        selectedTool={nonAIToolsState.selectedNonAITool}
        onClose={handleNonAIFileSelectorClose}
        onSelectFile={handleNonAIFileSelect}
      />
      
      {/* Project Settings Modal */}
      <ProjectSettingsModal
        isOpen={showProjectSettingsModal}
        theme={theme}
        isDarkMode={isDarkMode}
        currentProject={projectState.currentProject}
        currentProjectId={projectState.currentProjectId}
        isLoading={isLoadingMetadata}
        isSaving={isSavingMetadata}
        initialMetadata={projectMetadata}
        onClose={handleProjectSettingsClose}
        onSave={handleProjectSettingsSave}
      />
      
      {/* About Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
        isDarkMode={isDarkMode}
        theme={theme}
      />
    </div>
  );
}