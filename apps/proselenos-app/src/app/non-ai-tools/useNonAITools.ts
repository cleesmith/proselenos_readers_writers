// Non-AI Tools Manager Hook
// Extracted from app/page.tsx - handles non-AI tools state and operations

import { useState, useRef } from 'react';
import { showAlert } from '../shared/alerts';
import { listProjectFilesAction } from '@/lib/project-actions';
import { publishManuscriptAction } from '@/lib/publish-actions';
import { listDocxFilesAction, extractDocxCommentsAction } from '@/lib/docx-comments-actions';
import { listEpubFilesAction, convertEpubToTextAction } from '@/lib/epub-conversion-actions';
import { listTxtFilesAction, extractChaptersAction } from '@/lib/chapter-extraction-actions';
import { listManuscriptsForMergeAction, mergeChaptersAction } from '@/lib/chapter-merge-actions';

interface NonAIToolsManagerState {
  selectedNonAITool: string;
  selectedManuscriptForTool: any | null;
  showFileSelector: boolean;
  fileSelectorFiles: any[];
  isPublishing: boolean;
  publishResult: string | null;
  toolJustFinished: boolean;
  // Timer state
  elapsedTime: number;
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
  'Extract Chapters from Manuscript',
  'Merge Chapters into Edited Manuscript',
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

  // Timer state
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerIntervalRef = useRef<number | null>(null);

  // Timer helpers
  const startTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    const now = Date.now();
    setElapsedTime(0);
    timerIntervalRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - now) / 1000));
    }, 1000) as unknown as number;
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

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
        // Get DOCX files for comment extraction from project
        result = await listDocxFilesAction(currentProject);
      } else if (selectedNonAITool === 'EPUB to TXT Converter') {
        // Get EPUB files for conversion from project
        result = await listEpubFilesAction(currentProject);
      } else if (selectedNonAITool === 'Extract Chapters from Manuscript') {
        // Get TXT files for chapter extraction from project
        result = await listTxtFilesAction(currentProject);
      } else if (selectedNonAITool === 'Merge Chapters into Edited Manuscript') {
        // Get manuscript files (non-chapter .txt files) for merging
        result = await listManuscriptsForMergeAction(currentProject);
      } else {
        // Get text files from current project for other tools
        result = await listProjectFilesAction(currentProject);
      }

      if (result.success && result.data?.files) {
        let filteredFiles = result.data.files;

        // Apply additional filtering if needed
        if (selectedNonAITool !== 'DOCX: Extract Comments as Text' &&
            selectedNonAITool !== 'EPUB to TXT Converter' &&
            selectedNonAITool !== 'Extract Chapters from Manuscript' &&
            selectedNonAITool !== 'Merge Chapters into Edited Manuscript') {
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
    } else if (selectedNonAITool === 'Extract Chapters from Manuscript') {
      await handleChapterExtraction(_session, currentProject, onShowAlert, isDarkMode);
    } else if (selectedNonAITool === 'Merge Chapters into Edited Manuscript') {
      await handleChapterMerge(_session, currentProject, onShowAlert, isDarkMode);
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
    startTimer();

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
      stopTimer();
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
    startTimer();

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
      stopTimer();
      setIsPublishing(false);
      setToolJustFinished(true);
    }
  };

  const handleChapterExtraction = async (
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
      onShowAlert('error', 'Please select a manuscript file first', isDarkMode);
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);
    startTimer();

    try {
      // selectedManuscriptForTool.id is the file path (e.g., "ProjectName/manuscript.txt")
      const result = await extractChaptersAction(
        currentProject,
        selectedManuscriptForTool.id
      );

      if (result.success && result.data) {
        const { chapterCount, totalWords } = result.data;
        const lastFileName = `c${String(chapterCount).padStart(4, '0')}.txt`;
        const successMessage = `Extracted ${chapterCount} chapters (${totalWords.toLocaleString()} words). Files: c0001.txt through ${lastFileName}`;
        setPublishResult(successMessage);
        onShowAlert('success', `Extracted ${chapterCount} chapters`, isDarkMode);
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
      stopTimer();
      setIsPublishing(false);
      setToolJustFinished(true);
    }
  };

  const handleChapterMerge = async (
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
      onShowAlert('error', 'Please select a chapter file first', isDarkMode);
      return;
    }

    setIsPublishing(true);
    setPublishResult(null);
    startTimer();

    try {
      // selectedManuscriptForTool.id is the file path (e.g., "ProjectName/ovids_tenth_c0001.txt")
      const result = await mergeChaptersAction(
        currentProject,
        selectedManuscriptForTool.id
      );

      if (result.success && result.data) {
        const { outputFileName, chapterCount, totalWords, deletedCount } = result.data;
        const successMessage = `Merged ${chapterCount} chapters into ${outputFileName} (${totalWords.toLocaleString()} words). Deleted ${deletedCount} chapter files.`;
        setPublishResult(successMessage);
        onShowAlert('success', `Merged ${chapterCount} chapters into ${outputFileName}`, isDarkMode);
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
      stopTimer();
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
    stopTimer();
    setElapsedTime(0);
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
    toolJustFinished,
    elapsedTime
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