// Non-AI Tools Manager Hook
// Extracted from app/page.tsx - handles non-AI tools state and operations

import { useState } from 'react';
import { showAlert } from '../shared/alerts';
import { listProjectFilesAction } from '@/lib/github-project-actions';
import { publishManuscriptAction } from '@/lib/publish-actions';
import { listDocxFilesAction, extractDocxCommentsAction } from '@/lib/docx-comments-actions';
import { listEpubFilesAction, convertEpubToTextAction } from '@/lib/epub-conversion-actions';

interface NonAIToolsManagerState {
  selectedNonAITool: string;
  selectedManuscriptForTool: any | null;
  showFileSelector: boolean;
  fileSelectorFiles: any[];
  isPublishing: boolean;
  publishResult: string | null;
  toolJustFinished: boolean;
}

interface NonAIToolsManagerActions {
  setSelectedNonAITool: (tool: string) => void;
  setupNonAITool: (session: any, currentProject: string | null, currentProjectId: string | null, setIsStorageOperationPending: (loading: boolean) => void, isDarkMode: boolean) => Promise<void>;
  setSelectedManuscriptForTool: (file: any) => void;
  setShowFileSelector: (show: boolean) => void;
  handleRun: (
    session: any,
    isStorageOperationPending: boolean,
    toolExecuting: boolean,
    currentProject: string | null,
    currentProjectId: string | null,
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => Promise<void>;
  clearTool: () => void;
}

// Available non-AI tools
export const NON_AI_TOOLS = [
  'DOCX: Extract Comments as Text',
  'EPUB to TXT Converter'
];

export function useNonAITools(): [NonAIToolsManagerState, NonAIToolsManagerActions] {
  const [selectedNonAITool, setSelectedNonAITool] = useState('');
  const [selectedManuscriptForTool, setSelectedManuscriptForTool] = useState<any | null>(null);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [fileSelectorFiles, setFileSelectorFiles] = useState<any[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [toolJustFinished, setToolJustFinished] = useState(false);

  // Select non-AI tool - show file selector (exactly like AI Tools)
  const setupNonAITool = async (
    _session: any,
    currentProject: string | null,
    currentProjectId: string | null,
    setIsStorageOperationPending: (loading: boolean) => void,
    isDarkMode: boolean
  ) => {
    if (!currentProject || !currentProjectId) {
      showAlert('Please select a project first', 'warning', undefined, isDarkMode);
      return;
    }
    setIsStorageOperationPending(true);
    try {
      let result;

      // Choose which files to load based on selected tool
      if (selectedNonAITool === 'DOCX: Extract Comments as Text') {
        // Get DOCX files for comment extraction from GitHub repo
        result = await listDocxFilesAction(currentProject);
      } else if (selectedNonAITool === 'EPUB to TXT Converter') {
        // Get EPUB files for conversion from GitHub repo
        result = await listEpubFilesAction(currentProject);
      } else {
        // Get text files from current project for other tools
        result = await listProjectFilesAction(currentProject);
      }

      if (result.success && result.data?.files) {
        let filteredFiles = result.data.files;

        // Apply additional filtering if needed
        if (selectedNonAITool !== 'DOCX: Extract Comments as Text' && selectedNonAITool !== 'EPUB to TXT Converter') {
          // Filter for .txt files (exactly like AI Tools)
          filteredFiles = result.data.files.filter((file: any) =>
            file.name.endsWith('.txt') ||
            file.mimeType === 'text/plain'
          );
        }

        setFileSelectorFiles(filteredFiles);
        setShowFileSelector(true);
      } else {
        showAlert(`Failed to load project files: ${result.error}`, 'error', undefined, isDarkMode);
      }
    } catch (error: any) {
      showAlert(`Error loading project files: ${error.message}`, 'error', undefined, isDarkMode);
    } finally {
      setIsStorageOperationPending(false);
    }
  };


  // Run the selected non-AI tool
  const handleRun = async (
    _session: any,
    isStorageOperationPending: boolean,
    toolExecuting: boolean,
    currentProject: string | null,
    currentProjectId: string | null,
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => {
    if (isStorageOperationPending || toolExecuting || isPublishing) {
      return;
    }

    if (selectedNonAITool === 'DOCX: Extract Comments as Text') {
      await handleDocxCommentsExtraction(_session, currentProject, onShowAlert, isDarkMode);
    } else if (selectedNonAITool === 'EPUB to TXT Converter') {
      await handleEpubConversion(_session, currentProject, onShowAlert, isDarkMode);
    } else if (selectedNonAITool === 'Publish or Unpublish Manuscript') {
      await handlePublishManuscript(_session, currentProjectId, onShowAlert, isDarkMode);
    } else {
      // Future functionality for other tools
      console.log('Non-AI Tool Run - Future functionality:', selectedNonAITool);
      onShowAlert('error', `${selectedNonAITool} - Not yet implemented`, isDarkMode);
    }
  };

  const handleDocxCommentsExtraction = async (
    _session: any,
    currentProject: string | null,
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => {
    if (!currentProject) {
      onShowAlert('error', 'Please select a project first', isDarkMode);
      return;
    }

    if (!selectedManuscriptForTool) {
      onShowAlert('error', 'Please select a DOCX file first', isDarkMode);
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);

    try {
      // Generate output filename based on original filename
      const originalName = selectedManuscriptForTool.name.replace('.docx', '');
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 15);
      const outputFileName = `${originalName}_comments_${timestamp}.txt`;

      // selectedManuscriptForTool.id is now the file path (e.g., "ProjectName/file.docx")
      const result = await extractDocxCommentsAction(
        selectedManuscriptForTool.id,
        outputFileName,
        currentProject
      );

      if (result.success && result.data) {
        const { commentCount, hasComments } = result.data;
        const successMessage = hasComments
          ? `Successfully extracted ${commentCount} comments and paired them with referenced text.`
          : 'No comments found in document. Document content saved for reference.';
        setPublishResult(successMessage);
        onShowAlert('success', successMessage, isDarkMode);
      } else {
        const errorMessage = result.error || 'Unknown error occurred';
        setPublishResult(`Error: ${errorMessage}`);
        onShowAlert('error', errorMessage, isDarkMode);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPublishResult(`Error: ${errorMessage}`);
      onShowAlert('error', errorMessage, isDarkMode);
    } finally {
      setIsPublishing(false);
      setToolJustFinished(true);
    }
  };

  const handleEpubConversion = async (
    _session: any,
    currentProject: string | null,
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => {
    if (!currentProject) {
      onShowAlert('error', 'Please select a project first', isDarkMode);
      return;
    }

    if (!selectedManuscriptForTool) {
      onShowAlert('error', 'Please select an EPUB file first', isDarkMode);
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);

    try {
      // Generate output filename based on original filename
      const originalName = selectedManuscriptForTool.name.replace('.epub', '');
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '').substring(0, 15);
      const outputFileName = `${originalName}_converted_${timestamp}.txt`;

      // selectedManuscriptForTool.id is now the file path (e.g., "ProjectName/file.epub")
      const result = await convertEpubToTextAction(
        selectedManuscriptForTool.id,
        outputFileName,
        currentProject
      );

      if (result.success && result.data) {
        const { chapterCount, wordCount } = result.data;
        const successMessage = `Successfully converted EPUB to text with ${chapterCount} chapters (${wordCount} words).`;
        setPublishResult(successMessage);
        onShowAlert('success', successMessage, isDarkMode);
      } else {
        const errorMessage = result.error || 'Unknown error occurred';
        setPublishResult(`Error: ${errorMessage}`);
        onShowAlert('error', errorMessage, isDarkMode);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPublishResult(`Error: ${errorMessage}`);
      onShowAlert('error', errorMessage, isDarkMode);
    } finally {
      setIsPublishing(false);
      setToolJustFinished(true);
    }
  };

  const handlePublishManuscript = async (
    _session: any,
    currentProjectId: string | null,
    onShowAlert: (type: 'success' | 'error', message: string, isDarkMode: boolean) => void,
    isDarkMode: boolean
  ) => {
    if (!currentProjectId) {
      onShowAlert('error', 'Please select a project first', isDarkMode);
      return;
    }

    if (!selectedManuscriptForTool) {
      onShowAlert('error', 'Please select a manuscript file first', isDarkMode);
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);

    try {
      const result = await publishManuscriptAction(selectedManuscriptForTool.id, currentProjectId);
      
      if (result.success && result.data) {
        const { stats, generatedFiles } = result.data;
        const fileTypes = generatedFiles.includes('manuscript.epub') ? 'HTML and EPUB' : 'HTML';
        const successMessage = `Published successfully! Generated ${fileTypes} with ${stats.chapterCount} chapters (${stats.wordCount} words)`;
        setPublishResult(successMessage);
        onShowAlert('success', successMessage, isDarkMode);
      } else {
        const errorMessage = result.error || 'Unknown error occurred';
        setPublishResult(`Error: ${errorMessage}`);
        onShowAlert('error', errorMessage, isDarkMode);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setPublishResult(`Error: ${errorMessage}`);
      onShowAlert('error', errorMessage, isDarkMode);
    } finally {
      setIsPublishing(false);
      setToolJustFinished(true);
    }
  };

  // Clear all state (like AI Tools Clear button)
  const clearTool = () => {
    setSelectedManuscriptForTool(null);
    setPublishResult(null);
    setFileSelectorFiles([]);
    setToolJustFinished(false);
  };

  const state: NonAIToolsManagerState = {
    selectedNonAITool,
    selectedManuscriptForTool,
    showFileSelector,
    fileSelectorFiles,
    isPublishing,
    publishResult,
    toolJustFinished
  };

  const actions: NonAIToolsManagerActions = {
    setSelectedNonAITool,
    setupNonAITool,
    setSelectedManuscriptForTool,
    setShowFileSelector,
    handleRun,
    clearTool
  };

  return [state, actions];
}