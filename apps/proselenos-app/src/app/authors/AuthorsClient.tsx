// app/authors/AuthorsClient.tsx

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getTheme } from '../shared/theme';
import AuthorsLayout from './AuthorsLayout';
import AboutModal from '@/components/AboutModal';
import StorageModal from '@/components/StorageModal';
import FilesModal from '@/app/projects/FilesModal';
import SettingsDialog from '@/components/SettingsDialog';
import ModelsDropdown from '@/components/ModelsDropdown';
import EditorModal from '@/app/proselenos/EditorModal';
import WritingAssistantModal from '@/app/writing-assistant/WritingAssistantModal';
import SimpleChatModal from '@/components/SimpleChatModal';
import BookInfoModal from './BookInfoModal';
import LibraryBooksModal from './LibraryBooksModal';
import CoverModal from './CoverModal';
import { loadApiKey, loadAppSettings, saveAppSettings, listToolsByCategory, getToolPrompt, initWritingAssistantPrompts, loadChatFile, clearWorkingCopy, saveFullWorkingCopy, saveManuscriptImage, saveWorkingCopyMeta, loadWorkingCopyMeta } from '@/services/manuscriptStorage';
import { parseEpub } from '@/services/epubService';
import { Book } from '@/types/book';
import { getLocalBookFilename } from '@/utils/book';
import { generateAIReportEpub } from '@/lib/ai-report-generator';
import environmentConfig from '@/services/environment';
import Swal from 'sweetalert2';
import { initializeToolPrompts } from '@/services/toolPromptsLoader';
import { useToolsManager } from '../ai-tools/useToolsManager';
import { showAlert } from '../shared/alerts';
import DualPanelEditor from '../ai-tools/DualPanelEditor';

export default function AuthorsClient() {
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined' && localStorage) {
      return localStorage.getItem('authorsDarkMode') !== 'false';
    }
    return true;
  });

  // About modal state
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [hideAboutOnStartup, setHideAboutOnStartup] = useState(true); // default to hidden until we load settings

  // Storage modal state
  const [showStorageModal, setShowStorageModal] = useState(false);

  // Files modal state
  const [showFilesModal, setShowFilesModal] = useState(false);

  // Sidebar visibility state
  const [sidebarVisible, setSidebarVisible] = useState(true);

  // Settings dialog state (for API Key)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [currentProvider] = useState('openrouter');

  // Models dropdown state
  const [showModelsDropdown, setShowModelsDropdown] = useState(false);
  const [currentModel, setCurrentModel] = useState('');

  // Editor modal state
  const [showEditor, setShowEditor] = useState(false);
  const [editorInitialFile, setEditorInitialFile] = useState<{ key: string; store: string } | null>(null);

  // AI Writing modal state
  const [showAIWriting, setShowAIWriting] = useState(false);

  // Chat modal state
  const [showChat, setShowChat] = useState(false);

  // Book Info modal state
  const [showBookInfo, setShowBookInfo] = useState(false);

  // Library Books modal state
  const [showLibraryModal, setShowLibraryModal] = useState(false);

  // Cover modal state
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverTitle, setCoverTitle] = useState('');
  const [coverAuthor, setCoverAuthor] = useState('');

  // AI Tools state
  const [toolsState, toolsActions] = useToolsManager();
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [showDualEditor, setShowDualEditor] = useState(false);

  // Refresh key to trigger AuthorsLayout to reload Working Copy
  const [refreshKey, setRefreshKey] = useState(0);
  // Section ID to select after refresh (for new chapters)
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);

  const theme = getTheme(isDarkMode);
  const router = useRouter();

  // Prefetch other routes for offline support
  useEffect(() => {
    router.prefetch('/library');
    router.prefetch('/reader');
  }, [router]);

  // Open file in editor (for AI Tools results or prompt editing)
  const handleLoadFileIntoEditor = (_content: string, fileName: string, _filePath?: string) => {
    // Handle prompt: prefix
    if (fileName.startsWith('prompt:')) {
      const toolId = fileName.substring(7);
      setEditorInitialFile({ key: `prompt:${toolId}`, store: 'prompt' });
      setShowEditor(true);
      return;
    }
    // Handle writing-assistant/ prefix
    if (fileName.startsWith('writing-assistant/')) {
      const stepId = fileName.substring(18);
      setEditorInitialFile({ key: `wa:${stepId}`, store: 'ai' });
      setShowEditor(true);
      return;
    }
    // Handle workflow files
    const workflowFiles = ['brainstorm.txt', 'outline.txt', 'world.txt'];
    if (workflowFiles.includes(fileName)) {
      setEditorInitialFile({ key: fileName, store: 'ai' });
      setShowEditor(true);
      return;
    }
    // Handle manuscript.txt
    if (fileName === 'manuscript.txt') {
      setEditorInitialFile({ key: 'manuscript.txt', store: 'manuscript' });
      setShowEditor(true);
      return;
    }
    // Default
    setEditorInitialFile({ key: fileName, store: 'ai' });
    setShowEditor(true);
  };

  // Check if API key exists
  const checkApiKey = useCallback(async () => {
    try {
      const key = await loadApiKey();
      setHasApiKey(!!key);
    } catch (error) {
      console.error('Error checking API key:', error);
      setHasApiKey(false);
    }
  }, []);

  // Check API key and load model on mount, and show About if needed
  useEffect(() => {
    checkApiKey();
    // Load current model and check if About should auto-show
    loadAppSettings().then((settings) => {
      if (settings?.selectedModel) {
        setCurrentModel(settings.selectedModel);
      }
      // Show About on startup if hideAboutModal is not set or false
      const shouldHide = settings?.hideAboutModal ?? false;
      setHideAboutOnStartup(shouldHide);
      if (!shouldHide) {
        setShowAboutModal(true);
      }
    });
  }, [checkApiKey]);

  // Initialize AI tools on mount
  useEffect(() => {
    const initTools = async () => {
      try {
        // Initialize tool prompts from defaults
        await initializeToolPrompts();
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
      } catch (error) {
        console.error('Failed to load tool prompts:', error);
        toolsActions.setToolsReady(true);
      }
    };
    initTools();
  }, [isDarkMode, toolsActions]);

  // Model selection handler
  const handleModelSelect = async (model: string) => {
    const settings = await loadAppSettings() || { darkMode: isDarkMode, selectedModel: '' };
    settings.selectedModel = model;
    await saveAppSettings(settings);
    setCurrentModel(model);
  };

  // Toggle "Don't show About on startup" setting
  const handleToggleHideAboutOnStartup = async (hide: boolean) => {
    setHideAboutOnStartup(hide);
    const settings = await loadAppSettings() || { darkMode: isDarkMode, selectedModel: '' };
    settings.hideAboutModal = hide;
    await saveAppSettings(settings);
  };

  // Settings save handler
  const handleSettingsSave = async () => {
    await checkApiKey();
  };

  // Load book from Library handler
  const handleLoadFromLibrary = async (book: Book) => {
    // Show confirmation dialog
    const result = await Swal.fire({
      title: 'Load from Library?',
      text: 'Loading a new book will replace your current work. Continue?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Load',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      background: isDarkMode ? '#222' : '#fff',
      color: isDarkMode ? '#fff' : '#333',
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      // Get the epub file from Library database
      const appService = await environmentConfig.getAppService();
      const bookPath = getLocalBookFilename(book);
      const epubFile = await appService.openFile(bookPath, 'Books');

      // Parse the epub
      const parsed = await parseEpub(epubFile);

      // Clear existing working copy and save new one
      await clearWorkingCopy();

      // Save extracted inline images to IndexedDB
      const imageIds: string[] = [];
      if (parsed.images && parsed.images.length > 0) {
        for (const img of parsed.images) {
          await saveManuscriptImage(img.filename, img.blob);
          imageIds.push(img.filename);
        }
      }

      // Filter out table-of-contents - it gets auto-generated on "send Ebook"
      await saveFullWorkingCopy({
        title: parsed.title,
        author: parsed.author,
        language: parsed.language,
        coverImage: parsed.coverImage,
        sections: parsed.sections
          .filter((s) => s.type !== 'table-of-contents')
          .map((s) => ({
            id: s.id,
            title: s.title,
            content: s.content,
            type: s.type,
          })),
      });

      // Update metadata with imageIds
      if (imageIds.length > 0) {
        const existingMeta = await loadWorkingCopyMeta();
        if (existingMeta) {
          await saveWorkingCopyMeta({ ...existingMeta, imageIds });
        }
      }

      // Trigger AuthorsLayout to reload from Working Copy
      setRefreshKey(prev => prev + 1);

      showAlert(`Loaded "${parsed.title}" from Library`, 'success', undefined, isDarkMode);
    } catch (error) {
      console.error('Error loading from library:', error);
      showAlert(`Error loading book: ${(error as Error).message}`, 'error', undefined, isDarkMode);
    }
  };

  // Toggle theme
  const toggleTheme = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);
    if (typeof window !== 'undefined' && localStorage) {
      localStorage.setItem('authorsDarkMode', String(newDarkMode));
    }
  };

  // Open cover modal (loads title/author from working copy)
  const handleOpenCoverModal = async () => {
    const meta = await loadWorkingCopyMeta();
    setCoverTitle(meta?.title ?? '');
    setCoverAuthor(meta?.author ?? '');
    setShowCoverModal(true);
  };

  // Handle cover saved (refresh to show new cover)
  const handleCoverSaved = () => {
    setRefreshKey(prev => prev + 1);
  };

  // AI Tools handlers
  const handleCategoryChange = (category: string) => {
    toolsActions.setSelectedCategory(category);
    toolsActions.setSelectedTool('');
    // Filter tools for this category (already in manifest order)
    const filtered = toolsState.availableTools.filter((t) => t.category === category);
    toolsActions.setToolsInCategory(filtered);
  };

  const handleToolChange = (tool: string) => {
    toolsActions.setSelectedTool(tool);
  };

  const handleExecuteTool = (currentEditorText: string) => {
    if (toolsState.selectedTool && hasApiKey && currentModel) {
      toolsActions.executeAITool(currentProvider, currentModel, isDarkMode, currentEditorText);
    }
  };

  const handlePromptEdit = async () => {
    if (!toolsState.selectedTool || isLoadingPrompt) return;
    setIsLoadingPrompt(true);
    try {
      const content = await getToolPrompt(toolsState.selectedTool);
      if (content) {
        handleLoadFileIntoEditor(content, `prompt:${toolsState.selectedTool}`, toolsState.selectedTool);
      } else {
        showAlert('Failed to load tool prompt', 'error', undefined, isDarkMode);
      }
    } catch {
      showAlert('Error loading tool prompt', 'error', undefined, isDarkMode);
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  const handleReport = async () => {
    if (!toolsState.toolResult) {
      showAlert('No AI report to save', 'warning', undefined, isDarkMode);
      return;
    }

    try {
      // Get the request content from IndexedDB
      const requestContent = await loadChatFile('ai_request.txt') || 'Request content not available';

      // Get tool name from selected tool (format: "Category/tool_name.txt")
      const toolName = toolsState.selectedTool
        ? toolsState.selectedTool.split('/').pop()?.replace('.txt', '').replace(/_/g, ' ') || 'Unknown Tool'
        : 'Unknown Tool';

      // Generate the epub
      const epubData = await generateAIReportEpub(
        toolName,
        toolsState.toolResult,
        requestContent
      );

      // Create File object with timestamp in filename (local time)
      const timestamp = new Date().toLocaleString().replace(/[/:]/g, '-').replace(/,?\s+/g, '_');
      const filename = `AI_Report_${timestamp}.epub`;
      const blob = new Blob([epubData as BlobPart], { type: 'application/epub+zip' });
      const file = new File([blob], filename, { type: 'application/epub+zip' });

      // Import to library
      const appService = await environmentConfig.getAppService();
      const books = await appService.loadLibraryBooks();
      const book = await appService.importBook(file, books);

      if (book) {
        await appService.saveLibraryBooks(books);

        await Swal.fire({
          title: 'Report Saved!',
          text: 'AI Report saved to Library. You can read it in the Library.',
          icon: 'success',
          confirmButtonText: 'OK',
          confirmButtonColor: '#28a745',
          background: isDarkMode ? '#222' : '#fff',
          color: isDarkMode ? '#fff' : '#333',
        });
      } else {
        showAlert('Failed to add report to library', 'error', undefined, isDarkMode);
      }
    } catch (error) {
      console.error('Error creating report epub:', error);
      showAlert(`Error creating report: ${(error as Error).message}`, 'error', undefined, isDarkMode);
    }
  };

  return (
    <>
      <AuthorsLayout
        theme={theme}
        isDarkMode={isDarkMode}
        onThemeToggle={toggleTheme}
        onAboutClick={() => setShowAboutModal(true)}
        onStorageClick={() => setShowStorageModal(true)}
        onFilesClick={() => setShowFilesModal(true)}
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible(!sidebarVisible)}
        onKeyClick={() => setShowSettingsDialog(true)}
        onModelsClick={() => setShowModelsDropdown(true)}
        onEditorClick={() => setShowEditor(true)}
        onAIWritingClick={() => setShowAIWriting(true)}
        onChatClick={() => setShowChat(true)}
        onCoverClick={handleOpenCoverModal}
        onLoadFromLibraryClick={() => setShowLibraryModal(true)}
        hasApiKey={hasApiKey}
        currentModel={currentModel}
        currentProvider={currentProvider}
        // AI Tools props
        selectedCategory={toolsState.selectedCategory}
        selectedTool={toolsState.selectedTool}
        toolsInCategory={toolsState.toolsInCategory}
        toolsReady={toolsState.toolsReady}
        toolExecuting={toolsState.toolExecuting}
        toolResult={toolsState.toolResult}
        elapsedTime={toolsState.elapsedTime}
        toolJustFinished={toolsState.toolJustFinished}
        manuscriptContent={toolsState.manuscriptContent}
        onCategoryChange={handleCategoryChange}
        onToolChange={handleToolChange}
        onClearTool={toolsActions.clearTool}
        onPromptEdit={handlePromptEdit}
        onExecuteTool={handleExecuteTool}
        onReport={handleReport}
        isLoadingPrompt={isLoadingPrompt}
        // Working Copy refresh props
        refreshKey={refreshKey}
        pendingSectionId={pendingSectionId}
        onPendingSectionHandled={() => setPendingSectionId(null)}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={showAboutModal}
        onClose={() => setShowAboutModal(false)}
        isDarkMode={isDarkMode}
        theme={theme}
        hideOnStartup={hideAboutOnStartup}
        onToggleHideOnStartup={handleToggleHideAboutOnStartup}
      />

      {/* Storage Modal */}
      <StorageModal
        isOpen={showStorageModal}
        onClose={() => setShowStorageModal(false)}
        isDarkMode={isDarkMode}
        theme={theme}
      />

      {/* Files Modal */}
      <FilesModal
        isOpen={showFilesModal}
        onClose={() => setShowFilesModal(false)}
        isDarkMode={isDarkMode}
        theme={theme}
      />

      {/* Settings Dialog (API Key) */}
      <SettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        onSave={handleSettingsSave}
        isDarkMode={isDarkMode}
        theme={theme}
        currentProvider="openrouter"
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
        isOpen={showEditor}
        onClose={() => {
          setShowEditor(false);
          setEditorInitialFile(null);
        }}
        theme={theme}
        isDarkMode={isDarkMode}
        initialFile={editorInitialFile}
      />

      {/* AI Writing Modal */}
      <WritingAssistantModal
        isOpen={showAIWriting}
        onClose={() => setShowAIWriting(false)}
        theme={theme}
        isDarkMode={isDarkMode}
        currentProvider={currentProvider}
        currentModel={currentModel}
        session={null}
        onLoadFileIntoEditor={handleLoadFileIntoEditor}
        onModalCloseReopen={() => {
          setShowAIWriting(false);
          setTimeout(() => setShowAIWriting(true), 150);
        }}
        onOpenChat={() => setShowChat(true)}
        onChapterAdded={(chapterId) => {
          // Set the section to select after refresh
          setPendingSectionId(chapterId);
          // Trigger AuthorsLayout to reload Working Copy
          setRefreshKey(prev => prev + 1);
        }}
      />

      {/* Chat Modal */}
      <SimpleChatModal
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        isDarkMode={isDarkMode}
      />

      {/* Book Info Modal */}
      <BookInfoModal
        isOpen={showBookInfo}
        onClose={() => setShowBookInfo(false)}
        onSave={() => setShowBookInfo(false)}
        theme={theme}
        isDarkMode={isDarkMode}
      />

      {/* Library Books Modal */}
      <LibraryBooksModal
        isOpen={showLibraryModal}
        onClose={() => setShowLibraryModal(false)}
        onSelectBook={handleLoadFromLibrary}
        theme={theme}
        isDarkMode={isDarkMode}
      />

      {/* Cover Generator Modal */}
      <CoverModal
        isOpen={showCoverModal}
        onClose={() => setShowCoverModal(false)}
        theme={theme}
        title={coverTitle}
        author={coverAuthor}
        onCoverSaved={handleCoverSaved}
      />

      {/* Dual Panel Editor (View-Edit for AI tool results) */}
      {showDualEditor && toolsState.manuscriptContent && (
        <DualPanelEditor
          isVisible={showDualEditor}
          onClose={() => setShowDualEditor(false)}
          manuscriptContent={toolsState.manuscriptContent}
          manuscriptName="manuscript.txt"
          aiReport={toolsState.toolResult}
          savedReportFileName={toolsState.savedReportFileName}
          theme={theme}
          isDarkMode={isDarkMode}
        />
      )}
    </>
  );
}
