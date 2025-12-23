// Modified version of ClientBoot.tsx

// This file mirrors the structure of the original `components/ClientBoot.tsx` from
// the Proselenos project for the Authors mode integration.

'use client';

import { useEffect, useCallback } from 'react';
import { useState } from 'react';
import Swal from 'sweetalert2';
import ProselenosHeader from '../app/proselenos/proselenosHeader';
import SettingsDialog from '../components/SettingsDialog';
import ModelsDropdown from '../components/ModelsDropdown';
import EditorModal from '../app/proselenos/EditorModal';
import ProjectSection from '../app/projects/ProjectSection';
import ProjectSelectorModal from '../app/projects/ProjectSelectorModal';
import LocalDocxImportModal from '../app/projects/LocalDocxImportModal';
import FilesModal from '../app/projects/FilesModal';
import { useProjectManager } from '../app/projects/useProjectManager';
import AIToolsSection from '../app/ai-tools/AIToolsSection';
// FileSelectorModal removed - manuscript.txt is now used directly
import { useToolsManager } from '../app/ai-tools/useToolsManager';
import NonAIToolsSection from '../app/non-ai-tools/NonAIToolsSection';
import { useNonAITools } from '../app/non-ai-tools/useNonAITools';
import { getTheme } from '../app/shared/theme';
import { showAlert } from '../app/shared/alerts';
import AboutModal from '../components/AboutModal';
import {
  getproselenosConfigAction,
} from '@/lib/config-actions';
import ProjectSettingsModal, { ProjectMetadata } from '../app/projects/ProjectSettingsModal';
import type { InitPayloadForClient } from '../lib/fastInitServer';
import { loadSettings, saveSettings, loadApiKey, loadAppSettings, saveAppSettings, listToolsByCategory, initWritingAssistantPrompts } from '@/services/manuscriptStorage';
import { initializeToolPrompts } from '@/services/toolPromptsLoader';

export default function ClientBoot({ init }: { init: InitPayloadForClient | null }) {
  // Local-first: no session required
  const session = null;
  
  // Projects Domain State
  const [projectState, projectActions] = useProjectManager();
  
  // AI Tools Domain State
  const [toolsState, toolsActions] = useToolsManager();
  
  // Non-AI Tools Domain State
  const [nonAIToolsState, nonAIToolsActions] = useNonAITools();
  
  // Core app state
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined' && localStorage) {
      return localStorage.getItem('authorsDarkMode') === 'true';
    }
    return false;
  });
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [editorInitialFile, setEditorInitialFile] = useState<{ key: string; store: string } | null>(null);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showModelsDropdown, setShowModelsDropdown] = useState(false);
  const [currentProvider, setCurrentProvider] = useState('openrouter');
  const [currentModel, setCurrentModel] = useState('');
  const [hasConfiguredProvider, setHasConfiguredProvider] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const [isStorageOperationPending, setIsStorageOperationPending] = useState(false);
  const [isInstallingToolPrompts] = useState(false); // TODO: For local-first
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);
  const [hasShownReadyModal, setHasShownReadyModal] = useState(false);
  const [isSystemInitializing, setIsSystemInitializing] = useState(true);
  const [initFailed] = useState(false); // TODO: For local-first error handling
  const [showProjectSettingsModal, setShowProjectSettingsModal] = useState(false);
  const [projectMetadata, setProjectMetadata] = useState<ProjectMetadata | undefined>(undefined);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

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

  // Initialize from fast init payload (config only, tools loaded from IndexedDB)
  useEffect(() => {
    if (!init) return;

    // Hydrate config settings (local-first: these have defaults so always set)
    if (init.config?.settings.current_project) {
      projectActions.setCurrentProject(init.config.settings.current_project);
      projectActions.setCurrentProjectId(init.config.settings.current_project_folder_id || '1');
      projectActions.setUploadStatus(`✅ Project loaded: ${init.config.settings.current_project}`);
    }
    if (init.config?.selectedApiProvider) {
      setCurrentProvider(init.config.selectedApiProvider);
      setHasConfiguredProvider(true);
    }
    if (init.config?.selectedAiModel) {
      setCurrentModel(init.config.selectedAiModel);
    }

    console.log(`Fast init completed in ${init.durationMs}ms`);
  }, [init]); // Removed projectActions and toolsActions from dependencies

  // Local-first: Initialize tool prompts from public/ and load from IndexedDB
  useEffect(() => {
    const loadTools = async () => {
      try {
        // Initialize tool prompts (fetches from public/ if not already in IndexedDB)
        await initializeToolPrompts();

        // Initialize Writing Assistant prompts (separate storage with defaults)
        await initWritingAssistantPrompts();

        // Load tools from IndexedDB
        const toolsByCategory = await listToolsByCategory();
        const allTools = toolsByCategory.flatMap(({ category, tools }) =>
          tools.map((t) => ({
            id: t.id,
            name: t.name,
            category,
          }))
        );

        toolsActions.setAvailableTools(allTools);
        toolsActions.setToolsReady(true);
        console.log(`Tool prompts loaded: ${allTools.length} tools`);
      } catch (error) {
        console.error('Failed to load tool prompts:', error);
        toolsActions.setToolsReady(true); // Still mark ready so UI isn't blocked
      }
    };

    loadTools();
  }, [toolsActions]);

  // Local-first: mark storage as ready immediately
  useEffect(() => {
    if (!hasCheckedStorage) {
      setIsStorageReady(true);
      setHasCheckedStorage(true);
    }
  }, [hasCheckedStorage]);

  // Note: Tools are now loaded from IndexedDB in the effect above

  // Helper function to get loading status
  const getLoadingStatus = () => {
    const checks = [
      { name: 'Storage', ready: isStorageReady },
      { name: 'AI Tools', ready: toolsState.toolsReady },
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
        const hideWelcome = typeof window !== 'undefined' && localStorage.getItem('authorsHideWelcome') === 'true';
        if (isNewUser && !hideWelcome) {
          setTimeout(() => showWelcomeGuide(), 100); // Brief delay to clear loading state
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

  // Check if API key exists for Models button visibility (local-first: from IndexedDB)
  const checkApiKey = useCallback(async () => {
    try {
      const key = await loadApiKey();
      setHasApiKey(!!key);
    } catch (error) {
      console.error('Error checking API key:', error);
      setHasApiKey(false);
    }
  }, []);

  // Check API key status and load selected model on startup
  useEffect(() => {
    const loadInitialSettings = async () => {
      await checkApiKey();
      // Load selected model from IndexedDB
      const settings = await loadAppSettings();
      if (settings?.selectedModel) {
        setCurrentModel(settings.selectedModel);
      }
    };
    if (currentProvider) {
      loadInitialSettings();
    }
  }, [currentProvider, checkApiKey]);

  // Load full config (including settings decryption) when needed
  // TODO: For local-first, load from IndexedDB
  const loadFullConfig = useCallback(async () => {
    if (isLoadingConfig) return;
    
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
  }, [isLoadingConfig, projectActions.setCurrentProject, projectActions.setCurrentProjectId, projectActions.setUploadStatus, init]);

  // Toggle theme
  const toggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    if (typeof window !== 'undefined' && localStorage) {
      localStorage.setItem('authorsDarkMode', String(newDarkMode));
    }
  };

  // Open full-screen editor (blank by default)
  const openEditor = () => {
    setEditorInitialFile(null);
    setShowEditorModal(true);
  };

  // Settings save handler (API key only - provider is always openrouter)
  // TODO: For local-first, save to IndexedDB
  const handleSettingsSave = async (_provider: string) => {
    // Just refresh API key status after save
    await checkApiKey();
  };

  // Project action handlers
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
  
  // Save selected model to IndexedDB (local-first)
  const handleModelSelect = async (model: string) => {
    projectActions.setUploadStatus(`Updating AI model to ${model}...`);

    try {
      // Load current settings, update model, save back
      const settings = await loadAppSettings() || { darkMode: isDarkMode, selectedModel: '' };
      settings.selectedModel = model;
      await saveAppSettings(settings);

      setCurrentModel(model);
      projectActions.setUploadStatus(`✅ AI model updated to ${model}`);
    } catch (error) {
      projectActions.setUploadStatus(`❌ Failed to update model: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const handleProjectSettings = async () => {
    setIsLoadingMetadata(true);
    setShowProjectSettingsModal(true);

    try {
      const settings = await loadSettings();
      if (settings) {
        setProjectMetadata(settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  const handleDocxImport = () => {
    projectActions.handleLocalDocxImport(isDarkMode);
  };

  const handleTxtExport = () => {
    projectActions.handleExport(isDarkMode);
  };

  const handleFilesClick = () => {
    // Directly open the Files modal
    projectActions.setShowUploadModal(true);
  };

  const handleCloseFilesModal = () => {
    projectActions.setShowUploadModal(false);
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

  // Open file in editor (for AI Tools results or prompt editing)
  const handleLoadFileIntoEditor = (_content: string, fileName: string, _filePath?: string) => {
    // Check if this is a prompt file (prefix: "prompt:")
    if (fileName.startsWith('prompt:')) {
      const toolId = fileName.substring(7); // Remove "prompt:" prefix
      setEditorInitialFile({ key: `prompt:${toolId}`, store: 'prompt' });
      setShowEditorModal(true);
      return;
    }

    // Check if this is a Writing Assistant prompt (prefix: "writing-assistant/")
    if (fileName.startsWith('writing-assistant/')) {
      const stepId = fileName.substring(18); // Remove "writing-assistant/" prefix
      setEditorInitialFile({ key: `wa:${stepId}`, store: 'ai' });
      setShowEditorModal(true);
      return;
    }

    // Check for workflow files (brainstorm.txt, outline.txt, world.txt)
    const workflowFiles = ['brainstorm.txt', 'outline.txt', 'world.txt'];
    if (workflowFiles.includes(fileName)) {
      setEditorInitialFile({ key: fileName, store: 'ai' });
      setShowEditorModal(true);
      return;
    }

    // Check for manuscript.txt
    if (fileName === 'manuscript.txt') {
      setEditorInitialFile({ key: 'manuscript.txt', store: 'manuscript' });
      setShowEditorModal(true);
      return;
    }

    // Default: open with the filename as-is in AI store
    setEditorInitialFile({ key: fileName, store: 'ai' });
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
  
  const handleExecuteTool = () => {
    toolsActions.executeAITool(
      currentProvider,
      currentModel,
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
    setIsSavingMetadata(true);
    projectActions.setUploadStatus('Saving settings...');

    try {
      await saveSettings(metadata);
      setProjectMetadata(metadata);
      projectActions.setUploadStatus('✅ Settings saved');
      setShowProjectSettingsModal(false);
      setProjectMetadata(undefined);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      projectActions.setUploadStatus(`❌ Error: ${msg}`);
      showAlert(`Error saving settings: ${msg}`, 'error', undefined, isDarkMode);
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

            <!-- Don't show again checkbox -->
            <label style="display: flex; align-items: center; gap: 8px; margin-top: 20px; font-size: 13px; color: ${isDarkMode ? '#9ca3af' : '#6b7280'}; cursor: pointer;">
              <input type="checkbox" id="authorsHideWelcome" style="width: 16px; height: 16px; cursor: pointer;" />
              Don't show me this again
            </label>
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
      preConfirm: () => {
        const checkbox = document.getElementById('authorsHideWelcome') as HTMLInputElement;
        if (checkbox?.checked) {
          localStorage.setItem('authorsHideWelcome', 'true');
        }
      },
    });
  };
  
  return (
    <div
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <ProselenosHeader
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
            isTxtConverting={projectState.isTxtConverting}
            isTxtDialogOpen={false}
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
              elapsedTime={nonAIToolsState.elapsedTime}
              currentProject={projectState.currentProject}
              currentProjectId={projectState.currentProjectId}
              isStorageOperationPending={isStorageOperationPending}
              theme={theme}
              isDarkMode={isDarkMode}
              toolExecuting={toolsState.toolExecuting}
              session={session}
              needsDocxFilePicker={nonAIToolsState.needsDocxFilePicker}
              onToolChange={handleNonAIToolChange}
              onSetupTool={handleNonAISetupTool}
              onClearTool={handleNonAIClearTool}
              onExecuteTool={handleNonAIExecuteTool}
              onShowAlert={(type, message, isDarkMode) => showAlert(message, type, undefined, isDarkMode)}
              onSetSelectedManuscriptForTool={nonAIToolsActions.setSelectedManuscriptForTool}
              onSetNeedsDocxFilePicker={nonAIToolsActions.setNeedsDocxFilePicker}
            />
          </div>
        </div>

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
        onClose={() => {
          setShowEditorModal(false);
          setEditorInitialFile(null);
        }}
        initialFile={editorInitialFile}
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

      {/* Export: manuscript.txt → .docx is now a direct download (no modal needed) */}

      {/* Files Modal (Upload/Download/Delete) - Local IndexedDB */}
      <FilesModal
        isOpen={projectState.showUploadModal}
        theme={theme}
        isDarkMode={isDarkMode}
        onClose={handleCloseFilesModal}
      />

      {/* Local DOCX Import Modal */}
      <LocalDocxImportModal
        isOpen={projectState.showLocalDocxImportModal}
        theme={theme}
        isDarkMode={isDarkMode}
        isConverting={projectState.isLocalDocxConverting}
        onClose={() => projectActions.setShowLocalDocxImportModal(false)}
        onConversionComplete={() => projectActions.setShowLocalDocxImportModal(false)}
        setUploadStatus={projectActions.setUploadStatus}
      />

      {/* File selector modals removed - manuscript.txt is used directly */}
      
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
        onShowWelcome={showWelcomeGuide}
      />
    </div>
  );
}